<?php
define('ABSPATH',__DIR__);$filters=[];$logged=false;$existing=false;$created=101;$createCalls=0;$auth=0;$migrated=0;$fail=false;
function add_filter($name,$fn,...$args){$GLOBALS['filters'][$name]=$fn;}function add_action(...$args){}
function is_user_logged_in(){return $GLOBALS['logged'];}function get_option($name,$default=false){return $name==='woocommerce_enable_guest_checkout'?'no':$default;}
function wp_unslash($s){return $s;}function sanitize_email($s){return $s;}function is_email($s){return filter_var($s,FILTER_VALIDATE_EMAIL);}function email_exists($s){return $GLOBALS['existing'];}function sanitize_user($s){return $s;}function username_exists($s){return false;}function wp_generate_password(...$a){return 'fixture-password';}
class New_User_Error{}function is_wp_error($v){return $v instanceof New_User_Error;}
function wc_create_new_customer(...$args){$GLOBALS['createCalls']++;return $GLOBALS['fail']?new New_User_Error():$GLOBALS['created'];}
function wc_set_customer_auth_cookie($id){$GLOBALS['auth']=$id;$GLOBALS['logged']=true;}
function ctwpml_migrate_guest_data_to_user($id){$GLOBALS['migrated']=$id;}
class New_User_Session{public $data=['ctwpml_guest_created_user_id'=>777];public $saved=false;function get($k){return $this->data[$k]??null;}function set($k,$v){$this->data[$k]=$v;}function save_data(){$this->saved=true;}}
class New_User_Cart{public $recalculated=false;function calculate_totals(){$this->recalculated=true;}}
$woo=(object)['session'=>new New_User_Session(),'cart'=>new New_User_Cart()];function WC(){return $GLOBALS['woo'];}function ctwpml_get_wc_session(){return WC()->session;}
class New_User_Checkout{function get_value($key){return 'new@example.test';}}
require dirname(__DIR__).'/inc/frontend/guest-checkout.php';
$create=$filters['woocommerce_checkout_customer_id'];$checkout=new New_User_Checkout();
function ok($value){if(!$value)throw new RuntimeException('Unsafe customer provisioning');}
$existing=42;ok($create(0,$checkout)===0&&$auth===0&&$createCalls===0);$existing=false;$fail=true;ok($create(0,$checkout)===0&&$auth===0&&$migrated===0);$fail=false;
ok($create(0,$checkout)===101&&$auth===101&&$migrated===101&&$woo->session->saved&&$woo->cart->recalculated);ok($auth!==777);
ok($create(101,$checkout)===101&&$createCalls===2);
echo "Conta nova: apenas criação válida autentica, erro/existente não autentica, ID antigo de sessão não concede acesso e helper nativo é usado.\n";
