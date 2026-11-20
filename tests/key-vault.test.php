<?php
/** CLI com OpenSSL habilitado. --html fornece somente a fixture visual sem credenciais reais. */
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__);
define('CHECKOUT_TABS_WP_ML_URL', '/');
$options = []; $can_administer = true; $nonce_valid = true; $reply = null; $menus = []; $hooks = []; $remote = false;
function get_option($name, $default = false) { return $GLOBALS['options'][$name] ?? $default; }
function update_option($name, $value, $autoload = false) { $GLOBALS['options'][$name] = $value; return true; }
function current_user_can($cap) { return $cap === 'manage_options' && $GLOBALS['can_administer']; }
function wp_salt($scheme) { return 'fixture-only-salt'; }
function wp_unslash($value) { return stripslashes($value); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
function admin_url($path) { return '/wp-admin/' . $path; }
function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_html($value) { return esc_attr($value); }
function esc_url($value) { return esc_attr($value); }
function wp_create_nonce($action) { return 'fixture-nonce'; }
function wp_nonce_field($action) { echo '<input type="hidden" name="_wpnonce" value="fixture-nonce">'; }
function check_admin_referer($action) { if (!$GLOBALS['nonce_valid']) throw new DomainException('Nonce inválido.',403); }
function check_ajax_referer($action, $field, $die) { return $GLOBALS['nonce_valid'] && ($_POST[$field] ?? '') === 'fixture-nonce'; }
function nocache_headers() {}
function wp_enqueue_style(...$args) {}
function wp_enqueue_script(...$args) {}
function checkout_tabs_wp_ml_get_version() { return '3.4.1'; }
function add_action($name, $callback, ...$args) { $GLOBALS['hooks'][] = $name; }
function add_menu_page(...$args) { $GLOBALS['menus'][] = ['top',$args]; }
function add_submenu_page(...$args) { $GLOBALS['menus'][] = ['sub',$args]; }
function remove_submenu_page(...$args) {}
function wp_send_json_success($data) { $GLOBALS['reply'] = ['success'=>true,'data'=>$data]; }
function wp_send_json_error($data, $status) { $GLOBALS['reply'] = ['success'=>false,'status'=>$status,'data'=>$data]; }
function sakm_get_key($name) { return isset($GLOBALS['options']['sakm_encrypted_keys'][$name]) ? ($GLOBALS['legacy_values'][$name] ?? null) : null; }
class CTWPML_Driver_Panel { public static function remote() { return $GLOBALS['remote']; } }
require dirname(__DIR__) . '/inc/security/class-key-vault.php';
$options[CTWPML_Key_Vault::OPTION] = [
    'motoboy_conexao' => CTWPML_Key_Vault::encrypt('motoboy_conexao','fixture-shared-secret-not-real'),
    'google_maps_motoboy' => CTWPML_Key_Vault::encrypt('google_maps_motoboy','fixture-map-value-not-real'),
];
$options['sakm_encrypted_keys'] = ['authorization' => 'fixture-cipher', 'motoboy_conexao' => 'fixture-old-copy'];
$legacy_values = ['authorization' => 'fixture-legacy-secret-not-real','motoboy_conexao'=>'fixture-old-shared'];
if (in_array('--html', $argv, true)) { CTWPML_Key_Vault::render(); exit; }
function expect_vault($actual, $expected, $message) { if ($actual !== $expected) throw new RuntimeException($message); }
function rejects_vault($call, $code) { try { $call(); } catch (DomainException $e) { expect_vault($e->getCode(),$code,'Código de rejeição'); return; } throw new RuntimeException('Deveria recusar.'); }
CTWPML_Key_Vault::init();
expect_vault(in_array('wp_ajax_ctwpml_vault',$hooks,true),true,'Endpoint autenticado registrado');
expect_vault(in_array('wp_ajax_nopriv_ctwpml_vault',$hooks,true),false,'Nenhum endpoint anônimo para chaves');
CTWPML_Key_Vault::menu();
expect_vault($menus[0][1][0],'checkout-tabs-wp-ml','Submenu pertence ao Checkout');
expect_vault($menus[0][1][3],'manage_options','Submenu restrito a administrador');
$remote=true;$menus=[];CTWPML_Key_Vault::menu();
expect_vault($menus[0][0],'top','Modo remoto ganha menu Checkout sem WooCommerce');$remote=false;
ob_start(); CTWPML_Key_Vault::render(); $html=ob_get_clean();
foreach (['fixture-shared-secret-not-real','fixture-map-value-not-real','fixture-legacy-secret-not-real'] as $secret) expect_vault(str_contains($html,$secret),false,'HTML inicial não contém segredos');
expect_vault(substr_count($html,'class="ctv-key"'),3,'Lista une nomes internos e legados sem duplicar');
expect_vault(str_contains($html,'action="/wp-admin/admin.php?page=ctwpml-vault"'),true,'Formulário salva na página nova');
$can_administer=false; rejects_vault(fn()=>CTWPML_Key_Vault::operate('read','motoboy_conexao'),403);
ob_start();CTWPML_Key_Vault::render();expect_vault(ob_get_clean(),'','Sem permissão não renderiza nomes');
$_SERVER['REQUEST_METHOD']='POST';$_POST=['operation'=>'read','name'=>'motoboy_conexao','nonce'=>'fixture-nonce'];
CTWPML_Key_Vault::ajax();expect_vault($reply['status'],403,'Endpoint recusa usuário sem capacidade');
$can_administer=true;$nonce_valid=false;CTWPML_Key_Vault::ajax();expect_vault($reply['status'],403,'Endpoint recusa nonce inválido');
$nonce_valid=true;$_SERVER['REQUEST_METHOD']='GET';CTWPML_Key_Vault::ajax();expect_vault($reply['status'],403,'Leitura não é GET');
$_SERVER['REQUEST_METHOD']='POST';CTWPML_Key_Vault::ajax();expect_vault($reply['data']['value'],'fixture-shared-secret-not-real','Leitura autorizada entrega valor exato');
expect_vault(CTWPML_Key_Vault::operate('read','authorization')['value'],'fixture-legacy-secret-not-real','Chave legada pode ser copiada');
rejects_vault(fn()=>CTWPML_Key_Vault::operate('read','missing'),404);
rejects_vault(fn()=>CTWPML_Key_Vault::operate('delete','motoboy_conexao'),422);
expect_vault(CTWPML_Key_Vault::get('motoboy_conexao'),'fixture-shared-secret-not-real','Sem confirmação mantém valor');
$_POST=['operation'=>'delete','name'=>'motoboy_conexao','nonce'=>'fixture-nonce'];CTWPML_Key_Vault::ajax();expect_vault($reply['status'],422,'Delete exige confirmação no servidor');
$_POST['confirmed']='1';CTWPML_Key_Vault::ajax();expect_vault($reply['data']['removed'],true,'Remoção confirmada');
expect_vault(CTWPML_Key_Vault::get('motoboy_conexao'),null,'Cópia legada não reativa chave removida');
expect_vault(isset($options['sakm_encrypted_keys']['authorization']),true,'Outras chaves legadas preservadas');
expect_vault(CTWPML_Key_Vault::get('google_maps_motoboy'),'fixture-map-value-not-real','Outras chaves internas preservadas');
$_POST=['ctwpml_vault_action'=>'save','key_name'=>'new_reference','key_value'=>'fixture-new-value'];
ob_start();CTWPML_Key_Vault::render();$html=ob_get_clean();
expect_vault(CTWPML_Key_Vault::get('new_reference'),'fixture-new-value','Cadastro mantém criptografia');
expect_vault(str_contains($html,'fixture-new-value'),false,'Salvar não reimprime valor');
echo "Cofre: menu local/remoto, HTML sem segredo, capacidade/nonce/POST, leitura, cópia legada e exclusão confirmada passaram.\n";
