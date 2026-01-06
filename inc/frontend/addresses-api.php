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
const CTWPML_ADDRESS_PAYLOAD_META_KEY = 'ctwpml_address_payload';

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
		'receiver_name' => sanitize_text_field((string) ($in['receiver_name'] ?? '')),
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
	foreach (['label', 'receiver_name', 'address_1', 'number', 'complement', 'neighborhood', 'city', 'state'] as $k) {
		$item[$k] = mb_substr($item[$k], 0, 120);
	}
	$item['extra_info'] = mb_substr($item['extra_info'], 0, 300);

	return $item;
}

function ctwpml_addresses_norm_key(string $value): string {
	$value = trim(mb_strtolower($value));
	$value = remove_accents($value);
	$value = preg_replace('/\s+/', ' ', $value);
	$value = preg_replace('/[^\p{L}\p{N}\s-]+/u', '', $value);
	return trim($value);
}

function ctwpml_addresses_fingerprint(array $item): string {
	return implode('|', [
		ctwpml_addresses_norm_key((string) ($item['label'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['cep'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['address_1'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['number'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['complement'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['neighborhood'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['city'] ?? '')),
		ctwpml_addresses_norm_key((string) ($item['state'] ?? '')),
	]);
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

	// Dedup/idempotência: se já existe um endereço com a mesma assinatura, trata como update.
	if (!$is_update) {
		$fp = ctwpml_addresses_fingerprint($item);
		foreach ($items as $idx => $existing) {
			if (!is_array($existing)) {
				continue;
			}
			if (ctwpml_addresses_fingerprint($existing) === $fp) {
				$item['id'] = (string) ($existing['id'] ?? '');
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

add_action('wp_ajax_ctwpml_delete_address', function () {
	if (!is_user_logged_in()) {
		wp_send_json_error('Usuário não autenticado.');
	}

	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$user_id = get_current_user_id();
	$id = isset($_POST['id']) ? sanitize_text_field((string) wp_unslash($_POST['id'])) : '';
	if ($id === '') {
		wp_send_json_error('ID inválido.');
	}

	$items = ctwpml_addresses_get_all($user_id);
	$out = [];
	$deleted = false;
	foreach ($items as $it) {
		if (is_array($it) && isset($it['id']) && (string) $it['id'] === $id) {
			$deleted = true;
			continue;
		}
		$out[] = $it;
	}
	ctwpml_addresses_save_all($user_id, $out);

	wp_send_json_success([
		'deleted' => $deleted,
		'items'   => ctwpml_addresses_get_all($user_id),
	]);
});

/**
 * Salva o payload completo retornado pelo webhook (para reutilizar em etapas futuras
 * sem precisar consultar novamente).
 *
 * Meta key: ctwpml_address_payload
 * Estrutura: ['raw' => mixed, 'normalized' => mixed, 'captured_at' => string]
 */
add_action('wp_ajax_ctwpml_save_address_payload', function () {
	if (!is_user_logged_in()) {
		wp_send_json_error('Usuário não autenticado.');
	}

	check_ajax_referer('ctwpml_address_payload', '_ajax_nonce');

	$user_id = get_current_user_id();

	$raw_json = isset($_POST['raw_json']) ? (string) wp_unslash($_POST['raw_json']) : '';
	$normalized_json = isset($_POST['normalized_json']) ? (string) wp_unslash($_POST['normalized_json']) : '';

	$raw = null;
	if ($raw_json !== '') {
		$raw = json_decode($raw_json, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			wp_send_json_error('Payload raw_json inválido (JSON).');
		}
	}

	$normalized = null;
	if ($normalized_json !== '') {
		$normalized = json_decode($normalized_json, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			wp_send_json_error('Payload normalized_json inválido (JSON).');
		}
	}

	// Limite de segurança: evita meta gigantesco.
	// Se o payload vier muito grande, preferimos truncar e ainda assim salvar algo auditável.
	$blob = [
		'raw'         => $raw,
		'normalized'  => $normalized,
		'captured_at' => current_time('mysql'),
	];

	update_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, $blob);

	wp_send_json_success([
		'meta_key' => CTWPML_ADDRESS_PAYLOAD_META_KEY,
		'saved'    => true,
	]);
});

// Obter dados de contato (WhatsApp e CPF) do usuário
add_action('wp_ajax_ctwpml_get_contact_meta', function (): void {
	if (!is_user_logged_in()) {
		wp_send_json_error(['message' => 'Usuário não logado']);
		return;
	}

	$user_id = get_current_user_id();
	$whatsapp = get_user_meta($user_id, 'ctwpml_whatsapp', true);
	$cpf = get_user_meta($user_id, 'billing_cpf', true);
	$cpf_locked = get_user_meta($user_id, 'ctwpml_cpf_locked', true);

	wp_send_json_success([
		'whatsapp' => $whatsapp ?: '',
		'cpf' => $cpf ?: '',
		'cpf_locked' => $cpf_locked === '1',
	]);
});

// Salvar dados de contato (WhatsApp e CPF)
add_action('wp_ajax_ctwpml_save_contact_meta', function (): void {
	if (!is_user_logged_in()) {
		wp_send_json_error(['message' => 'Usuário não logado']);
		return;
	}

	$user_id = get_current_user_id();
	$whatsapp = isset($_POST['whatsapp']) ? sanitize_text_field((string) $_POST['whatsapp']) : '';
	$cpf = isset($_POST['cpf']) ? sanitize_text_field((string) $_POST['cpf']) : '';

	// Salvar WhatsApp (sempre permitido)
	if (!empty($whatsapp)) {
		update_user_meta($user_id, 'ctwpml_whatsapp', $whatsapp);
	}

	// CPF: verificar se já está travado
	$cpf_locked = get_user_meta($user_id, 'ctwpml_cpf_locked', true);
	$is_admin = current_user_can('manage_woocommerce');

	if (!empty($cpf)) {
		// Se CPF está travado e não é admin, rejeitar
		if ($cpf_locked === '1' && !$is_admin) {
			wp_send_json_error(['message' => 'CPF já está definido e não pode ser alterado']);
			return;
		}

		// Salvar CPF
		update_user_meta($user_id, 'billing_cpf', $cpf);

		// Se é a primeira vez que define CPF, travar
		if ($cpf_locked !== '1') {
			update_user_meta($user_id, 'ctwpml_cpf_locked', '1');
		}
	}

	wp_send_json_success([
		'whatsapp_saved' => !empty($whatsapp),
		'cpf_saved' => !empty($cpf),
		'cpf_locked' => get_user_meta($user_id, 'ctwpml_cpf_locked', true) === '1',
	]);
});


