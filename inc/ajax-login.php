<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_nopriv_ctwpml_login', 'checkout_tabs_wp_ml_ajax_login');

function checkout_tabs_wp_ml_ajax_login(): void {
	$is_debug_enabled = function_exists('checkout_tabs_wp_ml_is_debug_enabled') ? checkout_tabs_wp_ml_is_debug_enabled() : false;

	if ($is_debug_enabled) {
		error_log('[CTWPML] ajax_login - INICIANDO');
	}

	if (!check_ajax_referer('ctwpml_login', '_ajax_nonce', false)) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] ajax_login - Nonce inválido');
		wp_send_json_error(['message' => 'Nonce inválido. Recarregue a página e tente novamente.']);
		return;
	}

	$email = isset($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$password = isset($_POST['password']) ? (string) wp_unslash($_POST['password']) : '';
	$recaptcha_response = isset($_POST['recaptcha_response']) ? (string) wp_unslash($_POST['recaptcha_response']) : '';

	if ($email === '' || $password === '') {
		wp_send_json_error(['message' => 'Preencha e-mail e senha.']);
		return;
	}

	// reCAPTCHA server-side (obrigatório quando o popup exibe reCAPTCHA)
	if ($recaptcha_response === '') {
		wp_send_json_error(['message' => 'Por favor, complete o reCAPTCHA.']);
		return;
	}

	$secret_key = (string) get_option('checkout_tabs_wp_ml_recaptcha_secret_key', '');
	if ($secret_key === '') {
		$login_recaptcha_opts = get_option('login_nocaptcha_options', []);
		if (is_array($login_recaptcha_opts) && isset($login_recaptcha_opts['secret_key'])) {
			$secret_key = (string) $login_recaptcha_opts['secret_key'];
		}
	}

	if ($secret_key === '') {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] ajax_login - Secret key reCAPTCHA ausente');
		wp_send_json_error(['message' => 'reCAPTCHA não configurado (secret).']);
		return;
	}

	$verify_url = 'https://www.google.com/recaptcha/api/siteverify';
	$verify = wp_remote_post($verify_url, [
		'timeout' => 10,
		'body' => [
			'secret' => $secret_key,
			'response' => $recaptcha_response,
			'remoteip' => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field((string) $_SERVER['REMOTE_ADDR']) : '',
		],
	]);

	if (is_wp_error($verify)) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] ajax_login - siteverify wp_error: ' . $verify->get_error_message());
		wp_send_json_error(['message' => 'Erro ao verificar reCAPTCHA. Tente novamente.']);
		return;
	}

	$body = (string) wp_remote_retrieve_body($verify);
	$decoded = json_decode($body, true);
	$recaptcha_ok = is_array($decoded) && isset($decoded['success']) && $decoded['success'] === true;

	if (!$recaptcha_ok) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] ajax_login - reCAPTCHA inválido: ' . $body);
		wp_send_json_error(['message' => 'reCAPTCHA inválido. Por favor, tente novamente.']);
		return;
	}

	$creds = [
		'user_login' => $email,
		'user_password' => $password,
		'remember' => true,
	];

	$user = wp_signon($creds, is_ssl());
	if (is_wp_error($user)) {
		if ($is_debug_enabled) error_log('[CTWPML ERROR] ajax_login - wp_signon: ' . $user->get_error_message());
		wp_send_json_error(['message' => wp_strip_all_tags((string) $user->get_error_message())]);
		return;
	}

	wp_send_json_success([
		'message' => 'Login realizado com sucesso.',
		'user_email' => $user->user_email,
	]);
}



