<?php

if (!defined('ABSPATH')) exit;

final class PPWOO_Route_Calculation {
    public const LIMIT = 100;
    public const DEFAULT_AUTH_KEY = 'authorization';
    private const LIFETIME = 30 * MINUTE_IN_SECONDS;

    public static function normalize_postcode(string $value): string {
        return preg_match('/^[0-9]{5}-?[0-9]{3}$/D', $value) ? str_replace('-', '', $value) : '';
    }

    public static function origin_postcode(): string {
        $saved = get_option('ppwoo_routes_origin_postcode');
        if (is_string($saved)) return self::normalize_postcode($saved);

        $legacy = (string) get_option('ppwoo_routes_origin', '');
        if (preg_match('/(?<![0-9])[0-9]{5}-?[0-9]{3}(?![0-9])/', $legacy, $matches)) {
            return self::normalize_postcode($matches[0]);
        }
        return '';
    }

    public static function auth_key_name(): string {
        $name = trim((string) get_option('ppwoo_routes_auth_key_name', self::DEFAULT_AUTH_KEY));
        return $name !== '' ? $name : self::DEFAULT_AUTH_KEY;
    }

    public static function maps_key_name(): string {
        return trim((string) get_option('ppwoo_routes_maps_key_name', ''));
    }

    /** A chave de navegador é resolvida no servidor, mas precisa chegar ao SDK do Google. */
    public static function maps_browser_key(): string {
        $name = self::maps_key_name();
        if ($name === '' || strlen($name) > 128 || preg_match('/[\x00-\x1F\x7F]/', $name)) return '';
        $key = class_exists('CTWPML_Key_Vault') ? CTWPML_Key_Vault::get($name) : (function_exists('sakm_get_key') ? sakm_get_key($name) : null);
        $auth = class_exists('CTWPML_Key_Vault') ? CTWPML_Key_Vault::get(self::auth_key_name()) : (function_exists('sakm_get_key') ? sakm_get_key(self::auth_key_name()) : null);
        if (is_string($key) && is_string($auth) && hash_equals($auth, $key)) return '';
        if (class_exists('CTWPML_Driver_Panel') && class_exists('CTWPML_Key_Vault')) {
            $driver_key = CTWPML_Key_Vault::get((string) (CTWPML_Driver_Panel::config()['key_name'] ?? ''));
            if (is_string($key) && is_string($driver_key) && hash_equals($driver_key, $key)) return '';
        }
        return is_string($key) && preg_match('/^[A-Za-z0-9_-]{20,128}$/D', $key) ? $key : '';
    }

    /** O endereço histórico do pedido tem prioridade sobre o perfil atual do cliente. */
    public static function address(WC_Order $order): array {
        $shipping = (string) $order->get_shipping_address_1() !== '';
        $type = $shipping ? 'shipping' : 'billing';
        $address = $order->get_address($type);
        $number = (string) $order->get_meta('_' . $type . '_number');
        $neighborhood = (string) $order->get_meta('_' . $type . '_neighborhood');
        return [
            'street' => trim((string) ($address['address_1'] ?? '')),
            'number' => trim($number),
            'neighborhood' => trim($neighborhood),
            'city' => trim((string) ($address['city'] ?? '')),
            'state' => trim((string) ($address['state'] ?? '')),
            'postcode' => trim((string) ($address['postcode'] ?? '')),
            'country' => strtoupper(trim((string) ($address['country'] ?? ''))),
        ];
    }

    public static function point($value): ?array {
        if (!is_array($value) || !isset($value['lat'], $value['lng']) ||
            !is_numeric($value['lat']) || !is_numeric($value['lng'])) return null;
        $lat = (float) $value['lat'];
        $lng = (float) $value['lng'];
        if (!is_finite($lat) || !is_finite($lng) || abs($lat) > 90 || abs($lng) > 180 ||
            ($lat === 0.0 && $lng === 0.0)) return null;
        return ['lat' => $lat, 'lng' => $lng];
    }

    private static function locate(WC_Order $order, array $address): array {
        $fingerprint = hash('sha256', wp_json_encode($address));
        $data = $order->get_meta('_ppwoo_route_location');
        $candidate = apply_filters('ppwoo_route_order_location', is_array($data) ? $data : [], $order, $fingerprint);
        if (is_array($candidate) && ($candidate['address_fingerprint'] ?? '') === $fingerprint &&
            ($candidate['verified'] ?? false) === true) {
            $place_id = $candidate['place_id'] ?? '';
            if (is_string($place_id) && preg_match('/^[A-Za-z0-9_-]{1,255}$/D', $place_id)) {
                return ['place_id' => $place_id];
            }
            $point = self::point($candidate);
            if ($point && ((int) ($candidate['expires_at'] ?? 0) > time() || ($candidate['source'] ?? '') === 'merchant_verified')) {
                return ['location' => $point];
            }
        }
        return ['address' => $address];
    }

