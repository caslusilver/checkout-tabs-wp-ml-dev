<?php
if (!defined('ABSPATH')) exit;

final class CTWPML_Driver_Panel {
    public const CONFIG = 'ctwpml_driver_config';
    public static function config(): array { return (array) get_option(self::CONFIG, []); }
    public static function remote(): bool { return (self::config()['mode'] ?? 'local') === 'remote'; }
    public static function enabled(): bool { return !empty(self::config()['enabled']); }

    public static function init(): void {
        add_shortcode('ppwoo_driver_panel', [__CLASS__, 'shortcode']);
        add_filter('template_include', [__CLASS__, 'template'], 100);
        add_action('template_redirect', [__CLASS__, 'worker'], 0);
        add_action('wp_ajax_ctwpml_driver', [__CLASS__, 'ajax']);
        add_action('wp_ajax_nopriv_ctwpml_driver', [__CLASS__, 'ajax']);
        add_action('rest_api_init', static function () {
            register_rest_route('ctwpml-driver/v1', '/route', ['methods' => 'POST', 'permission_callback' => [__CLASS__, 'permission'], 'callback' => [__CLASS__, 'rest']]);
        });
        add_action('admin_menu', static function () {
            if (!self::remote()) return; // Na loja, usa as abas existentes do PackPanel.
            add_menu_page('PackPanel', 'PackPanel', 'manage_options', 'ppwoo-settings', ['CTWPML_Driver_Admin', 'render'], 'dashicons-location');
            add_submenu_page('ppwoo-settings', 'Painel do motoboy', 'Motoboy', 'manage_options', 'ctwpml-driver', ['CTWPML_Driver_Admin', 'render']);
        }, 20);
        add_action('ctwpml_driver_cleanup', [__CLASS__, 'cleanup']);
        if (!wp_next_scheduled('ctwpml_driver_cleanup')) wp_schedule_event(time() + 3600, 'hourly', 'ctwpml_driver_cleanup');
    }

    public static function page_url(): string {
        $id = (int) (self::config()['page'] ?? 0);
        return $id && get_post_status($id) === 'publish' ? (string) get_permalink($id) : '';
    }
    public static function template(string $template): string {
        if (self::page_url() && is_page((int) self::config()['page'])) {
            nocache_headers(); header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow, noarchive'); header('X-Frame-Options: SAMEORIGIN');
            if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
            return CHECKOUT_TABS_WP_ML_DIR . 'inc/driver/template.php';
        }
        return $template;
    }
    public static function shortcode(): string { return '<main id="ctwpml-driver"><p role="status">Carregando a rota…</p></main>'; }

    public static function worker(): void {
        if (!isset($_GET['ctdrv_worker']) || $_GET['ctdrv_worker'] !== '1' || !self::page_url() || !is_page((int) self::config()['page'])) return;
        nocache_headers(); header('Content-Type: application/javascript; charset=UTF-8'); header('X-Content-Type-Options: nosniff');
        $page = self::page_url(); $version = checkout_tabs_wp_ml_get_version(); $base = CHECKOUT_TABS_WP_ML_URL . 'assets/driver/';
        $assets = array_map(static fn($name) => $base . $name . '?ver=' . rawurlencode($version), ['state.js', 'app.js', 'driver.css']);
        header('Service-Worker-Allowed: ' . wp_parse_url($page, PHP_URL_PATH));
        echo 'self.CTDriverWorker=' . wp_json_encode(['page' => $page, 'version' => $version, 'assets' => $assets], JSON_HEX_TAG | JSON_HEX_AMP) . ';';
        echo 'importScripts(' . wp_json_encode($base . 'worker.js?ver=' . rawurlencode($version), JSON_HEX_TAG | JSON_HEX_AMP) . ');';
        exit;
    }

