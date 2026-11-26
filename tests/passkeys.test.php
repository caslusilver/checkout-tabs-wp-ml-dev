<?php
namespace Secure_Passkeys\Utils {
    class Secure_Passkeys_Helper { public static function is_user_in_excluded_roles($id) { return $GLOBALS['excluded']; } }
}
namespace Secure_Passkeys\Models {
    class Secure_Passkeys_WebAuthn { public function get_all_by_user_id($id) { $GLOBALS['queried_user']=$id;return $GLOBALS['keys']; } }
}
namespace {
define('ABSPATH',__DIR__);define('SECURE_PASSKEYS_VERSION','1.3.0');define('SECURE_PASSKEYS_NONCE','engine-nonce');define('CHECKOUT_TABS_WP_ML_URL','https://shop.example.test/plugin/');
function add_action(...$a){}function add_shortcode(...$a){}function add_filter(...$a){}function nocache_headers(){}function is_admin(){return false;}
function is_user_logged_in(){return $GLOBALS['logged'];}function get_current_user_id(){return $GLOBALS['logged']?42:0;}
function get_transient($key){return $GLOBALS['count'];}function set_transient(...$args){}function wp_create_nonce($action){return 'native-'.$action;}
function wp_send_json_success($data){throw new \RuntimeException(json_encode(['success'=>true,'data'=>$data]));}
function wp_send_json_error($data,$status){throw new \RuntimeException(json_encode(['success'=>false,'data'=>$data,'status'=>$status]));}
function esc_url($s){return htmlspecialchars($s,ENT_QUOTES);}
class WP_User { public function __construct(public int $ID){} }
function ctwpml_migrate_guest_data_to_user($id){$GLOBALS['migrated_user']=$id;}
function expect($a,$b){if($a!==$b)throw new \LogicException('Unexpected fixture result');}
class PK_Session {public $data=[];function set($k,$v){$this->data[$k]=$v;}function get($k,$d=null){return $this->data[$k]??$d;}}
$woo=(object)['session'=>new PK_Session()];
function WC(){return $GLOBALS['woo'];}
function update_user_meta($id,$key,$value){$GLOBALS['profile'][$id][$key]=$value;}
function sanitize_text_field($s){return is_string($s)?$s:'';}function wp_unslash($s){return $s;}function absint($v){return abs((int)$v);}
function wp_verify_nonce($s,$action){return $s==='native-'.$action;}
class PK_Order {public $owner=42;public $meta=[];function get_customer_id(){return $this->owner;}function get_id(){return 9;}function get_order_key(){return 'fixture-order-key';}function get_checkout_order_received_url(){return 'https://fixture.test/obrigado/9/?key=fixture-order-key';}function update_meta_data($k,$v){$this->meta[$k]=$v;}function save_meta_data(){}}
$order=new PK_Order();
function wc_get_order($id){return $id===9?$GLOBALS['order']:false;}
function wc_get_checkout_url(){return 'https://fixture.test/checkout/';}
function add_query_arg($params,$url){return $url.'?'.http_build_query($params);}
function wp_safe_redirect($url){throw new \RuntimeException($url);}
require dirname(__DIR__).'/inc/frontend/passkeys.php';
$_SERVER=['REQUEST_METHOD'=>'POST','REMOTE_ADDR'=>'127.0.0.1'];$logged=false;$excluded=false;$count=0;$keys=[];
$call=static function(){try{\CTWPML_Passkeys::context();}catch(\RuntimeException $e){return json_decode($e->getMessage(),true);}throw new \LogicException('No JSON');};
expect(\CTWPML_Passkeys::available(),true);$guest=$call();expect($guest['data']['loggedIn'],false);expect($guest['data']['canRegister'],false);expect(isset($guest['data']['hasPasskeys']),true);expect(isset($GLOBALS['queried_user']),false);
$logged=true;$keys=[(object)['id'=>999,'credential_id'=>'private-fixture']];$_POST['user_id']=1234;$member=$call();expect($GLOBALS['queried_user'],42);expect($member['data']['canRegister'],true);expect($member['data']['hasPasskeys'],true);expect(str_contains(json_encode($member),'private-fixture'),false);
$excluded=true;$result=$call();expect($result['data']['canRegister'],false);$count=30;expect($call()['status'],429);$count=0;$_SERVER['REQUEST_METHOD']='GET';expect($call()['status'],405);
expect(\CTWPML_Passkeys::translate('Login','Login via Passkey','secure-passkeys'),'Entrar com acesso rápido');expect(\CTWPML_Passkeys::translate('Keep','Login via Passkey','other'),'Keep');
expect(\CTWPML_Passkeys::login_translation([])['success_login'],'Acesso confirmado. Carregando seus dados…');
$_POST=['ctwpml_context'=>'entry'];\CTWPML_Passkeys::resume_checkout(new WP_User(42));expect(isset($GLOBALS['migrated_user']),false);
$_POST=['ctwpml_context'=>'checkout-late'];\CTWPML_Passkeys::resume_checkout(new WP_User(1234));expect(isset($GLOBALS['migrated_user']),false);
\CTWPML_Passkeys::resume_checkout(new WP_User(42));expect($GLOBALS['migrated_user'],42);
$excluded=false;$_SERVER['REQUEST_METHOD']='POST';$_POST=[];$keys=[(object)['is_active'=>0]];
expect(\CTWPML_Passkeys::has_keys(42),false);$keys=[(object)['is_active'=>1]];expect(\CTWPML_Passkeys::has_keys(42),true);
$member=$call();expect($member['data']['usedPasskey'],true);expect($profile[42]['ctwpml_passkey_registered'],'yes');
$_POST=['enrollment_done'=>1,'nonce'=>'wrong','order_id'=>9];$call();expect($woo->session->get('ctwpml_pk_enroll_user'),null);expect($order->meta,[]);
$_POST=['enrollment_done'=>1,'nonce'=>'native-engine-nonce','order_id'=>9];$call();expect($woo->session->get('ctwpml_pk_enroll_user'),42);expect($order->meta['_ctwpml_passkey_registered'],'yes');
$order->owner=99;$order->meta=[];$call();expect($order->meta,[]);$order->owner=42;
$woo->session->data=['ctwpml_pk_new_customer'=>42];$keys=[];$result=['result'=>'success','redirect'=>'original'];
$redirect=\CTWPML_Passkeys::handoff($result,9);expect(str_contains($redirect['redirect'],'ctwpml_access_after_order=9'),true);
$order->owner=99;expect(\CTWPML_Passkeys::handoff($result,9),$result);$order->owner=42;
$logged=false;expect(\CTWPML_Passkeys::handoff($result,9),$result);
$_GET=['ctwpml_access_after_order'=>9,'key'=>'fixture-order-key'];try{\CTWPML_Passkeys::handoff_page();}catch(\RuntimeException $e){expect($e->getMessage(),$order->get_checkout_order_received_url());}
$_GET['key']='wrong';try{\CTWPML_Passkeys::handoff_page();}catch(\RuntimeException $e){expect($e->getMessage(),wc_get_checkout_url());}
$logged=true;$woo->session->data=['ctwpml_pk_new_customer'=>42,'ctwpml_pk_enroll_user'=>42];expect(\CTWPML_Passkeys::handoff($result,9),$result);
$_POST=['ctwpml_context'=>'checkout-late'];$woo->session->set('ctwpml_pk_expected_user',42);
expect(\CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(42)),true);
try{\CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(99));throw new \LogicException('Wrong account accepted');}catch(\Exception $e){expect($e->getMessage(),'CHECKOUT_ACCOUNT_MISMATCH');}
expect(\CTWPML_Passkeys::login_error_message('native','CHECKOUT_ACCOUNT_MISMATCH'),\CTWPML_Passkeys::login_errors()['CHECKOUT_ACCOUNT_MISMATCH']);
$woo->session->data=[];
try{\CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(42));throw new \LogicException('Missing context accepted');}catch(\Exception $e){expect($e->getMessage(),'CHECKOUT_ACCOUNT_CONTEXT_MISSING');}
expect(\CTWPML_Passkeys::login_error_message('private error','arbitrary-secret'), 'Não foi possível entrar. Tente novamente ou entre de outra forma.');
expect(\CTWPML_Passkeys::validate_checkout_identity(false,new WP_User(42)),false);
$_POST=['ctwpml_context'=>'entry'];expect(\CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(99)),true);
echo "Passkeys: versão, contexto mínimo, proprietário, roles, método, limite e traduções passaram.\n";
}
