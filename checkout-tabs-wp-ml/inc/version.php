<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Retorna automaticamente a versão do plugin lendo o cabeçalho.
 * Mantém compatibilidade com Git Updater e versionamento de assets.
 */
function checkout_tabs_wp_ml_get_version(): string {
	if (!function_exists('get_file_data')) {
		require_once ABSPATH . 'wp-includes/functions.php';
	}

	$plugin_data = get_file_data(CHECKOUT_TABS_WP_ML_FILE, [
		'Version' => 'Version',
	]);

	$version = isset($plugin_data['Version']) ? (string) $plugin_data['Version'] : '';
	return $version !== '' ? $version : '0.0.0';
}


