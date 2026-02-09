jQuery(function($) {
    'use strict';

    let lastScroll = 0;

    /**
     * Exibe notificação elegante do WordPress (similar ao padrão admin)
     */
    function ppwooNotice(message, type) {
        type = type || 'success'; // 'success' ou 'error'
        
        const noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
        const notice = $('<div class="notice ' + noticeClass + ' is-dismissible ppwoo-refresh-notice" style="margin: 5px 0 2px; padding: 1px 12px;"><p>' + 
                       message + 
                       '</p><button type="button" class="notice-dismiss"><span class="screen-reader-text">Dispensar este aviso.</span></button></div>');

        // Remove notificações anteriores
        $('.ppwoo-refresh-notice').remove();

        // Insere a notificação após o título da página ou no topo da lista de plugins
        const target = $('.wp-header-end').length ? $('.wp-header-end') : $('.wrap h1').first();
        if (target.length) {
            target.after(notice);
        } else {
            $('.wrap').first().prepend(notice);
        }

        // Auto-dismiss após 5 segundos para sucesso, 10 para erro
        const dismissTime = type === 'success' ? 5000 : 10000;
        setTimeout(function() {
            notice.fadeOut(300, function() {
                $(this).remove();
            });
        }, dismissTime);

        // Handler para botão de dismiss
        notice.on('click', '.notice-dismiss', function() {
            notice.fadeOut(300, function() {
                $(this).remove();
            });
        });

        // Não faz scroll automático - mantém posição atual
    }

    /**
     * Handler do clique no botão de refresh cache
     */
    $(document).on('click', '.gu-refresh-cache-btn', function(e) {
        e.preventDefault();

        const btn = $(this);
        const nonce = btn.data('nonce');
        const spinner = btn.find('.spinner');
        const refreshText = btn.find('.gu-refresh-text');

        // Salva posição do scroll
        lastScroll = $(window).scrollTop();

        // Desabilita botão e mostra spinner
        btn.prop('disabled', true).addClass('disabled');
        spinner.css('visibility', 'visible').addClass('is-active');
        refreshText.text('Atualizando...');

        // Faz requisição AJAX
        $.ajax({
            url: GURefreshCache.ajax_url,
            type: 'POST',
            data: {
                action: 'gu_refresh_cache',
                _ajax_nonce: nonce
            },
            success: function(response) {
                if (response.success) {
                    // Mostra ícone de concluído temporariamente
                    var $icon = btn.find('.dashicons');
                    var originalClass = $icon.attr('class');
                    
                    $icon.removeClass('dashicons-update')
                         .addClass('dashicons-yes')
                         .css('color', '#46b450');
                    
                    // Reverte após 3 segundos
                    setTimeout(function() {
                        $icon.attr('class', originalClass)
                             .css('color', '');
                    }, 3000);
                    
                    ppwooNotice(response.data || 'Cache atualizado com sucesso!', 'success');
                } else {
                    ppwooNotice(response.data || 'Erro ao atualizar cache.', 'error');
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Erro ao atualizar cache.';
                
                if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMessage = xhr.responseJSON.data;
                } else if (xhr.status === 0) {
                    errorMessage = 'Erro de conexão. Verifique sua internet.';
                } else if (xhr.status === 403) {
                    errorMessage = 'Sem permissão para executar esta ação.';
                }

                ppwooNotice(errorMessage, 'error');
            },
            complete: function() {
                // Restaura botão
                btn.prop('disabled', false).removeClass('disabled');
                spinner.css('visibility', 'hidden').removeClass('is-active');
                refreshText.text('Atualizar Cache');

                // Restaura posição do scroll após um pequeno delay
                setTimeout(function() {
                    $(window).scrollTop(lastScroll);
                }, 100);
            }
        });
    });
});
