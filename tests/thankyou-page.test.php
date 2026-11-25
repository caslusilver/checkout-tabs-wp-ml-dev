<?php
define('ABSPATH',__DIR__.'/');
function add_action(...$a){} function add_filter(...$a){} function add_shortcode(...$a){}
function is_user_logged_in(){return $GLOBALS['user']>0;} function get_current_user_id(){return $GLOBALS['user'];}
function wc_get_order($id){return $id===9?$GLOBALS['order']:false;}
class WC_Order {
 public $state='pending';
 function get_user_id(){return 7;}
 function get_order_key(){return 'fixture-key';}
 function has_status($s){return in_array($this->state,(array)$s,true);}
 function get_status(){return $this->state;}
 function is_paid(){return in_array($this->state,['processing','completed'],true);}
 function __call($name,$args){return match($name){'get_id'=>9,'get_meta'=>json_encode(['payload'=>'000201BR.GOV.BCB.PIX-exact','encodedImage'=>'']),'get_order_number'=>'9','get_date_created'=>new DateTimeImmutable(),'get_formatted_order_total'=>'R$ 10,00','get_item_count'=>1,'get_items'=>[],'get_order_item_totals'=>['order_total'=>['label'=>'Total','value'=>'R$ 10,00']],'get_formatted_shipping_address'=>'Rua fictícia, 1','get_billing_phone'=>'11900000000','get_billing_email'=>'fixture@example.test','get_payment_method_title'=>'Pix','needs_payment'=>true,'get_cancel_order_url'=>'https://fixture.test/cancel/?nonce=fixture','get_checkout_order_received_url'=>'https://fixture.test/obrigado/','get_user_id'=>7,default=>''};}
}
require dirname(__DIR__).'/inc/frontend/context.php';
require dirname(__DIR__).'/inc/frontend/thankyou-page.php';
$user=0;$order=new WC_Order();
function expect_ty($v,$message){if(!$v)throw new RuntimeException($message);}
expect_ty(CTWPML_Thankyou::authorize(9,'wrong')===null,'Chave errada autorizou pedido');
expect_ty(CTWPML_Thankyou::authorize(999,'fixture-key')===null,'Pedido inexistente autorizado');
expect_ty(CTWPML_Thankyou::authorize(9,'fixture-key')===$order,'Chave válida recusada');
$user=8;expect_ty(CTWPML_Thankyou::authorize(9,'')===null,'Outro cliente acessou pedido');
$user=7;expect_ty(CTWPML_Thankyou::authorize(9,'')===$order,'Proprietário recusado');
foreach(['pending'=>'pending','on-hold'=>'pending','processing'=>'paid','completed'=>'paid','cancelled'=>'cancelled','refunded'=>'refunded','failed'=>'failed']as$in=>$out){$order->state=$in;expect_ty(CTWPML_Thankyou::state($order)===$out,'Estado incorreto '.$in);}
expect_ty(CTWPML_Thankyou::tracking($order)==='','Pedido não pago recebeu link');
echo "Obrigado: autorização por pedido, estados reais e bloqueio de rastreio não pago passaram.\n";
define('CHECKOUT_TABS_WP_ML_DIR',dirname(__DIR__).'/');
function get_query_var($name,$default=0){return 9;}
function sanitize_text_field($s){return is_string($s)?$s:'';}function wp_unslash($s){return $s;}
function absint($n){return abs((int)$n);}function get_option($key,$default=false){return $default;}
function admin_url($s){return 'https://fixture.test/'.$s;}function wp_create_nonce($s){return 'fixture';}
function get_bloginfo($s){return 'Loja de teste';}function wc_format_datetime($d){return '25/11/2026';}
function esc_html($s){return htmlspecialchars((string)$s,ENT_QUOTES);}function esc_attr($s){return esc_html($s);}
function esc_url($s){return esc_attr($s);}function wp_kses_post($s){return $s;}
function esc_url_raw($s){return $s;}
function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}function wp_strip_all_tags($s){return strip_tags($s);}
$order->state='pending';$_GET=['key'=>'fixture-key'];
$markup=CTWPML_Thankyou::render();
expect_ty(str_contains($markup,'000201BR.GOV.BCB.PIX-exact'),'Payload alterado na renderização');
expect_ty(str_contains($markup,'ctwpml-ty-data'),'Configuração de status ausente');
$order->state='processing';$paidMarkup=CTWPML_Thankyou::render();
expect_ty(str_contains($paidMarkup,'id="ty-payment" hidden'),'Pedido pago ainda exibe ação de Pix');
echo "Obrigado: template real renderizado em pendente e pago sem perda do payload.\n";
