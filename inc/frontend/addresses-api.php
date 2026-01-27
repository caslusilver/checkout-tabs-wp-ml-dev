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
const CTWPML_GUEST_ADDRESSES_SESSION_KEY = 'ctwpml_guest_addresses';
const CTWPML_GUEST_SELECTED_ADDRESS_ID_SESSION_KEY = 'ctwpml_guest_selected_address_id';
const CTWPML_GUEST_ADDRESS_PAYLOAD_MAP_SESSION_KEY = 'ctwpml_guest_address_payload_by_address';
const CTWPML_GUEST_CONTACT_META_SESSION_KEY = 'ctwpml_guest_contact_meta';

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

function ctwpml_get_wc_session() {
	if (!function_exists('WC') || !WC()) {
		return null;
	}
	return WC()->session ?: null;
}

function ctwpml_guest_session_get(string $key, $default = null) {
	$session = ctwpml_get_wc_session();
	if (!$session) {
		return $default;
	}
	$val = $session->get($key);
	return $val !== null ? $val : $default;
}

function ctwpml_guest_session_set(string $key, $value): void {
	$session = ctwpml_get_wc_session();
	if (!$session) {
		return;
	}
	$session->set($key, $value);
}

function ctwpml_guest_addresses_get_all(): array {
	$raw = ctwpml_guest_session_get(CTWPML_GUEST_ADDRESSES_SESSION_KEY, []);
	return is_array($raw) ? $raw : [];
}

function ctwpml_guest_addresses_save_all(array $items): void {
	$items = array_slice($items, 0, 30);
	ctwpml_guest_session_set(CTWPML_GUEST_ADDRESSES_SESSION_KEY, $items);
}

function ctwpml_guest_get_selected_id(): string {
	$raw = ctwpml_guest_session_get(CTWPML_GUEST_SELECTED_ADDRESS_ID_SESSION_KEY, '');
	return is_string($raw) ? $raw : '';
}

function ctwpml_guest_set_selected_id(string $address_id): void {
	ctwpml_guest_session_set(CTWPML_GUEST_SELECTED_ADDRESS_ID_SESSION_KEY, $address_id);
}

function ctwpml_guest_address_payload_map_get(): array {
	$raw = ctwpml_guest_session_get(CTWPML_GUEST_ADDRESS_PAYLOAD_MAP_SESSION_KEY, []);
	return is_array($raw) ? $raw : [];
}

function ctwpml_guest_address_payload_map_set(array $map): void {
	ctwpml_guest_session_set(CTWPML_GUEST_ADDRESS_PAYLOAD_MAP_SESSION_KEY, $map);
}

function ctwpml_guest_contact_meta_get(): array {
	$raw = ctwpml_guest_session_get(CTWPML_GUEST_CONTACT_META_SESSION_KEY, []);
	return is_array($raw) ? $raw : [];
}

function ctwpml_guest_contact_meta_set(array $meta): void {
	ctwpml_guest_session_set(CTWPML_GUEST_CONTACT_META_SESSION_KEY, $meta);
}

function ctwpml_guest_clear_session(): void {
	ctwpml_guest_session_set(CTWPML_GUEST_ADDRESSES_SESSION_KEY, []);
	ctwpml_guest_session_set(CTWPML_GUEST_SELECTED_ADDRESS_ID_SESSION_KEY, '');
	ctwpml_guest_session_set(CTWPML_GUEST_ADDRESS_PAYLOAD_MAP_SESSION_KEY, []);
	ctwpml_guest_session_set(CTWPML_GUEST_CONTACT_META_SESSION_KEY, []);
}

