<?php

if (!defined('ABSPATH')) exit;

final class PPWOO_Routes_Store {
    private const SCHEMA = '1';

    private static function routes(): string {
        global $wpdb;
        return $wpdb->prefix . 'ppwoo_routes';
    }

    private static function stops(): string {
        global $wpdb;
        return $wpdb->prefix . 'ppwoo_route_stops';
    }

    public static function ready(): bool {
        return get_option('ppwoo_routes_schema') === self::SCHEMA;
    }

    public static function install(): void {
        if (self::ready()) return;
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $routes = self::routes();
        $stops = self::stops();
        $collation = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $routes (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            slot int unsigned NOT NULL,
            draft_slot int unsigned DEFAULT NULL,
            revision bigint unsigned NOT NULL DEFAULT 1,
            state varchar(16) NOT NULL DEFAULT 'draft',
            details longtext NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY draft_slot (draft_slot),
            KEY state_id (state,id)
        ) ENGINE=InnoDB $collation;");
        dbDelta("CREATE TABLE $stops (
            order_id bigint unsigned NOT NULL,
            route_id bigint unsigned NOT NULL,
            position int unsigned NOT NULL,
            delivery_state varchar(16) NOT NULL DEFAULT 'draft',
            event_state varchar(16) NOT NULL DEFAULT 'waiting',
            attempt int unsigned NOT NULL DEFAULT 0,
            updated_at datetime NOT NULL,
            details longtext NOT NULL,
            PRIMARY KEY  (order_id),
            KEY route_position (route_id,position),
            KEY event_queue (route_id,event_state,position)
        ) ENGINE=InnoDB $collation;");
        foreach ([$routes, $stops] as $table) {
            $status = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS WHERE Name = %s', $table), ARRAY_A);
            if (!$status || strcasecmp($status['Engine'], 'InnoDB') !== 0) {
                throw new RuntimeException('Não foi possível preparar o armazenamento de rotas.');
            }
        }
        update_option('ppwoo_routes_schema', self::SCHEMA, false);
    }

    /** Usa a mesma conexão do WordPress. Nenhuma chamada HTTP ou hook de pedido dentro da transação. */
    public static function transaction(callable $operation) {
        global $wpdb;
        self::check($wpdb->query('START TRANSACTION'));
        try {
            $value = $operation();
            self::check($wpdb->query('COMMIT'));
            return $value;
        } catch (Throwable $error) {
            $wpdb->query('ROLLBACK');
            throw $error;
        }
    }

    private static function check($result): void {
        if ($result === false) throw new RuntimeException('Não foi possível gravar o estado das rotas. Atualize o painel.');
    }

    private static function hydrate(?array $row): ?array {
        if (!$row) return null;
        $row['details'] = json_decode($row['details'], true, 32, JSON_THROW_ON_ERROR);
        foreach (['id', 'slot', 'revision', 'order_id', 'route_id', 'position', 'attempt'] as $key) {
            if (isset($row[$key])) $row[$key] = (int) $row[$key];
        }
        return $row;
    }

    public static function route(int $id, bool $lock = false): ?array {
        global $wpdb;
        $sql = 'SELECT * FROM ' . self::routes() . ' WHERE id = %d' . ($lock ? ' FOR UPDATE' : '');
        return self::hydrate($wpdb->get_row($wpdb->prepare($sql, $id), ARRAY_A));
    }

