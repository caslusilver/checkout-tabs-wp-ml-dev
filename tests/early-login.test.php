<?php
// Contratos reais de vínculo de conta, recuperação e shortcode; nenhum serviço externo.
define('ABSPATH',__DIR__);define('CHECKOUT_TABS_WP_ML_URL','https://shop.example.test/plugin/');
$options=[];$transients=[];$logged=false;$engine=true;$sessionId='guest-fixture';$authCalls=0;$migrations=0;
function add_action(...$args){}function add_shortcode(...$args){}function add_filter(...$args){}
function get_option($key,$default=false){return $GLOBALS['options'][$key]??$default;}
function site_url($path,$scheme=null){return 'https://shop.example.test/'.$path;}
function wp_login_url(){return site_url('wp-login.php');}function wc_get_page_permalink($page){return site_url('minha-conta/');}
function admin_url($path){return site_url('wp-admin/'.$path);}function wp_create_nonce($action){return 'fixture-'.$action;}
function wp_enqueue_style(...$a){}function wp_enqueue_script(...$a){}function wp_localize_script(...$a){}
function checkout_tabs_wp_ml_get_version(){return '3.4.17';}function ctwpml_is_visual_editor(){return false;}function ctwpml_is_checkout_ui_request(){return true;}
function is_user_logged_in(){return $GLOBALS['logged'];}function shortcode_atts($defaults,$attrs,...$a){return array_merge($defaults,$attrs);}
function esc_url($v){return htmlspecialchars($v,ENT_QUOTES);}function esc_attr($v){return htmlspecialchars($v,ENT_QUOTES);}
function sanitize_hex_color($v){return preg_match('/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i',$v)?$v:null;}
function wp_generate_password($length,...$a){return substr(bin2hex(random_bytes($length)),0,$length);}
function set_transient($key,$value,$ttl){$GLOBALS['transients'][$key]=[$value,$ttl];}function get_transient($key){return $GLOBALS['transients'][$key][0]??false;}
class FixtureSession {function get_customer_id(){return $GLOBALS['sessionId'];}function get(...$a){return 42;}function set_customer_session_cookie($yes){}function set($k,$v){}function save_data(){}}
$woo=(object)['session'=>new FixtureSession()];function WC(){return $GLOBALS['woo'];}
class WP_User {function __construct(public int $ID,public string $user_email='fixture@example.test'){} }
function get_user_by($field,$value){return $value==='fixture@example.test'?new WP_User(42):new WP_User(99);}
function sanitize_text_field($v){return $v;}function sanitize_email($v){return $v;}function wp_unslash($v){return $v;}
function ctwpml_auth_request_guard(...$a){return true;}function ctwpml_verify_checkout_recaptcha(...$a){return true;}function is_wp_error($v){return false;}function is_ssl(){return true;}
function wp_signon($creds,$ssl){$GLOBALS['authCalls']++;return get_user_by('email',$creds['user_login']);}
function ctwpml_migrate_guest_data_to_user($id){$GLOBALS['migrations']++;}
function wp_send_json_success($data){throw new RuntimeException(json_encode(['ok'=>true,'data'=>$data]));}function wp_send_json_error($data,$status=400){throw new RuntimeException(json_encode(['ok'=>false,'data'=>$data]));}
require dirname(__DIR__).'/inc/frontend/passkeys.php';
require dirname(__DIR__).'/inc/frontend/early-login.php';
require dirname(__DIR__).'/inc/ajax-login.php';
function expectEarly($yes){if(!$yes)throw new LogicException('Early login contract failed');}
function passwordResult($context,$ticket,$email='fixture@example.test'){
 $_POST=['ctwpml_context'=>$context,'ctwpml_early_ticket'=>$ticket,'email'=>$email,'password'=>'fixture-proof'];
 try{checkout_tabs_wp_ml_ajax_login();}catch(RuntimeException $e){return json_decode($e->getMessage(),true);}throw new LogicException('Missing response');
}
if(in_array('--markup',$argv,true)){
 define('SECURE_PASSKEYS_VERSION','1.3.0');define('SECURE_PASSKEYS_NONCE','fixture-nonce');
 eval('namespace Secure_Passkeys\\Utils; class Secure_Passkeys_Helper {}');
 $options['checkout_tabs_wp_ml_early_login_enabled']=1;
 echo CTWPML_Early_Login::shortcode().CTWPML_Early_Login::shortcode(['size'=>32]);CTWPML_Early_Login::footer();exit;
}
expectEarly(!CTWPML_Early_Login::enabled());expectEarly(CTWPML_Early_Login::issue_ticket(42)==='');
$options['checkout_tabs_wp_ml_early_login_enabled']=1;$ticket=CTWPML_Early_Login::issue_ticket(42);
expectEarly(strlen($ticket)===40&&CTWPML_Early_Login::ticket_user($ticket)===42);
expectEarly(array_values($transients)[0][1]===600);expectEarly(CTWPML_Early_Login::ticket_user([])===0);
$sessionId='other-guest';expectEarly(CTWPML_Early_Login::ticket_user($ticket)===0);$sessionId='guest-fixture';
$_POST=['ctwpml_context'=>'checkout-early','ctwpml_early_ticket'=>$ticket];
expectEarly(CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(42))===true);
try{CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(99));throw new LogicException('Wrong account accepted');}catch(Exception $e){expectEarly($e->getMessage()==='CHECKOUT_ACCOUNT_MISMATCH');}
expectEarly(!CTWPML_Passkeys::validate_checkout_identity(false,new WP_User(42)));
expectEarly(!passwordResult('checkout-early',$ticket,'other@example.test')['ok']&&$authCalls===0);
expectEarly(passwordResult('checkout-early',$ticket)['ok']&&$authCalls===1&&$migrations===0);
expectEarly(passwordResult('entry','')['ok']&&$migrations===0);
expectEarly(passwordResult('checkout-late','')['ok']&&$migrations===1);
$transients=[];expectEarly(!passwordResult('checkout-early',$ticket)['ok']&&$authCalls===3);
$_POST=['ctwpml_context'=>'checkout-early','ctwpml_early_ticket'=>$ticket];
try{CTWPML_Passkeys::validate_checkout_identity(true,new WP_User(42));throw new LogicException('Expired route accepted');}catch(Exception $e){expectEarly($e->getMessage()==='CHECKOUT_ACCOUNT_CONTEXT_MISSING');}
$html=CTWPML_Early_Login::shortcode(['size'=>999,'color'=>'red;attack','logged_color'=>'#123456']);
expectEarly(str_contains($html,'48px')&&str_contains($html,'#ffffff')&&!str_contains($html,'attack'));
expectEarly(!str_contains($html,'data-ctwpml-menu-login')); // Engine unavailable: native account link remains usable.
expectEarly(!str_contains($html,'is-logged-in')&&!str_contains($html,'fixture@example.test'));
ob_start();CTWPML_Early_Login::footer();$footer=ob_get_clean();
expectEarly(substr_count($footer,'id="ctwpml-menu-access"')===1&&str_contains($footer,'wp-login.php?action=lostpassword'));
expectEarly(!str_contains($footer,'ctwpml_early_ticket'));
define('SECURE_PASSKEYS_VERSION','1.3.0');define('SECURE_PASSKEYS_NONCE','fixture-nonce');
eval('namespace Secure_Passkeys\\Utils; class Secure_Passkeys_Helper {static function is_user_in_excluded_roles($id){return false;}}');
eval('namespace Secure_Passkeys\\Models; class Secure_Passkeys_WebAuthn {function get_all_by_user_id($id){return [(object)["is_active"=>1]];}}');
function check_ajax_referer(...$a){return true;}function is_email($value){return filter_var($value,FILTER_VALIDATE_EMAIL);}function email_exists($value){return $value==='fixture@example.test'?42:0;}
require dirname(__DIR__).'/inc/ajax-check-email.php';
function routeResult($early,$email='fixture@example.test'){
 $_SERVER=['REQUEST_METHOD'=>'POST','REMOTE_ADDR'=>'127.0.0.1'];$_POST=['early'=>$early,'email'=>$email];
 try{ctwpml_ajax_check_email_exists();}catch(RuntimeException $e){return json_decode($e->getMessage(),true)['data'];}throw new LogicException('No route');
}
$r=routeResult(1);expectEarly($r['auth_method']==='passkey'&&strlen($r['ticket'])===40&&!isset($r['user_id']));
expectEarly(!isset(routeResult(0)['ticket']));expectEarly(routeResult(1,'new@example.test')['auth_method']==='password');
$options['checkout_tabs_wp_ml_early_login_enabled']=0;expectEarly(routeResult(1)['ticket']==='');
echo "Early login: session-bound/expiring routing, correct account proof, no guest-profile overwrite, native reset link, neutral duplicate-safe shortcode and size/color limits passed.\n";
