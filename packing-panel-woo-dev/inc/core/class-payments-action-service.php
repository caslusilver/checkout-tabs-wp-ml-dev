<?php
/**
 * Service para ações manuais de pagamento (confirmar/negar)
 *
 * As chamadas são server-side para proteger a chave de autenticação.
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Payments_Action_Service {
    /**
     * Envia atualização de status de pagamento via webhook
     *
     * @param WC_Order $order
     * @param string   $status confirm|deny
     * @return true|WP_Error
     */
    public static function send_payment_status($order, $status) {
        if (!$order instanceof WC_Order) {
            return new WP_Error('invalid_order', 'Pedido inválido.');
        }

        $webhook_url = get_option(
            'ppwoo_payments_webhook_url',
            PPWOO_Config::get_payments_webhook_url()
        );
        $auth_key_name = get_option(
            'ppwoo_payments_auth_key_name',
            PPWOO_Config::get_payments_auth_key_name()
        );

        if (empty($webhook_url)) {
            return new WP_Error('missing_webhook_url', 'URL do webhook de pagamentos não configurada.');
        }

        if (!function_exists('sakm_get_key')) {
            return new WP_Error('missing_sakm_get_key', 'Função sakm_get_key não encontrada.');
        }

        $auth_key = sakm_get_key((string) $auth_key_name);
        if (empty($auth_key)) {
            return new WP_Error('missing_auth_key', 'Chave de autenticação não encontrada.');
        }

        $normalized_status = $status === 'confirm' ? 'CONFIRMED' : 'OVERDUE';
        $event_name = $status === 'confirm'
            ? 'PACKPANEL_PAYMENT_CONFIRMED'
            : 'PACKPANEL_PAYMENT_DENIED';

        $created = $order->get_date_created();
        $created_iso = $created ? $created->date('c') : '';
        $client_name = trim(
            PPWOO_Utils::get_billing_first_name($order) . ' ' . PPWOO_Utils::get_billing_last_name($order)
        );
        $pix_identifier = PPWOO_Utils::get_pix_identifier($order);

        $payload = array(
            'event' => $event_name,
            'order' => array(
                'id' => $order->get_id(),
                'order_key' => $order->get_order_key(),
                'total' => $order->get_total(),
                'shipping_total' => $order->get_shipping_total(),
                'created_at' => $created_iso,
            ),
            'customer' => array(
                'name' => $client_name,
            ),
            'payment' => array(
                'status' => $normalized_status,
                'pix_identifier' => $pix_identifier,
            ),
        );

        $response = wp_remote_post($webhook_url, array(
            'headers' => array(
                'Authorization' => $auth_key,
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode($payload),
            'timeout' => 15,
            'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code < 200 || $status_code >= 300) {
            return new WP_Error(
                'webhook_error',
                'Webhook retornou erro: ' . $status_code,
                array('status' => $status_code)
            );
        }

        return true;
    }
}
