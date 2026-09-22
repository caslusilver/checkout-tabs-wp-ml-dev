<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Local isolado para diagnosticar o checkout sem misturar os eventos do site.
 * O arquivo fica fora do diretório do plugin para sobreviver a atualizações.
 */
function ctwpml_debug_log_directory(): string {
	$uploads = wp_upload_dir();
	$basedir = isset($uploads['basedir']) ? (string) $uploads['basedir'] : '';
	if ($basedir === '') {
		return '';
	}
	return rtrim($basedir, '/\\') . '/checkout-tabs-wp-ml-logs';
}

function ctwpml_debug_log_path(): string {
	$directory = ctwpml_debug_log_directory();
	return $directory === '' ? '' : $directory . '/checkout-flow.log';
}

function ctwpml_prepare_debug_log_directory(): bool {
	$directory = ctwpml_debug_log_directory();
	if ($directory === '' || !wp_mkdir_p($directory)) {
		return false;
	}

	$index_file = $directory . '/index.php';
	if (!file_exists($index_file)) {
		@file_put_contents($index_file, "<?php\n// Silence is golden.\n");
	}

	$htaccess = $directory . '/.htaccess';
	if (!file_exists($htaccess)) {
		@file_put_contents($htaccess, "Order Allow,Deny\nDeny from all\n");
	}

	$web_config = $directory . '/web.config';
	if (!file_exists($web_config)) {
		@file_put_contents(
			$web_config,
			"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" .
			"<configuration><system.webServer><authorization><remove users=\"*\" roles=\"\" verbs=\"\" /><add accessType=\"Deny\" users=\"*\" /></authorization></system.webServer></configuration>\n"
		);
	}

	return is_dir($directory) && is_writable($directory);
}

/**
 * Remove dados pessoais conhecidos antes de persistir qualquer linha.
 */
function ctwpml_debug_redact_text(string $text): string {
	$text = preg_replace('/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/i', '[redacted-email]', $text) ?: $text;
	$text = preg_replace('/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/', '[redacted-cpf]', $text) ?: $text;
	$text = preg_replace(
		'/((?:\b)(?:phone|phoneFull|phone_full|whatsapp|cpf|billing_email|billing_phone|billing_cellphone)(?:\b)\s*[:=]\s*)("[^"]*"|\'[^\']*\'|[^,\s}]+)/i',
		'$1[redacted]',
		$text
	) ?: $text;
	return trim(str_replace("\0", '', $text));
}

function ctwpml_write_isolated_debug_log(string $level, string $message, int $timestamp = 0): bool {
	if (function_exists('checkout_tabs_wp_ml_is_debug_enabled') && !checkout_tabs_wp_ml_is_debug_enabled()) {
		return false;
	}

	if (!ctwpml_prepare_debug_log_directory()) {
		return false;
	}

	$path = ctwpml_debug_log_path();
	if ($path === '') {
		return false;
	}
	if (file_exists($path) && filesize($path) > 2097152) {
		$existing = @file_get_contents($path);
		$tail = is_string($existing) ? substr($existing, -1048576) : '';
		@file_put_contents($path, $tail, LOCK_EX);
	}

	$allowed_levels = ['debug', 'info', 'warning', 'error'];
	$level = sanitize_key($level);
	if (!in_array($level, $allowed_levels, true)) {
		$level = 'info';
	}

	$message = ctwpml_debug_redact_text(wp_strip_all_tags($message));
	if ($message === '') {
		return false;
	}
	$message = substr($message, 0, 12000);

	$time = $timestamp > 100000000000 ? (int) floor($timestamp / 1000) : ($timestamp > 0 ? $timestamp : time());
	$formatted_time = function_exists('wp_date') ? wp_date('Y-m-d H:i:s', $time) : date('Y-m-d H:i:s', $time);
	$line = '[' . $formatted_time . '] [' . strtoupper($level) . '] ' . $message . PHP_EOL;

	return false !== @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
}

function ctwpml_read_isolated_debug_log(): string {
	$path = ctwpml_debug_log_path();
	if ($path === '') {
		return '';
	}
	if (!file_exists($path) || !is_readable($path)) {
		return '';
	}
	$content = @file_get_contents($path);
	return is_string($content) ? $content : '';
}

function ctwpml_clear_isolated_debug_log(): bool {
	$path = ctwpml_debug_log_path();
	if ($path === '') {
		return false;
	}
	if (!file_exists($path)) {
		return true;
	}
	return false !== @file_put_contents($path, '', LOCK_EX);
}
