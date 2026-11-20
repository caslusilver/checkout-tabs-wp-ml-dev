<?php
/** CLI: php tests/driver-panel.test.php. Reutiliza as fixtures/contratos reais do PackPanel. */
require __DIR__ . '/packpanel-routes.test.php';
require dirname(__DIR__) . '/inc/security/class-key-vault.php';
require $core . 'class-driver-state.php';
require dirname(__DIR__) . '/inc/driver/class-driver-panel.php';
require dirname(__DIR__) . '/inc/driver/class-driver-admin.php';

function is_ssl() { return $GLOBALS['fixture_ssl'] ?? true; }
function add_option($name, $value, ...$args) {
    if (isset($GLOBALS['options'][$name])) return false;
    $GLOBALS['options'][$name] = $value; return true;
}
$wpdb = new class { public function prepare($query, ...$values) { if (str_contains($query, 'GET_LOCK')) expect(strlen($values[0]) <= 64, true, 'Nome do mutex cabe no limite MySQL'); return $query; } public function get_var($query) { return 1; } };

// AAD, IV aleatório, integridade e migração sem alterar o gerenciador anterior.
$a = CTWPML_Key_Vault::encrypt('fixture_key', 'fixture-value');
$b = CTWPML_Key_Vault::encrypt('fixture_key', 'fixture-value');
expect($a['iv'] !== $b['iv'], true, 'Mesmo segredo usa IV diferente em cada gravação');
expect(CTWPML_Key_Vault::decrypt('fixture_key', $a), 'fixture-value', 'Cofre recupera o próprio segredo');
expect(CTWPML_Key_Vault::decrypt('other_name', $a), null, 'Nome faz parte da autenticação criptográfica');
$bad = $a; $bad['tag'] = base64_encode(str_repeat('x', 16));
expect(CTWPML_Key_Vault::decrypt('fixture_key', $bad), null, 'Adulteração não devolve texto');
$bad = $a; $bad['iv'] = [];
expect(CTWPML_Key_Vault::decrypt('fixture_key', $bad), null, 'Envelope malformado não gera TypeError');
$options['sakm_encrypted_keys'] = ['legacy_fixture' => 'preserve-original'];
$keys['legacy_fixture'] = 'fixture-legacy-value';
expect(CTWPML_Key_Vault::get('legacy_fixture'), 'fixture-legacy-value', 'Leitura legada compatível');
expect(CTWPML_Key_Vault::migrate(), ['imported' => 1, 'failed' => 0], 'Importação explícita funciona');
expect($options['sakm_encrypted_keys'], ['legacy_fixture' => 'preserve-original'], 'Importar não apaga nem altera legado');
unset($keys['legacy_fixture']);
expect(CTWPML_Key_Vault::get('legacy_fixture'), 'fixture-legacy-value', 'Chave interna independe do snippet após importação');
expect(CTWPML_Key_Vault::migrate(), ['imported' => 0, 'failed' => 0], 'Importação repetida não sobrescreve chave');
$options[CTWPML_Key_Vault::OPTION]['legacy_fixture'] = $bad;
expect(CTWPML_Key_Vault::get('legacy_fixture'), null, 'Corrupção interna não é escondida por fallback');
echo "Cofre: IV aleatório, integridade, migração e preservação do legado passaram.\n";

function driver_event(array $state, string $type, int $stop, int $ordinal, string $device = '11111111-1111-4111-8111-111111111111'): array {
    return ['id' => sprintf('%08d-1111-4111-8111-111111111111', $ordinal), 'device' => $device,
        'seq' => ($state['devices'][$device] ?? 0) + 1, 'version' => $state['version'], 'stop_id' => $stop, 'type' => $type, 'at' => gmdate('c', time() - 60)];
}
$s = PPWOO_Driver_State::initial([201,202]); $ev = driver_event($s, 'start', 201, 1);
$started = PPWOO_Driver_State::apply($s, $ev, [], gmdate('c'));
expect($started['stops'][0]['state'], 'started', 'Primeiro slide inicia rota');
expect(PPWOO_Driver_State::apply($started, $ev, [], gmdate('c')), $started, 'Resposta perdida pode repetir exatamente a mesma ação');
$changed = $ev; $changed['type'] = 'complete';
rejects(fn() => PPWOO_Driver_State::apply($started, $changed, [], gmdate('c')), 409);
rejects(fn() => PPWOO_Driver_State::apply($s, driver_event($s, 'start', 202, 2), [], gmdate('c')), 409);
$arrived = PPWOO_Driver_State::apply($started, driver_event($started, 'arrive', 201, 2), [], gmdate('c'));
$advanced = PPWOO_Driver_State::apply($arrived, driver_event($arrived, 'complete', 201, 3), [], gmdate('c'));
expect($advanced['current'], 1, 'Conclusão inicia próxima parada');
expect($advanced['stops'][1]['state'], 'started', 'Próxima navegação fica liberada');
$correction = driver_event($advanced, 'correct', 201, 4);
rejects(fn() => PPWOO_Driver_State::apply($advanced, $correction, [201], gmdate('c')), 409);
$corrected = PPWOO_Driver_State::apply($advanced, $correction, [], gmdate('c'));
expect(array_column($corrected['stops'], 'state'), ['started','ready'], 'Correção preserva sequência e volta à parada');
expect(count($corrected['receipts']), 4, 'Correção preserva histórico');
$last_arrived = PPWOO_Driver_State::apply($advanced, driver_event($advanced, 'arrive', 202, 5), [], gmdate('c'));
$done = PPWOO_Driver_State::apply($last_arrived, driver_event($last_arrived, 'complete', 202, 6), [], gmdate('c'));
expect($done['status'], 'completed', 'Última parada encerra atuação do motorista');
expect(PPWOO_Driver_State::apply($done, driver_event($done, 'correct', 202, 7), [], gmdate('c'))['status'], 'started', 'Pode corrigir próprio evento final antes do comprador');
rejects(fn() => PPWOO_Driver_State::apply($done, driver_event($done, 'correct', 202, 7), [202], gmdate('c')), 409);
expect(isset(PPWOO_Driver_State::view($done)['receipts']), false, 'Histórico interno não é enviado ao navegador');
echo "Motoboy: sequência, idempotência, correções e confirmação do comprador passaram.\n";

