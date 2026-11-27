<?php
if (!defined('ABSPATH')) exit;

final class CTWPML_Early_Login {
    private static bool $menu_used = false;
    public static function enabled(): bool { return (string) get_option('checkout_tabs_wp_ml_early_login_enabled','0') === '1'; }
    public static function lost_password_url(): string { return site_url('wp-login.php?action=lostpassword','login'); }
    public static function init(): void {
        add_shortcode('checkout_ml_login',[__CLASS__,'shortcode']);
        add_action('wp_enqueue_scripts',[__CLASS__,'assets'],110);
        add_action('wp_footer',[__CLASS__,'footer'],12);
    }
    public static function assets(): void {
        if (ctwpml_is_visual_editor() || (!self::$menu_used && !(self::enabled() && ctwpml_is_checkout_ui_request()))) return;
        $version=checkout_tabs_wp_ml_get_version();
        wp_enqueue_style('ctwpml-early-login',CHECKOUT_TABS_WP_ML_URL.'assets/css/early-login.css',[],$version);
        wp_enqueue_script('ctwpml-early-login',CHECKOUT_TABS_WP_ML_URL.'assets/js/early-login.js',['ctwpml-passkeys'],$version,true);
        wp_localize_script('ctwpml-early-login','ctwpmlEarlyLoginConfig',[
            'enabled'=>self::enabled(),'checkout'=>ctwpml_is_checkout_ui_request(),
            'account'=>function_exists('wc_get_page_permalink')?wc_get_page_permalink('myaccount'):wp_login_url(),
            'shop'=>function_exists('wc_get_page_permalink')?(wc_get_page_permalink('shop')?:home_url('/')):home_url('/'),
        ]);
    }
    public static function shortcode($attrs=[]): string {
        self::$menu_used=true;
        CTWPML_Passkeys::assets(); self::assets();
        $attrs=shortcode_atts(['size'=>get_option('checkout_tabs_wp_ml_login_icon_size',28),'color'=>'#ffffff','logged_color'=>'#0075ff'],$attrs,'checkout_ml_login');
        $size=max(18,min(48,(int)$attrs['size']));
        $color=sanitize_hex_color($attrs['color'])?:'#ffffff';$logged=sanitize_hex_color($attrs['logged_color'])?:'#0075ff';
        $style='--ctwpml-login-size:'.$size.'px;--ctwpml-login-color:'.$color.';--ctwpml-login-active:'.$logged.';';
        $url=function_exists('wc_get_page_permalink')?wc_get_page_permalink('myaccount'):wp_login_url();
        $trigger=CTWPML_Passkeys::available()?'data-ctwpml-menu-login':'';
        return '<a class="ctwpml-login-icon" '.$trigger.' href="'.esc_url($url).'" target="_blank" rel="noopener noreferrer" style="'.esc_attr($style).'" aria-label="Login. Abrir acesso rápido"><span class="ctwpml-login-icon-image" style="--ctwpml-fingerprint:url('.esc_url(CHECKOUT_TABS_WP_ML_URL.'assets/fingerprint.svg').')" aria-hidden="true"></span><span data-ctwpml-menu-label>Login</span></a>';
    }
    public static function issue_ticket(int $user_id): string {
        if (!self::enabled() || !$user_id || !function_exists('WC') || !WC()->session || !is_callable([WC()->session,'get_customer_id'])) return '';
        $ticket=wp_generate_password(40,false,false);
        set_transient('ctwpml_early_'.hash('sha256',$ticket),['user'=>$user_id,'session'=>hash('sha256',(string)WC()->session->get_customer_id())],600);
        return $ticket;
    }
    public static function ticket_user($ticket): int {
        if (!self::enabled() || !is_string($ticket) || !preg_match('/^[a-zA-Z0-9]{40}$/D',$ticket) || !function_exists('WC') || !WC()->session || !is_callable([WC()->session,'get_customer_id'])) return 0;
        $data=get_transient('ctwpml_early_'.hash('sha256',$ticket));
        return is_array($data) && is_string($data['session']??null) && hash_equals($data['session'],hash('sha256',(string)WC()->session->get_customer_id())) ? (int)$data['user'] : 0;
    }
    public static function footer(): void {
        if (ctwpml_is_visual_editor() || (!self::$menu_used && !(self::enabled() && ctwpml_is_checkout_ui_request()))) return;
        $finger='<img src="'.esc_url(CHECKOUT_TABS_WP_ML_URL.'assets/fingerprint.svg').'" alt="" width="42" height="42">';
        echo '<div id="ctwpml-menu-access" class="ctwpml-access-overlay" hidden><section class="ctwpml-access-dialog" role="dialog" aria-modal="true" aria-label="Acesso à sua conta"><div class="ctwpml-passkey-card"><h2>Não preencha tudo de novo.</h2><p>Recupere seus dados salvos com seu acesso rápido.</p>'.$finger.'<button type="button" class="ctwpml-passkey-primary" data-ctwpml-passkey-login>Usar meus dados salvos</button><p class="ctwpml-passkey-message" role="status"></p></div><button type="button" class="ctwpml-passkey-other" data-ctwpml-menu-password>Entrar com e-mail e senha</button><form id="ctwpml-menu-password-form" hidden><div data-ctwpml-password-intro hidden><h2>Entre com sua senha.</h2><p>Depois, você poderá ativar o acesso rápido neste aparelho.</p></div><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><div id="ctwpml-menu-captcha"></div><button type="button" data-ctwpml-menu-captcha-retry hidden>Tentar carregar a verificação</button><button type="submit" class="ctwpml-passkey-primary">Entrar</button><p role="status" data-ctwpml-menu-message></p></form><a class="ctwpml-passkey-other" href="'.esc_url(self::lost_password_url()).'" target="_blank" rel="noopener noreferrer">Perdeu sua senha? Clique aqui</a><button type="button" class="ctwpml-passkey-other" data-ctwpml-access-close>Voltar à minha página</button></section></div>';
        // An additive notice: keep all login/recovery controls and the native purchase flow.
        echo '<template id="ctwpml-first-purchase-template"><section class="ctwpml-first-purchase" data-ctwpml-first-purchase><h3>Primeira compra? Não precisa entrar.</h3><p>Escolha seus produtos e conclua a compra. Sua conta é criada automaticamente.</p><p data-ctwpml-first-purchase-help role="status" hidden>Se você ainda não tem conta, faça sua primeira compra sem login. Sua conta será criada automaticamente. Se já tem conta, confira seus dados ou recupere sua senha.</p><button type="button" class="ctwpml-passkey-other" data-ctwpml-menu-shop>Comprar sem fazer login</button></section></template>';
        if (self::enabled() && ctwpml_is_checkout_ui_request() && !is_user_logged_in()) {
            echo '<div id="ctwpml-early-access" class="ctwpml-access-overlay ctwpml-early-page" hidden><section class="ctwpml-access-dialog" role="dialog" aria-modal="true" aria-label="Seus dados primeiro"><header><h2 data-ctwpml-early-title>Vamos começar pelo seu e-mail.</h2><p data-ctwpml-early-description>Se já comprou aqui, você pode recuperar seus dados sem preencher tudo de novo.</p></header><form id="ctwpml-early-email-form"><label>Seu e-mail<input id="ctwpml-early-email" type="email" autocomplete="email" required></label><button type="submit" class="ctwpml-passkey-primary">Continuar</button></form><div class="ctwpml-early-email-summary" data-ctwpml-early-email-summary hidden><span data-ctwpml-early-email-value></span><button type="button" class="ctwpml-passkey-other" data-ctwpml-early-edit>Editar e-mail</button></div>';
            echo '<div class="ctwpml-passkey-card" data-ctwpml-early-offer hidden>'.$finger.'<h2>Seus dados em um toque</h2><p>Recupere nome, telefone e endereços salvos.</p><button type="button" class="ctwpml-passkey-primary" data-ctwpml-passkey-login>Usar meus dados salvos</button><p class="ctwpml-passkey-message" role="status"></p><button type="button" class="ctwpml-passkey-other" data-ctwpml-early-password>Entrar com senha e ativar neste aparelho</button></div>';
            echo '<div class="ctwpml-passkey-card" data-ctwpml-early-existing hidden>'.$finger.'<h2>Use seus dados neste aparelho.</h2><p>Primeiro, entre com sua senha. Depois, você poderá ativar o acesso rápido neste aparelho.</p><button type="button" class="ctwpml-passkey-primary" data-ctwpml-early-existing-login>Entrar e recuperar meus dados</button><button type="button" class="ctwpml-passkey-other" data-ctwpml-early-use-key hidden>Já tenho acesso rápido neste aparelho</button></div>';
            echo '<p data-ctwpml-early-message role="status"></p><button type="button" class="ctwpml-passkey-other" data-ctwpml-early-manual>Prefiro preencher meus dados</button><a class="ctwpml-passkey-other" href="'.esc_url(self::lost_password_url()).'" target="_blank" rel="noopener noreferrer">Perdeu sua senha? Clique aqui</a></section></div>';
        }
    }
}
CTWPML_Early_Login::init();
