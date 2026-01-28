<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_nopriv_ctwpml_check_email', 'ctwpml_ajax_check_email_exists');
add_action('wp_ajax_ctwpml_check_email', 'ctwpml_ajax_check_email_exists');

function ctwpml_ajax_check_email_exists(): void {
	if (!check_ajax_referer('ctwpml_check_email', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Nonce inválido.']);
		return;
	}

	$email = isset($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	if ($email === '' || !is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
		return;
	}

	$exists = email_exists($email) ? 1 : 0;
	wp_send_json_success([
		'email' => $email,
		'exists' => $exists,
	]);
}
