<?php
if (!defined('ABSPATH')) exit;

use Fragen\Singleton;

/**
 * Adiciona link "Atualizar Cache" na lista de ações do plugin
 */
add_filter('plugin_action_links_packing-panel-woo-dev/packing-panel-woo-dev.php', function($links) {

    $nonce = wp_create_nonce('gu-refresh-cache');

    $links[] = '<a href="#" class="gu-refresh-cache-btn" data-nonce="'.$nonce.'">Atualizar Cache</a>';

    return $links;
});

/**
 * Enfileirar o JS de AJAX apenas na tela de plugins
 */
add_action('admin_enqueue_scripts', function($hook) {

    if ($hook !== 'plugins.php') return;

    wp_enqueue_script(
        'gu-refresh-cache-js',
        plugin_dir_url(__FILE__) . '../assets/js/admin-refresh-cache.js',
        ['jquery'],
        painel_empacotamento_get_version(),
        true
    );

    wp_localize_script('gu-refresh-cache-js', 'GURefreshCache', [
        'ajax_url' => admin_url('admin-ajax.php'),
    ]);
});

/**
 * Endpoint AJAX responsável por limpar o cache do Git Updater
 */
add_action('wp_ajax_gu_refresh_cache', function() {

    if (!current_user_can('manage_options')) {
        wp_send_json_error('Sem permissão para executar esta ação.');
    }

    check_ajax_referer('gu-refresh-cache');

    try {

        $settings = Singleton::get_instance(
            'Fragen\Git_Updater\Settings',
            new stdClass()
        );

        $settings->delete_all_cached_data();
        wp_cron();

        wp_send_json_success('Cache atualizado com sucesso!');

    } catch (Exception $e) {
        wp_send_json_error($e->getMessage());
    }
});

