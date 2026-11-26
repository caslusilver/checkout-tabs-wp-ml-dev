<?php
define('ABSPATH',__DIR__);
function add_action(...$args){}
function check_ajax_referer(...$args){return $GLOBALS['nonce'];}
function sanitize_email($s){return filter_var($s,FILTER_SANITIZE_EMAIL);}function wp_unslash($s){return $s;}function is_email($s){return filter_var($s,FILTER_VALIDATE_EMAIL);}
function get_transient($key){return $GLOBALS['count'];}function set_transient($key,$n,...$args){$GLOBALS['count']=$n;}
function email_exists($s){return $GLOBALS['existing'];}
class CTWPML_Passkeys {static function has_keys($id){return $GLOBALS['has'];}}
function wp_send_json_error($data,$status=400){throw new RuntimeException(json_encode(['ok'=>false,'status'=>$status,'data'=>$data]));}
function wp_send_json_success($data){throw new RuntimeException(json_encode(['ok'=>true,'data'=>$data]));}
require dirname(__DIR__).'/inc/ajax-check-email.php';
function route(){try{ctwpml_ajax_check_email_exists();}catch(RuntimeException $e){return json_decode($e->getMessage(),true);}throw new LogicException('Missing result');}
function eq($a,$b){if($a!==$b)throw new LogicException('Unexpected route result');}
$nonce=true;$count=0;$existing=42;$has=true;$_SERVER=['REQUEST_METHOD'=>'POST','REMOTE_ADDR'=>'127.0.0.1'];$_POST=['email'=>'fixture@example.test'];
eq(route()['data'],['exists'=>1,'auth_method'=>'passkey']);$has=false;eq(route()['data']['auth_method'],'password');$existing=0;eq(route()['data'],['exists'=>0,'auth_method'=>'password']);
$count=20;eq(route()['status'],429);$count=0;$nonce=false;eq(route()['ok'],false);$nonce=true;$_SERVER['REQUEST_METHOD']='GET';eq(route()['status'],405);
$_SERVER['REQUEST_METHOD']='POST';$_POST=['email'=>['bad']];eq(route()['ok'],false);
echo "Rota de acesso: POST/nonce/limite, conta nova, existente com/sem chave, sem retornar e-mail/IDs/credenciais passaram.\n";
