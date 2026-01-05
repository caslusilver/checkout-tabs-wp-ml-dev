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
});
