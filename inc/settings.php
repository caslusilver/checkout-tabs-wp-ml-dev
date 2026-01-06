<?php

if (!defined('ABSPATH')) {
	exit;
}

const CHECKOUT_TABS_WP_ML_SETTINGS_GROUP = 'checkout_tabs_wp_ml';
const CHECKOUT_TABS_WP_ML_SETTINGS_PAGE  = 'checkout-tabs-wp-ml';

function checkout_tabs_wp_ml_get_option(string $key, $default = null) {
	return get_option('checkout_tabs_wp_ml_' . $key, $default);
}

function checkout_tabs_wp_ml_get_webhook_url(): string {
	$default = 'https://webhook.cubensisstore.com.br/webhook/consulta-frete';
	$url = (string) checkout_tabs_wp_ml_get_option('webhook_url', $default);
	$url = $url !== '' ? $url : $default;

	/**
	 * Permite sobrescrever por ambiente (dev/test/prod) sem alterar wp_options.
	 */
	$url = apply_filters('checkout_tabs_wp_ml_webhook_url', $url);
	return (string) $url;
}

function checkout_tabs_wp_ml_get_geolocation_webhook_url(): string {
	$default = 'https://webhook.cubensisstore.com.br/webhook/geolocalizacao/';
	$url = (string) checkout_tabs_wp_ml_get_option('geolocation_webhook_url', $default);
	$url = $url !== '' ? $url : $default;

	/**
	 * Permite sobrescrever por ambiente (dev/test/prod) sem alterar wp_options.
	 */
	$url = apply_filters('checkout_tabs_wp_ml_geolocation_webhook_url', $url);
	return (string) $url;
}

function checkout_tabs_wp_ml_is_debug_enabled(): bool {
	$enabled = (int) checkout_tabs_wp_ml_get_option('debug', 0) === 1;

	/**
	 * Permite sobrescrever por ambiente (dev/test/prod) sem alterar wp_options.
	 */
	$enabled = (bool) apply_filters('checkout_tabs_wp_ml_debug', $enabled);
	return $enabled;
}

function checkout_tabs_wp_ml_allow_fake_cpf(): bool {
	$enabled = (int) checkout_tabs_wp_ml_get_option('allow_fake_cpf', 0) === 1;
	/**
	 * Permite sobrescrever por ambiente (dev/test/prod) sem alterar wp_options.
	 */
	$enabled = (bool) apply_filters('checkout_tabs_wp_ml_allow_fake_cpf', $enabled);
	return $enabled;
}

add_action('admin_init', function () {
	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_webhook_url', [
		'type'              => 'string',
		'sanitize_callback' => 'esc_url_raw',
		'default'           => 'https://webhook.cubensisstore.com.br/webhook/consulta-frete',
	]);

	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_geolocation_webhook_url', [
		'type'              => 'string',
		'sanitize_callback' => 'esc_url_raw',
		'default'           => 'https://webhook.cubensisstore.com.br/webhook/geolocalizacao/',
	]);

	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_debug', [
		'type'              => 'integer',
		'sanitize_callback' => static function ($value) {
			return !empty($value) ? 1 : 0;
		},
		'default'           => 0,
	]);

	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_allow_fake_cpf', [
		'type'              => 'integer',
		'sanitize_callback' => static function ($value) {
			return !empty($value) ? 1 : 0;
		},
		'default'           => 0,
	]);

	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_ui_primary', [
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_hex_color',
		'default'           => '#0075ff',
	]);
	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_ui_login_bg', [
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_hex_color',
		'default'           => '#f5f5f5',
	]);
	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_ui_text', [
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_hex_color',
		'default'           => '#111111',
	]);

	// reCAPTCHA v2
	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_recaptcha_site_key', [
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
		'default'           => '',
	]);
	register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'checkout_tabs_wp_ml_recaptcha_secret_key', [
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
		'default'           => '',
	]);

	// Registrar 24 options de estilo (8 propriedades × 3 hierarquias)
	$levels = ['h1', 'h2', 'h3'];
	$defaults = [
		'h1' => ['color' => '#000000', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '800', 'size' => 24, 'padding' => '0 0 12px 0', 'margin' => '0', 'align' => 'left'],
		'h2' => ['color' => '#333333', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '400', 'size' => 16, 'padding' => '0', 'margin' => '0 0 18px 0', 'align' => 'left'],
		'h3' => ['color' => '#666666', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '600', 'size' => 14, 'padding' => '0', 'margin' => '0 0 6px 0', 'align' => 'left'],
	];

	foreach ($levels as $level) {
		// Cor do texto
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_color", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_hex_color',
			'default'           => $defaults[$level]['color'],
		]);

		// Checkbox transparente - cor do texto
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_color_transparent", [
			'type'              => 'integer',
			'sanitize_callback' => static function ($value) {
				return !empty($value) ? 1 : 0;
			},
			'default'           => 0,
		]);

		// Cor de fundo
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_bg", [
			'type'              => 'string',
			'sanitize_callback' => static function ($value) {
				// Permitir "transparent" ou hex color
				if ($value === 'transparent') {
					return 'transparent';
				}
				return sanitize_hex_color($value) ?: 'transparent';
			},
			'default'           => $defaults[$level]['bg'],
		]);

		// Checkbox transparente - cor de fundo
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_bg_transparent", [
			'type'              => 'integer',
			'sanitize_callback' => static function ($value) {
				return !empty($value) ? 1 : 0;
			},
			'default'           => 0,
		]);

		// Fonte
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_font", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $defaults[$level]['font'],
		]);

		// Peso
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_weight", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $defaults[$level]['weight'],
		]);

		// Tamanho (px)
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_size", [
			'type'              => 'integer',
			'sanitize_callback' => 'absint',
			'default'           => $defaults[$level]['size'],
		]);

		// Padding
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_padding", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $defaults[$level]['padding'],
		]);

		// Margin
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_margin", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $defaults[$level]['margin'],
		]);

		// Alinhamento
		register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, "checkout_tabs_wp_ml_style_{$level}_align", [
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => $defaults[$level]['align'],
		]);
	}
});
