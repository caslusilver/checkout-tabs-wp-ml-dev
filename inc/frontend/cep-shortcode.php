<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Shortcode de consulta manual de CEP.
 *
 * Uso:
 * [ctwpml_cep]
 * [ctwpml_cep title="Consulte o frete" fallback="1"]
 */
function ctwpml_render_cep_form_shortcode($atts = []): string {
	$atts = shortcode_atts([
		'title'    => 'Consulte o frete pelo CEP',
		'fallback' => '1',
		'icon_url' => '',
	], $atts, 'ctwpml_cep');

	$title = sanitize_text_field((string) $atts['title']);
	$fallback = ((string) $atts['fallback'] !== '0');

	$version = function_exists('checkout_tabs_wp_ml_get_version') ? checkout_tabs_wp_ml_get_version() : '0.0.0';
	$rest_url = function_exists('get_rest_url') ? get_rest_url(null, 'geolocation/v1/send') : '';
	$debug = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0;
	$geo_enabled = function_exists('checkout_tabs_wp_ml_is_geolocation_enabled')
		? checkout_tabs_wp_ml_is_geolocation_enabled()
		: true;

	$icon_url = $atts['icon_url'] ? esc_url_raw((string) $atts['icon_url']) : '';
	if ($icon_url === '') {
		$icon_url = apply_filters(
			'checkout_tabs_wp_ml_cep_button_icon_url',
			CHECKOUT_TABS_WP_ML_URL . 'assets/img/icones/delivery-truck-bolt.svg'
		);
	}

	if (!wp_script_is('checkout-tabs-wp-ml-geolocation-client', 'enqueued')) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-client',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-client.js',
			[],
			$version,
			true
		);
	}
	if (!wp_script_is('checkout-tabs-wp-ml-geolocation-cep-form', 'enqueued')) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-geolocation-cep-form',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/geolocation-cep-form.js',
			['checkout-tabs-wp-ml-geolocation-client'],
			$version,
			true
		);
	}

	wp_localize_script('checkout-tabs-wp-ml-geolocation-client', 'CTWPMLGeoParams', [
		'rest_url' => (string) $rest_url,
		'debug'    => $debug,
		'geo_enabled' => $geo_enabled ? 1 : 0,
	]);

	wp_localize_script('checkout-tabs-wp-ml-geolocation-cep-form', 'CTWPMLCepParams', [
		'rest_url' => (string) $rest_url,
		'debug' => $debug,
		'geo_enabled' => $geo_enabled ? 1 : 0,
		'icon_url' => (string) $icon_url,
		'cache_ttl_ms' => 30 * 60 * 1000,
		'request_timeout_ms' => 12000,
	]);

	$out = '';
	$out .= '<div class="ctwpml-cep-shortcode">';
	if ($title !== '') {
		$out .= '<h3 class="ctwpml-cep-title">' . esc_html($title) . '</h3>';
	}
	$out .= '<form class="ctwpml-cep-form" data-ctwpml-cep-form="1">';
	$out .= '  <div class="ctwpml-cep-row">';
	$out .= '    <input class="ctwpml-cep-input" data-ctwpml-cep-input="1" type="text" inputmode="numeric" placeholder="Digite aqui seu CEP" maxlength="8" pattern="[0-9]*" />';
	$out .= '    <button type="submit" class="ctwpml-cep-button" data-ctwpml-cep-submit="1">';
	$out .= '      <span class="ctwpml-cep-button-icon">' . ($icon_url ? '<img src="' . esc_url($icon_url) . '" alt="" />' : '') . '</span>';
	$out .= '      <span class="ctwpml-cep-button-text">Consultar frete</span>';
	$out .= '      <span class="ctwpml-cep-spinner" aria-hidden="true"></span>';
	$out .= '    </button>';
	$out .= '  </div>';
	$out .= '  <div class="ctwpml-cep-error" role="alert" aria-live="polite"></div>';
	$out .= '  <div class="ctwpml-cep-results" aria-live="polite"></div>';
	if ($fallback) {
		$out .= '  <a href="#" class="ctwpml-cep-fallback" data-ctwpml-cep-fallback="1">Nao sabe seu CEP?</a>';
	}
	$out .= '</form>';
	$out .= '</div>';

	return $out;
}

add_shortcode('ctwpml_cep', 'ctwpml_render_cep_form_shortcode');
