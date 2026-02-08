<?php
/**
 * Classe de utilitários
 * 
 * Funções auxiliares para formatação, sanitização e helpers
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Utils {
    
    /**
     * Obtém o CPF do pedido sanitizado (apenas dígitos)
     * 
     * @param WC_Order $order Objeto do pedido
     * @return string CPF com apenas dígitos ou string vazia
     */
    public static function get_order_billing_cpf($order) {
        $cpf = $order->get_meta('billing_cpf');
        return preg_replace('/\D+/', '', (string) $cpf);
    }
    
    /**
     * Formata número de telefone/WhatsApp
     * 
     * @param string $phone Número bruto
     * @return string Número apenas com dígitos
     */
    public static function sanitize_phone($phone) {
        return preg_replace('/\D+/', '', $phone);
    }
    
    /**
     * Formata valor monetário para salvar no banco
     * 
     * @param string $value Valor com vírgula ou ponto
     * @return float|string Valor formatado ou string vazia
     */
    public static function format_shipping_cost($value) {
        $sanitized = str_replace(',', '.', sanitize_text_field($value));
        return is_numeric($sanitized) ? floatval($sanitized) : '';
    }
    
    /**
     * Prepara dados de rastreio para salvar no pedido
     * 
     * @param array $tracking_data Dados brutos do rastreio
     * @param WC_Order $order Objeto do pedido
     */
    public static function save_tracking_data($tracking_data, $order) {
        if (empty($tracking_data)) {
            return;
        }
        
        if (isset($tracking_data['link'])) {
            $order->update_meta_data('_packing_panel_tracking_link', sanitize_text_field($tracking_data['link']));
        }
        
        if (isset($tracking_data['deadline'])) {
            $order->update_meta_data('_packing_panel_delivery_deadline', sanitize_text_field($tracking_data['deadline']));
        }
        
        if (isset($tracking_data['cost'])) {
            $formatted_cost = self::format_shipping_cost($tracking_data['cost']);
            $order->update_meta_data('_packing_panel_shipping_paid_cost', $formatted_cost);
        }
        
        if (isset($tracking_data['finalization_code'])) {
            $order->update_meta_data('_packing_panel_finalization_code', absint($tracking_data['finalization_code']));
        }
        
        if (isset($tracking_data['motoboy_whatsapp'])) {
            $sanitized_whatsapp = self::sanitize_phone($tracking_data['motoboy_whatsapp']);
            $order->update_meta_data('_packing_panel_motoboy_whatsapp', $sanitized_whatsapp);
        }
    }
    
    /**
     * Prepara payload de itens do pedido para webhook
     * 
     * @param WC_Order $order Objeto do pedido
     * @return array Array de itens formatados
     */
    public static function prepare_order_items_payload($order) {
        return array_map(function($item) {
            $product = $item->get_product();
            return array(
                'product_id' => $item->get_product_id(),
                'variation_id' => $item->get_variation_id(),
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => wc_format_decimal($item->get_total(), 2),
                'sku' => $product ? $product->get_sku() : '',
                'image_url' => $product && $product->get_image_id() 
                    ? wp_get_attachment_image_url($product->get_image_id(), 'thumbnail') 
                    : wc_placeholder_img_url(),
            );
        }, $order->get_items());
    }
}


