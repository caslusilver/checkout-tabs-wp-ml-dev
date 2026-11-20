<?php
if (!defined('ABSPATH')) {
	exit;
}

/** Horários de saída da loja, independentes do prazo retornado pelo frete. */
function ctwpml_dispatch_days(): array {
	return ['mon' => 'Segunda-feira', 'tue' => 'Terça-feira', 'wed' => 'Quarta-feira', 'thu' => 'Quinta-feira', 'fri' => 'Sexta-feira', 'sat' => 'Sábado', 'sun' => 'Domingo'];
}

function ctwpml_sanitize_dispatch_schedule($input): array {
	$clean = [];
	if (!is_array($input)) {
		return $clean;
	}
	foreach (ctwpml_dispatch_days() as $day => $label) {
		$raw = $input[$day] ?? [];
		$parts = is_array($raw) ? $raw : preg_split('/[\s,;]+/', (string) $raw);
		$times = [];
		foreach ($parts as $part) {
			if (!is_scalar($part)) {
				continue;
			}
			$time = trim((string) $part);
			if (preg_match('/^([01]?[0-9]|2[0-3])(?::([0-5][0-9])|h([0-5][0-9])?)$/i', $time, $match)) {
				$time = sprintf('%02d:%02d', (int) $match[1], (int) (($match[2] ?? '') ?: ($match[3] ?? 0)));
				$times[$time] = $time;
			}
		}
		sort($times, SORT_STRING);
		$clean[$day] = array_values($times);
	}
	return $clean;
}

function ctwpml_sanitize_dispatch_grace($value): int {
	if ($value === '' || $value === null) {
		return 5;
	}
	$minutes = is_scalar($value) ? filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) : false;
	if ($minutes === false) {
		add_settings_error('checkout_tabs_wp_ml_dispatch_grace', 'invalid_grace', 'Informe a tolerância em minutos inteiros, a partir de zero.');
		return (int) get_option('checkout_tabs_wp_ml_dispatch_grace', 5);
	}
	return $minutes;
}

function ctwpml_next_dispatch(?DateTimeImmutable $now = null, bool $include_grace = true): ?DateTimeImmutable {
	$schedule = ctwpml_sanitize_dispatch_schedule(get_option('checkout_tabs_wp_ml_dispatch_schedule', []));
	return ctwpml_dispatch_from_schedule($now ?? current_datetime(), $schedule, wp_timezone(),
		max(0, (int) get_option('checkout_tabs_wp_ml_dispatch_grace', 5)), $include_grace);
}

/** O instante é absoluto; somente o calendário/horário da loja usa o fuso informado. */
function ctwpml_dispatch_from_schedule(DateTimeImmutable $reference, array $schedule, DateTimeZone $timezone, int $minutes, bool $include_grace = true): ?DateTimeImmutable {
	$now = $reference->setTimezone($timezone);
	$recent = null;
	$keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	for ($offset = -7; $offset <= 7; $offset++) {
		$day = $now->setTime(0, 0)->modify(sprintf('%+d days', $offset));
		$key = $keys[(int) $day->format('w')];
		foreach (($schedule[$key] ?? []) as $time) {
			[$hour, $minute] = explode(':', $time);
			$departure = $day->setTime((int) $hour, (int) $minute);
			if ($departure > $now) {
				return $recent ?: $departure;
			}
			if ($include_grace && ($now->getTimestamp() - $departure->getTimestamp()) / 60 < $minutes) {
				$recent = $departure;
			}
		}
	}
	return $recent;
}

function ctwpml_dispatch_notice(): array {
	$now = current_datetime();
	$next = ctwpml_next_dispatch($now);
	if (!$next) {
		return [
			'dispatch_notice' => 'Horários de saída ainda não configurados. Consulte a loja sobre o próximo despacho.',
			'dispatch_refresh_after' => 0,
		];
	}
	$day_label = $next->format('Y-m-d') === $now->format('Y-m-d') ? 'hoje' : ctwpml_dispatch_days()[strtolower($next->format('D'))];
	$time = $next->format('i') === '00' ? $next->format('G\h') : $next->format('H:i');
	$timestamp = $now->getTimestamp();
	$refresh_at = $now->modify('tomorrow')->getTimestamp();
	$upcoming = ctwpml_next_dispatch($now, false);
	if ($upcoming) {
		$refresh_at = min($refresh_at, $upcoming->getTimestamp());
	}
	if ($next <= $now) {
		$elapsed = $timestamp - $next->getTimestamp();
		$remaining = (int) get_option('checkout_tabs_wp_ml_dispatch_grace', 5) * 60 - $elapsed;
		$refresh_at = min($refresh_at, $timestamp + $remaining);
	}
	return [
		'dispatch_notice' => 'Próximo envio por motoboy previsto: ' . $day_label . ', ' . $next->format('d/m') . ', às ' . $time . '. Este é o horário de despacho. O prazo de entrega informado pelo frete é uma informação separada.',
		'dispatch_refresh_after' => (int) max(1, $refresh_at - $timestamp),
	];
}

function ctwpml_handle_refresh_dispatch_notice(): void {
	check_ajax_referer('ctwpml_shipping_options');
	wp_send_json_success(ctwpml_dispatch_notice());
}
add_action('wp_ajax_ctwpml_refresh_dispatch_notice', 'ctwpml_handle_refresh_dispatch_notice');
add_action('wp_ajax_nopriv_ctwpml_refresh_dispatch_notice', 'ctwpml_handle_refresh_dispatch_notice');
