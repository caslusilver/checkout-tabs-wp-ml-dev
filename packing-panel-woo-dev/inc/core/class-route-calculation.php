<?php

if (!defined('ABSPATH')) exit;

final class PPWOO_Route_Calculation {
    public const LIMIT = 100;
    private const LIFETIME = 30 * MINUTE_IN_SECONDS;

    public static function origin(): string {
        return trim((string) get_option('ppwoo_routes_origin', ''));
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

    public static function fingerprint(array $orders, ?string $origin = null): string {
        $addresses = [];
        foreach ($orders as $order) $addresses[$order->get_id()] = self::address($order);
        ksort($addresses);
        return hash('sha256', wp_json_encode([$origin ?? self::origin(), $addresses]));
    }

    public static function cache_key(string $token): string {
        return 'ppwoo_calc_' . $token;
    }

    public static function get(string $token): ?array {
        if (!wp_is_uuid($token, 4)) return null;
        $value = get_transient(self::cache_key($token));
        return is_array($value) ? $value : null;
    }

    public static function calculate(array $orders, int $revision): array {
        $url = (string) get_option('ppwoo_routes_url', '');
        $token = defined('PPWOO_ROUTES_N8N_TOKEN') ? (string) PPWOO_ROUTES_N8N_TOKEN : '';
        $origin = self::origin();
        if (!$origin || !$url || !$token || preg_match('/[\r\n]/', $token) ||
            wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($url)) {
            throw new DomainException('Configure a origem, a URL HTTPS do n8n e a credencial de cálculo no Pack Panel.', 422);
        }

        $request_id = wp_generate_uuid4();
        $owner = get_current_user_id();
        $fingerprint = self::fingerprint($orders, $origin);
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
            'headers' => ['Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token],
            'body' => wp_json_encode([
                'schema_version' => 1, 'request_id' => $request_id, 'revision' => $revision,
                'origin' => ['address' => $origin], 'destination_strategy' => 'farthest_road_distance',
                'stops' => $stops,
            ], JSON_THROW_ON_ERROR),
        ]);
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            PPWOO_Debug::warn('Rotas: falha no cálculo', [
                'request_id' => $request_id,
                'status' => is_wp_error($response) ? 'connection' : wp_remote_retrieve_response_code($response),
            ]);
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
        $result['origin_address'] = $origin;
        $result['input_ids'] = array_values($refs);
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
        unset($result['owner'], $result['fingerprint']);
        return $result;
    }
}
