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

		<form method="post" action="<?php echo esc_url(wp_login_url()); ?>" class="ctwpml-auth-form">
			<label for="ctwpml-username" class="ctwpml-popup-h3">E-mail</label>
			<input type="text" name="log" id="ctwpml-username" required>

			<label for="ctwpml-password" class="ctwpml-popup-h3">Senha</label>
			<input type="password" name="pwd" id="ctwpml-password" required>

				<input type="hidden" name="redirect_to" value="<?php echo esc_url(home_url($_SERVER['REQUEST_URI'])); ?>">
				<button type="submit" class="ctwpml-auth-submit">
					Entrar
				</button>
			</form>
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

			<div class="ctwpml-auth-cpf-row">
				<label for="ctwpml-signup-cpf" class="ctwpml-popup-h3" style="margin: 0;">CPF</label>
				<a href="#" id="ctwpml-generate-cpf" class="ctwpml-auth-link" style="display:none;">Gerar CPF fictício</a>
			</div>
				<input type="text" id="ctwpml-signup-cpf" required>
				<div id="ctwpml-cpf-hint" class="ctwpml-auth-hint" style="display:none;">
					Este CPF é fictício e serve apenas para identificar seus pedidos. Guarde este número caso precise retirar encomendas nos Correios.
				</div>

				<button type="submit" id="ctwpml-signup-submit" class="ctwpml-auth-submit">
					Criar uma conta
				</button>
				<div id="ctwpml-signup-msg" class="ctwpml-auth-msg" style="display:none;"></div>
			</form>
		</div>
	</div>
	<script>
	(function($){
		$(document).on('click', '#login-popup .popup-close-button', function(){ if ($.fancybox) $.fancybox.close(); });
	})(jQuery);
	</script>
	<?php
}, 100);


