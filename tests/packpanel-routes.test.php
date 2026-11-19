<?php
/** Executar na raiz do repo com php tests/packpanel-routes.test.php. */
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);

function expect($actual, $expected, string $description): void {
    if ($actual !== $expected) {
        throw new RuntimeException($description . PHP_EOL . var_export([$actual, $expected], true));
    }
}

function rejects(callable $call, int $code): void {
    try {
        $call();
    } catch (DomainException $error) {
        expect($error->getCode(), $code, 'Código da rejeição');
        return;
    }
    throw new RuntimeException('A operação deveria ter sido rejeitada.');
}

$options = ['ppwoo_routes_enabled' => 'yes', 'ppwoo_routes_origin' => 'Origem fictícia, CEP 01234-567',
    'ppwoo_routes_url' => 'https://calculo.example.test/rotas'];
$cache = $calls = $jobs = $orders = [];
$keys = ['authorization' => 'Bearer fixture-default', 'authorization_rotas' => 'fixture-route-token'];
$can_administer = true;
$remote_mode = 'accepted';

function get_option($name, $default = false) { return $GLOBALS['options'][$name] ?? $default; }
function update_option($name, $value, $autoload) { $GLOBALS['options'][$name] = $value; }
function sakm_get_key($name) { return $GLOBALS['keys'][$name] ?? null; }
function wp_unslash($value) { return stripslashes($value); }
function current_user_can($capability) { return $capability === 'manage_options' && $GLOBALS['can_administer']; }
function check_admin_referer($action, $field) {
    if ($action !== 'ppwoo_routes_settings' || ($_POST[$field] ?? '') !== 'fixture-nonce') throw new DomainException('Nonce inválido.', 403);
}
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return esc_html($value); }
function esc_url($value) { return esc_attr($value); }
function admin_url($path) { return 'https://sandbox.example.test/wp-admin/' . $path; }
function wp_nonce_field($action, $field) {}
function checked($value) {}
function submit_button(...$args) {}
function wp_is_uuid($value, $version) { return (bool) preg_match('/^[a-f0-9-]{36}$/D', $value); }
function wp_generate_uuid4() { return '11111111-1111-4111-8111-111111111111'; }
function get_current_user_id() { return 123; }
function get_transient($k) { return $GLOBALS['cache'][$k] ?? false; }
function set_transient($k, $v, $ttl) { $GLOBALS['cache'][$k] = $v; return true; }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_parse_url($url, $part) { return parse_url($url, $part); }
function wp_http_validate_url($url) { return str_starts_with($url, 'https://'); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_remote_retrieve_response_code($r) { return $r['status']; }
function wp_remote_retrieve_body($r) { return $r['body']; }
function sanitize_text_field($s) { return trim(strip_tags($s)); }
function esc_url_raw($value, $schemes) { return parse_url($value, PHP_URL_HOST) ? $value : ''; }
function absint($value) { return abs((int) $value); }
function wp_timezone() { return new DateTimeZone('America/Sao_Paulo'); }
function wp_date($format, $time) { return (new DateTimeImmutable('@' . $time))->setTimezone(wp_timezone())->format($format); }
function wc_format_decimal($value, $places) { return number_format((float) $value, $places, '.', ''); }
function apply_filters($tag, $value, ...$args) { return $value; }
function home_url($path) { return 'https://sandbox.example.test' . $path; }
function wc_get_order($order_id) { return $GLOBALS['orders'][$order_id] ?? null; }
function as_enqueue_async_action($hook, $args, $group) { $GLOBALS['jobs'][] = $args[0]; return count($GLOBALS['jobs']); }

function wp_safe_remote_post($url, $data) {
    $body = json_decode($data['body'], true, 24, JSON_THROW_ON_ERROR);
    $GLOBALS['calls'][] = ['url' => $url, 'body' => $body, 'headers' => $data['headers']];
    if ($url === $GLOBALS['options']['ppwoo_routes_url']) {
        if ($GLOBALS['remote_mode'] === 'auth_rejected') return ['status' => 401, 'body' => '{}'];
        $fixture = $GLOBALS['fixture'];
        $fixture['revision'] = $body['revision'];
        return ['status' => 200, 'body' => json_encode($fixture)];
    }
    if ($GLOBALS['remote_mode'] === 'timeout') return new WP_Error();
    if ($GLOBALS['remote_mode'] === 'rejected') return ['status' => 422, 'body' => '{"accepted":false}'];
    return ['status' => 202, 'body' => '{"accepted":true}'];
}

class WP_Error {}
class PPWOO_Config {
    public static function get_webhook_url() { return 'https://envio.example.test/atualizar'; }
}
class PPWOO_Debug {
    public static function info(...$args) {}
    public static function warn(...$args) {}
    public static function error(...$args) {}
}
class WC_Order {
    private array $meta = [];
    private string $status = 'processing';
    private int $id;
    public function __construct(int $id) { $this->id = $id; }
    public function get_id() { return $this->id; }
    public function get_shipping_methods() { return [new class {
        public function get_method_title() { return 'Motoboy'; }
        public function get_name() { return 'Motoboy'; }
        public function get_method_id() { return 'flat_rate'; }
        public function get_total() { return '70.00'; }
    }]; }
    public function get_status() { return $this->status; }
    public function get_meta($key) { return $this->meta[$key] ?? ''; }
    public function update_meta_data($key, $value) { $this->meta[$key] = $value; }
    public function delete_meta_data($key) { unset($this->meta[$key]); }
    public function save() { return $this->id; }
    public function update_status($state, $note) { $this->status = $state; return true; }
    public function get_shipping_address_1() { return 'Rua Fictícia ' . $this->id; }
    public function get_shipping_address_2() { return 'Apto ' . $this->id; }
    public function get_shipping_first_name() { return 'Destinatário'; }
    public function get_shipping_last_name() { return (string) $this->id; }
    public function get_order_number() { return (string) $this->id; }
    public function get_billing_phone() { return '+33 123456789'; }
    public function get_billing_country() { return 'FR'; }
    public function get_shipping_tax() { return '0.00'; }
    public function get_currency() { return 'BRL'; }
    public function get_address($type) {
        return ['address_1' => $this->get_shipping_address_1(), 'city' => 'São Paulo', 'state' => 'SP', 'country' => 'BR',
            'postcode' => '00000-000', 'first_name' => 'Pessoa fictícia'];
    }
    public function get_total() { return '150.00'; }
    public function get_shipping_total() { return '70.00'; }
    public function get_customer_note() { return ''; }
    public function get_items() { return []; }
    public function get_coupon_codes() { return []; }
}

// Simula somente a persistência. A fila, a validação e os payloads usam as classes reais.
class PPWOO_Routes_Store {
    public static bool $locked = false;
    public static function calculation_lock($release = false) {
        if ($release) { self::$locked = false; return true; }
        if (self::$locked) return false;
        self::$locked = true;
        return true;
    }
    public static array $routes = [];
    public static array $stops = [];
    public static function ready() { return true; }
    public static function install() {}
    public static function route($id, $lock = false) { return self::$routes[$id] ?? null; }
    public static function stop($id, $lock = false) { return self::$stops[$id] ?? null; }
    public static function route_stops($id) {
        $rows = array_values(array_filter(self::$stops, static function ($stop) use ($id) { return $stop['route_id'] === $id; }));
        usort($rows, static function ($a, $b) { return $a['position'] <=> $b['position']; });
        return $rows;
    }
    public static function by_slot($slot) {
        foreach (self::$routes as $route) if ($route['state'] === 'draft' && $route['slot'] === $slot) return $route;
        return null;
    }
    public static function create_route($slot) {
        $id = count(self::$routes) + 1;
        self::$routes[$id] = ['id' => $id, 'slot' => $slot, 'revision' => 1, 'state' => 'draft', 'details' => []];
        return $id;
    }
    public static function save_route($route) { $route['revision']++; self::$routes[$route['id']] = $route; }
    public static function save_stop($stop) {
        $stop['updated_at'] = gmdate('Y-m-d H:i:s');
        self::$stops[$stop['order_id']] = $stop;
    }
    public static function remove_stop($id) { unset(self::$stops[$id]); }
    public static function remove_empty_draft($id) { unset(self::$routes[$id]); }
    public static function transaction($fn) {
        $backup = [self::$routes, self::$stops];
        try { return $fn(); }
        catch (Throwable $error) {
            [self::$routes, self::$stops] = $backup;
            throw $error;
        }
    }
}

$core = dirname(__DIR__) . '/packing-panel-woo-dev/inc/core/';
foreach (['class-route-calculation.php', 'class-utils.php', 'class-routes.php', 'class-webhook.php'] as $file) require $core . $file;
require $core . '../admin/class-admin-menu.php';
require $core . '../admin/class-admin-routes-tab.php';

function action(string $method, array $payload, ...$args): void {
    (new ReflectionMethod(PPWOO_Routes::class, $method))->invoke(null, $payload, ...$args);
}

$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/packpanel-route-calculation.json'), true, 20, JSON_THROW_ON_ERROR);
$request_id = $fixture['request_id'];
$refs = ['stop_1' => 101, 'stop_2' => 102, 'stop_3' => 103, 'stop_4' => 104];
$valid = PPWOO_Route_Calculation::validate($fixture, $refs, $request_id, 0);
expect(array_column($valid['stops'], 'order_id'), [102, 101, 103, 104], 'Ordem dos quatro pedidos');
expect(array_column($valid['stops'], 'eta_seconds'), [180, 360, 540, 780], 'Previsão acumulada para cada parada');
expect($valid['destination_order_id'], 104, 'O último pedido é o destino');
$partial = $fixture;
array_pop($partial['stops']);
$partial['destination_ref'] = 'stop_3';
$partial['issues'] = [['ref' => 'stop_4', 'code' => 'no_route']];
expect(PPWOO_Route_Calculation::validate($partial, $refs, $request_id, 0)['issues'], [['order_id' => 104, 'code' => 'no_route']], 'Erro específico por pedido');
$duplicate = $fixture;
$duplicate['stops'][1]['ref'] = 'stop_2';
rejects(static function () use ($duplicate, $refs, $request_id) {
    PPWOO_Route_Calculation::validate($duplicate, $refs, $request_id, 0);
}, 502);
rejects(static function () use ($fixture, $refs, $request_id) {
    PPWOO_Route_Calculation::validate($fixture, $refs, $request_id, 15);
}, 502);
expect(PPWOO_Route_Calculation::point(['lat' => 100, 'lng' => 20]), null, 'Latitude fora do intervalo rejeitada');

foreach ($refs as $id) $orders[$id] = new WC_Order($id);
expect(PPWOO_Route_Calculation::origin_postcode(), '01234567', 'CEP passa da configuração antiga para o novo campo');
expect(PPWOO_Route_Calculation::auth_key_name(), 'authorization', 'Nome padrão da chave');
$options['ppwoo_routes_origin_postcode'] = '';
rejects(static function () use ($orders) { PPWOO_Route_Calculation::calculate($orders, 0); }, 422);
expect(count($calls), 0, 'CEP vazio não usa a origem antiga nem faz chamadas');

$_POST = ['ppwoo_routes_save' => '1', 'routes_postcode' => '01234-567', 'routes_auth_key' => 'authorization_rotas',
    'routes_url' => 'https://calculo.example.test/rotas', 'routes_enabled' => 'on'];
$can_administer = false;
PPWOO_Admin_Routes_Tab::render();
expect($options['ppwoo_routes_origin_postcode'], '', 'Usuário sem permissão não grava alterações');
$can_administer = true;
rejects([PPWOO_Admin_Routes_Tab::class, 'render'], 403);
$_POST['ppwoo_routes_nonce'] = 'fixture-nonce';
$_POST['routes_postcode'] = '1234';
ob_start();
PPWOO_Admin_Routes_Tab::render();
expect(str_contains(ob_get_clean(), 'Informe um CEP com oito dígitos.'), true, 'Formulário identifica CEP inválido');
expect($options['ppwoo_routes_origin_postcode'], '', 'CEP inválido não sobrescreve a opção');
$_POST['routes_postcode'] = '01234-567';
ob_start();
PPWOO_Admin_Routes_Tab::render();
$settings_html = ob_get_clean();
$_POST = [];
expect(str_contains($settings_html, 'ppwoo-settings&amp;tab=routes'), true, 'Formulário grava na aba Rotas do PackPanel');
expect(str_contains($settings_html, $keys['authorization_rotas']), false, 'Segredo fica fora do HTML');
expect($options['ppwoo_routes_origin_postcode'], '01234567', 'CEP salvo como oito dígitos');
expect(PPWOO_Route_Calculation::auth_key_name(), 'authorization_rotas', 'Rotas usa a chave escolhida');
$valid_key = $keys['authorization_rotas'];
unset($keys['authorization_rotas']);
rejects(static function () use ($orders) { PPWOO_Route_Calculation::calculate($orders, 0); }, 422);
$keys['authorization_rotas'] = "invalid\r\nheader";
rejects(static function () use ($orders) { PPWOO_Route_Calculation::calculate($orders, 0); }, 422);
expect(count($calls), 0, 'Segredo ausente ou inválido falha antes da chamada');
$keys['authorization_rotas'] = $valid_key;
$remote_mode = 'auth_rejected';
rejects(static function () use ($orders) { PPWOO_Route_Calculation::calculate($orders, 0); }, 502);
expect(PPWOO_Routes_Store::$locked, false, 'Trava liberada após falha de autenticação do n8n');
$remote_mode = 'accepted';
$cache = $calls = [];
$summary = new ReflectionMethod(PPWOO_Routes::class, 'summary');
$message = $summary->invoke(null, 101)['delivery_message'];
expect(explode("\n", $message), [
    'Nome: Destinatário 101',
    'WhatsApp: https://wa.me/33123456789',
    'Endereço: Rua Fictícia 101, São Paulo',
    'CEP: 00000-000',
    'Complemento: Apto 101',
    'Google Maps: https://www.google.com/maps/dir/?api=1&destination=' . rawurlencode('Rua Fictícia 101, São Paulo, SP, 00000-000, BR') . '&dir_action=navigate',
], 'Mensagem de entrega do primeiro pedido');
expect(str_contains($summary->invoke(null, 104)['delivery_message'], 'Apto 104'), true, 'Cada pedido tem sua própria mensagem');
$preview = PPWOO_Route_Calculation::calculate($orders, 0);
$call_count = count($calls);
expect(PPWOO_Route_Calculation::calculate(array_reverse($orders), 9)['token'], $preview['token'], 'Mesma composição reaproveita cálculo independentemente da ordem da seleção');
expect(count($calls), $call_count, 'Prévia idêntica não repete a chamada externa');
expect(PPWOO_Routes_Store::$locked, false, 'Trava de cálculo liberada após sucesso');
PPWOO_Routes_Store::$locked = true;
$subset = array_slice($orders, 0, 2);
rejects(static function () use ($subset) { PPWOO_Route_Calculation::calculate($subset, 0); }, 429);
expect(count($calls), $call_count, 'Cálculo simultâneo recusado antes do HTTP');
PPWOO_Routes_Store::$locked = false;
$phone_order = $orders[101];
$phone_order->update_meta_data('_ctwpml_dial_code', '+33');
$phone_order->update_meta_data('_ctwpml_phone_is_national', 'yes');
$phone_order->update_meta_data('_ctwpml_phone_country', 'FR');
$phone_order->update_meta_data('_billing_cellphone', '331234567');
expect(PPWOO_Utils::get_customer_whatsapp_url($phone_order), 'https://wa.me/33331234567', 'Número nacional começando com o mesmo DDI não perde seu prefixo');
expect(PPWOO_Utils::get_customer_phone_parts($phone_order), ['national' => '331234567', 'dial_code' => '+33', 'country' => 'FR'], 'Cópia nacional, DDI e país distintos');
$phone_order->delete_meta_data('_ctwpml_dial_code');
$phone_order->delete_meta_data('_ctwpml_phone_is_national');
$phone_order->delete_meta_data('_ctwpml_phone_country');
$phone_order->delete_meta_data('_billing_cellphone');
$sent_for_calculation = array_shift($calls);
expect($sent_for_calculation['body']['stops'][0]['ref'], 'stop_1', 'Ref de parada sem ID interno');
expect(isset($sent_for_calculation['body']['stops'][0]['address']['first_name']), false, 'Nome fica fora da requisição');
expect($sent_for_calculation['body']['origin'], ['postcode' => '01234567', 'country' => 'BR'], 'Origem envia somente CEP e país');
expect($sent_for_calculation['headers']['Authorization'], $valid_key, 'Autenticação usa o valor exato sem acrescentar prefixo');
expect(str_contains(json_encode($sent_for_calculation['body']), $valid_key), false, 'Segredo fica fora do corpo');
expect(str_contains(json_encode(PPWOO_Route_Calculation::public_result($preview)), $valid_key), false, 'Segredo fica fora da resposta para o navegador');
expect($preview['origin_postcode'], '01234567', 'A prévia guarda o CEP usado no cálculo');
foreach ($refs as $id) {
    $target = PPWOO_Routes_Store::by_slot(1);
    action('change_group', ['order_id' => $id, 'slot' => 1, 'preview' => $preview['token'], 'source_id' => 0,
        'target_id' => $target['id'] ?? 0, 'target_revision' => $target['revision'] ?? null]);
}
$before_groups = PPWOO_Routes_Store::$stops;
$plan = new ReflectionMethod(PPWOO_Routes::class, 'plan');
expect(count($plan->invoke(null, ['order_ids' => array_values($refs)])['orders']), 4, 'Prévia aceita pedidos já agrupados');
expect(PPWOO_Routes_Store::$stops, $before_groups, 'Consultar prévia não desfaz grupos nem custos');
rejects(static function () use ($preview) {
    action('change_group', ['order_id' => 101, 'slot' => 2, 'preview' => $preview['token'], 'source_id' => 0, 'target_id' => 0]);
}, 409);
action('recalculate', ['route_id' => 1, 'revision' => PPWOO_Routes_Store::route(1)['revision'], 'preview' => $preview['token']]);
expect(count($calls), 0, 'O grupo igual à prévia reaproveita o cálculo');
$revision = PPWOO_Routes_Store::route(1)['revision'];
$sheet = ['link' => 'https://rastreamento.example.test/rota', 'phone' => '(11) 90000-0000', 'code' => '4321',
    'costs' => ['101' => '15,50', '102' => '40', '103' => '12,00', '104' => '25,00']];
action('save_sheet', ['route_id' => 1, 'revision' => $revision, 'sheet' => ['link' => '', 'phone' => '', 'code' => '', 'costs' => []]], false);
expect(PPWOO_Routes_Store::route(1)['state'], 'draft', 'Rascunho incompleto permanece em preparação');
expect(count($jobs), 0, 'Salvar rascunho não agenda despacho');
rejects(static function () use ($revision, $sheet) { action('save_sheet', ['route_id' => 1, 'revision' => $revision, 'sheet' => $sheet], false); }, 409);
$revision = PPWOO_Routes_Store::route(1)['revision'];
action('save_sheet', ['route_id' => 1, 'revision' => $revision, 'sheet' => $sheet], true);
expect(PPWOO_Routes_Store::route(1)['state'], 'dispatched', 'A saída registra o grupo despachado');
expect(count($jobs), 1, 'Agenda o primeiro pedido sem enviar sincronicamente');
rejects(static function () use ($revision, $sheet) { action('save_sheet', ['route_id' => 1, 'revision' => $revision, 'sheet' => $sheet], true); }, 409);
while ($jobs) PPWOO_Routes::work(array_shift($jobs));
expect(array_column(array_column($calls, 'body'), 'order_id'), [102, 101, 103, 104], 'Um evento por pedido, na ordem da rota');
expect(array_column(array_map(static function ($call) { return $call['body']['event_data']['tracking_data']; }, $calls), 'cost'), [40, 15.5, 12, 25], 'Custo diferente por pedido no evento');
expect(array_map(static function ($call) { return $call['body']['event_data']['tracking_data']['finalization_code']; }, $calls), [0, 0, 0, 4321], 'Código só na última parada');
expect(array_map(static function ($call) { return $call['body']['order_data']['meta']['_packing_panel_finalization_code']; }, $calls), [0, 0, 0, 4321], 'Código também protegido no bloco de metadados');
PPWOO_Routes::work(1);
expect(count($calls), 4, 'Executar a fila de novo não duplica eventos concluídos');

$remote_mode = 'timeout';
$result = PPWOO_Webhook::send_route_dispatch($orders[104], 'stable-key', PPWOO_Routes_Store::route(1)['details']['departed_at']);
expect($result, ['state' => 'uncertain', 'code' => 'connection'], 'Timeout exige conferência');
$remote_mode = 'rejected';
$result = PPWOO_Webhook::send_route_dispatch($orders[104], 'stable-key', PPWOO_Routes_Store::route(1)['details']['departed_at']);
expect($result, ['state' => 'failed', 'code' => 'rejected'], 'Rejeição explícita permite reenvio');
expect($calls[4]['headers']['Idempotency-Key'], $calls[5]['headers']['Idempotency-Key'], 'Mesma chave no reenvio');
$rev = PPWOO_Routes_Store::route(1)['revision'];
action('close', ['route_id' => 1, 'revision' => $rev, 'order_ids' => [101]]);
expect(PPWOO_Routes_Store::route(1)['state'], 'dispatched', 'Baixa parcial mantém a rota ativa');
expect(PPWOO_Routes_Store::stop(102)['delivery_state'], 'on_route', 'Outros pedidos continuam na rota');
action('close', ['route_id' => 1, 'revision' => $rev + 1, 'order_ids' => [102, 103, 104]]);
expect(PPWOO_Routes_Store::route(1)['state'], 'closed', 'A última baixa encerra a rota para o histórico');
echo "Pack Panel: contrato de cálculo, agrupamento, despacho, reenvio e baixa passaram.\n";
