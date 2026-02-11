<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Debug visual (console) para ativação/instalação do plugin.
 */
add_action('admin_enqueue_scripts', function ($hook_suffix) {
	if (!current_user_can('manage_options')) {
		return;
	}

	if ($hook_suffix !== 'plugins.php' && $hook_suffix !== 'update.php') {
		return;
	}

	$packpanel_path = CHECKOUT_TABS_WP_ML_DIR . 'packing-panel-woo-dev/packing-panel-woo-dev.php';
	$packpanel_version = '';
	if (file_exists($packpanel_path)) {
		if (!function_exists('get_file_data')) {
			require_once ABSPATH . 'wp-includes/functions.php';
		}
		$packpanel_data = get_file_data($packpanel_path, [
			'Version' => 'Version',
		]);
		$packpanel_version = isset($packpanel_data['Version']) ? (string) $packpanel_data['Version'] : '';
	}

	$debug_payload = [
		'plugin' => 'checkout-tabs-wp-ml',
		'version' => function_exists('checkout_tabs_wp_ml_get_version') ? checkout_tabs_wp_ml_get_version() : '',
		'packpanel_file_exists' => file_exists($packpanel_path),
		'packpanel_version' => $packpanel_version,
		'woocommerce_active' => function_exists('WC') || class_exists('WooCommerce'),
		'sakm_get_key_exists' => function_exists('sakm_get_key'),
		'php_version' => PHP_VERSION,
		'wp_version' => get_bloginfo('version'),
	];

	wp_register_script('ctwpml-admin-install-debug', '', [], null, true);
	wp_enqueue_script('ctwpml-admin-install-debug');
	wp_add_inline_script(
		'ctwpml-admin-install-debug',
		'console.info("[CTWPML] Diagnóstico de instalação/ativação", ' . wp_json_encode($debug_payload) . ');'
	);

	if (defined('WP_DEBUG') && WP_DEBUG) {
		error_log('[CTWPML] Diagnóstico de instalação/ativação: ' . wp_json_encode($debug_payload));
	}
});
