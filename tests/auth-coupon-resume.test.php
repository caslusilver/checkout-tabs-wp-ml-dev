<?php
define('ABSPATH',__DIR__);
$hooks=[];$logged=false;
function add_action($name,$callback,...$args){$GLOBALS['hooks'][$name][]=$callback;}
function is_user_logged_in(){return $GLOBALS['logged'];}
function wc_format_coupon_code($s){return strtolower(trim($s));}
function WC(){return $GLOBALS['woo'];}
class Session_Fixture{public $data=[];function set($k,$v){$this->data[$k]=$v;}function get($k,$d=null){return $this->data[$k]??$d;}function __unset($k){unset($this->data[$k]);}}
class Cart_Fixture{public $codes=['VALIDO','EXPIRADO'];public $attempts=[];function get_applied_coupons(){return $this->codes;}function has_discount($c){return in_array($c,$this->codes,true);}function apply_coupon($c){$this->attempts[]=$c;if($c==='valido')$this->codes[]=$c;}}
$woo=(object)['session'=>new Session_Fixture(),'cart'=>new Cart_Fixture()];
require dirname(__DIR__).'/inc/frontend/addresses-api.php';
ctwpml_preserve_auth_coupons();$woo->cart->codes=[];
$restore=$hooks['woocommerce_cart_loaded_from_session'][0];$restore($woo->cart);
if($woo->cart->attempts!==[])throw new RuntimeException('Restaurou antes da autenticação');
$logged=true;$restore($woo->cart);$restore($woo->cart);
if($woo->cart->codes!==['valido']||$woo->cart->attempts!==['valido','expirado'])throw new RuntimeException('Cupom sem revalidação ou restauração repetida');
echo "Cupons: sessão anterior preservada, autenticação exigida, revalidação pelo Woo e consumo único passaram.\n";
