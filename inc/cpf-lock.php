<?php

if (!defined('ABSPATH')) {
	exit;
}

function ctwpml_cpf_digits_lock(string $value): string {
	$digits = preg_replace('/\D+/', '', $value);
	return substr((string) $digits, 0, 11);
}

function ctwpml_is_valid_cpf_lock(string $cpf_digits): bool {
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

/**
 * Front: se já existe CPF no perfil e está locked, bloqueia edição visualmente no checkout.
 */
add_filter('woocommerce_checkout_fields', function (array $fields): array {
	if (!is_user_logged_in()) {
		return $fields;
	}
	$user_id = get_current_user_id();
	$locked = (int) get_user_meta($user_id, 'ctwpml_cpf_locked', true) === 1;
	$cpf = (string) get_user_meta($user_id, 'billing_cpf', true);
	if (!$locked || $cpf === '') {
		return $fields;
	}
	if (!isset($fields['billing']['billing_cpf'])) {
		return $fields;
	}
	$fields['billing']['billing_cpf']['custom_attributes'] = array_merge(
		(array) ($fields['billing']['billing_cpf']['custom_attributes'] ?? []),
		[
			'readonly' => 'readonly',
		]
	);
	return $fields;
}, 30);

/**
 * Server: valida CPF e impede alteração após locked.
 */
add_action('woocommerce_after_checkout_validation', function ($data, $errors) {
	if (!is_user_logged_in()) {
		return;
	}
	$user_id = get_current_user_id();
	$locked = (int) get_user_meta($user_id, 'ctwpml_cpf_locked', true) === 1;
	$existing = ctwpml_cpf_digits_lock((string) get_user_meta($user_id, 'billing_cpf', true));
	$posted = ctwpml_cpf_digits_lock((string) ($data['billing_cpf'] ?? ''));

	if ($existing !== '' && $posted !== '' && $locked && $existing !== $posted) {
		$errors->add('billing_cpf', 'O CPF deste perfil é definitivo e não pode ser alterado.');
		return;
	}

	if ($existing === '' && $posted !== '' && !ctwpml_is_valid_cpf_lock($posted)) {
		$errors->add('billing_cpf', 'CPF inválido.');
	}
}, 10, 2);

/**
 * Quando o CPF for definido pela primeira vez via checkout, marca como locked.
 */
add_action('woocommerce_checkout_update_user_meta', function ($customer_id, $posted) {
	$cpf = ctwpml_cpf_digits_lock((string) ($posted['billing_cpf'] ?? ''));
	if ($cpf === '') {
		return;
	}
	$existing = ctwpml_cpf_digits_lock((string) get_user_meta($customer_id, 'billing_cpf', true));
	if ($existing === '') {
		update_user_meta($customer_id, 'billing_cpf', $cpf);
		update_user_meta($customer_id, 'ctwpml_cpf_locked', 1);
	}
}, 10, 2);

/**
 * Proteção extra: bloqueia update de billing_cpf quando já locked (para usuários comuns).
 */
add_filter('update_user_metadata', function ($check, $object_id, $meta_key, $meta_value) {
	if ($meta_key !== 'billing_cpf') {
		return $check;
	}
	// Admin pode alterar em caso de necessidade operacional.
	if (current_user_can('manage_woocommerce')) {
		return $check;
	}
	$locked = (int) get_user_meta((int) $object_id, 'ctwpml_cpf_locked', true) === 1;
	$current = ctwpml_cpf_digits_lock((string) get_user_meta((int) $object_id, 'billing_cpf', true));
	$new = ctwpml_cpf_digits_lock((string) $meta_value);
	if ($locked && $current !== '' && $new !== '' && $current !== $new) {
		return true; // short-circuit: não atualiza
	}
	return $check;
}, 10, 4);