// Serviço real sobre o armazenamento transacional simulado das rotas.
$options[CTWPML_Driver_Panel::CONFIG] = ['enabled' => true, 'mode' => 'local', 'page' => 89,
    'key_name' => 'driver_fixture', 'connection' => 'fixture-shop', 'peer_host' => 'driver.example.test'];
$keys['driver_fixture'] = str_repeat('fixture-', 8);
$orders[202] = new WC_Order(202);
$route = ['id' => 40, 'slot' => 2, 'state' => 'dispatched', 'revision' => 1, 'details' => ['departed_at' => gmdate('c'),
    'dispatched_calculation' => ['destination_order_id' => 202, 'origin' => ['lat' => -23.5, 'lng' => -46.8], 'stops' => [
        ['order_id' => 201, 'eta_seconds' => 180, 'location' => ['lat' => -23.6,'lng' => -46.7]],
        ['order_id' => 202, 'eta_seconds' => 780, 'location' => ['lat' => -23.7,'lng' => -46.6]]]],
    'sheet' => ['code' => 'fixture-private', 'phone' => '11999998888']]];
PPWOO_Routes_Store::$routes[40] = $route;
foreach ([201,202] as $i => $id) PPWOO_Routes_Store::$stops[$id] = ['route_id' => 40,'order_id' => $id,'position' => $i+1,'delivery_state' => 'on_route','event_state' => 'accepted','attempt' => 1,'details' => []];
$access = CTWPML_Driver_Panel::admin_link(40);
parse_str(parse_url($access['driver_url'], PHP_URL_FRAGMENT), $link_parts);
$input = ['route_id' => 40,'token' => $link_parts['acesso']];
$dto = CTWPML_Driver_Panel::local($input);
$bad_batch = [driver_event($dto['driver'], 'start', 201, 18), driver_event($dto['driver'], 'complete', 202, 19)];
rejects(fn() => CTWPML_Driver_Panel::local($input + ['events' => $bad_batch]),409);
expect(isset(PPWOO_Routes_Store::route(40)['details']['driver']),false,'Lote inválido não aplica nem a primeira ação');
expect(count($dto['stops']), 2, 'Token de rota autoriza somente paradas dessa rota');
expect(isset($dto['driver']['receipts']), false, 'DTO não expõe histórico interno');
expect(isset($dto['sheet']), false, 'DTO não expõe ficha/código ou custos');
expect(str_starts_with($dto['stops'][0]['waze'], 'https://waze.com/ul?q='), true, 'Navegação por Waze codificada');
rejects(fn() => CTWPML_Driver_Panel::local($input + ['events' => array_fill(0, 21, [])]), 422);
$invalid = $input; $invalid['token'] = str_repeat('0',64); rejects(fn() => CTWPML_Driver_Panel::local($invalid), 403);
$input['events'] = [driver_event($dto['driver'], 'start', 201, 20)];
$dto = CTWPML_Driver_Panel::local($input);
$revision = PPWOO_Routes_Store::route(40)['details']['driver']['version'];
CTWPML_Driver_Panel::local($input);
expect(PPWOO_Routes_Store::route(40)['details']['driver']['version'], $revision, 'Reenvio não repete transição');
expect(PPWOO_Routes_Store::stop(201)['delivery_state'], 'on_route', 'Motorista não confirma pelo cliente');
expect(PPWOO_Order_Tracking::projection(PPWOO_Routes_Store::route(40), PPWOO_Routes_Store::stop(201))['driver_stage'], 'started', 'Cliente vê próprio estado');
expect(isset(PPWOO_Order_Tracking::projection(PPWOO_Routes_Store::route(40), PPWOO_Routes_Store::stop(201))['driver']), false, 'Cliente não recebe estados/contatos privados da rota');
$started_at = strtotime(PPWOO_Routes_Store::route(40)['details']['driver_started_at']);
expect(strtotime(PPWOO_Routes_Store::stop(202)['details']['eta_at']), $started_at + 780, 'Previsão conta do início efetivo');
$input['events'] = [driver_event($dto['driver'], 'arrive', 201, 21)];
$dto = CTWPML_Driver_Panel::local($input);
$input['events'] = [driver_event($dto['driver'], 'complete', 201, 22)];
$dto = CTWPML_Driver_Panel::local($input);
expect($dto['driver']['current'], 1, 'Avanço confirmado no serviço');
expect(PPWOO_Routes_Store::stop(201)['delivery_state'], 'on_route', 'Entrega do motorista permanece distinta da baixa');
$next_at = strtotime(PPWOO_Routes_Store::route(40)['details']['driver']['stops'][1]['started_at']);
expect(strtotime(PPWOO_Routes_Store::stop(202)['details']['eta_at']), $next_at + 600, 'Próxima previsão usa somente trecho restante');

