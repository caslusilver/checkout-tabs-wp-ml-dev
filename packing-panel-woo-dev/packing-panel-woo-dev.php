<?php
/**
 * Plugin Name: Painel de Empacotamento Woo
 * Plugin URI: https://cubensisstore.com.br
 * Description: Painel administrativo de empacotamento para pedidos via WooCommerce, com abas Motoboy e Correios, workflow e integração com webhooks externos.
 * Version: 0.3.7
 * Author: Lucas Andrade / AI
 * Author URI: https://github.com/caslusilver
 * License: GPL2
 * Text Domain: painel-empacotamento
 *
 */

if (!defined('ABSPATH')) exit;

/**
 * Obtém automaticamente a versão do plugin lendo o cabeçalho.
 */
function painel_empacotamento_get_version() {
    if (function_exists('checkout_tabs_wp_ml_get_version')) {
        return checkout_tabs_wp_ml_get_version();
    }

    if (!function_exists('get_file_data')) {
        require_once ABSPATH . 'wp-includes/functions.php';
    }

    $plugin_data = get_file_data(__FILE__, [
        'Version' => 'Version',
    ]);

    return $plugin_data['Version'];
}

/**
 * Carrega CSS e JS genéricos do plugin (não o CSS/JS do painel).
 */
add_action('wp_enqueue_scripts', function () {
    if (!is_singular()) {
        return;
    }

    global $post;
    if (!$post) {
        return;
    }

    if (!class_exists('PPWOO_PackingPanel') || !PPWOO_PackingPanel::post_has_shortcode($post)) {
        return;
    }

    $version = painel_empacotamento_get_version();

    wp_enqueue_style(
        'painel-empacotamento-style',
        plugin_dir_url(__FILE__) . 'assets/css/style.css',
        [],
        $version
    );

    wp_enqueue_script(
        'painel-empacotamento-script',
        plugin_dir_url(__FILE__) . 'assets/js/script.js',
        ['jquery'],
        $version,
        true
    );
});

/**
 * Carrega todos os arquivos internos do plugin.
 *
 * ⚠️ Aqui você NÃO coloca lógica — apenas imports.
 */

// Carrega classes auxiliares primeiro
require_once plugin_dir_path(__FILE__) . 'inc/core/class-config.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-utils.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-security.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-payments-action-service.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-webhook.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-orders.php';
require_once plugin_dir_path(__FILE__) . 'inc/core/class-debug.php';

// Carrega classe principal
require_once plugin_dir_path(__FILE__) . 'inc/class-packing-panel.php';
require_once plugin_dir_path(__FILE__) . 'inc/admin-refresh-cache.php';

// Carrega classes de admin
require_once plugin_dir_path(__FILE__) . 'inc/core/class-style.php';
require_once plugin_dir_path(__FILE__) . 'inc/admin/class-admin-menu.php';
require_once plugin_dir_path(__FILE__) . 'inc/admin/class-admin-style-tab.php';
require_once plugin_dir_path(__FILE__) . 'inc/admin/class-admin-connection-tab.php';
require_once plugin_dir_path(__FILE__) . 'inc/integrations/class-webhook-client.php';

// Inicializa menu admin
PPWOO_Admin_Menu::init();

// Registra handlers AJAX
add_action('wp_ajax_ppwoo_test_webhook', [PPWOO_Admin_Connection_Tab::class, 'ajax_test_webhook']);
add_action('wp_ajax_ppwoo_test_external_webhook', [PPWOO_Admin_Connection_Tab::class, 'ajax_test_external_webhook']);
add_action('wp_ajax_ppwoo_load_admin_tab', [PPWOO_Admin_Menu::class, 'ajax_load_admin_tab']);
