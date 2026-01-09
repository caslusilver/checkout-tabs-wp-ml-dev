<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_store_webhook_shipping', 'checkout_tabs_wp_ml_store_webhook_shipping');
add_action('wp_ajax_nopriv_store_webhook_shipping', 'checkout_tabs_wp_ml_store_webhook_shipping');

/**
 * Monta fragments principais do checkout (order_review + payment) sem usar WC_AJAX,
 * evitando `wp_send_json()`/`die()` internos que quebrariam o fluxo.
 */
function checkout_tabs_wp_ml_build_checkout_fragments(): array {
	if (!function_exists('woocommerce_order_review') || !function_exists('woocommerce_checkout_payment')) {
		return [];
	}

	ob_start();
	woocommerce_order_review();
	$order_review_html = ob_get_clean();

	ob_start();
	woocommerce_checkout_payment();
	$payment_html = ob_get_clean();

	$fragments = [];
	if (is_string($order_review_html) && $order_review_html !== '') {
		$fragments['#order_review'] = $order_review_html;
	}
	if (is_string($payment_html) && $payment_html !== '') {
		$fragments['#payment'] = $payment_html;
	}

	return $fragments;
}

function checkout_tabs_wp_ml_store_webhook_shipping(): void {
	$t1 = microtime(true);
	$initial_memory = memory_get_peak_usage();

	$is_debug_enabled = checkout_tabs_wp_ml_is_debug_enabled();
	if ($is_debug_enabled) {
		error_log('[CTWPML] store_webhook_shipping - Iniciando');
		error_log('[CTWPML] Dados recebidos POST: ' . print_r(array_keys($_POST), true));
		error_log('[CTWPML] User ID: ' . get_current_user_id());
		// WooCommerce expõe a função WC() (a classe principal não é "WC").
		error_log('[CTWPML] WooCommerce ativo: ' . ((function_exists('WC') && WC()) ? 'sim' : 'não'));
	}

	// Validar nonce
	if (!check_ajax_referer('store_webhook_shipping', 'security', false)) {
		if ($is_debug_enabled) {
			error_log('[CTWPML ERROR] store_webhook_shipping - Nonce inválido');
		}
		wp_send_json_error(['message' => 'Nonce inválido']);
		return;
	}

	// Verificar WooCommerce
	if (!function_exists('WC') || !WC()) {
		if ($is_debug_enabled) {
			error_log('[CTWPML ERROR] store_webhook_shipping - WooCommerce não disponível');
		}
		wp_send_json_error(['message' => 'WooCommerce não está disponível.']);
		return;
	}

	$data_processed_successfully = false;
	$recalculated = false;

	if (empty($_POST['shipping_data'])) {
		if ($is_debug_enabled) {
			error_log('[CTWPML ERROR] shipping_data vazio na requisição AJAX.');
		}
		wp_send_json_error(['message' => 'Dados de frete vazios na entrada.']);
	}

	$data = json_decode(wp_unslash($_POST['shipping_data']), true);
	if (!is_array($data)) {
		if ($is_debug_enabled) {
			error_log('[CTWPML ERROR] Dados recebidos não são um array válido.');
			error_log('[CTWPML ERROR] shipping_data raw: ' . substr($_POST['shipping_data'], 0, 500));
		}
		wp_send_json_error(['message' => 'Dados de frete inválidos na entrada.']);
		return;
	}

	// Validar campos obrigatórios (opcional, dependendo da estrutura)
	if ($is_debug_enabled) {
		error_log('[CTWPML DEBUG] Dados decodificados: ' . print_r($data, true));
	}

	$data_processed_successfully = true;
	$existing_data = WC()->session ? WC()->session->get('webhook_shipping') : null;

	// Otimização: compara profundamente para evitar recálculo custoso.
	if (json_encode($existing_data) !== json_encode($data)) {
		if ($is_debug_enabled) {
			error_log('[CTWPML DEBUG] Nova data recebida, recalculando WC. Memória inicial: ' . size_format($initial_memory));
		}

		if (WC()->session) {
			WC()->session->set('webhook_shipping', $data);
		}

		if (WC()->cart) {
			// Importante: limpar cache de shipping_for_package_* para forçar recálculo com o novo webhook_shipping.
			if (function_exists('ctwpml_clear_wc_shipping_cache')) {
				ctwpml_clear_wc_shipping_cache(5, $is_debug_enabled);
			}
			WC()->cart->calculate_shipping();
			WC()->cart->calculate_totals();

			if (method_exists(WC()->cart, 'set_session')) {
				WC()->cart->set_session();
			}
			$recalculated = true;
		}

		if ($is_debug_enabled) {
			error_log('[CTWPML DEBUG] Recálculo WC concluído.');
		}
	} else {
		if ($is_debug_enabled) {
			error_log('[CTWPML DEBUG] Dados idênticos aos da sessão. Pulando recálculo.');
		}
	}

	$fragments = checkout_tabs_wp_ml_build_checkout_fragments();
	$cart_hash = (WC()->cart) ? WC()->cart->get_cart_hash() : '';
	$wc_ajax_url = class_exists('WC_AJAX') ? WC_AJAX::get_endpoint('%%endpoint%%') : '';

	$t2 = microtime(true);
	$peak_memory = memory_get_peak_usage();
	$cart_item_count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
	$chosen_methods_raw = WC()->session ? WC()->session->get('chosen_shipping_methods') : null;
	$chosen_method_log = is_array($chosen_methods_raw) ? implode(',', $chosen_methods_raw) : 'none';

	if ($is_debug_enabled) {
		error_log('[CTWPML] chosen=' . maybe_serialize($chosen_methods_raw));
	}

	if (!headers_sent()) {
		header('X-StoreWebhook: checkout_tabs_wp_ml_store_webhook_shipping');
		header('X-Exec-Time: ' . sprintf('%.3f', ($t2 - $t1)) . 's');
		header('X-Peak-Memory: ' . size_format($peak_memory));
		header('X-Cart-Items: ' . $cart_item_count);
		header('X-Recalculated: ' . ($recalculated ? 'yes' : 'no'));
		header('X-Chosen-Method: ' . $chosen_method_log);
		header('X-CTWPML-Debug: ' . ($is_debug_enabled ? 'true' : 'false'));
	}

	if ($data_processed_successfully) {
		if ($is_debug_enabled) {
			error_log('[CTWPML] store_webhook_shipping - Sucesso! Retornando fragments');
			error_log('[CTWPML] Fragments gerados: ' . count($fragments));
		}
		wp_send_json_success([
			'fragments'  => $fragments,
			'cart_hash'  => $cart_hash,
			'wc_ajax_url'=> $wc_ajax_url,
		]);
	}

	if ($is_debug_enabled) {
		error_log('[CTWPML ERROR] store_webhook_shipping - Falhou (data_processed_successfully = false)');
	}
	wp_send_json_error(['message' => 'Falha no processamento dos dados de frete no backend.']);
}



