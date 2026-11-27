<?php
if (!defined('ABSPATH')) exit;

/** Read the gateway's saved code verbatim. No new invoice or debug logging. */
function ctwpml_order_pix_payload($order): string {
    $meta=is_object($order)&&method_exists($order,'get_meta')?$order->get_meta('__ASAAS_ORDER'):(is_array($order)?($order['__ASAAS_ORDER']??null):null);
    if(is_string($meta))$meta=json_decode($meta,true);
    if(is_object($meta))$meta=(array)$meta;
    $meta=is_array($meta)?$meta:[];
    $candidates=[$meta['payload']??null,$meta['pix_payload']??null,$meta['pixCopyPaste']??null,$meta['pix_copy_paste']??null,$meta['pixCopiaECola']??null];
    if(is_array($meta['pix']??null)){$candidates[]=$meta['pix']['payload']??null;$candidates[]=$meta['pix']['copyPaste']??null;}
    if(is_object($order)&&method_exists($order,'get_meta'))$candidates[]=$order->get_meta('_pix_payload');
    foreach($candidates as $code)if(is_string($code)&&strlen($code)<=16384&&preg_match('/^000201[\x20-\x7E]+$/D',$code))return $code;
    return '';
}

function ctwpml_admin_order_pix_boxes(): void {
    if(!current_user_can('manage_options'))return;
    $screens=['shop_order'];
    if(function_exists('wc_get_page_screen_id'))$screens[]=wc_get_page_screen_id('shop-order');
    foreach(array_unique($screens)as $screen)add_meta_box('ctwpml-order-pix','Pix copia e cola','ctwpml_admin_order_pix_box',$screen,'side','default');
}
function ctwpml_admin_order_pix_box($object): void {
    if(!current_user_can('manage_options'))return;
    $order=is_object($object)&&method_exists($object,'get_meta')?$object:(function_exists('wc_get_order')?wc_get_order((int)($object->ID??0)):null);
    if(!$order)return;
    $payload=ctwpml_order_pix_payload($order);
    if($payload===''){echo '<p>Pix ainda não disponível nos dados deste pedido.</p>';return;}
    $pending=in_array($order->get_status(),['pending','on-hold'],true);
    wp_enqueue_script('ctwpml-admin-order-pix',CHECKOUT_TABS_WP_ML_URL.'assets/js/order-pix-admin.js',[],checkout_tabs_wp_ml_get_version(),true);
    echo '<div class="ctwpml-admin-order-pix"><p>'.($pending?'Código salvo pelo gateway. Confira o valor e a validade antes de enviar.':'Pedido fora de pagamento pendente. Não envie este código como nova cobrança.').'</p>';
    echo '<textarea readonly rows="5" aria-label="Pix copia e cola" style="width:100%;text-transform:none!important;font-family:monospace">'.esc_textarea($payload).'</textarea>';
    echo '<button type="button" class="button" data-order-pix-copy'.($pending?'':' disabled').'>Copiar Pix</button><p data-order-pix-notice role="status"></p></div>';
}
add_action('add_meta_boxes','ctwpml_admin_order_pix_boxes');
