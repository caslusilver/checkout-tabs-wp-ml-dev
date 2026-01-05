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
	wp_enqueue_style(
		'checkout-tabs-wp-ml-address-ml-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/address-ml-modal.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-login-popup',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/login-popup.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);

	$ui_primary = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_primary', '#0075ff')) ?: '#0075ff';
	$ui_login_bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_login_bg', '#f5f5f5')) ?: '#f5f5f5';
	$ui_text = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_text', '#111111')) ?: '#111111';
	wp_add_inline_style(
		'checkout-tabs-wp-ml-login-popup',
		'.ctwpml-login-popup{--ctwpml-ui-primary:' . $ui_primary . ';--ctwpml-ui-login_bg:' . $ui_login_bg . ';--ctwpml-ui-text:' . $ui_text . ';}'
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
		'checkout-tabs-wp-ml-address-ml-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/address-ml-modal.js',
		['checkout-tabs-wp-ml-woocommerce-events'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-login-signup',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/login-signup.js',
		['jquery'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-main',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/checkout-tabs.js',
		['checkout-tabs-wp-ml-address-ml-modal', 'checkout-tabs-wp-ml-login-signup'],
		$version,
		true
	);

	wp_localize_script('checkout-tabs-wp-ml-main', 'cc_params', [
		// Passar como 1/0 evita ambiguidades (ex.: 'true'/'false') no JS.
		'debug'      => checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0,
		'is_logged_in' => is_user_logged_in() ? 1 : 0,
		'ajax_url'   => admin_url('admin-ajax.php'),
		'nonce'      => wp_create_nonce('store_webhook_shipping'),
		'addresses_nonce' => wp_create_nonce('ctwpml_addresses'),
		'address_payload_nonce' => wp_create_nonce('ctwpml_address_payload'),
		'allow_fake_cpf' => checkout_tabs_wp_ml_allow_fake_cpf() ? 1 : 0,
		'signup_nonce' => wp_create_nonce('ctwpml_signup'),
		'user_email' => is_user_logged_in() ? (string) wp_get_current_user()->user_email : '',
		'webhook_url'=> checkout_tabs_wp_ml_get_webhook_url(),
	]);
});


