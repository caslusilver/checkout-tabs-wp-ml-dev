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
const CTWPML_SELECTED_ADDRESS_ID_META_KEY = 'ctwpml_selected_address_id';
const CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY = 'ctwpml_address_payload_by_address';

/**
 * Normaliza o payload do webhook:
 * - Se vier como array (ex.: [ { ... } ]), pega o primeiro item.
 * - Garante retorno array associativo (ou [] se inválido).
 */
function ctwpml_normalize_webhook_payload_to_assoc($raw): array {
	if (is_array($raw) && !empty($raw)) {
		// array indexado
		if (array_keys($raw) === range(0, count($raw) - 1)) {
			$first = $raw[0] ?? [];
			return is_array($first) ? $first : [];
		}
		// já é associativo
		return $raw;
	}
	return [];
}

function ctwpml_address_payload_map_get(int $user_id): array {
	$raw = get_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY, true);
	return is_array($raw) ? $raw : [];
}

function ctwpml_address_payload_map_set(int $user_id, array $map): void {
	update_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY, $map);
}

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

function ctwpml_addresses_get_selected_id(int $user_id): string {
	$raw = get_user_meta($user_id, CTWPML_SELECTED_ADDRESS_ID_META_KEY, true);
	return is_string($raw) ? $raw : '';
}

function ctwpml_addresses_set_selected_id(int $user_id, string $address_id): void {
	update_user_meta($user_id, CTWPML_SELECTED_ADDRESS_ID_META_KEY, $address_id);
}

function ctwpml_addresses_resolve_selected_id(int $user_id, array $items): string {
	$selected = ctwpml_addresses_get_selected_id($user_id);
	if ($selected !== '') {
		foreach ($items as $it) {
			if (is_array($it) && isset($it['id']) && (string) $it['id'] === $selected) {
				return $selected;
			}
		}
	}
	// Fallback: primeiro endereço (mais recente) se existir
	foreach ($items as $it) {
		if (is_array($it) && isset($it['id']) && (string) $it['id'] !== '') {
			return (string) $it['id'];
		}
	}
	return '';
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
	foreach (['label', 'receiver_name', 'address_1', 'number', 'neighborhood', 'city', 'state'] as $k) {
		$item[$k] = mb_substr($item[$k], 0, 120);
	}
	// Complemento limitado a 13 caracteres
	$item['complement'] = mb_substr($item['complement'], 0, 13);
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
	$selected_id = ctwpml_addresses_resolve_selected_id($user_id, $items);
	if ($selected_id !== '') {
		ctwpml_addresses_set_selected_id($user_id, $selected_id);
	}

	wp_send_json_success([
		'items' => $items,
		'selected_address_id' => $selected_id,
	]);
});

