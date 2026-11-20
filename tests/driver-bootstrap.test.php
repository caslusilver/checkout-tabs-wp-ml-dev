<?php
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__ . '/');
$hooks = [];
function plugin_dir_path($file) { return dirname($file) . '/'; }
function plugin_dir_url($file) { return 'https://driver.example.test/plugin/'; }
function get_option($name, $default = false) { return $name === 'ctwpml_driver_config' ? ['mode' => 'remote', 'enabled' => true] : $default; }
function add_action($name, ...$args) { $GLOBALS['hooks'][] = $name; }
function add_filter($name, ...$args) { $GLOBALS['hooks'][] = $name; }
function add_shortcode($name, ...$args) { $GLOBALS['hooks'][] = $name; }
function wp_next_scheduled($name) { return 1; }
require dirname(__DIR__) . '/checkout-tabs-wp-ml.php';
if (!CTWPML_Driver_Panel::remote() || class_exists('PPWOO_Routes') || function_exists('ctwpml_next_dispatch') || function_exists('wc_get_order')) throw new RuntimeException('Modo remoto carregou dependência da loja.');
foreach (['ppwoo_driver_panel','rest_api_init','wp_ajax_ctwpml_driver','wp_ajax_nopriv_ctwpml_driver'] as $hook) if (!in_array($hook,$hooks,true)) throw new RuntimeException('Hook remoto ausente: '.$hook);
echo "Bootstrap remoto: mesmo pacote carrega painel/cofre sem WooCommerce nem checkout.\n";
