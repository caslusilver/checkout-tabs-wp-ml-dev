<?php
/**
 * Classe de segurança
 * 
 * Validações, sanitização e verificações de segurança
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Security {
    
    /**
     * Verifica se o usuário tem permissão para acessar o painel
     * 
     * @return bool
     */
    public static function can_manage_panel() {
        return current_user_can('manage_woocommerce');
    }
    
    /**
     * Verifica nonce AJAX
     * 
     * @param string $nonce Nome do nonce
     * @param string $action Ação do nonce
     * @return bool
     */
    public static function verify_ajax_nonce($nonce, $action = 'packing_panel_nonce') {
        return wp_verify_nonce($nonce, $action);
    }
    
    /**
     * Sanitiza dados de rastreio
     * 
     * @param array $data Dados brutos
     * @return array Dados sanitizados
     */
    public static function sanitize_tracking_data($data) {
        return wp_kses_post_deep($data);
    }
    
    /**
     * Valida dados de pedido antes de processar
     * 
     * @param int $order_id ID do pedido
     * @param string $webhook_type Tipo de webhook
     * @return bool|WP_Error True se válido, WP_Error se inválido
     */
    public static function validate_webhook_request($order_id, $webhook_type) {
        if (!$order_id || !is_numeric($order_id)) {
            return new WP_Error('invalid_order_id', 'ID do pedido inválido.', array('status' => 400));
        }
        
        if (empty($webhook_type) || !in_array($webhook_type, ['accepted', 'shipped', 'payment_confirm', 'payment_deny'])) {
            return new WP_Error('invalid_webhook_type', 'Tipo de webhook inválido.', array('status' => 400));
        }
        
        return true;
    }
}