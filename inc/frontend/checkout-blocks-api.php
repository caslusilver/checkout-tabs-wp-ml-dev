<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Retorna blocos padrão do WooCommerce (payment / coupon / review) via AJAX,
 * para permitir que o modal use a lógica oficial sem injetar página inteira.
 *
 * Importante:
 * - Não usa WC_AJAX para evitar wp_die() interno em alguns endpoints.
 * - Retorna apenas HTML do bloco solicitado (sem wrappers de página).
 */

/**
 * @return bool
 */
function ctwpml_is_wc_ready_for_blocks(): bool {
	if (!class_exists('WC') || !function_exists('WC')) {
		return false;
	}
	// WC() pode existir mas cart/checkout não (dependendo do contexto).
	return (bool) (WC()->cart && WC()->checkout);
}

/**
 * @param string $action
 * @return void
 */
function ctwpml_require_ajax_nonce(string $action): void {
	if (!check_ajax_referer($action, '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Nonce inválido'], 403);
		exit;
	}
}

/**
 * @param callable $renderer
 * @return string
 */
function ctwpml_capture_html(callable $renderer): string {
	ob_start();
	try {
		$renderer();
	} catch (Throwable $e) {
		ob_end_clean();
		return '';
	}
	$html = ob_get_clean();
	return is_string($html) ? $html : '';
}

add_action('wp_ajax_ctwpml_get_payment_block', function (): void {
	ctwpml_require_ajax_nonce('ctwpml_checkout_blocks');

	if (!ctwpml_is_wc_ready_for_blocks() || !function_exists('woocommerce_checkout_payment')) {
		wp_send_json_error(['message' => 'WooCommerce indisponível'], 500);
		return;
	}

	$html = ctwpml_capture_html(function (): void {
		woocommerce_checkout_payment();
	});

	if ($html === '') {
		wp_send_json_error(['message' => 'Falha ao renderizar payment'], 500);
		return;
	}

	wp_send_json_success(['html' => $html]);
});

add_action('wp_ajax_nopriv_ctwpml_get_payment_block', function (): void {
	// Mesmo comportamento (checkout guest deve funcionar).
	do_action('wp_ajax_ctwpml_get_payment_block');
});

add_action('wp_ajax_ctwpml_get_review_block', function (): void {
	ctwpml_require_ajax_nonce('ctwpml_checkout_blocks');

	if (!ctwpml_is_wc_ready_for_blocks() || !function_exists('woocommerce_order_review')) {
		wp_send_json_error(['message' => 'WooCommerce indisponível'], 500);
		return;
	}

	$html = ctwpml_capture_html(function (): void {
		woocommerce_order_review();
	});

	if ($html === '') {
		wp_send_json_error(['message' => 'Falha ao renderizar review'], 500);
		return;
	}

	wp_send_json_success(['html' => $html]);
});

add_action('wp_ajax_nopriv_ctwpml_get_review_block', function (): void {
	do_action('wp_ajax_ctwpml_get_review_block');
});

add_action('wp_ajax_ctwpml_get_coupon_block', function (): void {
	ctwpml_require_ajax_nonce('ctwpml_checkout_blocks');

	if (!ctwpml_is_wc_ready_for_blocks() || !function_exists('woocommerce_checkout_coupon_form')) {
		wp_send_json_error(['message' => 'WooCommerce indisponível'], 500);
		return;
	}

	$html = ctwpml_capture_html(function (): void {
		woocommerce_checkout_coupon_form();
	});

	if ($html === '') {
		// Se cupons estão desabilitados, o template pode não renderizar nada — isso não é erro.
		wp_send_json_success(['html' => '']);
		return;
	}

	wp_send_json_success(['html' => $html]);
});

add_action('wp_ajax_nopriv_ctwpml_get_coupon_block', function (): void {
	do_action('wp_ajax_ctwpml_get_coupon_block');
});

