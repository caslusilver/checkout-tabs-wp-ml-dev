<?php
/**
 * Classe para criar o menu PackPanel no wp-admin
 * 
 * Gerencia o menu principal e as abas de navegação
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Admin_Menu {
    
    /**
     * Slug da página de configurações
     */
    const PAGE_SLUG = 'ppwoo-settings';
    
    /**
     * Inicializa o menu admin
     */
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'add_menu_page']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_admin_assets']);
    }
    
    /**
     * Adiciona a página de menu no wp-admin
     */
    public static function add_menu_page() {
        add_menu_page(
            __('PackPanel', 'painel-empacotamento'),
            __('PackPanel', 'painel-empacotamento'),
            'manage_options',
            self::PAGE_SLUG,
            [__CLASS__, 'render_page'],
            'dashicons-admin-generic',
            30
        );
    }
    
    /**
     * Renderiza a página de configurações com abas
     */
    public static function render_page() {
        $current_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'style';
        
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('PackPanel', 'painel-empacotamento'); ?></h1>
            
            <nav class="nav-tab-wrapper">
                <a href="?page=<?php echo esc_attr(self::PAGE_SLUG); ?>&tab=style" 
                   class="nav-tab <?php echo $current_tab === 'style' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Estilo', 'painel-empacotamento'); ?>
                </a>
                <a href="?page=<?php echo esc_attr(self::PAGE_SLUG); ?>&tab=connection" 
                   class="nav-tab <?php echo $current_tab === 'connection' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Conexão', 'painel-empacotamento'); ?>
                </a>
            </nav>
            
            <div class="ppwoo-admin-content">
                <?php
                switch ($current_tab) {
                    case 'style':
                        PPWOO_Admin_Style_Tab::render();
                        break;
                    case 'connection':
                        PPWOO_Admin_Connection_Tab::render();
                        break;
                    default:
                        PPWOO_Admin_Style_Tab::render();
                }
                ?>
            </div>
        </div>
        <?php
    }
    
    /**
     * Enfileira assets do admin
     * 
     * @param string $hook_suffix
     */
    public static function enqueue_admin_assets($hook_suffix) {
        if ($hook_suffix !== 'toplevel_page_' . self::PAGE_SLUG) {
            return;
        }
        
        $version = painel_empacotamento_get_version();
        
        // Color picker (WordPress built-in)
        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('wp-color-picker');
        
        // CSS do admin
        wp_enqueue_style(
            'ppwoo-admin',
            plugin_dir_url(__FILE__) . '../../assets/css/admin.css',
            [],
            $version
        );
        
        // JS do admin
        wp_enqueue_script(
            'ppwoo-admin',
            plugin_dir_url(__FILE__) . '../../assets/js/admin.js',
            ['jquery', 'wp-color-picker'],
            $version,
            true
        );
        
        wp_localize_script('ppwoo-admin', 'ppwooAdmin', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ppwoo_admin_nonce'),
        ]);
    }
    
    /**
     * Handler AJAX para carregar conteúdo de uma aba
     */
    public static function ajax_load_admin_tab() {
        check_ajax_referer('ppwoo_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Sem permissão.', 'painel-empacotamento')]);
        }
        
        $tab = isset($_POST['tab']) ? sanitize_text_field($_POST['tab']) : 'style';
        
        // Valida tab
        if (!in_array($tab, ['style', 'connection'], true)) {
            $tab = 'style';
        }
        
        // Captura output da aba
        ob_start();
        
        switch ($tab) {
            case 'style':
                PPWOO_Admin_Style_Tab::render();
                break;
            case 'connection':
                PPWOO_Admin_Connection_Tab::render();
                break;
            default:
                PPWOO_Admin_Style_Tab::render();
        }
        
        $html = ob_get_clean();
        
        wp_send_json_success(['html' => $html]);
    }
}