add_action('wp_ajax_ctwpml_set_selected_address', function (): void {
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
	$found = false;
	foreach ($items as $it) {
		if (is_array($it) && isset($it['id']) && (string) $it['id'] === $id) {
			$found = true;
			break;
		}
	}
	if (!$found) {
		wp_send_json_error('Endereço não encontrado.');
	}

	ctwpml_addresses_set_selected_id($user_id, $id);

	wp_send_json_success([
		'selected_address_id' => $id,
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
	// Após salvar (criar/atualizar), este endereço vira o selecionado.
	if (!empty($item['id'])) {
		ctwpml_addresses_set_selected_id($user_id, (string) $item['id']);
	}

	wp_send_json_success([
		'item'  => $item,
		'items' => ctwpml_addresses_get_all($user_id),
		'selected_address_id' => (string) ($item['id'] ?? ''),
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

	// Se deletou o selecionado, move seleção para o primeiro restante (ou limpa)
	$current_selected = ctwpml_addresses_get_selected_id($user_id);
	if ($deleted && $current_selected !== '' && $current_selected === $id) {
		$new_selected = ctwpml_addresses_resolve_selected_id($user_id, $out);
		ctwpml_addresses_set_selected_id($user_id, $new_selected);
	}

	wp_send_json_success([
		'deleted' => $deleted,
		'items'   => ctwpml_addresses_get_all($user_id),
		'selected_address_id' => ctwpml_addresses_get_selected_id($user_id),
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
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();

	if ($is_debug) {
		error_log('[CTWPML] save_address_payload - INICIANDO');
	}

	if (!is_user_logged_in()) {
		if ($is_debug) {
			error_log('[CTWPML] save_address_payload - ERRO: Usuário não logado');
		}
		wp_send_json_error('Usuário não autenticado.');
	}

	check_ajax_referer('ctwpml_address_payload', '_ajax_nonce');

	$user_id = get_current_user_id();

	if ($is_debug) {
		error_log('[CTWPML] save_address_payload - User ID: ' . $user_id);
	}

	$address_id = isset($_POST['address_id']) ? sanitize_text_field((string) wp_unslash($_POST['address_id'])) : '';
	if ($address_id === '') {
		if ($is_debug) {
			error_log('[CTWPML] save_address_payload - ERRO: address_id ausente');
		}
		wp_send_json_error('address_id é obrigatório.');
		return;
	}

	$raw_json = isset($_POST['raw_json']) ? (string) wp_unslash($_POST['raw_json']) : '';
	$normalized_json = isset($_POST['normalized_json']) ? (string) wp_unslash($_POST['normalized_json']) : '';

	if ($is_debug) {
		error_log('[CTWPML] save_address_payload - Address ID: ' . $address_id);
		error_log('[CTWPML] save_address_payload - raw_json length: ' . strlen($raw_json));
		error_log('[CTWPML] save_address_payload - normalized_json length: ' . strlen($normalized_json));
		// Log primeiros 500 chars do raw_json para debug
		error_log('[CTWPML] save_address_payload - raw_json (primeiros 500 chars): ' . substr($raw_json, 0, 500));
	}

	$raw = null;
	if ($raw_json !== '') {
		$raw = json_decode($raw_json, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			if ($is_debug) {
				error_log('[CTWPML] save_address_payload - ERRO: raw_json JSON inválido: ' . json_last_error_msg());
			}
			wp_send_json_error('Payload raw_json inválido (JSON).');
		}
	}

	$normalized = null;
	if ($normalized_json !== '') {
		$normalized = json_decode($normalized_json, true);
		if (json_last_error() !== JSON_ERROR_NONE) {
			if ($is_debug) {
				error_log('[CTWPML] save_address_payload - ERRO: normalized_json JSON inválido: ' . json_last_error_msg());
			}
			wp_send_json_error('Payload normalized_json inválido (JSON).');
		}
	}

	// Normalizar o payload do webhook para array associativo (corrige retorno do webhook em array).
	$raw_assoc = ctwpml_normalize_webhook_payload_to_assoc($raw);

	// DEBUG: Logar campos de frete especificamente
	if ($is_debug && is_array($raw_assoc)) {
		error_log('[CTWPML] save_address_payload - CAMPOS DE FRETE NO RAW:');
		error_log('[CTWPML]   motoboy_pr: ' . ($raw_assoc['motoboy_pr'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML]   motoboy_pro: ' . ($raw_assoc['motoboy_pro'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML]   sedex_pr: ' . ($raw_assoc['sedex_pr'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML]   sedex_pro: ' . ($raw_assoc['sedex_pro'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML]   pacmini_pr: ' . ($raw_assoc['pacmini_pr'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML]   pacmini_pro: ' . ($raw_assoc['pacmini_pro'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] save_address_payload - RAW_ASSOC KEYS: ' . print_r(array_keys($raw_assoc), true));
	}

	// Limite de segurança: evita meta gigantesco.
	// Se o payload vier muito grande, preferimos truncar e ainda assim salvar algo auditável.
	$blob = [
		'raw'         => $raw_assoc,
		'normalized'  => $normalized,
		'captured_at' => current_time('mysql'),
	];

	// Salva por endereço
	$map = ctwpml_address_payload_map_get($user_id);
	$map[$address_id] = $blob;
	ctwpml_address_payload_map_set($user_id, $map);

	// Compatibilidade: mantém último payload global também (para fallback/migração)
	$result = update_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, $blob);

	if ($is_debug) {
		error_log('[CTWPML] save_address_payload - update_user_meta(last) result: ' . ($result ? 'OK' : 'FALHOU'));
		error_log('[CTWPML] save_address_payload - Meta key: ' . CTWPML_ADDRESS_PAYLOAD_META_KEY);
		error_log('[CTWPML] save_address_payload - Meta key (by address): ' . CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY);
		
		// Verificar se foi salvo corretamente
		$saved = get_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, true);
		error_log('[CTWPML] save_address_payload - Verificação pós-save: ' . (is_array($saved) ? 'ARRAY com ' . count($saved) . ' keys' : 'NAO_ARRAY'));
		if (is_array($saved) && isset($saved['raw']) && is_array($saved['raw'])) {
			error_log('[CTWPML] save_address_payload - raw keys salvos: ' . print_r(array_keys($saved['raw']), true));
		}
		$saved_map = get_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY, true);
		error_log('[CTWPML] save_address_payload - Verificação pós-save (map): ' . (is_array($saved_map) ? 'OK keys=' . count($saved_map) : 'NAO_ARRAY'));
		if (is_array($saved_map) && isset($saved_map[$address_id])) {
			error_log('[CTWPML] save_address_payload - Map contém address_id=' . $address_id);
		}
	}

	wp_send_json_success([
		'meta_key' => CTWPML_ADDRESS_PAYLOAD_META_KEY,
		'meta_key_by_address' => CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY,
		'address_id' => $address_id,
		'saved'    => true,
	]);
});

/**
 * Endpoint AJAX para recuperar opções de frete do payload salvo.
 * Usado pela tela "Escolha quando sua compra chegará".
 */
add_action('wp_ajax_ctwpml_get_shipping_options', function () {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - INICIANDO');
	}

	if (!is_user_logged_in()) {
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - ERRO: Usuário não logado');
		}
		wp_send_json_error(['message' => 'Usuário não autenticado.']);
		return;
	}

	check_ajax_referer('ctwpml_shipping_options', '_ajax_nonce');

	$user_id = get_current_user_id();

	$address_id = isset($_POST['address_id']) ? sanitize_text_field((string) wp_unslash($_POST['address_id'])) : '';
	if ($address_id === '') {
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - ERRO: address_id ausente');
		}
		wp_send_json_error(['message' => 'address_id é obrigatório.']);
		return;
	}

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - User ID: ' . $user_id);
		error_log('[CTWPML] get_shipping_options - Address ID: ' . $address_id);
	}

	$map = ctwpml_address_payload_map_get($user_id);
	$payload = isset($map[$address_id]) && is_array($map[$address_id]) ? $map[$address_id] : null;

	// Migração/fallback: se não existe para este address_id mas existe o antigo global, copia uma vez.
	if (empty($payload) || !is_array($payload)) {
		$legacy = get_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, true);
		if (is_array($legacy) && !empty($legacy)) {
			$map[$address_id] = $legacy;
			ctwpml_address_payload_map_set($user_id, $map);
			$payload = $legacy;
			if ($is_debug) {
				error_log('[CTWPML] get_shipping_options - MIGRACAO: payload antigo copiado para address_id=' . $address_id);
			}
		}
	}

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - Payload encontrado: ' . (empty($payload) ? 'NAO' : 'SIM'));
		if (!empty($payload)) {
			error_log('[CTWPML] get_shipping_options - Payload keys: ' . print_r(array_keys($payload), true));
		}
	}

	if (empty($payload) || !is_array($payload)) {
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - ERRO: Payload vazio ou não é array');
		}
		wp_send_json_error(['message' => 'Nenhum dado de frete disponível. Salve um endereço primeiro.']);
		return;
	}

	// Extrair dados normalizados ou raw
	$raw = $payload['raw'] ?? $payload;
	$normalized = $payload['normalized'] ?? [];

	// Normalizar caso ainda venha como array indexado (defensivo)
	if (is_array($raw)) {
		$raw = ctwpml_normalize_webhook_payload_to_assoc($raw);
	}

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - Payload completo: ' . substr(print_r($payload, true), 0, 1000));
		error_log('[CTWPML] get_shipping_options - Raw type: ' . gettype($raw));
		error_log('[CTWPML] get_shipping_options - Raw data keys: ' . print_r(is_array($raw) ? array_keys($raw) : 'NAO_ARRAY', true));
		error_log('[CTWPML] get_shipping_options - motoboy_pr: ' . ($raw['motoboy_pr'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - sedex_pr: ' . ($raw['sedex_pr'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - pacmini_pr: ' . ($raw['pacmini_pr'] ?? 'NAO_DEFINIDO'));
		// Mostrar RAW completo truncado para debug
		error_log('[CTWPML] get_shipping_options - RAW (primeiros 500 chars): ' . substr(json_encode($raw), 0, 500));
	}

	// Construir lista de opções disponíveis
	$options = [];

	// Motoboy (flat_rate:3)
	$motoboy_pr = is_array($raw) ? ($raw['motoboy_pr'] ?? '') : '';
	if (!empty($motoboy_pr)) {
		$options[] = [
			'id'          => 'flat_rate:3',
			'method_id'   => 'flat_rate',
			'instance_id' => '3',
			'label'       => $motoboy_pr,
			'price_text'  => $raw['motoboy_pro'] ?? '',
			'type'        => 'motoboy',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado Motoboy: ' . $motoboy_pr);
		}
	}

	// SEDEX (flat_rate:5)
	$sedex_pr = is_array($raw) ? ($raw['sedex_pr'] ?? '') : '';
	if (!empty($sedex_pr)) {
		$options[] = [
			'id'          => 'flat_rate:5',
			'method_id'   => 'flat_rate',
			'instance_id' => '5',
			'label'       => $sedex_pr,
			'price_text'  => $raw['sedex_pro'] ?? '',
			'type'        => 'sedex',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado SEDEX: ' . $sedex_pr);
		}
	}

	// PAC Mini (flat_rate:1)
	$pacmini_pr = is_array($raw) ? ($raw['pacmini_pr'] ?? '') : '';
	if (!empty($pacmini_pr)) {
		$options[] = [
			'id'          => 'flat_rate:1',
			'method_id'   => 'flat_rate',
			'instance_id' => '1',
			'label'       => $pacmini_pr,
			'price_text'  => $raw['pacmini_pro'] ?? '',
			'type'        => 'pacmini',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado PAC Mini: ' . $pacmini_pr);
		}
	}

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - Total de opções: ' . count($options));
	}

	wp_send_json_success([
		'options'     => $options,
		'captured_at' => $payload['captured_at'] ?? '',
		'address_id'  => $address_id,
	]);
});

