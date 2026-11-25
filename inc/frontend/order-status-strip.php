<?php
if (!defined('ABSPATH')) exit;

/** Projeção mínima para o próprio comprador; nunca aceita cliente/pedido do navegador. */
final class CTWPML_Order_Strip {
    public static function init(): void {
        add_shortcode('checkout_ml_pedido_status',[__CLASS__,'shortcode']);
        add_action('wp_enqueue_scripts',[__CLASS__,'assets']);
        add_action('wp_ajax_ctwpml_order_strip',[__CLASS__,'ajax']);
    }
    public static function excluded(): bool {
        $pages=array_filter(array_map('absint',(array)apply_filters('ctwpml_order_strip_tracking_pages',[(int)get_option('ppwoo_tracking_page',0)])));
        return ctwpml_is_visual_editor() || CTWPML_Thankyou::page() || ($pages && is_page($pages));
    }
    public static function assets(): void {
        if (!is_user_logged_in() || self::excluded()) return;
        $version=checkout_tabs_wp_ml_get_version();
        wp_enqueue_style('ctwpml-order-strip',CHECKOUT_TABS_WP_ML_URL.'assets/css/order-status-strip.css',[],$version);
        wp_enqueue_script('ctwpml-order-strip',CHECKOUT_TABS_WP_ML_URL.'assets/js/order-status-strip.js',[],$version,true);
    }
    public static function shortcode(): string {
        if (!is_user_logged_in() || self::excluded()) return '';
        // Sem pedido/payload no HTML: uma página em cache nunca contém dados da compra.
        return '<section class="ctwpml-order-strip" hidden data-ajax="'.esc_url(admin_url('admin-ajax.php')).'" data-nonce="'.esc_attr(wp_create_nonce('ctwpml_order_strip')).'" aria-label="Acompanhe seu pedido"><div class="strip-progress" aria-hidden="true"><span></span></div><div class="strip-content"><div class="strip-text"><span class="strip-label"></span><small class="strip-detail"></small></div><button type="button" class="strip-copy"><span class="strip-copy-icon" aria-hidden="true"></span><span class="strip-copy-text">Copiar Pix</span></button><a class="strip-link" target="_blank" rel="noopener noreferrer"><span>Ver pedido</span><span class="strip-external" aria-hidden="true"></span></a><span class="strip-dot" aria-hidden="true"></span></div><span class="strip-feedback" role="status"></span></section>';
    }
    public static function find_order(int $user) {
        if ($user<=0) return null;
        foreach ([['pending','on-hold'],['processing']] as $states) {
            $orders=wc_get_orders(['customer_id'=>$user,'status'=>$states,'limit'=>5,'orderby'=>'date','order'=>'DESC','type'=>'shop_order']);
            foreach ($orders as $order) {
                if (!$order instanceof WC_Order || (int)$order->get_user_id()!==$user) continue;
                if (class_exists('PPWOO_Routes_Store') && PPWOO_Routes_Store::ready()) {
                    $stop=PPWOO_Routes_Store::stop($order->get_id());
                    if ($stop && ($stop['delivery_state']??'')==='closed') continue;
                }
                return $order;
            }
        }
        return null;
    }
    public static function ajax(): void {
        nocache_headers();
        if (!is_user_logged_in() || !check_ajax_referer('ctwpml_order_strip','nonce',false)) wp_send_json_error(['message'=>'Acesso indisponível.'],403);
        $user=get_current_user_id();
        $bucket='ctwpml_strip_'.$user.'_'.floor(time()/60);
        $count=(int)get_transient($bucket);
        if($count>=30)wp_send_json_error(['message'=>'Aguarde.'],429);
        set_transient($bucket,$count+1,60);
        $order=self::find_order($user);
        if(!$order)wp_send_json_success(['active'=>false]);
        $paid=$order->is_paid();$payload='';
        if(!$paid){$raw=$order->get_meta('__ASAAS_ORDER',true);$pix=is_string($raw)?json_decode($raw,true):(array)$raw;$payload=is_string($pix['payload']??null)?$pix['payload']:'';}
        $tracking=$paid?CTWPML_Thankyou::tracking($order):'';
        $state=$paid?'preparing':'pending';
        if($paid && class_exists('PPWOO_Routes_Store') && PPWOO_Routes_Store::ready()) {
            $stop=PPWOO_Routes_Store::stop($order->get_id());
            if($stop && ($stop['delivery_state']??'')==='on_route')$state='route';
        }
        wp_send_json_success(['active'=>true,'id'=>$order->get_id(),'number'=>$order->get_order_number(),'state'=>$state,'payload'=>$payload,'url'=>$tracking?:$order->get_checkout_order_received_url(),'minutes'=>max(1,min(1440,(int)get_option('ctwpml_thankyou_minutes',6)))]);
    }
}
CTWPML_Order_Strip::init();