    public static function limit(string $key, int $max): void {
        global $wpdb;
        // MySQL limita nomes de GET_LOCK a 64 caracteres.
        $key = 'ctdrv_' . substr(hash('sha256', $key . ':' . (int) floor(time()/60)), 0, 48);
        $locked = (int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 1)', $key)) === 1;
        if (!$locked) throw new DomainException('Aguarde e tente novamente.', 429);
        try {
            $count = (int) get_transient($key);
            if ($count >= $max) throw new DomainException('Limite temporário. Aguarde um minuto.', 429);
            set_transient($key, $count + 1, 75);
        } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $key)); }
    }

    /** URL administrativa gerada sob permissão/nonce do PackPanel. */
    public static function admin_link(int $route_id, bool $rotate = false): array {
        if (self::remote() || !self::enabled()) throw new DomainException('Habilite o painel do motoboy nas configurações.', 422);
        return PPWOO_Routes_Store::transaction(static function () use ($route_id, $rotate) {
            $route = PPWOO_Routes_Store::route($route_id, true);
            if (!$route) throw new DomainException('Rota indisponível.', 404);
            if ($route['state'] === 'closed' && empty($route['details']['driver_access'])) throw new DomainException('Esta rota antiga não tem link de entregador. Consulte o histórico no painel.', 410);
            $cfg = self::config(); $url = !empty($cfg['remote_page']) ? $cfg['remote_page'] : self::page_url();
            if (!$url) throw new DomainException('Configure a página local ou remota do motoboy.', 422);
            $previous = $route['revision'];
            if (empty($route['details']['driver_access']) || $rotate) {
                $route['details']['driver_access'] = bin2hex(random_bytes(32));
                PPWOO_Routes_Store::save_route($route);
                $route['revision']++;
            }
            $token = self::token($route);
            return ['driver_url' => $url . '#rota=' . $route['id'] . '&acesso=' . $token, 'previous_revision' => $previous, 'link_revision' => $route['revision']];
        });
    }
    private static function token(array $route): string {
        return hash_hmac('sha256', 'driver:' . $route['id'] . ':' . ($route['details']['driver_access'] ?? ''), wp_salt('auth'));
    }

    /** O site remoto deve provar identidade E apresentar o token limitado à rota. */
    public static function permission($request) {
        try {
            if (self::remote() || !self::enabled() || !is_ssl()) throw new DomainException('Conexão indisponível.', 403);
            $cfg = self::config();
            $key = CTWPML_Key_Vault::get((string) ($cfg['key_name'] ?? ''));
            $body = $request->get_body();
            $timestamp = $request->get_header('x-ctdrv-time'); $nonce = $request->get_header('x-ctdrv-nonce');
            $site = $request->get_header('x-ctdrv-site'); $connection = $request->get_header('x-ctdrv-connection');
            if (!$key || strlen($key) < 32 || empty($cfg['connection']) || empty($cfg['peer_host']) || strlen($body) > 65536 || !preg_match('/^\d{10}$/D', $timestamp) || abs(time() - (int) $timestamp) > 300 ||
                !preg_match('/^[a-f0-9]{32}$/D', $nonce) || $connection !== ($cfg['connection'] ?? '') ||
                strtolower($site) !== strtolower($cfg['peer_host'] ?? '')) throw new DomainException('Conexão não autorizada.', 403);
            $expected = hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . $connection . "\n" . $site . "\n" . $body, $key);
            if (!hash_equals($expected, $request->get_header('x-ctdrv-signature'))) throw new DomainException('Conexão não autorizada.', 403);
            self::limit('peer:' . $connection . ':' . ($_SERVER['REMOTE_ADDR'] ?? ''), 120);
            if (!add_option('ctdrv_nonce_' . hash('sha256', $connection . $nonce), time(), '', false)) throw new DomainException('Solicitação repetida.', 409);
            return true;
        } catch (DomainException $e) { return new WP_Error('ctdrv_auth', $e->getMessage(), ['status' => $e->getCode() ?: 403]); }
    }

    public static function cleanup(): void {
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND CAST(option_value AS UNSIGNED) < %d", $wpdb->esc_like('ctdrv_nonce_') . '%', time()-600));
    }

    public static function rest($request) {
        try {
            $data = $request->get_json_params();
            if (!is_array($data)) throw new DomainException('Solicitação inválida.', 422);
            if (($data['diagnostic'] ?? false) === true) return new WP_REST_Response(['route_id' => 0, 'diagnostic' => true], 200, ['Cache-Control' => 'private, no-store']);
            $result = self::local($data);
            return new WP_REST_Response($result, 200, ['Cache-Control' => 'private, no-store', 'Referrer-Policy' => 'no-referrer']);
        } catch (DomainException $e) { return new WP_Error('ctdrv_request', $e->getMessage(), ['status' => $e->getCode() ?: 422]); }
        catch (Throwable $e) { self::debug('falha interna'); return new WP_Error('ctdrv_failure', 'Não foi possível processar. Confira o estado antes de repetir.', ['status' => 500]); }
    }

    public static function remote_request(array $data): array {
        $cfg = self::config(); $key = CTWPML_Key_Vault::get((string) ($cfg['key_name'] ?? ''));
        $url = rtrim((string) ($cfg['origin'] ?? ''), '/') . '/wp-json/ctwpml-driver/v1/route';
        if (!$key || strlen($key) < 32 || wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($url) ||
            strtolower((string) wp_parse_url($url, PHP_URL_HOST)) !== strtolower($cfg['peer_host'] ?? '')) throw new DomainException('Confira a conexão com a loja.', 503);
        $body = wp_json_encode($data, JSON_THROW_ON_ERROR); $stamp = (string) time(); $nonce = bin2hex(random_bytes(16));
        $site = (string) wp_parse_url(home_url('/'), PHP_URL_HOST); $connection = $cfg['connection'] ?? '';
        $signature = hash_hmac('sha256', $stamp . "\n" . $nonce . "\n" . $connection . "\n" . $site . "\n" . $body, $key);
        $response = wp_safe_remote_post($url, ['headers' => ['Content-Type' => 'application/json', 'X-CTDRV-Time' => $stamp, 'X-CTDRV-Nonce' => $nonce,
            'X-CTDRV-Site' => $site, 'X-CTDRV-Connection' => $connection, 'X-CTDRV-Signature' => $signature],
            'body' => $body, 'timeout' => 20, 'redirection' => 0, 'sslverify' => true, 'limit_response_size' => 1048576]);
        if (is_wp_error($response)) throw new DomainException('Sem resposta da loja. As ações salvas serão conferidas antes de repetir.', 503);
        $status = wp_remote_retrieve_response_code($response); $result = json_decode(wp_remote_retrieve_body($response), true, 32);
        if ($status !== 200 || !is_array($result) || !isset($result['route_id']) ||
            (isset($data['route_id']) && $result['route_id'] !== $data['route_id'])) throw new DomainException(
            in_array($status, [403,409,410,422,429], true) ? 'A loja recusou esta ação. Confira as pendências ou peça ajuda ao administrador.' : 'Resposta indisponível. Tentaremos novamente.', in_array($status, [403,409,410,422,429], true) ? $status : 503);
        if (($result['unchanged'] ?? false) === true) return ['route_id' => $result['route_id'], 'unchanged' => true];
        // Chave de navegador do host remoto tem restrição própria de domínio.
        $map_key = CTWPML_Key_Vault::get((string) ($cfg['maps_key_name'] ?? '')) ?: '';
        $result['maps_key'] = $map_key && !hash_equals($key, $map_key) && preg_match('/^[A-Za-z0-9_-]{20,128}$/D', $map_key) ? $map_key : '';
        return $result;
    }

    public static function local(array $input): array {
        if (!self::enabled() || !class_exists('PPWOO_Routes_Store') || !PPWOO_Routes_Store::ready()) throw new DomainException('Painel indisponível.', 403);
        $id = $input['route_id'] ?? 0; $token = $input['token'] ?? ''; $events = $input['events'] ?? [];
        if (!is_int($id) || $id < 1 || !is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token) || !is_array($events) || count($events) > 20) throw new DomainException('Solicitação inválida.', 422);
        return PPWOO_Routes_Store::transaction(static function () use ($id, $token, $events, $input) {
            $route = PPWOO_Routes_Store::route($id, true);
            if (!$route || empty($route['details']['driver_access']) || !hash_equals(self::token($route), $token)) throw new DomainException('Link inválido ou revogado.', 403);
            $stops = PPWOO_Routes_Store::route_stops($id);
            $state = $route['details']['driver'] ?? PPWOO_Driver_State::initial(array_column($stops, 'order_id'));
            // Rotas de versões anteriores: retirada já autorizada dispensa outro aceite.
            // Lotes offline antigos são aplicados primeiro, preservando sua sequência.
            if (!$events && $route['state'] === 'dispatched' && $state['status'] === 'ready' && $state['current'] === 0 && !empty($route['details']['departed_at'])) {
                $state = PPWOO_Driver_State::depart(array_column($stops, 'order_id'), $route['details']['departed_at'], $state);
                $route['details']['driver'] = $state;
                $route['details']['driver_started_at'] = $state['started_at'];
                PPWOO_Routes_Store::save_route($route); $route['revision']++;
                self::debug('primeira parada liberada pela retirada', ['route_id' => $id, 'version' => $state['version']]);
            } elseif (!$events && ($input['known_revision'] ?? null) === $route['revision']) return ['route_id' => $id, 'unchanged' => true];
            if (!isset($state['last_event_at']) && !empty($route['details']['departed_at'])) $state['last_event_at'] = $route['details']['departed_at'];
            if ($route['state'] === 'closed' && !$events) return ['route_id' => $id, 'closed' => true, 'driver' => PPWOO_Driver_State::view($state)];
            if ($events && $route['state'] !== 'dispatched') {
                if ($route['state'] === 'closed') {
                    $customers_only = !array_filter($stops, static fn($stop) => ($stop['details']['closed_source'] ?? '') !== 'customer');
                    foreach ($events as $event) {
                        if (!is_array($event) || !is_string($event['id'] ?? null)) throw new DomainException('Evento inválido.', 422);
                        $duplicate = isset($state['receipts'][$event['id'] ?? '']) && hash_equals($state['receipts'][$event['id']]['hash'], hash('sha256', json_encode($event, JSON_THROW_ON_ERROR)));
                        // Uma confirmação do comprador não elimina ações legítimas já salvas offline.
                        // Uma baixa administrativa, porém, impede avançar ou reabrir a operação.
                        if (!$duplicate && (!$customers_only || ($event['type'] ?? '') === 'correct')) throw new DomainException('A rota foi encerrada. Confira as pendências com o administrador.', 410);
                    }
                } else {
                    throw new DomainException('A rota ainda não foi despachada.', 409);
                }
            }
            $confirmed = array_column(array_filter($stops, static fn($stop) => $stop['delivery_state'] === 'closed'), 'order_id');
            foreach ($events as $event) {
                if (!is_array($event)) throw new DomainException('Evento inválido.', 422);
                $state = PPWOO_Driver_State::apply($state, $event, $confirmed, gmdate('c'));
            }
            if ($events) {
                $route['details']['driver'] = $state;
                if (!empty($state['started_at'])) $route['details']['driver_started_at'] = $state['started_at'];
                self::update_estimates($route, $stops, $state);
                PPWOO_Routes_Store::save_route($route);
                $route['revision']++;
                self::debug('eventos aplicados', ['route_id' => $id, 'count' => count($events), 'version' => $state['version'],
                    'types' => array_column($events, 'type'), 'stop_ids' => array_column($events, 'stop_id')]);
            }
            return self::projection($route, $stops, $state);
        });
    }

    private static function update_estimates(array $route, array $stops, array $state): void {
        if (empty($state['started_at'])) return;
        $times = array_column($route['details']['dispatched_calculation']['stops'] ?? [], 'eta_seconds', 'order_id');
        $index = $state['current']; $current = $state['stops'][$index];
        $base = strtotime($current['started_at'] ?? $state['started_at']);
        $previous = $index > 0 ? ($times[$state['stops'][$index - 1]['id']] ?? 0) : 0;
        foreach ($stops as &$stop) {
            $i = array_search($stop['order_id'], array_column($state['stops'], 'id'), true);
            if ($i === false || $i < $index || !isset($times[$stop['order_id']])) continue;
            $phase = $state['stops'][$i];
            $stop['details']['eta_at'] = $phase['arrived_at'] ?? gmdate('c', $base + max(0, (int) $times[$stop['order_id']] - (int) $previous));
            PPWOO_Routes_Store::save_stop($stop);
        }
        unset($stop);
    }

    /** Revisão administrativa não desfaz recebimentos de outros compradores. */
    public static function admin_reopen(int $route_id, int $order_id): void {
        if (!current_user_can('manage_options') || self::remote() || !self::enabled()) throw new DomainException('Revisão restrita ao administrador da loja.', 403);
        PPWOO_Routes_Store::transaction(static function () use ($route_id, $order_id) {
            $route = PPWOO_Routes_Store::route($route_id, true); $stop = PPWOO_Routes_Store::stop($order_id, true);
            if (!$route || !$stop || $stop['route_id'] !== $route_id || $route['state'] === 'draft' || $stop['delivery_state'] !== 'closed') throw new DomainException('Escolha uma entrega finalizada desta rota.', 409);
            $state = $route['details']['driver'] ?? PPWOO_Driver_State::initial(array_column(PPWOO_Routes_Store::route_stops($route_id), 'order_id'));
            if (count($state['receipts']) >= 950) throw new DomainException('Limite de revisões atingido. Consulte o histórico.', 409);
            $i = array_search($order_id, array_column($state['stops'], 'id'), true);
            if ($i === false) throw new DomainException('Parada indisponível.', 409);
            $audit = ['source' => $stop['details']['closed_source'] ?? '', 'closed_at' => $stop['details']['closed_at'] ?? '', 'reopened_by' => get_current_user_id(), 'reopened_at' => gmdate('c')];
            $stop['details']['reopen_history'][] = $audit;
            unset($stop['details']['closed_source'], $stop['details']['closed_at'], $stop['details']['closed_by']);
            $stop['delivery_state'] = 'on_route'; $route['state'] = 'dispatched';
            unset($route['details']['closed_at']);
            foreach ($state['stops'] as $j => &$member) if ($j >= $i) $member = ['id' => $member['id'], 'state' => $j === $i ? 'started' : 'ready'];
            unset($member); $state['stops'][$i]['started_at'] = gmdate('c');
            $state['current'] = $i; $state['status'] = 'started'; $state['version']++; unset($state['completed_at']);
            $state['receipts']['admin-' . bin2hex(random_bytes(12))] = $audit + ['type' => 'admin_reopen', 'stop_id' => $order_id, 'version' => $state['version']];
            $route['details']['driver'] = $state; $route['details']['driver_started_at'] = $state['started_at'] ?? gmdate('c');
            // Revoga o link antigo do entregador e renova explicitamente o acesso deste cliente.
            $route['details']['driver_access'] = bin2hex(random_bytes(32));
            PPWOO_Routes_Store::save_stop($stop);
            PPWOO_Order_Tracking::issue($route, $stop, true);
            PPWOO_Routes_Store::save_route($route);
            self::debug('revisão administrativa', ['route_id' => $route_id, 'order_id' => $order_id]);
        });
    }

    private static function projection(array $route, array $stops, array $state): array {
        if ($route['state'] === 'closed') return ['route_id' => $route['id'], 'closed' => true, 'driver' => PPWOO_Driver_State::view($state)];
        $calc = $route['state'] === 'draft' ? (PPWOO_Route_Calculation::route_plan($route) ?? []) : ($route['details']['dispatched_calculation'] ?? []);
        $rows = [];
        foreach ($stops as $stop) {
            $order = wc_get_order($stop['order_id']);
            if (!$order instanceof WC_Order) throw new DomainException('Uma parada não está mais disponível.', 409);
            $address = PPWOO_Route_Calculation::address($order);
            $destination = implode(', ', array_filter($address, 'strlen'));
            $rows[] = ['id' => $stop['order_id'], 'number' => $order->get_order_number(), 'position' => $stop['position'],
                'name' => trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()) ?: trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                'address' => $address['street'] . ', ' . $address['number'],
                'detail' => implode(' · ', array_filter([$address['neighborhood'], $address['city'], $address['state'], $address['postcode'], PPWOO_Utils::get_delivery_complement($order)], 'strlen')),
                'phone' => PPWOO_Utils::get_customer_phone_parts($order)['national'], 'whatsapp' => PPWOO_Utils::get_customer_whatsapp_url($order),
                'waze' => 'https://waze.com/ul?q=' . rawurlencode($destination) . '&navigate=yes',
                'confirmed' => $stop['delivery_state'] === 'closed'];
        }
        return ['route_id' => $route['id'], 'route_revision' => $route['revision'], 'slot' => $route['slot'], 'pending_dispatch' => $route['state'] === 'draft',
            'driver' => PPWOO_Driver_State::view($state), 'stops' => $rows,
            'map' => ['origin' => $calc['origin'] ?? null, 'points' => array_values(array_filter($calc['stops'] ?? [], static fn($point) => isset($point['location']['lat'], $point['location']['lng']))), 'path' => $calc['path'] ?? []],
            'maps_key' => PPWOO_Route_Calculation::maps_browser_key()];
    }

    public static function ajax(): void {
        nocache_headers(); header('Referrer-Policy: no-referrer');
        try {
            if (!self::enabled() || !is_ssl() || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_X_CTDRV'] ?? '') !== '1') throw new DomainException('Acesso indisponível.', 403);
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            if ($origin && wp_parse_url($origin, PHP_URL_HOST) !== wp_parse_url(home_url('/'), PHP_URL_HOST)) throw new DomainException('Acesso negado.', 403);
            self::limit('browser:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 90);
            $raw = $_POST['payload'] ?? '';
            if (!is_string($raw) || strlen($raw) > 65536) throw new DomainException('Solicitação inválida.', 422);
            $input = json_decode(wp_unslash($raw), true, 32);
            if (!is_array($input) || !is_int($input['route_id'] ?? null) || $input['route_id'] < 1) throw new DomainException('Rota inválida.', 422);
            $cookie = 'ctwpml_driver_' . $input['route_id'];
            $token = $input['token'] ?? ($_COOKIE[$cookie] ?? '');
            if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) throw new DomainException('Abra novamente o link recebido.', 403);
            $input['token'] = $token;
            $result = self::remote() ? self::remote_request($input) : self::local($input);
            setcookie($cookie, $token, ['expires' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
            wp_send_json_success($result);
        } catch (DomainException $e) { wp_send_json_error(['message' => $e->getMessage()], $e->getCode() ?: 422); }
        catch (Throwable $e) { self::debug('falha interna'); wp_send_json_error(['message' => 'Não foi possível conferir a rota. As ações permanecem no aparelho.'], 500); }
    }
    private static function debug(string $message, array $data = []): void {
        if (class_exists('PPWOO_Debug')) PPWOO_Debug::info('Motoboy: ' . $message, $data);
        elseif (get_option('ctwpml_driver_debug', 'no') === 'yes') error_log('CTDRV ' . $message . ' ' . wp_json_encode($data));
    }
}
