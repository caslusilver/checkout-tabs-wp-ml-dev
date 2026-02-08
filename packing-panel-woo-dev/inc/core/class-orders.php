<?php
/**
 * Classe de gerenciamento de pedidos
 * 
 * Busca e filtra pedidos do WooCommerce
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Orders {
    
    /**
     * Busca pedidos do Motoboy (status 'processing' com método de envio 'Motoboy')
     * 
     * @return array Array de objetos WC_Order
     */
    public static function get_motoboy_orders() {
        $orders_raw = wc_get_orders(array(
            'status' => 'processing',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        $motoboy_orders = array();
        foreach ($orders_raw as $order) {
            $shipping_methods = $order->get_shipping_methods();
            if (!empty($shipping_methods)) {
                $first_method = reset($shipping_methods);
                if (stripos($first_method->get_method_title(), 'motoboy') !== false) {
                    $motoboy_orders[] = $order;
                }
            }
        }
        
        return $motoboy_orders;
    }
    
    /**
     * Busca pedidos dos Correios (status 'on-hold' sem método 'Motoboy')
     * 
     * @return array Array de objetos WC_Order
     */
    public static function get_correios_orders() {
        $orders_raw = wc_get_orders(array(
            'status' => 'on-hold',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        $correios_orders = array();
        foreach ($orders_raw as $order) {
            $shipping_methods = $order->get_shipping_methods();
            if (empty($shipping_methods) || stripos(reset($shipping_methods)->get_method_title(), 'motoboy') === false) {
                $correios_orders[] = $order;
            }
        }
        
        return $correios_orders;
    }
    
    /**
     * Conta total de pedidos pendentes
     * 
     * @return int Total de pedidos pendentes
     */
    public static function get_total_pending_orders() {
        $motoboy = count(self::get_motoboy_orders());
        $correios = count(self::get_correios_orders());
        return $motoboy + $correios;
    }
}


