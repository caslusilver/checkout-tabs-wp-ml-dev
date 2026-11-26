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
	// Identificador em sessão não comprova autenticação para reutilizar outra conta.
	$username_base = sanitize_user(explode('@', $email)[0]);
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
		$user_id = wc_create_new_customer($email, $username, $password);
	} else {
		$user_id = wp_create_user($username, $password, $email);
	}
	if (is_wp_error($user_id) || $user_id <= 0) {
		return $customer_id;
	}
	$user_id = (int)$user_id;

	if ($session) {
		$session->set('ctwpml_guest_created_user_id', $user_id);
	}
	if (function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user($user_id);
	}
	// Apenas a conta recém-criada neste fluxo; um e-mail existente nunca chega aqui.
	// Usa a mesma autenticação nativa de process_customer, evitando uma segunda criação.
	if (function_exists('wc_set_customer_auth_cookie')) {
		if ($session && is_callable([$session, 'save_data'])) $session->save_data();
		wc_set_customer_auth_cookie($user_id);
		if (function_exists('WC') && WC()->cart && is_callable([WC()->cart, 'calculate_totals'])) WC()->cart->calculate_totals();
	}

	return $user_id;
}, 10, 2);

function ctwpml_submitted_checkout_phone(): ?array {
	if (!array_key_exists('ctwpml_checkout_phone_full', $_POST)) {
		return null;
	}
	$read = static function (string $name): string {
		$value = $_POST[$name] ?? null;
		return is_string($value) ? sanitize_text_field(wp_unslash($value)) : '';
	};
	$full = $read('ctwpml_checkout_phone_full');
	$country = strtoupper($read('ctwpml_checkout_phone_country'));
	$dial = $read('ctwpml_checkout_dial_code');
	if (!preg_match('/^\+[1-9]\d{7,14}$/D', $full) ||
		!preg_match('/^[A-Z]{2}$/D', $country) ||
		!preg_match('/^\+[1-9]\d{0,2}$/D', $dial) || ctwpml_contact_dial_code($dial, $full) === '') {
		return [];
	}

	$shape = ctwpml_contact_phone_for_woo('', $full, $country, $dial);
	if (!$shape['valid'] || $full !== $dial . $shape['woo_digits'] || ($dial === '+55') !== ($country === 'BR')) {
		return [];
	}

	return [
		'phone_full' => $full,
		'country_code' => $country,
		'dial_code' => $dial,
		'whatsapp' => $shape['woo_digits'],
	];
}

add_filter('woocommerce_checkout_posted_data', function (array $data): array {
	$phone = ctwpml_submitted_checkout_phone();
	if ($phone) {
		$data['billing_cellphone'] = $phone['whatsapp'];
		$data['billing_phone'] = $phone['whatsapp'];
	}
	return $data;
}, PHP_INT_MAX);

add_action('woocommerce_after_checkout_validation', function ($data, $errors): void {
	if (ctwpml_submitted_checkout_phone() === []) {
		$errors->add('ctwpml_invalid_checkout_phone', 'Confira o DDI e o número do telefone.', ['id' => 'billing_cellphone']);
	}
}, 20, 2);

add_action('woocommerce_checkout_update_user_meta', function ($user_id): void {
	if ($user_id && function_exists('ctwpml_migrate_guest_data_to_user')) {
		ctwpml_migrate_guest_data_to_user((int) $user_id);
	}
	$phone = ctwpml_submitted_checkout_phone();
	if ($user_id && $phone) {
		ctwpml_apply_contact_meta_to_user((int) $user_id, $phone);
		update_user_meta((int) $user_id, 'billing_phone', $phone['whatsapp']);
	}
}, 20, 1);

