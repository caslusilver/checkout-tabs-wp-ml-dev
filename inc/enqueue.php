<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_enqueue_scripts', function () {
	if (!function_exists('is_checkout') || !is_checkout() || (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url())) {
		return;
	}

	$version = checkout_tabs_wp_ml_get_version();

	wp_enqueue_style(
		'checkout-tabs-wp-ml-checkout-tabs',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/checkout-tabs.css',
		[],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-checkout-ui',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/checkout-ui.css',
		['checkout-tabs-wp-ml-checkout-tabs'],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-debug-panel',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/debug-panel.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);

	// Script de máscara: manter comportamento do snippet (carrega apenas se não houver outro).
	if (!wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery-mask.min', 'enqueued') && !wp_script_is('jquery-maskmoney', 'enqueued')) {
		wp_enqueue_script(
			'jquery-mask',
			'//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js',
			['jquery'],
			'1.14.16',
			true
		);
	} elseif (wp_script_is('jquery-maskmoney', 'enqueued') && !wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery.mask.min', 'enqueued')) {
		wp_enqueue_script(
			'jquery-mask',
			'//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js',
			['jquery'],
			'1.14.16',
			true
		);
	}

	$deps = ['jquery'];
	if (wp_script_is('wc-checkout', 'registered') || wp_script_is('wc-checkout', 'enqueued')) {
		$deps[] = 'wc-checkout';
	}
	if (wp_script_is('jquery-mask', 'enqueued') || wp_script_is('jquery-mask', 'registered')) {
		$deps[] = 'jquery-mask';
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-logger',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/logger.js',
		$deps,
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-ui',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/ui.js',
		['checkout-tabs-wp-ml-logger'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-tabs',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/tabs.js',
		['checkout-tabs-wp-ml-ui'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-store',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/store.js',
		['checkout-tabs-wp-ml-tabs'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-webhook',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/webhook.js',
		['checkout-tabs-wp-ml-store'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-woocommerce-events',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/woocommerce-events.js',
		['checkout-tabs-wp-ml-webhook'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-main',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/checkout-tabs.js',
		['checkout-tabs-wp-ml-woocommerce-events'],
		$version,
		true
	);

	wp_localize_script('checkout-tabs-wp-ml-main', 'cc_params', [
		// Passar como 1/0 evita ambiguidades (ex.: 'true'/'false') no JS.
		'debug'      => checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0,
		'ajax_url'   => admin_url('admin-ajax.php'),
		'nonce'      => wp_create_nonce('store_webhook_shipping'),
		'webhook_url'=> checkout_tabs_wp_ml_get_webhook_url(),
	]);
});


