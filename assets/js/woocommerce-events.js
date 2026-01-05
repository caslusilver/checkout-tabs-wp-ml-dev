(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupWooEvents = function setupWooEvents(state) {
    var $ = state.$;

    state.recalcViaFrete = false;

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
      state.log('ACTION    Seleção de frete – recalcViaFrete=true e disparando update_checkout.', null, 'ACTION');
      $(document.body).trigger('update_checkout');
    });

    // update_checkout (antes do AJAX do WC)
    $(document.body).on('update_checkout', function () {
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