function ctwpml_migrate_guest_data_to_user(int $user_id): void {
	if ($user_id <= 0) {
		return;
	}
	$guest_items = ctwpml_guest_addresses_get_all();
	$guest_selected = ctwpml_guest_get_selected_id();
	$guest_payload_map = ctwpml_guest_address_payload_map_get();
	$guest_contact = ctwpml_guest_contact_meta_get();

	if (!empty($guest_items)) {
		$existing = ctwpml_addresses_get_all($user_id);
		$seen = [];
		foreach ($existing as $it) {
			if (!is_array($it)) {
				continue;
			}
			$seen[ctwpml_addresses_fingerprint($it)] = true;
		}
		foreach ($guest_items as $it) {
			if (!is_array($it)) {
				continue;
			}
			$fp = ctwpml_addresses_fingerprint($it);
			if (isset($seen[$fp])) {
				continue;
			}
			$existing[] = $it;
			$seen[$fp] = true;
		}
		ctwpml_addresses_save_all($user_id, $existing);
		if ($guest_selected !== '') {
			ctwpml_addresses_set_selected_id($user_id, $guest_selected);
		}
	}

	if (!empty($guest_payload_map)) {
		$map = ctwpml_address_payload_map_get($user_id);
		foreach ($guest_payload_map as $address_id => $payload) {
			if (!isset($map[$address_id]) && is_array($payload)) {
				$map[$address_id] = $payload;
			}
		}
		ctwpml_address_payload_map_set($user_id, $map);
	}

	if (!empty($guest_contact)) {
		$is_admin = current_user_can('manage_woocommerce');
		ctwpml_apply_contact_meta_to_user($user_id, $guest_contact, $is_admin);
	}

	ctwpml_guest_clear_session();
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
	$selected = $user_id > 0 ? ctwpml_addresses_get_selected_id($user_id) : ctwpml_guest_get_selected_id();
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

/**
 * Parse defensivo de preço (aceita "R$ 23,20", "23.20", 23.2).
 */
function ctwpml_parse_price_to_float($value): float {
	if (is_numeric($value)) {
		return (float) $value;
	}
	$s = is_string($value) ? $value : (is_null($value) ? '' : (string) $value);
	$s = trim($s);
	if ($s === '') {
		return 0.0;
	}
	// Remove moeda e espaços, mantém dígitos, vírgula e ponto.
	$s = preg_replace('/[^\d,\.]+/', '', $s);
	// Converte vírgula para ponto (pt-BR).
	$s = str_replace(',', '.', $s);
	return is_numeric($s) ? (float) $s : 0.0;
}

/**
 * Limpa o cache de shipping do WooCommerce para forçar recálculo de rates/totals.
 * (Woo usa chaves shipping_for_package_* na sessão e pode reutilizar custos antigos)
 */
function ctwpml_clear_wc_shipping_cache(int $max_packages = 5, bool $is_debug = false): array {
	$out = [
		'ok' => false,
		'unset_keys' => [],
		'reset_shipping_called' => false,
		'has_session' => false,
		'has_shipping' => false,
	];

	if (!function_exists('WC') || !WC()) {
		return $out;
	}

	$out['has_session'] = (bool) (WC()->session);
	$out['has_shipping'] = (bool) (WC()->shipping);

	if (WC()->session) {
		for ($i = 0; $i < $max_packages; $i++) {
			$key = 'shipping_for_package_' . $i;
			$out['unset_keys'][] = $key;
			if (method_exists(WC()->session, '__unset')) {
				WC()->session->__unset($key);
			} else {
				WC()->session->set($key, null);
			}
		}
	}

	if (WC()->shipping && method_exists(WC()->shipping, 'reset_shipping')) {
		WC()->shipping->reset_shipping();
		$out['reset_shipping_called'] = true;
	}

	$out['ok'] = true;
	if ($is_debug) {
		error_log('[CTWPML] clear_wc_shipping_cache: ' . wp_json_encode($out));
	}
	return $out;
}

/**
 * Sincroniza WC()->session['webhook_shipping'] a partir do payload salvo por address_id.
 * Isso evita que o filtro woocommerce_package_rates remova SEDEX/Motoboy durante update_checkout.
 *
 * Retorna array com:
 * - ok: bool
 * - reason: string
 * - values: array (valores usados)
 */
function ctwpml_sync_webhook_shipping_session_from_address_payload(int $user_id, string $address_id, bool $is_debug = false): array {
	// WooCommerce expõe a função WC() (a classe principal não é "WC").
	if (!function_exists('WC') || !WC()) {
		return ['ok' => false, 'reason' => 'no_wc', 'values' => []];
	}

	// Em admin-ajax, WC()->session pode vir null. Tentar bootar antes de desistir.
	try {
		if (function_exists('wc_load_cart')) {
			wc_load_cart();
		}
		if (function_exists('WC') && WC()) {
			if (!WC()->session && method_exists(WC(), 'initialize_session')) {
				WC()->initialize_session();
			}
			if (!WC()->cart && method_exists(WC(), 'initialize_cart')) {
				WC()->initialize_cart();
			}
			// Ajuda a garantir cookie de sessão em contexto AJAX (quando aplicável)
			if (WC()->session && method_exists(WC()->session, 'set_customer_session_cookie')) {
				WC()->session->set_customer_session_cookie(true);
			}
		}
	} catch (\Throwable $e) {
		if ($is_debug) {
			error_log('[CTWPML] webhook_shipping sync - EXCEPTION boot session: ' . $e->getMessage());
		}
	}

	if (!function_exists('WC') || !WC() || !WC()->session) {
		return ['ok' => false, 'reason' => 'no_wc_session', 'values' => []];
	}
	if ($address_id === '') {
		return ['ok' => false, 'reason' => 'no_address_id', 'values' => []];
	}

	$map = $user_id > 0 ? ctwpml_address_payload_map_get($user_id) : ctwpml_guest_address_payload_map_get();
	$payload = isset($map[$address_id]) && is_array($map[$address_id]) ? $map[$address_id] : null;

	// Fallback: payload global (legado)
	if (($user_id > 0) && (empty($payload) || !is_array($payload))) {
		$legacy = get_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, true);
		if (is_array($legacy) && !empty($legacy)) {
			$payload = $legacy;
		}
	}

	if (empty($payload) || !is_array($payload)) {
		return ['ok' => false, 'reason' => 'no_payload', 'values' => []];
	}

	$raw = $payload['raw'] ?? $payload;
	$raw = ctwpml_normalize_webhook_payload_to_assoc($raw);

	$preco_pac = ctwpml_parse_price_to_float($raw['preco_pac'] ?? ($raw['preco_pacmini'] ?? ''));
	$preco_sedex = ctwpml_parse_price_to_float($raw['preco_sedex'] ?? '');
	$preco_motoboy = ctwpml_parse_price_to_float($raw['preco_motoboy'] ?? '');

	// Estrutura esperada por inc/shipping-rates-override.php
	$web = [
		'fretePACMini' => ['valor' => $preco_pac],
		'freteSedex'   => ['valor' => $preco_sedex],
		'freteMotoboy' => ['valor' => $preco_motoboy],
	];

	WC()->session->set('webhook_shipping', $web);
	// Importante: forçar recálculo de shipping rates (cache shipping_for_package_* pode manter custo 0 antigo).
	ctwpml_clear_wc_shipping_cache(5, $is_debug);

	if ($is_debug) {
		error_log('[CTWPML] webhook_shipping synced from address payload. address_id=' . $address_id . ' values=' . wp_json_encode($web));
	}

	return [
		'ok' => true,
		'reason' => 'synced',
		'values' => $web,
	];
}

