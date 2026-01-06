(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupWooEvents = function setupWooEvents(state) {
    var $ = state.$;

    state.recalcViaFrete = false;
    
    // Variáveis para debounce e controle de update_checkout
    var updateCheckoutTimer = null;
    var updateCheckoutInProgress = false;
    var lastUpdateCheckoutTime = 0;
    var UPDATE_CHECKOUT_DEBOUNCE = 300; // 300ms
    var UPDATE_CHECKOUT_MIN_INTERVAL = 500; // Mínimo 500ms entre chamadas

    /**
     * Triggera update_checkout de forma segura (com debounce)
     */
    state.triggerUpdateCheckoutSafe = function (source) {
      source = source || 'unknown';

      // Se já está em progresso, aguarda
      if (updateCheckoutInProgress) {
        state.log('DEBUG     update_checkout já em progresso, ignorando chamadas extras (' + source + ')', null, 'DEBUG');
        return;
      }

      // Verifica intervalo mínimo desde última chamada
      var now = Date.now();
      var timeSinceLastUpdate = now - lastUpdateCheckoutTime;

      if (timeSinceLastUpdate < UPDATE_CHECKOUT_MIN_INTERVAL) {
        state.log('DEBUG     update_checkout muito recente, agendando para logo mais... (' + source + ')', null, 'DEBUG');

        // Agenda para depois
        if (updateCheckoutTimer) clearTimeout(updateCheckoutTimer);
        updateCheckoutTimer = setTimeout(function () {
          state.triggerUpdateCheckoutSafe(source);
        }, UPDATE_CHECKOUT_MIN_INTERVAL - timeSinceLastUpdate);
        return;
      }

      // Debounce padrão
      if (updateCheckoutTimer) {
        clearTimeout(updateCheckoutTimer);
      }

      updateCheckoutTimer = setTimeout(function () {
        state.log('ACTION    Disparando update_checkout (' + source + ')', null, 'ACTION');
        lastUpdateCheckoutTime = Date.now();
        // O evento real será capturado pelo listener abaixo que seta updateCheckoutInProgress = true
        $(document.body).trigger('update_checkout');
      }, UPDATE_CHECKOUT_DEBOUNCE);
    };

    function updateShippingSelectionUI() {
      var $shippingContainer = $(
        '#tab-resumo-frete #order_review ul.shipping_method, #tab-resumo-frete #order_review ul[data-shipping-methods]'
      ).first();
      if (!$shippingContainer.length) return;

      var checked = $shippingContainer.find('input[name^="shipping_method"]:checked').val();
      $shippingContainer.find('li').removeClass('active selected');
      $shippingContainer.find('input[value="' + checked + '"]').closest('li').addClass('active selected');

      var $selected = $shippingContainer.find('li.active, li.selected');
      if ($selected.length) {
        var $amount = $selected.find('.amount').first();
        if ($amount.length) {
          $('#tab-resumo-frete #order_review .shipping-totals .amount').text($amount.text());
        }
      }
    }

    // seleção de frete -> recálculo
    $(document).on('change', '#tab-resumo-frete #order_review input[name^="shipping_method"]', function () {
      state.recalcViaFrete = true;
      state.actionStartTime = performance.now();
      state.triggerUpdateCheckoutSafe('shipping_method_change');
    });

    // update_checkout (antes do AJAX do WC)
    $(document.body).on('update_checkout', function () {
      // Marcar que update_checkout está em progresso
      updateCheckoutInProgress = true;
      
      if ($('#tab-cep').hasClass('active') && !state.clickedAvancarCep && !state.recalcViaFrete) {
        state.log(
          'WC_OUT    update_checkout na aba CEP por digitação (sem Avançar/sem recálculo via frete). Ocultando overlay.',
          null,
          'WC_OUT'
        );
        return;
      }
      state.currentPhase = 'WC_OUT';
      state.log('WC_OUT    update_checkout válido (Avançar do CEP ou recálculo de frete). Mostrando overlay...', null, 'WC_OUT');
      state.ajaxWCStartTime = performance.now();
      state.setProcessingState(true, 'update_checkout');
    });

    // updated_checkout (depois do AJAX do WC / depois de aplicar fragments)
    $(document.body).on('updated_checkout', function () {
      // Marcar que update_checkout completou
      updateCheckoutInProgress = false;
      
      state.ajaxWCEndTime = performance.now();

      state.log('UI        Evento updated_checkout detectado.', null, 'UI');

      if ($('#tab-cep').hasClass('active') && $('#btn-avancar-para-endereco').hasClass('btn-processing')) {
        state.log('DEBUG     Aba CEP ativa com botão processando. Limpeza de estado será feita pelo listener .one().', null, 'DEBUG');
      } else {
        state.setProcessingState(false, 'updated_checkout_general');
      }

      updateShippingSelectionUI();
      state.updatePlaceOrderButtonState();
      state.renderDuplicateTotal();

      state.recalcViaFrete = false;
    });

    // init no load
    $(window).on('load', function () {
      state.currentPhase = 'INIT';
      state.log('DEBUG     Página carregada. Iniciando script de abas.', null, 'DEBUG');
      updateShippingSelectionUI();
      state.currentPhase = 'UI';
      state.updatePlaceOrderButtonState();
      state.renderDuplicateTotal();
    });
  };
})(window);


