<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Menu admin (top-level) do Checkout Tabs WP ML.
 */

add_action('admin_menu', function () {
	if (!function_exists('add_menu_page')) {
		return;
	}

	add_menu_page(
		'Checkout Tabs ML',
		'Checkout Tabs ML',
		'manage_woocommerce',
		CHECKOUT_TABS_WP_ML_SETTINGS_PAGE,
		'checkout_tabs_wp_ml_render_admin_page',
		'dashicons-admin-generic',
		30
	);
});

function checkout_tabs_wp_ml_render_admin_page(): void {
	if (!current_user_can('manage_woocommerce')) {
		return;
	}

	$tab = isset($_GET['tab']) ? sanitize_key((string) $_GET['tab']) : 'integracoes';
	if (!in_array($tab, ['integracoes', 'debug'], true)) {
		$tab = 'integracoes';
	}

	$webhook_value = esc_url((string) get_option('checkout_tabs_wp_ml_webhook_url', checkout_tabs_wp_ml_get_webhook_url()));
	$debug_enabled = ((int) get_option('checkout_tabs_wp_ml_debug', 0) === 1);

	echo '<div class="wrap">';
	echo '<h1>Checkout Tabs ML</h1>';

	echo '<nav class="nav-tab-wrapper">';
	echo '<a href="' .
		esc_url(admin_url('admin.php?page=' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE . '&tab=integracoes')) .
		'" class="nav-tab ' .
		($tab === 'integracoes' ? 'nav-tab-active' : '') .
		'">Integrações</a>';
	echo '<a href="' .
		esc_url(admin_url('admin.php?page=' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE . '&tab=debug')) .
		'" class="nav-tab ' .
		($tab === 'debug' ? 'nav-tab-active' : '') .
		'">Debug</a>';
	echo '</nav>';

	echo '<form method="post" action="options.php" style="margin-top: 16px;">';
	settings_fields(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP);

	if ($tab === 'integracoes') {
		echo '<h2 class="title">Integrações</h2>';
		echo '<table class="form-table" role="presentation">';
		echo '<tr>';
		echo '<th scope="row"><label for="checkout_tabs_wp_ml_webhook_url">URL do Webhook</label></th>';
		echo '<td>';
		echo '<input type="url" class="regular-text" id="checkout_tabs_wp_ml_webhook_url" name="checkout_tabs_wp_ml_webhook_url" value="' .
			$webhook_value .
			'" placeholder="https://..." />';
		echo '<p class="description">Endpoint externo para consulta de CEP/frete.</p>';
		echo '</td>';
		echo '</tr>';
		echo '</table>';
	}

	if ($tab === 'debug') {
		echo '<h2 class="title">Debug</h2>';
		echo '<table class="form-table" role="presentation">';
		echo '<tr>';
		echo '<th scope="row">Ativar Debug</th>';
		echo '<td>';
		echo '<label>';
		echo '<input type="checkbox" name="checkout_tabs_wp_ml_debug" value="1" ' . ($debug_enabled ? 'checked' : '') . ' />';
		echo ' Ativar logs no console e painel de debug no checkout';
		echo '</label>';
		echo '<p class="description">Use em dev/test. Em produção, mantenha desligado.</p>';
		echo '</td>';
		echo '</tr>';
		echo '</table>';
	}

	submit_button('Salvar');
	echo '</form>';
	echo '</div>';
}


