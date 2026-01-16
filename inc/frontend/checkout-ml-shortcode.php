<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Shortcode oficial do Checkout ML.
 *
 * Uso no Elementor (widget de Shortcode):
 * [checkout_ml]
 *
 * Estratégia:
 * - Renderiza um root visível (#ctwpml-root) onde a UI do ML será montada (sem overlay fullscreen)
 * - Renderiza um host do checkout real do WooCommerce (clássico) em modo offscreen/invisível
 *   para manter gateways/eventos/fragmentos funcionando (NUNCA display:none).
 */

/**
 * @return string
 */
function ctwpml_render_checkout_ml_shortcode(): string {
	// Evitar rodar fora do checkout: reduz risco de efeitos colaterais.
	$is_checkout = function_exists('is_checkout') && is_checkout() && !(function_exists('is_wc_endpoint_url') && is_wc_endpoint_url());
	if (!$is_checkout) {
		return '';
	}

	// Evitar renderizar múltiplas vezes na mesma página.
	static $rendered = false;
	if ($rendered) {
		return '';
	}
	$rendered = true;

	// Checkout Woo real (clássico). Mantemos dentro do host offscreen.
	// Preferimos o shortcode oficial para manter compatibilidade com filtros e templates.
	$woo_checkout_html = do_shortcode('[woocommerce_checkout]');

	$out = '';
	$out .= '<div id="ctwpml-root" class="ctwpml-root" data-ctwpml-root="1"></div>';
	$out .= '<div id="ctwpml-wc-host" class="ctwpml-wc-host" aria-hidden="true">';
	$out .= $woo_checkout_html;
	$out .= '</div>';

	return $out;
}

add_shortcode('checkout_ml', 'ctwpml_render_checkout_ml_shortcode');

