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
	if (!ctwpml_is_checkout_ui_request()) {
		return;
	}
	if (is_user_logged_in()) {
		return;
	}

	$google_login_enabled = function_exists('checkout_tabs_wp_ml_is_google_login_enabled')
		? checkout_tabs_wp_ml_is_google_login_enabled()
		: false;

	// HTML minimalista, inspirado no exemplo fornecido, sem anexar handlers globais.
	?>
	<div id="ctwpml-auth-template" style="display:none;">
		<!-- Wrapper interno é movido para dentro do modal via JS (showAuthView) -->
		<div class="ctwpml-login-popup <?php echo $google_login_enabled ? '' : 'ctwpml-google-login-disabled'; ?>" data-ctwpml-google-login-enabled="<?php echo $google_login_enabled ? '1' : '0'; ?>">
			<?php if (class_exists('CTWPML_Passkeys') && CTWPML_Passkeys::available()): echo CTWPML_Passkeys::card('late'); ?>
			<button type="button" class="ctwpml-passkey-other" data-ctwpml-passkey-password>Entrar com e-mail e senha</button>
			<?php endif; ?>
			<form id="ctwpml-auth-form" class="ctwpml-auth-form" autocomplete="on">
				<div class="ctwpml-auth-grid">
					<!-- Esquerda: Google + Login -->
					<div class="ctwpml-auth-col ctwpml-auth-col-left">
						<?php if ($google_login_enabled) : ?>
							<div class="ctwpml-auth-social" style="text-align:center; margin: 12px 0 16px;">
								<?php echo do_shortcode('[nextend_social_login]'); ?>
							</div>

							<div class="ctwpml-auth-divider">
								<div class="ctwpml-auth-divider-line"></div>
								<span class="ctwpml-auth-divider-text">ou</span>
								<div class="ctwpml-auth-divider-line"></div>
							</div>
						<?php endif; ?>

						<div class="ctwpml-popup-h2 ctwpml-auth-subtitle" style="margin-top: 12px;">
							Faça login com seu e-mail e senha.
						</div>

						<label for="ctwpml-login-email" class="ctwpml-popup-h3">E-mail</label>
						<input type="email" id="ctwpml-login-email" autocomplete="username">

						<label for="ctwpml-login-password" class="ctwpml-popup-h3">Senha</label>
						<div class="ctwpml-password-field">
							<input type="password" id="ctwpml-login-password" autocomplete="current-password">
							<button type="button" class="ctwpml-password-toggle" aria-label="Mostrar senha" aria-controls="ctwpml-login-password" aria-pressed="false" title="Mostrar senha">
								<svg class="ctwpml-password-eye ctwpml-password-eye-show" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
								<svg class="ctwpml-password-eye ctwpml-password-eye-hide" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3.27 2 18.7 18.7-1.42 1.42-3.23-3.23A12.2 12.2 0 0 1 12 20C7 20 2.73 16.89 1 13c.77-1.73 2.03-3.25 3.64-4.44L1.86 3.42 3.27 2Zm8.73 4c5 0 9.27 3.11 11 7a12.4 12.4 0 0 1-4.16 4.77l-2.9-2.9a5 5 0 0 0-6.8-6.8L7.4 6.33A12.2 12.2 0 0 1 12 6Zm0 2.5a4.5 4.5 0 0 1 4.5 4.5c0 .46-.07.9-.2 1.31l-5.61-5.61c.41-.13.85-.2 1.31-.2Z"/></svg>
							</button>
						</div>

						<div class="ctwpml-auth-footer" style="text-align: left; margin: 10px 0 8px;">
							<a href="<?php echo esc_url(site_url('wp-login.php?action=lostpassword', 'login')); ?>" class="ctwpml-auth-link" target="_blank" rel="noopener noreferrer">Perdeu sua senha? Clique aqui</a>
						</div>
					</div>

					<!-- Direita: Criar conta + reCAPTCHA + Entrar -->
					<div class="ctwpml-auth-col ctwpml-auth-col-right">
						<div class="ctwpml-create-account-fields">
							<div class="ctwpml-popup-h2 ctwpml-auth-subtitle" style="margin-top: 12px;">
								Criar uma conta
							</div>
							<div class="ctwpml-popup-h3 ctwpml-auth-create-helper" style="opacity:.9; margin: 0 0 10px;">
								Você pode criar uma conta apenas com seu e-mail e redefinir a senha depois.
							</div>
							<label for="ctwpml-create-email" class="ctwpml-popup-h3">E-mail para criar conta</label>
							<input type="email" id="ctwpml-create-email" autocomplete="email">
						</div>

						<?php
                        if (ctwpml_recaptcha_enabled()) {
                            $keys = ctwpml_recaptcha_keys();
                            echo '<div id="ctwpml-recaptcha-container" style="margin:16px 0;">';
                            echo '<div id="g-recaptcha" data-sitekey="' . esc_attr($keys['site_key']) . '"></div>';
                            echo '<button type="button" id="ctwpml-recaptcha-retry" class="ctwpml-auth-link" hidden>Tentar carregar a verificação</button>';
                            echo '</div>';
                        }
						?>

						<button type="submit" id="ctwpml-auth-submit" class="ctwpml-auth-submit" <?php echo ctwpml_recaptcha_enabled() ? 'disabled' : ''; ?>>Entrar</button>
						<div id="ctwpml-auth-msg" class="ctwpml-auth-msg" style="display:none;"></div>
					</div>
				</div>
			</form>
		</div>
	</div>
	<?php
}, 100);


