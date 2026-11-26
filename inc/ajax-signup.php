<?php

if (!defined('ABSPATH')) {
	exit;
}

function ctwpml_cpf_digits(string $value): string {
	$digits = preg_replace('/\D+/', '', $value);
	return substr((string) $digits, 0, 11);
}

function ctwpml_is_valid_cpf(string $cpf_digits): bool {
	if (strlen($cpf_digits) !== 11) {
		return false;
	}
	if (preg_match('/^(\d)\1{10}$/', $cpf_digits)) {
		return false;
	}

	$nums = array_map('intval', str_split($cpf_digits));

	$sum = 0;
	for ($i = 0, $w = 10; $i < 9; $i++, $w--) {
		$sum += $nums[$i] * $w;
	}
	$d1 = ($sum * 10) % 11;
	if ($d1 === 10) {
		$d1 = 0;
	}
	if ($d1 !== $nums[9]) {
		return false;
	}

	$sum = 0;
	for ($i = 0, $w = 11; $i < 10; $i++, $w--) {
		$sum += $nums[$i] * $w;
	}
	$d2 = ($sum * 10) % 11;
	if ($d2 === 10) {
		$d2 = 0;
	}
	return $d2 === $nums[10];
}

add_action('wp_ajax_nopriv_ctwpml_signup', 'ctwpml_ajax_signup');
function ctwpml_ajax_signup(): void {
	$guard = ctwpml_auth_request_guard('ctwpml_signup');
	if (is_wp_error($guard)) {
		wp_send_json_error(['message'=>$guard->get_error_message()], $guard->get_error_code() === 'rate_limited' ? 429 : 400);
		return;
	}

	$name = isset($_POST['name']) && is_string($_POST['name']) ? sanitize_text_field((string) wp_unslash($_POST['name'])) : '';
	$email = isset($_POST['email']) && is_string($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$email = strtolower(trim($email));
	$recaptcha_response = isset($_POST['recaptcha_response']) && is_string($_POST['recaptcha_response']) ? sanitize_text_field(wp_unslash($_POST['recaptcha_response'])) : '';

	$captcha = ctwpml_verify_checkout_recaptcha($recaptcha_response);
	if (is_wp_error($captcha)) {
		wp_send_json_error(['message'=>$captcha->get_error_message()]);
		return;
	}

	if ($name === '' || $email === '') {
		wp_send_json_error(['message' => 'Preencha nome e e-mail.']);
	}
	if (!is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
	}
	if (email_exists($email)) {
		wp_send_json_error(['message' => 'Já existe uma conta com este e-mail. Faça login.']);
	}

	$username_base = sanitize_user(current(explode('@', $email)));
	$username = $username_base;
	$tries = 0;
	while (username_exists($username) && $tries < 20) {
		$tries++;
		$username = $username_base . '_' . wp_rand(100, 9999);
	}
	if (username_exists($username)) {
		wp_send_json_error(['message' => 'Não foi possível gerar usuário. Tente novamente.']);
	}

	$password = wp_generate_password(20, true, true);

	$user_id = 0;
	if (function_exists('wc_create_new_customer')) {
		$user_id = wc_create_new_customer($email, $username, $password);
		if (is_wp_error($user_id)) {
			wp_send_json_error(['message' => $user_id->get_error_message()]);
		}
	} else {
		$user_id = wp_create_user($username, $password, $email);
		if (is_wp_error($user_id)) {
			wp_send_json_error(['message' => $user_id->get_error_message()]);
		}
	}

	if ((int) $user_id <= 0) { wp_send_json_error(['message'=>'Não foi possível criar a conta. Tente novamente.']); return; }

	// Nome
	$parts = preg_split('/\s+/', trim($name));
	$first = $parts ? array_shift($parts) : '';
	$last = $parts ? implode(' ', $parts) : '';

	wp_update_user([
		'ID' => $user_id,
		'display_name' => $name,
		'first_name' => $first,
		'last_name' => $last,
	]);

	// Loga automaticamente
	wp_set_current_user($user_id);
	wp_set_auth_cookie($user_id, true);
	
	if (function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled()) {
		error_log('[CTWPML] Signup: Cookie de autenticação definido para user_id=' . $user_id);
		error_log('[CTWPML] Signup: is_user_logged_in()=' . (is_user_logged_in() ? 'true' : 'false'));
	}

	wp_send_json_success(['user_id' => $user_id]);
}
