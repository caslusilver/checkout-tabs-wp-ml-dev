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

add_action('admin_menu', function () {
	if (!function_exists('add_submenu_page')) {
		return;
	}

	add_submenu_page(
		'woocommerce',
		'Checkout Tabs ML',
		'Checkout Tabs ML',
		'manage_woocommerce',
		CHECKOUT_TABS_WP_ML_SETTINGS_PAGE,
		'checkout_tabs_wp_ml_render_settings_page'
	);
});

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

	add_settings_section(
		'checkout_tabs_wp_ml_section_main',
		'Configurações',
		static function () {
			echo '<p>Configure o webhook de consulta de frete e o modo de debug.</p>';
		},
		CHECKOUT_TABS_WP_ML_SETTINGS_PAGE
	);

	add_settings_field(
		'checkout_tabs_wp_ml_webhook_url',
		'URL do Webhook',
		static function () {
			$value = esc_url(checkout_tabs_wp_ml_get_option('webhook_url', checkout_tabs_wp_ml_get_webhook_url()));
			echo '<input type="url" class="regular-text" name="checkout_tabs_wp_ml_webhook_url" value="' . $value . '" placeholder="https://..." />';
			echo '<p class="description">Endpoint externo para consulta de CEP/frete.</p>';
		},
		CHECKOUT_TABS_WP_ML_SETTINGS_PAGE,
		'checkout_tabs_wp_ml_section_main'
	);

	add_settings_field(
		'checkout_tabs_wp_ml_debug',
		'Debug',
		static function () {
			$checked = checkout_tabs_wp_ml_is_debug_enabled() ? 'checked' : '';
			echo '<label><input type="checkbox" name="checkout_tabs_wp_ml_debug" value="1" ' . $checked . ' /> Ativar logs no console e painel de debug</label>';
		},
		CHECKOUT_TABS_WP_ML_SETTINGS_PAGE,
		'checkout_tabs_wp_ml_section_main'
	);
});

function checkout_tabs_wp_ml_render_settings_page(): void {
	if (!current_user_can('manage_woocommerce')) {
		return;
	}

	echo '<div class="wrap">';
	echo '<h1>Checkout Tabs ML</h1>';
	echo '<form method="post" action="options.php">';
	settings_fields(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP);
	do_settings_sections(CHECKOUT_TABS_WP_ML_SETTINGS_PAGE);
	submit_button('Salvar');
	echo '</form>';
	echo '</div>';
}


