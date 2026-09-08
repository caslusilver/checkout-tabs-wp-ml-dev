/**
 * Scripts do Painel de Empacotamento
 * JavaScript para funcionalidades do painel administrativo
 */

(function($) {
    'use strict';

    // Variáveis globais do painel
    var packingPanel = $('.painel-empacotamento');
    
    if (packingPanel.length === 0) {
        return;
    }

    // Inicializa debug se ativo
    var debugEnabled = typeof PPWOO !== 'undefined' && PPWOO.debug_enabled;
    if (debugEnabled) {
        window.ppDebug = {
            log: function(msg) {
                if (!debugEnabled) return;
                var ta = $('#pp-debug-log');
                if (ta.length) {
                    var timestamp = new Date().toLocaleTimeString('pt-BR');
                    ta.val(ta.val() + '[' + timestamp + '] ' + msg + '\n');
                    ta.scrollTop(ta[0].scrollHeight);
                }
            }
        };
        ppDebug.log('Painel de Empacotamento: Debug ON');
        
        $(document).on('click', '#pp-debug-close', function() {
            $('#pp-debug-panel').hide();
        });
        
        $(document).on('click', '#pp-debug-copy', function() {
            var logText = $('#pp-debug-log').val();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(logText).then(function() {
                    ppDebug.log('Log copiado.');
                    var $btn = $(this);
                    var originalText = $btn.text();
                    $btn.text(PPWOO.copy_success || 'Copiado!').prop('disabled', true);
                    setTimeout(function() {
                        $btn.text(originalText).prop('disabled', false);
                    }, 1500);
                }.bind(this));
            }
        });
    } else {
        window.ppDebug = { log: function() {} };
        $('#pp-debug-panel').hide();
    }

    // Variáveis AJAX
    var ajaxUrl = typeof PPWOO !== 'undefined' ? PPWOO.ajax_url : '';
    var nonce = typeof PPWOO !== 'undefined' ? PPWOO.nonce : '';
    var ajaxAction = typeof PPWOO !== 'undefined' ? PPWOO.ajax_action : 'packing_panel_webhook';

    ppDebug.log('Painel encontrado. Internal AJAX Action: ' + ajaxAction);

    // --- Tab Switching ---
    packingPanel.on('click', '.painel-tabs .tab-button', function() {
        var targetTabId = $(this).data('tab');
        ppDebug.log('Clicou na aba: ' + targetTabId);

        packingPanel.find('.painel-tabs .tab-button').removeClass('active');
        $(this).addClass('active');

        packingPanel.find('.tab-content').removeClass('active');
        $('#tab-' + targetTabId).addClass('active');

        if (targetTabId === 'correios') {
            var $correiosTab = $('#tab-correios');
            var $slides = $correiosTab.find('.pedidos-carousel .pedido-container');
            $slides.removeClass('current');
            if ($slides.length > 0) {
                $slides.filter(':first').addClass('current');
            }
            if ($slides.length <= 1) {
                $correiosTab.find('.carousel-navigation').hide();
            } else {
                $correiosTab.find('.carousel-navigation').show();
            }
        }
    });

    // --- Set initial active tab ---
    var hasMotoboyOrders = packingPanel.find('#tab-motoboy .motoboy-order').length > 0;
    var hasCorreiosOrders = packingPanel.find('#tab-correios .pedido-container').length > 0;
    var hasPagamentosOrders = packingPanel.find('#tab-pagamentos .pedido-container').length > 0;

    if (hasPagamentosOrders) {
        packingPanel.find('.painel-tabs .tab-button[data-tab="pagamentos"]').trigger('click');
    } else if (hasMotoboyOrders) {
        packingPanel.find('.painel-tabs .tab-button[data-tab="motoboy"]').trigger('click');
    } else if (hasCorreiosOrders) {
        packingPanel.find('.painel-tabs .tab-button[data-tab="correios"]').trigger('click');
    } else {
        packingPanel.find('.painel-tabs .tab-button[data-tab="motoboy"]').addClass('active');
        $('#tab-motoboy').addClass('active');
        packingPanel.find('.sem-pedidos-global').show().text('Nenhum pedido pendente para empacotamento.');
    }

    // --- Copy Buttons Helper ---
    function copyTextToClipboard(text, button) {
        ppDebug.log("Tentando copiar: '" + text + "'");
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                ppDebug.log('Texto copiado.');
                button.addClass('copied');
                var originalContent = button.html();
                button.text(PPWOO.copy_success || 'Copiado!');
                setTimeout(function() {
                    button.removeClass('copied').html(originalContent);
                }, 1500);
            }).catch(function(err) {
                alert(PPWOO.copy_error || 'Falha ao copiar.');
            });
        } else {
            var textarea = $('<textarea>').val(text).appendTo('body').select();
            document.execCommand('copy');
            textarea.remove();
            button.addClass('copied');
            var originalContent = button.html();
            button.text(PPWOO.copy_success || 'Copiado!');
            setTimeout(function() {
                button.removeClass('copied').html(originalContent);
            }, 1500);
        }
    }

    // --- Copy Event Handlers ---
    function getTextToCopy(button) {
        var textToCopy = '';
        var containerNodes = button.parent()[0].childNodes;
        for (var i = 0; i < containerNodes.length; i++) {
            var node = containerNodes[i];
            if (node.nodeType === 1 && node === button[0]) break;
            textToCopy += (node.nodeType === 3) ? node.nodeValue : (node.textContent || node.innerText || '');
        }
        return textToCopy.trim().replace(/\s{2,}/g, ' ');
    }

    packingPanel.on('click', '#tab-motoboy .copy-address, #tab-motoboy .copy-name, #tab-motoboy .copy-whatsapp', function() {
        copyTextToClipboard(getTextToCopy($(this)), $(this));
    });

    // --- Motoboy Workflow ---
    function showLoadingMotoboy(orderItem) {
        orderItem.find('.workflow-area .workflow-slides').hide();
        orderItem.find('.workflow-area .loading-indicator').show();
    }

    function hideLoadingMotoboy(orderItem) {
        orderItem.find('.workflow-area .loading-indicator').hide();
        orderItem.find('.workflow-area .workflow-slides').show();
    }

    function transitionWorkflow(orderItem, step) {
        var workflowSlides = orderItem.find('.workflow-area .workflow-slides');
        ppDebug.log('Transicionando workflow para ' + step + ' para pedido ' + orderItem.data('order-id'));
        if (step === 'step2') {
            workflowSlides.css('transform', 'translateX(-50%)');
            orderItem.data('workflow-step', 'step2');
        } else {
            workflowSlides.css('transform', 'translateX(0)');
            orderItem.data('workflow-step', 'step1');
        }
    }

    // --- 'Aceitar Pedido' Click (Motoboy) ---
    packingPanel.on('click', '#tab-motoboy .btn-accept-order', function() {
        var button = $(this);
        var orderItem = button.closest('.motoboy-order');
        var orderId = orderItem.data('order-id');

        ppDebug.log("Clicou 'Aceitar Pedido' para pedido " + orderId);
        showLoadingMotoboy(orderItem);

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: ajaxAction,
                nonce: nonce,
                order_id: orderId,
                webhook_type: 'accepted'
            },
            success: function(response) {
                if (response.success) {
                    ppDebug.log('Pedido ' + orderId + ' aceito. Transicionando para step2.');
                    transitionWorkflow(orderItem, 'step2');
                } else {
                    alert('Erro ao aceitar pedido: ' + (response.data || 'Erro desconhecido'));
                }
            },
            error: function(jqXHR) {
                ppDebug.log('Erro AJAX ao aceitar pedido: ' + jqXHR.responseText);
                alert('Erro na requisição AJAX para aceitar pedido.');
            },
            complete: function() {
                hideLoadingMotoboy(orderItem);
            }
        });
    });

    // --- 'Concluir Envio' Click (Motoboy) ---
    packingPanel.on('click', '#tab-motoboy .btn-conclude-shipment', function() {
        var button = $(this);
        var orderItem = button.closest('.motoboy-order');
        var orderId = orderItem.data('order-id');

        ppDebug.log("Clicou 'Concluir Envio' para pedido Motoboy " + orderId);

        var trackingLink = orderItem.find('.tracking-link').val();
        var deliveryDeadline = orderItem.find('.delivery-deadline').val();
        var shippingCost = orderItem.find('.shipping-cost').val();
        var finalizationCode = orderItem.find('.finalization-code').val();
        var motoboyWhatsappRaw = orderItem.find('.motoboy-whatsapp').val();
        var motoboyWhatsapp = motoboyWhatsappRaw ? motoboyWhatsappRaw.replace(/\D/g, '') : '';

        showLoadingMotoboy(orderItem);

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: ajaxAction,
                nonce: nonce,
                order_id: orderId,
                webhook_type: 'shipped',
                tab_context: 'motoboy',
                tracking_data: {
                    link: trackingLink,
                    deadline: deliveryDeadline,
                    cost: shippingCost,
                    finalization_code: finalizationCode,
                    motoboy_whatsapp: motoboyWhatsapp
                }
            },
            success: function(response) {
                if (response.success) {
                    ppDebug.log('Envio concluído (Motoboy) para pedido ' + orderId + '. Removendo item.');
                    orderItem.addClass('removing').on('transitionend', function() {
                        $(this).remove();
                        updateCounts();
                    });
                } else {
                    alert('Erro ao concluir envio: ' + (response.data || 'Erro desconhecido'));
                    hideLoadingMotoboy(orderItem);
                }
            },
            error: function(jqXHR) {
                ppDebug.log('Erro AJAX ao concluir envio (Motoboy): ' + jqXHR.responseText);
                alert('Erro na requisição AJAX para concluir envio.');
                hideLoadingMotoboy(orderItem);
            }
        });
    });

    // --- Carousels e conclusão de pedidos Correios ---
    function setCarouselSlide($tab, carouselSelector, index) {
        var $carouselContainer = $tab.find(carouselSelector);
        var $slides = $carouselContainer.find('.pedido-container');
        var $wrapper = $tab.find(carouselSelector === '.pedidos-carousel' ? '.pedidos-carousel-wrapper' : '.pagamentos-carousel-wrapper');
        var totalSlides = $slides.length;

        if (totalSlides === 0) {
            $wrapper.hide();
            $tab.find('.sem-pedidos').show();
            return;
        }

        $wrapper.show();
        $tab.find('.sem-pedidos').hide();
        var currentIndex = Math.max(0, Math.min(typeof index === 'number' ? index : 0, totalSlides - 1));
        $slides.removeClass('current').eq(currentIndex).addClass('current');

        if (totalSlides <= 1) {
            $tab.find('.carousel-navigation').hide();
        } else {
            $tab.find('.carousel-navigation').show();
            $tab.find('.nav-prev').prop('disabled', currentIndex === 0);
            $tab.find('.nav-next').prop('disabled', currentIndex === totalSlides - 1);
        }
    }

    function getCurrentCarouselIndex($tab, carouselSelector) {
        var index = $tab.find(carouselSelector + ' .pedido-container.current').index();
        return index >= 0 ? index : 0;
    }

    function refreshCorreiosCarousel(preferredOrderId) {
        var $tab = $('#tab-correios');
        var $slides = $tab.find('.pedidos-carousel .pedido-container');
        var index = preferredOrderId ? $slides.filter(function() {
            return String($(this).data('order-id')) === String(preferredOrderId);
        }).index() : getCurrentCarouselIndex($tab, '.pedidos-carousel');

        setCarouselSlide($tab, '.pedidos-carousel', index >= 0 ? index : 0);
    }

    packingPanel.on('click', '#tab-correios .nav-next', function() {
        var $tab = $(this).closest('#tab-correios');
        setCarouselSlide($tab, '.pedidos-carousel', getCurrentCarouselIndex($tab, '.pedidos-carousel') + 1);
    });

    packingPanel.on('click', '#tab-correios .nav-prev', function() {
        var $tab = $(this).closest('#tab-correios');
        setCarouselSlide($tab, '.pedidos-carousel', getCurrentCarouselIndex($tab, '.pedidos-carousel') - 1);
    });

    packingPanel.on('click', '#tab-correios .btn-conclude-shipment-correios', function() {
        var button = $(this);
        var orderItem = button.closest('.pedido-container');
        var orderId = orderItem.data('order-id');

        ppDebug.log("Clicou 'Concluir Envio' (Correios) para pedido " + orderId);
        var $actionArea = button.closest('.order-actions');
        $actionArea.find('.btn-conclude-shipment-correios').hide();
        $actionArea.find('.loading-indicator').show();

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: ajaxAction,
                nonce: nonce,
                order_id: orderId,
                webhook_type: 'shipped',
                tab_context: 'correios',
                tracking_data: { link: '', deadline: '', cost: '', finalization_code: '' }
            },
            success: function(response) {
                if (response.success) {
                    ppDebug.log('Envio concluído (Correios) para pedido ' + orderId + '. Removendo item.');
                    orderItem.addClass('removing').on('transitionend', function() {
                        $(this).remove();
                        updateCounts();
                        refreshCorreiosCarousel();
                    });
                } else {
                    alert('Erro ao concluir envio: ' + (response.data || 'Erro desconhecido'));
                    $actionArea.find('.loading-indicator').hide();
                    $actionArea.find('.btn-conclude-shipment-correios').show();
                }
            },
            error: function(jqXHR) {
                ppDebug.log('Erro AJAX ao concluir envio (Correios): ' + jqXHR.responseText);
                alert('Erro na requisição AJAX para concluir envio.');
                $actionArea.find('.loading-indicator').hide();
                $actionArea.find('.btn-conclude-shipment-correios').show();
            }
        });
    });

    refreshCorreiosCarousel();

    // --- Function to update counts ---
    function updateCounts() {
        var totalMotoboy = $('#tab-motoboy .motoboy-order').length;
        var totalCorreios = $('#tab-correios .pedido-container').length;
        var totalPagamentos = $('#tab-pagamentos .pedido-container').length;
        var totalPending = totalMotoboy + totalCorreios + totalPagamentos;

        $('.status-info .pendentes').text(totalPending + ' pedidos pendentes');
        $('.tab-button[data-tab="motoboy"]').text('Motoboy (' + totalMotoboy + ')');
        $('.tab-button[data-tab="correios"]').text('Correios (' + totalCorreios + ')');
        $('.tab-button[data-tab="pagamentos"]').text('Pagamentos Pendentes (' + totalPagamentos + ')');

        if (totalPending === 0) {
            $('.sem-pedidos-global').show().text('Nenhum pedido pendente para empacotamento.');
            $('.sem-pedidos').hide();
        } else {
            $('.sem-pedidos-global').hide();
            if (totalMotoboy === 0) {
                $('#tab-motoboy .sem-pedidos').show();
            } else {
                $('#tab-motoboy .sem-pedidos').hide();
            }
            if (totalCorreios === 0) {
                $('#tab-correios .sem-pedidos').show();
            } else {
                $('#tab-correios .sem-pedidos').hide();
            }
        }
    }
    updateCounts();

    // --- Pagamentos Pendentes (carousel) ---
    function handlePaymentAction(button, actionType) {
        var $button = $(button);
        var $card = $button.closest('.pedido-container');
        var orderId = $card.data('order-id');
        var $actionArea = $card.find('.order-actions');

        $actionArea.find('button').prop('disabled', true);
        $actionArea.find('.loading-indicator').show();

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            dataType: 'json',
            data: {
                action: ajaxAction,
                nonce: nonce,
                order_id: orderId,
                webhook_type: actionType
            },
            success: function(response) {
                if (response.success) {
                    $card.addClass('removing').on('transitionend', function() {
                        $(this).remove();
                        updateCounts();
                        refreshPagamentosCarousel();
                    });
                } else {
                    alert('Erro ao atualizar pagamento: ' + (response.data || 'Erro desconhecido'));
                    $actionArea.find('.loading-indicator').hide();
                    $actionArea.find('button').prop('disabled', false);
                }
            },
            error: function(jqXHR) {
                ppDebug.log('Erro AJAX ao atualizar pagamento: ' + jqXHR.responseText);
                alert('Erro na requisição AJAX para atualizar pagamento.');
                $actionArea.find('.loading-indicator').hide();
                $actionArea.find('button').prop('disabled', false);
            }
        });
    }

    packingPanel.on('click', '#tab-pagamentos .ppwoo-btn-confirm-payment', function() {
        handlePaymentAction(this, 'payment_confirm');
    });

    packingPanel.on('click', '#tab-pagamentos .ppwoo-btn-deny-payment', function() {
        handlePaymentAction(this, 'payment_deny');
    });

    function refreshPagamentosCarousel(preferredOrderId) {
        var $tab = $('#tab-pagamentos');
        var $slides = $tab.find('.pagamentos-carousel .pedido-container');
        var index = preferredOrderId ? $slides.filter(function() {
            return String($(this).data('order-id')) === String(preferredOrderId);
        }).index() : 0;

        setCarouselSlide($tab, '.pagamentos-carousel', index >= 0 ? index : 0);
    }

    packingPanel.on('click', '#tab-pagamentos .nav-next', function() {
        var $tab = $(this).closest('#tab-pagamentos');
        setCarouselSlide($tab, '.pagamentos-carousel', getCurrentCarouselIndex($tab, '.pagamentos-carousel') + 1);
    });

    packingPanel.on('click', '#tab-pagamentos .nav-prev', function() {
        var $tab = $(this).closest('#tab-pagamentos');
        setCarouselSlide($tab, '.pagamentos-carousel', getCurrentCarouselIndex($tab, '.pagamentos-carousel') - 1);
    });

    refreshPagamentosCarousel();

    // --- Atualização automática do painel ---
    var refreshInFlight = false;
    var refreshInterval = typeof PPWOO !== 'undefined' && parseInt(PPWOO.refresh_interval, 10) > 0
        ? parseInt(PPWOO.refresh_interval, 10)
        : 15000;

    function setRefreshStatus(message, isError) {
        var $status = packingPanel.find('.ppwoo-refresh-status');
        $status.text(message || '').toggleClass('is-error', !!isError);
    }

    function capturePanelState() {
        var $activeTab = packingPanel.find('.tab-content.active');
        var $correiosCurrent = packingPanel.find('#tab-correios .pedido-container.current');
        var $pagamentosCurrent = packingPanel.find('#tab-pagamentos .pedido-container.current');

        return {
            activeTab: $activeTab.attr('id') || 'tab-motoboy',
            correiosOrderId: $correiosCurrent.length ? $correiosCurrent.data('order-id') : null,
            pagamentosOrderId: $pagamentosCurrent.length ? $pagamentosCurrent.data('order-id') : null
        };
    }

    function restorePanelMarkup(html, previousState) {
        var $responseRoot = $('<div>').html(html);
        var $newPanel = $responseRoot.find('.painel-empacotamento').first();
        if (!$newPanel.length) {
            return false;
        }

        [
            '.painel-tabs',
            '#tab-motoboy',
            '#tab-correios',
            '#tab-pagamentos',
            '.sem-pedidos-global'
        ].forEach(function(selector) {
            var $current = packingPanel.find(selector).first();
            var $replacement = $newPanel.find(selector).first();
            if ($current.length && $replacement.length) {
                $current.replaceWith($replacement);
            }
        });

        var $activeButton = packingPanel.find('.painel-tabs .tab-button[data-tab="' + (previousState.activeTab || 'tab-motoboy').replace(/^tab-/, '') + '"]');
        if ($activeButton.length) {
            $activeButton.trigger('click');
        }

        refreshCorreiosCarousel(previousState.correiosOrderId);
        refreshPagamentosCarousel(previousState.pagamentosOrderId);
        updateCounts();
        return true;
    }

    function refreshPanel(force) {
        if (refreshInFlight || (!force && document.hidden)) {
            return;
        }

        refreshInFlight = true;
        var $button = packingPanel.find('.ppwoo-refresh-button');
        $button.addClass('is-refreshing').prop('disabled', true);
        setRefreshStatus((typeof PPWOO !== 'undefined' && PPWOO.refreshing_text) || 'Atualizando...', false);

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            dataType: 'json',
            cache: false,
            data: {
                action: 'ppwoo_refresh_panel',
                nonce: nonce
            },
            success: function(response) {
                var previousState = capturePanelState();
                var html = response && response.success && response.data ? response.data.html : '';

                if (html && restorePanelMarkup(html, previousState)) {
                    setRefreshStatus((typeof PPWOO !== 'undefined' && PPWOO.refreshed_text) || 'Atualizado agora', false);
                    ppDebug.log('Painel atualizado automaticamente.');
                } else {
                    setRefreshStatus((typeof PPWOO !== 'undefined' && PPWOO.refresh_error) || 'Não foi possível atualizar os pedidos.', true);
                    ppDebug.log('Resposta de atualização sem HTML válido.');
                }
            },
            error: function(jqXHR) {
                setRefreshStatus((typeof PPWOO !== 'undefined' && PPWOO.refresh_error) || 'Não foi possível atualizar os pedidos.', true);
                ppDebug.log('Erro AJAX ao atualizar painel: ' + jqXHR.status);
            },
            complete: function() {
                refreshInFlight = false;
                packingPanel.find('.ppwoo-refresh-button').removeClass('is-refreshing').prop('disabled', false);
            }
        });
    }

    packingPanel.on('click', '.ppwoo-refresh-button', function() {
        refreshPanel(true);
    });

    window.setInterval(function() {
        refreshPanel(false);
    }, refreshInterval);

    $(document).on('visibilitychange.ppwooPanelRefresh', function() {
        if (!document.hidden) {
            refreshPanel(true);
        }
    });

    // --- Máscara para WhatsApp do Motoboy ---
    function applyWhatsAppMask(input) {
        var value = input.value.replace(/\D/g, '').substring(0, 11);
        
        if (value.length > 10) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        } else if (value.length > 6) {
            value = value.replace(/^(\d{2})(\d{5})(\d{1,4}).*/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{1,5}).*/, '($1) $2');
        } else if (value.length > 0) {
            value = value.replace(/^(\d*)/, '($1');
        }
        
        input.value = value;
    }

    packingPanel.on('input', '#tab-motoboy .motoboy-whatsapp', function() {
        applyWhatsAppMask(this);
    });

    // --- Limpeza automática do link de rastreio ao colar ---
    packingPanel.on('paste', '#tab-motoboy .tracking-link', function(e) {
        e.preventDefault();

        var pastedText = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
        if (debugEnabled) {
            ppDebug.log('Texto colado detectado: "' + pastedText + '"');
        }

        var urlRegex = /(https?:\/\/[^\s"']+|www\.[^\s"']+)/i;
        var match = pastedText.match(urlRegex);

        if (match && match[0]) {
            var extractedUrl = match[0];

            if (extractedUrl.toLowerCase().indexOf('www.') === 0) {
                extractedUrl = 'https://' + extractedUrl;
            }

            $(this).val(extractedUrl);
            if (debugEnabled) {
                ppDebug.log('URL extraída e definida no campo: "' + extractedUrl + '"');
            }
        } else {
            if (debugEnabled) {
                ppDebug.log('Nenhuma URL encontrada. Valor do campo mantido.');
            }
        }
    });

})(jQuery);