    public static function fingerprint(array $orders, ?string $postcode = null): string {
        $addresses = [];
        foreach ($orders as $order) $addresses[$order->get_id()] = self::address($order);
        ksort($addresses);
        return hash('sha256', wp_json_encode(['origin_postcode' => $postcode ?? self::origin_postcode(), 'orders' => $addresses]));
    }

    public static function cache_key(string $token): string {
        return 'ppwoo_calc_' . $token;
    }

    public static function get(string $token): ?array {
        if (!wp_is_uuid($token, 4)) return null;
        $value = get_transient(self::cache_key($token));
        return is_array($value) && isset($value['origin_postcode']) ? $value : null;
    }

    /** Plano operacional da rota, independente do token efêmero da prévia. */
    public static function persist_plan(array $calc): array {
        $geometry = ['origin' => $calc['origin'] ?? null, 'path' => $calc['path'] ?? [], 'locations' => []];
        foreach ($calc['stops'] as &$stop) {
            if (isset($stop['location'])) $geometry['locations'][$stop['order_id']] = $stop['location'];
            unset($stop['location']);
        }
        unset($stop);
        // Coordenadas ficam em cache temporário separado, nunca indefinidamente no rascunho.
        $key = 'ppwoo_plan_map_' . $calc['token'];
        set_transient($key, $geometry, 29 * 86400);
        unset($calc['origin'], $calc['path']);
        $calc['geometry_key'] = $key;
        $calc['expires_at'] = 0;
        return $calc;
    }

    public static function route_plan(array $route): ?array {
        $plan = $route['details']['calculation_plan'] ?? null;
        if (!is_array($plan)) return self::get($route['details']['calc'] ?? '');
        $map = get_transient($plan['geometry_key'] ?? '');
        $plan['origin'] = is_array($map) ? $map['origin'] : null;
        $plan['path'] = is_array($map) ? $map['path'] : [];
        foreach ($plan['stops'] as &$stop) {
            if (isset($map['locations'][$stop['order_id']])) $stop['location'] = $map['locations'][$stop['order_id']];
        }
        unset($stop);
        return $plan;
    }

    public static function calculate(array $orders, int $revision): array {
        $fingerprint = self::fingerprint($orders);
        $index = 'ppwoo_calc_match_' . md5(get_current_user_id() . '|' . get_option('ppwoo_routes_url', '') . '|' . $fingerprint);
        $cached = self::get((string) get_transient($index));
        if ($cached && $cached['owner'] === get_current_user_id() && $cached['fingerprint'] === $fingerprint && !$cached['issues']) {
            PPWOO_Debug::info('Rotas: cálculo válido reaproveitado');
            return $cached;
        }
        if (!PPWOO_Routes_Store::calculation_lock()) {
            throw new DomainException('Há um cálculo em andamento. Aguarde a conclusão e tente novamente.', 429);
        }
        try {
            $result = self::calculate_remote($orders, $revision);
            if (!$result['issues']) set_transient($index, $result['token'], self::LIFETIME);
            return $result;
        } finally {
            PPWOO_Routes_Store::calculation_lock(true);
        }
    }

    private static function calculate_remote(array $orders, int $revision): array {
        $url = (string) get_option('ppwoo_routes_url', '');
        $postcode = self::origin_postcode();
        if ($postcode === '' || wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($url)) {
            throw new DomainException('Preencha o CEP de saída e a URL HTTPS de cálculo em PackPanel → Rotas.', 422);
        }
        $key = class_exists('CTWPML_Key_Vault') ? CTWPML_Key_Vault::get(self::auth_key_name()) : (function_exists('sakm_get_key') ? sakm_get_key(self::auth_key_name()) : null);
        if (!is_string($key) || trim($key) === '' || preg_match('/[\x00-\x1F\x7F]/', $key)) {
            throw new DomainException('Confira o nome cadastrado no plugin de chaves e em PackPanel → Rotas.', 422);
        }

        $request_id = wp_generate_uuid4();
        $owner = get_current_user_id();
        $fingerprint = self::fingerprint($orders, $postcode);
        $throttle = 'ppwoo_route_throttle_' . $owner;
        if (get_transient($throttle)) throw new DomainException('Aguarde alguns segundos para calcular de novo.', 429);
        set_transient($throttle, 1, 3);
        $refs = [];
        $stops = [];
        foreach (array_values($orders) as $index => $order) {
            $ref = 'stop_' . ($index + 1);
            $refs[$ref] = $order->get_id();
            $stops[] = array_merge(['ref' => $ref], self::locate($order, self::address($order)));
        }

        PPWOO_Debug::info('Rotas: cálculo solicitado', ['request_id' => $request_id, 'stops' => count($stops)]);
        $response = wp_safe_remote_post($url, [
            'timeout' => 25, 'redirection' => 0, 'limit_response_size' => 786432,
            'headers' => ['Content-Type' => 'application/json', 'Authorization' => $key],
            'body' => wp_json_encode([
                'schema_version' => 1, 'request_id' => $request_id, 'revision' => $revision,
                'origin' => ['postcode' => $postcode, 'country' => 'BR'], 'destination_strategy' => 'farthest_road_distance',
                'stops' => $stops,
            ], JSON_THROW_ON_ERROR),
        ]);
        $status = is_wp_error($response) ? 0 : (int) wp_remote_retrieve_response_code($response);
        if ($status !== 200) {
            PPWOO_Debug::warn('Rotas: falha no cálculo', [
                'request_id' => $request_id,
                'status' => $status ?: 'connection',
            ]);
            if ($status === 401 || $status === 403) {
                throw new DomainException('O n8n recusou a autenticação. Confira a chave do webhook de cálculo.', 502);
            }
            throw new DomainException('Não foi possível calcular a rota no n8n. Sua seleção foi mantida.', 502);
        }

        $data = json_decode(wp_remote_retrieve_body($response), true, 24);
        try {
            $result = self::validate($data, $refs, $request_id, $revision);
        } catch (DomainException $error) {
            PPWOO_Debug::warn('Rotas: resposta inválida do cálculo', ['request_id' => $request_id]);
            throw $error;
        }
        $result['token'] = $request_id;
        $result['owner'] = $owner;
        $result['fingerprint'] = $fingerprint;
        $result['origin_postcode'] = $postcode;
        $result['input_ids'] = array_values($refs);
        $result['expires_at'] = time() + self::LIFETIME;
        if (!set_transient(self::cache_key($request_id), $result, self::LIFETIME)) {
            throw new DomainException('O cálculo voltou, mas não foi possível guardar a prévia. Tente novamente.', 503);
        }
        PPWOO_Debug::info('Rotas: cálculo recebido', [
            'request_id' => $request_id, 'ordered' => count($result['stops']), 'rejected' => count($result['issues']),
        ]);
        return $result;
    }