function ctwpml_handle_get_addresses(): void {
	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	if (is_user_logged_in()) {
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
		return;
	}

	$items = ctwpml_guest_addresses_get_all();
	$selected_id = ctwpml_addresses_resolve_selected_id(0, $items);
	if ($selected_id !== '') {
		ctwpml_guest_set_selected_id($selected_id);
	}
	wp_send_json_success([
		'items' => $items,
		'selected_address_id' => $selected_id,
	]);
}

add_action('wp_ajax_ctwpml_get_addresses', 'ctwpml_handle_get_addresses');
add_action('wp_ajax_nopriv_ctwpml_get_addresses', 'ctwpml_handle_get_addresses');

function ctwpml_handle_set_selected_address(): void {
	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$id = isset($_POST['id']) ? sanitize_text_field((string) wp_unslash($_POST['id'])) : '';
	if ($id === '') {
		wp_send_json_error('ID inválido.');
	}

	if (is_user_logged_in()) {
		$user_id = get_current_user_id();
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
		return;
	}

	$items = ctwpml_guest_addresses_get_all();
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
	ctwpml_guest_set_selected_id($id);
	wp_send_json_success([
		'selected_address_id' => $id,
	]);
}

add_action('wp_ajax_ctwpml_set_selected_address', 'ctwpml_handle_set_selected_address');
add_action('wp_ajax_nopriv_ctwpml_set_selected_address', 'ctwpml_handle_set_selected_address');

add_action('wp_ajax_ctwpml_save_address', function () {
	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$user_id = is_user_logged_in() ? get_current_user_id() : 0;

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

	$items = $user_id > 0 ? ctwpml_addresses_get_all($user_id) : ctwpml_guest_addresses_get_all();

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

	if ($user_id > 0) {
		ctwpml_addresses_save_all($user_id, $items);
		// Após salvar (criar/atualizar), este endereço vira o selecionado.
		if (!empty($item['id'])) {
			ctwpml_addresses_set_selected_id($user_id, (string) $item['id']);
		}
	} else {
		ctwpml_guest_addresses_save_all($items);
		if (!empty($item['id'])) {
			ctwpml_guest_set_selected_id((string) $item['id']);
		}
	}

	wp_send_json_success([
		'item'  => $item,
		'items' => $user_id > 0 ? ctwpml_addresses_get_all($user_id) : ctwpml_guest_addresses_get_all(),
		'selected_address_id' => (string) ($item['id'] ?? ''),
	]);
});

add_action('wp_ajax_nopriv_ctwpml_save_address', function () {
	do_action('wp_ajax_ctwpml_save_address');
});

add_action('wp_ajax_ctwpml_delete_address', function () {
	check_ajax_referer('ctwpml_addresses', '_ajax_nonce');

	$user_id = is_user_logged_in() ? get_current_user_id() : 0;
	$id = isset($_POST['id']) ? sanitize_text_field((string) wp_unslash($_POST['id'])) : '';
	if ($id === '') {
		wp_send_json_error('ID inválido.');
	}

	$items = $user_id > 0 ? ctwpml_addresses_get_all($user_id) : ctwpml_guest_addresses_get_all();
	$out = [];
	$deleted = false;
	foreach ($items as $it) {
		if (is_array($it) && isset($it['id']) && (string) $it['id'] === $id) {
			$deleted = true;
			continue;
		}
		$out[] = $it;
	}
	if ($user_id > 0) {
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
		return;
	}

	ctwpml_guest_addresses_save_all($out);
	$current_selected = ctwpml_guest_get_selected_id();
	if ($deleted && $current_selected !== '' && $current_selected === $id) {
		$new_selected = ctwpml_addresses_resolve_selected_id(0, $out);
		ctwpml_guest_set_selected_id($new_selected);
	}

	wp_send_json_success([
		'deleted' => $deleted,
		'items'   => ctwpml_guest_addresses_get_all(),
		'selected_address_id' => ctwpml_guest_get_selected_id(),
	]);
});

