<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * AJAX endpoints para gerenciar logs do checkout em tempo real
 */

// Salvar log (frontend -> backend)
add_action('wp_ajax_ctwpml_save_log', 'ctwpml_ajax_save_log');
add_action('wp_ajax_nopriv_ctwpml_save_log', 'ctwpml_ajax_save_log');

function ctwpml_ajax_save_log(): void {
	// O registro pode ser enviado por visitante durante uma tentativa de checkout.
	// Leitura, limpeza e download continuam restritos às capacidades administrativas.
	if (!check_ajax_referer('ctwpml_debug_log', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Nonce inválido'], 403);
		return;
	}
	if (function_exists('checkout_tabs_wp_ml_is_debug_enabled') && !checkout_tabs_wp_ml_is_debug_enabled()) {
		wp_send_json_success(['message' => 'Debug desativado']);
		return;
	}

	// Evita que uma sessão pública malformada transforme o modo Debug em um flood de escrita.
	$rate_key = 'ctwpml_debug_rate_' . md5((string) ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
	$rate_count = (int) get_transient($rate_key);
	if ($rate_count >= 120) {
		wp_send_json_success(['message' => 'Log limitado temporariamente']);
		return;
	}
	set_transient($rate_key, $rate_count + 1, MINUTE_IN_SECONDS);

	$level = isset($_POST['level']) ? sanitize_key((string) wp_unslash($_POST['level'])) : 'info';
	$message = isset($_POST['message']) ? ctwpml_debug_redact_text(wp_strip_all_tags((string) wp_unslash($_POST['message']))) : '';
	$message = function_exists('mb_substr') ? mb_substr($message, 0, 12000) : substr($message, 0, 12000);
	$timestamp = isset($_POST['timestamp']) ? absint($_POST['timestamp']) : time() * 1000;
	
	if (empty($message)) {
		wp_send_json_error(['message' => 'Mensagem vazia']);
		return;
	}
	
	// Filtrar apenas logs do checkout (prefixo [CTWPML])
	if (strpos($message, '[CTWPML]') === false) {
		wp_send_json_success(['message' => 'Log ignorado (não é do checkout)']);
		return;
	}
	
	$logs = get_transient('ctwpml_debug_logs');
	if (!is_array($logs)) {
		$logs = [];
	}
	
	// Adicionar novo log
	$logs[] = [
		'time' => $timestamp,
		'level' => $level,
		'msg' => $message,
	];
	
	// Limite de 200 entradas (FIFO)
	if (count($logs) > 200) {
		$logs = array_slice($logs, -200);
	}
	
	// Salvar no transient (expira em 1 hora)
	set_transient('ctwpml_debug_logs', $logs, 3600);

	// Persistir também em arquivo isolado para facilitar a coleta de uma tentativa.
	ctwpml_write_isolated_debug_log($level, $message, $timestamp);
	
	wp_send_json_success(['message' => 'Log salvo', 'total' => count($logs)]);
}

// Obter logs (admin -> backend)
add_action('wp_ajax_ctwpml_get_logs', 'ctwpml_ajax_get_logs');

function ctwpml_ajax_get_logs(): void {
	if (!current_user_can('manage_woocommerce') || !check_ajax_referer('ctwpml_debug_log', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Permissão negada']);
		return;
	}
	
	$logs = get_transient('ctwpml_debug_logs');
	if (!is_array($logs)) {
		$logs = [];
	}
	
	// Formatar logs para exibição
	$formatted = [];
	foreach ($logs as $log) {
		$time = isset($log['time']) ? date('H:i:s', intval($log['time'] / 1000)) : '00:00:00';
		$level = strtoupper(isset($log['level']) ? $log['level'] : 'INFO');
		$msg = isset($log['msg']) ? $log['msg'] : '';
		$formatted[] = "[{$time}] [{$level}] {$msg}";
	}
	
	wp_send_json_success([
		'logs' => $formatted,
		'count' => count($logs),
	]);
}

// Limpar logs (admin -> backend)
add_action('wp_ajax_ctwpml_clear_logs', 'ctwpml_ajax_clear_logs');

function ctwpml_ajax_clear_logs(): void {
	if (!current_user_can('manage_woocommerce') || !check_ajax_referer('ctwpml_debug_log', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Permissão negada']);
		return;
	}
	
	delete_transient('ctwpml_debug_logs');

	wp_send_json_success(['message' => 'Logs limpos']);
}

// Obter o arquivo isolado (admin -> backend)
add_action('wp_ajax_ctwpml_get_isolated_log', 'ctwpml_ajax_get_isolated_log');

function ctwpml_ajax_get_isolated_log(): void {
	if (!current_user_can('manage_woocommerce') || !check_ajax_referer('ctwpml_debug_log', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Permissão negada']);
		return;
	}

	$content = ctwpml_read_isolated_debug_log();
	wp_send_json_success([
		'log' => $content,
		'size' => strlen($content),
		'path' => 'wp-content/uploads/checkout-tabs-wp-ml-logs/checkout-flow.log',
	]);
}

// Limpar o arquivo isolado (admin -> backend)
add_action('wp_ajax_ctwpml_clear_isolated_log', 'ctwpml_ajax_clear_isolated_log');

function ctwpml_ajax_clear_isolated_log(): void {
	if (!current_user_can('manage_woocommerce') || !check_ajax_referer('ctwpml_debug_log', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Permissão negada']);
		return;
	}

	if (!ctwpml_clear_isolated_debug_log()) {
		wp_send_json_error(['message' => 'Não foi possível limpar o arquivo isolado']);
		return;
	}

	wp_send_json_success(['message' => 'Arquivo isolado limpo']);
}

// Download manual do arquivo isolado (admin -> navegador)
add_action('admin_post_ctwpml_download_isolated_log', 'ctwpml_download_isolated_log');

function ctwpml_download_isolated_log(): void {
	if (!current_user_can('manage_woocommerce')) {
		wp_die('Permissão negada');
	}
	check_admin_referer('ctwpml_download_isolated_log');

	$content = ctwpml_read_isolated_debug_log();
	nocache_headers();
	header('Content-Type: text/plain; charset=utf-8');
	header('Content-Disposition: attachment; filename="checkout-flow.log"');
	header('Content-Length: ' . strlen($content));
	echo $content;
	exit;
}