    public static function validate($data, array $refs, string $request_id, int $revision): array {
        $invalid = new DomainException('O n8n retornou uma rota inválida. Confira o contrato do cálculo.', 502);
        if (!is_array($data) || ($data['schema_version'] ?? null) !== 1 ||
            ($data['request_id'] ?? '') !== $request_id || ($data['revision'] ?? null) !== $revision ||
            !isset($data['stops'], $data['issues'], $data['path']) || !is_array($data['stops']) ||
            !is_array($data['issues']) || !is_array($data['path']) || count($data['path']) > 8000 ||
            count($data['stops']) + count($data['issues']) !== count($refs)) throw $invalid;

        $valid_stops = [];
        $issues = [];
        $seen = [];
        $previous_time = 0;
        foreach ($data['stops'] as $stop) {
            $ref = is_array($stop) ? ($stop['ref'] ?? null) : null;
            $eta = is_array($stop) ? ($stop['eta_seconds'] ?? null) : null;
            $distance = is_array($stop) ? ($stop['distance_meters'] ?? null) : null;
            $point = is_array($stop) ? self::point($stop['location'] ?? null) : null;
            if (!is_string($ref) || !isset($refs[$ref]) || isset($seen[$ref]) ||
                !is_int($eta) || $eta < $previous_time || $eta > 172800 || !$point ||
                ($distance !== null && (!is_int($distance) || $distance < 0))) throw $invalid;
            $seen[$ref] = true;
            $previous_time = $eta;
            $valid_stops[] = ['order_id' => $refs[$ref], 'eta_seconds' => $eta, 'location' => $point, 'distance_meters' => $distance];
        }
        foreach ($data['issues'] as $issue) {
            $ref = is_array($issue) ? ($issue['ref'] ?? null) : null;
            $code = is_array($issue) ? ($issue['code'] ?? null) : null;
            if (!is_string($ref) || !isset($refs[$ref]) || isset($seen[$ref]) || !is_string($code) ||
                !in_array($code, ['not_found', 'no_route', 'provider_limit', 'quota', 'invalid_address'], true)) throw $invalid;
            $seen[$ref] = true;
            $issues[] = ['order_id' => $refs[$ref], 'code' => $code];
        }
        $path = [];
        foreach ($data['path'] as $item) {
            $point = self::point($item);
            if (!$point) throw $invalid;
            $path[] = $point;
        }
        $origin = self::point($data['origin'] ?? null);
        $distance = $data['distance_meters'] ?? null;
        $duration = $data['duration_seconds'] ?? null;
        $last = $valid_stops ? end($valid_stops)['order_id'] : null;
        $destination = $data['destination_ref'] ?? null;
        if ($last !== null && (!$origin || count($path) < 2 || !is_int($distance) || $distance < 0 ||
            !is_int($duration) || $duration < $previous_time || $duration > 172800 ||
            !is_string($destination) || ($refs[$destination] ?? null) !== $last)) throw $invalid;
        return [
            'origin' => $origin, 'path' => $path, 'stops' => $valid_stops, 'issues' => $issues,
            'distance_meters' => $last !== null ? $distance : null,
            'duration_seconds' => $last !== null ? $duration : null, 'destination_order_id' => $last,
        ];
    }

    public static function public_result(?array $result): ?array {
        if (!$result) return null;
        unset($result['owner'], $result['fingerprint'], $result['geometry_key']);
        return $result;
    }
}
