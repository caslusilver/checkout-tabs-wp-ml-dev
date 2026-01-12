<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Enfileira assets globais de geolocalização (modal + client).
 * Escopo: site inteiro (frontend), independente do checkout.
 */
add_action('wp_enqueue_scripts', function () {
	if (is_admin()) {
		return;
	}

	$version = function_exists('checkout_tabs_wp_ml_get_version') ? checkout_tabs_wp_ml_get_version() : '0.0.0';

	wp_enqueue_style(
		'checkout-tabs-wp-ml-geolocation-permission-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/geolocation-permission-modal.css',
		[],
		$version
	);

	wp_enqueue_script(
		'checkout-tabs-wp-ml-geolocation-client',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-client.js',
		[],
		$version,
		true
	);

	wp_enqueue_script(
		'checkout-tabs-wp-ml-geolocation-permission-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-permission-modal.js',
		['checkout-tabs-wp-ml-geolocation-client'],
		$version,
		true
	);
	
	// Script de debug temporário (pode ser removido após resolver problemas)
	if ($debug) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-debug',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-debug.js',
			[],
			$version,
			true
		);
	}

	$rest_url = function_exists('get_rest_url') ? get_rest_url(null, 'geolocation/v1/send') : '';
	$debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0;

	wp_localize_script('checkout-tabs-wp-ml-geolocation-client', 'CTWPMLGeoParams', [
		'rest_url' => (string) $rest_url,
		'debug'    => $debug,
	]);
});



