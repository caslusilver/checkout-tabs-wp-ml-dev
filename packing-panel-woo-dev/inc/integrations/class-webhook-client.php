<?php
/**
 * Classe client para integração com webhooks externos
 * 
 * Faz requisições GET/POST JSON para buscar pedidos externos
 */
if (!defined('ABSPATH')) exit;

class PPWOO_WebhookClient {
    
    /**
     * Obtém a URL do webhook externo configurada
     * 
     * @return string
     */
    private static function get_external_webhook_url() {
        $url = get_option('ppwoo_external_webhook_url', '');
        return apply_filters('ppwoo_external_webhook_client_url', $url);
    }
    
    /**
     * Obtém o método HTTP configurado (get ou post)
     * 
     * @return string
     */
    private static function get_external_webhook_method() {
        $method = get_option('ppwoo_external_webhook_method', 'get');
        return in_array($method, ['get', 'post'], true) ? $method : 'get';
    }
    
    /**
     * Verifica se autenticação está habilitada
     * 
     * @return bool
     */
    private static function is_auth_enabled() {
        return get_option('ppwoo_external_webhook_auth_enabled', 'no') === 'yes';
    }
    
    /**
     * Obtém o Bearer Token (sanitizado)
     * 
     * @return string
     */
    private static function get_bearer_token() {
        $token = get_option('ppwoo_external_webhook_bearer_token', '');
        return sanitize_text_field($token);
    }
    
