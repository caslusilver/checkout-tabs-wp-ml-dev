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
			$time = trim((string) $part);
			if (preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/', $time)) {
				$times[$time] = $time;
			}
		}
		sort($times, SORT_STRING);
		$clean[$day] = array_values($times);
	}
	return $clean;
}

function ctwpml_next_dispatch(?DateTimeImmutable $now = null): ?DateTimeImmutable {
	$schedule = get_option('checkout_tabs_wp_ml_dispatch_schedule', []);
	if (!is_array($schedule)) {
		return null;
	}
	$now = $now ?: current_datetime();
	$keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	for ($offset = 0; $offset <= 7; $offset++) {
		$day = $now->setTime(0, 0)->modify('+' . $offset . ' days');
		$key = $keys[(int) $day->format('w')];
		foreach (($schedule[$key] ?? []) as $time) {
			if (!preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', (string) $time, $match)) {
				continue;
			}
			$departure = $day->setTime((int) $match[1], (int) $match[2]);
			// O limite de cinco minutos é exclusivo: 12h04 entra; 12h05 passa à próxima saída.
			if ($now < $departure->modify('+5 minutes')) {
				return $departure;
			}
		}
	}
	return null;
}

function ctwpml_dispatch_notice(): string {
	$next = ctwpml_next_dispatch();
	if (!$next) {
		return 'Horários de saída ainda não configurados. Consulte a loja sobre o próximo despacho.';
	}
	return 'Próxima saída prevista da loja: ' . wp_date('d/m/Y \à\s H:i', $next->getTimestamp(), wp_timezone()) . '. Este é o horário de despacho; o prazo de entrega informado pelo frete é uma informação separada.';
}
