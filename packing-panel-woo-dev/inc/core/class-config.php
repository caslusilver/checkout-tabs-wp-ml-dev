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


