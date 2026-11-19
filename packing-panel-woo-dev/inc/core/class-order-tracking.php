<?php
if (!defined('ABSPATH')) exit;

/** Projeção pública por pedido. Nunca devolve o DTO administrativo. */
final class PPWOO_Order_Tracking {
    public static function init(): void {
        add_shortcode('ppwoo_order_tracking', [__CLASS__, 'shortcode']);
        add_filter('template_include', [__CLASS__, 'template'], 99);
        add_action('wp_ajax_ppwoo_order_tracking', [__CLASS__, 'ajax']);
        add_action('wp_ajax_nopriv_ppwoo_order_tracking', [__CLASS__, 'ajax']);
        add_filter('woocommerce_webhook_payload', [__CLASS__, 'webhook_payload'], 10, 3);
    }

    public static function webhook_payload($payload, $resource, $id) {
        if ($resource !== 'order' || !is_array($payload)) return $payload;
        $order = wc_get_order((int) $id);
        if ($order instanceof WC_Order) {
            $stop = PPWOO_Routes_Store::ready() ? PPWOO_Routes_Store::stop($order->get_id()) : null;
            $route = $stop ? PPWOO_Routes_Store::route($stop['route_id']) : null;
            $link = $route && $route['state'] !== 'draft' ? self::link($route, $stop) : self::order_link($order);
            if ($link) $payload['order_tracking_url'] = $link;
        }
        if (isset($payload['meta_data']) && is_array($payload['meta_data'])) $payload['meta_data'] = array_values(array_filter($payload['meta_data'], static fn($meta) => ($meta['key'] ?? '') !== '_ppwoo_tracking_access'));
        return $payload;
    }

    public static function page_url(): string {
        $id = (int) get_option('ppwoo_tracking_page', 0);
        return $id && get_post_status($id) === 'publish' ? (string) get_permalink($id) : '';
    }

    public static function template(string $template): string {
        if (self::page_url() && is_page((int) get_option('ppwoo_tracking_page'))) {
            if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
            nocache_headers();
            header('Referrer-Policy: no-referrer');
            header('X-Robots-Tag: noindex, nofollow, noarchive');
            header('X-Frame-Options: SAMEORIGIN');
            return dirname(__DIR__, 2) . '/templates/order-tracking.php';
        }
        return $template;
    }

    public static function shortcode(): string {
        return '<main id="ppwoo-tracking" aria-live="polite"><p class="tracking-status">Carregando seu pedido…</p></main>';
    }

    /** Reproduzível no retry, sem guardar a URL nem o token bruto. */
    private static function token(array $stop): string {
        return hash_hmac('sha256', $stop['order_id'] . ':' . ($stop['details']['access']['nonce'] ?? ''), wp_salt('auth'));
    }

