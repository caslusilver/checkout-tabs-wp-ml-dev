<?php

if (!defined('ABSPATH')) {
	exit;
}

if (!defined('CHECKOUT_TABS_WP_ML_PACKING_PANEL_DIR')) {
	return;
}

add_filter('ppwoo_webhook_url', function (string $url): string {
	if (!function_exists('checkout_tabs_wp_ml_get_packing_panel_webhook_url')) {
		return $url;
	}

	return checkout_tabs_wp_ml_get_packing_panel_webhook_url();
});

add_filter('ppwoo_debug', function (bool $enabled): bool {
	if (!function_exists('checkout_tabs_wp_ml_is_packing_panel_debug_enabled')) {
		return $enabled;
	}

	return checkout_tabs_wp_ml_is_packing_panel_debug_enabled();
});

require_once CHECKOUT_TABS_WP_ML_PACKING_PANEL_DIR . 'packing-panel-woo-dev.php';
