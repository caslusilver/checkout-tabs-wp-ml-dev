<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Regras para checkout de visitante (login tardio).
 */

add_filter('woocommerce_checkout_fields', function (array $fields): array {
	if (isset($fields['billing']['billing_email'])) {
		$fields['billing']['billing_email']['required'] = true;
		$validate = isset($fields['billing']['billing_email']['validate']) && is_array($fields['billing']['billing_email']['validate'])
			? $fields['billing']['billing_email']['validate']
			: [];
		if (!in_array('email', $validate, true)) {
			$validate[] = 'email';
		}
		$fields['billing']['billing_email']['validate'] = $validate;
	}
	return $fields;
});

add_action('woocommerce_after_checkout_validation', function ($data, $errors): void {
	if (is_user_logged_in()) {
		return;
	}
	$email = isset($data['billing_email']) ? sanitize_email((string) $data['billing_email']) : '';
	if ($email && is_email($email) && email_exists($email)) {
		$errors->add('ctwpml_email_exists', 'Este e-mail já possui conta. Faça login para finalizar.');
	}
}, 10, 2);

add_filter('woocommerce_checkout_customer_id', function ($customer_id, $checkout = null) {
	if (!$checkout) {
		error_log('[CTWPML] guest-checkout: checkout arg ausente em woocommerce_checkout_customer_id');
	}
	if ($customer_id) {
		return $customer_id;
	}
	if (is_user_logged_in()) {
		return $customer_id;
	}
	$guest_enabled = ((string) get_option('woocommerce_enable_guest_checkout', 'no') === 'yes');
	$createaccount = isset($_POST['createaccount']) ? (string) wp_unslash($_POST['createaccount']) : '';
	$should_create = (!$guest_enabled) || ($createaccount === '1');
	if (!$should_create) {
		return $customer_id;
	}
	if (!$checkout || !method_exists($checkout, 'get_value')) {
		error_log('[CTWPML] guest-checkout: checkout inválido em woocommerce_checkout_customer_id');
		return $customer_id;
	}
	$email = $checkout && method_exists($checkout, 'get_value')
		? sanitize_email((string) $checkout->get_value('billing_email'))
		: '';
	if (!$email || !is_email($email)) {
		error_log('[CTWPML] guest-checkout: email inválido/ausente em woocommerce_checkout_customer_id');
		return $customer_id;
	}
	if (email_exists($email)) {
		return 0;
	}

	$session = function_exists('ctwpml_get_wc_session') ? ctwpml_get_wc_session() : null;
	if ($session) {
		$existing = (int) $session->get('ctwpml_guest_created_user_id');
		if ($existing > 0) {
			return $existing;
		}
	}

	$username_base = sanitize_user(current(explode('@', $email)));
	$username = $username_base;
	$tries = 0;
	while (username_exists($username) && $tries < 20) {
		$tries++;
		$username = $username_base . '_' . wp_rand(100, 9999);
	}
	if (username_exists($username)) {
		return $customer_id;
	}

	$password = wp_generate_password(20, true, true);
	$user_id = 0;
	if (function_exists('wc_create_new_customer')) {
		$user_id = (int) wc_create_new_customer($email, $username, $password);
	} else {
		$user_id = (int) wp_create_user($username, $password, $email);
	}
	if (is_wp_error($user_id) || $user_id <= 0) {
		return $customer_id;
	}

	if ($session) {
		$session->set('ctwpml_guest_created_user_id', $user_id);
	}
	if (function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user($user_id);
	}

	return $user_id;
}, 10, 2);

add_action('woocommerce_checkout_update_user_meta', function ($user_id): void {
	if ($user_id && function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user((int) $user_id);
	}
}, 20, 1);

add_action('woocommerce_checkout_process', function (): void {
	$session = function_exists('ctwpml_get_wc_session') ? ctwpml_get_wc_session() : null;
	if (!$session) {
		return;
	}
	$selected = (string) $session->get('ctwpml_selected_shipping_method');
	$chosen = $session->get('chosen_shipping_methods');
	$applied = '';
	if (is_array($chosen) && !empty($chosen)) {
		$applied = (string) $chosen[0];
	}
	if ($selected && $applied && $selected !== $applied) {
		wc_add_notice('Não foi possível aplicar o frete selecionado. Reabra a etapa de entrega e selecione novamente.', 'error');
	}
}, 5);
