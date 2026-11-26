<?php
/** Calendário e exceções locais: sem WordPress/loja reais. */
require __DIR__ . '/driver-ready.test.php';
function add_shortcode(...$args) {}
function current_datetime() { return new DateTimeImmutable($GLOBALS['dispatch_now']); }
function sanitize_textarea_field($value) { return trim(strip_tags($value)); }
require dirname(__DIR__) . '/inc/dispatch-controls.php';

class Dispatch_Order_Fixture extends WC_Order {
    public string $created = '2026-11-20T14:50:00-03:00';
    public string $paid = '2026-11-20T17:10:00-03:00';
    public function get_date_created() { return new DateTimeImmutable($this->created); }
    public function get_date_paid() { return new DateTimeImmutable($this->paid); }
}
$GLOBALS['fixture_timezone'] = 'America/Sao_Paulo';
$GLOBALS['dispatch_now'] = '2026-11-20T15:10:00-03:00';
unset($options[CTWPML_Dispatch_Controls::OPTION]);
$options['checkout_tabs_wp_ml_dispatch_schedule'] = ['fri' => ['15:00', '18:00'], 'sat' => ['15:00']];
$options['checkout_tabs_wp_ml_dispatch_grace'] = 5;
$before = new Dispatch_Order_Fixture(9901);
CTWPML_Dispatch_Controls::capture_order($before);
expect(wp_date('Y-m-d H:i', $before->get_meta('_ppwoo_dispatch_window')), '2026-11-20 15:00', 'Pedido novo fixa previsão na criação antes da confirmação manual');
$revision = CTWPML_Dispatch_Controls::revision();
$closed = CTWPML_Dispatch_Controls::write(['command'=>'toggle','open'=>false,'revision'=>$revision]);
class Dispatch_Errors_Fixture { public array $errors=[]; public function add(...$args) { $this->errors[]=$args; } }
$errors=new Dispatch_Errors_Fixture(); $_POST=[];
CTWPML_Dispatch_Controls::validate_checkout(['shipping_method'=>['flat_rate:2']],$errors);
expect(count($errors->errors),0,'Correios não exige aceite do fechamento');
CTWPML_Dispatch_Controls::validate_checkout(['shipping_method'=>['flat_rate:3']],$errors);
expect(count($errors->errors),1,'Servidor recusa ausência de aceite quando fecha durante preenchimento');
$_POST['ctwpml_dispatch_ack']=$closed['public']['signature'];$errors=new Dispatch_Errors_Fixture();
CTWPML_Dispatch_Controls::validate_checkout(['shipping_method'=>['flat_rate:3']],$errors);
expect(count($errors->errors),0,'Aceite da revisão atual permite concluir compra');
expect($closed['public']['closed'], true, 'Fechamento temporário ativo');
expect($closed['public']['next_label'], 'amanhã, 21/11, às 15:00', 'Próxima saída útil evita restante de hoje');
expect(isset($closed['periods']), false, 'Histórico interno não vai à interface');
expect(str_contains($closed['public']['warning'], 'Não teremos mais envios'), true, 'Aviso explícito sem bloquear compra');
rejects(fn()=>CTWPML_Dispatch_Controls::write(['command'=>'toggle','open'=>true,'revision'=>$revision]),409);
$lateApproval = new Dispatch_Order_Fixture(9902);
expect(PPWOO_Order_Tracking::preparation($lateApproval)['dispatch_time'], '15:00', 'Aprovação tardia de compra anterior não muda compromisso');
CTWPML_Dispatch_Controls::capture_order($before);
expect(wp_date('H:i', $before->get_meta('_ppwoo_dispatch_window')), '15:00', 'Snapshot anterior não é reescrito ao fechar');
$after = new Dispatch_Order_Fixture(9903); $after->created = '2026-11-20T15:11:00-03:00';
CTWPML_Dispatch_Controls::capture_order($after);
expect(wp_date('Y-m-d H:i', $after->get_meta('_ppwoo_dispatch_window')), '2026-11-21 15:00', 'Compra após fechamento prevê próximo dia útil');
$GLOBALS['dispatch_now'] = '2026-11-21T10:00:00-03:00';
expect(CTWPML_Dispatch_Controls::public_state()['closed'], false, 'Reabre automaticamente no dia seguinte');
expect(CTWPML_Dispatch_Controls::skip_dates(strtotime('2026-11-20T15:11:00-03:00')), ['2026-11-20'], 'Reabertura automática preserva histórico para confirmação posterior');
$GLOBALS['dispatch_now'] = '2026-11-20T16:00:00-03:00';
$opened = CTWPML_Dispatch_Controls::write(['command'=>'toggle','open'=>true,'revision'=>CTWPML_Dispatch_Controls::revision()]);
expect($opened['public']['closed'], false, 'Operador pode reabrir hoje');
expect($opened['public']['next_label'], 'hoje, 20/11, às 18:00', 'Reabertura usa calendário original');
expect(CTWPML_Dispatch_Controls::skip_dates(strtotime('2026-11-20T15:11:00-03:00')), ['2026-11-20'], 'Reabertura manual preserva condições da compra feita durante pausa');
expect(wp_date('Y-m-d H:i', $after->get_meta('_ppwoo_dispatch_window')), '2026-11-21 15:00', 'Previsão já prometida permanece congelada');
$save = array_merge(CTWPML_Dispatch_Controls::admin_state(), ['command'=>'save']);
$bad = $save; $bad['schedule']['fri'] = ['25:00']; rejects(fn()=>CTWPML_Dispatch_Controls::write($bad),422);
$bad = $save; $bad['banner_open'] = '{token_privado}'; rejects(fn()=>CTWPML_Dispatch_Controls::write($bad),422);
$bad = $save; $bad['color_open'] = 'url(https://example.test)'; rejects(fn()=>CTWPML_Dispatch_Controls::write($bad),422);
$can_administer=false; rejects(fn()=>CTWPML_Dispatch_Controls::write($save),403); $can_administer=true;
$save['banner_open'] = '<b>Saída</b>: {proximo_horario} / {horarios_hoje}';
$save['basis'] = 'paid';
$saved = CTWPML_Dispatch_Controls::write($save);
expect($saved['public']['message'], 'Saída: 18:00 / 15:00 e 18:00', 'Texto limpo e variáveis públicas resolvidas');
$future = new Dispatch_Order_Fixture(9904); CTWPML_Dispatch_Controls::capture_order($future);
expect(wp_date('H:i', $future->get_meta('_ppwoo_dispatch_window')), '18:00', 'Critério pagamento é escolha explícita para novos pedidos');
expect(wp_date('H:i', $before->get_meta('_ppwoo_dispatch_window')), '15:00', 'Trocar critério não muda promessa anterior');
$options['checkout_tabs_wp_ml_dispatch_schedule'] = [];
expect(CTWPML_Dispatch_Controls::public_state()['next_at'], 0, 'Instalação sem horários não inventa saída');
expect(CTWPML_Dispatch_Controls::public_state()['next_label'], 'horário a confirmar', 'Sem calendário informa necessidade de configuração');
expect(CTWPML_Dispatch_Controls::banner_padding(),['top'=>12,'right'=>16,'bottom'=>12,'left'=>16],'Sem configuração preserva espaçamento anterior');
$options['checkout_tabs_wp_ml_dispatch_banner_padding']=['top'=>'0','right'=>9,'bottom'=>3,'left'=>7];
expect(CTWPML_Dispatch_Controls::public_state()['padding'],['top'=>0,'right'=>9,'bottom'=>3,'left'=>7],'Aviso público oferece quatro lados independentes e zero');
expect(CTWPML_Dispatch_Controls::sanitize_banner_padding(['top'=>-1,'right'=>999,'bottom'=>['bad'],'left'=>'0; color:red']),['top'=>0,'right'=>80,'bottom'=>12,'left'=>16],'Padding recusa CSS e estrutura inválida');
function wp_enqueue_style(...$a){}function wp_enqueue_script(...$a){}function wp_localize_script(...$a){}
function checkout_tabs_wp_ml_get_version(){return '3.4.18';}
define('CHECKOUT_TABS_WP_ML_URL','https://fixture.test/plugin/');
$banner=CTWPML_Dispatch_Controls::shortcode();
expect(str_contains($banner,'--dispatch-padding-top:0px;'),true,'Shortcode carrega padding salvo no primeiro render');
expect(str_contains($banner,'--dispatch-padding-right:9px;'),true,'Padding de cada lado é renderizado separadamente');
echo "Envios: fechamento, criação anterior, confirmação tardia, reabertura, snapshots, variáveis e padding independente passaram.\n";
