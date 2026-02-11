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

        $payment_id = PPWOO_Utils::get_payment_id_from_order($order);
        if (empty($payment_id)) {
            return new WP_Error('missing_payment_id', 'Payment ID não encontrado no pedido.');
        }

        $normalized_status = $status === 'confirm' ? 'CONFIRMED' : 'OVERDUE';
        $event_name = $status === 'confirm' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_OVERDUE';

        $payload = array(
            'event' => $event_name,
            'payment' => array(
                'id' => $payment_id,
                'status' => $normalized_status,
            ),
            'order' => array(
                'id' => $order->get_id(),
                'order_key' => $order->get_order_key(),
                'total' => $order->get_total(),
            ),
        );

        $pix_identifier = PPWOO_Utils::get_pix_identifier($order);
        if (!empty($pix_identifier)) {
            $payload['payment']['pix_identifier'] = $pix_identifier;
        }

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
