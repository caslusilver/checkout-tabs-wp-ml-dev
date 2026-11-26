<?php
define('ABSPATH',__DIR__);$hooks=[];$options=[];$counts=[];$remoteCalls=0;$remoteMode='valid';$nonce=true;$created=0;$auth=0;$existing=false;$creationError=false;$passwordError=false;$debug=false;$diagnostics=[];
class WP_Error { function __construct(public $code='',public $message=''){}function get_error_code(){return $this->code;}function get_error_message(){return $this->message;} }
class WP_User {function __construct(public $ID=42,public $user_email='fixture@example.test'){} }
function add_action($key,$fn,...$args){$GLOBALS['hooks'][$key]=$fn;}function get_option($key,$default=false){return $GLOBALS['options'][$key]??$default;}
function is_wp_error($v){return $v instanceof WP_Error;}function wp_unslash($v){return $v;}function sanitize_text_field($v){return strip_tags($v);}function sanitize_email($v){return $v;}function is_email($v){return filter_var($v,FILTER_VALIDATE_EMAIL);}function sanitize_user($v){return $v;}function wp_strip_all_tags($v){return strip_tags($v);}
function check_ajax_referer(...$args){return $GLOBALS['nonce'];}function get_transient($key){return $GLOBALS['counts'][$key]??0;}function set_transient($key,$v,...$args){$GLOBALS['counts'][$key]=$v;}
function home_url($path='/'){return 'https://shop.example.test'.$path;}function site_url($path='/',$scheme=null){return home_url($path);}function wp_parse_url(...$a){return parse_url(...$a);}
function wp_remote_post($url,$args){$GLOBALS['remoteCalls']++;$GLOBALS['remoteArgs']=$args;return $GLOBALS['remoteMode']==='network'?new WP_Error('network'):['mode'=>$GLOBALS['remoteMode']];}
function wp_remote_retrieve_response_code($r){return $r['mode']==='http'?503:200;}
function wp_remote_retrieve_body($r){return match($r['mode']){'json'=>'bad-json','rejected'=>json_encode(['success'=>false]),'host'=>json_encode(['success'=>true,'hostname'=>'other.example.test']),default=>json_encode(['success'=>true,'hostname'=>'shop.example.test'])};}
function checkout_tabs_wp_ml_is_debug_enabled(){return $GLOBALS['debug'];}function wc_get_logger(){return new class {function info($s,$context){$GLOBALS['diagnostics'][]=$s;}};}
function wp_send_json_error($data,$status=400){throw new RuntimeException(json_encode(['ok'=>false,'data'=>$data,'status'=>$status]));}function wp_send_json_success($data){throw new RuntimeException(json_encode(['ok'=>true,'data'=>$data]));}
function get_user_by($field,$value){return $field==='email'?($GLOBALS['existing']?new WP_User():false):new WP_User((int)$value);}
function email_exists($v){return $GLOBALS['existing'];}function username_exists($v){return false;}function wp_generate_password(...$args){return 'fixture-password';}
function wc_create_new_customer(...$args){$GLOBALS['created']++;return $GLOBALS['creationError']?new WP_Error('creation_failed','Unable to create'):42;}
function wp_update_user(...$args){}function update_user_meta(...$args){}function wp_set_current_user($id){$GLOBALS['auth']=$id;}function wp_set_auth_cookie($id,$remember){$GLOBALS['auth']=$id;}
function is_ssl(){return true;}function wp_signon($creds,$secure){return $GLOBALS['passwordError']?new WP_Error('password','Wrong password'):new WP_User();}
function ctwpml_migrate_guest_data_to_user($id){$GLOBALS['migrated']=$id;}function ctwpml_preserve_auth_coupons(){$GLOBALS['coupons']=true;}
// Markup original para QA no navegador, usando exclusivamente chaves fictícias.
if (in_array('--markup',$argv,true)) {
 function esc_attr($s){return htmlspecialchars($s,ENT_QUOTES);}function esc_url($s){return htmlspecialchars($s,ENT_QUOTES);}
 function ctwpml_is_checkout_ui_request(){return true;}function is_user_logged_in(){return false;}
 $options=['checkout_tabs_wp_ml_recaptcha_enabled'=>in_array('--disabled',$argv,true)?0:1,'checkout_tabs_wp_ml_recaptcha_site_key'=>'fixture-public','checkout_tabs_wp_ml_recaptcha_secret_key'=>'fixture-secret'];
 require dirname(__DIR__).'/inc/security/recaptcha.php';require dirname(__DIR__).'/inc/frontend/login-popup.php';
 $hooks['wp_footer']();exit;
}
require dirname(__DIR__).'/inc/security/recaptcha.php';require dirname(__DIR__).'/inc/ajax-auth-email.php';require dirname(__DIR__).'/inc/ajax-login.php';require dirname(__DIR__).'/inc/ajax-signup.php';
function yes($v){if(!$v)throw new LogicException('Unexpected authentication result');}
function callAuth($name){try{$name();}catch(RuntimeException $e){return json_decode($e->getMessage(),true);}throw new LogicException('No JSON response');}
$_SERVER=['REQUEST_METHOD'=>'POST','REMOTE_ADDR'=>'127.0.0.1'];$_POST=['email'=>'fixture@example.test','name'=>'Cliente Fixture','password'=>'fixture','recaptcha_response'=>'fixture-token'];
yes(ctwpml_recaptcha_enabled());yes(is_wp_error(ctwpml_verify_checkout_recaptcha('fixture-token')));yes($remoteCalls===0);
$options=['login_nocaptcha_options'=>['site_key'=>'legacy-public','secret_key'=>'legacy-secret']];yes(ctwpml_recaptcha_keys()['site_key']==='legacy-public');
$options['checkout_tabs_wp_ml_recaptcha_site_key']='own-public';yes(ctwpml_recaptcha_keys()['secret_key']==='');
$options['checkout_tabs_wp_ml_recaptcha_secret_key']='own-secret';yes(ctwpml_verify_checkout_recaptcha('fixture-token')===true);yes($remoteArgs['timeout']===10);
foreach(['network','http','json','rejected','host'] as $remoteMode)yes(is_wp_error(ctwpml_verify_checkout_recaptcha('fixture-token')));$remoteMode='valid';
yes(is_wp_error(ctwpml_verify_checkout_recaptcha([])));yes(is_wp_error(ctwpml_verify_checkout_recaptcha('')));
// Um parâmetro do visitante nunca desativa a política do servidor.
$_POST['recaptcha_enabled']=0;$_POST['recaptcha_response']='';$r=callAuth('ctwpml_ajax_auth_email');yes(!$r['ok']&&$created===0&&$auth===0);
$options['checkout_tabs_wp_ml_recaptcha_enabled']=0;$before=$remoteCalls;$r=callAuth('ctwpml_ajax_auth_email');yes($r['ok']&&$auth===42&&$created===1&&$remoteCalls===$before);
$auth=0;$existing=true;$r=callAuth('ctwpml_ajax_auth_email');yes(!$r['ok']&&$auth===0&&$created===1);$existing=false;
$creationError=true;$r=callAuth('ctwpml_ajax_auth_email');yes(!$r['ok']&&$auth===0);$creationError=false;
$counts=[];$creationError=true;$r=callAuth('ctwpml_ajax_signup');yes(!$r['ok']&&$auth===0);$creationError=false;
$r=callAuth('ctwpml_ajax_signup');yes($r['ok']&&$auth===42);
$auth=0;$passwordError=true;$r=callAuth('checkout_tabs_wp_ml_ajax_login');yes(!$r['ok']&&$auth===0);$passwordError=false;yes(callAuth('checkout_tabs_wp_ml_ajax_login')['ok']);
// Sem captcha, POST, nonce e limite continuam exigidos nos três endpoints.
foreach(['ctwpml_ajax_auth_email','ctwpml_ajax_signup','checkout_tabs_wp_ml_ajax_login'] as $fn){
 $counts=[];$nonce=false;yes(!callAuth($fn)['ok']);$nonce=true;$_SERVER['REQUEST_METHOD']='GET';yes(!callAuth($fn)['ok']);$_SERVER['REQUEST_METHOD']='POST';
}
$counts=[];for($i=0;$i<5;$i++)yes(ctwpml_auth_request_guard('ctwpml_auth_email')===true);yes(ctwpml_auth_request_guard('ctwpml_auth_email')->get_error_code()==='rate_limited');
$counts=[];for($i=0;$i<10;$i++)yes(ctwpml_auth_request_guard('ctwpml_login')===true);yes(is_wp_error(ctwpml_auth_request_guard('ctwpml_login')));
$debug=true;$options['checkout_tabs_wp_ml_recaptcha_enabled']=1;$remoteMode='rejected';ctwpml_verify_checkout_recaptcha('private-fixture-token');yes(!str_contains(implode(' ',$diagnostics),'private-fixture-token'));yes(!str_contains(implode(' ',$diagnostics),'own-secret'));
$counts=[];$auth=0;$_POST['recaptcha_response']='fixture-token';$remoteMode='network';yes(!callAuth('ctwpml_ajax_auth_email')['ok']&&$auth===0);
$remoteMode='valid';$beforeCreated=$created;yes(callAuth('ctwpml_ajax_auth_email')['ok']&&$auth===42&&$created===$beforeCreated+1);
echo "reCAPTCHA: padrão ativo, par de chaves consistente, validação fechada em erro/host, desligamento só pelo servidor, novo usuário, erro de criação, conta existente, senha, POST/nonce/limites e logs sem segredos passaram.\n";
