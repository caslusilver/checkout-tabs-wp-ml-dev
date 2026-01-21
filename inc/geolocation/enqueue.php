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
	$geo_enabled = function_exists('checkout_tabs_wp_ml_is_geolocation_enabled')
		? checkout_tabs_wp_ml_is_geolocation_enabled()
		: true;

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

	$modal_deps = ['checkout-tabs-wp-ml-geolocation-client'];

	$rest_url = function_exists('get_rest_url') ? get_rest_url(null, 'geolocation/v1/send') : '';
	$debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0;

	wp_localize_script('checkout-tabs-wp-ml-geolocation-client', 'CTWPMLGeoParams', [
		'rest_url' => (string) $rest_url,
		'debug'    => $debug,
		'geo_enabled' => $geo_enabled ? 1 : 0,
		'cache_ttl_ms' => 30 * 60 * 1000,
		'request_timeout_ms' => 12000,
	]);

	// CEP manual (modal) - carregado quando geolocalização automática estiver desativada.
	if (!$geo_enabled) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-cep-form',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-cep-form.js',
			['checkout-tabs-wp-ml-geolocation-client'],
			$version,
			true
		);
		$modal_deps[] = 'checkout-tabs-wp-ml-geolocation-cep-form';

		$icon_url = apply_filters(
			'checkout_tabs_wp_ml_cep_button_icon_url',
			CHECKOUT_TABS_WP_ML_URL . 'assets/img/icones/delivery-truck-bolt.svg'
		);

		wp_localize_script('checkout-tabs-wp-ml-geolocation-cep-form', 'CTWPMLCepParams', [
			'rest_url' => (string) $rest_url,
			'debug' => $debug,
			'geo_enabled' => $geo_enabled ? 1 : 0,
			'icon_url' => (string) $icon_url,
			'cache_ttl_ms' => 30 * 60 * 1000,
			'request_timeout_ms' => 12000,
		]);
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-geolocation-permission-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-permission-modal.js',
		$modal_deps,
		$version,
		true
	);
});



