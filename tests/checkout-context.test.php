<?php
/** Escopo de execução da UI sem WordPress, Elementor ou pedido reais. */
namespace Elementor {
    class Plugin { public static $instance; }
}
namespace {
define('ABSPATH', __DIR__ . '/');
$context = ['admin'=>false, 'checkout'=>true, 'endpoint'=>false, 'received'=>false, 'thanks'=>false];
$actions = [];
$woo_calls = 0;
function is_admin() { return $GLOBALS['context']['admin']; }
function is_checkout() { return $GLOBALS['context']['checkout']; }
function is_wc_endpoint_url() { return $GLOBALS['context']['endpoint']; }
function is_order_received_page() { return $GLOBALS['context']['received']; }
function is_page($slug) { return $slug === 'pagina-de-obrigado-compras-woocommerce' && $GLOBALS['context']['thanks']; }
function is_cart() { return false; }
function is_product() { return false; }
function add_shortcode(...$args) {}
function add_action($hook, $callback, ...$args) { $GLOBALS['actions'][] = $callback; }
function do_shortcode($shortcode) { $GLOBALS['woo_calls']++; return '<form class="checkout"></form>'; }
function get_option($name, $default=false) { return $name === 'checkout_tabs_wp_ml_splash_enabled' ? 1 : $default; }
function check($condition, $message) { if (!$condition) throw new \RuntimeException($message); }
require dirname(__DIR__) . '/inc/frontend/context.php';
require dirname(__DIR__) . '/inc/frontend/checkout-ml-shortcode.php';
check(ctwpml_is_checkout_ui_request(), 'Checkout público real deve continuar permitido.');
foreach (['admin','endpoint','received','thanks'] as $flag) {
    $context[$flag] = true;
    check(!ctwpml_is_checkout_ui_request(), 'Bloqueio ausente: '.$flag);
    check(ctwpml_render_checkout_ml_shortcode() === '', 'Shortcode executou no contexto: '.$flag);
    $context[$flag] = false;
}
$context['checkout'] = false;
check(!ctwpml_is_checkout_ui_request(), 'Página comum não deve montar checkout.');
$context['checkout'] = true;
foreach (['editor'=>'is_edit_mode', 'preview'=>'is_preview_mode'] as $property=>$method) {
    \Elementor\Plugin::$instance = (object) [$property => new class {
        public function is_edit_mode() { return true; }
        public function is_preview_mode() { return true; }
    }];
    check(!ctwpml_is_checkout_ui_request(), 'Elementor '.$property.' montou checkout.');
    check(ctwpml_render_checkout_ml_shortcode() === '', 'Shortcode ativo no Elementor.');
}
check($woo_calls === 0, 'Contexto bloqueado chegou a renderizar o WooCommerce.');
// Com splash habilitado e usuário não consultado, todos os callbacks visuais
// devem retornar antes de enfileirar assets, alterar viewport ou emitir HTML.
require dirname(__DIR__) . '/inc/enqueue.php';
require dirname(__DIR__) . '/inc/frontend/login-popup.php';
require dirname(__DIR__) . '/inc/geolocation/enqueue.php';
ob_start();
foreach ($actions as $callback) $callback();
check(ob_get_clean() === '', 'Editor recebeu HTML/overlay do checkout.');
\Elementor\Plugin::$instance = null;
$html = ctwpml_render_checkout_ml_shortcode();
check(strpos($html, 'ctwpml-root') !== false && $woo_calls === 1, 'Checkout público perdeu formulário/host.');
check(ctwpml_render_checkout_ml_shortcode() === '' && $woo_calls === 1, 'Shortcode duplicou formulário.');
echo "Checkout público preservado; Elementor, página de obrigado e endpoints não montam UI.\n";
}
