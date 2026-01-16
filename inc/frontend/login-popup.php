<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Injeção do popup de login (Fancybox) apenas no checkout.
 * Evita conflito: só injeta se o usuário NÃO estiver logado.
 *
 * Observação: o site já possui Fancybox + Nextend Social Login.
 * Aqui apenas garantimos o HTML #login-popup existir no /checkout para ser aberto via JS.
 */
add_action('wp_footer', function () {
	if (!function_exists('is_checkout') || !is_checkout()) {
		return;
	}
	if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url()) {
		return;
	}
	if (is_user_logged_in()) {
		return;
	}

	// HTML minimalista, inspirado no exemplo fornecido, sem anexar handlers globais.
	?>
	<div id="login-popup" class="ctwpml-login-popup" style="display:none;">
		<span class="popup-close-button" style="position:absolute; top:14px; right:14px; font-size:24px; cursor:pointer;">×</span>
		<div class="ctwpml-popup-h1 ctwpml-auth-title">Criar uma conta</div>
		<div class="ctwpml-popup-h2 ctwpml-auth-subtitle">
			Você pode criar uma conta apenas com seu e-mail e redefinir a senha depois.
		</div>

		<div style="text-align:center; margin-bottom: 16px;">
			<?php echo do_shortcode('[nextend_social_login]'); ?>
		</div>

		<div class="ctwpml-auth-divider">
			<div class="ctwpml-auth-divider-line"></div>
			<span class="ctwpml-auth-divider-text">ou</span>
			<div class="ctwpml-auth-divider-line"></div>
		</div>

		<form id="ctwpml-auth-form" class="ctwpml-auth-form" autocomplete="on">
			<label for="ctwpml-auth-email" class="ctwpml-popup-h3">E-mail</label>
			<input type="email" id="ctwpml-auth-email" autocomplete="username" required>

			<?php
			// reCAPTCHA v2: chave pública por site/ambiente
			$site_key = (string) get_option('checkout_tabs_wp_ml_recaptcha_site_key', '');
			if ($site_key === '') {
				$login_recaptcha_opts = get_option('login_nocaptcha_options', []);
				if (is_array($login_recaptcha_opts) && isset($login_recaptcha_opts['site_key'])) {
					$site_key = (string) $login_recaptcha_opts['site_key'];
				}
			}

			if (!empty($site_key)) {
				echo '<div id="ctwpml-recaptcha-container" style="margin: 16px 0;">';
				echo '<div id="g-recaptcha" data-sitekey="' . esc_attr($site_key) . '"></div>';
				echo '</div>';
			}
			?>

			<button type="submit" id="ctwpml-auth-submit" class="ctwpml-auth-submit">
				Entrar
			</button>
			<div id="ctwpml-auth-msg" class="ctwpml-auth-msg" style="display:none;"></div>
		</form>
	<script>
	// Callbacks globais do reCAPTCHA (render explícito no afterShow do Fancybox)
	window.ctwpmlRecaptchaOnload = function() {
		// Apenas sinaliza que a API carregou. Render acontece no afterShow.
	};
	window.ctwpmlAuthEnable = function() {
		var btn = document.getElementById('ctwpml-auth-submit');
		if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
	};
	window.ctwpmlAuthDisable = function() {
		var btn = document.getElementById('ctwpml-auth-submit');
		if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
	};
	// Desabilita botões por padrão (serão habilitados via callback do reCAPTCHA)
	(function() {
		var hasCaptcha = document.getElementById('g-recaptcha');
		if (hasCaptcha) {
			var btn = document.getElementById('ctwpml-auth-submit');
			if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
		}
	})();
	</script>
	<?php
}, 100);