add_action('wp_ajax_nopriv_ctwpml_delete_address', function () {
	do_action('wp_ajax_ctwpml_delete_address');
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

	check_ajax_referer('ctwpml_address_payload', '_ajax_nonce');

	$user_id = is_user_logged_in() ? get_current_user_id() : 0;

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
	if ($user_id > 0) {
		$map = ctwpml_address_payload_map_get($user_id);
		$map[$address_id] = $blob;
		ctwpml_address_payload_map_set($user_id, $map);

		// Compatibilidade: mantém último payload global também (para fallback/migração)
		$result = update_user_meta($user_id, CTWPML_ADDRESS_PAYLOAD_META_KEY, $blob);
	} else {
		$map = ctwpml_guest_address_payload_map_get();
		$map[$address_id] = $blob;
		ctwpml_guest_address_payload_map_set($map);
		$result = true;
	}

	if ($is_debug) {
		error_log('[CTWPML] save_address_payload - update_user_meta(last) result: ' . ($result ? 'OK' : 'FALHOU'));
		error_log('[CTWPML] save_address_payload - Meta key: ' . CTWPML_ADDRESS_PAYLOAD_META_KEY);
		error_log('[CTWPML] save_address_payload - Meta key (by address): ' . CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY);
		
		// Verificar se foi salvo corretamente
		if ($user_id > 0) {
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
	}

	wp_send_json_success([
		'meta_key' => CTWPML_ADDRESS_PAYLOAD_META_KEY,
		'meta_key_by_address' => CTWPML_ADDRESS_PAYLOAD_BY_ADDRESS_META_KEY,
		'address_id' => $address_id,
		'saved'    => true,
	]);
});

add_action('wp_ajax_nopriv_ctwpml_save_address_payload', function () {
	do_action('wp_ajax_ctwpml_save_address_payload');
});

/**
 * Endpoint AJAX para recuperar opções de frete do payload salvo.
 * Usado pela tela "Escolha quando sua compra chegará".
 */
function ctwpml_handle_get_shipping_options() {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();

	if ($is_debug) {
		error_log('[CTWPML] get_shipping_options - INICIANDO');
	}

	check_ajax_referer('ctwpml_shipping_options', '_ajax_nonce');

	$user_id = is_user_logged_in() ? get_current_user_id() : 0;

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

	$map = $user_id > 0 ? ctwpml_address_payload_map_get($user_id) : ctwpml_guest_address_payload_map_get();
	$payload = isset($map[$address_id]) && is_array($map[$address_id]) ? $map[$address_id] : null;

	// Migração/fallback: se não existe para este address_id mas existe o antigo global, copia uma vez.
	if (($user_id > 0) && (empty($payload) || !is_array($payload))) {
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
		// Labels: *_ch
		error_log('[CTWPML] get_shipping_options - motoboy_ch: ' . ($raw['motoboy_ch'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - sedex_ch: ' . ($raw['sedex_ch'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - pacmini_ch: ' . ($raw['pacmini_ch'] ?? 'NAO_DEFINIDO'));
		// Preços: preco_*
		error_log('[CTWPML] get_shipping_options - preco_motoboy: ' . ($raw['preco_motoboy'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - preco_sedex: ' . ($raw['preco_sedex'] ?? 'NAO_DEFINIDO'));
		error_log('[CTWPML] get_shipping_options - preco_pac: ' . ($raw['preco_pac'] ?? 'NAO_DEFINIDO'));
		// Mostrar RAW completo truncado para debug
		error_log('[CTWPML] get_shipping_options - RAW (primeiros 500 chars): ' . substr(json_encode($raw), 0, 500));
	}

	// Construir lista de opções disponíveis
	// Labels: *_ch (ex: motoboy_ch, sedex_ch, pacmini_ch)
	// Preços: preco_* (ex: preco_motoboy, preco_sedex, preco_pac)
	// Se o label (*_ch) estiver vazio, a modalidade é ocultada
	$options = [];

	// Motoboy (flat_rate:3) - label: motoboy_ch, preço: preco_motoboy
	$motoboy_ch = is_array($raw) ? trim((string) ($raw['motoboy_ch'] ?? '')) : '';
	if (!empty($motoboy_ch)) {
		$preco_motoboy = is_array($raw) ? ($raw['preco_motoboy'] ?? '') : '';
		$options[] = [
			'id'          => 'flat_rate:3',
			'method_id'   => 'flat_rate',
			'instance_id' => '3',
			'label'       => $motoboy_ch,
			'price_text'  => is_numeric($preco_motoboy) ? 'R$ ' . number_format((float) $preco_motoboy, 2, ',', '.') : (string) $preco_motoboy,
			'price_raw'   => $preco_motoboy,
			'type'        => 'motoboy',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado Motoboy: ' . $motoboy_ch . ' | Preço: ' . $preco_motoboy);
		}
	}

	// SEDEX (flat_rate:5) - label: sedex_ch, preço: preco_sedex
	$sedex_ch = is_array($raw) ? trim((string) ($raw['sedex_ch'] ?? '')) : '';
	if (!empty($sedex_ch)) {
		$preco_sedex = is_array($raw) ? ($raw['preco_sedex'] ?? '') : '';
		$options[] = [
			'id'          => 'flat_rate:5',
			'method_id'   => 'flat_rate',
			'instance_id' => '5',
			'label'       => $sedex_ch,
			'price_text'  => is_numeric($preco_sedex) ? 'R$ ' . number_format((float) $preco_sedex, 2, ',', '.') : (string) $preco_sedex,
			'price_raw'   => $preco_sedex,
			'type'        => 'sedex',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado SEDEX: ' . $sedex_ch . ' | Preço: ' . $preco_sedex);
		}
	}

	// PAC Mini (flat_rate:1) - label: pacmini_ch, preço: preco_pac
	$pacmini_ch = is_array($raw) ? trim((string) ($raw['pacmini_ch'] ?? '')) : '';
	if (!empty($pacmini_ch)) {
		$preco_pac = is_array($raw) ? ($raw['preco_pac'] ?? '') : '';
		$options[] = [
			'id'          => 'flat_rate:1',
			'method_id'   => 'flat_rate',
			'instance_id' => '1',
			'label'       => $pacmini_ch,
			'price_text'  => is_numeric($preco_pac) ? 'R$ ' . number_format((float) $preco_pac, 2, ',', '.') : (string) $preco_pac,
			'price_raw'   => $preco_pac,
			'type'        => 'pacmini',
		];
		if ($is_debug) {
			error_log('[CTWPML] get_shipping_options - Adicionado PAC Mini: ' . $pacmini_ch . ' | Preço: ' . $preco_pac);
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
}

add_action('wp_ajax_ctwpml_get_shipping_options', 'ctwpml_handle_get_shipping_options');
add_action('wp_ajax_nopriv_ctwpml_get_shipping_options', 'ctwpml_handle_get_shipping_options');

/**
 * Endpoint AJAX para definir o método de frete selecionado.
 * Salva na sessão do WooCommerce e força recálculo.
 */
function ctwpml_handle_set_shipping_method() {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - INICIANDO');
	}

	check_ajax_referer('ctwpml_set_shipping', '_ajax_nonce');

	// =========================================================
	// Garantir sessão/carrinho do Woo no contexto admin-ajax
	// (em alguns cenários WC()->session vem null e o frete fica 0)
	// =========================================================
	$wc_boot = [
		'has_wc' => (function_exists('WC') && WC()),
		'wc_load_cart_called' => false,
		'init_session_called' => false,
		'init_cart_called' => false,
		'set_customer_cookie_called' => false,
		'session_before' => null,
		'session_after' => null,
		'cart_before' => null,
		'cart_after' => null,
	];
	try {
		$wc_boot['session_before'] = (function_exists('WC') && WC() && WC()->session) ? get_class(WC()->session) : null;
		$wc_boot['cart_before'] = (function_exists('WC') && WC() && WC()->cart) ? 'yes' : 'no';

		if (function_exists('wc_load_cart')) {
			$wc_boot['wc_load_cart_called'] = true;
			wc_load_cart();
		}
		// Alguns ambientes não inicializam a sessão no admin-ajax: tenta inicializar explicitamente.
		if (function_exists('WC') && WC()) {
			if (!WC()->session && method_exists(WC(), 'initialize_session')) {
				$wc_boot['init_session_called'] = true;
				WC()->initialize_session();
			}
			if (!WC()->cart && method_exists(WC(), 'initialize_cart')) {
				$wc_boot['init_cart_called'] = true;
				WC()->initialize_cart();
			}
			// Ajuda a estabilizar a sessão em AJAX (quando aplicável)
			if (WC()->session && method_exists(WC()->session, 'set_customer_session_cookie')) {
				WC()->session->set_customer_session_cookie(true);
				$wc_boot['set_customer_cookie_called'] = true;
			}
		}

		$wc_boot['session_after'] = (function_exists('WC') && WC() && WC()->session) ? get_class(WC()->session) : null;
		$wc_boot['cart_after'] = (function_exists('WC') && WC() && WC()->cart) ? 'yes' : 'no';
	} catch (\Throwable $e) {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - EXCEPTION no boot WC: ' . $e->getMessage());
		}
	}
	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - wc_boot: ' . wp_json_encode($wc_boot));
	}

	$method_id = isset($_POST['method_id']) ? sanitize_text_field(wp_unslash($_POST['method_id'])) : '';
	$address_id = isset($_POST['address_id']) ? sanitize_text_field((string) wp_unslash($_POST['address_id'])) : '';

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - Method ID recebido: ' . $method_id);
		error_log('[CTWPML] set_shipping_method - Address ID recebido: ' . ($address_id !== '' ? $address_id : 'VAZIO'));
	}

	if (empty($method_id)) {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - ERRO: Method ID vazio');
		}
		wp_send_json_error(['message' => 'Método de frete não informado.']);
		return;
	}

	$user_id = is_user_logged_in() ? get_current_user_id() : 0;
	if ($address_id === '') {
		// Fallback: usa o endereço selecionado persistido no user_meta.
		$address_id = $user_id > 0 ? ctwpml_addresses_get_selected_id($user_id) : ctwpml_guest_get_selected_id();
	}

	// 0) Sincroniza webhook_shipping na sessão ANTES do cálculo de rates/totals.
	$sync_attempts = [];
	$sync = ctwpml_sync_webhook_shipping_session_from_address_payload($user_id, $address_id, $is_debug);
	$sync_attempts[] = [
		'at' => time(),
		'ok' => (bool) ($sync['ok'] ?? false),
		'reason' => (string) ($sync['reason'] ?? ''),
	];
	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - webhook_shipping sync: ' . ($sync['ok'] ? 'OK' : 'FAIL') . ' reason=' . ($sync['reason'] ?? ''));
	}

	// =========================================================
	// Diagnóstico definitivo: validar se o rate existe no Woo AGORA
	// (evita fallback silencioso para flat_rate:1 e similares)
	// =========================================================
	$available_rate_ids = [];
	$available_rates_snapshot = [];
	try {
		if (function_exists('WC') && WC() && WC()->cart && WC()->shipping) {
			// Força cálculo para popular rates (em admin-ajax, get_packages() pode vir vazio).
			WC()->cart->calculate_shipping();
			WC()->cart->calculate_totals();

			$packages = WC()->shipping->get_packages();
			if (!is_array($packages) || empty($packages)) {
				// Fallback: calcula via shipping packages do cart.
				$cart_packages = WC()->cart->get_shipping_packages();
				if (is_array($cart_packages) && !empty($cart_packages)) {
					WC()->shipping->calculate_shipping($cart_packages);
					$packages = WC()->shipping->get_packages();
				}
			}

			foreach ((array) $packages as $pIndex => $pkg) {
				if (empty($pkg['rates']) || !is_array($pkg['rates'])) {
					continue;
				}
				foreach ($pkg['rates'] as $rate_id => $rate) {
					$rid = (string) $rate_id;
					$available_rate_ids[] = $rid;
					$available_rates_snapshot[] = [
						'package' => (int) $pIndex,
						'id'      => $rid,
						'label'   => is_object($rate) && method_exists($rate, 'get_label') ? (string) $rate->get_label() : '',
						'cost'    => is_object($rate) && method_exists($rate, 'get_cost') ? $rate->get_cost() : '',
					];
				}
			}

			// Fallback extra: rates em sessão (shipping_for_package_0...)
			if (empty($available_rate_ids) && WC()->session) {
				for ($i = 0; $i < 5; $i++) {
					$k = 'shipping_for_package_' . $i;
					$session_pkg = WC()->session->get($k);
					if (!is_array($session_pkg) || empty($session_pkg['rates']) || !is_array($session_pkg['rates'])) {
						continue;
					}
					foreach ($session_pkg['rates'] as $rate_id => $rate) {
						$rid = (string) $rate_id;
						$available_rate_ids[] = $rid;
						$available_rates_snapshot[] = [
							'package' => (int) $i,
							'id'      => $rid,
							'label'   => is_object($rate) && method_exists($rate, 'get_label') ? (string) $rate->get_label() : '',
							'cost'    => is_object($rate) && method_exists($rate, 'get_cost') ? $rate->get_cost() : '',
						];
					}
				}
			}
		}
	} catch (\Throwable $e) {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - EXCEPTION ao ler rates: ' . $e->getMessage());
		}
	}

	$available_rate_ids = array_values(array_unique(array_filter($available_rate_ids)));
	$requested_exists = in_array($method_id, $available_rate_ids, true);
	$validation_skipped = empty($available_rate_ids);

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - Available rate ids: ' . implode(', ', $available_rate_ids));
		error_log('[CTWPML] set_shipping_method - Requested exists? ' . ($requested_exists ? 'YES' : 'NO') . ' | requested=' . $method_id);
		error_log('[CTWPML] set_shipping_method - Available rates snapshot (first 15): ' . substr(print_r(array_slice($available_rates_snapshot, 0, 15), true), 0, 2000));
	}

	// Só bloquear se conseguimos validar (lista não vazia).
	if (!$validation_skipped && !$requested_exists) {
		wp_send_json_error([
			'message' => 'Método de frete solicitado não existe no WooCommerce neste momento (provável mismatch de instance_id).',
			'requested' => $method_id,
			'available_rate_ids' => $available_rate_ids,
			'available_rates' => $is_debug ? $available_rates_snapshot : [],
		]);
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
	$cart_set_session_called = false;
	if (WC()->cart) {
		// Evita reuse de cache de rates no admin-ajax (shipping_for_package_*).
		$cache_clear = ctwpml_clear_wc_shipping_cache(5, $is_debug);
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - shipping cache cleared before totals: ' . wp_json_encode($cache_clear));
		}
		WC()->cart->calculate_shipping();
		WC()->cart->calculate_totals();
		// CRÍTICO: persistir em sessão, senão shipping_total pode voltar 0 em requisições subsequentes.
		if (method_exists(WC()->cart, 'set_session')) {
			WC()->cart->set_session();
			$cart_set_session_called = true;
		}
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - Carrinho recalculado');
			error_log('[CTWPML] set_shipping_method - Novo total: ' . WC()->cart->get_total());
			error_log('[CTWPML] set_shipping_method - cart_set_session_called: ' . ($cart_set_session_called ? 'yes' : 'no'));
		}
	} else {
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - AVISO: WC()->cart não disponível');
		}
	}

	// =========================================================
	// Retry do sync: em alguns ambientes, a sessão só fica disponível APÓS wc_load_cart/cálculo.
	// Se falhou por no_wc_session, tenta de novo e recalcula para aplicar os custos do override.
	// =========================================================
	$did_retry_sync = false;
	if (!(bool) ($sync['ok'] ?? false) && (string) ($sync['reason'] ?? '') === 'no_wc_session' && WC()->session) {
		$did_retry_sync = true;
		$sync2 = ctwpml_sync_webhook_shipping_session_from_address_payload($user_id, $address_id, $is_debug);
		$sync_attempts[] = [
			'at' => time(),
			'ok' => (bool) ($sync2['ok'] ?? false),
			'reason' => (string) ($sync2['reason'] ?? ''),
		];
		if ($is_debug) {
			error_log('[CTWPML] set_shipping_method - webhook_shipping sync RETRY: ' . ($sync2['ok'] ? 'OK' : 'FAIL') . ' reason=' . ($sync2['reason'] ?? ''));
		}
		if ((bool) ($sync2['ok'] ?? false)) {
			$sync = $sync2;
			// Recalcula novamente agora que webhook_shipping foi setado
			if (WC()->cart) {
				$cache_clear2 = ctwpml_clear_wc_shipping_cache(5, $is_debug);
				if ($is_debug) {
					error_log('[CTWPML] set_shipping_method - shipping cache cleared before totals (retry): ' . wp_json_encode($cache_clear2));
				}
				WC()->cart->calculate_shipping();
				WC()->cart->calculate_totals();
				if (method_exists(WC()->cart, 'set_session')) {
					WC()->cart->set_session();
					$cart_set_session_called = true;
				}
			}
		}
	}

	$chosen_methods_raw = (WC()->session) ? WC()->session->get('chosen_shipping_methods') : null;
	$web_session = (WC()->session) ? WC()->session->get('webhook_shipping') : null;

	$response = [
		'chosen_method'       => $method_id,
		'cart_total'          => WC()->cart ? WC()->cart->get_total() : '',
		'cart_shipping_total' => WC()->cart ? WC()->cart->get_shipping_total() : '',
	];
	$response['wc_boot'] = $is_debug ? $wc_boot : null;
	$response['cart_set_session_called'] = $cart_set_session_called;
	$response['chosen_shipping_methods'] = $chosen_methods_raw;
	$response['has_wc_session'] = (bool) (WC()->session);
	$response['has_wc_cart'] = (bool) (WC()->cart);
	$response['did_retry_webhook_sync'] = $did_retry_sync;
	$response['webhook_sync_attempts'] = $is_debug ? $sync_attempts : null;
	$response['requested_exists'] = $requested_exists;
	$response['validation_skipped'] = $validation_skipped;
	$response['webhook_synced'] = (bool) ($sync['ok'] ?? false);
	$response['webhook_sync_reason'] = (string) ($sync['reason'] ?? '');
	if ($is_debug && !empty($sync['values'])) {
		$response['webhook_values'] = $sync['values'];
	}
	if ($is_debug) {
		$response['available_rate_ids'] = $available_rate_ids;
		// Snapshot do webhook_shipping que está na sessão (pra validar se o override tem dados)
		$response['webhook_shipping_session'] = is_array($web_session) ? $web_session : $web_session;
	}

	if ($is_debug) {
		error_log('[CTWPML] set_shipping_method - Resposta: ' . print_r($response, true));
	}

	wp_send_json_success($response);
}

