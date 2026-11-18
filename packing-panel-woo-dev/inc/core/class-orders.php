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
        if ($order instanceof WC_Order) {
            $status = $order->get_status();
        } elseif (is_array($order) && isset($order['_is_external'])) {
            $status = isset($order['status']) ? $order['status'] : '';
        }
        $is_motoboy = PPWOO_Utils::is_motoboy_shipping($order);
        if ($status === 'processing' && $is_motoboy) {
            return 'motoboy';
        }
        if ($status === 'on-hold' && !$is_motoboy) {
            return 'correios';
        }
        
        return null;
    }
    
    /**
     * Busca pedidos do Motoboy (status 'processing' com método de envio 'Motoboy')
     * Inclui pedidos WooCommerce e pedidos externos
     * 
     * @return array Array de objetos WC_Order e arrays normalizados
     */
    public static function get_motoboy_orders($external_orders = null) {
        $motoboy_orders = array();
        
        // Busca pedidos WooCommerce
        $orders_raw = wc_get_orders(array(
            'status' => 'processing',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        $routed = PPWOO_Routes::enabled() ? PPWOO_Routes_Store::listed_order_ids(array_map(static function ($order) {
            return $order->get_id();
        }, $orders_raw)) : [];
        foreach ($orders_raw as $order) {
            if (!isset($routed[$order->get_id()]) && PPWOO_Utils::is_motoboy_shipping($order)) {
                $motoboy_orders[] = $order;
            }
        }
        
        // Busca e mescla pedidos externos
        if ($external_orders === null) {
            $external_orders = self::get_external_orders();
        }
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
    public static function get_correios_orders($external_orders = null) {
        $correios_orders = array();
        
        // Busca pedidos WooCommerce
        $orders_raw = wc_get_orders(array(
            'status' => 'on-hold',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));
        
        foreach ($orders_raw as $order) {
            if (!PPWOO_Utils::is_motoboy_shipping($order)) {
                $correios_orders[] = $order;
            }
        }
        
        // Busca e mescla pedidos externos
        if ($external_orders === null) {
            $external_orders = self::get_external_orders();
        }
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
     * Obtém todos os dados exibidos no painel usando uma única consulta ao
     * webhook externo por renderização/polling.
     *
     * @return array Dados normalizados para o template do painel.
     */
    public static function get_panel_data() {
        $external_orders = self::get_external_orders();
        $motoboy_orders = self::get_motoboy_orders($external_orders);
        $correios_orders = self::get_correios_orders($external_orders);
        $pending_payment_orders = self::get_pending_payment_orders();

        return array(
            'motoboy_orders' => $motoboy_orders,
            'correios_orders' => $correios_orders,
            'pending_payment_orders' => $pending_payment_orders,
            'total_pending_orders' => count($motoboy_orders) + count($correios_orders) + count($pending_payment_orders),
        );
    }
    
    /**
     * Conta total de pedidos pendentes
     * 
     * @return int Total de pedidos pendentes
     */
    public static function get_total_pending_orders() {
        $motoboy = count(self::get_motoboy_orders());
        $correios = count(self::get_correios_orders());
        $pagamentos = count(self::get_pending_payment_orders());
        return $motoboy + $correios + $pagamentos;
    }

    /**
     * Busca pedidos WooCommerce com status pending (pagamentos pendentes)
     *
     * @return WC_Order[] Lista de pedidos pendentes
     */
    public static function get_pending_payment_orders() {
        $orders = wc_get_orders(array(
            'status' => 'pending',
            'limit' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ));

        PPWOO_Debug::info('Pedidos de pagamento pendente obtidos', [
            'woocommerce' => count($orders),
        ]);

        return $orders;
    }
}
