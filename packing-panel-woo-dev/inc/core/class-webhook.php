<?php
/**
 * Classe de integração com webhooks externos
 * 
 * Envia eventos para webhooks externos (N8N)
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Webhook {
    
    /**
     * Envia webhook externo
     * 
     * @param string $event_name Nome do evento
     * @param WC_Order $order Objeto do pedido
     * @return void
     */
    public static function send($event_name, $order) {
        $webhook_url = PPWOO_Config::get_webhook_url();
        
        if (empty($webhook_url) || strpos($webhook_url, 'YOUR_') !== false) {
            error_log('Packing Panel Webhook Error (' . $event_name . '): URL do Webhook não configurada.');
            return;
        }
        
        $payload = self::payload($event_name, $order, current_time('timestamp'));
        
        // Envia requisição
        $remote_response = wp_remote_post($webhook_url, array(
            'body' => wp_json_encode($payload),
            'headers' => array('Content-Type' => 'application/json'),
            'timeout' => 15,
            'blocking' => true,
            'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
        ));
        
        // Log do resultado
        self::log_webhook_response($event_name, $order->get_id(), $remote_response);
    }

    private static function payload(string $event_name, WC_Order $order, int $timestamp): array {
        return [
            'order_id' => $order->get_id(),
            'webhook_event' => $event_name,
            'timestamp' => $timestamp,
            'order_data' => self::prepare_order_payload($order),
            'event_data' => self::prepare_event_payload($order),
        ];
    }

    public static function send_route_dispatch(WC_Order $order, string $key, string $departed_at): array {
        $url = PPWOO_Config::get_webhook_url();
        if (wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($url)) {
            return ['state' => 'failed', 'code' => 'webhook_setup'];
        }
        $departure = new DateTimeImmutable($departed_at);
        $timestamp = $departure->getTimestamp() + wp_timezone()->getOffset($departure);
        $response = wp_safe_remote_post($url, [
            'body' => wp_json_encode(self::payload('mtb_packing_panel_shipped', $order, $timestamp), JSON_THROW_ON_ERROR),
            'headers' => ['Content-Type' => 'application/json', 'Idempotency-Key' => $key],
            'timeout' => 20, 'redirection' => 0, 'limit_response_size' => 65536,
        ]);
        if (is_wp_error($response)) return ['state' => 'uncertain', 'code' => 'connection'];
        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true, 8);
        if (is_array($body) && ($body['accepted'] ?? null) === false) {
            return ['state' => 'failed', 'code' => 'rejected'];
        }
        if ($status >= 200 && $status < 300) {
            return ['state' => 'accepted', 'code' => 'http_' . $status];
        }
        return ['state' => 'uncertain', 'code' => 'http_' . $status];
    }
    
    /**
     * Prepara payload do pedido
     * 
     * @param WC_Order $order Objeto do pedido
     * @return array
     */
    private static function prepare_order_payload($order) {
        $items_payload = PPWOO_Utils::prepare_order_items_payload($order);
        
        $payload = array(
            'status' => $order->get_status(),
            'total' => wc_format_decimal($order->get_total(), 2),
            'shipping_total' => wc_format_decimal($order->get_shipping_total(), 2),
            'billing' => $order->get_address('billing'),
            'shipping' => $order->get_address('shipping'),
            'meta' => array(
                'billing_cpf' => PPWOO_Utils::get_order_billing_cpf($order),
                '_billing_number' => $order->get_meta('_billing_number'),
                '_billing_neighborhood' => $order->get_meta('_billing_neighborhood'),
                '_billing_cellphone' => $order->get_meta('_billing_cellphone'),
                '_billing_complemento' => $order->get_meta('_billing_complemento'),
                '_customer_note' => $order->get_customer_note(),
                '_packing_panel_tracking_link' => $order->get_meta('_packing_panel_tracking_link'),
                '_packing_panel_delivery_deadline' => $order->get_meta('_packing_panel_delivery_deadline'),
                '_packing_panel_shipping_paid_cost' => $order->get_meta('_packing_panel_shipping_paid_cost'),
                '_packing_panel_finalization_code' => $order->get_meta('_packing_panel_finalization_code'),
                '_packing_panel_motoboy_whatsapp' => $order->get_meta('_packing_panel_motoboy_whatsapp'),
            ),
            'items' => $items_payload,
            'coupons' => $order->get_coupon_codes(),
        );
        $dial_code = (string) $order->get_meta('_ctwpml_dial_code');
        if ($dial_code !== '') {
            $payload['dial_code'] = $dial_code;
        }
        return $payload;
    }
    
    /**
     * Prepara dados do evento para o payload
     * 
     * @param WC_Order $order Objeto do pedido
     * @return array
     */
    private static function prepare_event_payload($order) {
        $payload = array(
            'tracking_data' => array(
                'link' => $order->get_meta('_packing_panel_tracking_link'),
                'deadline' => $order->get_meta('_packing_panel_delivery_deadline'),
                'cost' => $order->get_meta('_packing_panel_shipping_paid_cost'),
                'finalization_code' => $order->get_meta('_packing_panel_finalization_code'),
                'motoboy_whatsapp' => $order->get_meta('_packing_panel_motoboy_whatsapp'),
            ),
        );
        if (class_exists('PPWOO_Order_Tracking') && PPWOO_Routes_Store::ready()) {
            $stop = PPWOO_Routes_Store::stop($order->get_id());
            $route = $stop ? PPWOO_Routes_Store::route($stop['route_id']) : null;
            $link = $route && $route['state'] !== 'draft' ? PPWOO_Order_Tracking::link($route, $stop) : PPWOO_Order_Tracking::order_link($order);
            if ($link !== '') $payload['tracking_data']['order_tracking_url'] = $link;
        }
        return $payload;
    }
    
    /**
     * Loga resposta do webhook
     * 
     * @param string $event_name Nome do evento
     * @param int $order_id ID do pedido
     * @param array|WP_Error $response Resposta do wp_remote_post
     */
    private static function log_webhook_response($event_name, $order_id, $response) {
        if (is_wp_error($response)) {
            error_log('Packing Panel Webhook Error (' . $event_name . ') para Pedido #' . $order_id . ': ' . $response->get_error_message());
        } else {
            $status_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            if ($status_code >= 200 && $status_code < 300) {
                error_log('Packing Panel Webhook Success (' . $event_name . ') para Pedido #' . $order_id . '. Status: ' . $status_code);
            } else {
                error_log('Packing Panel Webhook Warning (' . $event_name . ') para Pedido #' . $order_id . ' - Status ' . $status_code . ': ' . $body);
            }
        }
    }
}
