<?php
if (!defined('ABSPATH')) exit;

use Fragen\Singleton;

/**
 * Adiciona link "Atualizar Cache" na linha de meta do plugin (abaixo da descrição)
 */
add_filter('plugin_row_meta', function($plugin_meta, $plugin_file) {
    // Verifica se é o plugin correto usando o arquivo principal
    // O plugin_file vem como 'packing-panel-woo-dev/packing-panel-woo-dev.php'
    $expected_basename = 'packing-panel-woo-dev/packing-panel-woo-dev.php';
    
    if ($plugin_file !== $expected_basename) {
        return $plugin_meta;
    }

    // Verifica se Git Updater está disponível
    if (!class_exists('Fragen\Singleton')) {
        return $plugin_meta;
    }

    $nonce = wp_create_nonce('gu-refresh-cache');

    $plugin_meta[] = sprintf(
        '<a href="#" class="gu-refresh-cache-btn" data-nonce="%s">
            <span class="dashicons dashicons-update" style="font-size: 16px; vertical-align: middle; margin-right: 3px;"></span>
            <span class="gu-refresh-text">Atualizar Cache</span>
            <span class="spinner" style="float: none; margin: 0 0 0 5px; visibility: hidden;"></span>
        </a>',
        esc_attr($nonce)
    );

    return $plugin_meta;
}, 10, 2);

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

    check_ajax_referer('gu-refresh-cache', '_ajax_nonce');

    // Verifica se Git Updater está disponível
    if (!class_exists('Fragen\Singleton')) {
        wp_send_json_error('Git Updater não está instalado ou ativo.');
    }

    try {
        $settings = Singleton::get_instance(
            'Fragen\Git_Updater\Settings',
            new stdClass()
        );

        if (!method_exists($settings, 'delete_all_cached_data')) {
            wp_send_json_error('Método delete_all_cached_data não encontrado no Git Updater.');
        }

        $settings->delete_all_cached_data();
        wp_cron();

        wp_send_json_success('Cache atualizado com sucesso!');

    } catch (Exception $e) {
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO Refresh Cache Error: ' . $e->getMessage());
        }
        wp_send_json_error('Erro ao atualizar cache: ' . $e->getMessage());
    } catch (Error $e) {
        if (PPWOO_Config::is_debug()) {
            error_log('PPWOO Refresh Cache Fatal Error: ' . $e->getMessage());
        }
        wp_send_json_error('Erro fatal ao atualizar cache: ' . $e->getMessage());
    }
});