add_action('wp_ajax_ctwpml_set_shipping_method', 'ctwpml_handle_set_shipping_method');
add_action('wp_ajax_nopriv_ctwpml_set_shipping_method', 'ctwpml_handle_set_shipping_method');

function ctwpml_apply_contact_meta_to_user(int $user_id, array $input, bool $is_admin = false): array {
	$whatsapp = isset($input['whatsapp']) ? sanitize_text_field((string) $input['whatsapp']) : '';
	$phone_full = isset($input['phone_full']) ? sanitize_text_field((string) $input['phone_full']) : '';
	$country_code = isset($input['country_code']) ? sanitize_text_field((string) $input['country_code']) : '';
	$dial_code = isset($input['dial_code']) ? sanitize_text_field((string) $input['dial_code']) : '';
	$cpf = isset($input['cpf']) ? sanitize_text_field((string) $input['cpf']) : '';

	$updated = false;

	if (!empty($whatsapp)) {
		$whatsapp_digits = preg_replace('/\D/', '', $whatsapp);
		if (strlen($whatsapp_digits) >= 8 && strlen($whatsapp_digits) <= 15) {
			update_user_meta($user_id, '_ctwpml_whatsapp', $whatsapp_digits);
			update_user_meta($user_id, 'billing_cellphone', $whatsapp_digits);
			$updated = true;
		}
	}

	if (!empty($phone_full)) {
		$pf = trim((string) $phone_full);
		$pf = preg_replace('/[^\d\+]+/', '', $pf);
		$pf_digits = preg_replace('/\D+/', '', $pf);
		if ($pf_digits !== '' && strlen($pf_digits) >= 8 && strlen($pf_digits) <= 15) {
			$pf = '+' . $pf_digits;
			update_user_meta($user_id, '_ctwpml_phone_full', $pf);
			$updated = true;
		}
	}
	if (!empty($country_code)) {
		$cc = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) $country_code));
		if ($cc !== '' && strlen($cc) <= 3) {
			update_user_meta($user_id, '_ctwpml_country_code', $cc);
			$updated = true;
		}
	}
	if (!empty($dial_code)) {
		$dc = preg_replace('/[^\d\+]+/', '', (string) $dial_code);
		$dc_digits = preg_replace('/\D+/', '', $dc);
		if ($dc_digits !== '' && strlen($dc_digits) <= 4) {
			update_user_meta($user_id, '_ctwpml_dial_code', '+' . $dc_digits);
			$updated = true;
		}
	}

	$cpf_locked = get_user_meta($user_id, '_ctwpml_cpf_locked', true);
	if (!empty($cpf) && (!$cpf_locked || $is_admin)) {
		$cpf_digits = preg_replace('/\D/', '', $cpf);
		if (strlen($cpf_digits) === 11) {
			update_user_meta($user_id, '_ctwpml_cpf', $cpf_digits);
			update_user_meta($user_id, 'billing_cpf', $cpf_digits);
			if (!$cpf_locked) {
				update_user_meta($user_id, '_ctwpml_cpf_locked', '1');
				$cpf_locked = '1';
			}
			$updated = true;
		}
	}

	return [
		'updated' => $updated,
		'cpf_locked' => (bool) $cpf_locked,
	];
}