/**
 * Endpoint AJAX para definir o método de frete selecionado.
 * Salva na sessão do WooCommerce e força recálculo.
 */
add_action('wp_ajax_ctwpml_set_shipping_method', function () {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - INICIANDO');
	}

	if (!is_user_logged_in()) {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - ERRO: Usuário não logado');
		}
		wp_send_json_error(['message' => 'Usuário não autenticado.']);
		return;
	}

	check_ajax_referer('ctwpml_set_shipping', '_ajax_nonce');

	$method_id = isset($_POST['method_id']) ? sanitize_text_field(wp_unslash($_POST['method_id'])) : '';

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - Method ID recebido: ' . $method_id);
	}

	if (empty($method_id)) {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - ERRO: Method ID vazio');
		}
		wp_send_json_error(['message' => 'Método de frete não informado.']);
		return;
	}

	// Salvar na sessão do WooCommerce
	if (WC()->session) {
		WC()->session->set('chosen_shipping_methods', [$method_id]);
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - Salvo em chosen_shipping_methods: ' . $method_id);
		}
	} else {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - AVISO: WC()->session não disponível');
		}
	}

	// Forçar recálculo do carrinho
	if (WC()->cart) {
		WC()->cart->calculate_shipping();
		WC()->cart->calculate_totals();
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - Carrinho recalculado');
			error_log('[CTWPML] set_shipping_method - Novo total: ' . WC()->cart->get_total());
		}
	} else {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - AVISO: WC()->cart não disponível');
		}
	}

	$response = [
		'chosen_method'       => $method_id,
		'cart_total'          => WC()->cart ? WC()->cart->get_total() : '',
		'cart_shipping_total' => WC()->cart ? WC()->cart->get_shipping_total() : '',
	];

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - Resposta: ' . print_r($response, true));
	}

	wp_send_json_success($response);
});