    /**
     * Faz requisição GET ou POST para o webhook externo e retorna JSON
     * 
     * @param array $params Parâmetros para a requisição
     * @return array|WP_Error Dados retornados ou erro
     */
    public static function fetch($params = array()) {
        $webhook_url = self::get_external_webhook_url();
        
        if (empty($webhook_url) || strpos($webhook_url, 'YOUR_') !== false) {
            PPWOO_Debug::warn('URL do webhook externo não configurada');
            return new WP_Error('no_webhook_url', __('URL do webhook externo não configurada.', 'painel-empacotamento'));
        }
        
        $method = self::get_external_webhook_method();
        $auth_enabled = self::is_auth_enabled();
        $bearer_token = $auth_enabled ? self::get_bearer_token() : '';
        
        $start_time = microtime(true);
        
        // Prepara headers
        $headers = array();
        if ($method === 'post') {
            $headers['Content-Type'] = 'application/json';
        }
        if ($auth_enabled && !empty($bearer_token)) {
            $headers['Authorization'] = 'Bearer ' . $bearer_token;
        }
        
        // Prepara URL e body conforme método
        $request_url = $webhook_url;
        $request_body = null;
        
        if ($method === 'get') {
            // GET: adiciona parâmetros na URL
            if (!empty($params)) {
                $request_url = add_query_arg($params, $webhook_url);
            }
        } else {
            // POST: envia JSON no body
            $request_body = wp_json_encode($params);
        }
        
        // Log da requisição (sem token)
        $log_url = $request_url;
        $log_payload = $params;
        if ($auth_enabled && !empty($bearer_token)) {
            // Remove token dos logs
            $log_payload = $params;
        }
        
        PPWOO_Debug::info('Fazendo requisição ' . strtoupper($method) . ' para webhook externo', [
            'method' => $method,
            'url' => $log_url,
            'payload' => $log_payload,
            'auth_enabled' => $auth_enabled,
        ]);
        
        // Faz a requisição
        if ($method === 'post') {
            $response = wp_remote_post($request_url, [
                'headers' => $headers,
                'body' => $request_body,
                'timeout' => 15,
                'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
            ]);
        } else {
            $response = wp_remote_get($request_url, [
                'headers' => $headers,
                'timeout' => 15,
                'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
            ]);
        }
        
        $elapsed_ms = (microtime(true) - $start_time) * 1000;
        
        if (is_wp_error($response)) {
            PPWOO_Debug::error('Erro na requisição ' . strtoupper($method) . ' do webhook externo', [
                'error' => $response->get_error_message(),
                'elapsed' => number_format($elapsed_ms, 2) . 'ms',
            ]);
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $body_preview = mb_substr($body, 0, 200);
        
        PPWOO_Debug::info('Resposta do webhook externo recebida', [
            'method' => $method,
            'status' => $status_code,
            'elapsed' => number_format($elapsed_ms, 2) . 'ms',
            'body_preview' => $body_preview,
        ]);
        
        if ($status_code < 200 || $status_code >= 300) {
            PPWOO_Debug::warn('Webhook externo retornou status não sucesso', [
                'status' => $status_code,
                'body_preview' => $body_preview,
            ]);
            return new WP_Error('webhook_error', sprintf(__('Webhook externo retornou status %d', 'painel-empacotamento'), $status_code), $status_code);
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            PPWOO_Debug::error('Erro ao decodificar JSON do webhook externo', [
                'json_error' => json_last_error_msg(),
                'body_preview' => $body_preview,
            ]);
            return new WP_Error('json_decode_error', __('Erro ao decodificar resposta JSON.', 'painel-empacotamento'), json_last_error());
        }
        
        PPWOO_Debug::info('Dados do webhook externo decodificados com sucesso', [
            'data_keys' => is_array($data) ? array_keys($data) : 'not_array',
        ]);
        
        return $data;
    }
    
    /**
     * Busca pedidos externos do webhook
     * 
     * @return array|WP_Error Array de pedidos normalizados ou erro
     */
    public static function fetch_external_orders() {
        $params = array(
            'action' => 'get_orders',
            'channel' => 'whatsapp',
        );
        
        $data = self::fetch($params);
        
        if (is_wp_error($data)) {
            return $data;
        }
        
        // Extrai array de pedidos
        $orders_raw = array();
        if (isset($data['orders']) && is_array($data['orders'])) {
            $orders_raw = $data['orders'];
        } elseif (is_array($data) && isset($data[0])) {
            $orders_raw = $data;
        } else {
            PPWOO_Debug::warn('Formato de dados do webhook externo não reconhecido', [
                'data_structure' => is_array($data) ? array_keys($data) : gettype($data),
            ]);
            return array();
        }
        
        // Normaliza cada pedido
        $orders_normalized = array();
        foreach ($orders_raw as $index => $order_raw) {
            $normalized = self::normalize_external_order($order_raw, $index);
            if ($normalized !== null) {
                $orders_normalized[] = $normalized;
            }
        }
        
        PPWOO_Debug::info('Pedidos externos normalizados', [
            'total_recebidos' => count($orders_raw),
            'total_normalizados' => count($orders_normalized),
        ]);
        
        return $orders_normalized;
    }
    
    /**
     * Normaliza um pedido externo para o formato esperado pelo painel
     * 
     * @param array $order_raw Pedido bruto do webhook
     * @param int $index Índice do pedido (para logs)
     * @return array|null Pedido normalizado ou null se inválido
     */
    private static function normalize_external_order($order_raw, $index = 0) {
        if (!is_array($order_raw)) {
            PPWOO_Debug::warn('Pedido externo não é array', ['index' => $index, 'type' => gettype($order_raw)]);
            return null;
        }
        
        $normalized = array();
        
        // ID do pedido
        $normalized['id'] = isset($order_raw['id']) ? intval($order_raw['id']) : (isset($order_raw['order_id']) ? intval($order_raw['order_id']) : 0);
        if (empty($normalized['id'])) {
            PPWOO_Debug::warn('Pedido externo sem ID válido', ['index' => $index, 'order_raw' => array_keys($order_raw)]);
            return null;
        }
        
        // Status
        $normalized['status'] = isset($order_raw['status']) ? sanitize_text_field($order_raw['status']) : 'on-hold';
        
        // Totais
        $normalized['total'] = isset($order_raw['total']) ? floatval($order_raw['total']) : 0.0;
        $normalized['shipping_total'] = isset($order_raw['shipping_total']) ? floatval($order_raw['shipping_total']) : 0.0;
        
        // Billing (suporta billing.* e billing_*)
        $billing = array();
        if (isset($order_raw['billing']) && is_array($order_raw['billing'])) {
            $billing = $order_raw['billing'];
        } else {
            // Tenta campos diretos billing_*
            foreach (['first_name', 'last_name', 'address_1', 'city', 'state', 'postcode', 'number', 'neighborhood', 'complement', 'cellphone', 'cpf'] as $field) {
                $key = 'billing_' . $field;
                if (isset($order_raw[$key])) {
                    $billing[$field] = $order_raw[$key];
                }
            }
        }
        
        $normalized['billing'] = array(
            'first_name' => isset($billing['first_name']) ? sanitize_text_field($billing['first_name']) : '',
            'last_name' => isset($billing['last_name']) ? sanitize_text_field($billing['last_name']) : '',
            'address_1' => isset($billing['address_1']) ? sanitize_text_field($billing['address_1']) : '',
            'city' => isset($billing['city']) ? sanitize_text_field($billing['city']) : '',
            'state' => isset($billing['state']) ? sanitize_text_field($billing['state']) : '',
            'postcode' => isset($billing['postcode']) ? sanitize_text_field($billing['postcode']) : '',
            'number' => isset($billing['number']) ? sanitize_text_field($billing['number']) : '',
            'neighborhood' => isset($billing['neighborhood']) ? sanitize_text_field($billing['neighborhood']) : '',
            'complement' => isset($billing['complement']) ? sanitize_text_field($billing['complement']) : '',
            'cellphone' => isset($billing['cellphone']) ? sanitize_text_field($billing['cellphone']) : '',
            'cpf' => isset($billing['cpf']) ? sanitize_text_field($billing['cpf']) : '',
        );
        
        // Shipping
        $shipping = array();
        if (isset($order_raw['shipping']) && is_array($order_raw['shipping'])) {
            $shipping = $order_raw['shipping'];
        }
        $normalized['shipping'] = array(
            'address_1' => isset($shipping['address_1']) ? sanitize_text_field($shipping['address_1']) : '',
            'city' => isset($shipping['city']) ? sanitize_text_field($shipping['city']) : '',
            'state' => isset($shipping['state']) ? sanitize_text_field($shipping['state']) : '',
            'postcode' => isset($shipping['postcode']) ? sanitize_text_field($shipping['postcode']) : '',
        );
        
        // Shipping methods
        $normalized['shipping_methods'] = array();
        if (isset($order_raw['shipping_methods']) && is_array($order_raw['shipping_methods'])) {
            foreach ($order_raw['shipping_methods'] as $method) {
                if (is_array($method)) {
                    $normalized['shipping_methods'][] = array(
                        'method_id' => isset($method['method_id']) ? sanitize_text_field($method['method_id']) : '',
                        'method_title' => isset($method['method_title']) ? sanitize_text_field($method['method_title']) : '',
                        'total' => isset($method['total']) ? floatval($method['total']) : 0.0,
                    );
                }
            }
        }
        
        // Items
        $normalized['items'] = array();
        if (isset($order_raw['items']) && is_array($order_raw['items'])) {
            foreach ($order_raw['items'] as $item) {
                if (is_array($item)) {
                    $normalized['items'][] = array(
                        'product_id' => isset($item['product_id']) ? intval($item['product_id']) : 0,
                        'variation_id' => isset($item['variation_id']) ? intval($item['variation_id']) : 0,
                        'name' => isset($item['name']) ? sanitize_text_field($item['name']) : '',
                        'quantity' => isset($item['quantity']) ? intval($item['quantity']) : 0,
                        'total' => isset($item['total']) ? floatval($item['total']) : 0.0,
                        'sku' => isset($item['sku']) ? sanitize_text_field($item['sku']) : '',
                        'image_url' => isset($item['image_url']) ? esc_url_raw($item['image_url']) : '',
                    );
                }
            }
        }
        
        // Cupons
        $normalized['coupons'] = array();
        if (isset($order_raw['coupons']) && is_array($order_raw['coupons'])) {
            $normalized['coupons'] = array_map('sanitize_text_field', $order_raw['coupons']);
        }
        
        // Nota do cliente
        $normalized['customer_note'] = isset($order_raw['customer_note']) ? sanitize_textarea_field($order_raw['customer_note']) : (isset($order_raw['note']) ? sanitize_textarea_field($order_raw['note']) : '');
        
        // Channel/Source (para detecção WhatsApp)
        $normalized['channel'] = isset($order_raw['channel']) ? sanitize_text_field($order_raw['channel']) : (isset($order_raw['source']) ? sanitize_text_field($order_raw['source']) : '');
        
        // Meta campos do painel
        $normalized['workflow_step'] = isset($order_raw['workflow_step']) ? sanitize_text_field($order_raw['workflow_step']) : null;
        $normalized['tracking_link'] = isset($order_raw['tracking_link']) ? esc_url_raw($order_raw['tracking_link']) : '';
        $normalized['delivery_deadline'] = isset($order_raw['delivery_deadline']) ? sanitize_text_field($order_raw['delivery_deadline']) : '';
        $normalized['shipping_paid_cost'] = isset($order_raw['shipping_paid_cost']) ? floatval($order_raw['shipping_paid_cost']) : 0.0;
        $normalized['finalization_code'] = isset($order_raw['finalization_code']) ? intval($order_raw['finalization_code']) : null;
        $normalized['motoboy_whatsapp'] = isset($order_raw['motoboy_whatsapp']) ? sanitize_text_field($order_raw['motoboy_whatsapp']) : '';
        
        // Flag para identificar como pedido externo
        $normalized['_is_external'] = true;
        
        return $normalized;
    }
}
