<?php
/** CLI only. Real Secure Passkeys actions/crypto; in-memory persistence and WordPress helpers. */
namespace Secure_Passkeys\Utils {
    class Secure_Passkeys_Helper {
        public static function get_option($key,$default=null){return $GLOBALS['fixture_options'][$key]??$default;}
        public static function base64url_decode(string $value):string{return base64_decode(strtr($value,'-_','+/'));}
        public static function get_raw_credential_id(string $value):string{return base64_encode(self::base64url_decode($value));}
        public static function is_user_in_excluded_roles($id):bool{return false;}
    }
}
namespace Secure_Passkeys\Models {
    class Secure_Passkeys_WebAuthn {
        public function get_count_by_user_id($id){return count(array_filter($GLOBALS['fixture_rows'],fn($row)=>$row['user_id']===$id));}
        public function is_credential_id_for_user_id($id,$credential){return (bool)array_filter($GLOBALS['fixture_rows'],fn($row)=>$row['user_id']===$id&&$row['credential_id']===$credential);}
        public function is_security_key_name_for_user_id($id,$name){return (bool)array_filter($GLOBALS['fixture_rows'],fn($row)=>$row['user_id']===$id&&$row['security_key_name']===$name);}
        public function get_by_credential_id($credential){foreach($GLOBALS['fixture_rows']as $row)if($row['credential_id']===$credential)return(object)$row;return null;}
        public function update_signature_counter($id,$counter){foreach($GLOBALS['fixture_rows']as &$row)if($row['id']===$id)$row['sign_count']=$counter;}
    }
}
namespace {
    if(PHP_SAPI!=='cli')exit;
    define('ABSPATH',__DIR__);
    function apply_filters($name,$value,...$args){return $value;}
    function wp_parse_url($url,$component=-1){return parse_url($url,$component);}
    $reference=getenv('PASSKEYS_REFERENCE');
    if(!$reference||!is_file($reference.'/src/actions/secure-passkeys-web-authn-enable-action.php'))throw new \RuntimeException('PASSKEYS_REFERENCE required');
    spl_autoload_register(static function($class)use($reference){
        $prefix='Secure_Passkeys\\';if(!str_starts_with($class,$prefix))return;
        $file=$reference.'/src/'.strtolower(str_replace(['\\','_'],['/','-'],substr($class,strlen($prefix)))).'.php';
        if(is_file($file))require_once $file;
    });
    class Fixture_Enable extends \Secure_Passkeys\Actions\Secure_Passkeys_Web_Authn_Enable_Action {
        protected function get_relying_party_id():string{return 'passkeys.example.test';}
        protected function is_user_verification_required():bool{return true;}
    }
    class Fixture_Login extends \Secure_Passkeys\Actions\Secure_Passkeys_Web_Authn_Login_Action {
        protected function get_relying_party_id():string{return 'passkeys.example.test';}
        protected function is_login_user_verification_required():bool{return true;}
    }
    $input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
    $fixture_rows=$input['rows']??[];$fixture_options=$input['options']??[];
    try{
        if($input['operation']==='create'){
            $row=(new Fixture_Enable())->execute(42,$input['challenge'],$input['credential'],$input['name']);
            $row+=['id'=>count($fixture_rows)+1,'security_key_name'=>$input['name'],'is_active'=>1];
            $fixture_rows[]=$row;$result=['registered'=>true];
        }else{
            $row=(new Fixture_Login())->execute($input['challenge'],$input['credential']);
            $result=['verified'=>true,'user_id'=>$row->user_id,'row_id'=>$row->id];
        }
    }catch(\Throwable $error){$result=['error'=>get_class($error)];}
    echo json_encode($result+['rows'=>$fixture_rows],JSON_THROW_ON_ERROR);
}
