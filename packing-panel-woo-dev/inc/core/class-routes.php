<?php

if (!defined('ABSPATH')) exit;

final class PPWOO_Routes {
    public const WORKER = 'ppwoo_send_route_order';
    private const STALE_SECONDS = 180;

    public static function enabled(): bool {
        return get_option('ppwoo_routes_enabled', 'no') === 'yes';
    }

    public static function init(): void {
        add_action('wp_ajax_ppwoo_routes', [__CLASS__, 'ajax']);
        add_action(self::WORKER, [__CLASS__, 'work'], 10, 1);
    }

    private static function conflict(string $message = 'A rota mudou em outra aba. Atualize o painel e tente novamente.'): void {
        throw new DomainException($message, 409);
    }

    private static function order(int $id): WC_Order {
        $order = wc_get_order($id);
        if (!$order instanceof WC_Order || $order->get_status() !== 'processing' || !PPWOO_Utils::is_motoboy_shipping($order)) {
            throw new DomainException('Um pedido deixou de estar disponível para Motoboy. Atualize a seleção.', 409);
        }
        return $order;
    }

    private static function ids($values): array {
        if (!is_array($values) || !$values || count($values) > PPWOO_Route_Calculation::LIMIT) {
            throw new DomainException('Selecione de 1 a ' . PPWOO_Route_Calculation::LIMIT . ' pedidos por cálculo ou ação.', 422);
        }
        $ids = array_map([__CLASS__, 'id'], $values);
        if (count(array_unique($ids)) !== count($ids)) throw new DomainException('A seleção contém pedidos repetidos.', 422);
        return $ids;
    }

    private static function id($value): int {
        if (!is_int($value) || $value <= 0) throw new DomainException('Identificador inválido.', 422);
        return $value;
    }

    private static function route(array $input, bool $lock = false, ?string $state = null): array {
        $route = PPWOO_Routes_Store::route(self::id($input['route_id'] ?? null), $lock);
        if (!$route || ($state !== null && $route['state'] !== $state) ||
            ($lock && $route['revision'] !== ($input['revision'] ?? null))) self::conflict();
        return $route;
    }

