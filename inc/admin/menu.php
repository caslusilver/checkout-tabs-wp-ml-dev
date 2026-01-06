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

add_action('admin_enqueue_scripts', function ($hook_suffix) {
	// Para menu top-level, o hook segue o padrão "toplevel_page_{slug}"
	if ($hook_suffix !== 'toplevel_page_' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE) {
		return;
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-admin-tabs',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/admin-tabs.js',
		['jquery'],
		checkout_tabs_wp_ml_get_version(),
		true
	);

	wp_enqueue_script(
		'checkout-tabs-wp-ml-admin-debug',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/admin-debug.js',
		['jquery', 'checkout-tabs-wp-ml-admin-tabs'],
		checkout_tabs_wp_ml_get_version(),
		true
	);

	wp_localize_script('checkout-tabs-wp-ml-admin-tabs', 'CTWPMLAdminTabs', [
		'page' => CHECKOUT_TABS_WP_ML_SETTINGS_PAGE,
	]);
	
	// JavaScript para controlar checkboxes "Transparente"
	wp_add_inline_script('checkout-tabs-wp-ml-admin-tabs', '
		jQuery(document).ready(function($) {
			$(".ctwpml-transparent-checkbox").on("change", function() {
				var colorInput = $(this).closest("td").find("input[type=color]");
				if ($(this).is(":checked")) {
					colorInput.prop("disabled", true);
				} else {
					colorInput.prop("disabled", false);
				}
			});
		});
	');
});

function checkout_tabs_wp_ml_render_admin_page(): void {
	if (!current_user_can('manage_woocommerce')) {
		return;
	}

	$tab = isset($_GET['tab']) ? sanitize_key((string) $_GET['tab']) : 'integracoes';
	if (!in_array($tab, ['integracoes', 'styles', 'debug'], true)) {
		$tab = 'integracoes';
	}

	$webhook_value = esc_url((string) get_option('checkout_tabs_wp_ml_webhook_url', checkout_tabs_wp_ml_get_webhook_url()));
	$debug_enabled = ((int) get_option('checkout_tabs_wp_ml_debug', 0) === 1);
	$allow_fake_cpf = ((int) get_option('checkout_tabs_wp_ml_allow_fake_cpf', 0) === 1);
	$ui_primary = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_primary', '#0075ff')) ?: '#0075ff';
	$ui_login_bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_login_bg', '#f5f5f5')) ?: '#f5f5f5';
	$ui_text = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_text', '#111111')) ?: '#111111';
	$recaptcha_site_key = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_recaptcha_site_key', ''));
	$recaptcha_secret_key = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_recaptcha_secret_key', ''));

	echo '<div class="wrap">';
	echo '<h1>Checkout Tabs ML</h1>';

	echo '<nav class="nav-tab-wrapper">';
	echo '<a href="' .
		esc_url(admin_url('admin.php?page=' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE . '&tab=integracoes')) .
		'" class="nav-tab ctwpml-admin-tab ' .
		($tab === 'integracoes' ? 'nav-tab-active' : '') .
		'" data-tab="integracoes">Integrações</a>';
	echo '<a href="' .
		esc_url(admin_url('admin.php?page=' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE . '&tab=styles')) .
		'" class="nav-tab ctwpml-admin-tab ' .
		($tab === 'styles' ? 'nav-tab-active' : '') .
		'" data-tab="styles">Styles</a>';
	echo '<a href="' .
		esc_url(admin_url('admin.php?page=' . CHECKOUT_TABS_WP_ML_SETTINGS_PAGE . '&tab=debug')) .
		'" class="nav-tab ctwpml-admin-tab ' .
		($tab === 'debug' ? 'nav-tab-active' : '') .
		'" data-tab="debug">Debug</a>';
	echo '</nav>';

	echo '<form method="post" action="options.php" style="margin-top: 16px;">';
	settings_fields(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP);

	echo '<div id="ctwpml-admin-tabs-content">';

	$style_integracoes = ($tab === 'integracoes') ? '' : 'display:none;';
	echo '<div class="ctwpml-admin-tab-panel" data-tab="integracoes" style="' . esc_attr($style_integracoes) . '">';
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
		echo '<tr>';
		echo '<th scope="row">Permitir CPF fictício</th>';
		echo '<td>';
		echo '<label>';
		echo '<input type="checkbox" name="checkout_tabs_wp_ml_allow_fake_cpf" value="1" ' . ($allow_fake_cpf ? 'checked' : '') . ' />';
		echo ' Exibir opção “Gerar CPF fictício” no popup de cadastro (checkout)';
		echo '</label>';
		echo '<p class="description">Use para reduzir objeção de privacidade. O CPF será matematicamente válido e definitivo no perfil.</p>';
		echo '</td>';
		echo '</tr>';
		echo '<tr>';
		echo '<th scope="row">UI (cores do popup)</th>';
		echo '<td>';
		echo '<div style="display:flex; gap: 16px; flex-wrap: wrap; align-items: center;">';
		echo '<label style="display:flex; gap:8px; align-items:center;">Azul (primário) <input type="color" name="checkout_tabs_wp_ml_ui_primary" value="' . esc_attr($ui_primary) . '" /></label>';
		echo '<label style="display:flex; gap:8px; align-items:center;">Cinza (login) <input type="color" name="checkout_tabs_wp_ml_ui_login_bg" value="' . esc_attr($ui_login_bg) . '" /></label>';
		echo '<label style="display:flex; gap:8px; align-items:center;">Texto <input type="color" name="checkout_tabs_wp_ml_ui_text" value="' . esc_attr($ui_text) . '" /></label>';
		echo '</div>';
		echo '<p class="description">Controla contraste e cores das abas e botões no popup de login/cadastro.</p>';
		echo '</td>';
		echo '</tr>';
		echo '<tr>';
		echo '<th scope="row"><label for="checkout_tabs_wp_ml_recaptcha_site_key">reCAPTCHA v2 (Site Key)</label></th>';
		echo '<td>';
		echo '<input type="text" class="regular-text" id="checkout_tabs_wp_ml_recaptcha_site_key" name="checkout_tabs_wp_ml_recaptcha_site_key" value="' . esc_attr($recaptcha_site_key) . '" placeholder="6Le..." />';
		echo '<p class="description">Chave pública do Google reCAPTCHA v2. <a href="https://www.google.com/recaptcha/admin" target="_blank">Obter chaves</a>. Se vazio, tenta reutilizar do plugin "Login No Captcha reCAPTCHA".</p>';
		echo '</td>';
		echo '</tr>';
		echo '<tr>';
		echo '<th scope="row"><label for="checkout_tabs_wp_ml_recaptcha_secret_key">reCAPTCHA v2 (Secret Key)</label></th>';
		echo '<td>';
		echo '<input type="text" class="regular-text" id="checkout_tabs_wp_ml_recaptcha_secret_key" name="checkout_tabs_wp_ml_recaptcha_secret_key" value="' . esc_attr($recaptcha_secret_key) . '" placeholder="6Le..." />';
		echo '<p class="description">Chave secreta (não compartilhe). Se vazio, tenta reutilizar do plugin instalado.</p>';
		echo '</td>';
		echo '</tr>';
		echo '</table>';
	echo '</div>';

	// Aba Styles
	$style_styles = ($tab === 'styles') ? '' : 'display:none;';
	echo '<div class="ctwpml-admin-tab-panel" data-tab="styles" style="' . esc_attr($style_styles) . '">';
		echo '<h2 class="title">Styles do Popup</h2>';
		echo '<p class="description">Configure os estilos visuais do popup de login/cadastro por hierarquia de texto. Essas configurações sobrescrevem as cores globais do site.</p>';
		
		// H1 - Títulos principais
		echo '<h3 style="margin-top:24px; border-bottom:1px solid #ccc; padding-bottom:8px;">H1 - Títulos Principais</h3>';
		echo '<table class="form-table" role="presentation">';
		checkout_tabs_wp_ml_render_style_fields('h1');
		echo '</table>';
		
		// H2 - Subtítulos/Descrições
		echo '<h3 style="margin-top:24px; border-bottom:1px solid #ccc; padding-bottom:8px;">H2 - Subtítulos e Descrições</h3>';
		echo '<table class="form-table" role="presentation">';
		checkout_tabs_wp_ml_render_style_fields('h2');
		echo '</table>';
		
		// H3 - Labels e textos auxiliares
		echo '<h3 style="margin-top:24px; border-bottom:1px solid #ccc; padding-bottom:8px;">H3 - Labels e Textos Auxiliares</h3>';
		echo '<table class="form-table" role="presentation">';
		checkout_tabs_wp_ml_render_style_fields('h3');
		echo '</table>';
	echo '</div>';

	$style_debug = ($tab === 'debug') ? '' : 'display:none;';
	echo '<div class="ctwpml-admin-tab-panel" data-tab="debug" style="' . esc_attr($style_debug) . '">';
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
		
		// Seção de Logs em Tempo Real
		echo '<h3 style="margin-top:24px; border-bottom:1px solid #ccc; padding-bottom:8px;">Logs do Checkout (Tempo Real)</h3>';
		echo '<p class="description">Logs capturados do frontend (apenas eventos do checkout). Atualiza automaticamente a cada 5 segundos.</p>';
		
		// Carregar logs do transient
		$logs = get_transient('ctwpml_debug_logs');
		if (!is_array($logs)) {
			$logs = [];
		}
		
		$formatted_logs = [];
		foreach ($logs as $log) {
			$time = isset($log['time']) ? date('H:i:s', intval($log['time'] / 1000)) : '00:00:00';
			$level = strtoupper(isset($log['level']) ? $log['level'] : 'INFO');
			$msg = isset($log['msg']) ? $log['msg'] : '';
			$formatted_logs[] = "[{$time}] [{$level}] {$msg}";
		}
		
		$log_content = implode("\n", $formatted_logs);
		
		echo '<textarea id="ctwpml-debug-logs-textarea" readonly style="width:100%; height:400px; font-family:monospace; font-size:12px; background:#0b0b0b; color:#d1d5db; border:1px solid #ccc; border-radius:4px; padding:10px; box-sizing:border-box; resize:vertical;">' . esc_textarea($log_content) . '</textarea>';
		
		echo '<div style="margin-top:10px; display:flex; gap:10px;">';
		echo '<button type="button" id="ctwpml-copy-logs-btn" class="button">Copiar Logs</button>';
		echo '<button type="button" id="ctwpml-clear-logs-btn" class="button">Limpar Logs</button>';
		echo '<span id="ctwpml-logs-status" style="line-height:28px; color:#666;"></span>';
		echo '</div>';
	echo '</div>';

	echo '</div>';

	submit_button('Salvar');
	echo '</form>';
	echo '</div>';
}

/**
 * Helper para renderizar campos de estilo por hierarquia
 */
function checkout_tabs_wp_ml_render_style_fields(string $level): void {
	$defaults = [
		'h1' => ['color' => '#000000', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '800', 'size' => '24', 'padding' => '0 0 12px 0', 'margin' => '0', 'align' => 'left'],
		'h2' => ['color' => '#333333', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '400', 'size' => '16', 'padding' => '0', 'margin' => '0 0 18px 0', 'align' => 'left'],
		'h3' => ['color' => '#666666', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '600', 'size' => '14', 'padding' => '0', 'margin' => '0 0 6px 0', 'align' => 'left'],
	];
	
	$fonts = ['Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
	$weights = ['300' => 'Light (300)', '400' => 'Normal (400)', '600' => 'Semi-Bold (600)', '700' => 'Bold (700)', '800' => 'Extra-Bold (800)'];
	$aligns = ['left' => 'Esquerda', 'center' => 'Centro', 'right' => 'Direita'];
	
	$color = sanitize_hex_color((string) get_option("checkout_tabs_wp_ml_style_{$level}_color", $defaults[$level]['color'])) ?: $defaults[$level]['color'];
	$color_transparent = ((int) get_option("checkout_tabs_wp_ml_style_{$level}_color_transparent", 0) === 1);
	$bg = get_option("checkout_tabs_wp_ml_style_{$level}_bg", $defaults[$level]['bg']);
	$bg_transparent = ((int) get_option("checkout_tabs_wp_ml_style_{$level}_bg_transparent", 0) === 1);
	if (!$bg_transparent && $bg !== 'transparent') {
		$bg = sanitize_hex_color((string) $bg) ?: $defaults[$level]['bg'];
	}
	$font = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_font", $defaults[$level]['font']));
	$weight = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_weight", $defaults[$level]['weight']));
	$size = absint(get_option("checkout_tabs_wp_ml_style_{$level}_size", $defaults[$level]['size']));
	$padding = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_padding", $defaults[$level]['padding']));
	$margin = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_margin", $defaults[$level]['margin']));
	$align = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_align", $defaults[$level]['align']));
	
	// Cor do texto
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_color">Cor do Texto</label></th>';
	echo '<td>';
	echo '<input type="color" id="checkout_tabs_wp_ml_style_' . $level . '_color" name="checkout_tabs_wp_ml_style_' . $level . '_color" value="' . esc_attr($color) . '" ' . ($color_transparent ? 'disabled' : '') . ' />';
	echo ' <label style="margin-left:10px;"><input type="checkbox" name="checkout_tabs_wp_ml_style_' . $level . '_color_transparent" value="1" ' . ($color_transparent ? 'checked' : '') . ' class="ctwpml-transparent-checkbox" /> Transparente</label>';
	echo '</td>';
	echo '</tr>';
	
	// Cor de fundo
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_bg">Cor de Fundo</label></th>';
	echo '<td>';
	echo '<input type="color" id="checkout_tabs_wp_ml_style_' . $level . '_bg" name="checkout_tabs_wp_ml_style_' . $level . '_bg" value="' . esc_attr($bg === 'transparent' ? '#ffffff' : $bg) . '" ' . ($bg_transparent ? 'disabled' : '') . ' />';
	echo ' <label style="margin-left:10px;"><input type="checkbox" name="checkout_tabs_wp_ml_style_' . $level . '_bg_transparent" value="1" ' . ($bg_transparent ? 'checked' : '') . ' class="ctwpml-transparent-checkbox" /> Transparente</label>';
	echo '</td>';
	echo '</tr>';
	
	// Fonte
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_font">Fonte</label></th>';
	echo '<td>';
	echo '<select id="checkout_tabs_wp_ml_style_' . $level . '_font" name="checkout_tabs_wp_ml_style_' . $level . '_font">';
	foreach ($fonts as $f) {
		echo '<option value="' . esc_attr($f) . '" ' . selected($font, $f, false) . '>' . esc_html($f) . '</option>';
	}
	echo '</select>';
	echo '</td>';
	echo '</tr>';
	
	// Peso
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_weight">Peso (Grossura)</label></th>';
	echo '<td>';
	echo '<select id="checkout_tabs_wp_ml_style_' . $level . '_weight" name="checkout_tabs_wp_ml_style_' . $level . '_weight">';
	foreach ($weights as $val => $label) {
		echo '<option value="' . esc_attr($val) . '" ' . selected($weight, $val, false) . '>' . esc_html($label) . '</option>';
	}
	echo '</select>';
	echo '</td>';
	echo '</tr>';
	
	// Tamanho
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_size">Tamanho (px)</label></th>';
	echo '<td>';
	echo '<input type="number" id="checkout_tabs_wp_ml_style_' . $level . '_size" name="checkout_tabs_wp_ml_style_' . $level . '_size" value="' . esc_attr($size) . '" min="8" max="72" step="1" style="width:80px;" />';
	echo '</td>';
	echo '</tr>';
	
	// Padding
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_padding">Espaçamento Interno (padding)</label></th>';
	echo '<td>';
	echo '<input type="text" id="checkout_tabs_wp_ml_style_' . $level . '_padding" name="checkout_tabs_wp_ml_style_' . $level . '_padding" value="' . esc_attr($padding) . '" class="regular-text" placeholder="Ex: 10px 20px" />';
	echo '<p class="description">Formato CSS: top right bottom left (ex: "10px 20px" ou "5px 10px 5px 10px").</p>';
	echo '</td>';
	echo '</tr>';
	
	// Margin
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_margin">Espaçamento Externo (margin)</label></th>';
	echo '<td>';
	echo '<input type="text" id="checkout_tabs_wp_ml_style_' . $level . '_margin" name="checkout_tabs_wp_ml_style_' . $level . '_margin" value="' . esc_attr($margin) . '" class="regular-text" placeholder="Ex: 0 0 12px 0" />';
	echo '<p class="description">Formato CSS: top right bottom left.</p>';
	echo '</td>';
	echo '</tr>';
	
	// Alinhamento
	echo '<tr>';
	echo '<th scope="row"><label for="checkout_tabs_wp_ml_style_' . $level . '_align">Alinhamento</label></th>';
	echo '<td>';
	echo '<select id="checkout_tabs_wp_ml_style_' . $level . '_align" name="checkout_tabs_wp_ml_style_' . $level . '_align">';
	foreach ($aligns as $val => $label) {
		echo '<option value="' . esc_attr($val) . '" ' . selected($align, $val, false) . '>' . esc_html($label) . '</option>';
	}
	echo '</select>';
	echo '</td>';
	echo '</tr>';
}