    public static function order_link(WC_Order $order, bool $renew = false): string {
        if (!PPWOO_Routes::enabled() || !self::page_url() || !PPWOO_Utils::is_motoboy_shipping($order) || !in_array($order->get_status(), ['processing', 'completed'], true)) return '';
        global $wpdb;
        $lock = 'ppwoo_access_' . $order->get_id();
        $locked = false;
        if (isset($wpdb)) {
            $locked = (int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 2)', $lock)) === 1;
            if (!$locked) throw new DomainException('O acesso está sendo preparado. Tente novamente.', 503);
        }
        try {
        if (method_exists($order, 'read_meta_data')) $order->read_meta_data(true);
        $access = $order->get_meta('_ppwoo_tracking_access');
        if (!is_array($access) || $renew) {
            $access = ['nonce' => bin2hex(random_bytes(24))];
            $access['hash'] = hash('sha256', self::token(['order_id' => $order->get_id(), 'details' => ['access' => $access]]));
            $order->update_meta_data('_ppwoo_tracking_access', $access);
            $order->save_meta_data();
        }
        return self::page_url() . '#pedido=' . $order->get_id() . '&acesso=' . self::token(['order_id' => $order->get_id(), 'details' => ['access' => $access]]);
        } finally {
            if ($locked) $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
    }

    public static function issue(array $route, array $stop, bool $renew = false): array {
        if (!self::page_url() || $route['state'] !== 'dispatched' || $stop['delivery_state'] !== 'on_route') return $stop;
        if (!isset($stop['details']['access']) || $renew) {
            $expires = $renew ? time() + 86400 : strtotime($route['details']['departed_at'] ?? '') + 86400;
            if ($expires <= time()) throw new DomainException('O link venceu. Gere um novo acesso para este pedido.', 410);
            $order = wc_get_order($stop['order_id']);
            if (!$order instanceof WC_Order) throw new DomainException('Pedido indisponível.', 410);
            self::order_link($order, $renew);
            $stop['details']['access'] = $order->get_meta('_ppwoo_tracking_access');
            $stop['details']['access']['expires'] = $expires;
            PPWOO_Routes_Store::save_stop($stop);
            PPWOO_Debug::info('Central: acesso emitido', ['order_id' => $stop['order_id'], 'renewed' => $renew]);
        }
        return $stop;
    }

    public static function link(array $route, array $stop): string {
        if (!self::page_url() || $route['state'] !== 'dispatched' || $stop['delivery_state'] !== 'on_route' ||
            ($stop['details']['access']['expires'] ?? 0) <= time()) return '';
        // Fragmento não é enviado ao servidor, access log ou cabeçalho Referer.
        return self::page_url() . '#pedido=' . $stop['order_id'] . '&acesso=' . self::token($stop);
    }

    public static function admin_link(array $input): array {
        $id = $input['order_id'] ?? 0;
        if (!is_int($id) || $id <= 0) throw new DomainException('Pedido inválido.', 422);
        return PPWOO_Routes_Store::transaction(static function () use ($input, $id) {
            $stop = PPWOO_Routes_Store::stop($id);
            $route = $stop ? PPWOO_Routes_Store::route($stop['route_id'], true) : null;
            if (!$route || $route['id'] !== ($input['route_id'] ?? null) || $route['state'] !== 'dispatched' || $stop['delivery_state'] !== 'on_route') {
                throw new DomainException('Este pedido não está mais em rota.', 409);
            }
            if (!self::page_url()) throw new DomainException('Configure a página da Central em PackPanel → Rotas.', 422);
            $stop = self::issue($route, $stop, ($input['renew'] ?? false) === true);
            if (!self::link($route, $stop)) throw new DomainException('O link venceu. Use Gerar novo link.', 410);
            return ['tracking_url' => self::link($route, $stop)];
        });
    }

    public static function authorize(array $route, array $stop, string $token, bool $receipt_retry = false): void {
        $order = wc_get_order($stop['order_id']);
        if (!$order instanceof WC_Order || in_array($order->get_status(), ['cancelled', 'failed', 'refunded', 'trash'], true)) throw new DomainException('Este link não está mais disponível.', 403);
        $access = $stop['details']['access'] ?? [];
        $valid = preg_match('/^[a-f0-9]{64}$/D', $token) && isset($access['hash']) && hash_equals($access['hash'], hash('sha256', $token));
        if (!$valid || ($access['expires'] ?? 0) <= time() || $route['id'] !== $stop['route_id']) throw new DomainException('Este link não está mais disponível.', 403);
        if ($receipt_retry && $stop['delivery_state'] === 'closed' && ($stop['details']['closed_source'] ?? '') === 'customer') return;
        if ($route['state'] !== 'dispatched' || $stop['delivery_state'] !== 'on_route') throw new DomainException('O acompanhamento deste pedido foi encerrado.', 410);
    }

    /** Mantém apenas segmentos viários fora das regiões públicas de privacidade.
     * Descarta também segmentos longos que cruzam uma região, mesmo sem vértice dentro.
     * Não liga os trechos restantes por uma nova reta e não envia a geometria privada.
     */
    public static function public_paths(array $calc, int $own_id): array {
        $guards = [];
        if (isset($calc['origin']['lat'], $calc['origin']['lng'])) $guards[] = [
            'lat' => round($calc['origin']['lat'] / .05) * .05,
            'lng' => round($calc['origin']['lng'] / .05) * .05, 'radius' => 10000];
        foreach ($calc['stops'] ?? [] as $stop) {
            if (($stop['order_id'] ?? 0) === $own_id || !isset($stop['location']['lat'], $stop['location']['lng'])) continue;
            $guards[] = ['lat' => round($stop['location']['lat'] / .02) * .02,
                'lng' => round($stop['location']['lng'] / .02) * .02, 'radius' => 2500];
        }
        $paths = []; $current = [];
        $path = $calc['path'] ?? [];
        for ($i = 1; $i < count($path); $i++) {
            $a = PPWOO_Route_Calculation::point($path[$i - 1]);
            $b = PPWOO_Route_Calculation::point($path[$i]);
            $safe = $a && $b;
            foreach ($guards as $guard) {
                if (!$safe) break;
                $scale = 111000 * cos(deg2rad($guard['lat']));
                $ax = ($a['lng'] - $guard['lng']) * $scale;
                $ay = ($a['lat'] - $guard['lat']) * 111000;
                $dx = ($b['lng'] - $a['lng']) * $scale;
                $dy = ($b['lat'] - $a['lat']) * 111000;
                $length = $dx * $dx + $dy * $dy;
                $t = $length > 0 ? max(0, min(1, -($ax * $dx + $ay * $dy) / $length)) : 0;
                $distance = hypot($ax + $t * $dx, $ay + $t * $dy);
                // Margem conservadora para projeção local e arredondamentos.
                if ($distance <= $guard['radius'] + 150) $safe = false;
            }
            if ($safe) {
                if (!$current) $current[] = $a;
                $current[] = $b;
            } else {
                if (count($current) > 1) $paths[] = $current;
                $current = [];
            }
        }
        if (count($current) > 1) $paths[] = $current;
        return $paths;
    }

    public static function projection(array $route, array $stop): array {
        $order = wc_get_order($stop['order_id']);
        if (!$order instanceof WC_Order) throw new DomainException('Pedido indisponível.', 410);
        $calc = $route['details']['dispatched_calculation'] ?? [];
        $points = [];
        foreach ($calc['stops'] ?? [] as $i => $point) {
            $location = $point['location'] ?? null;
            if (!is_array($location)) continue;
            $own = $point['order_id'] === $stop['order_id'];
            $points[] = ['position' => $i + 1, 'own' => $own, 'lat' => $own ? $location['lat'] : round($location['lat'] / .02) * .02,
                'lng' => $own ? $location['lng'] : round($location['lng'] / .02) * .02];
        }
        $last = !empty($stop['details']['last_stop']);
        $last_order = wc_get_order((int) ($calc['destination_order_id'] ?? 0));
        $final_area = '';
        if ($last_order instanceof WC_Order) {
            $address = PPWOO_Route_Calculation::address($last_order);
            $final_area = implode(', ', array_filter([$address['neighborhood'], $address['city']], 'strlen'));
        }
        $sheet = $route['details']['sheet'] ?? [];
        $phone = PPWOO_Utils::sanitize_phone((string) ($sheet['phone'] ?? ''));
        $address = PPWOO_Route_Calculation::address($order);
        return [
            'number' => $order->get_order_number(), 'route' => $route['slot'], 'position' => $stop['position'],
            'total' => count(PPWOO_Routes_Store::route_stops($route['id'])), 'last' => $last,
            'departed_at' => $route['details']['departed_at'] ?? '', 'eta_at' => $stop['details']['eta_at'] ?? '',
            'expires_at' => gmdate('c', $stop['details']['access']['expires']),
            'address' => implode(', ', array_filter([$address['street'], $address['number'], $address['neighborhood'], $address['city']], 'strlen')),
            'final_area' => $final_area, 'code' => $last ? (string) ($sheet['code'] ?? '') : '',
            'driver_whatsapp' => preg_match('/^\d{10,11}$/D', $phone) ? 'https://wa.me/55' . $phone : '',
            'tracking_link' => esc_url_raw((string) ($sheet['link'] ?? ''), ['https', 'http']),
            'map' => ['points' => $points, 'paths' => self::public_paths($calc, $stop['order_id']), 'approximate' => true, 'origin' => isset($calc['origin']['lat'], $calc['origin']['lng']) ? [
                'lat' => round($calc['origin']['lat'] / .05) * .05, 'lng' => round($calc['origin']['lng'] / .05) * .05] : null],
            'maps_key' => PPWOO_Route_Calculation::maps_browser_key(),
        ];
    }

    private static function limit(string $key, int $max): void {
        $key = 'ppwoo_central_' . hash('sha256', $key . ':' . (int) floor(time() / 60));
        $count = (int) get_transient($key);
        if ($count >= $max) throw new DomainException('Aguarde um minuto antes de tentar novamente.', 429);
        set_transient($key, $count + 1, 70);
    }

    public static function ajax(): void {
        nocache_headers();
        header('Referrer-Policy: no-referrer');
        try {
            if (!PPWOO_Routes::enabled() || !PPWOO_Routes_Store::ready() || !self::page_url()) throw new DomainException('Acompanhamento indisponível.', 403);
            if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_X_PPWOO_CENTRAL'] ?? '') !== '1') throw new DomainException('Acesso inválido.', 403);
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            if ($origin && (wp_parse_url($origin, PHP_URL_HOST) !== wp_parse_url(home_url('/'), PHP_URL_HOST))) throw new DomainException('Acesso inválido.', 403);
            self::limit('ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 90);
            $id = $_POST['order_id'] ?? '';
            $command = $_POST['command'] ?? '';
            if (!is_string($id) || !preg_match('/^[1-9]\d{0,17}$/D', $id) || !in_array($command, ['exchange', 'read', 'confirm'], true)) throw new DomainException('Solicitação inválida.', 422);
            $cookie = 'ppwoo_tracking_' . $id;
            $token = $command === 'exchange' ? ($_POST['token'] ?? '') : ($_COOKIE[$cookie] ?? '');
            if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) throw new DomainException('Abra o link recebido para acompanhar seu pedido.', 403);
            self::limit('access:' . hash('sha256', $token), $command === 'confirm' ? 10 : 30);
            $data = PPWOO_Routes_Store::transaction(static function () use ($id, $token, $command, $cookie) {
                $stop = PPWOO_Routes_Store::stop((int) $id);
                $route = $stop ? PPWOO_Routes_Store::route($stop['route_id'], true) : null;
                if (!$route || $route['state'] === 'draft') {
                    $order = wc_get_order((int) $id);
                    $access = $order instanceof WC_Order ? $order->get_meta('_ppwoo_tracking_access') : [];
                    if (!$order instanceof WC_Order || $order->get_status() !== 'processing' || !is_array($access) || !isset($access['hash']) ||
                        !hash_equals($access['hash'], hash('sha256', $token))) throw new DomainException('Este link não está mais disponível.', 403);
                    if ($command === 'confirm') throw new DomainException('Aguarde a saída do pedido para confirmar o recebimento.', 409);
                    if ($command === 'exchange') setcookie($cookie, $token, ['expires' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
                    return ['preparing' => true, 'number' => $order->get_order_number()];
                }
                // Releitura após bloquear a rota: serializa confirmação/baixa administrativa.
                $stop = PPWOO_Routes_Store::stop((int) $id);
                self::authorize($route, $stop, $token, $command === 'confirm');
                if ($command === 'confirm') {
                    if ($stop['delivery_state'] !== 'closed') PPWOO_Routes::close_stops($route, [(int) $id], 'customer');
                    return ['confirmed' => true];
                }
                if ($command === 'exchange') {
                    setcookie($cookie, $token, ['expires' => $stop['details']['access']['expires'], 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
                }
                return self::projection($route, $stop);
            });
            wp_send_json_success($data);
        } catch (DomainException $error) {
            wp_send_json_error(['message' => $error->getMessage()], $error->getCode() ?: 422);
        } catch (Throwable $error) {
            PPWOO_Debug::error('Central: falha interna, sem dados privados');
            wp_send_json_error(['message' => 'Não foi possível atualizar. Confira a conexão e tente novamente.'], 500);
        }
    }
}
