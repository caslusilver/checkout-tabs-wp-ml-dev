<?php
if (!defined('ABSPATH')) exit;

/** Calendário único, exceções temporárias e aviso público. Não envia webhooks. */
final class CTWPML_Dispatch_Controls {
    public const OPTION = 'ctwpml_dispatch_controls';
    public static function now(): DateTimeImmutable { return current_datetime(); }
    public static function config(): array {
        return array_merge(['periods' => [], 'basis' => 'created', 'banner_open' => 'Próximo envio por motoboy: {proxima_saida}.',
            'banner_closed' => 'Envios por motoboy encerrados hoje. Próxima saída: {proxima_saida}.',
            'color_open' => '#16a34a', 'color_closed' => '#c57b12', 'pulse' => true], (array) get_option(self::OPTION, []));
    }
    public static function period(int $at): ?array {
        foreach (array_reverse(self::config()['periods']) as $period) if ($at >= $period['from'] && $at < $period['until']) return $period;
        return null;
    }
    public static function skip_dates(int $at): array { $period = self::period($at); return $period ? [$period['day']] : []; }
    public static function revision(): string {
        return hash('sha256', wp_json_encode([self::config(), get_option('checkout_tabs_wp_ml_dispatch_schedule', []),
            get_option('checkout_tabs_wp_ml_dispatch_grace', 5), wp_timezone()->getName()]));
    }
    public static function public_state(): array {
        $now = self::now(); $closed = self::period($now->getTimestamp()); $next = ctwpml_next_dispatch($now);
        $day = $next ? ($next->format('Y-m-d') === $now->format('Y-m-d') ? 'hoje' :
            ($next->format('Y-m-d') === $now->modify('tomorrow')->format('Y-m-d') ? 'amanhã' : ctwpml_dispatch_days()[strtolower($next->format('D'))])) : '';
        $values = ['proxima_saida' => $next ? $day . ', ' . $next->format('d/m') . ', às ' . $next->format('H:i') : 'horário a confirmar',
            'proximo_horario' => $next ? $next->format('H:i') : 'a confirmar', 'proxima_data' => $next ? $next->format('d/m') : 'a confirmar',
            'status_motoboy' => $closed ? 'fechado hoje' : 'envios ativos'];
        $schedule = ctwpml_sanitize_dispatch_schedule(get_option('checkout_tabs_wp_ml_dispatch_schedule', []));
        $times = $schedule[strtolower($now->format('D'))] ?? [];
        $values['horarios_hoje'] = $closed ? 'envios encerrados hoje' : ($times ? implode(' e ', $times) : 'sem saídas hoje');
        $cfg = self::config();
        $message = preg_replace_callback('/\{([a-z_]+)\}/', static fn($m) => $values[$m[1]] ?? $m[0], $closed ? $cfg['banner_closed'] : $cfg['banner_open']);
        return ['closed' => (bool) $closed, 'signature' => $closed ? hash('sha256', self::revision() . '|' . ($next ? $next->getTimestamp() : 0)) : '',
            'next_at' => $next ? $next->getTimestamp() : 0, 'next_label' => $values['proxima_saida'], 'message' => $message,
            'color' => $closed ? $cfg['color_closed'] : $cfg['color_open'], 'pulse' => (bool) $cfg['pulse'],
            'warning' => 'Não teremos mais envios por motoboy hoje. Comprando agora, o envio será na próxima saída: ' . $values['proxima_saida'] . '.',
            'day' => $now->format('Y-m-d'), 'timezone' => wp_timezone()->getName()];
    }
    public static function admin_state(): array {
        $cfg = self::config(); unset($cfg['periods']);
        return array_merge($cfg, ['schedule' => ctwpml_sanitize_dispatch_schedule(get_option('checkout_tabs_wp_ml_dispatch_schedule', [])),
            'grace' => (int) get_option('checkout_tabs_wp_ml_dispatch_grace', 5), 'revision' => self::revision(), 'public' => self::public_state()]);
    }
    public static function write(array $input): array {
        if (!current_user_can('manage_options')) throw new DomainException('Somente administradores podem alterar o envio.', 403);
        global $wpdb;
        $lock = (int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 2)', 'ctwpml_dispatch_settings')) === 1;
        if (!$lock) throw new DomainException('Outra alteração está sendo salva. Tente novamente.', 409);
        try {
            if (($input['revision'] ?? '') !== self::revision()) throw new DomainException('Os horários mudaram em outra aba. Reabra as configurações para conferir.', 409);
            $cfg = self::config(); $command = $input['command'] ?? '';
            if ($command === 'toggle') {
                if (!is_bool($input['open'] ?? null)) throw new DomainException('Estado inválido.', 422);
                $now = self::now(); $at = $now->getTimestamp(); $active = self::period($at);
                if ($input['open'] && $active) {
                    foreach ($cfg['periods'] as &$period) if ($period['from'] === $active['from']) $period['until'] = $at;
                    unset($period);
                } elseif (!$input['open'] && !$active) {
                    if (count($cfg['periods']) >= 1000) throw new DomainException('Histórico de exceções cheio. Solicite revisão antes de alterar.', 409);
                    $cfg['periods'][] = ['from' => $at, 'until' => $now->modify('tomorrow')->setTime(0, 0)->getTimestamp(),
                        'day' => $now->format('Y-m-d'), 'by' => get_current_user_id()];
                }
            } elseif ($command === 'save') {
                $raw = $input['schedule'] ?? null;
                if (!is_array($raw) || array_diff(array_keys($raw), array_keys(ctwpml_dispatch_days()))) throw new DomainException('Calendário inválido.', 422);
                foreach ($raw as $times) {
                    if (!is_array($times) || count($times) > 48) throw new DomainException('Confira os horários.', 422);
                    foreach ($times as $time) if (!is_string($time) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D', $time)) throw new DomainException('Horário inválido.', 422);
                }
                $grace = $input['grace'] ?? null;
                if (!is_int($grace) || $grace < 0 || $grace > 1440 || !in_array($input['basis'] ?? '', ['created', 'paid'], true)) throw new DomainException('Confira tolerância e referência do envio.', 422);
                foreach (['banner_open', 'banner_closed'] as $key) {
                    $text = $input[$key] ?? null;
                    if (!is_string($text) || strlen($text) > 2000) throw new DomainException('Mensagem muito longa.', 422);
                    preg_match_all('/\{([^}]+)\}/', $text, $matches);
                    if (array_diff($matches[1], ['proxima_saida', 'proximo_horario', 'proxima_data', 'horarios_hoje', 'status_motoboy'])) throw new DomainException('Use somente as variáveis mostradas no editor.', 422);
                    $cfg[$key] = sanitize_textarea_field($text);
                }
                foreach (['color_open', 'color_closed'] as $key) {
                    if (!is_string($input[$key] ?? null) || !preg_match('/^#[a-f0-9]{6}$/iD', $input[$key])) throw new DomainException('Cor inválida.', 422);
                    $cfg[$key] = $input[$key];
                }
                if (!is_bool($input['pulse'] ?? null)) throw new DomainException('Animação inválida.', 422);
                $cfg['basis'] = $input['basis']; $cfg['pulse'] = $input['pulse'];
                update_option('checkout_tabs_wp_ml_dispatch_schedule', ctwpml_sanitize_dispatch_schedule($raw), false);
                update_option('checkout_tabs_wp_ml_dispatch_grace', $grace, false);
            } else throw new DomainException('Ação inválida.', 422);
            update_option(self::OPTION, $cfg, false);
            if (class_exists('PPWOO_Debug')) PPWOO_Debug::info('Envios: configuração atualizada', ['action' => $command, 'by' => get_current_user_id()]);
            return self::admin_state();
        } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', 'ctwpml_dispatch_settings')); }
    }
    public static function ajax(): void {
        nocache_headers();
        try {
            if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new DomainException('Solicitação inválida.', 405);
            check_ajax_referer('ctwpml_dispatch_settings', 'nonce');
            if (!current_user_can('manage_options')) throw new DomainException('Acesso restrito ao administrador.', 403);
            $raw = $_POST['payload'] ?? '';
            if (!is_string($raw) || strlen($raw) > 16384) throw new DomainException('Solicitação inválida.', 422);
            $input = json_decode(wp_unslash($raw), true);
            if (!is_array($input)) throw new DomainException('Solicitação inválida.', 422);
            wp_send_json_success(($input['command'] ?? '') === 'read' ? self::admin_state() : self::write($input));
        } catch (DomainException $e) { wp_send_json_error(['message' => $e->getMessage()], $e->getCode()); }
        catch (Throwable $e) { wp_send_json_error(['message' => 'Não foi possível salvar. Seus campos foram preservados.'], 500); }
    }
    public static function public_ajax(): void {
        $key = 'ctwpml_notice_' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . ':' . (int) floor(time()/60));
        $count = (int) get_transient($key);
        if ($count >= 120) wp_send_json_error(['message' => 'Aguarde para consultar novamente.'], 429);
        set_transient($key, $count + 1, 70);
        nocache_headers(); wp_send_json_success(self::public_state());
    }
    public static function assets(): void {
        $version = checkout_tabs_wp_ml_get_version();
        wp_enqueue_style('ctwpml-dispatch', CHECKOUT_TABS_WP_ML_URL . 'assets/css/dispatch-controls.css', [], $version);
        wp_enqueue_script('ctwpml-dispatch', CHECKOUT_TABS_WP_ML_URL . 'assets/js/dispatch-controls.js', ['jquery'], $version, true);
        wp_localize_script('ctwpml-dispatch', 'CTWPML_DISPATCH', ['url' => admin_url('admin-ajax.php')]);
    }
    public static function shortcode(): string {
        self::assets(); $data = self::public_state();
        return '<div class="ctwpml-dispatch-banner' . ($data['pulse'] ? ' is-pulsing' : '') . '" style="--dispatch-dot:' . esc_attr($data['color']) . '"><span aria-hidden="true" class="dispatch-dot"></span><span data-dispatch-message>' . esc_html($data['message']) . '</span></div>';
    }
    public static function motoboy(array $methods): bool {
        foreach ($methods as $method) if (is_string($method) && ($method === 'flat_rate:3' || stripos($method, 'motoboy') !== false)) return true;
        return false;
    }
    public static function validate_checkout(array $data, $errors): void {
        if (!self::motoboy((array) ($data['shipping_method'] ?? []))) return;
        $public = self::public_state(); if (!$public['closed']) return;
        $awaiting = function_exists('WC') && WC()->session ? (int) WC()->session->get('order_awaiting_payment') : 0;
        $order = $awaiting ? wc_get_order($awaiting) : null;
        $period = self::period(self::now()->getTimestamp());
        if ($order && $order->get_date_created() && $order->get_date_created()->getTimestamp() < $period['from']) return;
        $ack = $_POST['ctwpml_dispatch_ack'] ?? '';
        if (!is_string($ack) || !hash_equals($public['signature'], $ack)) $errors->add('ctwpml_dispatch_changed', $public['warning'] . ' Confirme o aviso para continuar.', ['id' => 'ctwpml_dispatch_ack']);
    }
    public static function capture_order($order): void {
        if (!is_a($order, 'WC_Order') || !class_exists('PPWOO_Utils') || !PPWOO_Utils::is_motoboy_shipping($order) || $order->get_meta('_ppwoo_dispatch_window')) return;
        $basis = self::config()['basis'];
        $date = $basis === 'paid' ? $order->get_date_paid() : $order->get_date_created();
        if (!$date) return;
        $skip = self::skip_dates($date->getTimestamp()); $schedule = ctwpml_sanitize_dispatch_schedule(get_option('checkout_tabs_wp_ml_dispatch_schedule', []));
        $grace = max(0, (int) get_option('checkout_tabs_wp_ml_dispatch_grace', 5));
        $next = ctwpml_dispatch_from_schedule(new DateTimeImmutable('@' . $date->getTimestamp()), $schedule, wp_timezone(), $grace, true, $skip);
        if (!$next) return;
        $order->update_meta_data('_ppwoo_dispatch_window', $next->getTimestamp());
        $order->update_meta_data('_ppwoo_dispatch_context', ['version' => 1, 'state' => 'verified', 'window' => $next->getTimestamp(),
            'timezone' => wp_timezone()->getName(), 'reference_at' => $date->getTimestamp(), 'reference_source' => $basis,
            'schedule' => $schedule, 'grace' => $grace, 'skip_dates' => $skip]);
        $order->save_meta_data();
    }
}
add_action('wp_ajax_ctwpml_dispatch_settings', [CTWPML_Dispatch_Controls::class, 'ajax']);
add_action('wp_ajax_ctwpml_dispatch_public', [CTWPML_Dispatch_Controls::class, 'public_ajax']);
add_action('wp_ajax_nopriv_ctwpml_dispatch_public', [CTWPML_Dispatch_Controls::class, 'public_ajax']);
add_shortcode('ppwoo_aviso_envio', [CTWPML_Dispatch_Controls::class, 'shortcode']);
add_action('wp_enqueue_scripts', static function () { if (function_exists('is_checkout') && is_checkout()) CTWPML_Dispatch_Controls::assets(); });
add_action('woocommerce_after_checkout_validation', [CTWPML_Dispatch_Controls::class, 'validate_checkout'], 30, 2);
add_action('woocommerce_checkout_order_created', [CTWPML_Dispatch_Controls::class, 'capture_order']);
add_action('woocommerce_payment_complete', static function ($id) { CTWPML_Dispatch_Controls::capture_order(wc_get_order($id)); });
