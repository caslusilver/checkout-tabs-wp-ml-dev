<?php
namespace WC_Asaas\Gateway {
    class Gateway { public function get_option($name, $default='') { return ['api_key'=>'authorization','endpoint'=>'https://fixture.invalid/invoice'][$name] ?? $default; } }
}
namespace {
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__);
$options=[];$requests=[];$actions=[];
function get_option($name,$default=false){return $GLOBALS['options'][$name]??$default;}
function update_option($name,$value,$autoload=false){$GLOBALS['options'][$name]=$value;return true;}
function add_action($hook,$callback,$priority=10){$GLOBALS['actions'][$hook][$priority][]=$callback;}
function wp_salt($scheme){return 'fixture-compatibility-salt';}
function __($text,$domain){return $text;}
function apply_filters($hook,$value,...$args){return $value;}
function wp_json_encode($value){return json_encode($value);}
class WP_Error{public function __construct(public $code='',public $message='',public $data=null){} public function get_error_messages(){return [$this->message];}}
function is_wp_error($value){return $value instanceof WP_Error;}
function wp_remote_post($url,$args){$GLOBALS['requests'][]=[$url,$args];return ['status'=>200,'body'=>'{"id":"fixture-payment","encodedImage":"fixture-image","payload":"fixture-pix"}'];}
function wp_remote_retrieve_response_code($response){return $response['status'];}
function wp_remote_retrieve_body($response){return $response['body'];}
function expect_compat($actual,$expected,$message){if($actual!==$expected)throw new \RuntimeException($message);}
$mode=$argv[1]??'internal';
require dirname(__DIR__).'/inc/security/class-key-vault.php';
// Fixture original do gateway, copiada da revisão de95545e880ce0d39a0fb7a1489e2d8612d6a26e.
require __DIR__.'/fixtures/asaas-webhook-invoices-service.php';
$service=new \WC_Asaas\Connectivity\Service\Webhook_Invoices_Service();$gateway=new \WC_Asaas\Gateway\Gateway();
$options[\CTWPML_Key_Vault::OPTION]=['authorization'=>\CTWPML_Key_Vault::encrypt('authorization','fixture-shared-header')];
if($mode==='external'){
    // O snippet antigo já carregou durante plugins_loaded/init; nada deve redefini-lo.
    function sakm_get_key($name){return $name==='authorization'?'fixture-original-provider':null;}
    $original=(new \ReflectionFunction('sakm_get_key'))->getFileName();
}else{
    $failure=$service->create_invoice(['order_id'=>6828],$gateway);
    expect_compat($failure->code,'asaas_clone_env_key_provider_missing','Reproduz a quebra antes de gerar cobrança');
    expect_compat(count($requests),0,'Sem provedor não envia a requisição Pix');
}
\CTWPML_Key_Vault::init();
expect_compat(isset($actions['wp_loaded'][PHP_INT_MAX]),true,'Ponte aguarda carregamento do snippet e init');
foreach($actions['wp_loaded'][PHP_INT_MAX] as $callback)$callback();
\CTWPML_Key_Vault::register_compatibility(); // Repetir inicialização é inofensivo.
$result=$service->create_invoice(['order_id'=>6828],$gateway);
expect_compat(is_wp_error($result),false,'Gateway original volta a obter a chave');
expect_compat(count($requests),1,'Uma requisição controlada para obter o Pix');
expect_compat($requests[0][1]['headers']['Authorization'],$mode==='external'?'fixture-original-provider':'fixture-shared-header','Cabeçalho exato, sem prefixar Bearer ou trocar valor');
expect_compat($result->payload,'fixture-pix','Resposta Pix chega ao consumidor');
expect_compat(sakm_get_key('missing'),null,'Referência ausente não recursa');
if($mode==='external'){
    expect_compat((new \ReflectionFunction('sakm_get_key'))->getFileName(),$original,'Provedor antigo não foi sobrescrito');
    expect_compat(\CTWPML_Key_Vault::provider(),'gerenciador_externo','Diagnóstico identifica legado');
}else{
    expect_compat(\CTWPML_Key_Vault::provider(),'cofre_integrado','Diagnóstico identifica ponte');
    $encrypted=sakm_encrypt('fixture-roundtrip');expect_compat(sakm_decrypt($encrypted),'fixture-roundtrip','Helpers antigos usam envelope GCM');
    expect_compat($encrypted!==sakm_encrypt('fixture-roundtrip'),true,'Novas escritas não usam IV fixo');
    $keys=sakm_get_keys();expect_compat(sakm_decrypt($keys['authorization']),'fixture-shared-header','Listar/decriptar mantém o contrato');
    $keys['second']=sakm_encrypt('fixture-second');sakm_save_keys($keys);expect_compat(sakm_get_key('second'),'fixture-second','Salvar pela API antiga alimenta o cofre');
    $keys=sakm_get_keys();$keys['nome antigo com espaço']=sakm_encrypt('fixture-old-reference');sakm_save_keys($keys);expect_compat(sakm_get_key('nome antigo com espaço'),'fixture-old-reference','Referência antiga mantém o nome sem renomear');
    unset($keys['second']);sakm_save_keys($keys);expect_compat(sakm_get_key('second'),null,'Salvar lista sem um nome remove apenas ele');
    define('SAKM_CIPHER','AES-128-CTR');define('SAKM_KEY','fixture-legacy-key');define('SAKM_IV','1234567891011121');
    $legacy=base64_encode(openssl_encrypt('fixture-legacy-secret',SAKM_CIPHER,SAKM_KEY,0,SAKM_IV));
    $options['sakm_encrypted_keys']=['old_name'=>$legacy];
    expect_compat(sakm_decrypt($legacy),'fixture-legacy-secret','Lê o formato exato do snippet anterior com parâmetros reais');
    expect_compat(sakm_get_key('old_name'),'fixture-legacy-secret','Consulta legada não entra em recursão');
    \CTWPML_Key_Vault::migrate();expect_compat(\CTWPML_Key_Vault::get('old_name'),'fixture-legacy-secret','Importação continua compatível com CTR antigo');
    $before=$options;\CTWPML_Key_Vault::get('old_name');expect_compat($options,$before,'Leitura não altera nem migra chaves automaticamente');
    $options[\CTWPML_Key_Vault::OPTION]['old_name']=['v'=>0];expect_compat(sakm_get_key('old_name'),null,'Corrupção interna não é escondida pelo legado');
}
echo "SAKM ($mode): contrato do gateway original, leitura, provedor e compatibilidade passaram; sem chamadas externas.\n";
}