// Obter dados de contato (WhatsApp e CPF) do usuário
add_action('wp_ajax_ctwpml_get_contact_meta', function (): void {
	error_log('[CTWPML] get_contact_meta - INICIANDO');

	if (!is_user_logged_in()) {
		error_log('[CTWPML] get_contact_meta - ERRO: Usuário não logado');
		wp_send_json_error(['message' => 'Usuário não autenticado']);
		return;
	}

	$user_id = get_current_user_id();
	
	// Tentamos ler dos nossos metas e fallback para billing_cpf do Woo
	$whatsapp = get_user_meta($user_id, '_ctwpml_whatsapp', true);
	if (empty($whatsapp)) {
		$whatsapp = get_user_meta($user_id, 'billing_cellphone', true);
	}
	
	$cpf = get_user_meta($user_id, '_ctwpml_cpf', true);
	if (empty($cpf)) {
		$cpf = get_user_meta($user_id, 'billing_cpf', true);
	}
	
	$cpf_locked = get_user_meta($user_id, '_ctwpml_cpf_locked', true);

	error_log('[CTWPML] get_contact_meta - WhatsApp: ' . $whatsapp);
	error_log('[CTWPML] get_contact_meta - CPF: ' . $cpf);
	error_log('[CTWPML] get_contact_meta - CPF locked: ' . ($cpf_locked ? 'yes' : 'no'));

	wp_send_json_success([
		'whatsapp' => $whatsapp ?: '',
		'cpf' => $cpf ?: '',
		'cpf_locked' => (bool) $cpf_locked,
	]);
});

