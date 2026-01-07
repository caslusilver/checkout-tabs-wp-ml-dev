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
	$level = isset($_POST['level']) ? sanitize_text_field((string) $_POST['level']) : 'info';
	$message = isset($_POST['message']) ? sanitize_text_field((string) $_POST['message']) : '';
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
	
	wp_send_json_success(['message' => 'Log salvo', 'total' => count($logs)]);
}

// Obter logs (admin -> backend)
add_action('wp_ajax_ctwpml_get_logs', 'ctwpml_ajax_get_logs');

function ctwpml_ajax_get_logs(): void {
	if (!current_user_can('manage_woocommerce')) {
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
	if (!current_user_can('manage_woocommerce')) {
		wp_send_json_error(['message' => 'Permissão negada']);
		return;
	}
	
	delete_transient('ctwpml_debug_logs');
	
	wp_send_json_success(['message' => 'Logs limpos']);
}


