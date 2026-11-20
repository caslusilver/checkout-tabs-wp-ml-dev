<?php
/** Fixtures locais, sem loja ou pedidos reais: php tests/dispatch-timezone.test.php. */
require __DIR__ . '/packpanel-routes.test.php';

class Timezone_Order_Fixture extends WC_Order {
    public string $paid = '2026-11-20T16:45:00-03:00';
    public int $meta_saves = 0;
    public string $fixture_status = 'processing';
    public function get_status() { return $this->fixture_status; }
    public function get_date_paid() { return new DateTimeImmutable($this->paid); }
    public function save_meta_data() { $this->meta_saves++; }
}
function current_datetime() { return (new DateTimeImmutable('2026-11-20T20:12:00Z'))->setTimezone(wp_timezone()); }
$options['checkout_tabs_wp_ml_dispatch_schedule'] = ['fri' => ['15:00', '18:00'], 'sat' => ['15:00'], 'mon' => ['15:00']];
$options['checkout_tabs_wp_ml_dispatch_grace'] = 5;
$schedule = $options['checkout_tabs_wp_ml_dispatch_schedule'];
$original_schedule = $schedule;
$sp = new DateTimeZone('America/Sao_Paulo'); $utc = new DateTimeZone('UTC');
foreach (['2026-11-20T16:45:00-03:00' => '2026-11-20T18:00:00-03:00',
    '2026-11-20T18:04:59-03:00' => '2026-11-20T18:00:00-03:00',
    '2026-11-20T18:05:00-03:00' => '2026-11-21T15:00:00-03:00',
    '2026-11-22T10:00:00-03:00' => '2026-11-23T15:00:00-03:00'] as $input => $expected) {
    expect(ctwpml_dispatch_from_schedule(new DateTimeImmutable($input), $schedule, $sp, 5)->format('c'), $expected, 'Calendário local, corte exclusivo e dia sem saída');
}
expect(ctwpml_dispatch_from_schedule(new DateTimeImmutable('2026-11-21T23:59:00-03:00'), ['sun' => ['00:00']], $sp, 5)->format('c'), '2026-11-22T00:00:00-03:00', 'Virada do dia usa calendário local');
expect(ctwpml_dispatch_from_schedule(new DateTimeImmutable('2026-11-20T18:00:00-03:00'), $schedule, $sp, 0)->format('c'), '2026-11-21T15:00:00-03:00', 'Tolerância zero fecha no instante da saída');

$orders[901] = $new = new Timezone_Order_Fixture(901);
$expected_day = (wp_date('Y-m-d', time()) === '2026-11-20' ? 'Hoje, ' : 'Dia ') . '20/11';
$preview = PPWOO_Order_Tracking::preparation($new, null, false);
expect($preview['dispatch_time'], '18:00', 'Novo pedido às 16h45 prevê 18h');
expect($preview['dispatch_day'], $expected_day, 'Pedido prevê dia 20 local, não dia 21');
expect($new->meta_saves, 0, 'Prévia não grava metadados');
PPWOO_Order_Tracking::preparation($new);
$context = $new->get_meta('_ppwoo_dispatch_context');
expect($context['timezone'], 'America/Sao_Paulo', 'Contexto registra fuso');
expect($context['reference_at'], (new DateTimeImmutable($new->paid))->getTimestamp(), 'Base é instante absoluto do pagamento');
$options['checkout_tabs_wp_ml_dispatch_schedule'] = ['mon' => ['12:00']];
PPWOO_Order_Tracking::preparation($new);
expect($new->meta_saves, 1, 'Polling/calendário posterior não regrava nem muda promessa válida');
expect($new->get_meta('_ppwoo_dispatch_window'), $context['window'], 'Preserva previsão válida');
$options['checkout_tabs_wp_ml_dispatch_schedule'] = $original_schedule;

