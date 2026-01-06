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
		<div class="ctwpml-auth-tabs">
			<button type="button" class="ctwpml-auth-tab is-active" data-tab="login"><span class="ctwpml-popup-h3">Login</span></button>
			<button type="button" class="ctwpml-auth-tab" data-tab="signup"><span class="ctwpml-popup-h3">Criar uma conta</span></button>
		</div>

		<div class="ctwpml-auth-panel" data-tab="login">
			<div class="ctwpml-popup-h1 ctwpml-auth-title">Login</div>
			<div class="ctwpml-popup-h2 ctwpml-auth-subtitle">
				Faça login para escolher e salvar seu endereço de entrega.
			</div>

			<div style="text-align:center; margin-bottom: 16px;">
				<?php echo do_shortcode('[nextend_social_login]'); ?>
			</div>

			<div class="ctwpml-auth-divider">
				<div class="ctwpml-auth-divider-line"></div>
				<span class="ctwpml-auth-divider-text">ou</span>
				<div class="ctwpml-auth-divider-line"></div>
			</div>

		<form id="ctwpml-login-form" class="ctwpml-auth-form" autocomplete="on">
			<label for="ctwpml-username" class="ctwpml-popup-h3">E-mail</label>
			<input type="email" id="ctwpml-username" autocomplete="username" required>

			<label for="ctwpml-password" class="ctwpml-popup-h3">Senha</label>
			<input type="password" id="ctwpml-password" autocomplete="current-password" required>

			<?php
			// reCAPTCHA v2 no LOGIN (v3.2.6: usando chave fixa do exemplo para máxima compatibilidade)
			$site_key_login = '6LfWXPIqAAAAAF3U6KDkq9WnI1IeYh8uQ1ZvqiPX';
			
			if (!empty($site_key_login)) {
				echo '<div id="ctwpml-recaptcha-login-container" style="margin: 16px 0;">';
				echo '<div id="g-recaptcha-login" data-sitekey="' . esc_attr($site_key_login) . '"></div>';
				echo '</div>';
			}
			?>

			<button type="submit" id="ctwpml-login-submit" class="ctwpml-auth-submit">
				Entrar
			</button>
			<div id="ctwpml-login-msg" class="ctwpml-auth-msg" style="display:none;"></div>
		</form>
			
			<!-- Link "Perdeu a senha?" -->
			<div class="ctwpml-auth-footer" style="text-align: center; margin-top: 16px;">
				<a href="<?php echo esc_url(wp_lostpassword_url()); ?>" class="ctwpml-auth-link">
					Perdeu a senha?
				</a>
			</div>
		</div>

	<div class="ctwpml-auth-panel" data-tab="signup" style="display:none;">
		<div class="ctwpml-popup-h1 ctwpml-auth-title">Criar uma conta</div>
		<div class="ctwpml-popup-h2 ctwpml-auth-subtitle">
			Crie sua conta para salvar seus endereços e acompanhar seus pedidos.
		</div>

		<form id="ctwpml-signup-form" class="ctwpml-auth-form">
			<label for="ctwpml-signup-name" class="ctwpml-popup-h3">Nome</label>
			<input type="text" id="ctwpml-signup-name" required>

		<label for="ctwpml-signup-email" class="ctwpml-popup-h3">E-mail</label>
		<input type="email" id="ctwpml-signup-email" required>

		<?php
		// reCAPTCHA v2 (v3.2.6: usando chave fixa do exemplo para máxima compatibilidade)
		$site_key = '6LfWXPIqAAAAAF3U6KDkq9WnI1IeYh8uQ1ZvqiPX';
		
		if (!empty($site_key)) {
			echo '<div id="ctwpml-recaptcha-container" style="margin: 16px 0;">';
			echo '<div id="g-recaptcha" data-sitekey="' . esc_attr($site_key) . '"></div>';
			echo '</div>';
		}
		?>

		<button type="submit" id="ctwpml-signup-submit" class="ctwpml-auth-submit">
			Criar uma conta
		</button>
				<div id="ctwpml-signup-msg" class="ctwpml-auth-msg" style="display:none;"></div>
			</form>
		</div>
	</div>
	<script>
	// Callbacks globais do reCAPTCHA (render explícito no afterShow do Fancybox)
	window.ctwpmlRecaptchaOnload = function() {
		// Apenas sinaliza que a API carregou. Render acontece no afterShow.
	};
	window.ctwpmlSignupEnable = function() {
		var btn = document.getElementById('ctwpml-signup-submit');
		if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
	};
	window.ctwpmlSignupDisable = function() {
		var btn = document.getElementById('ctwpml-signup-submit');
		if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
	};
	window.ctwpmlLoginEnable = function() {
		var btn = document.getElementById('ctwpml-login-submit');
		if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
	};
	window.ctwpmlLoginDisable = function() {
		var btn = document.getElementById('ctwpml-login-submit');
		if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
	};
	// Desabilita botões por padrão (serão habilitados via callback do reCAPTCHA)
	(function() {
		var hasSignup = document.getElementById('ctwpml-recaptcha-signup');
		var hasLogin = document.getElementById('ctwpml-recaptcha-login');
		if (hasSignup) {
			var btnS = document.getElementById('ctwpml-signup-submit');
			if (btnS) { btnS.disabled = true; btnS.style.opacity = '0.6'; }
		}
		if (hasLogin) {
			var btnL = document.getElementById('ctwpml-login-submit');
			if (btnL) { btnL.disabled = true; btnL.style.opacity = '0.6'; }
		}
	})();
	
	(function($){
		$(document).on('click', '#login-popup .popup-close-button', function(){ if ($.fancybox) $.fancybox.close(); });
	})(jQuery);
	</script>
	<?php
}, 100);


