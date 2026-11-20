<?php
if (!defined('ABSPATH')) exit;

/** Máquina de estados pura. Persistência/autorização pertencem ao serviço de rotas. */
final class PPWOO_Driver_State {
    public static function initial(array $ids): array {
        if (!$ids || count($ids) > 100 || count(array_unique($ids)) !== count($ids)) throw new DomainException('Confira as paradas da rota.', 422);
        return ['version' => 0, 'current' => 0, 'status' => 'ready', 'stops' => array_map(static fn($id) => ['id' => (int) $id, 'state' => 'ready'], $ids), 'receipts' => [], 'devices' => []];
    }

    /** A retirada confirmada pelo operador já inicia a primeira parada. */
    public static function depart(array $ids, string $at, array $previous = []): array {
        $state = self::initial($ids);
        foreach (['version', 'devices', 'receipts'] as $key) if (isset($previous[$key])) $state[$key] = $previous[$key];
        $device = wp_generate_uuid4(); $id = wp_generate_uuid4();
        $before = $state['version']; $sequence = $state['devices'][$device] ?? 0;
        $state = self::apply($state, ['id' => $id, 'device' => $device, 'seq' => $sequence + 1,
            'version' => $before, 'stop_id' => $state['stops'][0]['id'], 'type' => 'start', 'at' => $at], [], $at);
        $state['operator_start'] = ['version_before' => $before, 'event_id' => $id, 'device' => $device, 'sequence_before' => $sequence];
        return $state;
    }

    public static function apply(array $state, array $event, array $confirmed_ids, string $received_at): array {
        $id = $event['id'] ?? ''; $device = $event['device'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/D', $id) || !is_string($device) || !preg_match('/^[a-f0-9-]{36}$/D', $device) ||
            !is_int($event['seq'] ?? null) || $event['seq'] < 1 || !is_int($event['version'] ?? null) || !is_int($event['stop_id'] ?? null) ||
            !is_string($event['at'] ?? null) || strlen($event['at']) > 40 || strtotime($event['at']) === false) throw new DomainException('Evento inválido.', 422);
        $hash = hash('sha256', json_encode($event, JSON_THROW_ON_ERROR));
        if (isset($state['receipts'][$id])) {
            if (!hash_equals($state['receipts'][$id]['hash'], $hash)) throw new DomainException('Evento repetido com conteúdo diferente.', 409);
            return $state;
        }
        if (count($state['receipts']) >= 1000 || (!isset($state['devices'][$device]) && count($state['devices']) >= 20)) throw new DomainException('Peça ao administrador para revisar esta rota.', 409);
        // Compatibilidade: um aparelho antigo pode ter enfileirado o primeiro start
        // offline antes de a leitura de outro aparelho preparar a rota já despachada.
        $operator = $state['operator_start'] ?? null;
        if (($event['type'] ?? '') === 'start' && $operator && empty($operator['legacy_ack']) && $event['version'] === $operator['version_before'] &&
            $state['version'] === $operator['version_before'] + 1 && $state['current'] === 0 && $state['stops'][0]['state'] === 'started') {
            $base = $state; $base['version']--; $base['status'] = 'ready';
            $base['stops'][0] = ['id' => $state['stops'][0]['id'], 'state' => 'ready'];
            unset($base['started_at'], $base['operator_start'], $base['receipts'][$operator['event_id']]);
            if ($operator['sequence_before']) $base['devices'][$operator['device']] = $operator['sequence_before'];
            else unset($base['devices'][$operator['device']]);
            $ack = self::apply($base, $event, $confirmed_ids, $received_at);
            $state['devices'][$device] = $ack['devices'][$device];
            $state['receipts'][$id] = $ack['receipts'][$id];
            $state['operator_start']['legacy_ack'] = $id;
            // A versão/início já confirmados pelo operador não são avançados novamente.
            return $state;
        }
        if ($event['seq'] !== ($state['devices'][$device] ?? 0) + 1 || $event['version'] !== $state['version']) throw new DomainException('A rota mudou. Confira as pendências antes de continuar.', 409);
        $index = array_search($event['stop_id'], array_column($state['stops'], 'id'), true);
        $current = $state['current']; $type = $event['type'] ?? '';
        if ($index === false || ($state['status'] === 'completed' && $type !== 'correct')) throw new DomainException('Esta rota foi encerrada.', 410);
        // Horário do aparelho é evidência, nunca autoridade sobre a ordem dos eventos.
        $occurred = strtotime($event['at']); $received = strtotime($received_at);
        $effective_at = gmdate('c', min($received, max($received - 7 * 86400, $occurred, strtotime($state['last_event_at'] ?? '') ?: 0)));
        if ($type === 'correct') {
            if ($index > $current) throw new DomainException('Essa parada ainda não foi iniciada.', 409);
            foreach (array_slice($state['stops'], $index) as $stop) {
                if (in_array($stop['id'], $confirmed_ids, true)) throw new DomainException('Recebimento confirmado. Somente o administrador pode reabrir.', 409);
            }
            if ($state['stops'][$index]['state'] === 'ready') throw new DomainException('Não há evento para corrigir.', 409);
            foreach ($state['stops'] as $i => &$stop) if ($i >= $index) $stop = ['id' => $stop['id'], 'state' => $i === $index ? 'started' : 'ready'];
            unset($stop);
            $state['stops'][$index]['started_at'] = $effective_at;
            $state['current'] = $index; $state['status'] = 'started';
            unset($state['completed_at']);
        } else {
            if ($index !== $current) throw new DomainException('Conclua a parada atual antes de avançar.', 409);
            $phase = $state['stops'][$index]['state'];
            if ($type === 'start' && $phase === 'ready' && $index === 0) {
                $state['stops'][$index]['state'] = 'started'; $state['status'] = 'started';
                $state['started_at'] = $effective_at; $state['stops'][$index]['started_at'] = $effective_at;
            } elseif ($type === 'arrive' && $phase === 'started') {
                $state['stops'][$index]['state'] = 'arrived';
                $state['stops'][$index]['arrived_at'] = $effective_at;
            } elseif ($type === 'complete' && $phase === 'arrived') {
                $state['stops'][$index]['state'] = 'delivered';
                $state['stops'][$index]['delivered_at'] = $effective_at;
                if ($index + 1 < count($state['stops'])) {
                    $state['current']++; $state['stops'][$index + 1]['state'] = 'started'; $state['stops'][$index + 1]['started_at'] = $effective_at;
                } else { $state['status'] = 'completed'; $state['completed_at'] = $effective_at; }
            } else throw new DomainException('Essa ação não corresponde à etapa atual.', 409);
        }
        $state['version']++;
        $state['last_event_at'] = $effective_at;
        $state['devices'][$device] = $event['seq'];
        $state['receipts'][$id] = ['hash' => $hash, 'version' => $state['version'], 'type' => $type,
            'stop_id' => $event['stop_id'], 'occurred_at' => $event['at'], 'received_at' => $received_at, 'effective_at' => $effective_at];
        return $state;
    }

    public static function view(array $state): array {
        unset($state['receipts'], $state['operator_start']);
        return $state;
    }
}