// Reproduz o caso real: aprovação 19h45 UTC; janela antiga amanhã 15h UTC, exibida 12h em SP.
$orders[902] = $legacy = new Timezone_Order_Fixture(902);
$legacy_utc = ctwpml_dispatch_from_schedule(new DateTimeImmutable($legacy->paid), $schedule, $utc, 5)->getTimestamp();
$legacy->update_meta_data('_ppwoo_dispatch_window', $legacy_utc);
expect(wp_date('H:i', $legacy_utc), '12:00', 'Reproduz janela antiga deslocada para meio-dia');
$preview = PPWOO_Order_Tracking::preparation($legacy, null, false);
expect($preview['dispatch_time'], '18:00', 'Prévia calcula correção sem gravar');
expect($legacy->get_meta('_ppwoo_dispatch_window'), $legacy_utc, 'Prévia preserva registro original');
$corrected = PPWOO_Order_Tracking::preparation($legacy);
expect($corrected['dispatch_day'], $expected_day, 'Legado UTC volta para dia 20 local');
expect($corrected['dispatch_time'], '18:00', 'Legado UTC usa hora de saída da loja');
expect($legacy->get_meta('_ppwoo_dispatch_context')['correction']['previous_window'], $legacy_utc, 'Auditoria preserva valor anterior');
$saved = $legacy->get_meta('_ppwoo_dispatch_window');
PPWOO_Order_Tracking::preparation($legacy);
expect($legacy->meta_saves, 1, 'Migração é repetível sem alterar de novo');
expect($legacy->get_meta('_ppwoo_dispatch_window'), $saved, 'Não subtrai três horas a cada leitura');

// Contexto novo conhece o calendário e a base originais, mesmo após alterações posteriores.
$GLOBALS['fixture_timezone'] = 'UTC';
$orders[903] = $known = new Timezone_Order_Fixture(903);
PPWOO_Order_Tracking::preparation($known);
$known->paid = '2026-11-21T21:00:00-03:00';
$options['checkout_tabs_wp_ml_dispatch_schedule'] = ['mon' => ['12:00']];
$GLOBALS['fixture_timezone'] = 'America/Sao_Paulo';
expect(PPWOO_Order_Tracking::preparation($known)['dispatch_time'], '18:00', 'Troca de fuso reutiliza regras/base originais');
expect($known->get_meta('_ppwoo_dispatch_context')['correction']['reason'], 'timezone_changed', 'Motivo conhecido é mudança de fuso');
expect($known->get_date_paid()->format('c'), '2026-11-21T21:00:00-03:00', 'Não altera pagamento');
$options['checkout_tabs_wp_ml_dispatch_schedule'] = $original_schedule;

// Origem desconhecida ou alteração manual não autoriza inventar promessa.
$orders[904] = $unknown = new Timezone_Order_Fixture(904);
$unknown->update_meta_data('_ppwoo_dispatch_window', (new DateTimeImmutable('2026-11-21T13:17:00Z'))->getTimestamp());
expect(PPWOO_Order_Tracking::preparation($unknown, null, false)['dispatch_review'], true, 'Prévia administrativa sinaliza legado não reconhecido');
expect(PPWOO_Order_Tracking::preparation($unknown)['dispatch_review'], false, 'Diagnóstico interno não aparece ao cliente');
expect($unknown->meta_saves, 0, 'Legado desconhecido não é reescrito');

// Mesmo emissão de link sem parâmetro de rota identifica despacho já realizado.
$orders[905] = $sent = new Timezone_Order_Fixture(905);
$sent->update_meta_data('_ppwoo_dispatch_window', $legacy_utc);
PPWOO_Routes_Store::$routes[905] = ['id' => 905, 'state' => 'dispatched', 'details' => []];
PPWOO_Routes_Store::$stops[905] = ['route_id' => 905, 'order_id' => 905];
PPWOO_Order_Tracking::preparation($sent);
expect($sent->meta_saves, 0, 'Pedido despachado permanece intacto mesmo sem rota no argumento');
expect($sent->get_meta('_ppwoo_dispatch_window'), $legacy_utc, 'Não altera histórico de despacho');
$orders[906] = $closed = new Timezone_Order_Fixture(906);
$closed->fixture_status = 'completed';
$closed->update_meta_data('_ppwoo_dispatch_window', $legacy_utc);
PPWOO_Order_Tracking::preparation($closed);
expect($closed->meta_saves, 0, 'Pedido concluído não participa da reparação');

$native = PPWOO_Order_Tracking::webhook_payload(['meta_data' => [
    ['key' => '_ppwoo_dispatch_context', 'value' => $context],
    ['key' => '_billing_dial_code', 'value' => '+33']]], 'order', 901);
expect(array_column($native['meta_data'], 'key'), ['_billing_dial_code'], 'Contexto interno é omitido sem remover o DDI do contrato');

$notice = ctwpml_dispatch_notice();
expect(str_contains($notice['dispatch_notice'], 'hoje, 20/11, às 18h'), true, 'Aviso do checkout usa mesmo relógio local');
echo "Fuso: horário local, UTC legado, contexto, corte, dia/virada, prévia, atraso fixo e despachos preservados passaram.\n";