// Salvar dados de contato (WhatsApp e CPF)
add_action('wp_ajax_ctwpml_save_contact_meta', function (): void {
	error_log('[CTWPML] save_contact_meta - INICIANDO');

	if (!is_user_logged_in()) {
		error_log('[CTWPML] save_contact_meta - ERRO: Usuário não logado');
		wp_send_json_error(['message' => 'Usuário não autenticado']);
		return;
	}

	$user_id = get_current_user_id();
	error_log('[CTWPML] save_contact_meta - User ID: ' . $user_id);

	$whatsapp = isset($_POST['whatsapp']) ? sanitize_text_field((string) $_POST['whatsapp']) : '';
	$cpf = isset($_POST['cpf']) ? sanitize_text_field((string) $_POST['cpf']) : '';

	error_log('[CTWPML] save_contact_meta - WhatsApp recebido: ' . $whatsapp);
	error_log('[CTWPML] save_contact_meta - CPF recebido: ' . $cpf);

	$updated = false;

	// Salvar WhatsApp
	if (!empty($whatsapp)) {
		$whatsapp_digits = preg_replace('/\D/', '', $whatsapp);
		if (strlen($whatsapp_digits) >= 10 && strlen($whatsapp_digits) <= 11) {
			update_user_meta($user_id, '_ctwpml_whatsapp', $whatsapp_digits);
			update_user_meta($user_id, 'billing_cellphone', $whatsapp_digits);
			error_log('[CTWPML] save_contact_meta - WhatsApp salvo: ' . $whatsapp_digits);
			$updated = true;
		} else {
			error_log('[CTWPML] save_contact_meta - WhatsApp inválido: ' . $whatsapp_digits);
		}
	}

	// CPF: verificar se já está travado
	$cpf_locked = get_user_meta($user_id, '_ctwpml_cpf_locked', true);
	$is_admin = current_user_can('manage_woocommerce');

	if (!empty($cpf) && (!$cpf_locked || $is_admin)) {
		$cpf_digits = preg_replace('/\D/', '', $cpf);
		if (strlen($cpf_digits) === 11) {
			update_user_meta($user_id, '_ctwpml_cpf', $cpf_digits);
			update_user_meta($user_id, 'billing_cpf', $cpf_digits);
			
			if (!$cpf_locked) {
				update_user_meta($user_id, '_ctwpml_cpf_locked', '1');
				$cpf_locked = '1';
				error_log('[CTWPML] save_contact_meta - CPF salvo e travado: ' . $cpf_digits);
			} else {
				error_log('[CTWPML] save_contact_meta - CPF atualizado por admin: ' . $cpf_digits);
			}
			$updated = true;
		} else {
			error_log('[CTWPML] save_contact_meta - CPF inválido: ' . $cpf_digits);
		}
	} elseif (!empty($cpf) && $cpf_locked && !$is_admin) {
		error_log('[CTWPML] save_contact_meta - Tentativa de alterar CPF travado negada');
		// Não retornamos erro aqui para não travar o salvamento do endereço que vem depois
	}

	wp_send_json_success([
		'message' => 'Dados processados',
		'updated' => $updated,
		'cpf_locked' => (bool) $cpf_locked
	]);
});


