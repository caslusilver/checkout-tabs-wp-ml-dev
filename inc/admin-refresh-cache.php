<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Integração opcional com Git Updater: link "Atualizar Cache" na tela de Plugins.
 * Segue o framework anexado.
 */

// Link "Atualizar Cache" na lista de ações do plugin
add_filter('plugin_action_links_' . plugin_basename(CHECKOUT_TABS_WP_ML_FILE), function ($links) {
	$nonce = wp_create_nonce('gu-refresh-cache');
	$links[] = '<a href="#" class="gu-refresh-cache-btn" data-nonce="' . esc_attr($nonce) . '">Atualizar Cache</a>';
	return $links;
});

// Enfileirar JS apenas na tela de plugins
add_action('admin_enqueue_scripts', function ($hook) {
	if ($hook !== 'plugins.php') {
		return;
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-gu-refresh-cache',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/admin-refresh-cache.js',
		['jquery'],
		checkout_tabs_wp_ml_get_version(),
		true
	);

	wp_localize_script('checkout-tabs-wp-ml-gu-refresh-cache', 'GURefreshCache', [
		'ajax_url' => admin_url('admin-ajax.php'),
	]);
});

// Endpoint AJAX responsável por limpar o cache do Git Updater
add_action('wp_ajax_gu_refresh_cache', function () {
	if (!current_user_can('manage_options')) {
		wp_send_json_error('Sem permissão para executar esta ação.');
	}

	check_ajax_referer('gu-refresh-cache');

	if (!class_exists('Fragen\\Singleton')) {
		wp_send_json_error('Git Updater não encontrado (Fragen\\Singleton ausente).');
	}

	try {
		/** @var object $settings */
		$settings = Fragen\Singleton::get_instance(
			'Fragen\\Git_Updater\\Settings',
			new stdClass()
		);

		if (is_object($settings) && method_exists($settings, 'delete_all_cached_data')) {
			$settings->delete_all_cached_data();
		}

		if (function_exists('wp_cron')) {
			wp_cron();
		}

		wp_send_json_success('Cache atualizado com sucesso!');
	} catch (Exception $e) {
		wp_send_json_error($e->getMessage());
	}
});


