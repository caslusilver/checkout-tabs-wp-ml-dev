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
echo "Passkeys: versão, contexto mínimo, proprietário, roles, método, limite e traduções passaram.\n";
}