// Obter dados de contato (WhatsApp e CPF) do usuário
add_action('wp_ajax_ctwpml_get_contact_meta', function (): void {
	error_log('[CTWPML] get_contact_meta - INICIANDO');

	if (!is_user_logged_in()) {
		$guest = ctwpml_guest_contact_meta_get();
		wp_send_json_success([
			'whatsapp' => $guest['whatsapp'] ?? '',
			'phone_full' => $guest['phone_full'] ?? '',
			'country_code' => $guest['country_code'] ?? '',
			'dial_code' => $guest['dial_code'] ?? '',
			'cpf' => $guest['cpf'] ?? '',
			'cpf_locked' => false,
		]);
		return;
	}

	$user_id = get_current_user_id();
	
	// Tentamos ler dos nossos metas e fallback para billing_cpf do Woo
	$whatsapp = get_user_meta($user_id, '_ctwpml_whatsapp', true);
	if (empty($whatsapp)) {
		$whatsapp = get_user_meta($user_id, 'billing_cellphone', true);
	}

	// v2.0 [2.3] Telefone internacional (E.164 + metadados)
	$phone_full = get_user_meta($user_id, '_ctwpml_phone_full', true);
	$country_code = get_user_meta($user_id, '_ctwpml_country_code', true);
	$dial_code = get_user_meta($user_id, '_ctwpml_dial_code', true);
	if (empty($phone_full) && !empty($whatsapp)) {
		// Fallback BR: monta +55 + dígitos nacionais se parecer celular BR
		$digits = preg_replace('/\D+/', '', (string) $whatsapp);
		if (strlen($digits) === 10 || strlen($digits) === 11) {
			$phone_full = '+55' . $digits;
			if (empty($country_code)) {
				$country_code = 'BR';
			}
			if (empty($dial_code)) {
				$dial_code = '+55';
			}
		}
	}
	
	$cpf = get_user_meta($user_id, '_ctwpml_cpf', true);
	if (empty($cpf)) {
		$cpf = get_user_meta($user_id, 'billing_cpf', true);
	}
	
	$cpf_locked = get_user_meta($user_id, '_ctwpml_cpf_locked', true);

	error_log('[CTWPML] get_contact_meta - WhatsApp: ' . $whatsapp);
	error_log('[CTWPML] get_contact_meta - phone_full: ' . $phone_full);
	error_log('[CTWPML] get_contact_meta - country_code: ' . $country_code);
	error_log('[CTWPML] get_contact_meta - dial_code: ' . $dial_code);
	error_log('[CTWPML] get_contact_meta - CPF: ' . $cpf);
	error_log('[CTWPML] get_contact_meta - CPF locked: ' . ($cpf_locked ? 'yes' : 'no'));

	wp_send_json_success([
		'whatsapp' => $whatsapp ?: '',
		'phone_full' => $phone_full ?: '',
		'country_code' => $country_code ?: '',
		'dial_code' => $dial_code ?: '',
		'cpf' => $cpf ?: '',
		'cpf_locked' => (bool) $cpf_locked,
	]);
});

