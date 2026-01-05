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

add_action('wp_ajax_nopriv_ctwpml_signup', function () {
	check_ajax_referer('ctwpml_signup', '_ajax_nonce');

	$name = isset($_POST['name']) ? sanitize_text_field((string) wp_unslash($_POST['name'])) : '';
	$email = isset($_POST['email']) ? sanitize_email((string) wp_unslash($_POST['email'])) : '';
	$email = strtolower(trim($email));
	$cpf = isset($_POST['cpf']) ? ctwpml_cpf_digits((string) wp_unslash($_POST['cpf'])) : '';

	if ($name === '' || $email === '' || $cpf === '') {
		wp_send_json_error(['message' => 'Preencha nome, e-mail e CPF.']);
	}
	if (!is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
	}
	if (!ctwpml_is_valid_cpf($cpf)) {
		wp_send_json_error(['message' => 'CPF inválido.']);
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
		$user_id = (int) wc_create_new_customer($email, $username, $password);
		if (is_wp_error($user_id)) {
			wp_send_json_error(['message' => $user_id->get_error_message()]);
		}
	} else {
		$user_id = (int) wp_create_user($username, $password, $email);
		if (is_wp_error($user_id)) {
			wp_send_json_error(['message' => $user_id->get_error_message()]);
		}
	}

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

	// CPF definitivo no perfil
	update_user_meta($user_id, 'billing_cpf', $cpf);
	update_user_meta($user_id, 'ctwpml_cpf_locked', 1);

	// Loga automaticamente
	wp_set_current_user($user_id);
	wp_set_auth_cookie($user_id, true);

	wp_send_json_success(['user_id' => $user_id]);
});


