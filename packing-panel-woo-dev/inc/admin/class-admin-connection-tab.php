<?php
/**
 * Classe para renderizar e processar a aba Conexão
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Admin_Connection_Tab {
    
    /**
     * Nome da option que armazena a URL do webhook
     */
    const OPTION_NAME = 'ppwoo_webhook_url';
    
    /**
     * Nomes das options para webhook externo
     */
    const OPTION_EXTERNAL_URL = 'ppwoo_external_webhook_url';
    const OPTION_EXTERNAL_METHOD = 'ppwoo_external_webhook_method';
    const OPTION_EXTERNAL_AUTH_ENABLED = 'ppwoo_external_webhook_auth_enabled';
    const OPTION_EXTERNAL_BEARER_TOKEN = 'ppwoo_external_webhook_bearer_token';

    /**
     * Options para pagamentos manuais (webhook)
     */
    const OPTION_PAYMENTS_WEBHOOK_URL = 'ppwoo_payments_webhook_url';
    const OPTION_PAYMENTS_AUTH_KEY_NAME = 'ppwoo_payments_auth_key_name';
    
    /**
     * Renderiza o formulário da aba Conexão
     */
    public static function render() {
        // Processa o formulário se foi submetido
        if (isset($_POST['ppwoo_save_webhook']) && check_admin_referer('ppwoo_save_webhook', 'ppwoo_webhook_nonce')) {
            self::save_webhook_url();
            self::save_external_webhook_settings();
            self::save_payments_webhook_settings();
        }
        
        $webhook_url = get_option(self::OPTION_NAME, PPWOO_Config::get_webhook_url());
        
        // Opções do webhook externo
        $external_url = get_option(self::OPTION_EXTERNAL_URL, '');
        $external_method = get_option(self::OPTION_EXTERNAL_METHOD, 'get');
        $external_auth_enabled = get_option(self::OPTION_EXTERNAL_AUTH_ENABLED, 'no');
        $external_bearer_token_raw = get_option(self::OPTION_EXTERNAL_BEARER_TOKEN, '');
        $external_bearer_token_display = !empty($external_bearer_token_raw) ? '••••••••' : '';

        $payments_webhook_url = get_option(self::OPTION_PAYMENTS_WEBHOOK_URL, PPWOO_Config::get_payments_webhook_url());
        $payments_auth_key_name = get_option(self::OPTION_PAYMENTS_AUTH_KEY_NAME, PPWOO_Config::get_payments_auth_key_name());
        
        ?>
        <form method="post" action="">
            <?php wp_nonce_field('ppwoo_save_webhook', 'ppwoo_webhook_nonce'); ?>
            
            <h2><?php esc_html_e('Webhook de Eventos', 'painel-empacotamento'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="webhook_url"><?php esc_html_e('URL do Webhook', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="url" 
                               id="webhook_url" 
                               name="ppwoo_webhook_url" 
                               value="<?php echo esc_url($webhook_url); ?>" 
                               class="regular-text" 
                               placeholder="https://exemplo.com/webhook" />
                        <p class="description"><?php esc_html_e('URL do webhook para receber eventos do painel', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
            </table>
            
            <hr>
            
            <h2><?php esc_html_e('Pagamentos Manuais (Webhook)', 'painel-empacotamento'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="ppwoo_payments_webhook_url"><?php esc_html_e('URL do Webhook de Atualização', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="url"
                               id="ppwoo_payments_webhook_url"
                               name="ppwoo_payments_webhook_url"
                               value="<?php echo esc_url($payments_webhook_url); ?>"
                               class="regular-text"
                               placeholder="https://webhook.cubensisstore.com.br/webhook/invoices" />
                        <p class="description"><?php esc_html_e('Webhook usado para confirmar/negar pagamentos pendentes.', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="ppwoo_payments_auth_key_name"><?php esc_html_e('Auth key name', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text"
                               id="ppwoo_payments_auth_key_name"
                               name="ppwoo_payments_auth_key_name"
                               value="<?php echo esc_attr($payments_auth_key_name); ?>"
                               class="regular-text"
                               placeholder="authorization" />
                        <p class="description"><?php esc_html_e('Nome da variável para sakm_get_key (ex: authorization).', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
            </table>

            <hr>

            <h2><?php esc_html_e('Webhook Externo (Consulta de Pedidos)', 'painel-empacotamento'); ?></h2>
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="external_webhook_url"><?php esc_html_e('URL do Webhook Externo', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="url" 
                               id="external_webhook_url" 
                               name="ppwoo_external_webhook_url" 
                               value="<?php echo esc_url($external_url); ?>" 
                               class="regular-text" 
                               placeholder="https://exemplo.com/webhook-externo" />
                        <p class="description"><?php esc_html_e('URL do webhook externo para consultar pedidos (ex: WhatsApp)', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="external_webhook_method"><?php esc_html_e('Método HTTP', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <select id="external_webhook_method" name="ppwoo_external_webhook_method">
                            <option value="get" <?php selected($external_method, 'get'); ?>><?php esc_html_e('GET', 'painel-empacotamento'); ?></option>
                            <option value="post" <?php selected($external_method, 'post'); ?>><?php esc_html_e('POST', 'painel-empacotamento'); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e('Método HTTP para a requisição. POST envia JSON no body.', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="external_webhook_auth_enabled"><?php esc_html_e('Usar Autenticação', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <label>
                            <input type="checkbox" 
                                   id="external_webhook_auth_enabled" 
                                   name="ppwoo_external_webhook_auth_enabled" 
                                   value="yes" 
                                   <?php checked($external_auth_enabled, 'yes'); ?> />
                            <?php esc_html_e('Habilitar autenticação Bearer Token', 'painel-empacotamento'); ?>
                        </label>
                    </td>
                </tr>
                <tr id="external_webhook_bearer_row" style="<?php echo $external_auth_enabled !== 'yes' ? 'display: none;' : ''; ?>">
                    <th scope="row">
                        <label for="external_webhook_bearer_token"><?php esc_html_e('Bearer Token', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="password" 
                               id="external_webhook_bearer_token" 
                               name="ppwoo_external_webhook_bearer_token" 
                               value="<?php echo esc_attr($external_bearer_token_display); ?>" 
                               class="regular-text" 
                               placeholder="<?php esc_attr_e('Token de autenticação', 'painel-empacotamento'); ?>" />
                        <p class="description"><?php esc_html_e('Token Bearer para autenticação. Deixe em branco para manter o token atual.', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
            </table>
            
            <?php submit_button(__('Salvar Configurações', 'painel-empacotamento')); ?>
        </form>
        
        <hr>
        
        <h2><?php esc_html_e('Testar Webhook Externo', 'painel-empacotamento'); ?></h2>
        <p><?php esc_html_e('Clique no botão abaixo para testar a conexão com o webhook externo configurado.', 'painel-empacotamento'); ?></p>
        
        <button type="button" 
                id="ppwoo-test-external-webhook" 
                class="button button-secondary">
            <?php esc_html_e('Testar Webhook Externo', 'painel-empacotamento'); ?>
        </button>
        
        <div id="ppwoo-external-webhook-test-result" style="margin-top: 15px; display: none;"></div>
        
        <hr>
        
        <h2><?php esc_html_e('Testar Webhook', 'painel-empacotamento'); ?></h2>
        <p><?php esc_html_e('Clique no botão abaixo para testar a conexão com o webhook configurado.', 'painel-empacotamento'); ?></p>
        
        <button type="button" 
                id="ppwoo-test-webhook" 
                class="button button-secondary">
            <?php esc_html_e('Testar Webhook', 'painel-empacotamento'); ?>
        </button>
        
        <div id="ppwoo-webhook-test-result" style="margin-top: 15px; display: none;"></div>
        
        <?php
    }
    
    /**
     * Salva a URL do webhook
     */
    private static function save_webhook_url() {
        if (!isset($_POST['ppwoo_webhook_url'])) {
            return;
        }
        
        $url = esc_url_raw($_POST['ppwoo_webhook_url']);
        
        // Validação básica
        if (!empty($url) && !filter_var($url, FILTER_VALIDATE_URL)) {
            add_settings_error(
                'ppwoo_webhook',
                'ppwoo_webhook_invalid',
                __('URL do webhook inválida.', 'painel-empacotamento'),
                'error'
            );
            settings_errors('ppwoo_webhook');
            return;
        }
        
        $result = update_option(self::OPTION_NAME, $url);
        
        PPWOO_Debug::info('URL do webhook salva', ['url' => $url]);
        
        if ($result !== false) {
            add_settings_error(
                'ppwoo_webhook',
                'ppwoo_webhook_saved',
                __('URL do webhook salva com sucesso!', 'painel-empacotamento'),
                'success'
            );
        } else {
            add_settings_error(
                'ppwoo_webhook',
                'ppwoo_webhook_error',
                __('Erro ao salvar URL do webhook.', 'painel-empacotamento'),
                'error'
            );
        }
        
        settings_errors('ppwoo_webhook');
    }
    
    /**
     * Salva as configurações do webhook externo
     */
    private static function save_external_webhook_settings() {
        // URL externa
        if (isset($_POST['ppwoo_external_webhook_url'])) {
            $url = esc_url_raw($_POST['ppwoo_external_webhook_url']);
            
            if (!empty($url) && !filter_var($url, FILTER_VALIDATE_URL)) {
                add_settings_error(
                    'ppwoo_external_webhook',
                    'ppwoo_external_webhook_invalid',
                    __('URL do webhook externo inválida.', 'painel-empacotamento'),
                    'error'
                );
            } else {
                update_option(self::OPTION_EXTERNAL_URL, $url);
                PPWOO_Debug::info('URL do webhook externo salva', ['url' => $url]);
            }
        }
        
        // Método HTTP
        if (isset($_POST['ppwoo_external_webhook_method'])) {
            $method = sanitize_text_field($_POST['ppwoo_external_webhook_method']);
            if (in_array($method, ['get', 'post'], true)) {
                update_option(self::OPTION_EXTERNAL_METHOD, $method);
                PPWOO_Debug::info('Método do webhook externo salvo', ['method' => $method]);
            }
        }
        
        // Autenticação habilitada
        $auth_enabled = isset($_POST['ppwoo_external_webhook_auth_enabled']) && $_POST['ppwoo_external_webhook_auth_enabled'] === 'yes' ? 'yes' : 'no';
        update_option(self::OPTION_EXTERNAL_AUTH_ENABLED, $auth_enabled);
        
        // Bearer Token (só atualiza se fornecido e não for placeholder)
        if (isset($_POST['ppwoo_external_webhook_bearer_token'])) {
            $token = sanitize_text_field($_POST['ppwoo_external_webhook_bearer_token']);
            // Se não for o placeholder mascarado e não estiver vazio, salva o token
            if (!empty($token) && $token !== '••••••••') {
                update_option(self::OPTION_EXTERNAL_BEARER_TOKEN, $token);
                PPWOO_Debug::info('Bearer token do webhook externo salvo');
            }
            // Se estiver vazio e auth estiver desabilitada, limpa o token
            elseif (empty($token) && $auth_enabled === 'no') {
                delete_option(self::OPTION_EXTERNAL_BEARER_TOKEN);
            }
        }
        
        if (!get_settings_errors('ppwoo_external_webhook')) {
            add_settings_error(
                'ppwoo_external_webhook',
                'ppwoo_external_webhook_saved',
                __('Configurações do webhook externo salvas com sucesso!', 'painel-empacotamento'),
                'success'
            );
        }
        
        settings_errors('ppwoo_external_webhook');
    }

    /**
     * Salva configurações do webhook de pagamentos manuais
     */
    private static function save_payments_webhook_settings() {
        if (isset($_POST['ppwoo_payments_webhook_url'])) {
            $url = esc_url_raw($_POST['ppwoo_payments_webhook_url']);

            if (!empty($url) && !filter_var($url, FILTER_VALIDATE_URL)) {
                add_settings_error(
                    'ppwoo_payments_webhook',
                    'ppwoo_payments_webhook_invalid',
                    __('URL do webhook de pagamentos inválida.', 'painel-empacotamento'),
                    'error'
                );
            } else {
                update_option(self::OPTION_PAYMENTS_WEBHOOK_URL, $url);
                PPWOO_Debug::info('URL do webhook de pagamentos salva', ['url' => $url]);
            }
        }

        if (isset($_POST['ppwoo_payments_auth_key_name'])) {
            $auth_key_name = sanitize_text_field($_POST['ppwoo_payments_auth_key_name']);
            update_option(self::OPTION_PAYMENTS_AUTH_KEY_NAME, $auth_key_name);
            PPWOO_Debug::info('Auth key name salva', ['auth_key_name' => $auth_key_name]);
        }

        if (!get_settings_errors('ppwoo_payments_webhook')) {
            add_settings_error(
                'ppwoo_payments_webhook',
                'ppwoo_payments_webhook_saved',
                __('Configurações de pagamentos salvas com sucesso!', 'painel-empacotamento'),
                'success'
            );
        }

        settings_errors('ppwoo_payments_webhook');
    }
    
    /**
     * Handler AJAX para testar o webhook
     */
    public static function ajax_test_webhook() {
        check_ajax_referer('ppwoo_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Sem permissão.', 'painel-empacotamento')]);
        }
        
        $webhook_url = get_option(self::OPTION_NAME, '');
        
        if (empty($webhook_url)) {
            wp_send_json_error(['message' => __('URL do webhook não configurada.', 'painel-empacotamento')]);
        }
        
        $start_time = microtime(true);
        
        PPWOO_Debug::info('Testando webhook', ['url' => $webhook_url]);
        
        $response = wp_remote_get($webhook_url, [
            'timeout' => 15,
            'sslverify' => apply_filters('packing_panel_webhook_sslverify', !PPWOO_Config::is_debug()),
        ]);
        
        $elapsed = (microtime(true) - $start_time) * 1000;
        
        if (is_wp_error($response)) {
            PPWOO_Debug::error('Erro ao testar webhook', ['error' => $response->get_error_message()]);
            
            wp_send_json_error([
                'message' => __('Erro na conexão: ', 'painel-empacotamento') . $response->get_error_message(),
                'elapsed' => number_format($elapsed, 2) . 'ms',
            ]);
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $body_preview = mb_substr($body, 0, 200);
        
        PPWOO_Debug::info('Resposta do webhook', [
            'status' => $status_code,
            'elapsed' => $elapsed . 'ms',
            'body_preview' => $body_preview,
        ]);
        
        if ($status_code >= 200 && $status_code < 300) {
            wp_send_json_success([
                'message' => __('Webhook respondendo corretamente!', 'painel-empacotamento'),
                'status' => $status_code,
                'elapsed' => number_format($elapsed, 2) . 'ms',
                'body_preview' => $body_preview,
            ]);
        } else {
            wp_send_json_error([
                'message' => sprintf(__('Webhook retornou status %d', 'painel-empacotamento'), $status_code),
                'status' => $status_code,
                'elapsed' => number_format($elapsed, 2) . 'ms',
                'body_preview' => $body_preview,
            ]);
        }
    }
    
    /**
     * Handler AJAX para testar o webhook externo
     */
    public static function ajax_test_external_webhook() {
        check_ajax_referer('ppwoo_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Sem permissão.', 'painel-empacotamento')]);
        }
        
        $external_url = get_option(self::OPTION_EXTERNAL_URL, '');
        
        if (empty($external_url)) {
            wp_send_json_error(['message' => __('URL do webhook externo não configurada.', 'painel-empacotamento')]);
        }
        
        $method = get_option(self::OPTION_EXTERNAL_METHOD, 'get');
        $auth_enabled = get_option(self::OPTION_EXTERNAL_AUTH_ENABLED, 'no') === 'yes';
        $bearer_token = $auth_enabled ? get_option(self::OPTION_EXTERNAL_BEARER_TOKEN, '') : '';
        
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
        $request_url = $external_url;
        $request_body = null;
        $params = array('action' => 'get_orders', 'channel' => 'whatsapp');
        
        if ($method === 'get') {
            // GET: adiciona parâmetros na URL
            $request_url = add_query_arg($params, $external_url);
        } else {
            // POST: envia JSON no body
            $request_body = wp_json_encode($params);
        }
        
        PPWOO_Debug::info('Testando webhook externo', [
            'method' => $method,
            'url' => $request_url,
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
        
        $elapsed = (microtime(true) - $start_time) * 1000;
        
        if (is_wp_error($response)) {
            PPWOO_Debug::error('Erro ao testar webhook externo', ['error' => $response->get_error_message()]);
            
            wp_send_json_error([
                'message' => __('Erro na conexão: ', 'painel-empacotamento') . $response->get_error_message(),
                'elapsed_ms' => number_format($elapsed, 2),
            ]);
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $body_preview = mb_substr($body, 0, 200);
        
        // Tenta decodificar JSON para mostrar chaves
        $decoded_keys = array();
        $decoded_data = json_decode($body, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded_data)) {
            $decoded_keys = array_keys($decoded_data);
        }
        
        PPWOO_Debug::info('Resposta do webhook externo', [
            'status' => $status_code,
            'elapsed' => $elapsed . 'ms',
            'body_preview' => $body_preview,
            'decoded_keys' => $decoded_keys,
        ]);
        
        if ($status_code >= 200 && $status_code < 300) {
            wp_send_json_success([
                'message' => __('Webhook externo respondendo corretamente!', 'painel-empacotamento'),
                'status_code' => $status_code,
                'elapsed_ms' => number_format($elapsed, 2),
                'body_preview' => $body_preview,
                'decoded_keys' => $decoded_keys,
            ]);
        } else {
            wp_send_json_error([
                'message' => sprintf(__('Webhook externo retornou status %d', 'painel-empacotamento'), $status_code),
                'status_code' => $status_code,
                'elapsed_ms' => number_format($elapsed, 2),
                'body_preview' => $body_preview,
                'decoded_keys' => $decoded_keys,
            ]);
        }
    }
}
