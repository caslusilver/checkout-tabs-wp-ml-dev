<?php
/**
 * Classe para geração de CSS dinâmico baseado em configurações
 * 
 * Gera CSS variables e injeta via wp_add_inline_style
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Style {
    
    /**
     * Nome da option que armazena as configurações de estilo
     */
    const OPTION_NAME = 'ppwoo_style_settings';
    
    /**
     * Valores padrão das configurações
     * 
     * @return array
     */
    public static function get_defaults() {
        return array(
            'text_color' => '#333',
            'header_bg_color' => '#fff',
            'title_font_size' => '0.9em',
            'info_font_size' => '1em',
            'font_weight' => '400',
            'whatsapp_badge_color' => '#25D366',
            'step1_color' => '#ffbe0b',
            'step2_color' => '#38b000',
        );
    }
    
    /**
     * Obtém as configurações de estilo salvas
     * 
     * @return array
     */
    public static function get_settings() {
        $defaults = self::get_defaults();
        $saved = get_option(self::OPTION_NAME, array());
        
        return wp_parse_args($saved, $defaults);
    }
    
    /**
     * Salva as configurações de estilo
     * 
     * @param array $settings Configurações a serem salvas
     * @return bool
     */
    public static function save_settings($settings) {
        $sanitized = self::sanitize_settings($settings);
        return update_option(self::OPTION_NAME, $sanitized);
    }
    
    /**
     * Sanitiza as configurações de estilo
     * 
     * @param array $settings Configurações a serem sanitizadas
     * @return array
     */
    private static function sanitize_settings($settings) {
        $defaults = self::get_defaults();
        $sanitized = array();
        
        foreach ($defaults as $key => $default_value) {
            if (isset($settings[$key])) {
                switch ($key) {
                    case 'text_color':
                    case 'header_bg_color':
                    case 'whatsapp_badge_color':
                    case 'step1_color':
                    case 'step2_color':
                        $sanitized[$key] = sanitize_hex_color($settings[$key]);
                        break;
                    case 'title_font_size':
                    case 'info_font_size':
                        $sanitized[$key] = sanitize_text_field($settings[$key]);
                        break;
                    case 'font_weight':
                        $sanitized[$key] = absint($settings[$key]);
                        break;
                    default:
                        $sanitized[$key] = sanitize_text_field($settings[$key]);
                }
            } else {
                $sanitized[$key] = $default_value;
            }
        }
        
        return $sanitized;
    }
    
    /**
     * Gera CSS dinâmico baseado nas configurações
     * 
     * @return string CSS a ser injetado
     */
    public static function generate_css() {
        $settings = self::get_settings();
        
        PPWOO_Debug::info('Gerando CSS dinâmico', $settings);
        
        $css = ':root {';
        $css .= '--ppwoo-text-color: ' . esc_attr($settings['text_color']) . ';';
        $css .= '--ppwoo-header-bg-color: ' . esc_attr($settings['header_bg_color']) . ';';
        $css .= '--ppwoo-title-font-size: ' . esc_attr($settings['title_font_size']) . ';';
        $css .= '--ppwoo-info-font-size: ' . esc_attr($settings['info_font_size']) . ';';
        $css .= '--ppwoo-font-weight: ' . esc_attr($settings['font_weight']) . ';';
        $css .= '--ppwoo-whatsapp-badge-color: ' . esc_attr($settings['whatsapp_badge_color']) . ';';
        $css .= '--ppwoo-step1-color: ' . esc_attr($settings['step1_color']) . ';';
        $css .= '--ppwoo-step2-color: ' . esc_attr($settings['step2_color']) . ';';
        $css .= '}';
        
        // Aplica as variáveis CSS aos elementos
        $css .= '.painel-empacotamento { color: var(--ppwoo-text-color); }';
        $css .= '.painel-header { background-color: var(--ppwoo-header-bg-color); }';
        $css .= '.painel-header h1 { font-size: var(--ppwoo-title-font-size); }';
        $css .= '.painel-empacotamento h4, .painel-empacotamento p { font-size: var(--ppwoo-info-font-size); font-weight: var(--ppwoo-font-weight); }';
        $css .= '.ppwoo-whatsapp-badge { background-color: var(--ppwoo-whatsapp-badge-color); }';
        $css .= '.workflow-step.step-1 .slide-button { background: var(--ppwoo-step1-color); }';
        $css .= '.workflow-step.step-2 .slide-button { background: var(--ppwoo-step2-color); }';
        
        return $css;
    }
}
