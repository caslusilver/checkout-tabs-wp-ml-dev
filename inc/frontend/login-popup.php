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
			<button type="button" class="ctwpml-auth-tab is-active" data-tab="login"><h6 style="margin:0;">Login</h6></button>
			<button type="button" class="ctwpml-auth-tab" data-tab="signup"><h5 style="margin:0;">Criar uma conta</h5></button>
		</div>

		<div class="ctwpml-auth-panel" data-tab="login">
			<h3 class="ctwpml-auth-title">Login</h3>
			<h6 class="ctwpml-auth-subtitle">
				Faça login para escolher e salvar seu endereço de entrega.
			</h6>

			<div style="text-align:center; margin-bottom: 16px;">
				<?php echo do_shortcode('[nextend_social_login]'); ?>
			</div>

			<div class="ctwpml-auth-divider">
				<div class="ctwpml-auth-divider-line"></div>
				<span class="ctwpml-auth-divider-text">ou</span>
				<div class="ctwpml-auth-divider-line"></div>
			</div>

			<form method="post" action="<?php echo esc_url(wp_login_url()); ?>" class="ctwpml-auth-form">
				<label for="ctwpml-username">E-mail</label>
				<input type="text" name="log" id="ctwpml-username" required>

				<label for="ctwpml-password">Senha</label>
				<input type="password" name="pwd" id="ctwpml-password" required>

				<input type="hidden" name="redirect_to" value="<?php echo esc_url(home_url($_SERVER['REQUEST_URI'])); ?>">
				<button type="submit" class="ctwpml-auth-submit">
					Entrar
				</button>
			</form>
		</div>

		<div class="ctwpml-auth-panel" data-tab="signup" style="display:none;">
			<h3 class="ctwpml-auth-title">Criar uma conta</h3>
			<h6 class="ctwpml-auth-subtitle">
				Crie sua conta para salvar seus endereços e acompanhar seus pedidos.
			</h6>

			<form id="ctwpml-signup-form" class="ctwpml-auth-form">
				<label for="ctwpml-signup-name">Nome</label>
				<input type="text" id="ctwpml-signup-name" required>

				<label for="ctwpml-signup-email">E-mail</label>
				<input type="email" id="ctwpml-signup-email" required>

				<div class="ctwpml-auth-cpf-row">
					<label for="ctwpml-signup-cpf" style="margin: 0;">CPF</label>
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


