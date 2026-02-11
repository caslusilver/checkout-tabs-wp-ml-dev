<?php
/**
 * Serviço de ações de pagamento manual via webhook.
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Payments_Action_Service {
    /**
     * Envia evento de pagamento (confirmado/negado).
     *
     * @param WC_Order $order
     * @param string $status CONFIRMED|OVERDUE
     * @return array|WP_Error
     */
    public static function send_payment_status($order, $status) {
        if (!$order instanceof WC_Order) {
            return new WP_Error('ppwoo_invalid_order', __('Pedido inválido.', 'painel-empacotamento'));
        }

        $status = strtoupper($status);
        $event = $status === 'CONFIRMED' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_OVERDUE';

        $webhook_url = get_option('ppwoo_payments_webhook_url', PPWOO_Config::get_payments_webhook_url());
        $webhook_url = trim((string) $webhook_url);
        if ($webhook_url === '') {
            return new WP_Error('ppwoo_payments_webhook_missing', __('URL do webhook de pagamento não configurada.', 'painel-empacotamento'));
        }

        $auth_key_name = get_option('ppwoo_payments_auth_key_name', PPWOO_Config::get_payments_auth_key_name());
        $auth_key_name = trim((string) $auth_key_name);
        if ($auth_key_name === '') {
            $auth_key_name = PPWOO_Config::get_payments_auth_key_name();
        }

        if (!function_exists('sakm_get_key')) {
            return new WP_Error('ppwoo_sakm_missing', __('Função sakm_get_key não disponível.', 'painel-empacotamento'));
        }

        $token = trim((string) sakm_get_key($auth_key_name));
        if ($token === '') {
            return new WP_Error('ppwoo_auth_key_empty', __('Authorization não encontrado ou vazio.', 'painel-empacotamento'));
        }

        $payment_id = PPWOO_Utils::get_payment_id_from_order($order);
        if ($payment_id === '') {
            return new WP_Error('ppwoo_payment_id_missing', __('ID da cobrança não encontrado no pedido.', 'painel-empacotamento'));
        }

        $payload = array(
            'event' => $event,
            'payment' => array(
                'id' => $payment_id,
                'status' => $status,
                'externalReference' => $order->get_id(),
            ),
        );

        // Chamada server-side para proteger o token.
        $response = wp_remote_post($webhook_url, array(
            'body' => wp_json_encode($payload),
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => $token,
            ),
            'timeout' => 20,
            'blocking' => true,
            'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($status_code >= 200 && $status_code < 300) {
            return array(
                'status_code' => $status_code,
                'body' => $body,
            );
        }

        return new WP_Error(
            'ppwoo_payments_webhook_error',
            sprintf(__('Webhook retornou status %d.', 'painel-empacotamento'), $status_code),
            array('status_code' => $status_code, 'body' => $body)
        );
    }
}
