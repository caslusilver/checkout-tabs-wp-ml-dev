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
	<div id="login-popup" style="display:none; position: relative; width: 100%; padding: 20px; border-radius: 10px; background-color: #fff; box-sizing: border-box; max-width: 440px; margin: 20px auto;">
		<span class="popup-close-button" style="position:absolute; top:14px; right:14px; font-size:24px; cursor:pointer;">×</span>
		<div style="display:flex; gap: 10px; margin: 0 0 12px;">
			<button type="button" class="ctwpml-auth-tab is-active" data-tab="login" style="flex:1; padding:10px; border-radius: 3px; border:1px solid #ddd; background:#f5f5f5; font-weight:700; cursor:pointer;">Login</button>
			<button type="button" class="ctwpml-auth-tab" data-tab="signup" style="flex:1; padding:10px; border-radius: 3px; border:1px solid #ddd; background:#fff; font-weight:700; cursor:pointer;">Criar conta</button>
		</div>

		<div class="ctwpml-auth-panel" data-tab="login">
			<h2 style="color: #000; margin: 0 0 12px;">Login</h2>
			<p style="color: #000; font-family: Arial; text-align: center; margin: 0 0 18px;">
				Faça login para escolher e salvar seu endereço de entrega.
			</p>

			<div style="text-align:center; margin-bottom: 16px;">
				<?php echo do_shortcode('[nextend_social_login]'); ?>
			</div>

			<div style="display: flex; align-items: center; margin: 16px 0;">
				<div style="flex: 1; height: 2px; background-color: #000;"></div>
				<span style="margin: 0 10px; color: #000; font-weight: bold;">ou</span>
				<div style="flex: 1; height: 2px; background-color: #000;"></div>
			</div>

			<form method="post" action="<?php echo esc_url(wp_login_url()); ?>" style="width: 100%; max-width: 400px; margin: 0 auto;">
				<label for="ctwpml-username" style="color: #000;">E-mail</label>
				<input type="text" name="log" id="ctwpml-username" required style="display:block;width:100%;margin-bottom:10px;padding:10px;border-radius:3px;border:1px solid #979797;">

				<label for="ctwpml-password" style="color: #000;">Senha</label>
				<input type="password" name="pwd" id="ctwpml-password" required style="display:block;width:100%;margin-bottom:10px;padding:10px;border-radius:3px;border:1px solid #979797;">

				<input type="hidden" name="redirect_to" value="<?php echo esc_url(home_url($_SERVER['REQUEST_URI'])); ?>">
				<button type="submit" style="background-color:#0075FF;color:#fff;border:0;cursor:pointer;display:block;width:100%;margin-top:10px;padding:10px;border-radius:3px;font-weight:700;">
					Entrar
				</button>
			</form>
		</div>

		<div class="ctwpml-auth-panel" data-tab="signup" style="display:none;">
			<h2 style="color: #000; margin: 0 0 12px;">Criar conta</h2>
			<p style="color: #000; font-family: Arial; text-align: center; margin: 0 0 18px;">
				Crie sua conta para salvar seus endereços e acompanhar seus pedidos.
			</p>

			<form id="ctwpml-signup-form" style="width: 100%; max-width: 400px; margin: 0 auto;">
				<label for="ctwpml-signup-name" style="color: #000;">Nome</label>
				<input type="text" id="ctwpml-signup-name" required style="display:block;width:100%;margin-bottom:10px;padding:10px;border-radius:3px;border:1px solid #979797;">

				<label for="ctwpml-signup-email" style="color: #000;">E-mail</label>
				<input type="email" id="ctwpml-signup-email" required style="display:block;width:100%;margin-bottom:10px;padding:10px;border-radius:3px;border:1px solid #979797;">

				<div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
					<label for="ctwpml-signup-cpf" style="color: #000; margin: 0;">CPF</label>
					<a href="#" id="ctwpml-generate-cpf" style="color:#0075FF; text-decoration:none; font-weight:700; display:none;">Gerar CPF fictício</a>
				</div>
				<input type="text" id="ctwpml-signup-cpf" required style="display:block;width:100%;margin-bottom:6px;padding:10px;border-radius:3px;border:1px solid #979797;">
				<div id="ctwpml-cpf-hint" style="color:#111; font-size:12px; line-height:1.35; margin-bottom:12px; display:none;">
					Este CPF é fictício e serve apenas para identificar seus pedidos. Guarde este número caso precise retirar encomendas nos Correios.
				</div>

				<button type="submit" id="ctwpml-signup-submit" style="background-color:#0075FF;color:#fff;border:0;cursor:pointer;display:block;width:100%;margin-top:10px;padding:10px;border-radius:3px;font-weight:700;">
					Criar conta
				</button>
				<div id="ctwpml-signup-msg" style="margin-top:10px; font-weight:700; display:none;"></div>
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


