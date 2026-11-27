<?php
if (!defined('ABSPATH')) exit;

/** Recuperação é observação/atendimento; nunca altera pagamento ou autentica um comprador. */
final class CTWPML_Recovery {
    const SCHEMA = '1';
    const OPTION = 'ctwpml_recovery_settings';
    const CLOSED = ['bought','recovered','lost'];
    public static function init(): void {
        add_shortcode('checkout_ml_recuperacao', [__CLASS__, 'shortcode']);
        add_action('template_redirect',[__CLASS__,'protect_page'],0);
        add_action('wp_enqueue_scripts', [__CLASS__, 'capture_assets'], 120);
        foreach (['wp_ajax_ctwpml_recovery_capture','wp_ajax_nopriv_ctwpml_recovery_capture'] as $hook) add_action($hook,[__CLASS__,'capture']);
        add_action('wp_ajax_ctwpml_recovery_admin',[__CLASS__,'admin']);
        add_action('admin_menu',static function(){
            add_submenu_page('checkout-tabs-wp-ml','Recuperação','Recuperação','manage_options','ctwpml-recovery',static function(){echo CTWPML_Recovery::shortcode();});
        });
        add_action('woocommerce_checkout_create_order',[__CLASS__,'attach_order'],20,2);
        add_action('woocommerce_order_status_processing',[__CLASS__,'order_processing']);
        add_action('ctwpml_recovery_cleanup',[__CLASS__,'cleanup']);
        add_filter('secure_passkeys_login_redirect_url',[__CLASS__,'login_redirect'],30);
    }
    public static function settings(): array {
        $s=(array)get_option(self::OPTION,[]);
        return ['enabled'=>!empty($s['enabled']), 'idle'=>max(1,min(120,(int)($s['idle']??15)))];
    }
    public static function protect_page(): void {
        global $post;
        if(!$post||empty($post->ID))return;
        $content=(string)($post->post_content??'');
        $elementor=(string)get_post_meta($post->ID,'_elementor_data',true);
        if(strpos($content,'checkout_ml_recuperacao')===false&&strpos($elementor,'checkout_ml_recuperacao')===false)return;
        if(!defined('DONOTCACHEPAGE'))define('DONOTCACHEPAGE',true);
        if(headers_sent())return;
        nocache_headers();
        if(!is_user_logged_in()){
            $expiry=time()+900;$value=(int)$post->ID.'.'.$expiry;
            setcookie('ctwpml_recovery_return',$value.'.'.hash_hmac('sha256',$value,wp_salt('auth')),['expires'=>$expiry,'path'=>COOKIEPATH?:'/','secure'=>is_ssl(),'httponly'=>true,'samesite'=>'Lax']);
        }
    }
    private static function table(string $name): string { global $wpdb; return $wpdb->prefix.'ctwpml_recovery_'.$name; }
    private static function now(): string { return gmdate('Y-m-d H:i:s'); }
    public static function install(): bool {
        global $wpdb;
        if (get_option('ctwpml_recovery_schema')===self::SCHEMA) {
            if (!wp_next_scheduled('ctwpml_recovery_cleanup')) wp_schedule_event(time()+3600,'daily','ctwpml_recovery_cleanup');
            return true;
        }
        require_once ABSPATH.'wp-admin/includes/upgrade.php';
        $charset=$wpdb->get_charset_collate();$c=self::table('cases');$a=self::table('attempts');$e=self::table('events');
        dbDelta("CREATE TABLE $c (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            identity_hash varchar(64) NOT NULL,
            identified tinyint NOT NULL DEFAULT 0,
            contact longtext NOT NULL,
            context longtext NOT NULL,
            state varchar(20) NOT NULL DEFAULT 'active',
            has_error tinyint NOT NULL DEFAULT 0,
            order_id bigint unsigned NOT NULL DEFAULT 0,
            manual_order_id bigint unsigned NOT NULL DEFAULT 0,
            revision bigint unsigned NOT NULL DEFAULT 1,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY identity_state (identity_hash,state),
            KEY activity (updated_at),
            KEY queue (state,has_error)
        ) ENGINE=InnoDB $charset;");
        dbDelta("CREATE TABLE $a (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            trace_id varchar(36) NOT NULL,
            page_id varchar(36) NOT NULL,
            case_id bigint unsigned NOT NULL,
            device longtext NOT NULL,
            device_type varchar(20) NOT NULL DEFAULT 'unknown',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY trace_id (trace_id),
            KEY case_id (case_id)
        ) ENGINE=InnoDB $charset;");
        dbDelta("CREATE TABLE $e (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            attempt_id bigint unsigned NOT NULL,
            event_key varchar(64) NOT NULL,
            name varchar(80) NOT NULL,
            ok tinyint NOT NULL DEFAULT 1,
            detail longtext NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY deduplicate (attempt_id,event_key),
            KEY attempt_time (attempt_id,id)
        ) ENGINE=InnoDB $charset;");
        foreach ([$c,$a,$e] as $t) if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s',$wpdb->esc_like($t)))!==$t) return false;
        update_option('ctwpml_recovery_schema',self::SCHEMA,false);
        if (!wp_next_scheduled('ctwpml_recovery_cleanup')) wp_schedule_event(time()+3600,'daily','ctwpml_recovery_cleanup');
        return true;
    }
    public static function identity(array $contact): string {
        $email=strtolower(trim((string)($contact['email']??'')));
        $phone=preg_replace('/\D/','',(string)($contact['phone']??''));
        $raw=is_email($email)?'email:'.$email:(strlen($phone)>=8&&strlen($phone)<=15?'phone:'.$phone:'');
        return $raw!==''?hash_hmac('sha256',$raw,wp_salt('auth')):'';
    }
    private static function protect(array $data): string {
        return wp_json_encode(CTWPML_Key_Vault::encrypt('recovery-contact',wp_json_encode($data)));
    }
    private static function reveal(string $data): array {
        $plain=CTWPML_Key_Vault::decrypt('recovery-contact',(array)json_decode($data,true));
        return is_string($plain)?(array)json_decode($plain,true):[];
    }
    public static function contact(array $data): array {
        $plain=static function($v,int $length):string{$v=is_scalar($v)?sanitize_text_field((string)$v):'';return function_exists('mb_substr')?mb_substr($v,0,$length):substr($v,0,$length);};
        return ['name'=>$plain($data['name']??'',100),
            'email'=>sanitize_email($plain($data['email']??'',254)),
            'phone'=>substr(preg_replace('/[^+\d]/','',$plain($data['phone']??'',40)),0,18),
            'city'=>$plain($data['city']??'',80),
            'region'=>$plain($data['region']??'',10)];
    }
    /** Allowlist: dados livres/PII nunca são copiados do logger para o histórico técnico. */
    public static function detail(array $data): array {
        $out=[];
        foreach (['stage','action','route','result','reason','field','navigation','version','request','source'] as $key) {
            if (isset($data[$key])&&is_scalar($data[$key])) {
                $v=(string)$data[$key];
                // Códigos técnicos, não mensagens arbitrárias/URLs com parâmetros ou segredos.
                if (preg_match('/^[a-zA-Z0-9_.:\/-]{1,100}$/D',$v)) $out[$key]=$v;
            }
        }
        if(isset($out['request'])&&!preg_match('/^[a-f0-9-]{36}$/D',$out['request']))unset($out['request']);
        if(isset($out['version'])&&!preg_match('/^\d+\.\d+\.\d+$/D',$out['version']))unset($out['version']);
        if(isset($out['navigation'])&&!in_array($out['navigation'],['home','checkout','thankyou','other','external','same','unknown'],true))unset($out['navigation']);
        if(isset($out['route'])&&!in_array($out['route'],['woo_ajax','admin_ajax'],true))unset($out['route']);
        foreach (['status','duration','line','column','width','height','sequence','elapsed'] as $key)
            if (isset($data[$key])&&is_numeric($data[$key])) $out[$key]=max(0,min(86400000,(int)$data[$key]));
        foreach (['hasRedirect','hidden','online','persisted','checked','pending','billingReady','paymentReady','appliedMatch','totalsReady','pendingWooUpdate','pendingShipping','hasEmail','hasPhone','hasAddressId','hasBillingSnapshot','hasFormSnapshot','autoSubmit','resumeAfterAuth','isLoggedIn'] as $key)
            if (isset($data[$key])&&is_bool($data[$key])) $out[$key]=$data[$key];
        return $out;
    }
    public static function device(array $data): array {
        $out=[];
        foreach (['os','browser','type'] as $k) $out[$k]=substr(preg_replace('/[^a-zA-Z0-9 ._-]/','',(string)($data[$k]??'unknown')),0,60);
        if(!in_array($out['type'],['mobile','desktop','unknown'],true))$out['type']='unknown';
        $out['width']=max(0,min(10000,(int)($data['width']??0)));
        $out['height']=max(0,min(10000,(int)($data['height']??0)));
        $out['touch']=!empty($data['touch']);
        return $out;
    }
    public static function proof(string $trace,int $expires): string {
        return $expires.'.'.hash_hmac('sha256','recovery|'.$trace.'|'.$expires,wp_salt('auth'));
    }
    public static function valid_proof(string $trace,string $proof): bool {
        if (!preg_match('/^[a-f0-9-]{36}$/D',$trace)||!preg_match('/^(\d{10})\.[a-f0-9]{64}$/D',$proof,$m)) return false;
        $expires=(int)$m[1];
        return $expires>=time()&&$expires<=time()+86400&&hash_equals(self::proof($trace,$expires),$proof);
    }
    private static function limit(string $kind,int $max): bool {
        $key='ctwpml_rec_'.hash_hmac('sha256',$kind.'|'.($_SERVER['REMOTE_ADDR']??'').'|'.gmdate('YmdHi'),wp_salt('nonce'));
        $n=(int)get_transient($key);if($n>=$max)return false;
        set_transient($key,$n+1,90);return true;
    }
    public static function capture_assets(): void {
        if (!self::settings()['enabled']||ctwpml_is_visual_editor()) return;
        wp_enqueue_script('ctwpml-recovery-capture',CHECKOUT_TABS_WP_ML_URL.'assets/js/recovery-capture.js',['jquery'],checkout_tabs_wp_ml_get_version(),false);
        wp_localize_script('ctwpml-recovery-capture','ctwpmlRecoveryCapture',['url'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('ctwpml_recovery_capture'),'version'=>checkout_tabs_wp_ml_get_version(),'checkout'=>ctwpml_is_checkout_ui_request()]);
    }
    public static function capture(): void {
        nocache_headers();
        if (($_SERVER['REQUEST_METHOD']??'')!=='POST') wp_send_json_error(['code'=>'invalid_request'],403);
        $raw=(string)wp_unslash($_POST['batch']??'');if(strlen($raw)>24000)wp_send_json_error(['code'=>'too_large'],413);
        $body=json_decode($raw,true);
        // O nonce de visitante muda após login sem reload. A prova já emitida autoriza
        // somente continuar aquela execução; não dá acesso administrativo ou a contatos.
        $signed=is_array($body)&&self::valid_proof((string)($body['trace']??''),(string)($body['proof']??''));
        $valid_nonce=check_ajax_referer('ctwpml_recovery_capture','nonce',false);
        if(!$valid_nonce&&!$signed)wp_send_json_error(['code'=>'invalid_request'],403);
        if (!self::settings()['enabled']||get_option('ctwpml_recovery_schema')!==self::SCHEMA) wp_send_json_error(['code'=>'disabled'],409);
        if (!self::limit('capture',120)) wp_send_json_error(['code'=>'rate_limit'],429);
        if(!is_array($body))wp_send_json_error(['code'=>'invalid_body'],400);
        if(function_exists('WC')&&!WC()->cart&&function_exists('wc_load_cart'))wc_load_cart();
        global $wpdb;$a=self::table('attempts');$c=self::table('cases');
        $trace=(string)($body['trace']??'');$proof=(string)($body['proof']??'');
        $page=(string)($body['page']??'');
        if(!preg_match('/^[a-f0-9-]{36}$/D',$page))wp_send_json_error(['code'=>'invalid_page'],400);
        $attempt=self::valid_proof($trace,$proof)?$wpdb->get_row($wpdb->prepare("SELECT * FROM $a WHERE trace_id=%s",$trace),ARRAY_A):null;
        if($attempt&&($body['operation']??'')==='begin'&&$attempt['page_id']!==$page){
            $existing=$wpdb->get_row($wpdb->prepare("SELECT * FROM $c WHERE id=%d",(int)$attempt['case_id']),ARRAY_A);
            if($existing&&!in_array($existing['state'],self::CLOSED,true)){
                $trace=wp_generate_uuid4();$now=self::now();
                $device=self::device((array)($body['device']??[]));
                $wpdb->insert($a,['trace_id'=>$trace,'page_id'=>$page,'case_id'=>(int)$existing['id'],'device'=>wp_json_encode($device),'device_type'=>$device['type'],'created_at'=>$now,'updated_at'=>$now]);
                if(!$wpdb->insert_id)wp_send_json_error(['code'=>'unavailable'],503);
                $attempt=['id'=>(int)$wpdb->insert_id,'trace_id'=>$trace,'case_id'=>(int)$existing['id'],'page_id'=>$page];
                $proof=self::proof($trace,time()+7200);
            }else $attempt=null;
        }
        if (!$attempt) {
            if(!$valid_nonce)wp_send_json_error(['code'=>'invalid_request'],403);
            if (($body['operation']??'')!=='begin'||!self::limit('begin',12)) wp_send_json_error(['code'=>'trace_expired'],403);
            // Evita que a coleta se torne endpoint genérico de gravação fora de uma compra.
            if (!function_exists('WC')||!WC()->cart||WC()->cart->is_empty()) wp_send_json_error(['code'=>'no_cart'],409);
            $trace=wp_generate_uuid4();$now=self::now();
            $wpdb->insert($c,['identity_hash'=>hash('sha256',$trace),'contact'=>self::protect([]),'context'=>'{}','created_at'=>$now,'updated_at'=>$now]);
            $case=(int)$wpdb->insert_id;if(!$case)wp_send_json_error(['code'=>'unavailable'],503);
            $device=self::device((array)($body['device']??[]));
            $wpdb->insert($a,['trace_id'=>$trace,'page_id'=>$page,'case_id'=>$case,'device'=>wp_json_encode($device),'device_type'=>$device['type'],'created_at'=>$now,'updated_at'=>$now]);
            $attempt=['id'=>(int)$wpdb->insert_id,'trace_id'=>$trace,'case_id'=>$case];
            if(!$attempt['id']){$wpdb->delete($c,['id'=>$case]);wp_send_json_error(['code'=>'unavailable'],503);}
            $proof=self::proof($trace,time()+7200);
        }
        try {
            self::record($attempt,$body);
        } catch (Throwable $error) {
            // Falha da observação não retorna PII/SQL/segredos nem participa do submit da compra.
            wp_send_json_error(['code'=>$error instanceof DomainException?'identity_changed':'capture_unavailable'],503);
        }
        wp_send_json_success(['trace'=>$trace,'proof'=>$proof]); // Nenhum contato/ID de caso é exposto.
    }
    private static function record(array $attempt,array $body): void {
        global $wpdb;$c=self::table('cases');$a=self::table('attempts');$e=self::table('events');
        $case=(int)$attempt['case_id'];$now=self::now();
        if (!empty($body['contact'])&&is_array($body['contact'])) {
            $contact=self::contact($body['contact']);$identity=self::identity($contact);
            $current=$wpdb->get_row($wpdb->prepare("SELECT * FROM $c WHERE id=%d",$case),ARRAY_A);
            if ($current&&!in_array($current['state'],self::CLOSED,true)&&$identity!=='') {
                $lock='ctwpml_rec_'.substr($identity,0,40);
                if ((int)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 1)',$lock))===1) {
                    try {
                        $target=$wpdb->get_row($wpdb->prepare("SELECT * FROM $c WHERE identity_hash=%s AND state IN ('active','attention','contact') AND updated_at>%s ORDER BY id DESC LIMIT 1",$identity,gmdate('Y-m-d H:i:s',time()-7*DAY_IN_SECONDS)),ARRAY_A);
                        $old=self::reveal($current['contact']);
                        // Identidade informada mudou dentro da tentativa: não migrar o histórico de outra pessoa.
                        $known=self::identity($old);$same=$known===''||hash_equals($known,$identity);
                        if(!$same)throw new DomainException('identity_changed');
                        if ($same&&$target&&(int)$target['id']!==$case) {
                            $other=self::reveal($target['contact']);
                            $conflict=!empty($other['phone'])&&!empty($contact['phone'])&&preg_replace('/\D/','',$other['phone'])!==preg_replace('/\D/','',$contact['phone']);
                            if (!$conflict) {
                                $wpdb->update($a,['case_id'=>(int)$target['id']],['case_id'=>$case]);
                                $wpdb->query($wpdb->prepare("UPDATE $c SET has_error=GREATEST(has_error,%d),revision=revision+1 WHERE id=%d",(int)$current['has_error'],(int)$target['id']));
                                $wpdb->delete($c,['id'=>$case]);$case=(int)$target['id'];$old=$other;
                            }
                        }
                        if ($same) {
                            foreach ($contact as $k=>$v) if($v!=='')$old[$k]=$v;
                            $wpdb->update($c,['identity_hash'=>$identity,'identified'=>1,'contact'=>self::protect($old),'updated_at'=>$now],['id'=>$case]);
                        }
                    } finally {$wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)',$lock));}
                }
            }
        }
        // Contexte financeiro/produtos vem do carrinho do servidor, nunca de valores enviados pelo visitante.
        $context=self::cart_context();
        if(!empty($context['items']))$wpdb->query($wpdb->prepare("UPDATE $c SET context=%s,updated_at=%s,revision=revision+1 WHERE id=%d AND state IN ('active','attention','contact')",wp_json_encode($context),$now,$case));
        else $wpdb->query($wpdb->prepare("UPDATE $c SET updated_at=%s,revision=revision+1 WHERE id=%d AND state IN ('active','attention','contact')",$now,$case));
        $wpdb->update($a,['updated_at'=>$now],['id'=>(int)$attempt['id']]);
        $event_count=(int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $e WHERE attempt_id=%d",(int)$attempt['id']));
        foreach (array_slice((array)($body['events']??[]),0,max(0,min(30,5000-$event_count))) as $event) {
            if(!is_array($event)||!is_string($event['name']??null)||!is_string($event['key']??null))continue;
            $name=substr(preg_replace('/[^A-Z0-9_.-]/','',strtoupper((string)($event['name']??''))),0,80);
            $key=(string)($event['key']??'');
            if($name===''||!preg_match('/^[a-f0-9-]{20,64}$/D',$key))continue;
            $ok=($event['ok']??true)!==false;
            $wpdb->query($wpdb->prepare("INSERT IGNORE INTO $e (attempt_id,event_key,name,ok,detail,created_at) SELECT a.id,%s,%s,%d,%s,%s FROM $a a JOIN $c c ON c.id=a.case_id WHERE a.id=%d",$key,$name,$ok?1:0,wp_json_encode(self::detail((array)($event['detail']??[]))),$now,(int)$attempt['id']));
            if(!$ok)$wpdb->query($wpdb->prepare("UPDATE $c SET has_error=1,state=IF(state='active','attention',state) WHERE id=%d",$case));
        }
    }
    private static function cart_context(): array {
        $out=['items'=>[],'shipping'=>'','freight'=>null,'total'=>null];
        if(!function_exists('WC')||!WC()->cart)return $out;
        foreach (array_slice(WC()->cart->get_cart(),0,50) as $item) {
            $product=$item['data']??null;if(!$product)continue;
            $out['items'][]=['product_id'=>(int)$product->get_id(),'name'=>sanitize_text_field($product->get_name()),'quantity'=>(int)$item['quantity'],'subtotal'=>(float)($item['line_subtotal']??0),'total'=>(float)($item['line_total']??0)];
        }
        $out['total']=(float)WC()->cart->get_total('edit');
        $chosen=WC()->session?(array)WC()->session->get('chosen_shipping_methods',[]):[];
        $packages=WC()->shipping()?WC()->shipping()->get_packages():[];
        $freight=0.0;$resolved=false;
        foreach($packages as $i=>$package) {
            $rate=$package['rates'][$chosen[$i]??'']??null;
            if($rate){$resolved=true;$out['shipping'].=($out['shipping']?' / ':'').sanitize_text_field($rate->get_label());$freight+=(float)$rate->get_cost();}
        }
        if($resolved)$out['freight']=$freight;
        return $out;
    }
    public static function attach_order($order,$data=[]): void {
        if(!self::settings()['enabled'])return;
        $trace=sanitize_text_field(wp_unslash($_POST['ctwpml_recovery_trace']??''));
        $proof=sanitize_text_field(wp_unslash($_POST['ctwpml_recovery_proof']??''));
        if(!self::valid_proof($trace,$proof))return;
        global $wpdb;$a=self::table('attempts');
        $attempt=$wpdb->get_row($wpdb->prepare("SELECT id,case_id FROM $a WHERE trace_id=%s",$trace),ARRAY_A);
        if($attempt){$order->update_meta_data('_ctwpml_recovery_attempt',(int)$attempt['id']);$order->update_meta_data('_ctwpml_recovery_case',(int)$attempt['case_id']);}
    }
    public static function order_processing($id): void {
        if(get_option('ctwpml_recovery_schema')!==self::SCHEMA)return;
        $order=wc_get_order($id);if(!$order||$order->get_status()!=='processing')return;
        global $wpdb;$c=self::table('cases');$a=self::table('attempts');$e=self::table('events');
        $attempt=(int)$order->get_meta('_ctwpml_recovery_attempt');
        // Resolve a vinculação corrente, inclusive quando duas tentativas foram consolidadas.
        $case=$attempt?(int)$wpdb->get_var($wpdb->prepare("SELECT case_id FROM $a WHERE id=%d",$attempt)):0;
        if(!$case)return;
        $wpdb->query($wpdb->prepare("UPDATE $c SET state='bought',order_id=%d,updated_at=%s,revision=revision+1 WHERE id=%d AND order_id=0",$id,self::now(),$case));
        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO $e (attempt_id,event_key,name,ok,detail,created_at) SELECT a.id,%s,'ORDER_PROCESSING',1,%s,%s FROM $a a JOIN $c c ON c.id=a.case_id WHERE a.id=%d",'order-'.(int)$id,wp_json_encode(['source'=>'server']),self::now(),$attempt));
    }
    private static function admin_guard(): void {
        nocache_headers();
        if (($_SERVER['REQUEST_METHOD']??'')!=='POST'||!current_user_can('manage_options')||!check_ajax_referer('ctwpml_recovery_admin','nonce',false)) wp_send_json_error(['message'=>'Acesso administrativo necessário. Recarregue a página.'],403);
    }
    private static function ids($value): array { return array_slice(array_values(array_unique(array_filter(array_map('absint',(array)$value)))),0,50); }
    private static function hydrate(array $row): array {
        $row['contact']=self::reveal($row['contact']);$row['context']=(array)json_decode($row['context'],true);
        foreach(['id','revision','order_id','manual_order_id','attempts','has_error']as $k)$row[$k]=(int)($row[$k]??0);
        return $row;
    }
    public static function admin(): void {
        self::admin_guard();global $wpdb;
        if(!self::install())wp_send_json_error(['message'=>'Não foi possível preparar o armazenamento.'],503);
        $op=sanitize_key($_POST['operation']??'list');$c=self::table('cases');$a=self::table('attempts');$e=self::table('events');
        if($op==='settings'){
            if(!function_exists('openssl_encrypt'))wp_send_json_error(['message'=>'OpenSSL indisponível.'],503);
            $settings=['enabled'=>!empty($_POST['enabled']),'idle'=>max(1,min(120,(int)($_POST['idle']??15)))];
            update_option(self::OPTION,$settings,false);wp_send_json_success(['settings'=>$settings]);
        }
        if($op==='list'||$op==='board'){
            $days=max(1,min(90,(int)($_POST['days']??7)));$since=gmdate('Y-m-d H:i:s',time()-$days*DAY_IN_SECONDS);
            $cutoff=gmdate('Y-m-d H:i:s',time()-self::settings()['idle']*60);
            $wpdb->query($wpdb->prepare("UPDATE $c SET state='attention',revision=revision+1 WHERE state='active' AND updated_at<%s",$cutoff));
            $page=max(1,(int)($_POST['page']??1));$state=sanitize_key($_POST['state']??'attention');
            $where=$wpdb->prepare('c.updated_at>=%s',$since);
            if(in_array($state,['active','attention','contact','bought','recovered','lost'],true))$where.=$wpdb->prepare(' AND c.state=%s',$state);
            elseif($state==='closed')$where.=" AND c.state IN ('bought','recovered','lost')";
            $search=substr(sanitize_text_field(wp_unslash($_POST['search']??'')),0,254);
            if($search!==''){
                $identity=self::identity(['email'=>$search,'phone'=>$search]);
                $parts=[];
                if($identity!=='')$parts[]=$wpdb->prepare('c.identity_hash=%s',$identity);
                if(ctype_digit($search)&&(int)$search>0)$parts[]=$wpdb->prepare('(c.order_id=%d OR c.manual_order_id=%d)',(int)$search,(int)$search);
                $where.=$parts?' AND ('.implode(' OR ',$parts).')':' AND 1=0';
            }
            $shipping=sanitize_text_field(wp_unslash($_POST['shipping']??''));
            if(in_array($shipping,['Motoboy','SEDEX','PAC'],true))$where.=$wpdb->prepare(' AND c.context LIKE %s','%'.$wpdb->esc_like($shipping).'%');
            $device=sanitize_key($_POST['device']??'');
            if(in_array($device,['mobile','desktop'],true))$where.=$wpdb->prepare(" AND EXISTS (SELECT 1 FROM $a d WHERE d.case_id=c.id AND d.device_type=%s)",$device);
            $count=(int)$wpdb->get_var("SELECT COUNT(*) FROM $c c WHERE $where");
            $rows=$wpdb->get_results($wpdb->prepare("SELECT c.*, (SELECT COUNT(*) FROM $a a WHERE a.case_id=c.id) AS attempts FROM $c c WHERE $where ORDER BY c.has_error DESC,attempts DESC,c.updated_at DESC,c.id DESC LIMIT 25 OFFSET %d",($page-1)*25),ARRAY_A);
            $board_counts=[];
            if($op==='board'){
                $rows=[];
                foreach(['active','attention','contact','closed']as $lane){
                    $lane_where=$where.($lane==='closed'?" AND c.state IN ('bought','recovered','lost')":$wpdb->prepare(' AND c.state=%s',$lane));
                    $board_counts[$lane]=(int)$wpdb->get_var("SELECT COUNT(*) FROM $c c WHERE $lane_where");
                    $rows=array_merge($rows,$wpdb->get_results("SELECT c.*, (SELECT COUNT(*) FROM $a a WHERE a.case_id=c.id) AS attempts FROM $c c WHERE $lane_where ORDER BY c.has_error DESC,attempts DESC,c.updated_at DESC,c.id DESC LIMIT 25",ARRAY_A)?:[]);
                }
            }
            $stats=$wpdb->get_row($wpdb->prepare("SELECT COUNT(DISTINCT identity_hash) AS people,COUNT(DISTINCT CASE WHEN has_error=1 THEN identity_hash END) AS errors,COUNT(DISTINCT CASE WHEN state='recovered' THEN identity_hash END) AS recovered,COUNT(DISTINCT CASE WHEN state='recovered' AND manual_order_id>0 THEN identity_hash END) AS linked,COUNT(DISTINCT CASE WHEN order_id>0 THEN identity_hash END) AS bought FROM $c WHERE updated_at>=%s AND identified=1",$since),ARRAY_A);
            // Tentativas anônimas não são apresentadas como pessoas identificadas.
            $stats['anonymous']=(int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $c WHERE updated_at>=%s AND identified=0",$since));
            $stats['devices']=$wpdb->get_results($wpdb->prepare("SELECT a.device_type,COUNT(DISTINCT c.identity_hash) AS people,COUNT(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM $e e WHERE e.attempt_id=a.id AND e.ok=0) THEN c.identity_hash END) AS errors FROM $a a JOIN $c c ON c.id=a.case_id WHERE c.updated_at>=%s AND c.identified=1 GROUP BY a.device_type",$since),ARRAY_A);
            wp_send_json_success(['rows'=>array_map([__CLASS__,'hydrate'],$rows?:[]),'count'=>$count,'page'=>$page,'stats'=>$stats,'settings'=>self::settings(),'board_counts'=>$board_counts]);
        }
        if($op==='detail'){
            $id=absint($_POST['id']??0);
            $attempts=$wpdb->get_results($wpdb->prepare("SELECT id,trace_id,device,created_at,updated_at FROM $a WHERE case_id=%d ORDER BY id DESC LIMIT 100",$id),ARRAY_A);
            foreach($attempts as &$attempt){$attempt['device']=(array)json_decode($attempt['device'],true);}
            wp_send_json_success(['attempts'=>$attempts]);
        }
        if($op==='update'){
            $ids=self::ids($_POST['ids']??[]);$state=sanitize_key($_POST['state']??'');
            if(!$ids||!in_array($state,['active','attention','contact','recovered','lost','delete','link'],true))wp_send_json_error(['message'=>'Ação inválida.'],400);
            if(count($ids)>1&&$state==='link')wp_send_json_error(['message'=>'Associe um pedido por atendimento.'],400);
            $updated=[];$conflicts=[];
            foreach($ids as $id){
                $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM $c WHERE id=%d",$id),ARRAY_A);
                $revisions=(array)($_POST['revisions']??[]);
                if(!$row||!isset($revisions[$id])||(int)$revisions[$id]!== (int)$row['revision']){$conflicts[]=$id;continue;}
                if($state==='delete'){
                    // Bloqueia gravações concorrentes pela mesma linha antes de excluir seus dependentes.
                    $wpdb->query('START TRANSACTION');
                    $locked=$wpdb->get_row($wpdb->prepare("SELECT revision FROM $c WHERE id=%d FOR UPDATE",$id),ARRAY_A);
                    if(!$locked||(int)$locked['revision']!==(int)$revisions[$id]){$wpdb->query('ROLLBACK');$conflicts[]=$id;continue;}
                    $wpdb->query($wpdb->prepare("DELETE e FROM $e e INNER JOIN $a a ON a.id=e.attempt_id WHERE a.case_id=%d",$id));
                    $wpdb->delete($a,['case_id'=>$id]);$wpdb->delete($c,['id'=>$id]);$wpdb->query('COMMIT');$updated[]=$id;continue;
                }
                if($state==='link'){
                    $order=wc_get_order(absint($_POST['order']??0));
                    if(!$order)wp_send_json_error(['message'=>'Pedido não encontrado.'],400);
                    $contact=self::reveal($row['contact']);
                    if(!is_email($contact['email']??'')||strtolower($order->get_billing_email())!==strtolower($contact['email']))wp_send_json_error(['message'=>'O e-mail do pedido não corresponde ao atendimento.'],400);
                    $n=$wpdb->query($wpdb->prepare("UPDATE $c SET manual_order_id=%d,revision=revision+1 WHERE id=%d AND revision=%d",(int)$order->get_id(),$id,(int)$row['revision']));
                }else{
                    if($row['order_id']){$conflicts[]=$id;continue;} // Compra comprovada não volta por arraste.
                    $n=$wpdb->query($wpdb->prepare("UPDATE $c SET state=%s,revision=revision+1 WHERE id=%d AND revision=%d",$state,$id,(int)$row['revision']));
                }
                if($n){
                    $updated[]=$id;
                    $wpdb->query($wpdb->prepare("INSERT IGNORE INTO $e (attempt_id,event_key,name,ok,detail,created_at) SELECT a.id,%s,%s,1,%s,%s FROM $a a WHERE a.case_id=%d ORDER BY a.id DESC LIMIT 1",wp_generate_uuid4(),'ADMIN_'.strtoupper($state),wp_json_encode(['source'=>'server','action'=>'admin_update']),self::now(),$id));
                }else $conflicts[]=$id;
            }
            wp_send_json_success(['updated'=>$updated,'conflicts'=>$conflicts]);
        }
        if($op==='logs'){
            $ids=self::ids($_POST['ids']??[]);if(!$ids)wp_send_json_error(['message'=>'Selecione atendimentos.'],400);
            $in=implode(',',$ids);$cursor=absint($_POST['cursor']??0);$upper=absint($_POST['upper']??0);
            if(!$upper)$upper=(int)$wpdb->get_var("SELECT MAX(e.id) FROM $e e JOIN $a a ON a.id=e.attempt_id WHERE a.case_id IN ($in)");
            $rows=$wpdb->get_results($wpdb->prepare("SELECT e.id,e.name,e.ok,e.detail,e.created_at,a.trace_id,a.case_id,a.device FROM $e e JOIN $a a ON a.id=e.attempt_id WHERE a.case_id IN ($in) AND e.id>%d AND e.id<=%d ORDER BY e.id LIMIT 501",$cursor,$upper),ARRAY_A);
            $more=count($rows)>500;$rows=array_slice($rows,0,500);
            foreach($rows as &$row){$row['detail']=(array)json_decode($row['detail'],true);$row['device']=(array)json_decode($row['device'],true);}
            wp_send_json_success(['rows'=>$rows,'upper'=>$upper,'cursor'=>$rows?(int)end($rows)['id']:$cursor,'more'=>$more]);
        }
        wp_send_json_error(['message'=>'Operação inválida.'],400);
    }
    public static function cleanup(): void {
        if(get_option('ctwpml_recovery_schema')!==self::SCHEMA)return;
        global $wpdb;$c=self::table('cases');$a=self::table('attempts');$e=self::table('events');
        $ids=self::ids($wpdb->get_col($wpdb->prepare("SELECT id FROM $c WHERE created_at<%s ORDER BY id LIMIT 50",gmdate('Y-m-d H:i:s',time()-90*DAY_IN_SECONDS))));
        // Limpa fragmentos técnicos órfãos de uma exclusão simultânea à coleta.
        $wpdb->query("DELETE a FROM $a a LEFT JOIN $c c ON c.id=a.case_id WHERE c.id IS NULL");
        $wpdb->query("DELETE e FROM $e e LEFT JOIN $a a ON a.id=e.attempt_id WHERE a.id IS NULL");
        if(!$ids)return;$in=implode(',',$ids);
        $wpdb->query("DELETE e FROM $e e JOIN $a a ON a.id=e.attempt_id WHERE a.case_id IN ($in)");
        $wpdb->query("DELETE FROM $a WHERE case_id IN ($in)");$wpdb->query("DELETE FROM $c WHERE id IN ($in)");
        if(count($ids)===50&&!wp_next_scheduled('ctwpml_recovery_cleanup_batch')){wp_schedule_single_event(time()+60,'ctwpml_recovery_cleanup_batch');}
    }
    public static function login_redirect($url) {
        $raw=(string)($_COOKIE['ctwpml_recovery_return']??'');$parts=explode('.',$raw);
        if(count($parts)!==3)return $url;
        [$id,$expiry,$signature]=$parts;
        if(!ctype_digit($id)||!ctype_digit($expiry)||(int)$expiry<time()||!hash_equals(hash_hmac('sha256',$id.'.'.$expiry,wp_salt('auth')),$signature))return $url;
        $target=get_permalink((int)$id);$ref=wp_get_referer();
        if(!$target||!$ref||wp_parse_url($ref,PHP_URL_HOST)!==wp_parse_url($target,PHP_URL_HOST)||wp_parse_url($ref,PHP_URL_PATH)!==wp_parse_url($target,PHP_URL_PATH))return $url;
        if(!headers_sent())setcookie('ctwpml_recovery_return','',['expires'=>time()-3600,'path'=>COOKIEPATH?:'/','secure'=>is_ssl(),'httponly'=>true,'samesite'=>'Lax']);
        return $target;
    }
    public static function shortcode(): string {
        if(ctwpml_is_visual_editor()&&!is_admin())return '';
        if(!defined('DONOTCACHEPAGE'))define('DONOTCACHEPAGE',true);
        if(!headers_sent())nocache_headers();
        wp_enqueue_style('ctwpml-recovery',CHECKOUT_TABS_WP_ML_URL.'assets/css/recovery.css',[],checkout_tabs_wp_ml_get_version());
        if(!current_user_can('manage_options')){
            if(is_user_logged_in())return '<section class="ctwpml-recovery"><h2>Acesso restrito</h2><p>Esta central está disponível somente para administradores.</p></section>';
            $page=(int)get_queried_object_id();$expiry=time()+900;$value=$page.'.'.$expiry;
            if($page&&!headers_sent())setcookie('ctwpml_recovery_return',$value.'.'.hash_hmac('sha256',$value,wp_salt('auth')),['expires'=>$expiry,'path'=>COOKIEPATH?:'/','secure'=>is_ssl(),'httponly'=>true,'samesite'=>'Lax']);
            $login=shortcode_exists('secure_passkeys_login_form')?do_shortcode('[secure_passkeys_login_form]'):'';
            return '<section class="ctwpml-recovery ctwpml-recovery-login"><h2>Recuperação</h2><p>Entre com sua conta de administrador.</p>'.$login.'<a href="'.esc_url(wp_login_url(get_permalink())).'">Entrar com e-mail e senha</a></section>';
        }
        if(!self::install())return '<section class="ctwpml-recovery">Armazenamento indisponível.</section>';
        wp_enqueue_style('dashicons');
        wp_enqueue_script('ctwpml-recovery-admin',CHECKOUT_TABS_WP_ML_URL.'assets/js/recovery-admin.js',[],checkout_tabs_wp_ml_get_version(),true);
        wp_localize_script('ctwpml-recovery-admin','ctwpmlRecoveryAdmin',['url'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('ctwpml_recovery_admin')]);
        ob_start();require __DIR__.'/view.php';return ob_get_clean();
    }
}
CTWPML_Recovery::init();
add_action('ctwpml_recovery_cleanup_batch',['CTWPML_Recovery','cleanup']);
