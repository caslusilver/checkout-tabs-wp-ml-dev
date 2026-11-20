<?php
/** php -d extension=openssl tests/driver-ready.test.php — somente fixtures. */
require __DIR__ . '/quick-handoff.test.php';

// Formulário completo e retirada rápida obedecem à mesma regra de início.
$orders[951] = new WC_Order(951); $orders[952] = new WC_Order(952);
$calc['token'] = '95959595-9595-4595-8595-959595959595';
foreach ($calc['stops'] as $i => &$point) $point['order_id'] = 951 + $i;
unset($point);
$calc['destination_order_id'] = 952;
$calc['fingerprint'] = PPWOO_Route_Calculation::fingerprint([$orders[951], $orders[952]]);
PPWOO_Routes_Store::$routes[950] = ['id' => 950, 'revision' => 1, 'slot' => 950, 'state' => 'draft',
    'details' => ['calc' => $calc['token'], 'calculation_plan' => PPWOO_Route_Calculation::persist_plan($calc)]];
foreach ([951,952] as $i => $id) PPWOO_Routes_Store::$stops[$id] = ['route_id' => 950, 'order_id' => $id,
    'position' => $i + 1, 'delivery_state' => 'draft', 'event_state' => 'waiting', 'attempt' => 0, 'details' => []];
$access = CTWPML_Driver_Panel::admin_link(950);
parse_str(parse_url($access['driver_url'], PHP_URL_FRAGMENT), $parts);
$input = ['route_id' => 950, 'token' => $parts['acesso'], 'events' => []];
$preview = CTWPML_Driver_Panel::local($input);
expect($preview['pending_dispatch'], true, 'Link antecipado continua sendo prévia');
rejects(fn() => CTWPML_Driver_Panel::local(array_merge($input, ['events' => [driver_event($preview['driver'], 'start', 951, 951)]])), 409);
$jobsBefore = count($jobs); $fixture_uuid = '95959595-9595-4595-8595-959595959595';
(new ReflectionMethod(PPWOO_Routes::class, 'save_sheet'))->invoke(null, [
    'route_id' => 950, 'revision' => PPWOO_Routes_Store::route(950)['revision'],
    'sheet' => ['link' => 'https://tracking.example.test/trip', 'phone' => '11999990101', 'code' => '1234', 'costs' => ['951' => '20', '952' => '30']]], true);
$read = CTWPML_Driver_Panel::local($input);
expect($read['pending_dispatch'], false, 'Operador já confirmou a retirada');
expect($read['driver']['stops'][0]['state'], 'started', 'Primeira resposta já está a caminho');
expect($read['driver']['stops'][1]['state'], 'ready', 'Próxima parada segue sequencial');
expect(count($jobs), $jobsBefore + 1, 'Despacho completo mantém agendamento existente da rota');
$departure = PPWOO_Routes_Store::route(950)['details']['departed_at'];
expect(PPWOO_Routes_Store::route(950)['details']['driver_started_at'], $departure, 'Início é o horário confirmado pelo operador');
expect(isset($read['driver']['operator_start']), false, 'DTO não expõe marcador interno de compatibilidade');
$event = driver_event($read['driver'], 'arrive', 951, 952);
$arrived = CTWPML_Driver_Panel::local(array_merge($input, ['events' => [$event]]));
expect($arrived['driver']['stops'][0]['state'], 'arrived', 'Primeiro gesto do motoboy é chegada');
expect($arrived['route_revision'], PPWOO_Routes_Store::route(950)['revision'], 'Resposta informa a revisão realmente persistida');
$next = CTWPML_Driver_Panel::local(array_merge($input, ['events' => [driver_event($arrived['driver'], 'complete', 951, 953)]]));
expect($next['driver']['current'], 1, 'Segundo gesto já libera o próximo destino');
expect(PPWOO_Routes_Store::route(950)['details']['departed_at'], $departure, 'Gestos não refazem a saída');

// Um início antigo salvo offline pode chegar após a preparação por outro aparelho.
$base = PPWOO_Driver_State::initial([951,952]);
$fixture_uuid = '96969696-9696-4696-8696-969696969696';
$prepared = PPWOO_Driver_State::depart([951,952], gmdate('c'), $base);
$old = driver_event($base, 'start', 951, 960, '97979797-9797-4797-8797-979797979797');
$ack = PPWOO_Driver_State::apply($prepared, $old, [], gmdate('c'));
expect($ack['version'], $prepared['version'], 'Start offline equivalente não duplica início');
expect($ack['started_at'], $prepared['started_at'], 'Compatibilidade não redefine horário');
expect(PPWOO_Driver_State::apply($ack, $old, [], gmdate('c')), $ack, 'Resposta perdida do start antigo é idempotente');
$extra_start = $old; $extra_start['id'] = '99999999-9999-4999-8999-999999999999'; $extra_start['seq']++;
rejects(fn() => PPWOO_Driver_State::apply($ack, $extra_start, [], gmdate('c')),409);
$old_arrive = driver_event(PPWOO_Driver_State::view($ack), 'arrive', 951, 961, $old['device']);
$advanced = PPWOO_Driver_State::apply($ack, $old_arrive, [], gmdate('c'));
expect($advanced['stops'][0]['state'], 'arrived', 'Demais eventos antigos seguem em ordem');
$bad = $old; $bad['id'] = '98989898-9898-4898-8898-989898989898'; $bad['stop_id'] = 952;
rejects(fn() => PPWOO_Driver_State::apply($prepared, $bad, [], gmdate('c')), 409);
rejects(fn() => PPWOO_Driver_State::apply($advanced, $bad, [], gmdate('c')), 409);

// Rotas antigas são preparadas no servidor apenas depois de validar o acesso.
$legacy = PPWOO_Routes_Store::route(950); unset($legacy['details']['driver'], $legacy['details']['driver_started_at']);
$legacy['revision']++; PPWOO_Routes_Store::$routes[950] = $legacy;
$invalid = $input; $invalid['token'] = str_repeat('0',64);
rejects(fn() => CTWPML_Driver_Panel::local($invalid),403);
expect(isset(PPWOO_Routes_Store::route(950)['details']['driver']), false, 'Acesso inválido não prepara rota');
$legacyInput = $input + ['known_revision' => $legacy['revision']];
$ready = CTWPML_Driver_Panel::local($legacyInput);
expect($ready['driver']['stops'][0]['state'], 'started', 'Rota legada não retorna compact antes de preparar');
expect($ready['route_revision'], PPWOO_Routes_Store::route(950)['revision'], 'Revisão da preparação legada está sincronizada');
$compact = CTWPML_Driver_Panel::local($input + ['known_revision' => $ready['route_revision']]);
expect($compact, ['route_id' => 950, 'unchanged' => true], 'Resposta curta carrega identificador exigido pelo host remoto');

$options[CTWPML_Driver_Panel::CONFIG] = ['enabled' => true, 'mode' => 'remote', 'origin' => 'https://origin.example.test',
    'peer_host' => 'origin.example.test', 'connection' => 'fixture-shop', 'key_name' => 'driver_fixture'];
$driver_remote_result = $compact;
expect(CTWPML_Driver_Panel::remote_request($input), $compact, 'Resposta curta bilateral não é confundida com erro');
$driver_remote_result['route_id'] = 999;
rejects(fn() => CTWPML_Driver_Panel::remote_request($input),503);
unset($driver_remote_result);
echo "Motoboy pronto: despacho completo, prévia restrita, dois gestos, legado/offline compatível e polling bilateral passaram.\n";
