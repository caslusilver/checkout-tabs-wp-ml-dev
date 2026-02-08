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
		'checkout-tabs-wp-ml-checkout-ml-root',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/checkout-ml-root.css',
		['checkout-tabs-wp-ml-address-ml-modal'],
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

	// =========================================================
	// v2.0 [2.3] Campo DDI (NOVO FORMATO: TomSelect + IMask)
	// - Carregado apenas no checkout
	// - Init é lazy (só quando abrir tela do formulário do modal)
	// =========================================================
	if (!wp_script_is('ctwpml-imask', 'enqueued') && !wp_script_is('ctwpml-imask', 'registered')) {
		wp_enqueue_script('ctwpml-imask', 'https://unpkg.com/imask', [], '7.0.1', true);
	}
	if (!wp_style_is('ctwpml-tomselect-css', 'enqueued') && !wp_style_is('ctwpml-tomselect-css', 'registered')) {
		wp_enqueue_style('ctwpml-tomselect-css', 'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.default.min.css', [], '2.2.2');
	}
	if (!wp_script_is('ctwpml-tomselect-js', 'enqueued') && !wp_script_is('ctwpml-tomselect-js', 'registered')) {
		wp_enqueue_script('ctwpml-tomselect-js', 'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js', [], '2.2.2', true);
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

	// Sistema de telemetria para rastrear eficiência das funcionalidades
	wp_enqueue_script(
		'checkout-tabs-wp-ml-telemetry',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/telemetry.js',
		[],
		$version,
		true
	);
	
	// Painel visual de telemetria (admin-only, apenas se debug estiver ativo).
	// Telemetria core continua ativa para capturar dados, mas a UI não deve aparecer para usuário final.
	if (checkout_tabs_wp_ml_is_debug_enabled() && current_user_can('manage_options')) {
		wp_enqueue_script(
			'checkout-tabs-wp-ml-telemetry-panel',
			CHECKOUT_TABS_WP_ML_URL . 'assets/js/telemetry-panel.js',
			['checkout-tabs-wp-ml-telemetry'],
			$version,
			true
		);
	}
	
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
		'checkout-tabs-wp-ml-auth',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/login-auth-v2.js',
		['jquery'],
		$version,
		true
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-main',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/checkout-tabs.js',
		['checkout-tabs-wp-ml-address-ml-modal', 'checkout-tabs-wp-ml-cta-anim', 'checkout-tabs-wp-ml-auth'],
		$version,
		true
	);

	// reCAPTCHA site key (pública): por site/ambiente.
	// - Prioridade: opção do plugin
	// - Fallback: plugin "Login No Captcha reCAPTCHA"
	$recaptcha_site_key = (string) get_option('checkout_tabs_wp_ml_recaptcha_site_key', '');
	if ($recaptcha_site_key === '') {
		$login_recaptcha_opts = get_option('login_nocaptcha_options', []);
		if (is_array($login_recaptcha_opts) && isset($login_recaptcha_opts['site_key'])) {
			$recaptcha_site_key = (string) $login_recaptcha_opts['site_key'];
		}
	}
	$registration_enabled = ((string) get_option('woocommerce_enable_signup_and_login_from_checkout', get_option('woocommerce_enable_myaccount_registration', 'no')) === 'yes');
	$guest_checkout_enabled = ((string) get_option('woocommerce_enable_guest_checkout', 'no') === 'yes');
	$registration_generate_password = ((string) get_option('woocommerce_registration_generate_password', 'yes') === 'yes');
	$registration_generate_username = ((string) get_option('woocommerce_registration_generate_username', 'yes') === 'yes');

	wp_localize_script('checkout-tabs-wp-ml-main', 'cc_params', [
		// Passar como 1/0 evita ambiguidades (ex.: 'true'/'false') no JS.
		'debug'      => checkout_tabs_wp_ml_is_debug_enabled() ? 1 : 0,
		// Admin-only UI: painéis visuais (Ver Logs / Telemetria) apenas para quem pode gerenciar o site.
		// Mantém captura de logs/telemetria para depuração sem expor UI ao usuário final.
		'is_admin_viewer' => current_user_can('manage_options') ? 1 : 0,
		'cta_anim'   => 1,
		'is_logged_in' => is_user_logged_in() ? 1 : 0,
		'registration_enabled' => $registration_enabled ? 1 : 0,
		'guest_checkout_enabled' => $guest_checkout_enabled ? 1 : 0,
		'registration_generate_password' => $registration_generate_password ? 1 : 0,
		'registration_generate_username' => $registration_generate_username ? 1 : 0,
		'ml_only'    => $ml_only ? 1 : 0, // Modo ML definitivo (sem abas legadas)
		'ajax_url'   => admin_url('admin-ajax.php'),
		'nonce'      => wp_create_nonce('store_webhook_shipping'),
		'addresses_nonce' => wp_create_nonce('ctwpml_addresses'),
		'address_payload_nonce' => wp_create_nonce('ctwpml_address_payload'),
		'shipping_options_nonce' => wp_create_nonce('ctwpml_shipping_options'),
		'set_shipping_nonce' => wp_create_nonce('ctwpml_set_shipping'),
		'cart_thumbs_nonce' => wp_create_nonce('ctwpml_cart_thumbs'),
		'checkout_blocks_nonce' => wp_create_nonce('ctwpml_checkout_blocks'),
		'coupon_nonce' => wp_create_nonce('ctwpml_coupon'),
		'allow_fake_cpf' => checkout_tabs_wp_ml_allow_fake_cpf() ? 1 : 0,
		'signup_nonce' => wp_create_nonce('ctwpml_signup'),
		'login_nonce' => wp_create_nonce('ctwpml_login'),
		'auth_email_nonce' => wp_create_nonce('ctwpml_auth_email'),
		'check_email_nonce' => wp_create_nonce('ctwpml_check_email'),
		'user_email' => is_user_logged_in() ? (string) wp_get_current_user()->user_email : '',
		'webhook_url'=> checkout_tabs_wp_ml_get_webhook_url(),
		'recaptcha_site_key' => $recaptcha_site_key,
		'plugin_url' => CHECKOUT_TABS_WP_ML_URL,
		'cart_url'   => function_exists('wc_get_cart_url') ? wc_get_cart_url() : '',
		'privacy_policy_url' => esc_url((string) get_option('checkout_tabs_wp_ml_privacy_policy_url', '')),
		// Gate de sincronização (frete/revisão) com fallback visual.
		// Permite ajustar por ambiente sem alterar JS.
		'review_gate_timeout_ms' => absint(get_option('checkout_tabs_wp_ml_review_gate_timeout_ms', 10000)),
		'review_gate_poll_ms' => max(50, absint(get_option('checkout_tabs_wp_ml_review_gate_poll_ms', 150))),
	]);

	// Variáveis de cor do header do modal ML (apenas fundo/título/ícone).
	$ml_header_bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ml_header_bg', '#ff8500')) ?: '#ff8500';
	$ml_header_title_color = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ml_header_title_color', '#0c0829')) ?: '#0c0829';
	$ml_header_icon_color = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_ml_header_icon_color', '#ffffff')) ?: '#ffffff';
	wp_add_inline_style(
		'checkout-tabs-wp-ml-address-ml-modal',
		':root{--ctwpml-ml-header-bg:' . $ml_header_bg . ';--ctwpml-ml-header-title-color:' . $ml_header_title_color . ';--ctwpml-ml-header-icon-color:' . $ml_header_icon_color . ';}'
	);

	// Enfileirar Google reCAPTCHA v2 apenas quando houver site key configurada.
	if (!is_user_logged_in() && $recaptcha_site_key !== '') {
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
 * Splash Screen (opcional) - carregamento global (primeiro load).
 */
add_action('wp_enqueue_scripts', function () {
	$enabled = ((int) get_option('checkout_tabs_wp_ml_splash_enabled', 0) === 1);
	if (!$enabled) {
		return;
	}

	$version = function_exists('checkout_tabs_wp_ml_get_version') ? checkout_tabs_wp_ml_get_version() : '0.0.0';
	wp_enqueue_style(
		'checkout-tabs-wp-ml-splash',
		CHECKOUT_TABS_WP_ML_URL . 'assets/css/splash-screen.css',
		[],
		$version
	);
	wp_enqueue_script(
		'checkout-tabs-wp-ml-splash',
		CHECKOUT_TABS_WP_ML_URL . 'assets/js/splash-screen.js',
		[],
		$version,
		false
	);

	$bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_splash_bg', '#ffdb15')) ?: '#ffdb15';
	$image_url = esc_url_raw((string) get_option('checkout_tabs_wp_ml_splash_image_url', ''));
	$duration_ms = absint(get_option('checkout_tabs_wp_ml_splash_duration_ms', 1200));
	$text_enabled = ((int) get_option('checkout_tabs_wp_ml_splash_text_enabled', 0) === 1);
	$text = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_splash_text', ''));
	$text_color = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_splash_text_color', '#111111')) ?: '#111111';
	$text_font = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_splash_text_font', 'Arial')) ?: 'Arial';
	$text_gap_px = max(10, absint(get_option('checkout_tabs_wp_ml_splash_text_gap_px', 12)));
	$text_typing = ((int) get_option('checkout_tabs_wp_ml_splash_text_typing', 0) === 1);

	wp_add_inline_script(
		'checkout-tabs-wp-ml-splash',
		'(function(){' .
			'try{' .
				'if(window.sessionStorage&&sessionStorage.getItem("ctwpml_splash_seen")==="1"){return;}' .
				'document.documentElement.classList.add("ctwpml-splash-on");' .
			'}catch(e){document.documentElement.classList.add("ctwpml-splash-on");}' .
		'}());' .
		'window.CTWPMLSplashConfig=' . wp_json_encode([
			'bg' => $bg,
			'imageUrl' => $image_url,
			'durationMs' => $duration_ms,
			'textEnabled' => $text_enabled,
			'text' => $text,
			'textColor' => $text_color,
			'textFont' => $text_font,
			'textGapPx' => $text_gap_px,
			'textTyping' => $text_typing,
		]) . ';',
		'before'
	);
}, 5);

/**
 * Splash Screen (opcional) - HTML o mais cedo possível (1ª visita).
 * Renderiza o overlay via wp_body_open para evitar "flash" do site no iOS.
 */
add_action('wp_body_open', function () {
	$enabled = ((int) get_option('checkout_tabs_wp_ml_splash_enabled', 0) === 1);
	if (!$enabled) {
		return;
	}

	$bg = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_splash_bg', '#ffdb15')) ?: '#ffdb15';
	$image_url = esc_url((string) get_option('checkout_tabs_wp_ml_splash_image_url', ''));
	$text_enabled = ((int) get_option('checkout_tabs_wp_ml_splash_text_enabled', 0) === 1);
	$text = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_splash_text', ''));
	$text_color = sanitize_hex_color((string) get_option('checkout_tabs_wp_ml_splash_text_color', '#111111')) ?: '#111111';
	$text_font = sanitize_text_field((string) get_option('checkout_tabs_wp_ml_splash_text_font', 'Arial')) ?: 'Arial';
	$text_gap_px = max(10, absint(get_option('checkout_tabs_wp_ml_splash_text_gap_px', 12)));

	echo '<div id="ctwpml-splash" aria-hidden="true" style="background:' . esc_attr($bg) . ';">';
	echo '<div class="ctwpml-splash-inner">';
	if (!empty($image_url)) {
		echo '<img class="ctwpml-splash-image" src="' . esc_url($image_url) . '" alt="" aria-hidden="true" decoding="async" loading="eager" fetchpriority="high" />';
	}
	if ($text_enabled && !empty($text)) {
		echo '<p class="ctwpml-splash-text" style="color:' . esc_attr($text_color) . ';font-family:' . esc_attr($text_font) . ';margin-top:' . esc_attr((string) $text_gap_px) . 'px;">' . esc_html($text) . '</p>';
	}
	echo '</div></div>';
}, 0);

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