    public static function by_slot(int $slot): ?array {
        global $wpdb;
        return self::hydrate($wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::routes() . ' WHERE draft_slot = %d FOR UPDATE', $slot
        ), ARRAY_A));
    }

    public static function stop(int $id, bool $lock = false): ?array {
        global $wpdb;
        $sql = 'SELECT * FROM ' . self::stops() . ' WHERE order_id = %d' . ($lock ? ' FOR UPDATE' : '');
        return self::hydrate($wpdb->get_row($wpdb->prepare($sql, $id), ARRAY_A));
    }

    public static function route_stops(int $id): array {
        global $wpdb;
        return array_map([__CLASS__, 'hydrate'], $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . self::stops() . ' WHERE route_id = %d ORDER BY position, order_id', $id
        ), ARRAY_A));
    }

    public static function listing(string $state, int $before = 0): array {
        global $wpdb;
        $table = self::routes();
        if ($state === 'closed') {
            $sql = $wpdb->prepare("SELECT * FROM $table WHERE state = 'closed' AND id < %d ORDER BY id DESC LIMIT 21", $before ?: PHP_INT_MAX);
        } else {
            $sql = "SELECT * FROM $table WHERE state IN ('draft','dispatched') ORDER BY id DESC";
        }
        return array_map([__CLASS__, 'hydrate'], $wpdb->get_results($sql, ARRAY_A));
    }

    public static function listed_order_ids(array $candidate_ids): array {
        global $wpdb;
        if (!self::ready() || !$candidate_ids) return [];
        $found = [];
        foreach (array_chunk($candidate_ids, 200) as $ids) {
            $markers = implode(',', array_fill(0, count($ids), '%d'));
            $found = array_merge($found, $wpdb->get_col($wpdb->prepare(
                'SELECT s.order_id FROM ' . self::stops() . ' s INNER JOIN ' . self::routes() . " r ON r.id = s.route_id WHERE s.order_id IN ($markers) AND r.state <> 'draft'", $ids
            )));
        }
        return array_fill_keys(array_map('intval', $found), true);
    }

    public static function create_route(int $slot): int {
        global $wpdb;
        self::check($wpdb->insert(self::routes(), [
            'slot' => $slot, 'draft_slot' => $slot, 'details' => '{}', 'created_at' => gmdate('Y-m-d H:i:s'),
        ], ['%d', '%d', '%s', '%s']));
        return (int) $wpdb->insert_id;
    }

    /** Conexão dedicada à requisição; não mantém transação aberta durante HTTP. */
    public static function calculation_lock(bool $release = false): bool {
        global $wpdb;
        $name = 'ppwoo_calc_' . md5($wpdb->prefix . home_url('/'));
        $sql = $release ? 'SELECT RELEASE_LOCK(%s)' : 'SELECT GET_LOCK(%s, 0)';
        return (int) $wpdb->get_var($wpdb->prepare($sql, $name)) === 1;
    }

    public static function save_route(array $route): void {
        global $wpdb;
        self::check($wpdb->update(self::routes(), [
            'details' => wp_json_encode($route['details'], JSON_THROW_ON_ERROR),
            'revision' => $route['revision'] + 1,
            'state' => $route['state'],
            'draft_slot' => $route['state'] === 'draft' ? $route['slot'] : null,
        ], ['id' => $route['id']], ['%s', '%d', '%s', '%d'], ['%d']));
    }

    public static function save_stop(array $stop): void {
        global $wpdb;
        $data = [
            'route_id' => $stop['route_id'], 'position' => $stop['position'],
            'delivery_state' => $stop['delivery_state'], 'event_state' => $stop['event_state'],
            'attempt' => $stop['attempt'], 'updated_at' => gmdate('Y-m-d H:i:s'),
            'details' => wp_json_encode($stop['details'], JSON_THROW_ON_ERROR),
        ];
        $formats = ['%d', '%d', '%s', '%s', '%d', '%s', '%s'];
        if (!empty($stop['new'])) {
            $data['order_id'] = $stop['order_id'];
            $formats[] = '%d';
            self::check($wpdb->insert(self::stops(), $data, $formats));
        } else {
            self::check($wpdb->update(self::stops(), $data, ['order_id' => $stop['order_id']], $formats, ['%d']));
        }
    }

    public static function remove_stop(int $id): void {
        global $wpdb;
        self::check($wpdb->delete(self::stops(), ['order_id' => $id], ['%d']));
    }

    public static function remove_empty_draft(int $id): void {
        global $wpdb;
        self::check($wpdb->delete(self::routes(), ['id' => $id, 'state' => 'draft'], ['%d', '%s']));
    }
}
