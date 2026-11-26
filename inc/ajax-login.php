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

	$guard = ctwpml_auth_request_guard('ctwpml_login');
	if (is_wp_error($guard)) {
		wp_send_json_error(['message'=>$guard->get_error_message()], $guard->get_error_code() === 'rate_limited' ? 429 : 400);
		return;
	}

	$email = isset($_POST['email']) && is_string($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$password = isset($_POST['password']) && is_string($_POST['password']) ? (string) wp_unslash($_POST['password']) : '';
	$recaptcha_response = isset($_POST['recaptcha_response']) && is_string($_POST['recaptcha_response']) ? (string) wp_unslash($_POST['recaptcha_response']) : '';

	if ($email === '' || $password === '') {
		wp_send_json_error(['message' => 'Preencha e-mail e senha.']);
		return;
	}

	$captcha = ctwpml_verify_checkout_recaptcha($recaptcha_response);
	if (is_wp_error($captcha)) {
		wp_send_json_error(['message'=>$captcha->get_error_message()]);
		return;
	}

	$creds = [
		'user_login' => $email,
		'user_password' => $password,
		'remember' => true,
	];

	if (function_exists('ctwpml_preserve_auth_coupons')) ctwpml_preserve_auth_coupons();
	$user = wp_signon($creds, is_ssl());
	if (is_wp_error($user)) {
		ctwpml_auth_diagnostic('password_rejected');
		wp_send_json_error(['message' => 'Não foi possível entrar. Confira e-mail e senha ou recupere seu acesso.']);
		return;
	}

	if ($user instanceof WP_User && function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user((int) $user->ID);
	}

	wp_send_json_success([
		'message' => 'Login realizado com sucesso.',
		'user_email' => $user->user_email,
	]);
}