PPWOO_Routes::close_stops(PPWOO_Routes_Store::route(40), [201,202], 'customer');
$input['events'] = [driver_event($dto['driver'], 'arrive', 202, 23)];
$dto = CTWPML_Driver_Panel::local($input);
expect($dto['closed'], true, 'Rota baixada não revela mais endereços');
expect(isset($dto['stops']), false, 'DTO de encerrada é mínimo');
expect($dto['driver']['stops'][1]['state'], 'arrived', 'Evento offline legítimo é conciliado após confirmação do comprador');
$can_administer = false; rejects(fn() => CTWPML_Driver_Panel::admin_reopen(40,201), 403); $can_administer = true;
CTWPML_Driver_Panel::admin_reopen(40,201);
expect(PPWOO_Routes_Store::stop(201)['delivery_state'], 'on_route', 'Só administrador reabre entrega');
expect(PPWOO_Routes_Store::stop(202)['delivery_state'], 'closed', 'Reabrir um não desfaz recebimento de outro');
expect(PPWOO_Routes_Store::stop(201)['details']['reopen_history'][0]['source'], 'customer', 'Revisão mantém origem da confirmação');
rejects(fn() => CTWPML_Driver_Panel::local($input), 403);
$options['ppwoo_tracking_wait_driver'] = 'yes'; $options[CTWPML_Driver_Panel::CONFIG]['enabled'] = false;
expect(PPWOO_Order_Tracking::wait_for_driver(), false, 'Desligar painel restaura acompanhamento normal');
$options[CTWPML_Driver_Panel::CONFIG]['enabled'] = true;
echo "Motoboy: token, projeção privada, ETA, conciliação e reabertura administrativa passaram.\n";

// A assinatura vincula corpo, relógio, nonce, conexão e host permitido; nonce é consumido uma vez.
$body = json_encode(['diagnostic' => true]); $stamp = (string) time(); $nonce = bin2hex(random_bytes(16));
$headers = ['x-ctdrv-time' => $stamp, 'x-ctdrv-nonce' => $nonce, 'x-ctdrv-site' => 'driver.example.test', 'x-ctdrv-connection' => 'fixture-shop'];
$headers['x-ctdrv-signature'] = hash_hmac('sha256', $stamp . "\n" . $nonce . "\nfixture-shop\ndriver.example.test\n" . $body, $keys['driver_fixture']);
function driver_request($headers, $body) { return new class($headers,$body) {
    public function __construct(private array $headers, private string $body) {}
    public function get_header($name) { return $this->headers[$name] ?? ''; }
    public function get_body() { return $this->body; }
}; }
expect(CTWPML_Driver_Panel::permission(driver_request($headers,$body)), true, 'Assinatura válida permitida');
expect(CTWPML_Driver_Panel::permission(driver_request($headers,$body)) instanceof WP_Error, true, 'Replay é recusado');
$headers['x-ctdrv-nonce'] = bin2hex(random_bytes(16));
expect(CTWPML_Driver_Panel::permission(driver_request($headers,$body)) instanceof WP_Error, true, 'Nonce alterado invalida assinatura');
$headers['x-ctdrv-site'] = 'evil.example.test';
expect(CTWPML_Driver_Panel::permission(driver_request($headers,$body)) instanceof WP_Error, true, 'Host não autorizado é recusado');
$fixture_ssl = false;
expect(CTWPML_Driver_Panel::permission(driver_request($headers,$body)) instanceof WP_Error, true, 'HTTP sem TLS é recusado'); $fixture_ssl = true;
CTWPML_Driver_Panel::limit('test-limiter',2); CTWPML_Driver_Panel::limit('test-limiter',2);
rejects(fn() => CTWPML_Driver_Panel::limit('test-limiter',2),429);
$options[CTWPML_Driver_Panel::CONFIG]['mode'] = 'remote';
$options[CTWPML_Driver_Panel::CONFIG]['origin'] = 'https://unknown.example.test';
rejects(fn() => CTWPML_Driver_Panel::remote_request(['diagnostic' => true]),503);
echo "Conexão: assinatura, replay, TLS, domínio permitido e limite de requisições passaram.\n";
