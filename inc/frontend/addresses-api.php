<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Persistência simples de múltiplos endereços em user meta.
 *
 * Meta key: ctwpml_saved_addresses
 * Estrutura: array de itens com chaves sanitizadas.
 */

const CTWPML_ADDRESSES_META_KEY = 'ctwpml_saved_addresses';

function ctwpml_addresses_get_all(int $user_id): array {
	$raw = get_user_meta($user_id, CTWPML_ADDRESSES_META_KEY, true);
	if (!is_array($raw)) {
		return [];
	}

	// Normaliza: só arrays e limita tamanho.
	$out = [];
	foreach ($raw as $item) {
		if (!is_array($item)) {
			continue;
		}
		$out[] = $item;
		if (count($out) >= 30) {
			break;
		}
	}
	return $out;
}

function ctwpml_addresses_save_all(int $user_id, array $items): void {
	// Limita tamanho para evitar meta gigantesco.
	$items = array_slice($items, 0, 30);
	update_user_meta($user_id, CTWPML_ADDRESSES_META_KEY, $items);
}

function ctwpml_addresses_sanitize_item(array $in): array {
	$cep_digits = preg_replace('/\D+/', '', (string) ($in['cep'] ?? ''));
	$cep_digits = substr($cep_digits, 0, 8);

	$item = [
		'id'           => sanitize_text_field((string) ($in['id'] ?? '')),
		'label'        => sanitize_text_field((string) ($in['label'] ?? '')),
		'cep'          => $cep_digits,
		'address_1'    => sanitize_text_field((string) ($in['address_1'] ?? '')),
		'number'       => sanitize_text_field((string) ($in['number'] ?? '')),
		'complement'   => sanitize_text_field((string) ($in['complement'] ?? '')),
		'neighborhood' => sanitize_text_field((string) ($in['neighborhood'] ?? '')),
		'city'         => sanitize_text_field((string) ($in['city'] ?? '')),
		'state'        => sanitize_text_field((string) ($in['state'] ?? '')),
		'extra_info'   => sanitize_textarea_field((string) ($in['extra_info'] ?? '')),
	];

	// Truncar campos para evitar abusos.
	foreach (['label', 'address_1', 'number', 'complement', 'neighborhood', 'city', 'state'] as $k) {
		$item[$k] = mb_substr($item[$k], 0, 120);
	}
	$item['extra_info'] = mb_substr($item['extra_info'], 0, 300);

	return $item;
}

function ctwpml_addresses_generate_id(): string {
	if (function_exists('wp_generate_uuid4')) {
		return wp_generate_uuid4();
	}
	return 'ctwpml_' . time() . '_' . wp_rand(1000, 9999);
}

add_action('wp_ajax_ctwpml_get_addresses', function () {
	if (!is_user_logged_in()) {
		wp_send_json_error('Usuário não autenticado.');
	}

	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$user_id = get_current_user_id();
	$items = ctwpml_addresses_get_all($user_id);

	wp_send_json_success([
		'items' => $items,
	]);
});

add_action('wp_ajax_ctwpml_save_address', function () {
	if (!is_user_logged_in()) {
		wp_send_json_error('Usuário não autenticado.');
	}

	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$user_id = get_current_user_id();

	$payload = isset($_POST['address']) && is_array($_POST['address']) ? (array) $_POST['address'] : [];
	$item = ctwpml_addresses_sanitize_item($payload);

	if ($item['cep'] === '' || strlen($item['cep']) !== 8) {
		wp_send_json_error('CEP inválido. Informe 8 dígitos.');
	}
	if ($item['address_1'] === '') {
		wp_send_json_error('Rua/Avenida é obrigatório.');
	}
	if ($item['city'] === '' || $item['state'] === '') {
		wp_send_json_error('Cidade e UF são obrigatórios.');
	}

	$items = ctwpml_addresses_get_all($user_id);

	$is_update = false;
	if ($item['id'] !== '') {
		foreach ($items as $idx => $existing) {
			if (is_array($existing) && isset($existing['id']) && (string) $existing['id'] === $item['id']) {
				$items[$idx] = array_merge($existing, $item, [
					'updated_at' => current_time('mysql'),
				]);
				$is_update = true;
				break;
			}
		}
	}

	if (!$is_update) {
		$item['id'] = ctwpml_addresses_generate_id();
		$item['created_at'] = current_time('mysql');
		$item['updated_at'] = current_time('mysql');
		array_unshift($items, $item);
	}

	ctwpml_addresses_save_all($user_id, $items);

	wp_send_json_success([
		'item'  => $item,
		'items' => ctwpml_addresses_get_all($user_id),
	]);
});


