<?php
if (!defined('ABSPATH')) exit;

/** Adaptador de apresentação. Challenges, chaves e verificação pertencem ao Secure Passkeys. */
final class CTWPML_Passkeys {
    private static $handoff_order = null;
    public static function has_keys(int $user_id): bool {
        if ($user_id<=0 || !self::available() || !class_exists('Secure_Passkeys\\Models\\Secure_Passkeys_WebAuthn') || \Secure_Passkeys\Utils\Secure_Passkeys_Helper::is_user_in_excluded_roles($user_id)) return false;
        foreach ((new \Secure_Passkeys\Models\Secure_Passkeys_WebAuthn())->get_all_by_user_id($user_id) as $record) {
            $row=(array)$record;
            if (!array_key_exists('is_active',$row) || (bool)$row['is_active']) return true;
        }
        return false;
    }
    public static function available(): bool {
        return defined('SECURE_PASSKEYS_VERSION') && version_compare(SECURE_PASSKEYS_VERSION, '1.3.0', '>=') && defined('SECURE_PASSKEYS_NONCE')
            && class_exists('Secure_Passkeys\\Utils\\Secure_Passkeys_Helper');
    }
    public static function init(): void {
        add_action('wp_enqueue_scripts', [__CLASS__, 'assets'], 100);
        add_action('wp_ajax_ctwpml_passkey_context', [__CLASS__, 'context']);
        add_action('wp_ajax_nopriv_ctwpml_passkey_context', [__CLASS__, 'context']);
        add_action('wp_ajax_nopriv_secure_passkeys_frontend_get_login_options', static function () {
            if (defined('SECURE_PASSKEYS_NONCE') && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'] ?? '')), SECURE_PASSKEYS_NONCE) && function_exists('ctwpml_preserve_auth_coupons')) ctwpml_preserve_auth_coupons();
        }, 1);
        add_action('wp_footer', [__CLASS__, 'footer']);
        add_action('woocommerce_created_customer', static function ($id) {
            if (function_exists('WC') && WC()->session) WC()->session->set('ctwpml_pk_new_customer',(int)$id);
        });
        add_filter('woocommerce_payment_successful_result', [__CLASS__, 'handoff'], 20, 2);
        add_action('template_redirect', [__CLASS__, 'handoff_page'], 1);
        add_action('woocommerce_checkout_create_order', static function ($order) {
            if (is_user_logged_in() && (int)$order->get_customer_id()===get_current_user_id()) $order->update_meta_data('_ctwpml_passkey_registered',self::has_keys(get_current_user_id()) ? 'yes' : 'no');
        });
        add_action('wp_print_footer_scripts', static function () {
            // O formulário nativo Woo pode enfileirar autofill paralelo, com outra navegação.
            if (ctwpml_is_checkout_ui_request() && !ctwpml_is_visual_editor()) wp_dequeue_script('secure-passkeys-login-script');
        }, 0);
        add_shortcode('checkout_ml_acesso', [__CLASS__, 'shortcode']);
        add_action('woocommerce_login_form_start', [__CLASS__, 'account']);
        add_filter('secure_passkeys_web_authn_validate_user_sign_in_enable_wp_login', '__return_true');
        add_filter('secure_passkeys_web_authn_validate_user_sign_in', [__CLASS__, 'validate_checkout_identity'], 20, 2);
        add_action('secure_passkeys_web_authn_sign_in', [__CLASS__, 'resume_checkout']);
        add_filter('secure_passkeys_get_frontend_login_localization', [__CLASS__, 'login_translation']);
        add_filter('secure_passkeys_get_frontend_register_localization', [__CLASS__, 'register_translation']);
        add_filter('secure_passkeys_login_error_message', static function ($message, $reason='') {
            $code = in_array($reason, ['NOT_FOUND','INACTIVE_PASSKEY','EXCLUDED_ROLES','Challenge already consumed','CHECKOUT_ACCOUNT_MISMATCH'], true) ? $reason : 'verification_failed';
            if ($code === 'verification_failed') {
                foreach (['challenge','origin','signature','counter'] as $category) {
                    if (stripos((string)$reason, $category) !== false) { $code = $category.'_rejected'; break; }
                }
            }
            if (function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled()) {
                if (function_exists('wc_get_logger')) wc_get_logger()->warning('passkey_login_rejected: '.$code, ['source'=>'ctwpml-auth']);
            }
            return 'Não foi possível entrar. Tente novamente ou entre de outra forma.';
        }, 10, 2);
        add_filter('secure_passkeys_frontend_invalid_request_error_message', static fn($error) => $error ? 'Sua sessão mudou. Recarregue a página e tente novamente.' : '');
        add_filter('secure_passkeys_frontend_invalid_permission_error_message', static fn() => 'Este perfil não pode cadastrar acesso rápido. Consulte o suporte.');
        add_filter('gettext', [__CLASS__, 'translate'], 20, 3);
    }
    public static function resume_checkout($user): void {
        if ($user instanceof WP_User && is_user_logged_in() && (int)$user->ID===get_current_user_id() && function_exists('WC') && WC()->session) WC()->session->set('ctwpml_pk_login_user',(int)$user->ID);
        // Mesmo helper usado no login tradicional, somente na retomada tardia da compra.
        // A entrada antecipada preserva o perfil salvo, sem gravar um rascunho visitante sobre ele.
        if (($_POST['ctwpml_context'] ?? '') !== 'checkout-late' || !$user instanceof WP_User ||
            !is_user_logged_in() || (int)$user->ID !== get_current_user_id()) return;
        if (function_exists('ctwpml_migrate_guest_data_to_user')) ctwpml_migrate_guest_data_to_user((int)$user->ID);
    }
    public static function validate_checkout_identity($allowed, $user) {
        if (!$allowed || ($_POST['ctwpml_context'] ?? '')!=='checkout-late') return $allowed;
        $expected=function_exists('WC') && WC()->session ? (int)WC()->session->get('ctwpml_pk_expected_user',0) : 0;
        // E-mail orienta a conta esperada; somente a prova válida dessa conta pode retomar a compra.
        if (!$user instanceof WP_User || !$expected || (int)$user->ID!==$expected) throw new \Exception('CHECKOUT_ACCOUNT_MISMATCH');
        return true;
    }
    public static function assets(): void {
        if (!self::available() || ctwpml_is_visual_editor()) return;
        $version = checkout_tabs_wp_ml_get_version();
        wp_enqueue_style('ctwpml-passkeys', CHECKOUT_TABS_WP_ML_URL . 'assets/css/passkeys.css', [], $version);
        wp_enqueue_script('ctwpml-passkeys', CHECKOUT_TABS_WP_ML_URL . 'assets/js/passkeys.js', [], $version, true);
        wp_localize_script('ctwpml-passkeys', 'ctwpmlPasskeyConfig', ['debug'=>function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled(), 'ajax'=>admin_url('admin-ajax.php'), 'checkout'=>ctwpml_is_checkout_ui_request() || (bool)self::$handoff_order, 'cart'=>function_exists('is_cart') && is_cart(), 'checkoutUrl'=>function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : '', 'afterOrder'=>self::$handoff_order ? self::$handoff_order->get_checkout_order_received_url() : '', 'afterOrderId'=>self::$handoff_order ? self::$handoff_order->get_id() : 0, 'loggedIn'=>is_user_logged_in(), 'account'=>function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : wp_login_url()]);
    }
    public static function context(): void {
        nocache_headers();
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') wp_send_json_error(['message'=>'Método inválido.'], 405);
        if (!self::available()) wp_send_json_error(['message'=>'Acesso rápido indisponível. Use outra forma de entrar.'], 503);
        // Somente contexto/nonce público do motor. Nenhum endereço ou identificador de chave é exposto.
        $bucket='ctwpml_pk_'.hash('sha256',($_SERVER['REMOTE_ADDR'] ?? '').'|'.get_current_user_id().'|'.floor(time()/60));
        $count=(int)get_transient($bucket);
        if ($count>=30) wp_send_json_error(['message'=>'Aguarde um momento antes de tentar novamente.'],429);
        set_transient($bucket,$count+1,60);
        $logged=is_user_logged_in();
        $can=$logged && !\Secure_Passkeys\Utils\Secure_Passkeys_Helper::is_user_in_excluded_roles(get_current_user_id());
        $has=$can && self::has_keys(get_current_user_id());
        if ($logged && function_exists('update_user_meta')) update_user_meta(get_current_user_id(),'ctwpml_passkey_registered',$has ? 'yes' : 'no');
        $session=function_exists('WC') ? WC()->session : null;
        if ($logged && !empty($_POST['enrollment_done']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'] ?? '')),SECURE_PASSKEYS_NONCE)) {
            if ($session) $session->set('ctwpml_pk_enroll_user',get_current_user_id());
            if (!empty($_POST['order_id'])) {
                $order=wc_get_order(absint($_POST['order_id']));
                if ($order && (int)$order->get_customer_id()===get_current_user_id()) { $order->update_meta_data('_ctwpml_passkey_registered',$has ? 'yes' : 'no'); $order->save_meta_data(); }
            }
        }
        wp_send_json_success(['nonce'=>wp_create_nonce(SECURE_PASSKEYS_NONCE), 'loggedIn'=>$logged, 'canRegister'=>$can, 'hasPasskeys'=>$has, 'usedPasskey'=>$logged && $session && (int)$session->get('ctwpml_pk_login_user',0)===get_current_user_id(), 'enrollmentSeen'=>$logged && $session && (int)$session->get('ctwpml_pk_enroll_user',0)===get_current_user_id()]);
    }
    public static function handoff($result, $order_id) {
        if (!self::available() || !is_user_logged_in() || !function_exists('WC') || !WC()->session || ($result['result'] ?? '')!=='success') return $result;
        $id=get_current_user_id(); $session=WC()->session;
        if ((int)$session->get('ctwpml_pk_new_customer',0)!==$id || (int)$session->get('ctwpml_pk_enroll_user',0)===$id || self::has_keys($id)) return $result;
        $order=wc_get_order($order_id);
        if (!$order || (int)$order->get_customer_id()!==$id) return $result;
        $result['redirect']=add_query_arg(['ctwpml_access_after_order'=>$order->get_id(),'key'=>$order->get_order_key()],wc_get_checkout_url());
        return $result;
    }
    public static function handoff_page(): void {
        if (empty($_GET['ctwpml_access_after_order'])) return;
        $order=wc_get_order(absint($_GET['ctwpml_access_after_order']));
        // A chave do pedido sozinha nunca concede cadastro de passkey.
        $key_ok=$order && is_string($_GET['key'] ?? null) && hash_equals((string)$order->get_order_key(),(string)wp_unslash($_GET['key']));
        if (!$key_ok) { wp_safe_redirect(wc_get_checkout_url()); exit; }
        if (!is_user_logged_in() || (int)$order->get_customer_id()!==get_current_user_id() || !self::available()) { wp_safe_redirect($order->get_checkout_order_received_url()); exit; }
        self::$handoff_order=$order; nocache_headers(); header('X-Robots-Tag: noindex, nofollow');
        echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Prepare seu próximo acesso</title>';
        wp_head(); echo '</head><body><main style="font-family:system-ui;text-align:center;padding:32px"><h1>Seu pedido foi criado</h1><p>Prepare seu acesso rápido para não preencher tudo na próxima compra.</p><a href="'.esc_url($order->get_checkout_order_received_url()).'">Continuar para seu pedido</a></main>';wp_footer();echo '</body></html>';exit;
    }
    public static function card(string $context='checkout'): string {
        if (!self::available() || is_user_logged_in()) return '';
        $checkout=$context==='checkout';
        $late=$context==='late';
        return '<section class="ctwpml-passkey-card'.($late?' ctwpml-passkey-card--late':'').'"><img src="'.esc_url(CHECKOUT_TABS_WP_ML_URL.'assets/fingerprint.svg').'" alt="" width="48" height="48"><h2>'.($late?'Entre para concluir sua compra':($checkout?'Não preencha tudo de novo':'Sua conta, sem digitar a senha')).'</h2><p>'.($late?'Seus dados desta compra estão preservados. Se já cadastrou acesso rápido, você também pode usá-lo.':($checkout?'Já comprou aqui? Recupere seu nome, telefone e endereço salvos.':'Acesse seus pedidos com o rosto, a digital ou o PIN do seu aparelho.')).'</p><div class="ctwpml-passkey-benefit"><strong>Você só confere e continua</strong><p>Confirme com rosto, digital ou PIN para usar seus dados.</p></div><button type="button" class="ctwpml-passkey-primary" data-ctwpml-passkey-login>'.($late?'Entrar com acesso rápido':($checkout?'Usar meus dados salvos':'Acessar minha conta')).'</button><p class="ctwpml-passkey-message" role="status"></p></section>';
    }
    public static function shortcode(): string {
        if (ctwpml_is_visual_editor()) return '';
        $html=self::card('account');
        return $html ? $html.'<a class="ctwpml-passkey-other" href="'.esc_url(wc_get_page_permalink('myaccount')).'">Entrar de outra forma</a>' : '';
    }
    public static function account(): void {
        if (!self::available()) return;
        // Quando o motor já adiciona seu botão aqui, mantemos o ponto existente traduzido.
        if (\Secure_Passkeys\Utils\Secure_Passkeys_Helper::get_option('display_passkey_login_woocommerce_enabled',0)) return;
        echo self::card('account');
    }
    public static function footer(): void {
        if (!self::available() || (!ctwpml_is_checkout_ui_request() && !self::$handoff_order)) return;
        if (is_user_logged_in()) { echo '<div id="ctwpml-passkey-enroll" hidden role="dialog" aria-modal="true" aria-label="Ativar acesso rápido">'.self::invitation().'</div>'; return; }
        echo '<div id="ctwpml-passkey-entry" hidden><div class="ctwpml-passkey-dialog" role="dialog" aria-modal="true" aria-label="Recuperar dados salvos">'.self::card().'<button type="button" class="ctwpml-passkey-other" data-ctwpml-passkey-skip>Continuar sem recuperar meus dados</button><p>Primeira compra ou sem acesso salvo? Você pode preencher seus dados e continuar.</p></div></div>';
    }
    public static function invitation(): string {
        if (!self::available() || !is_user_logged_in()) return '';
        return '<section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><h2>Na próxima, não digite tudo de novo</h2><p>Ative o acesso aos seus dados salvos com rosto, digital ou PIN.</p><button type="button" class="ctwpml-passkey-primary" data-ctwpml-passkey-register>Ativar para a próxima compra</button><button type="button" class="ctwpml-passkey-other" data-ctwpml-passkey-dismiss>Continuar sem ativar</button><p class="ctwpml-passkey-message" role="status"></p></section>';
    }
    public static function login_translation(array $texts): array {
        return array_replace($texts,['passkeys_not_supported_in_browser'=>'Este navegador não oferece acesso rápido. Entre de outra forma.', 'failed_load_options'=>'Não foi possível preparar o acesso. Tente novamente.', 'failed_login'=>'Não foi possível entrar. Tente novamente ou entre de outra forma.', 'cancelled_login'=>'Você cancelou o acesso. Pode tentar novamente.', 'cancelled_or_no_passkey'=>'Acesso cancelado ou chave indisponível neste aparelho. Entre de outra forma.', 'success_login'=>'Acesso confirmado. Carregando seus dados…']);
    }
    public static function register_translation(array $texts): array {
        return array_replace($texts,['title'=>'Seus acessos rápidos', 'description'=>'Use rosto, digital ou PIN para acessar seus dados salvos.', 'out_of'=>'de', 'add_passkey_button'=>'Adicionar acesso rápido', 'add_button'=>'Adicionar', 'cancel_button'=>'Cancelar', 'your_passkeys'=>'Seus acessos rápidos', 'add_waiting_button'=>'Confirme no seu aparelho…', 'added_on'=>'Adicionado em', 'last_used'=>'Último uso', 'security_key_name'=>'Nome do acesso', 'security_key_description'=>'Escolha um nome para reconhecer este aparelho.', 'security_key_name_placeholder'=>'Ex.: Meu celular', 'inactive'=>'Inativo', 'active'=>'Ativo', 'failed_load_passkeys'=>'Não foi possível carregar os acessos.', 'reach_maximum_credentials'=>'Você atingiu o limite de acessos cadastrados.', 'failed_cancel_register'=>'Cadastro cancelado ou não concluído.', 'failed_save_passkey_name_length'=>'Use um nome entre 3 e 30 caracteres.', 'passkey_already_registered'=>'Este acesso já está cadastrado.', 'failed_register'=>'Não foi possível cadastrar. Tente novamente.', 'cancelled_register'=>'Cadastro cancelado. Sua compra pode continuar.', 'confirm_delete_passkey'=>'Excluir este acesso rápido?', 'failed_delete_passkey'=>'Não foi possível excluir o acesso.', 'success_delete_passkey'=>'Acesso excluído.', 'passkeys_not_supported_in_browser'=>'Use outro navegador para cadastrar seu acesso rápido.', 'failed_load_options'=>'Não foi possível preparar o cadastro.', 'failed_save_passkey'=>'Não foi possível salvar o acesso.', 'failed_save_passkey_name'=>'Use letras sem acento, números, espaços, hífen ou sublinhado.', 'success_save_passkey'=>'Acesso rápido cadastrado.', 'no_passkeys_found'=>'Nenhum acesso rápido cadastrado.']);
    }
    public static function translate($translated, $text, $domain) {
        if ($domain!=='secure-passkeys' || is_admin()) return $translated;
        $map=['Login via Passkey'=>'Entrar com acesso rápido','Login via Passkey..'=>'Confirme no seu aparelho…','Passkey authentication failed. Please try again.'=>'Não foi possível entrar. Tente novamente ou use outra forma de acesso.','Token mismatch, please refresh the page.'=>'A sessão mudou. Recarregue a página e tente novamente.','Too many requests. Please try again later.'=>'Muitas tentativas. Aguarde um momento e tente novamente.'];
        return $map[$text] ?? $translated;
    }
}
CTWPML_Passkeys::init();
