<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Retorna até 3 miniaturas (URLs) dos produtos do carrinho.
 *
 * Motivação: evitar dependência do DOM do tema/checkout para extrair imagens.
 * Responde apenas para usuários logados (mesma regra do fluxo de endereços).
 */
add_action('wp_ajax_ctwpml_get_cart_thumbs', function (): void {
	if (!is_user_logged_in()) {
		wp_send_json_error(['message' => 'Usuário não logado'], 401);
	}

	check_ajax_referer('ctwpml_cart_thumbs', '_ajax_nonce');

	if (!function_exists('WC') || !WC()->cart) {
		wp_send_json_error(['message' => 'WooCommerce indisponível'], 500);
	}

	$thumb_urls = [];
	$items = WC()->cart->get_cart();
	$total_items = is_array($items) ? count($items) : 0;
	$placeholder = function_exists('wc_placeholder_img_src') ? (string) wc_placeholder_img_src('woocommerce_thumbnail') : '';

	if (is_array($items)) {
		foreach ($items as $cart_item) {
			if (count($thumb_urls) >= 3) {
				break;
			}
			if (!is_array($cart_item) || empty($cart_item['data'])) {
				continue;
			}
			$product = $cart_item['data'];
			if (!is_object($product) || !method_exists($product, 'get_image_id')) {
				continue;
			}

			$image_id = (int) $product->get_image_id();
			$url = '';
			if ($image_id > 0) {
				$url = (string) wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
			}
			if ($url === '' && $placeholder !== '') {
				$url = $placeholder;
			}
			if ($url !== '') {
				$thumb_urls[] = $url;
			}
		}
	}

	wp_send_json_success([
		'thumb_urls' => $thumb_urls,
		'count' => $total_items,
	]);
});

