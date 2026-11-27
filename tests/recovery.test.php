<?php
/** Isolated WordPress transport/storage fixtures; real module and encryption. No site/database called. */
define('ABSPATH',__DIR__.'/');define('ARRAY_A','ARRAY_A');define('DAY_IN_SECONDS',86400);define('COOKIEPATH','/');
define('CHECKOUT_TABS_WP_ML_URL','https://shop.example.test/plugin/');
$options=['ctwpml_recovery_schema'=>'1'];$admin=true;$logged=true;$nonce=true;$queries=[];$hooks=[];$transients=[];$orders=[];
function add_action($k,$v,...$a){$GLOBALS['hooks'][$k]=$v;}function add_filter(...$a){}function add_shortcode(...$a){}
function get_option($k,$d=false){return $GLOBALS['options'][$k]??$d;}function update_option($k,$v,...$a){$GLOBALS['options'][$k]=$v;}
function wp_salt($k){return 'fixture-only-'.$k;}function wp_json_encode($v){return json_encode($v);}
function wp_generate_uuid4(){return '12345678-1234-1234-1234-123456789abc';}
function sanitize_text_field($v){return is_scalar($v)?strip_tags((string)$v):'';}function sanitize_key($v){return preg_replace('/[^a-z0-9_-]/','',strtolower($v));}
function sanitize_email($v){return filter_var($v,FILTER_SANITIZE_EMAIL);}function is_email($v){return filter_var($v,FILTER_VALIDATE_EMAIL);}
function wp_unslash($v){return $v;}function absint($v){return abs((int)$v);}function current_user_can($cap){return $GLOBALS['admin']&&$cap==='manage_options';}
function is_user_logged_in(){return $GLOBALS['logged'];}function check_ajax_referer(...$a){return $GLOBALS['nonce'];}
function get_transient($k){return $GLOBALS['transients'][$k]??false;}function set_transient($k,$v,...$a){$GLOBALS['transients'][$k]=$v;}
function nocache_headers(){}function wp_create_nonce($k){return 'fixture-'.$k;}
function wp_send_json_success($v){throw new Recovery_JSON(true,$v,200);}function wp_send_json_error($v,$status=400){throw new Recovery_JSON(false,$v,$status);}
class Recovery_JSON extends RuntimeException {function __construct(public bool $ok,public array $data,public int $status){parent::__construct('fixture-json');}}
function ctwpml_is_visual_editor(){return false;}function is_admin(){return false;}function wp_enqueue_style(...$a){}function wp_enqueue_script(...$a){}function wp_localize_script(...$a){}
function checkout_tabs_wp_ml_get_version(){return '3.4.22';}function admin_url($v){return 'https://shop.example.test/wp-admin/'.$v;}
function get_queried_object_id(){return 55;}function shortcode_exists($tag){return $tag==='secure_passkeys_login_form';}function do_shortcode($s){return '<button data-native-login>Native passkey login</button>';}
function get_permalink($id=null){return 'https://shop.example.test/recuperacao/';}function wp_login_url($url=''){return 'https://shop.example.test/wp-login.php?redirect_to='.rawurlencode($url);}
function esc_url($s){return htmlspecialchars($s,ENT_QUOTES);}function is_ssl(){return true;}function wp_get_referer(){return $GLOBALS['referrer']??'';}
function wp_parse_url($s,$part=-1){return parse_url($s,$part);}
function get_post_meta(...$a){return '';}function wp_next_scheduled(...$a){return false;}function wp_schedule_single_event(...$a){$GLOBALS['scheduled']=$a;}
function wp_schedule_event(...$a){$GLOBALS['scheduled']=$a;}
function wc_get_order($id){return $GLOBALS['orders'][$id]??false;}
function wc_get_orders($args){$GLOBALS['pix_order_query']=$args;return $GLOBALS['pix_orders']??[];}
function esc_textarea($s){return htmlspecialchars($s,ENT_QUOTES);}
class Recovery_Product {function get_id(){return 42;}function get_name(){return '<b>Fixture product</b>';}}
class Recovery_Cart {
    public bool $empty=false;
    function is_empty(){return $this->empty;}
    function get_cart(){return $this->empty?[]:[['data'=>new Recovery_Product(),'quantity'=>2,'line_subtotal'=>20,'line_total'=>18]];}
    function get_total($context){return 23;}
}
class Recovery_Woo {
    public $cart;public $session;
    function __construct(){$this->cart=new Recovery_Cart();$this->session=new class {function get($key,$default=[]){return ['flat_rate:3'];}};}
    function shipping(){return new class {function get_packages(){return [['rates'=>['flat_rate:3'=>new class{function get_label(){return 'Motoboy';}function get_cost(){return 5;}}]]];}};}
}
$woo=new Recovery_Woo();function WC(){return $GLOBALS['woo'];}
class Recovery_Order {
    public array $meta=[];public string $status='pending';public string $email='fixture@example.test';
    function __construct(public int $id){}
    function get_id(){return $this->id;}function get_status(){return $this->status;}function get_meta($k){return $this->meta[$k]??0;}
    function update_meta_data($k,$v){$this->meta[$k]=$v;}function get_billing_email(){return $this->email;}
}
class Recovery_DB {
    public string $prefix='wp_';public int $insert_id=0;public array $current=[],$attempt=[],$target=[],$updates=[],$deleted=[];
    public int $result=1;public bool $locked=true;public array $columns=[];
    function prepare($query,...$values){foreach($values as $v){$query=preg_replace_callback('/%[sd]/',static fn($m)=>$m[0]==='%d'?(string)(int)$v:"'".str_replace("'","''",(string)$v)."'",$query,1);}return $query;}
    function get_row($sql,$type=null){
        $GLOBALS['queries'][]=$sql;
        if(str_contains($sql,'FROM wp_ctwpml_recovery_attempts'))return $this->attempt?:null;
        if(str_contains($sql,'identity_hash='))return $this->target?:null;
        if(str_contains($sql,'SELECT COUNT(DISTINCT'))return ['people'=>1,'errors'=>1,'recovered'=>0,'linked'=>0,'bought'=>0];
        return $this->current?:null;
    }
    function get_var($sql){
        $GLOBALS['queries'][]=$sql;
        if(str_contains($sql,'GET_LOCK'))return $this->locked?1:0;
        if(str_contains($sql,'SELECT case_id'))return $this->attempt['case_id']??0;
        return 0;
    }
    function get_results($sql,$type=null){$GLOBALS['queries'][]=$sql;return [];}
    function get_col($sql){$GLOBALS['queries'][]=$sql;return $this->columns;}
    function query($sql){$GLOBALS['queries'][]=$sql;return $this->result;}
    function update($table,$data,$where){$this->updates[]=[$table,$data,$where];return 1;}
    function delete($table,$where){$this->deleted[]=[$table,$where];return 1;}
    function esc_like($s){return addcslashes($s,'_%\\');}
}
$wpdb=new Recovery_DB();
require dirname(__DIR__).'/inc/security/class-key-vault.php';
require dirname(__DIR__).'/inc/admin/order-pix.php';
require dirname(__DIR__).'/packing-panel-woo-dev/inc/core/class-utils.php';
require dirname(__DIR__).'/inc/recovery/class-recovery.php';
if(in_array('--markup',$argv,true)){echo CTWPML_Recovery::shortcode();exit;}
function checkRecovery($test,$message){if(!$test)throw new LogicException($message);}
function callRecovery($method){try{CTWPML_Recovery::$method();}catch(Recovery_JSON $r){return $r;}throw new LogicException('Missing JSON response');}
$_SERVER=['REQUEST_METHOD'=>'POST','REMOTE_ADDR'=>'127.0.0.1'];$_POST=[];
// No read/mutation/export without role+nonce, including a logged-in ordinary customer.
$admin=false;foreach(['list','detail','update','logs','settings','pix'] as $op){$_POST=['operation'=>$op];$r=callRecovery('admin');checkRecovery(!$r->ok&&$r->status===403,'Customer reached admin API');}
checkRecovery(!$queries,'Unauthorized request queried storage');
$admin=true;$nonce=false;checkRecovery(callRecovery('admin')->status===403,'Missing admin nonce accepted');$nonce=true;
// Presentation: native shortcode for guests, no CRM data; ordinary authenticated users denied.
$logged=false;$admin=false;$html=CTWPML_Recovery::shortcode();checkRecovery(str_contains($html,'data-native-login')&&!str_contains($html,'data-records'),'Guest CRM leak');
$logged=true;checkRecovery(str_contains(CTWPML_Recovery::shortcode(),'Acesso restrito'),'Non-admin markup exposed');$admin=true;
// Strong write-only capability, expiry and tampering; it is NOT permission to read a profile.
$trace='12345678-1234-1234-1234-123456789abc';$proof=CTWPML_Recovery::proof($trace,time()+3600);
checkRecovery(CTWPML_Recovery::valid_proof($trace,$proof),'Valid trace failed');
checkRecovery(!CTWPML_Recovery::valid_proof(str_replace('abc','abd',$trace),$proof),'Other trace accepted');
checkRecovery(!CTWPML_Recovery::valid_proof($trace,CTWPML_Recovery::proof($trace,time()-1)),'Expired trace accepted');
checkRecovery(!CTWPML_Recovery::valid_proof($trace,'invalid'),'Invalid capability accepted');
$contact=CTWPML_Recovery::contact(['name'=>'<b>Fixture</b>','email'=>'fixture@example.test','phone'=>'+55 (11) 99999-0000','cpf'=>'not-retained','password'=>'secret','city'=>['malformed']]);
checkRecovery($contact['name']==='Fixture'&&$contact['city']===''&&!isset($contact['cpf'],$contact['password']),'Contact allowlist failed');
checkRecovery(CTWPML_Recovery::identity($contact)===CTWPML_Recovery::identity(['email'=>'FIXTURE@example.test']),'Email dedup failed');
checkRecovery(CTWPML_Recovery::identity(['phone'=>'1'])==='','Invalid short phone identified');
$safe=CTWPML_Recovery::detail(['email'=>'secret@example.test','password'=>'secret','payload_pix'=>'secret','reason'=>'email@example.test','navigation'=>'https://evil.example.test/?token=secret','request'=>'not-a-request','status'=>500,'hasRedirect'=>true,'width'=>-7]);
checkRecovery($safe===['status'=>500,'width'=>0,'hasRedirect'=>true],'Technical history leaked data');
$env=CTWPML_Key_Vault::encrypt('recovery-contact',json_encode($contact));
checkRecovery(CTWPML_Key_Vault::decrypt('recovery-contact',$env)===json_encode($contact),'Contact encryption round trip failed');
checkRecovery(CTWPML_Key_Vault::decrypt('wrong-context',$env)===null,'AAD isolation failed');
checkRecovery(!str_contains(json_encode($env),'fixture@example.test'),'Contact stored in plaintext');
// Native record path: merging changes the attempt parent, keeps events, and rejects an identity switch.
$wpdb->current=['id'=>9,'state'=>'attention','has_error'=>1,'contact'=>json_encode($env)];
$wpdb->target=['id'=>20,'contact'=>json_encode($env)];
$record=new ReflectionMethod(CTWPML_Recovery::class,'record');if(PHP_VERSION_ID<80100)$record->setAccessible(true);
$record->invoke(null,['id'=>7,'case_id'=>9],['contact'=>$contact,'context'=>['total'=>999],'events'=>[]]);
checkRecovery((bool)array_filter($wpdb->updates,fn($v)=>str_ends_with($v[0],'attempts')&&$v[1]===['case_id'=>20]&&$v[2]===['case_id'=>9]),'Repeated contact not consolidated');
checkRecovery(in_array(['wp_ctwpml_recovery_cases',['id'=>9]],$wpdb->deleted,true),'Empty duplicate case not removed');
checkRecovery((bool)array_filter($queries,fn($q)=>str_contains($q,'"total":23')&&str_contains($q,'"freight":5')),'Cart snapshot not derived from WooCommerce');
$switched=$contact;$switched['email']='different@example.test';
try{$record->invoke(null,['id'=>7,'case_id'=>9],['contact'=>$switched]);throw new LogicException('Identity switch mixed people');}catch(DomainException $e){checkRecovery($e->getMessage()==='identity_changed','Unexpected identity failure');}
$wpdb->target=[];
// Detection uses only the signed attempt: arbitrary id/email never attach an order.
$wpdb->attempt=['id'=>7,'case_id'=>9,'trace_id'=>$trace,'page_id'=>$trace];
$order=new Recovery_Order(1052);$_POST=['ctwpml_recovery_trace'=>$trace,'ctwpml_recovery_proof'=>'bad'];
$options[CTWPML_Recovery::OPTION]=['enabled'=>true];
CTWPML_Recovery::attach_order($order);checkRecovery(!$order->meta,'Forged order correlation accepted');
$_POST['ctwpml_recovery_proof']=$proof;CTWPML_Recovery::attach_order($order);checkRecovery($order->meta['_ctwpml_recovery_attempt']===7,'Signed correlation missing');
$orders[1052]=$order;$before=count($queries);CTWPML_Recovery::order_processing(1052);checkRecovery(count($queries)===$before,'Pending order closed a case');
$order->status='processing';CTWPML_Recovery::order_processing(1052);
checkRecovery((bool)array_filter($queries,fn($q)=>str_contains($q,"state='bought'")&&str_contains($q,'WHERE id=9 AND order_id=0')),'Authoritative purchase not idempotently linked');
// Stale revisions and completed purchases cannot be moved by UI/bulk.
$wpdb->current=['id'=>9,'revision'=>3,'order_id'=>1052,'contact'=>json_encode($env),'state'=>'bought','context'=>'{}'];
$_POST=['operation'=>'update','ids'=>[9],'state'=>'attention','revisions'=>[9=>2]];$r=callRecovery('admin');checkRecovery($r->data['conflicts']===[9],'Stale revision accepted');
$_POST['revisions']=[9=>3];$r=callRecovery('admin');checkRecovery($r->data['conflicts']===[9],'Purchased case reopened');
$wpdb->current['order_id']=0;$wpdb->current['state']='attention';
$_POST=['operation'=>'update','ids'=>[9],'state'=>'recovered','revisions'=>[9=>3]];$r=callRecovery('admin');checkRecovery($r->data['updated']===[9],'Manual recovery wrongly requires order');
$_POST['state']='link';$_POST['order']=1052;$order->email='other@example.test';checkRecovery(!callRecovery('admin')->ok,'Wrong order linked to contact');
$order->email='fixture@example.test';checkRecovery(callRecovery('admin')->ok,'Matching optional order rejected');
// Saved gateway payload is read verbatim, never added to diagnostic exports.
$pixCode='000201BR.GOV.BCB.PIXabcABC6304FFFF';
$order->meta['__ASAAS_ORDER']=json_encode(['payload'=>$pixCode]);
checkRecovery(ctwpml_order_pix_payload($order)===$pixCode,'JSON gateway payload changed case or bytes');
checkRecovery(PPWOO_Utils::get_pix_identifier(['__ASAAS_ORDER'=>json_encode(['payload'=>$pixCode])])===$pixCode,'PackPanel JSON reader changed the saved Pix');
checkRecovery(ctwpml_order_pix_payload(['__ASAAS_ORDER'=>(object)['pix_payload'=>$pixCode]])===$pixCode,'Object gateway payload unreadable');
checkRecovery(ctwpml_order_pix_payload(['__ASAAS_ORDER'=>['payload'=>['bad'],'pixCopiaECola'=>$pixCode]])===$pixCode,'Malformed candidate prevented valid fallback');
checkRecovery(ctwpml_order_pix_payload(['__ASAAS_ORDER'=>'invalid-json'])==='','Malformed metadata produced a charge');
$wpdb->columns=[7];$pix_orders=[$order];$_POST=['operation'=>'pix','id'=>9];
$r=callRecovery('admin');checkRecovery($r->ok&&$r->data['payload']===$pixCode&&$r->data['pending']===false,'Paid order payload incorrectly marked payable');
$order->status='pending';$r=callRecovery('admin');checkRecovery($r->data['pending']===true,'Pending saved charge unavailable');
checkRecovery($pix_order_query['meta_query'][0]['value']===[7],'HPOS query missing signed attempt binding');
$query=CTWPML_Recovery::order_query([],['ctwpml_recovery_attempts'=>[7]]);checkRecovery($query['meta_query'][0]['value']===[7],'Classic query missing attempt binding');
$order->meta['_ctwpml_recovery_attempt']=99;checkRecovery(callRecovery('admin')->data['available']===false,'Unrelated order revealed by ignored storage filter');
$order->meta['_ctwpml_recovery_attempt']=7;$wpdb->columns=[];
$wpdb->current['manual_order_id']=1052;checkRecovery(callRecovery('admin')->data['payload']===$pixCode,'Explicit matching order Pix unavailable');
$order->email='other@example.test';checkRecovery(callRecovery('admin')->data['available']===false,'Changed order contact bypassed association check');
$order->email='fixture@example.test';$wpdb->current['manual_order_id']=0;
$admin=false;ob_start();ctwpml_admin_order_pix_box($order);checkRecovery(ob_get_clean()==='','Customer reached order Pix box');$admin=true;
ob_start();ctwpml_admin_order_pix_box($order);$box=ob_get_clean();checkRecovery(str_contains($box,$pixCode)&&str_contains($box,'data-order-pix-copy'),'Order admin lacks saved Pix copy');
// Failed request / disabled capture stays write-only and leaves shop data alone.
$options[CTWPML_Recovery::OPTION]=['enabled'=>false];$_POST=[];checkRecovery(callRecovery('capture')->status===409,'Capture enabled by visitor');
$options[CTWPML_Recovery::OPTION]=['enabled'=>true];$_POST=['batch'=>json_encode(['page'=>$trace,'operation'=>'append','trace'=>$trace,'proof'=>'invalid'])];
checkRecovery(callRecovery('capture')->status===403,'Unsigned write accepted');
$admin=false;$wpdb->attempt=['id'=>7,'case_id'=>9,'trace_id'=>$trace,'page_id'=>$trace];
$_POST=['batch'=>json_encode(['page'=>$trace,'operation'=>'append','trace'=>$trace,'proof'=>$proof,'state'=>'bought','order_id'=>1052,'context'=>['total'=>999],'contact'=>$contact,'events'=>[['key'=>$trace,'name'=>'REQUEST_NETWORK_ERROR','ok'=>false,'detail'=>['status'=>500,'password'=>'must-not-log']]]])];
$before=count($queries);$r=callRecovery('capture');
checkRecovery($r->ok&&array_keys($r->data)===['trace','proof'],'Write endpoint exposed CRM data');
$new=implode("\n",array_slice($queries,$before));
checkRecovery(!str_contains($new,"state='bought'")&&!str_contains($new,'must-not-log'),'Visitor forged finance or logged a secret');
$nonce=false;checkRecovery(callRecovery('capture')->ok,'Login nonce rotation interrupted a signed execution');
$invalid=json_decode($_POST['batch'],true);$invalid['proof']='invalid';$_POST['batch']=json_encode($invalid);
checkRecovery(callRecovery('capture')->status===403,'Invalid nonce and proof authorized a write');$nonce=true;
$woo->cart->empty=true;$_POST=['batch'=>json_encode(['page'=>$trace,'operation'=>'begin'])];$r=callRecovery('capture');checkRecovery($r->status===409&&$r->data['code']==='no_cart','Started recovery without a cart');
$woo->cart->empty=false;$admin=true;
// Scoped passkey return, not a global redirect of other login pages.
$expiry=time()+600;$base='55.'.$expiry;$_COOKIE['ctwpml_recovery_return']=$base.'.'.hash_hmac('sha256',$base,wp_salt('auth'));
$referrer='https://shop.example.test/other/';checkRecovery(CTWPML_Recovery::login_redirect('native')==='native','Unrelated login redirected');
$referrer='https://shop.example.test/recuperacao/';checkRecovery(CTWPML_Recovery::login_redirect('native')===get_permalink(55),'Recovery login lost return');
$_COOKIE['ctwpml_recovery_return'].='x';checkRecovery(CTWPML_Recovery::login_redirect('native')==='native','Tampered redirect cookie accepted');
if(in_array('--pix-markup',$argv,true)){echo $box;exit;}
echo "Recovery: admin/nonce, privacy, encryption, signed correlation, purchase, conflicts, optional order and login return passed.\n";
