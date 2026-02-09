<?php
/**
 * Classe de debug encapsulada para o PackPanel
 * 
 * Fornece métodos padronizados para logging com prefixo único
 * e respeita o estado de debug do plugin
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Debug {
    
    /**
     * Prefixo único para todos os logs
     */
    const PREFIX = 'PPWOO:';
    
    /**
     * Log de informação
     * 
     * @param string $message Mensagem a ser logada
     * @param mixed $data Dados adicionais (opcional)
     */
    public static function info($message, $data = null) {
        if (!PPWOO_Config::is_debug()) {
            return;
        }
        
        $log_message = self::PREFIX . ' [INFO] ' . $message;
        
        if ($data !== null) {
            $log_message .= ' | Data: ' . print_r($data, true);
        }
        
        error_log($log_message);
    }
    
    /**
     * Log de aviso
     * 
     * @param string $message Mensagem a ser logada
     * @param mixed $data Dados adicionais (opcional)
     */
    public static function warn($message, $data = null) {
        if (!PPWOO_Config::is_debug()) {
            return;
        }
        
        $log_message = self::PREFIX . ' [WARN] ' . $message;
        
        if ($data !== null) {
            $log_message .= ' | Data: ' . print_r($data, true);
        }
        
        error_log($log_message);
    }
    
    /**
     * Log de erro
     * 
     * @param string $message Mensagem a ser logada
     * @param mixed $data Dados adicionais (opcional)
     */
    public static function error($message, $data = null) {
        if (!PPWOO_Config::is_debug()) {
            return;
        }
        
        $log_message = self::PREFIX . ' [ERROR] ' . $message;
        
        if ($data !== null) {
            $log_message .= ' | Data: ' . print_r($data, true);
        }
        
        error_log($log_message);
    }
    
    /**
     * Log com tempo de execução
     * 
     * @param string $label Label para identificar o ponto de medição
     * @param float $start_time Timestamp de início (opcional, se não fornecido usa microtime atual)
     * @return float Timestamp atual para uso em próxima chamada
     */
    public static function timed($label, $start_time = null) {
        if (!PPWOO_Config::is_debug()) {
            return microtime(true);
        }
        
        $current_time = microtime(true);
        
        if ($start_time !== null) {
            $elapsed = ($current_time - $start_time) * 1000; // em milissegundos
            $log_message = self::PREFIX . ' [TIMED] ' . $label . ' | Elapsed: ' . number_format($elapsed, 2) . 'ms';
            error_log($log_message);
        }
        
        return $current_time;
    }
}
