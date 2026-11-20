<?php
/** Só fixtures: php -d extension=openssl tests/quick-handoff.test.php. */
require __DIR__ . '/driver-panel.test.php';
$options[CTWPML_Driver_Panel::CONFIG] = ['enabled' => true, 'mode' => 'local', 'page' => 12];
$options['ppwoo_tracking_page'] = 12;
$options['ppwoo_routes_origin_postcode'] = '01234567';
$orders[801] = new WC_Order(801); $orders[802] = new WC_Order(802);
$calc = $valid;
$calc['stops'] = array_slice($valid['stops'], 0, 2);
foreach ($calc['stops'] as $i => &$point) $point['order_id'] = 801 + $i;
unset($point);
$calc += ['token' => '77777777-7777-4777-8777-777777777777', 'owner' => 123, 'origin_postcode' => '01234567',
    'input_ids' => [801, 802], 'expires_at' => time() - 1];
$calc['destination_order_id'] = 802;
$calc['fingerprint'] = PPWOO_Route_Calculation::fingerprint([$orders[801], $orders[802]]);
$route = ['id' => 700, 'revision' => 1, 'slot' => 99, 'state' => 'draft', 'details' => [
    'calc' => $calc['token'], 'calculation_plan' => PPWOO_Route_Calculation::persist_plan($calc), 'sheet' => ['link' => '', 'phone' => '', 'code' => '']]];
PPWOO_Routes_Store::$routes[700] = $route;
foreach ([801,802] as $i => $id) PPWOO_Routes_Store::$stops[$id] = ['route_id' => 700, 'order_id' => $id,
    'position' => $i + 1, 'delivery_state' => 'draft', 'event_state' => 'waiting', 'attempt' => 0, 'details' => []];
$call = static function ($method, $extra = []) {
    return (new ReflectionMethod(PPWOO_Routes::class, $method))->invoke(null,
        array_merge(['route_id' => 700, 'revision' => PPWOO_Routes_Store::route(700)['revision']], $extra));
};
$originalLink = PPWOO_Order_Tracking::order_link($orders[801]);
expect(PPWOO_Route_Calculation::get($calc['token']), null, 'Prévia já sumiu do transient');
$plan = PPWOO_Route_Calculation::route_plan($route);
expect($plan['expires_at'], 0, 'Plano não expira pelo relógio da prévia');
expect(count($plan['path']) > 0, true, 'Geometria temporária restaurada separadamente');
expect(isset($route['details']['calculation_plan']['path']), false, 'Rascunho não guarda geometria permanentemente');
$jobsBefore = count($jobs);
rejects(fn() => $call('handoff', ['phone' => '123']), 422);
$options['ppwoo_routes_origin_postcode'] = '87654321';
rejects(fn() => $call('handoff', ['phone' => '11999990101']), 409);
expect(PPWOO_Routes_Store::route(700)['state'], 'draft', 'Origem alterada impede saída com cálculo antigo');
$options['ppwoo_routes_origin_postcode'] = '01234567';
$fixture_uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$result = $call('handoff', ['phone' => '11999990101']);
$after = PPWOO_Routes_Store::route(700); $when = $after['details']['departed_at'];
$revisionAfter = $after['revision'];
(new ReflectionMethod(PPWOO_Routes::class, 'handoff'))->invoke(null, ['route_id' => 700, 'revision' => $revisionAfter - 1, 'phone' => '11999990101']);
expect(PPWOO_Routes_Store::route(700)['revision'], $revisionAfter, 'Resposta perdida da mesma retirada não duplica gravação');
expect($after['state'], 'dispatched', 'Somente telefone libera retirada');
expect($after['details']['sheet_pending'], true, 'Ficha permanece pendente');
expect($after['details']['driver']['stops'][0]['state'], 'started', 'Primeira parada inicia no servidor');
expect(count($jobs), $jobsBefore, 'Retirada não dispara evento incompleto');
// Autosave de texto parcial não pode tirar do cliente o contato já confirmado.
(new ReflectionMethod(PPWOO_Routes::class,'save_sheet'))->invoke(null, ['route_id'=>700,'revision'=>PPWOO_Routes_Store::route(700)['revision'],
    'sheet'=>['phone'=>'1','link'=>'','code'=>'','costs'=>[]]], false);
