<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_nopriv_ctwpml_auth_email', 'ctwpml_ajax_auth_email');

function ctwpml_ajax_auth_email(): void {
	$is_debug_enabled = function_exists('checkout_tabs_wp_ml_is_debug_enabled') ? checkout_tabs_wp_ml_is_debug_enabled() : false;

	$guard = ctwpml_auth_request_guard('ctwpml_auth_email');
	if (is_wp_error($guard)) {
		wp_send_json_error(['message'=>$guard->get_error_message()], $guard->get_error_code() === 'rate_limited' ? 429 : 400);
		return;
	}

	$email = isset($_POST['email']) && is_string($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$email = strtolower(trim($email));
	$name = isset($_POST['name']) && is_string($_POST['name']) ? sanitize_text_field((string) wp_unslash($_POST['name'])) : '';
	$name = trim((string) preg_replace('/\s+/', ' ', $name));
	$recaptcha_response = isset($_POST['recaptcha_response']) && is_string($_POST['recaptcha_response']) ? sanitize_text_field((string) wp_unslash($_POST['recaptcha_response'])) : '';

	if ($email === '' || !is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
		return;
	}

	$captcha = ctwpml_verify_checkout_recaptcha($recaptcha_response);
	if (is_wp_error($captcha)) {
		wp_send_json_error(['message'=>$captcha->get_error_message()]);
		return;
	}

	// Importante (UX + segurança):
	// Este endpoint cria apenas conta nova; a proteção segue a configuração do servidor.
	// Conta existente sempre exige autenticação pelo fluxo de login.
	$user = get_user_by('email', $email);
	if ($user) {
		wp_send_json_error(['message' => 'Já existe uma conta com este e-mail. Faça login.']);
		return;
	}

	$is_new = true;
	if (!$user) {
		$username_base = sanitize_user(current(explode('@', $email)));
		$username = $username_base;
		$tries = 0;
		while (username_exists($username) && $tries < 20) {
			$tries++;
			$username = $username_base . '_' . wp_rand(100, 9999);
		}
		if (username_exists($username)) {
			wp_send_json_error(['message' => 'Não foi possível gerar usuário. Tente novamente.']);
			return;
		}

		$password = wp_generate_password(20, true, true);
		$user_id = 0;
		if (function_exists('wc_create_new_customer')) {
			$user_id = wc_create_new_customer($email, $username, $password);
		} else {
			$user_id = wp_create_user($username, $password, $email);
		}
		if (is_wp_error($user_id) || $user_id <= 0) {
			$message = is_wp_error($user_id) ? $user_id->get_error_message() : 'Falha ao criar usuário.';
			wp_send_json_error(['message' => wp_strip_all_tags((string) $message)]);
			return;
		}
		$user = get_user_by('id', $user_id);
		if ($user) {
			$first_name = '';
			$last_name = '';
			if ($name !== '') {
				$name_parts = preg_split('/\s+/', $name);
				if (is_array($name_parts) && !empty($name_parts)) {
					$first_name = sanitize_text_field((string) array_shift($name_parts));
					$last_name = sanitize_text_field(trim((string) implode(' ', $name_parts)));
				}
			}

			wp_update_user([
				'ID' => $user->ID,
				'display_name' => $name !== '' ? $name : $email,
				'user_nicename' => $username,
			]);

			if ($first_name !== '') {
				update_user_meta($user->ID, 'first_name', $first_name);
				update_user_meta($user->ID, 'billing_first_name', $first_name);
			}
			if ($last_name !== '') {
				update_user_meta($user->ID, 'last_name', $last_name);
				update_user_meta($user->ID, 'billing_last_name', $last_name);
			}
			update_user_meta($user->ID, 'billing_email', $email);
		}
	}

	if (!$user || !($user instanceof WP_User)) {
		wp_send_json_error(['message' => 'Falha ao autenticar.']);
		return;
	}

	// Login do usuário recém-criado.
	if (function_exists('ctwpml_preserve_auth_coupons')) ctwpml_preserve_auth_coupons();
	wp_set_current_user($user->ID);
	wp_set_auth_cookie($user->ID, true);

	if (function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user((int) $user->ID);
	}

	if ($is_debug_enabled) {
		error_log('[CTWPML] auth_email - Login OK: user_id=' . $user->ID . ' is_new=' . ($is_new ? '1' : '0'));
	}

	wp_send_json_success([
		'user_id' => $user->ID,
		'user_email' => $user->user_email,
		'is_new' => $is_new ? 1 : 0,
	]);
}

