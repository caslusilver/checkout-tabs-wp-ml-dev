<?php
/**
 * Classe de configuração do plugin
 * 
 * Define constantes e configurações globais
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Config {
    
    /**
     * URL da página onde o shortcode será usado
     */
    const PAGE_URL = 'https://cubensisstore.com.br/painel/';
    
    /**
     * URL do webhook para envio de eventos
     */
    const WEBHOOK_URL = 'https://n8n.cubensisstore.com.br/webhook/atualiza-clf-store';

    /**
     * URL do webhook de atualização de pagamentos manuais
     */
    const PAYMENTS_WEBHOOK_URL = 'https://webhook.cubensisstore.com.br/webhook/invoices';

    /**
     * Nome da key para sakm_get_key (Auth header)
     */
    const PAYMENTS_AUTH_KEY_NAME = 'authorization';
    
    /**
     * Ativa o modo DEBUG
     * Coloque como false em produção
     */
    const DEBUG = false;
    
    /**
     * Versão do plugin
     */
    const VERSION = 'v1.1.18';
    
    /**
     * Tag do shortcode
     */
    const SHORTCODE_TAG = 'packing_panel';
    
    /**
     * Action AJAX para chamadas internas
     */
    const AJAX_ACTION = 'packing_panel_webhook';
    
    /**
     * Retorna a URL do webhook
     */
    public static function get_webhook_url() {
        return apply_filters('ppwoo_webhook_url', self::WEBHOOK_URL);
    }

    /**
     * Retorna a URL do webhook de atualização de pagamentos
     */
    public static function get_payments_webhook_url() {
        return apply_filters('ppwoo_payments_webhook_url', self::PAYMENTS_WEBHOOK_URL);
    }

    /**
     * Retorna o nome da key para autenticação via sakm_get_key
     */
    public static function get_payments_auth_key_name() {
        return apply_filters('ppwoo_payments_auth_key_name', self::PAYMENTS_AUTH_KEY_NAME);
    }
    
    /**
     * Retorna se o debug está ativo
     */
    public static function is_debug() {
        // Prioriza a constante global do arquivo principal
        if (defined('PPWOO_DEBUG_MODE')) {
            return apply_filters('ppwoo_debug', PPWOO_DEBUG_MODE);
        }
        return apply_filters('ppwoo_debug', self::DEBUG);
    }
}


