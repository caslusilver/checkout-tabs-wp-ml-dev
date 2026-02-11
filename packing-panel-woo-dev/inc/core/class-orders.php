<?php
/**
 * Classe de gerenciamento de pedidos
 * 
 * Busca e filtra pedidos do WooCommerce e pedidos externos
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Orders {
    
    /**
     * Busca pedidos externos do webhook (se configurado)
     * 
     * @return array Array de pedidos normalizados
     */
    private static function get_external_orders() {
        $external_url = get_option('ppwoo_external_webhook_url', '');
        
        if (empty($external_url)) {
            return array();
        }
        
        PPWOO_Debug::info('Buscando pedidos externos do webhook');
        
        $external_orders = PPWOO_WebhookClient::fetch_external_orders();
        
        if (is_wp_error($external_orders)) {
            PPWOO_Debug::error('Erro ao buscar pedidos externos', ['error' => $external_orders->get_error_message()]);
            return array();
        }
        
        PPWOO_Debug::info('Pedidos externos obtidos', ['count' => count($external_orders)]);
        
        return $external_orders;
    }
    
    /**
     * Classifica um pedido (WooCommerce ou externo) em Motoboy ou Correios
     * 
     * @param WC_Order|array $order Pedido WooCommerce ou array normalizado
     * @return string|null 'motoboy', 'correios' ou null se não classificar
     */
    private static function classify_order($order) {
        $status = '';
        $shipping_method_title = '';
        
        if ($order instanceof WC_Order) {
            $status = $order->get_status();
            $shipping_methods = $order->get_shipping_methods();
            if (!empty($shipping_methods)) {
                $first_method = reset($shipping_methods);
                $shipping_method_title = $first_method->get_method_title();
            }
        } elseif (is_array($order) && isset($order['_is_external'])) {
            $status = isset($order['status']) ? $order['status'] : '';
            if (!empty($order['shipping_methods']) && is_array($order['shipping_methods'])) {
                $first_method = reset($order['shipping_methods']);
                $shipping_method_title = isset($first_method['method_title']) ? $first_method['method_title'] : '';
            }
        }
        
        // Motoboy: status 'processing' + method_title contém 'motoboy'
        if ($status === 'processing' && stripos($shipping_method_title, 'motoboy') !== false) {
            return 'motoboy';
        }
        
        // Correios: status 'on-hold' + (sem método OU method_title não contém 'motoboy')
        if ($status === 'on-hold') {
            if (empty($shipping_method_title) || stripos($shipping_method_title, 'motoboy') === false) {
                return 'correios';
            }
        }
        
        return null;
    }
    
    /**
     * Busca pedidos do Motoboy (status 'processing' com método de envio 'Motoboy')
     * Inclui pedidos WooCommerce e pedidos externos
     * 
     * @return array Array de objetos WC_Order e arrays normalizados
     */
    public static function get_motoboy_orders() {
        $motoboy_orders = array();
        
        // Busca pedidos WooCommerce
        $orders_raw = wc_get_orders(array(
            'status' => 'processing',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        foreach ($orders_raw as $order) {
            $shipping_methods = $order->get_shipping_methods();
            if (!empty($shipping_methods)) {
                $first_method = reset($shipping_methods);
                if (stripos($first_method->get_method_title(), 'motoboy') !== false) {
                    $motoboy_orders[] = $order;
                }
            }
        }
        
        // Busca e mescla pedidos externos
        $external_orders = self::get_external_orders();
        foreach ($external_orders as $external_order) {
            if (self::classify_order($external_order) === 'motoboy') {
                $motoboy_orders[] = $external_order;
            }
        }
        
        PPWOO_Debug::info('Pedidos Motoboy obtidos', [
            'woocommerce' => count($orders_raw),
            'externos' => count($external_orders),
            'total_motoboy' => count($motoboy_orders),
        ]);
        
        return $motoboy_orders;
    }
    
    /**
     * Busca pedidos dos Correios (status 'on-hold' sem método 'Motoboy')
     * Inclui pedidos WooCommerce e pedidos externos
     * 
     * @return array Array de objetos WC_Order e arrays normalizados
     */
    public static function get_correios_orders() {
        $correios_orders = array();
        
        // Busca pedidos WooCommerce
        $orders_raw = wc_get_orders(array(
            'status' => 'on-hold',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        foreach ($orders_raw as $order) {
            $shipping_methods = $order->get_shipping_methods();
            if (empty($shipping_methods) || stripos(reset($shipping_methods)->get_method_title(), 'motoboy') === false) {
                $correios_orders[] = $order;
            }
        }
        
        // Busca e mescla pedidos externos
        $external_orders = self::get_external_orders();
        foreach ($external_orders as $external_order) {
            if (self::classify_order($external_order) === 'correios') {
                $correios_orders[] = $external_order;
            }
        }
        
        PPWOO_Debug::info('Pedidos Correios obtidos', [
            'woocommerce' => count($orders_raw),
            'externos' => count($external_orders),
            'total_correios' => count($correios_orders),
        ]);
        
        return $correios_orders;
    }

    /**
     * Busca pedidos com pagamento pendente (status 'pending')
     *
     * @return array Array de objetos WC_Order
     */
    public static function get_pending_payment_orders() {
        $orders_raw = wc_get_orders(array(
            'status' => 'pending',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));

        PPWOO_Debug::info('Pedidos de pagamento pendente obtidos', [
            'woocommerce' => count($orders_raw),
        ]);

        return $orders_raw;
    }
    
    /**
     * Conta total de pedidos pendentes
     * 
     * @return int Total de pedidos pendentes
     */
    public static function get_total_pending_orders() {
        $motoboy = count(self::get_motoboy_orders());
        $correios = count(self::get_correios_orders());
        $payments = count(self::get_pending_payment_orders());
        return $motoboy + $correios + $payments;
    }
}
