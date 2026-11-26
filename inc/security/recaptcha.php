<?php
if (!defined('ABSPATH')) exit;

/** Uma única decisão de servidor para formulário, assets e endpoints de autenticação. */
function ctwpml_recaptcha_enabled(): bool {
    return (string) get_option('checkout_tabs_wp_ml_recaptcha_enabled', '1') !== '0';
}

function ctwpml_recaptcha_keys(): array {
    $keys = [
        'site_key'=>trim((string) get_option('checkout_tabs_wp_ml_recaptcha_site_key', '')),
        'secret_key'=>trim((string) get_option('checkout_tabs_wp_ml_recaptcha_secret_key', '')),
    ];
    // Nunca misturar metade de um par próprio com outra integração.
    if ($keys['site_key'] === '' && $keys['secret_key'] === '') {
        $legacy = get_option('login_nocaptcha_options', []);
        if (is_array($legacy)) foreach (array_keys($keys) as $key) {
            $keys[$key] = isset($legacy[$key]) && is_string($legacy[$key]) ? trim($legacy[$key]) : '';
        }
    }
    return $keys;
}

function ctwpml_auth_diagnostic(string $code): void {
    if (function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled() && function_exists('wc_get_logger')) {
        wc_get_logger()->info('checkout_auth: '.$code, ['source'=>'ctwpml-auth']);
    }
}

function ctwpml_auth_request_guard(string $action) {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return new WP_Error('method', 'Método inválido.');
    if (!check_ajax_referer($action, '_ajax_nonce', false)) return new WP_Error('nonce', 'Sua sessão expirou. Recarregue a página e tente novamente.');
    $ip = is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : '';
    $bucket = 'ctwpml_auth_'.hash('sha256', $action.'|'.$ip.'|'.floor(time()/60));
    $attempts = (int) get_transient($bucket);
    if ($attempts >= ($action === 'ctwpml_login' ? 10 : 5)) {
        ctwpml_auth_diagnostic('rate_limited');
        return new WP_Error('rate_limited', 'Muitas tentativas. Aguarde um minuto e tente novamente.');
    }
    set_transient($bucket, $attempts + 1, 60);
    return true;
}

function ctwpml_verify_checkout_recaptcha($token) {
    if (!ctwpml_recaptcha_enabled()) { ctwpml_auth_diagnostic('captcha_disabled'); return true; }
    $keys = ctwpml_recaptcha_keys();
    if ($keys['site_key'] === '' || $keys['secret_key'] === '') {
        ctwpml_auth_diagnostic('captcha_missing_keys');
        return new WP_Error('captcha_config', 'Não foi possível iniciar a verificação de segurança. Tente novamente ou fale com o suporte.');
    }
    if (!is_string($token) || trim($token) === '' || strlen($token) > 8192) return new WP_Error('captcha_required', 'Complete a verificação de segurança para continuar.');
    $result = wp_remote_post('https://www.google.com/recaptcha/api/siteverify', [
        'timeout'=>10,
        'body'=>['secret'=>$keys['secret_key'], 'response'=>$token],
    ]);
    if (is_wp_error($result) || (int) wp_remote_retrieve_response_code($result) !== 200) {
        ctwpml_auth_diagnostic('captcha_unavailable');
        return new WP_Error('captcha_network', 'Não foi possível verificar agora. Tente novamente.');
    }
    $data = json_decode((string) wp_remote_retrieve_body($result), true);
    $host = is_array($data) && is_string($data['hostname'] ?? null) ? strtolower($data['hostname']) : '';
    $allowed = array_filter([strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST)), strtolower((string) wp_parse_url(site_url('/'), PHP_URL_HOST))]);
    if (!is_array($data) || ($data['success'] ?? false) !== true || !in_array($host, $allowed, true)) {
        ctwpml_auth_diagnostic('captcha_rejected');
        return new WP_Error('captcha_invalid', 'A verificação expirou ou não foi aceita. Confirme novamente para continuar.');
    }
    ctwpml_auth_diagnostic('captcha_verified');
    return true;
}