add_action('woocommerce_checkout_create_order', function (WC_Order $order, array $data): void {
	$submitted = ctwpml_submitted_checkout_phone();
	if ($submitted) {
		$order->set_billing_phone($submitted['whatsapp']);
		$order->update_meta_data('_billing_cellphone', $submitted['whatsapp']);
		$order->update_meta_data('_ctwpml_dial_code', $submitted['dial_code']);
		$order->update_meta_data('_ctwpml_phone_country', $submitted['country_code']);
		$order->update_meta_data('_ctwpml_phone_is_national', 'yes');
		return;
	}

	$user_id = (int) $order->get_customer_id();
	if ($user_id > 0) {
		$contact = [
			'phone_full' => get_user_meta($user_id, '_ctwpml_phone_full', true),
			'country_code' => get_user_meta($user_id, '_ctwpml_country_code', true),
			'dial_code' => get_user_meta($user_id, '_ctwpml_dial_code', true),
		];
	} else {
		$contact = ctwpml_guest_contact_meta_get();
	}

	$full = (string) ($contact['phone_full'] ?? '');
	$dial_code = ctwpml_contact_dial_code((string) ($contact['dial_code'] ?? ''), $full);
	$shape = ctwpml_contact_phone_for_woo('', $full, (string) ($contact['country_code'] ?? ''), $dial_code);
	$phone = preg_replace('/\D+/', '', (string) ($data['billing_cellphone'] ?? $order->get_meta('_billing_cellphone')));
	if ($phone === '') {
		$phone = preg_replace('/\D+/', '', (string) $order->get_billing_phone());
	}

	// Um pedido reaproveitado pelo WooCommerce pode ter sido iniciado com outro telefone.
	if ($dial_code === '' || !$shape['valid'] || $shape['woo_digits'] !== $phone) {
		$order->delete_meta_data('_ctwpml_dial_code');
		$order->delete_meta_data('_ctwpml_phone_country');
		return;
	}
	$order->update_meta_data('_ctwpml_dial_code', $dial_code);
	$order->update_meta_data('_ctwpml_phone_country', strtoupper((string) ($contact['country_code'] ?? '')));
}, PHP_INT_MAX, 2);

function ctwpml_apply_order_phone_to_payload(array $payload, WC_Order $order): array {
	if ($order->get_meta('_ctwpml_phone_is_national') !== 'yes') {
		return $payload;
	}
	$national = (string) $order->get_meta('_billing_cellphone');
	if (isset($payload['cellphone'])) {
		$payload['cellphone'] = $national;
	}
	if (isset($payload['billing']['cellphone'])) {
		$payload['billing']['cellphone'] = $national;
	}
	if (isset($payload['meta_data']) && is_array($payload['meta_data'])) {
		$metadata = [];
		foreach ($payload['meta_data'] as $meta) {
			$key = is_array($meta) ? ($meta['key'] ?? '') : ($meta->key ?? '');
			if ($key === '_ctwpml_phone_is_national') {
				continue;
			}
			if ($key === '_billing_cellphone') {
				if (is_array($meta)) {
					$meta['value'] = $national;
				} else {
					$meta = clone $meta;
					$meta->value = $national;
				}
			}
			$metadata[] = $meta;
		}
		$payload['meta_data'] = $metadata;
	}
	return $payload;
}

add_filter('woocommerce_rest_prepare_shop_order_object', function ($response, $order) {
	if ($order instanceof WC_Order && is_array($response->get_data())) {
		$response->set_data(ctwpml_apply_order_phone_to_payload($response->get_data(), $order));
	}
	return $response;
}, PHP_INT_MAX, 2);

add_filter('woocommerce_webhook_payload', function ($payload, $resource, $resource_id) {
	if ($resource !== 'order' || !is_array($payload)) {
		return $payload;
	}
	$order = wc_get_order($resource_id);
	if ($order instanceof WC_Order) {
		$payload = ctwpml_apply_order_phone_to_payload($payload, $order);
	}
	$dial_code = $order instanceof WC_Order ? (string) $order->get_meta('_ctwpml_dial_code') : '';
	if ($dial_code !== '') {
		$payload['dial_code'] = $dial_code;
	}
	return $payload;
}, 10, 3);

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
