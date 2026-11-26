<?php
/** Fixture CLI: valida respostas do autenticador virtual com a biblioteca original do Secure Passkeys. */
if (PHP_SAPI!=='cli') exit;
define('ABSPATH',__DIR__);
function wp_parse_url($url,$component=-1){return parse_url($url,$component);}
$reference=getenv('PASSKEYS_REFERENCE');
if (!$reference || !is_file($reference.'/src/packages/web-authn/web-authn.php')) throw new RuntimeException('Defina PASSKEYS_REFERENCE para a referência oficial.');
spl_autoload_register(static function($class)use($reference){
    $prefix='Secure_Passkeys\\';
    if (!str_starts_with($class,$prefix)) return;
    $relative=strtolower(str_replace(['\\','_'],['/','-'],substr($class,strlen($prefix))));
    $file=$reference.'/src/'.$relative.'.php';
    if(is_file($file))require_once $file;
});
$data=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$decode=static fn($text)=>base64_decode(strtr($text,'-_','+/'),true);
$engine=new \Secure_Passkeys\Packages\Web_Authn\Web_Authn('Fixture','passkeys.example.test');
if($data['operation']==='create'){
    $result=$engine->processCreate($decode($data['response']['clientDataJSON']),new \Secure_Passkeys\Packages\Web_Authn\Binary\Byte_Buffer($decode($data['response']['attestationObject'])),$decode($data['challenge']),true);
    echo json_encode(['publicKey'=>$result->credentialPublicKey,'counter'=>$result->signatureCounter]);
}else{
    $engine->processGet($decode($data['response']['clientDataJSON']),$decode($data['response']['authenticatorData']),$decode($data['response']['signature']),$data['publicKey'],$decode($data['challenge']),$data['counter'],true);
    echo json_encode(['verified'=>true]);
}
