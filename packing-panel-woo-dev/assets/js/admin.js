/**
 * JavaScript para a página de administração do PackPanel
 */
(function($) {
    'use strict';
    
    /**
     * Inicializa color pickers
     */
    function initColorPickers() {
        if ($.fn.wpColorPicker) {
            $('.ppwoo-color-picker').wpColorPicker();
        }
    }
    
    /**
     * Inicializa toggle do Bearer Token
     */
    function initBearerToggle() {
        $('#external_webhook_auth_enabled').off('change.ppwoo').on('change.ppwoo', function() {
            if ($(this).is(':checked')) {
                $('#external_webhook_bearer_row').show();
            } else {
                $('#external_webhook_bearer_row').hide();
            }
        });
    }
    
    /**
     * Inicializa todas as funcionalidades
     */
    function initAll() {
        initColorPickers();
        initBearerToggle();
    }
    
    // Inicializa na carga da página
    $(document).ready(function() {
        initAll();
        
        // Handler para teste de webhook (eventos)
        $(document).on('click', '#ppwoo-test-webhook', function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $result = $('#ppwoo-webhook-test-result');
            
            $button.prop('disabled', true).text('Testando...');
            $result.hide().empty();
            
            $.ajax({
                url: ppwooAdmin.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ppwoo_test_webhook',
                    nonce: ppwooAdmin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        $result
                            .html('<div class="notice notice-success"><p><strong>' + 
                                  response.data.message + '</strong><br>' +
                                  'Status: ' + response.data.status + '<br>' +
                                  'Tempo: ' + response.data.elapsed + '<br>' +
                                  'Resposta: ' + response.data.body_preview + '</p></div>')
                            .show();
                    } else {
                        $result
                            .html('<div class="notice notice-error"><p><strong>' + 
                                  response.data.message + '</strong><br>' +
                                  (response.data.elapsed ? 'Tempo: ' + response.data.elapsed + '<br>' : '') +
                                  (response.data.body_preview ? 'Resposta: ' + response.data.body_preview : '') + '</p></div>')
                            .show();
                    }
                },
                error: function() {
                    $result
                        .html('<div class="notice notice-error"><p><strong>Erro ao testar webhook.</strong></p></div>')
                        .show();
                },
                complete: function() {
                    $button.prop('disabled', false).text('Testar Webhook');
                }
            });
        });
        
        // Handler para teste de webhook externo
        $(document).on('click', '#ppwoo-test-external-webhook', function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $result = $('#ppwoo-external-webhook-test-result');
            
            $button.prop('disabled', true).text('Testando...');
            $result.hide().empty();
            
            $.ajax({
                url: ppwooAdmin.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ppwoo_test_external_webhook',
                    nonce: ppwooAdmin.nonce
                },
                success: function(response) {
                    var html = '<div class="notice notice-' + (response.success ? 'success' : 'error') + '"><p><strong>' + 
                               response.data.message + '</strong><br>' +
                               'Status: ' + response.data.status_code + '<br>' +
                               'Tempo: ' + response.data.elapsed_ms + 'ms<br>';
                    
                    if (response.data.decoded_keys && response.data.decoded_keys.length > 0) {
                        html += 'Chaves JSON: ' + response.data.decoded_keys.join(', ') + '<br>';
                    }
                    
                    html += 'Preview: ' + (response.data.body_preview || 'N/A') + '</p></div>';
                    
                    $result.html(html).show();
                },
                error: function() {
                    $result
                        .html('<div class="notice notice-error"><p><strong>Erro ao testar webhook externo.</strong></p></div>')
                        .show();
                },
                complete: function() {
                    $button.prop('disabled', false).text('Testar Webhook Externo');
                }
            });
        });
        
        // Handler para troca de abas via AJAX
        $(document).on('click', '.nav-tab-wrapper a.nav-tab', function(e) {
            var $link = $(this);
            var href = $link.attr('href');
            
            // Só intercepta se for da página ppwoo-settings
            if (!href || href.indexOf('ppwoo-settings') === -1) {
                return;
            }
            
            e.preventDefault();
            
            var tab = 'style';
            
            // Extrai tab da URL
            if (href.indexOf('tab=') !== -1) {
                tab = href.split('tab=')[1].split('&')[0];
            }
            
            // Se já está ativa, não faz nada
            if ($link.hasClass('nav-tab-active')) {
                return;
            }
            
            // Desabilita link temporariamente
            $link.addClass('nav-tab-loading');
            
            // Faz requisição AJAX
            $.ajax({
                url: ppwooAdmin.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ppwoo_load_admin_tab',
                    tab: tab,
                    nonce: ppwooAdmin.nonce
                },
                success: function(response) {
                    if (response.success && response.data.html) {
                        // Atualiza conteúdo
                        $('.ppwoo-admin-content').html(response.data.html);
                        
                        // Atualiza abas ativas
                        $('.nav-tab-wrapper a').removeClass('nav-tab-active');
                        $link.addClass('nav-tab-active');
                        
                        // Re-inicializa recursos
                        initAll();
                    } else {
                        // Em caso de erro, recarrega a página normalmente
                        window.location.href = href;
                    }
                },
                error: function() {
                    // Em caso de erro, recarrega a página normalmente
                    window.location.href = href;
                },
                complete: function() {
                    $link.removeClass('nav-tab-loading');
                }
            });
        });
    });
})(jQuery);
