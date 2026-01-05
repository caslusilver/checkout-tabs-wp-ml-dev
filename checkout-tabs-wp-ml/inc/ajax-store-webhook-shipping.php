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

	check_ajax_referer('store_webhook_shipping', 'security');

	$is_debug_enabled = checkout_tabs_wp_ml_is_debug_enabled();
	if ($is_debug_enabled) {
		error_log('[CTWPML DEBUG] store_webhook_shipping: DEBUG MODE ACTIVE.');
	}

	if (!class_exists('WC') || !function_exists('WC')) {
		wp_send_json_error(['message' => 'WooCommerce não está disponível.']);
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
		}
		wp_send_json_error(['message' => 'Dados de frete inválidos na entrada.']);
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
		wp_send_json_success([
			'fragments'  => $fragments,
			'cart_hash'  => $cart_hash,
			'wc_ajax_url'=> $wc_ajax_url,
		]);
	}

	wp_send_json_error(['message' => 'Falha no processamento dos dados de frete no backend.']);
}


