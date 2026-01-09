<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_enqueue_scripts', function () {
	if (!function_exists('is_checkout') || !is_checkout() || (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url())) {
		return;
	}

	$version = checkout_tabs_wp_ml_get_version();

	wp_enqueue_style(
		'checkout-tabs-wp-ml-checkout-tabs',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/checkout-tabs.css',
		[],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-checkout-ui',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/checkout-ui.css',
		['checkout-tabs-wp-ml-checkout-tabs'],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-debug-panel',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/debug-panel.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-address-ml-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/address-ml-modal.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);
	wp_enqueue_style(
		'checkout-tabs-wp-ml-login-popup',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/login-popup.css',
		['checkout-tabs-wp-ml-checkout-ui'],
		$version
	);

	$ui_primary = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_primary', '#0075ff')) ?: '#0075ff';
	$ui_login_bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_login_bg', '#f5f5f5')) ?: '#f5f5f5';
	$ui_text = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ui_text', '#111111')) ?: '#111111';
	
	// Carregar estilos customizados por hierarquia (H1, H2, H3)
	$levels = ['h1', 'h2', 'h3'];
	$defaults = [
		'h1' => ['color' => '#000000', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '800', 'size' => 24, 'padding' => '0 0 12px 0', 'margin' => '0', 'align' => 'left'],
		'h2' => ['color' => '#333333', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '400', 'size' => 16, 'padding' => '0', 'margin' => '0 0 18px 0', 'align' => 'left'],
		'h3' => ['color' => '#666666', 'bg' => 'transparent', 'font' => 'Arial', 'weight' => '600', 'size' => 14, 'padding' => '0', 'margin' => '0 0 6px 0', 'align' => 'left'],
	];
	
	// Aumenta especificidade para sobrescrever Elementor: duplica classes (0,2,0 -> 0,4,0)
	$custom_css = '.ctwpml-login-popup.ctwpml-login-popup{--ctwpml-ui-primary:' . $ui_primary . ';--ctwpml-ui-login_bg:' . $ui_login_bg . ';--ctwpml-ui-text:' . $ui_text . ';z-index:999999!important;}';
	
	foreach ($levels as $level) {
		// Verificar checkboxes de transparência
		$color_transparent = ((int) get_option("checkout_tabs_wp_ml_style_{$level}_color_transparent", 0) === 1);
		$bg_transparent = ((int) get_option("checkout_tabs_wp_ml_style_{$level}_bg_transparent", 0) === 1);
		
		$color = $color_transparent ? 'transparent' : (sanitize_hex_color((string) get_option("checkout_tabs_wp_ml_style_{$level}_color", $defaults[$level]['color'])) ?: $defaults[$level]['color']);
		$bg = $bg_transparent ? 'transparent' : get_option("checkout_tabs_wp_ml_style_{$level}_bg", $defaults[$level]['bg']);
		if ($bg !== 'transparent') {
			$bg = sanitize_hex_color((string) $bg) ?: $defaults[$level]['bg'];
		}
		$font = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_font", $defaults[$level]['font']));
		$weight = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_weight", $defaults[$level]['weight']));
		$size = absint(get_option("checkout_tabs_wp_ml_style_{$level}_size", $defaults[$level]['size']));
		$padding = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_padding", $defaults[$level]['padding']));
		$margin = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_margin", $defaults[$level]['margin']));
		$align = sanitize_text_field((string) get_option("checkout_tabs_wp_ml_style_{$level}_align", $defaults[$level]['align']));
		
		// Duplica classes para aumentar especificidade (0,3,0)
		$custom_css .= ".ctwpml-login-popup.ctwpml-login-popup .ctwpml-popup-{$level}{";
		$custom_css .= "color:{$color}!important;";
		$custom_css .= "background-color:{$bg}!important;";
		$custom_css .= "font-family:{$font}!important;";
		$custom_css .= "font-weight:{$weight}!important;";
		$custom_css .= "font-size:{$size}px!important;";
		$custom_css .= "padding:{$padding}!important;";
		$custom_css .= "margin:{$margin}!important;";
		$custom_css .= "text-align:{$align}!important;";
		$custom_css .= "}";
	}
	
	wp_add_inline_style('checkout-tabs-wp-ml-login-popup', $custom_css);

	// Script de máscara: manter comportamento do snippet (carrega apenas se não houver outro).
	if (!wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery-mask.min', 'enqueued') && !wp_script_is('jquery-maskmoney', 'enqueued')) {
		wp_enqueue_script(
			'jquery-mask',
			'//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js',
			['jquery'],
			'1.14.16',
			true
		);
	} elseif (wp_script_is('jquery-maskmoney', 'enqueued') && !wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery.mask.min', 'enqueued')) {
		wp_enqueue_script(
			'jquery-mask',
			'//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js',
			['jquery'],
			'1.14.16',
			true
		);
	}

	$deps = ['jquery'];
	if (wp_script_is('wc-checkout', 'registered') || wp_script_is('wc-checkout', 'enqueued')) {
		$deps[] = 'wc-checkout';
	}
	if (wp_script_is('jquery-mask', 'enqueued') || wp_script_is('jquery-mask', 'registered')) {
		$deps[] = 'jquery-mask';
	}

	// =========================================================
	// ML-ONLY: Modo definitivo do modal ML (Elementor checkout)
	// - Ativa automaticamente se houver widget Elementor checkout
	// - Ou se a opção checkout_tabs_wp_ml_mode = 'ml_only'
	// - Quando ativo, NÃO carrega: tabs.js, store.js, webhook.js
	// =========================================================
	$ml_only = ((string) get_option('checkout_tabs_wp_ml_mode', 'ml_only') === 'ml_only');

	wp_enqueue_script(
		'checkout-tabs-wp-ml-logger',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/logger.js',
		$deps,
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-ui',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/ui.js',
		['checkout-tabs-wp-ml-logger'],
		$version,
		true
	);

	// Scripts do legado (abas) - só carrega se NÃO for ML-only
	$woo_events_deps = ['checkout-tabs-wp-ml-ui'];
	if (!$ml_only) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-tabs',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/tabs.js',
			['checkout-tabs-wp-ml-ui'],
			$version,
			true
		);
		wp_enqueue_script(
			'checkout-tabs-wp-ml-store',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/store.js',
			['checkout-tabs-wp-ml-tabs'],
			$version,
			true
		);
		wp_enqueue_script(
			'checkout-tabs-wp-ml-webhook',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/webhook.js',
			['checkout-tabs-wp-ml-store'],
			$version,
			true
		);
		$woo_events_deps = ['checkout-tabs-wp-ml-webhook'];
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-woocommerce-events',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/woocommerce-events.js',
		$woo_events_deps,
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-address-ml-screens',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/address-ml-screens.js',
		['checkout-tabs-wp-ml-woocommerce-events'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-address-ml-woo-host',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/address-ml-woo-host.js',
		['checkout-tabs-wp-ml-address-ml-screens'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-address-ml-modal',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/address-ml-modal.js',
		['checkout-tabs-wp-ml-address-ml-woo-host'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-cta-anim',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/cta-anim.js',
		['checkout-tabs-wp-ml-address-ml-modal'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-login-signup',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/login-signup.js',
		['jquery'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-main',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/checkout-tabs.js',
		['checkout-tabs-wp-ml-address-ml-modal', 'checkout-tabs-wp-ml-cta-anim', 'checkout-tabs-wp-ml-login-signup'],
		$version,
		true
	);

	wp_localize_script('checkout-tabs-wp-ml-main', 'cc_params', [
		// Passar como 1/0 evita ambiguidades (ex.: 'true'/'false') no JS.
		'debug'      => checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0,
		'cta_anim'   => 1,
		'is_logged_in' => is_user_logged_in() ? 1 : 0,
		'ml_only'    => $ml_only ? 1 : 0, // Modo ML definitivo (sem abas legadas)
		'ajax_url'   => admin_url('admin-ajax.php'),
		'nonce'      => wp_create_nonce('store_webhook_shipping'),
		'addresses_nonce' => wp_create_nonce('ctwpml_addresses'),
		'address_payload_nonce' => wp_create_nonce('ctwpml_address_payload'),
		'shipping_options_nonce' => wp_create_nonce('ctwpml_shipping_options'),
		'set_shipping_nonce' => wp_create_nonce('ctwpml_set_shipping'),
		'cart_thumbs_nonce' => wp_create_nonce('ctwpml_cart_thumbs'),
		'checkout_blocks_nonce' => wp_create_nonce('ctwpml_checkout_blocks'),
		'allow_fake_cpf' => checkout_tabs_wp_ml_allow_fake_cpf() ? 1 : 0,
		'signup_nonce' => wp_create_nonce('ctwpml_signup'),
		'login_nonce' => wp_create_nonce('ctwpml_login'),
		'user_email' => is_user_logged_in() ? (string) wp_get_current_user()->user_email : '',
		'webhook_url'=> checkout_tabs_wp_ml_get_webhook_url(),
		'plugin_url' => CHECKOUT_TABS_WP_ML_URL,
		'cart_url'   => function_exists('wc_get_cart_url') ? wc_get_cart_url() : '',
	]);

	// Enfileirar Google reCAPTCHA v2 (v3.2.6: usando chave fixa do exemplo para máxima compatibilidade)
	$site_key = '6LfWXPIqAAAAAF3U6KDkq9WnI1IeYh8uQ1ZvqiPX';

	if (!is_user_logged_in()) {
		wp_enqueue_script(
			'google-recaptcha-v2',
			'https://www.google.com/recaptcha/api.js?onload=ctwpmlRecaptchaOnload&render=explicit',
			[],
			null,
			true
		);
	}
});

/**
 * Overlay "Preparando tudo para sua compra"
 * - Produto/Carrinho: apenas marca flag em sessionStorage (não precisa de cc_params)
 * - Checkout: usa cc_params para pré-carregar endereços/frete e auto-abrir modal
 */
add_action('wp_enqueue_scripts', function () {
	$is_checkout = function_exists('is_checkout') && is_checkout() && !(function_exists('is_wc_endpoint_url') && is_wc_endpoint_url());
	$is_cart = function_exists('is_cart') && is_cart();
	$is_product = function_exists('is_product') && is_product();

	if (!$is_checkout && !$is_cart && !$is_product) {
		return;
	}

	$version = checkout_tabs_wp_ml_get_version();

	wp_enqueue_style(
		'checkout-tabs-wp-ml-preparing-checkout',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/preparing-checkout.css',
		[],
		$version
	);

	$deps = ['jquery'];
	if ($is_checkout) {
		// garante cc_params existir (localizado no checkout-tabs-wp-ml-main)
		$deps[] = 'checkout-tabs-wp-ml-main';
	}

	wp_enqueue_script(
		'checkout-tabs-wp-ml-preparing-checkout',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/preparing-checkout.js',
		$deps,
		$version,
		true
	);
}, 50);


