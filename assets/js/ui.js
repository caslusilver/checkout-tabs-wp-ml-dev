(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupUI = function setupUI(state) {
    var $ = state.$;
    var cursorTimer = null;

    // Detecta ML-only (body class ou params)
    var mlOnly = false;
    try {
      mlOnly = document.body.classList.contains('ctwpml-ml-only') ||
               (state.params && (state.params.ml_only === 1 || state.params.ml_only === '1'));
    } catch (e) {}

    function ensureOverlayElements() {
      // No ML-only, não cria overlay global do checkout (o modal tem seu próprio loading)
      if (mlOnly) return;
      if (!$('.frete-loading').length) $('body').append('<div class="frete-loading"></div>');
      if (!$('.checkout-loading-overlay').length) {
        $('form.checkout').append(
          '<div class="checkout-loading-overlay"><div class="spinner"></div></div>'
        );
      }
    }

    state.toggleLoading = function toggleLoading(show) {
      // No ML-only, não mostra overlay global (evita bloquear o modal)
      if (mlOnly) return;
      state.log('UI        Chamado toggleLoading(' + (show ? 'true' : 'false') + ').', null, 'UI');
      ensureOverlayElements();
      if (show) {
        $('.checkout-loading-overlay').css('display', 'flex');
      } else {
        $('.checkout-loading-overlay').css('display', 'none');
      }
    };

    state.setProcessingState = function setProcessingState(isProcessing, source) {
      // No ML-only, não mostra overlay/cursor global (o modal cuida do UX)
      if (mlOnly) return;
      source = source || 'generic';
      state.log(
        'UI        Setando estado de processamento: ' + (isProcessing ? 'true' : 'false') + ' (Source: ' + source + ')',
        null,
        'UI'
      );

      if (isProcessing) {
        state.toggleLoading(true);
        $('body').addClass('processing');

        if (cursorTimer) clearTimeout(cursorTimer);
        cursorTimer = setTimeout(function () {
          $('body').css('cursor', 'progress');
          state.log('UI         Processamento demorando > 1s, mudando cursor para progress.', null, 'UI');
        }, 1000);
      } else {
        state.toggleLoading(false);
        $('body').removeClass('processing').css('cursor', '');
        if (cursorTimer) {
          clearTimeout(cursorTimer);
          cursorTimer = null;
        }
      }
    };

    state.updatePlaceOrderButtonState = function updatePlaceOrderButtonState() {
      // No ML-only, não mexe no botão (o modal controla o fluxo)
      if (mlOnly) return;

      var $placeOrderBtn = $('#place_order');
      var $orderTotal = $(
        '#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount'
      );
      var total = ($orderTotal.text() || '').trim();
      var isLastTab = $('#tab-pagamento').hasClass('active');

      state.log(
        'READY-CHECK updatePlaceOrderButtonState: Total encontrado: "' + total + '", Na última aba: ' + isLastTab,
        null,
        'READY-CHECK'
      );

      var totalIsValid =
        total !== '' && total !== 'R$ 0,00' && total !== 'R$0,00' && total.indexOf('Calcular') === -1;

      if (isLastTab && totalIsValid) {
        $placeOrderBtn.prop('disabled', false);
        state.log(
          'READY-CHECK Botão "Finalizar Pedido": Permitindo gerenciamento do WC. Total válido na aba Pagamento.',
          null,
          'READY-CHECK'
        );
      } else {
        $placeOrderBtn.prop('disabled', true);
        state.log(
          'READY-CHECK Botão "Finalizar Pedido" DESABILITADO (Não está na aba Pagamento ou total inválido).',
          null,
          'READY-CHECK'
        );
      }
    };

    state.renderDuplicateTotal = function renderDuplicateTotal() {
      // No ML-only, não renderiza total duplicado (o modal tem seu próprio layout)
      if (mlOnly) return;

      var $paymentSection = $('#tab-pagamento #payment');
      var $placeOrderContainer = $paymentSection.find('.place-order');
      var $duplicateTotalContainer = $paymentSection.find('.payment-total-dup');

      if ($paymentSection.length && $placeOrderContainer.length) {
        if (!$duplicateTotalContainer.length) {
          state.log(
            'DEBUG     Bloco de total duplicado (.payment-total-dup) não encontrado dentro de #payment, injetando.',
            null,
            'UI'
          );
          $placeOrderContainer.before(
            '' +
              '<div class="payment-total-dup">' +
              '  <hr class="payment-total-divider">' +
              '  <div class="payment-total-row">' +
              '    <span class="payment-total-label">Total</span>' +
              '    <span class="payment-total-value">R$ 0,00</span>' +
              '  </div>' +
              '</div>'
          );
          $duplicateTotalContainer = $paymentSection.find('.payment-total-dup');
        }
      } else {
        state.log(
          'AVISO     Não foi possível renderizar o bloco de total duplicado. #tab-pagamento #payment ou .place-order não encontrados.',
          null,
          'UI'
        );
        return;
      }

      var $orderTotal = $(
        '#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount'
      );
      var $duplicateTotalValue = $duplicateTotalContainer.find('.payment-total-value');

      if ($orderTotal.length && $duplicateTotalValue.length) {
        var totalText = ($orderTotal.text() || '').trim();
        if (($duplicateTotalValue.text() || '').trim() !== totalText) {
          $duplicateTotalValue.text(totalText);
          state.log('DEBUG     Total duplicado atualizado para: ' + totalText, null, 'UI');
        }
      }
    };
  };
})(window);


