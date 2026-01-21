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

	// Sempre carregar o consumer (preenche spans a partir do cache/localStorage).
	// Regra: nunca dispara consulta automática; apenas aplica dados se já existirem.
	wp_enqueue_script(
		'checkout-tabs-wp-ml-frete-data-consumer',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/frete-data-consumer.js',
		[],
		$version,
		true
	);

	wp_enqueue_style(
		'checkout-tabs-wp-ml-geolocation-permission-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/geolocation-permission-modal.css',
		[],
		$version
	);

	$rest_url = function_exists('get_rest_url') ? get_rest_url(null, 'geolocation/v1/send') : '';
	$debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0;

	// Geolocalização (popup) só existe quando explicitamente habilitada.
	// Quando desativada no admin: NÃO enfileira popup, NÃO abre automaticamente, NÃO solicita permissão.
	if ($geo_enabled) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-client',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-client.js',
			[],
			$version,
			true
		);

		wp_localize_script('checkout-tabs-wp-ml-geolocation-client', 'CTWPMLGeoParams', [
			'rest_url' => (string) $rest_url,
			'debug'    => $debug,
			'geo_enabled' => 1,
			'cache_ttl_ms' => 30 * 60 * 1000,
			'request_timeout_ms' => 12000,
		]);

		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-permission-modal',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-permission-modal.js',
			['checkout-tabs-wp-ml-geolocation-client'],
			$version,
			true
		);
	}
});



