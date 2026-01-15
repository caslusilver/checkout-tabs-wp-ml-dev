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
	$items = [];
	$cart_items = WC()->cart->get_cart();
	$total_items = WC()->cart->get_cart_contents_count();
	$placeholder = function_exists('wc_placeholder_img_src') ? (string) wc_placeholder_img_src('woocommerce_thumbnail') : '';

	if (is_array($cart_items)) {
		foreach ($cart_items as $cart_item_key => $cart_item) {
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
			if ($url !== '' && count($thumb_urls) < 3) {
				$thumb_urls[] = $url;
			}

			$line_total = isset($cart_item['line_total']) ? (float) $cart_item['line_total'] : 0.0;
			$unit_price = method_exists($product, 'get_price') ? (float) $product->get_price() : 0.0;

			$items[] = [
				'key' => (string) $cart_item_key,
				'product_id' => isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0,
				'variation_id' => isset($cart_item['variation_id']) ? (int) $cart_item['variation_id'] : 0,
				'name' => method_exists($product, 'get_name') ? (string) $product->get_name() : '',
				'quantity' => isset($cart_item['quantity']) ? (int) $cart_item['quantity'] : 0,
				'price' => html_entity_decode(wp_strip_all_tags(wc_price($line_total)), ENT_QUOTES, 'UTF-8'),
				'unit_price' => html_entity_decode(wp_strip_all_tags(wc_price($unit_price)), ENT_QUOTES, 'UTF-8'),
				'thumbnail' => $url,
			];
		}
	}

	wp_send_json_success([
		'thumb_urls' => $thumb_urls,
		'count' => $total_items,
		'item_count' => $total_items,
		'subtotal' => html_entity_decode(wp_strip_all_tags(WC()->cart->get_cart_subtotal()), ENT_QUOTES, 'UTF-8'),
		'total' => html_entity_decode(wp_strip_all_tags(WC()->cart->get_total()), ENT_QUOTES, 'UTF-8'),
		'items' => $items,
	]);
});

