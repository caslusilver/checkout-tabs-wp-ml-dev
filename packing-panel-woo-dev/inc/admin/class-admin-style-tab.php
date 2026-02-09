<?php
/**
 * Classe para renderizar e processar a aba Estilo
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Admin_Style_Tab {
    
    /**
     * Renderiza o formulário da aba Estilo
     */
    public static function render() {
        // Processa o formulário se foi submetido
        if (isset($_POST['ppwoo_save_style']) && check_admin_referer('ppwoo_save_style', 'ppwoo_style_nonce')) {
            self::save_settings();
        }
        
        $settings = PPWOO_Style::get_settings();
        
        ?>
        <form method="post" action="">
            <?php wp_nonce_field('ppwoo_save_style', 'ppwoo_style_nonce'); ?>
            
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="text_color"><?php esc_html_e('Cor do Texto', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="text_color" 
                               name="ppwoo_style[text_color]" 
                               value="<?php echo esc_attr($settings['text_color']); ?>" 
                               class="ppwoo-color-picker" 
                               data-default-color="<?php echo esc_attr($settings['text_color']); ?>" />
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="header_bg_color"><?php esc_html_e('Cor do Fundo do Cabeçalho', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="header_bg_color" 
                               name="ppwoo_style[header_bg_color]" 
                               value="<?php echo esc_attr($settings['header_bg_color']); ?>" 
                               class="ppwoo-color-picker" 
                               data-default-color="<?php echo esc_attr($settings['header_bg_color']); ?>" />
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="title_font_size"><?php esc_html_e('Tamanho da Fonte do Título', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="title_font_size" 
                               name="ppwoo_style[title_font_size]" 
                               value="<?php echo esc_attr($settings['title_font_size']); ?>" 
                               placeholder="0.9em" />
                        <p class="description"><?php esc_html_e('Ex: 0.9em, 1.2em, 18px', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="info_font_size"><?php esc_html_e('Tamanho da Fonte das Informações', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="info_font_size" 
                               name="ppwoo_style[info_font_size]" 
                               value="<?php echo esc_attr($settings['info_font_size']); ?>" 
                               placeholder="1em" />
                        <p class="description"><?php esc_html_e('Ex: 1em, 14px', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="font_weight"><?php esc_html_e('Espessura da Fonte', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="number" 
                               id="font_weight" 
                               name="ppwoo_style[font_weight]" 
                               value="<?php echo esc_attr($settings['font_weight']); ?>" 
                               min="100" 
                               max="900" 
                               step="100" />
                        <p class="description"><?php esc_html_e('100 (fino) a 900 (negrito)', 'painel-empacotamento'); ?></p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="whatsapp_badge_color"><?php esc_html_e('Cor da Tag WhatsApp', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="whatsapp_badge_color" 
                               name="ppwoo_style[whatsapp_badge_color]" 
                               value="<?php echo esc_attr($settings['whatsapp_badge_color']); ?>" 
                               class="ppwoo-color-picker" 
                               data-default-color="<?php echo esc_attr($settings['whatsapp_badge_color']); ?>" />
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="step1_color"><?php esc_html_e('Cor da Etapa 1', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="step1_color" 
                               name="ppwoo_style[step1_color]" 
                               value="<?php echo esc_attr($settings['step1_color']); ?>" 
                               class="ppwoo-color-picker" 
                               data-default-color="<?php echo esc_attr($settings['step1_color']); ?>" />
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">
                        <label for="step2_color"><?php esc_html_e('Cor da Etapa 2', 'painel-empacotamento'); ?></label>
                    </th>
                    <td>
                        <input type="text" 
                               id="step2_color" 
                               name="ppwoo_style[step2_color]" 
                               value="<?php echo esc_attr($settings['step2_color']); ?>" 
                               class="ppwoo-color-picker" 
                               data-default-color="<?php echo esc_attr($settings['step2_color']); ?>" />
                    </td>
                </tr>
            </table>
            
            <?php submit_button(__('Salvar Configurações', 'painel-empacotamento')); ?>
        </form>
        <?php
    }
    
    /**
     * Salva as configurações de estilo
     */
    private static function save_settings() {
        if (!isset($_POST['ppwoo_style']) || !is_array($_POST['ppwoo_style'])) {
            return;
        }
        
        $settings = $_POST['ppwoo_style'];
        $result = PPWOO_Style::save_settings($settings);
        
        PPWOO_Debug::info('Configurações de estilo salvas', $settings);
        
        if ($result) {
            add_settings_error(
                'ppwoo_style',
                'ppwoo_style_saved',
                __('Configurações salvas com sucesso!', 'painel-empacotamento'),
                'success'
            );
        } else {
            add_settings_error(
                'ppwoo_style',
                'ppwoo_style_error',
                __('Erro ao salvar configurações.', 'painel-empacotamento'),
                'error'
            );
        }
        
        settings_errors('ppwoo_style');
    }
}
