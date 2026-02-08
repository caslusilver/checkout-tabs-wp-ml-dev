<?php
/**
 * Classe principal responsável por todo o painel de empacotamento.
 *
 * Responsabilidades:
 * - Shortcode do painel
 * - Render HTML via templates
 * - Abas Motoboy / Correios
 * - Funções AJAX
 * - Integração com webhooks externos
 */
if (!defined('ABSPATH')) exit;

class PPWOO_PackingPanel {
    private static function log_debug(string $message, array $context = []): void {
        if (!PPWOO_Config::is_debug()) {
            return;
        }
        $suffix = '';
        if (!empty($context)) {
            $suffix = ' | ' . wp_json_encode($context);
        }
        error_log('[PPWOO] ' . $message . $suffix);
    }

    /**
     * Inicializa os hooks principais.
     */
    public static function init() {
        // Verifica se WooCommerce está ativo
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', [__CLASS__, 'woocommerce_missing_notice']);
            return;
        }

        // Shortcode principal do painel (usa o mesmo nome do código antigo)
        add_shortcode('packing_panel', [__CLASS__, 'render_shortcode']);

        // Carrega CSS/JS do painel apenas quando o shortcode está presente
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_panel_assets']);

        // AJAX handler para webhooks internos
        add_action('wp_ajax_' . PPWOO_Config::AJAX_ACTION, [__CLASS__, 'handle_internal_ajax']);
    }

    /**
     * Admin notice se WooCommerce não estiver ativo.
     */
    public static function woocommerce_missing_notice() {
        echo '<div class="error"><p>' . sprintf(
            esc_html__('Painel de Empacotamento requer WooCommerce instalado e ativo.', 'painel-empacotamento'),
            '<a href="https://wordpress.org/plugins/woocommerce/" target="_blank">WooCommerce</a>'
        ) . '</p></div>';
    }

    /**
     * Enfileira CSS e JS do painel apenas quando o shortcode está presente.
     */
    public static function enqueue_panel_assets() {
        global $post;
        
        // Verifica se estamos em uma página singular e se o shortcode está presente
        if (!is_singular() || !$post || !has_shortcode($post->post_content, PPWOO_Config::SHORTCODE_TAG)) {
            return;
        }

        $version = painel_empacotamento_get_version();
        self::log_debug('Enqueue painel', [
            'version' => $version,
            'post_id' => $post ? $post->ID : null,
        ]);

        // Adiciona Dashicons (necessário no frontend)
        wp_enqueue_style('dashicons');

        // CSS do painel
        wp_enqueue_style(
            'packing-panel-woo',
            plugin_dir_url(__FILE__) . '../assets/css/panel.css',
            ['dashicons'],
            $version
        );

        // JS do painel
        wp_enqueue_script(
            'packing-panel-woo',
            plugin_dir_url(__FILE__) . '../assets/js/panel.js',
            ['jquery'],
            $version,
            true
        );

        // Localiza script com dados necessários
        wp_localize_script('packing-panel-woo', 'packingPanelVars', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('packing_panel_nonce'),
            'ajax_action' => PPWOO_Config::AJAX_ACTION,
            'copy_success' => esc_html__('Copiado!', 'painel-empacotamento'),
            'copy_error' => esc_html__('Falha ao copiar.', 'painel-empacotamento'),
            'processing_text' => esc_html__('Processando...', 'painel-empacotamento'),
            'motoboy_tab_text' => esc_html__('Motoboy', 'painel-empacotamento'),
            'correios_tab_text' => esc_html__('Correios', 'painel-empacotamento'),
            'pending_orders_text' => esc_html__(' pedidos pendentes', 'painel-empacotamento'),
            'debug_enabled' => PPWOO_Config::is_debug(),
        ]);

        // Compatibilidade com variável PPWOO (usada no JS)
        wp_localize_script('packing-panel-woo', 'PPWOO', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('packing_panel_nonce'),
            'ajax_action' => PPWOO_Config::AJAX_ACTION,
            'copy_success' => esc_html__('Copiado!', 'painel-empacotamento'),
            'copy_error' => esc_html__('Falha ao copiar.', 'painel-empacotamento'),
            'debug_enabled' => PPWOO_Config::is_debug(),
        ]);
    }

    /**
     * SHORTCODE principal — Exibe o painel administrativo completo.
     */
    public static function render_shortcode($atts) {
        // Verifica permissões
        if (!PPWOO_Security::can_manage_panel()) {
            self::log_debug('Shortcode bloqueado por permissão');
            return '<p>' . esc_html__('Você não tem permissão para visualizar este painel.', 'painel-empacotamento') . '</p>';
        }

        self::log_debug('Shortcode render iniciado');

        ob_start();

        // Localiza o template do painel
        $template = plugin_dir_path(__FILE__) . '../templates/painel.php';

        if (file_exists($template)) {
            include $template;
        } else {
            self::log_debug('Template não encontrado', ['template' => $template]);
            echo '<p style="color:red;">Erro: O template painel.php não foi encontrado em /templates/</p>';
        }

        return ob_get_clean();
    }

    /**
     * Handle internal AJAX calls (to admin-ajax.php).
     */
    public static function handle_internal_ajax() {
        self::log_debug('AJAX recebido', [
            'post_keys' => array_keys($_POST),
        ]);

        check_ajax_referer('packing_panel_nonce', 'nonce');

        if (!PPWOO_Security::can_manage_panel()) {
            self::log_debug('AJAX sem permissão');
            wp_send_json_error('Você não tem permissão para executar esta ação.', 403);
        }

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        $webhook_type = isset($_POST['webhook_type']) ? sanitize_text_field($_POST['webhook_type']) : '';
        $tracking_data = isset($_POST['tracking_data']) ? PPWOO_Security::sanitize_tracking_data($_POST['tracking_data']) : array();
        $tab_context = isset($_POST['tab_context']) ? sanitize_text_field($_POST['tab_context']) : '';
        self::log_debug('AJAX payload normalizado', [
            'order_id' => $order_id,
            'webhook_type' => $webhook_type,
            'tab_context' => $tab_context,
            'tracking_keys' => is_array($tracking_data) ? array_keys($tracking_data) : [],
        ]);

        // Validação
        $validation = PPWOO_Security::validate_webhook_request($order_id, $webhook_type);
        if (is_wp_error($validation)) {
            self::log_debug('AJAX validação falhou', [
                'message' => $validation->get_error_message(),
                'status' => $validation->get_error_data()['status'] ?? null,
            ]);
            wp_send_json_error($validation->get_error_message(), $validation->get_error_data()['status']);
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            self::log_debug('AJAX pedido não encontrado', ['order_id' => $order_id]);
            wp_send_json_error('Pedido não encontrado.', 404);
        }

        self::log_debug('AJAX processando', [
            'order_id' => $order_id,
            'status' => $order->get_status(),
            'webhook_type' => $webhook_type,
        ]);

        switch ($webhook_type) {
            case 'accepted':
                // Atualiza a meta do pedido para o passo 2
                $order->update_meta_data('_packing_panel_workflow_step', 'step2');
                $order->save();
                self::log_debug('Pedido aceito', ['order_id' => $order_id]);

                // Envia webhook externo
                PPWOO_Webhook::send('packing_panel_accepted', $order);
                wp_send_json_success();
                break;

            case 'shipped':
                // Determina o nome do evento com base na aba
                $event_name = ('motoboy' === $tab_context) ? 'mtb_packing_panel_shipped' : 'packing_panel_shipped';
                self::log_debug('Concluir envio', [
                    'order_id' => $order_id,
                    'event_name' => $event_name,
                    'tab_context' => $tab_context,
                ]);

                // Marca o pedido como concluído
                $order->update_status('completed', __('Pedido marcado como enviado pelo Painel de Empacotamento.', 'painel-empacotamento'));

                // Salva os dados de rastreio, se houver
                if (!empty($tracking_data)) {
                    PPWOO_Utils::save_tracking_data($tracking_data, $order);
                }
                self::log_debug('Tracking salvo', [
                    'order_id' => $order_id,
                    'tracking_keys' => is_array($tracking_data) ? array_keys($tracking_data) : [],
                ]);

                // Remove meta de workflow
                $order->delete_meta_data('_packing_panel_workflow_step');
                $order->save();

                // Envia webhook externo
                PPWOO_Webhook::send($event_name, $order);
                wp_send_json_success();
                break;

            default:
                self::log_debug('Webhook type desconhecido', ['webhook_type' => $webhook_type]);
                wp_send_json_error('Tipo de webhook desconhecido.', 400);
        }

        wp_die();
    }
}

// Inicializa a classe
PPWOO_PackingPanel::init();