    private static function summary(int $id): array {
        $order = wc_get_order($id);
        if (!$order instanceof WC_Order) return ['id' => $id, 'number' => (string) $id, 'missing' => true];
        $address = PPWOO_Route_Calculation::address($order);
        $name = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name()) ?:
            trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        $destination = implode(', ', array_filter($address, 'strlen'));
        $street_address = implode(', ', array_filter([
            $address['street'], $address['number'], $address['neighborhood'], $address['city'],
        ], 'strlen'));
        $complement = $order->get_shipping_address_1() !== '' ? $order->get_shipping_address_2() : PPWOO_Utils::get_billing_complemento($order);
        $phone = (string) PPWOO_Utils::get_billing_cellphone($order);
        $contact = PPWOO_Utils::get_customer_phone_parts($order);
        $whatsapp = PPWOO_Utils::get_customer_whatsapp_url($order);
        return [
            'id' => $id, 'number' => $order->get_order_number(),
            'name' => $name, 'address' => $destination, 'complement' => $complement,
            'phone' => $contact['national'], 'dial_code' => $contact['dial_code'], 'phone_country' => $contact['country'], 'whatsapp' => $whatsapp,
            'delivery_message' => PPWOO_Utils::delivery_message($name, $whatsapp ?: $phone, $street_address, $address['postcode'],
                $complement, $address['street'] && ($address['city'] || $address['postcode']) ? $destination : ''),
            'shipping_paid' => (float) $order->get_shipping_total() + (float) $order->get_shipping_tax(),
            'currency' => $order->get_currency(),
        ];
    }

    private static function dashboard(int $history_before = 0, bool $history = false): array {
        $records = PPWOO_Routes_Store::listing($history ? 'closed' : 'active', $history_before);
        $next = 0;
        if ($history && count($records) > 20) {
            array_pop($records);
            $next = end($records)['id'];
        }
        $routes = [];
        foreach ($records as $route) {
            $stops = [];
            foreach (PPWOO_Routes_Store::route_stops($route['id']) as $stop) {
                $order = self::summary($stop['order_id']);
                $order['position'] = $stop['position'];
                $order['delivery_state'] = $stop['delivery_state'];
                $order['event_state'] = self::stale($stop) ? 'uncertain' : $stop['event_state'];
                $order['code'] = $stop['details']['result_code'] ?? '';
                $order['attempt'] = $stop['attempt'];
                $order['cost'] = $stop['details']['cost'] ?? '';
                $order['deadline'] = $stop['details']['deadline'] ?? '';
                $stops[] = $order;
            }
            $details = $route['details'];
            $routes[] = [
                'id' => $route['id'], 'slot' => $route['slot'], 'state' => $route['state'], 'revision' => $route['revision'],
                'sheet' => $route['state'] === 'draft' ? ($details['sheet'] ?? []) : [],
                'departed_at' => $details['departed_at'] ?? '',
                'calculation' => $route['state'] === 'draft' ? self::current_calculation($details['calc'] ?? '', $stops) : ($details['dispatched_calculation'] ?? PPWOO_Route_Calculation::public_result(PPWOO_Route_Calculation::get($details['calc'] ?? ''))),
                'stops' => $stops,
            ];
        }
        return ['routes' => $routes, 'history_next' => $next, 'retry_uncertain' => self::can_retry_uncertain()];
    }

    private static function plan(array $input): array {
        $ids = self::ids($input['order_ids'] ?? null);
        $orders = [];
        foreach ($ids as $id) {
            $stop = PPWOO_Routes_Store::stop($id);
            if ($stop) {
                $route = PPWOO_Routes_Store::route($stop['route_id']);
                if (!$route || $route['state'] !== 'draft') self::conflict('Um pedido já saiu para entrega.');
            }
            $orders[] = self::order($id);
        }
        $calc = PPWOO_Route_Calculation::calculate($orders, 0);
        return ['calculation' => PPWOO_Route_Calculation::public_result($calc), 'orders' => array_map([__CLASS__, 'summary'], $ids)];
    }

    private static function current_calculation(string $token, array $stops): ?array {
        $calc = PPWOO_Route_Calculation::get($token);
        if (!$calc) return null;
        try {
            $orders = array_map([__CLASS__, 'order'], array_column($stops, 'id'));
            if ($calc['fingerprint'] !== PPWOO_Route_Calculation::fingerprint($orders)) return null;
        } catch (DomainException $error) { return null; }
        return PPWOO_Route_Calculation::public_result($calc);
    }

    private static function change_group(array $input): void {
        $order_id = self::id($input['order_id'] ?? null);
        $slot = $input['slot'] ?? null;
        if (!is_int($slot) || $slot < -1 || $slot > 1000) throw new DomainException('Grupo inválido.', 422);
        self::order($order_id);
        PPWOO_Routes_Store::transaction(static function () use ($input, $order_id, $slot) {
            $stop = PPWOO_Routes_Store::stop($order_id, true);
            $source = $stop ? PPWOO_Routes_Store::route($stop['route_id'], true) : null;
            if ($stop && (!$source || $source['state'] !== 'draft' || $stop['delivery_state'] !== 'draft')) self::conflict();
            if (($source['id'] ?? 0) !== ($input['source_id'] ?? 0) ||
                ($source && $source['revision'] !== ($input['source_revision'] ?? null))) self::conflict();
            if (!$source) {
                $calc = PPWOO_Route_Calculation::get(is_string($input['preview'] ?? null) ? $input['preview'] : '');
                if (!$calc || $calc['owner'] !== get_current_user_id() || !in_array($order_id, $calc['input_ids'], true)) {
                    self::conflict('Calcule novamente para atualizar a prévia.');
                }
            }
            if ($source && $slot === $source['slot']) return;
            if ($slot === 0) {
                if (!$source) return;
                PPWOO_Routes_Store::remove_stop($order_id);
            } else {
                if ($slot === -1) {
                    $slot = 1;
                    while ($slot <= 1000 && PPWOO_Routes_Store::by_slot($slot)) $slot++;
                    if ($slot > 1000) self::conflict('Não há vagas para novas rotas em preparação.');
                }
                $target = PPWOO_Routes_Store::by_slot($slot);
                if (($target['id'] ?? 0) !== ($input['target_id'] ?? 0) ||
                    ($target && $target['revision'] !== ($input['target_revision'] ?? null))) self::conflict();
                if (!$target) $target = PPWOO_Routes_Store::route(PPWOO_Routes_Store::create_route($slot), true);
                $members = PPWOO_Routes_Store::route_stops($target['id']);
                if (count($members) >= PPWOO_Route_Calculation::LIMIT) self::conflict('O grupo atingiu o limite de pedidos.');
                $stop = [
                    'new' => !$source, 'order_id' => $order_id, 'route_id' => $target['id'],
                    'position' => $members ? end($members)['position'] + 1 : 1, 'delivery_state' => 'draft',
                    'event_state' => 'waiting', 'attempt' => 0, 'details' => $source ? ($stop['details'] ?? []) : [],
                ];
                PPWOO_Routes_Store::save_stop($stop);
                unset($target['details']['calc']);
                PPWOO_Routes_Store::save_route($target);
            }
            if ($source) {
                if (!PPWOO_Routes_Store::route_stops($source['id'])) {
                    PPWOO_Routes_Store::remove_empty_draft($source['id']);
                } else {
                    unset($source['details']['calc']);
                    PPWOO_Routes_Store::save_route($source);
                }
            }
            PPWOO_Debug::info('Rotas: agrupamento atualizado', ['order_id' => $order_id, 'from' => $source['id'] ?? 0, 'to' => $target['id'] ?? 0]);
        });
    }

    private static function recalculate(array $input): void {
        $route = self::route($input, false, 'draft');
        if ($route['revision'] !== ($input['revision'] ?? null)) self::conflict();
        $members = PPWOO_Routes_Store::route_stops($route['id']);
        if (!$members) self::conflict('Inclua pedidos antes de calcular a rota.');
        $orders = array_map([__CLASS__, 'order'], array_column($members, 'order_id'));
        $preview = empty($route['details']['calc']) && is_string($input['preview'] ?? null)
            ? PPWOO_Route_Calculation::get($input['preview']) : null;
        $calc = $preview && $preview['owner'] === get_current_user_id() &&
            $preview['fingerprint'] === PPWOO_Route_Calculation::fingerprint($orders)
            ? $preview : PPWOO_Route_Calculation::calculate($orders, $route['revision']);
        PPWOO_Routes_Store::transaction(static function () use ($input, $calc) {
            $fresh = self::route($input, true, 'draft');
            $stops = array_column(PPWOO_Routes_Store::route_stops($fresh['id']), null, 'order_id');
            $position = 0;
            foreach (array_merge($calc['stops'], $calc['issues']) as $item) {
                if (!isset($stops[$item['order_id']])) self::conflict();
                $stop = $stops[$item['order_id']];
                $stop['position'] = ++$position;
                PPWOO_Routes_Store::save_stop($stop);
            }
            $fresh['details']['calc'] = $calc['token'];
            PPWOO_Routes_Store::save_route($fresh);
        });
    }

    private static function amount($value): ?string {
        if (!is_string($value) || !preg_match('/^\d{1,7}(?:[.,]\d{1,2})?$/D', trim($value))) return null;
        return wc_format_decimal(str_replace(',', '.', trim($value)), 2);
    }

    private static function save_sheet(array $input, bool $dispatch): void {
        if ($dispatch && !function_exists('as_enqueue_async_action')) {
            throw new DomainException('A fila de tarefas do WooCommerce não está disponível.', 503);
        }
        $sheet = is_array($input['sheet'] ?? null) ? $input['sheet'] : [];
        $link = is_string($sheet['link'] ?? null) ? esc_url_raw($sheet['link'], ['http', 'https']) : '';
        $phone = is_string($sheet['phone'] ?? null) ? PPWOO_Utils::sanitize_phone($sheet['phone']) : '';
        $code = is_string($sheet['code'] ?? null) ? $sheet['code'] : '';
        if (($sheet['link'] ?? '') !== '' && (!$link || !wp_parse_url($link, PHP_URL_HOST))) throw new DomainException('Informe um link de rastreio válido.', 422);
        if (strlen($phone) > 11 || ($code !== '' && !preg_match('/^\d{1,10}$/D', $code))) {
            throw new DomainException('Confira o WhatsApp e o código numérico da rota.', 422);
        }
        if ($dispatch && (!$link || strlen($phone) < 10 || $code === '' || (int) $code < 1 ||
            wp_parse_url(PPWOO_Config::get_webhook_url(), PHP_URL_SCHEME) !== 'https' ||
            !wp_http_validate_url(PPWOO_Config::get_webhook_url()))) {
            throw new DomainException('Preencha link, WhatsApp e código da rota, e confira o webhook HTTPS de despacho.', 422);
        }
        $costs = is_array($sheet['costs'] ?? null) ? $sheet['costs'] : [];
        $id = PPWOO_Routes_Store::transaction(static function () use ($input, $dispatch, $link, $phone, $code, $costs) {
            $route = self::route($input, true, 'draft');
            $stops = PPWOO_Routes_Store::route_stops($route['id']);
            if (!$stops) self::conflict('Inclua pedidos antes de salvar a ficha.');
            $calc = PPWOO_Route_Calculation::get($route['details']['calc'] ?? '');
            $by_id = array_column($calc['stops'] ?? [], null, 'order_id');
            if ($dispatch && (!$calc || $calc['issues'] || count($stops) !== count($by_id) ||
                $calc['fingerprint'] !== PPWOO_Route_Calculation::fingerprint(array_map([__CLASS__, 'order'], array_column($stops, 'order_id'))))) {
                self::conflict('Calcule novamente a rota e confira as paradas antes de despachar.');
            }
            $now = time();
            foreach ($stops as $stop) {
                $value = $costs[$stop['order_id']] ?? '';
                $cost = self::amount($value);
                if ($cost === null && ($dispatch || $value !== '')) throw new DomainException('Confira o custo negociado do pedido #' . $stop['order_id'] . '.', 422);
                $stop['details']['cost'] = $cost ?? '';
                if ($dispatch) {
                    $eta = $by_id[$stop['order_id']]['eta_seconds'] ?? null;
                    if ($eta === null) self::conflict('A ordem das paradas mudou. Calcule novamente.');
                    $stop['details']['deadline'] = wp_date('d/m/Y \à\s H:i', $now + $eta);
                    $stop['details']['eta_at'] = gmdate('c', $now + $eta);
                    $stop['details']['last_stop'] = $stop['order_id'] === $calc['destination_order_id'];
                    $stop['delivery_state'] = 'on_route';
                    $stop['event_state'] = 'queued';
                }
                PPWOO_Routes_Store::save_stop($stop);
            }
            $route['details']['sheet'] = ['link' => $link, 'phone' => $phone, 'code' => $code];
            if ($dispatch) {
                $route['state'] = 'dispatched';
                $route['details']['departed_at'] = gmdate('c', $now);
                $route['details']['departed_by'] = get_current_user_id();
                $route['details']['origin'] = $calc['origin_postcode'];
                $route['details']['dispatched_calculation'] = PPWOO_Route_Calculation::public_result($calc);
            }
            PPWOO_Routes_Store::save_route($route);
            return $route['id'];
        });
        PPWOO_Debug::info($dispatch ? 'Rotas: saída registrada' : 'Rotas: ficha salva', ['route_id' => $id]);
        if ($dispatch) self::enqueue($id);
    }

    private static function close(array $input): void {
        $ids = self::ids($input['order_ids'] ?? null);
        $route_id = PPWOO_Routes_Store::transaction(static function () use ($input, $ids) {
            $route = self::route($input, true, 'dispatched');
            $stops = array_column(PPWOO_Routes_Store::route_stops($route['id']), null, 'order_id');
            foreach ($ids as $id) {
                if (($stops[$id]['delivery_state'] ?? '') !== 'on_route') self::conflict('Só pedidos em rota podem receber baixa.');
                $stops[$id]['delivery_state'] = 'closed';
                $stops[$id]['details']['closed_at'] = gmdate('c');
                $stops[$id]['details']['closed_by'] = get_current_user_id();
                $stops[$id]['details']['closed_source'] = 'operator';
                PPWOO_Routes_Store::save_stop($stops[$id]);
            }
            if (!in_array('on_route', array_column($stops, 'delivery_state'), true)) {
                $route['state'] = 'closed';
                $route['details']['closed_at'] = gmdate('c');
            }
            PPWOO_Routes_Store::save_route($route);
            return $route['id'];
        });
        PPWOO_Debug::info('Rotas: baixa administrativa', ['route_id' => $route_id, 'order_ids' => $ids]);
    }

    private static function can_retry_uncertain(): bool {
        // Preserva somente a autorização explícita registrada na primeira versão.
        return get_option('ppwoo_routes_deduplicated', 'no') === 'yes';
    }

    private static function stale(array $stop): bool {
        return $stop['event_state'] === 'sending' &&
            strtotime($stop['updated_at'] . ' UTC') < time() - self::STALE_SECONDS;
    }

    private static function retry(array $input): void {
        $order_id = self::id($input['order_id'] ?? null);
        $id = PPWOO_Routes_Store::transaction(static function () use ($input, $order_id) {
            $route = self::route($input, true);
            $stop = PPWOO_Routes_Store::stop($order_id, true);
            if (!$stop || $stop['route_id'] !== $route['id'] || $route['state'] === 'draft') self::conflict();
            $state = self::stale($stop) ? 'uncertain' : $stop['event_state'];
            if ($state !== 'failed' && !($state === 'uncertain' && self::can_retry_uncertain())) {
                self::conflict('Este pedido não pode ser reenviado com segurança.');
            }
            $stop['event_state'] = 'queued';
            PPWOO_Routes_Store::save_stop($stop);
            PPWOO_Debug::info('Rotas: reenvio solicitado', ['route_id' => $route['id'], 'order_id' => $order_id]);
            return $route['id'];
        });
        self::enqueue($id);
    }

    private static function enqueue(int $id): void {
        if (function_exists('as_enqueue_async_action')) {
            $action = as_enqueue_async_action(self::WORKER, [$id], 'ppwoo-routes');
            if (!$action) PPWOO_Debug::warn('Rotas: fila não agendada', ['route_id' => $id]);
        }
    }

    public static function work($id): void {
        if (!self::enabled() || !PPWOO_Routes_Store::ready()) return;
        $id = (int) $id;
        try {
            $job = PPWOO_Routes_Store::transaction(static function () use ($id) {
                $route = PPWOO_Routes_Store::route($id, true);
                if (!$route || $route['state'] === 'draft') return null;
                $pending = null;
                foreach (PPWOO_Routes_Store::route_stops($id) as $stop) {
                    if ($stop['event_state'] === 'sending') {
                        if (!self::stale($stop)) return null;
                        $stop['event_state'] = 'uncertain';
                        $stop['details']['result_code'] = 'worker_interrupted';
                        PPWOO_Routes_Store::save_stop($stop);
                    }
                    if ($pending === null && $stop['event_state'] === 'queued') $pending = $stop;
                }
                if (!$pending) return null;
                $pending['event_state'] = 'sending';
                $pending['attempt']++;
                PPWOO_Routes_Store::save_stop($pending);
                return [$route, $pending];
            });
            if (!$job) return;
            [$route, $stop] = $job;
            PPWOO_Debug::info('Rotas: tentativa de despacho', ['route_id' => $id, 'order_id' => $stop['order_id'], 'attempt' => $stop['attempt']]);
            $result = self::send_order($route, $stop);
            $next = PPWOO_Routes_Store::transaction(static function () use ($id, $stop, $result) {
                PPWOO_Routes_Store::route($id, true);
                $current = PPWOO_Routes_Store::stop($stop['order_id'], true);
                if ($current && $current['attempt'] === $stop['attempt'] && $current['event_state'] === 'sending') {
                    $current['event_state'] = $result['state'];
                    $current['details']['result_code'] = $result['code'];
                    PPWOO_Routes_Store::save_stop($current);
                }
                return in_array('queued', array_column(PPWOO_Routes_Store::route_stops($id), 'event_state'), true);
            });
            PPWOO_Debug::info('Rotas: resultado do despacho', [
                'route_id' => $id, 'order_id' => $stop['order_id'], 'attempt' => $stop['attempt'],
                'state' => $result['state'], 'code' => $result['code'],
            ]);
            if ($next && self::enabled()) self::enqueue($id);
        } catch (Throwable $error) {
            PPWOO_Debug::error('Rotas: interrupção no processamento', ['route_id' => $id]);
        }
    }

    private static function send_order(array $route, array $stop): array {
        try {
            $order = wc_get_order($stop['order_id']);
            if (!$order instanceof WC_Order || !PPWOO_Utils::is_motoboy_shipping($order) ||
                ($order->get_status() !== 'processing' &&
                    !($order->get_status() === 'completed' && (int) $order->get_meta('_ppwoo_dispatch_route_id') === $route['id']))) {
                return ['state' => 'failed', 'code' => 'order_unavailable'];
            }
            $sheet = $route['details']['sheet'];
            PPWOO_Utils::save_tracking_data([
                'link' => $sheet['link'], 'deadline' => $stop['details']['deadline'], 'cost' => $stop['details']['cost'],
                'motoboy_whatsapp' => $sheet['phone'],
                // O formulário atual grava zero quando o campo numérico está vazio.
                'finalization_code' => $stop['details']['last_stop'] ? $sheet['code'] : '',
            ], $order);
            $order->update_meta_data('_ppwoo_dispatch_route_id', $route['id']);
            $order->delete_meta_data('_packing_panel_workflow_step');
            $order->save();
            if ($order->get_status() === 'processing' && !$order->update_status('completed', 'Pedido despachado pelo Pack Panel.')) {
                return ['state' => 'failed', 'code' => 'order_save'];
            }
        } catch (Throwable $error) {
            return ['state' => 'failed', 'code' => 'order_save'];
        }
        $key = hash('sha256', home_url('/') . '|ppwoo-route|' . $route['id'] . '|' . $stop['order_id']);
        return PPWOO_Webhook::send_route_dispatch($order, $key, $route['details']['departed_at']);
    }

    public static function ajax(): void {
        if (!check_ajax_referer('packing_panel_nonce', 'nonce', false) || !PPWOO_Security::can_manage_panel()) {
            wp_send_json_error(['message' => 'Acesso negado.'], 403);
        }
        if (!self::enabled() || !PPWOO_Routes_Store::ready()) wp_send_json_error(['message' => 'Rotas estão desativadas.'], 403);
        try {
            $raw = $_POST['payload'] ?? '';
            if (!is_string($raw) || strlen($raw) > 32768) throw new DomainException('Solicitação inválida.', 422);
            $input = json_decode(wp_unslash($raw), true, 16);
            if (!is_array($input)) throw new DomainException('Solicitação inválida.', 422);
            $command = $input['command'] ?? '';
            if (!is_string($command)) throw new DomainException('Ação inválida.', 422);
            $extra = [];
            switch ($command) {
                case 'list':
                    $cached = get_transient('ppwoo_routes_list_' . get_current_user_id());
                    if (is_array($cached)) { wp_send_json_success($cached); return; }
                    break;
                case 'history':
                    $before = $input['before'] ?? 0;
                    if (!is_int($before) || $before < 0) throw new DomainException('Página do histórico inválida.', 422);
                    wp_send_json_success(self::dashboard($before, true));
                    return;
                case 'plan': $extra = self::plan($input); break;
                case 'group': self::change_group($input); break;
                case 'recalculate': self::recalculate($input); break;
                case 'save': self::save_sheet($input, false); break;
                case 'dispatch': self::save_sheet($input, true); break;
                case 'close': self::close($input); break;
                case 'retry': self::retry($input); break;
                case 'resume':
                    $route = self::route($input);
                    if ($route['state'] === 'draft') self::conflict();
                    self::enqueue($route['id']);
                    break;
                default: throw new DomainException('Ação inválida.', 422);
            }
            $data = self::dashboard();
            set_transient('ppwoo_routes_list_' . get_current_user_id(), $data, 3);
            wp_send_json_success(array_merge($data, $extra));
        } catch (DomainException $error) {
            wp_send_json_error(['message' => $error->getMessage()], $error->getCode() ?: 422);
        } catch (Throwable $error) {
            PPWOO_Debug::error('Rotas: falha interna da ação');
            wp_send_json_error(['message' => 'Não foi possível processar a ação. Confira o estado antes de tentar novamente.'], 500);
        }
    }
}