// Salvar dados de contato (WhatsApp e CPF)
add_action('wp_ajax_ctwpml_save_contact_meta', function (): void {
	error_log('[CTWPML] save_contact_meta - INICIANDO');

	if (!is_user_logged_in()) {
		$guest = [
			'whatsapp' => isset($_POST['whatsapp']) ? sanitize_text_field((string) $_POST['whatsapp']) : '',
			'phone_full' => isset($_POST['phone_full']) ? sanitize_text_field((string) $_POST['phone_full']) : '',
			'country_code' => isset($_POST['country_code']) ? sanitize_text_field((string) $_POST['country_code']) : '',
			'dial_code' => isset($_POST['dial_code']) ? sanitize_text_field((string) $_POST['dial_code']) : '',
			'cpf' => isset($_POST['cpf']) ? sanitize_text_field((string) $_POST['cpf']) : '',
		];
		ctwpml_guest_contact_meta_set($guest);
		wp_send_json_success([
			'message' => 'Dados processados',
			'updated' => true,
			'cpf_locked' => false,
		]);
		return;
	}

	$user_id = get_current_user_id();
	error_log('[CTWPML] save_contact_meta - User ID: ' . $user_id);

	$payload = [
		'whatsapp' => isset($_POST['whatsapp']) ? sanitize_text_field((string) $_POST['whatsapp']) : '',
		'phone_full' => isset($_POST['phone_full']) ? sanitize_text_field((string) $_POST['phone_full']) : '',
		'country_code' => isset($_POST['country_code']) ? sanitize_text_field((string) $_POST['country_code']) : '',
		'dial_code' => isset($_POST['dial_code']) ? sanitize_text_field((string) $_POST['dial_code']) : '',
		'cpf' => isset($_POST['cpf']) ? sanitize_text_field((string) $_POST['cpf']) : '',
	];
	$is_admin = current_user_can('manage_woocommerce');
	$res = ctwpml_apply_contact_meta_to_user($user_id, $payload, $is_admin);

	wp_send_json_success([
		'message' => 'Dados processados',
		'updated' => (bool) $res['updated'],
		'cpf_locked' => (bool) $res['cpf_locked'],
	]);
});

add_action('wp_ajax_nopriv_ctwpml_get_contact_meta', function () {
	do_action('wp_ajax_ctwpml_get_contact_meta');
});

add_action('wp_ajax_nopriv_ctwpml_save_contact_meta', function () {
	do_action('wp_ajax_ctwpml_save_contact_meta');
});


