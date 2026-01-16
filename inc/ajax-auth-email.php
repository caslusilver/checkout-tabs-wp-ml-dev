<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_nopriv_ctwpml_auth_email', 'ctwpml_ajax_auth_email');

function ctwpml_ajax_auth_email(): void {
	$is_debug_enabled = function_exists('checkout_tabs_wp_ml_is_debug_enabled') ? checkout_tabs_wp_ml_is_debug_enabled() : false;

	if (!check_ajax_referer('ctwpml_auth_email', '_ajax_nonce', false)) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] auth_email - Nonce inválido');
		wp_send_json_error(['message' => 'Nonce inválido. Recarregue a página e tente novamente.']);
		return;
	}

	$email = isset($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$email = strtolower(trim($email));
	$recaptcha_response = isset($_POST['recaptcha_response']) ? sanitize_text_field((string) wp_unslash($_POST['recaptcha_response'])) : '';

	if ($email === '' || !is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
		return;
	}

	if ($recaptcha_response === '') {
		wp_send_json_error(['message' => 'Você deve provar que não é um robô.']);
		return;
	}

	// reCAPTCHA server-side
	$secret_key = (string) get_option('checkout_tabs_wp_ml_recaptcha_secret_key', '');
	if ($secret_key === '') {
		$login_recaptcha_opts = get_option('login_nocaptcha_options', []);
		if (is_array($login_recaptcha_opts) && isset($login_recaptcha_opts['secret_key'])) {
			$secret_key = (string) $login_recaptcha_opts['secret_key'];
		}
	}

	if ($secret_key === '') {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] auth_email - Secret key reCAPTCHA ausente');
		wp_send_json_error(['message' => 'reCAPTCHA não configurado.']);
		return;
	}

	$verify = wp_remote_post('https://www.google.com/recaptcha/api/siteverify', [
		'timeout' => 10,
		'body' => [
			'secret' => $secret_key,
			'response' => $recaptcha_response,
			'remoteip' => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field((string) $_SERVER['REMOTE_ADDR']) : '',
		],
	]);

	if (is_wp_error($verify)) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] auth_email - siteverify wp_error: ' . $verify->get_error_message());
		wp_send_json_error(['message' => 'Erro ao verificar reCAPTCHA. Tente novamente.']);
		return;
	}

	$body = (string) wp_remote_retrieve_body($verify);
	$decoded = json_decode($body, true);
	$recaptcha_ok = is_array($decoded) && isset($decoded['success']) && $decoded['success'] === true;

	if (!$recaptcha_ok) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] auth_email - reCAPTCHA inválido: ' . $body);
		wp_send_json_error(['message' => 'reCAPTCHA inválido. Por favor, tente novamente.']);
		return;
	}

	$user = get_user_by('email', $email);
	$is_new = false;

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
			$user_id = (int) wc_create_new_customer($email, $username, $password);
		} else {
			$user_id = (int) wp_create_user($username, $password, $email);
		}
		if (is_wp_error($user_id) || $user_id <= 0) {
			$message = is_wp_error($user_id) ? $user_id->get_error_message() : 'Falha ao criar usuário.';
			wp_send_json_error(['message' => wp_strip_all_tags((string) $message)]);
			return;
		}
		$user = get_user_by('id', $user_id);
		$is_new = true;
		if ($user) {
			wp_update_user([
				'ID' => $user->ID,
				'display_name' => $email,
				'user_nicename' => $username,
			]);
		}
	}

	if (!$user || !($user instanceof WP_User)) {
		wp_send_json_error(['message' => 'Falha ao autenticar.']);
		return;
	}

	// Login sem senha conforme regra do produto (reCAPTCHA é a barreira).
	wp_set_current_user($user->ID);
	wp_set_auth_cookie($user->ID, true);

	if ($is_debug_enabled) {
		error_log('[CTWPML] auth_email - Login OK: user_id=' . $user->ID . ' is_new=' . ($is_new ? '1' : '0'));
	}

	wp_send_json_success([
		'user_id' => $user->ID,
		'user_email' => $user->user_email,
		'is_new' => $is_new ? 1 : 0,
	]);
}

