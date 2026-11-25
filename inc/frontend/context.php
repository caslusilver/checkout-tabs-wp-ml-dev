<?php

if (!defined('ABSPATH')) {
	exit;
}

/** Editor e iframe de prévia não devem executar a experiência de compra. */
function ctwpml_is_visual_editor(): bool {
	if (function_exists('is_admin') && is_admin()) {
		return true;
	}
	if (class_exists('\\Elementor\\Plugin')) {
		$elementor = \Elementor\Plugin::$instance;
		if ($elementor) {
			if (isset($elementor->editor) && is_callable([$elementor->editor, 'is_edit_mode']) && $elementor->editor->is_edit_mode()) {
				return true;
			}
			if (isset($elementor->preview) && is_callable([$elementor->preview, 'is_preview_mode']) && $elementor->preview->is_preview_mode()) {
				return true;
			}
		}
	}
	return false;
}

/** Escopo exclusivo da interface; não desativa endpoints, gateways ou hooks do pedido. */
function ctwpml_is_checkout_ui_request(): bool {
	if (class_exists('CTWPML_Thankyou') && CTWPML_Thankyou::page()) return false;
	if (ctwpml_is_visual_editor()) {
		return false;
	}
	if (function_exists('is_order_received_page') && is_order_received_page()) {
		return false;
	}
	if (function_exists('is_page') && is_page('pagina-de-obrigado-compras-woocommerce')) {
		return false;
	}
	return function_exists('is_checkout') && is_checkout()
		&& !(function_exists('is_wc_endpoint_url') && is_wc_endpoint_url());
}
