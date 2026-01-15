<?php
/**
 * AJAX handlers para aplicar/remover cupom sem reload da página.
 * Espelha comportamento nativo do WooCommerce form-coupon.php mas via AJAX controlado.
 */

if (!defined('ABSPATH')) {
	exit;
}

// Aplicar cupom (usuário logado ou não)
add_action('wp_ajax_ctwpml_apply_coupon', 'ctwpml_ajax_apply_coupon');
add_action('wp_ajax_nopriv_ctwpml_apply_coupon', 'ctwpml_ajax_apply_coupon');

// Remover cupom (usuário logado ou não)
add_action('wp_ajax_ctwpml_remove_coupon', 'ctwpml_ajax_remove_coupon');
add_action('wp_ajax_nopriv_ctwpml_remove_coupon', 'ctwpml_ajax_remove_coupon');

/**
 * Aplica um cupom ao carrinho via AJAX.
 * Retorna os totais atualizados e lista de cupons.
 */
function ctwpml_ajax_apply_coupon(): void {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') ? checkout_tabs_wp_ml_is_debug_enabled() : false;

	if (!check_ajax_referer('ctwpml_coupon', '_ajax_nonce', false)) {
		if ($is_debug) error_log('[CTWPML] apply_coupon - Nonce inválido');
		wp_send_json_error(['message' => 'Nonce inválido. Recarregue a página.']);
		return;
	}

	$coupon_code = isset($_POST['coupon_code']) ? sanitize_text_field(wp_unslash($_POST['coupon_code'])) : '';

	if (empty($coupon_code)) {
		wp_send_json_error(['message' => 'Informe o código do cupom.']);
		return;
	}

	if (!function_exists('WC') || !WC()->cart) {
		wp_send_json_error(['message' => 'Carrinho não disponível.']);
		return;
	}

	// Verificar se cupom já está aplicado
	$applied_coupons = WC()->cart->get_applied_coupons();
	$coupon_code_lower = wc_strtolower($coupon_code);

	if (in_array($coupon_code_lower, array_map('wc_strtolower', $applied_coupons), true)) {
		wp_send_json_error(['message' => 'Este cupom já foi aplicado.']);
		return;
	}

	// Tentar aplicar o cupom
	$result = WC()->cart->apply_coupon($coupon_code);

	if ($result) {
		// Recalcular totais
		WC()->cart->calculate_totals();

		// Coletar dados atualizados
		$response = ctwpml_get_cart_totals_response();
		$response['applied'] = true;
		$response['coupon_code'] = $coupon_code;
		$response['message'] = 'Cupom aplicado com sucesso!';

		if ($is_debug) error_log('[CTWPML] apply_coupon - Sucesso: ' . $coupon_code);

		wp_send_json_success($response);
	} else {
		// Pegar mensagem de erro do WooCommerce
		$error_message = 'Cupom inválido ou não aplicável.';
		$notices = wc_get_notices('error');
		if (!empty($notices)) {
			$last_notice = end($notices);
			if (is_array($last_notice) && isset($last_notice['notice'])) {
				$error_message = wp_strip_all_tags($last_notice['notice']);
			} elseif (is_string($last_notice)) {
				$error_message = wp_strip_all_tags($last_notice);
			}
			wc_clear_notices();
		}

		if ($is_debug) error_log('[CTWPML] apply_coupon - Falha: ' . $coupon_code . ' - ' . $error_message);

		wp_send_json_error(['message' => $error_message]);
	}
}

/**
 * Remove um cupom do carrinho via AJAX.
 * Retorna os totais atualizados e lista de cupons.
 */
function ctwpml_ajax_remove_coupon(): void {
	$is_debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') ? checkout_tabs_wp_ml_is_debug_enabled() : false;

	if (!check_ajax_referer('ctwpml_coupon', '_ajax_nonce', false)) {
		if ($is_debug) error_log('[CTWPML] remove_coupon - Nonce inválido');
		wp_send_json_error(['message' => 'Nonce inválido. Recarregue a página.']);
		return;
	}

	$coupon_code = isset($_POST['coupon_code']) ? sanitize_text_field(wp_unslash($_POST['coupon_code'])) : '';

	if (empty($coupon_code)) {
		wp_send_json_error(['message' => 'Código do cupom não informado.']);
		return;
	}

	if (!function_exists('WC') || !WC()->cart) {
		wp_send_json_error(['message' => 'Carrinho não disponível.']);
		return;
	}

	// Remover cupom
	$result = WC()->cart->remove_coupon($coupon_code);

	if ($result) {
		// Recalcular totais
		WC()->cart->calculate_totals();

		// Coletar dados atualizados
		$response = ctwpml_get_cart_totals_response();
		$response['removed'] = true;
		$response['coupon_code'] = $coupon_code;
		$response['message'] = 'Cupom removido.';

		if ($is_debug) error_log('[CTWPML] remove_coupon - Sucesso: ' . $coupon_code);

		wp_send_json_success($response);
	} else {
		if ($is_debug) error_log('[CTWPML] remove_coupon - Falha: ' . $coupon_code);
		wp_send_json_error(['message' => 'Não foi possível remover o cupom.']);
	}
}

/**
 * Retorna array com totais e cupons do carrinho para resposta AJAX.
 */
function ctwpml_get_cart_totals_response(): array {
	$cart = WC()->cart;

	// Totais formatados
	$subtotal = $cart->get_subtotal();
	$subtotal_tax = $cart->get_subtotal_tax();
	$shipping_total = $cart->get_shipping_total();
	$shipping_tax = $cart->get_shipping_tax();
	$discount_total = $cart->get_discount_total();
	$discount_tax = $cart->get_discount_tax();
	$total = $cart->get_total('edit');

	// Lista de cupons aplicados
	$coupons = [];
	foreach ($cart->get_applied_coupons() as $code) {
		$coupon = new WC_Coupon($code);
		$discount_amount = $cart->get_coupon_discount_amount($code, $cart->display_cart_ex_tax);
		$discount_tax_amount = $cart->get_coupon_discount_tax_amount($code);

		$coupons[] = [
			'code' => $code,
			'amount' => $discount_amount + $discount_tax_amount,
			'amount_text' => '-' . wc_price($discount_amount + $discount_tax_amount),
		];
	}

	return [
		'subtotal' => $subtotal + $subtotal_tax,
		'subtotal_text' => wc_price($subtotal + $subtotal_tax),
		'shipping' => $shipping_total + $shipping_tax,
		'shipping_text' => ($shipping_total > 0) ? wc_price($shipping_total + $shipping_tax) : 'Grátis',
		'discount' => $discount_total + $discount_tax,
		'discount_text' => ($discount_total > 0) ? '-' . wc_price($discount_total + $discount_tax) : '',
		'total' => (float) $total,
		'total_text' => wc_price($total),
		'coupons' => $coupons,
		'coupon_count' => count($coupons),
	];
}