expect(PPWOO_Routes_Store::route(700)['details']['sheet']['phone'],'11999990101','Digitação parcial não substitui contato confirmado');
expect(PPWOO_Order_Tracking::order_link($orders[801]), $originalLink, 'Link do comprador continua estável');
$driverLink = $result['driver_url'];
$call('handoff', ['phone' => '11999990102']);
expect(PPWOO_Routes_Store::route(700)['details']['departed_at'], $when, 'Correção de telefone preserva a saída');
expect(CTWPML_Driver_Panel::admin_link(700)['driver_url'], $driverLink, 'Correção não revoga link');
$call('undo_handoff');
expect(PPWOO_Routes_Store::route(700)['state'], 'draft', 'Desfazer volta à preparação');
expect(PPWOO_Order_Tracking::order_link($orders[801]), $originalLink, 'Desfazer preserva link do cliente');
expect(CTWPML_Driver_Panel::admin_link(700)['driver_url'], $driverLink, 'Desfazer preserva link do entregador');
$fixture_uuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
$call('handoff', ['phone' => '11999990102']);
$after = PPWOO_Routes_Store::route(700); $when = $after['details']['departed_at'];
expect(PPWOO_Routes_Store::stop(801)['details']['access']['expires'] > time(), true, 'Nova saída repõe validade sem trocar token');
$token = substr($driverLink, strpos($driverLink, '&acesso=') + 8);
$read = CTWPML_Driver_Panel::local(['route_id' => 700, 'token' => $token, 'events' => []]);
expect($read['pending_dispatch'], false, 'Entregador abre com navegação liberada');
expect(CTWPML_Driver_Panel::local(['route_id' => 700, 'token' => $token, 'known_revision' => $read['route_revision'], 'events' => []]), ['route_id' => 700, 'unchanged' => true], 'Polling repetido identifica a rota sem enviar mapa/endereço outra vez');
rejects(fn() => CTWPML_Driver_Panel::local(['route_id' => 700, 'token' => str_repeat('0',64), 'known_revision' => $read['route_revision'], 'events' => []]),403);
$event = ['id' => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'device' => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'seq' => 1, 'version' => $read['driver']['version'], 'stop_id' => 801, 'type' => 'arrive', 'at' => gmdate('c')];
CTWPML_Driver_Panel::local(['route_id' => 700, 'token' => $token, 'events' => [$event]]);
rejects(fn() => $call('undo_handoff'), 409);
PPWOO_Routes::close_stops(PPWOO_Routes_Store::route(700), [801,802], 'customer');
expect(PPWOO_Routes_Store::stop(801)['delivery_state'], 'closed', 'Cliente pode receber antes da ficha completa');
expect(PPWOO_Routes_Store::route(700)['state'], 'dispatched', 'Ficha pendente permanece na listagem ativa sem buscar histórico');
$sheet = ['phone' => '11999990102', 'link' => 'https://uber.example.test/viagem', 'code' => '4321', 'costs' => ['801' => '20', '802' => '30']];
(new ReflectionMethod(PPWOO_Routes::class, 'save_sheet'))->invoke(null, ['route_id' => 700, 'revision' => PPWOO_Routes_Store::route(700)['revision'], 'sheet' => $sheet], true);
expect(PPWOO_Routes_Store::route(700)['details']['sheet_pending'], false, 'Ficha conclui mesmo após recebimento');
expect(PPWOO_Routes_Store::route(700)['state'], 'closed', 'Rota recebida encerra após completar a ficha');
expect(PPWOO_Routes_Store::route(700)['details']['departed_at'], $when, 'Evento mantém horário original');
expect(PPWOO_Routes_Store::stop(801)['delivery_state'], 'closed', 'Completar ficha não reabre recebimento');
expect(count($jobs), $jobsBefore + 1, 'Uma fila após concluir ficha');
rejects(fn() => (new ReflectionMethod(PPWOO_Routes::class,'save_sheet'))->invoke(null, ['route_id' => 700,'revision' => PPWOO_Routes_Store::route(700)['revision'],'sheet' => $sheet], true),409);
expect(count($jobs), $jobsBefore + 1, 'Repetir conclusão não duplica fila');
echo "Retirada rápida: cálculo durável, início, correção, reversão, links estáveis, polling e ficha/evento posterior passaram.\n";
