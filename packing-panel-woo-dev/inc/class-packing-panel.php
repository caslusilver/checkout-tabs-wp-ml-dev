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
    private static $initialized = false;

    public static function post_has_shortcode($post): bool {
        if (!$post || !isset($post->ID)) {
            return false;
        }

        $tag = PPWOO_Config::SHORTCODE_TAG;
        $content = (string) ($post->post_content ?? '');

        if ($content !== '' && has_shortcode($content, $tag)) {
            return true;
        }

        if (function_exists('has_blocks') && $content !== '' && has_blocks($content)) {
            $blocks = parse_blocks($content);
            foreach ($blocks as $block) {
                if (!empty($block['innerHTML']) && strpos($block['innerHTML'], '[' . $tag . ']') !== false) {
                    return true;
                }
            }
        }

        $elementor_data = get_post_meta($post->ID, '_elementor_data', true);
        if (is_string($elementor_data) && $elementor_data !== '') {
            if (stripos($elementor_data, '[' . $tag . ']') !== false || stripos($elementor_data, $tag) !== false) {
                return true;
            }
        }

        $meta_flag = get_post_meta($post->ID, '_ppwoo_has_shortcode', true);
        if ($meta_flag === 'yes') {
            return true;
        }

        return false;
    }

    /**
     * Verifica se WooCommerce está instalado e ativo.
     *
     * Observação: `class_exists('WooCommerce')` pode falhar em alguns contextos
     * dependendo da ordem de carregamento. A função `WC()` costuma ser o sinal
     * mais confiável quando o plugin está ativo.
     */
    private static function is_woocommerce_active() {
        // Sinal mais confiável (WooCommerce ativo)
        if (function_exists('WC')) {
            return true;
        }

        // Fallbacks comuns
        if (class_exists('WooCommerce')) {
            return true;
        }

        if (class_exists('Automattic\WooCommerce\Plugin')) {
            return true;
        }

        // Verificação via "plugin ativo" (nem sempre disponível no frontend)
        if (function_exists('is_plugin_active') && is_plugin_active('woocommerce/woocommerce.php')) {
            return true;
        }

        return false;
    }

    /**
     * Inicializa os hooks principais.
     */
    public static function init() {
        if (self::$initialized) {
            return;
        }

        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Inicializando classe PackingPanel');
        }
        
        // Verifica se WooCommerce está ativo
        if (!self::is_woocommerce_active()) {
            if (PPWOO_Config::is_debug()) {
                error_log(
                    'PPWOO: WooCommerce não encontrado, exibindo aviso (checks: WC()='
                    . (function_exists('WC') ? 'sim' : 'não')
                    . ', WooCommerceClass=' . (class_exists('WooCommerce') ? 'sim' : 'não')
                    . ')'
                );
            }
            add_action('admin_notices', [__CLASS__, 'woocommerce_missing_notice']);
            return;
        }

        self::$initialized = true;

        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: WooCommerce encontrado, registrando hooks');
        }

        // Shortcode principal do painel (usa o mesmo nome do código antigo)
        add_shortcode('packing_panel', [__CLASS__, 'render_shortcode']);

        // Carrega CSS/JS do painel apenas quando o shortcode está presente
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_panel_assets']);

        // AJAX handler para webhooks internos
        add_action('wp_ajax_' . PPWOO_Config::AJAX_ACTION, [__CLASS__, 'handle_internal_ajax']);
        
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Hooks registrados com sucesso');
        }
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
        
        // Log de debug inicial
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Verificando carregamento de assets - is_singular: ' . (is_singular() ? 'sim' : 'não'));
        }
        
        // Verifica se estamos em uma página singular
        if (!is_singular()) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: Assets não carregados - não é página singular');
            }
            return;
        }
        
        // Verifica se o post existe
        if (!$post || !isset($post->ID)) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: Assets não carregados - post não encontrado');
            }
            return;
        }
        
        $has_shortcode = self::post_has_shortcode($post);
        if (!$has_shortcode) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: Assets não carregados - shortcode [' . PPWOO_Config::SHORTCODE_TAG . '] não encontrado no post #' . $post->ID);
            }
            return;
        }
        
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Carregando assets do painel para o post #' . $post->ID);
        }

        $version = painel_empacotamento_get_version();

        // Adiciona Dashicons (necessário no frontend)
        wp_enqueue_style('dashicons');

        // CSS do painel
        wp_enqueue_style(
            'packing-panel-woo',
            plugin_dir_url(__FILE__) . '../assets/css/panel.css',
            ['dashicons'],
            $version
        );
        
        // Injeta CSS dinâmico baseado nas configurações de estilo
        $dynamic_css = PPWOO_Style::generate_css();
        wp_add_inline_style('packing-panel-woo', $dynamic_css);
        
        PPWOO_Debug::info('CSS dinâmico injetado no painel');

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
        
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Assets do painel carregados com sucesso para o post #' . $post->ID);
        }
    }

    /**
     * SHORTCODE principal — Exibe o painel administrativo completo.
     */
    public static function render_shortcode($atts) {
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Shortcode [packing_panel] chamado');
        }
        
        // Verifica permissões
        if (!PPWOO_Security::can_manage_panel()) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: Acesso negado ao painel - usuário sem permissão');
            }
            return '<p>' . esc_html__('Você não tem permissão para visualizar este painel.', 'painel-empacotamento') . '</p>';
        }

        // Verifica se WooCommerce está ativo
        if (!self::is_woocommerce_active()) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: WooCommerce não está ativo');
            }
            return '<p style="color:red;">' . esc_html__('Erro: WooCommerce não está instalado ou ativo.', 'painel-empacotamento') . '</p>';
        }

        ob_start();

        // Localiza o template do painel
        $template = plugin_dir_path(__FILE__) . '../templates/painel.php';

        if (file_exists($template)) {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: Template encontrado, renderizando painel');
            }
            include $template;
        } else {
            if (PPWOO_Config::is_debug()) {
                error_log('PPWOO: ERRO - Template painel.php não encontrado em: ' . $template);
            }
            echo '<p style="color:red;">Erro: O template painel.php não foi encontrado em /templates/</p>';
        }

        $output = ob_get_clean();
        
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO: Shortcode renderizado com sucesso (tamanho: ' . strlen($output) . ' bytes)');
        }
        
        return $output;
    }

    /**
     * Handle internal AJAX calls (to admin-ajax.php).
     */
    public static function handle_internal_ajax() {
        if (PPWOO_Config::is_debug()) {
            error_log('Packing Panel Internal AJAX: Received POST data: ' . print_r($_POST, true));
        }

        check_ajax_referer('packing_panel_nonce', 'nonce');

        if (!PPWOO_Security::can_manage_panel()) {
            wp_send_json_error('Você não tem permissão para executar esta ação.', 403);
        }

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        $webhook_type = isset($_POST['webhook_type']) ? sanitize_text_field($_POST['webhook_type']) : '';
        $tracking_data = isset($_POST['tracking_data']) ? PPWOO_Security::sanitize_tracking_data($_POST['tracking_data']) : array();
        $tab_context = isset($_POST['tab_context']) ? sanitize_text_field($_POST['tab_context']) : '';

        // Validação
        $validation = PPWOO_Security::validate_webhook_request($order_id, $webhook_type);
        if (is_wp_error($validation)) {
            wp_send_json_error($validation->get_error_message(), $validation->get_error_data()['status']);
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            wp_send_json_error('Pedido não encontrado.', 404);
        }

        if (PPWOO_Config::is_debug()) {
            error_log('Packing Panel: Processing INTERNAL AJAX for "' . $webhook_type . '" for Order #' . $order_id);
        }

        switch ($webhook_type) {
            case 'accepted':
                // Atualiza a meta do pedido para o passo 2
                $order->update_meta_data('_packing_panel_workflow_step', 'step2');
                $order->save();

                // Envia webhook externo
                PPWOO_Webhook::send('packing_panel_accepted', $order);
                wp_send_json_success();
                break;

            case 'shipped':
                // Determina o nome do evento com base na aba
                $event_name = ('motoboy' === $tab_context) ? 'mtb_packing_panel_shipped' : 'packing_panel_shipped';

                // Marca o pedido como concluído
                $order->update_status('completed', __('Pedido marcado como enviado pelo Painel de Empacotamento.', 'painel-empacotamento'));

                // Salva os dados de rastreio, se houver
                if (!empty($tracking_data)) {
                    PPWOO_Utils::save_tracking_data($tracking_data, $order);
                }

                // Remove meta de workflow
                $order->delete_meta_data('_packing_panel_workflow_step');
                $order->save();

                // Envia webhook externo
                PPWOO_Webhook::send($event_name, $order);
                wp_send_json_success();
                break;

            case 'payment_confirm':
            case 'payment_deny':
                $status = $webhook_type === 'payment_confirm' ? 'confirm' : 'deny';
                $result = PPWOO_Payments_Action_Service::send_payment_status($order, $status);

                if (is_wp_error($result)) {
                    $error_status = 400;
                    $error_data = $result->get_error_data();
                    if (is_array($error_data) && isset($error_data['status'])) {
                        $error_status = (int) $error_data['status'];
                    }
                    wp_send_json_error($result->get_error_message(), $error_status);
                }

                wp_send_json_success();
                break;

            default:
                wp_send_json_error('Tipo de webhook desconhecido.', 400);
        }

        wp_die();
    }
}

// Inicializa a classe após o carregamento dos plugins/WooCommerce
add_action('plugins_loaded', ['PPWOO_PackingPanel', 'init']);
add_action('woocommerce_loaded', ['PPWOO_PackingPanel', 'init']);
