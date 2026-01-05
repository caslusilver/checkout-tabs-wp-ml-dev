(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupStore = function setupStore(state) {
    var $ = state.$;

    function ensurePaymentTabOrder() {
      var $paymentAfterUpdate = $('#tab-pagamento #payment');
      var $couponFormAfterUpdate = $('#tab-pagamento .checkout_coupon');
      var $orderNotesAfterUpdate = $('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
      var $customCouponBoxAfterUpdate = $('#tab-pagamento .e-coupon-box');

      if ($orderNotesAfterUpdate.length === 0)
        $orderNotesAfterUpdate = $('.woocommerce-additional-fields__field-wrapper').first().appendTo('#tab-pagamento');
      if ($couponFormAfterUpdate.length === 0)
        $couponFormAfterUpdate = $('.checkout_coupon').first().appendTo('#tab-pagamento');
      if ($paymentAfterUpdate.length === 0) $paymentAfterUpdate = $('#payment').first().appendTo('#tab-pagamento');
      if ($customCouponBoxAfterUpdate.length === 0) {
        $customCouponBoxAfterUpdate = $('.e-coupon-box').first();
        if ($customCouponBoxAfterUpdate.length && $('#tab-pagamento').length) {
          $customCouponBoxAfterUpdate.appendTo('#tab-pagamento');
        }
      }

      $('.e-coupon-box:not(:first)').remove();

      if ($orderNotesAfterUpdate.length && $customCouponBoxAfterUpdate.length) {
        $customCouponBoxAfterUpdate.insertAfter($orderNotesAfterUpdate);
      } else if ($orderNotesAfterUpdate.length) {
        $orderNotesAfterUpdate.insertBefore($paymentAfterUpdate);
      }

      if ($customCouponBoxAfterUpdate.length && $paymentAfterUpdate.length) {
        $paymentAfterUpdate.insertAfter($customCouponBoxAfterUpdate);
      } else if ($orderNotesAfterUpdate.length && $paymentAfterUpdate.length) {
        $paymentAfterUpdate.insertAfter($orderNotesAfterUpdate);
      }

      if ($couponFormAfterUpdate.length && $paymentAfterUpdate.length) {
        $couponFormAfterUpdate.insertAfter($paymentAfterUpdate);
      }
    }

    function applyFragments(fragments) {
      $.each(fragments, function (key, value) {
        if (key === '#order_review') {
          $('#tab-resumo-frete #order_review').replaceWith(value);
          state.log('APPLY_FRAG #order_review fragment aplicado dentro da aba 4.', null, 'APPLY_FRAG');
        } else if (key === '#payment') {
          $('#tab-pagamento #payment').replaceWith(value);
          state.log('APPLY_FRAG #payment fragment aplicado dentro da aba 5.', null, 'APPLY_FRAG');
        } else if (key === '.checkout_coupon') {
          state.log('APPLY_FRAG Ignorando fragmento .checkout_coupon (gerenciado por CSS/movimentação).', null, 'APPLY_FRAG');
        } else if (key === '.woocommerce-info.woocommerce-coupon-message') {
          state.log(
            'APPLY_FRAG Ignorando fragmento .woocommerce-info.woocommerce-coupon-message (gerenciado por CSS/movimentação).',
            null,
            'APPLY_FRAG'
          );
        } else if (key === '#order_review_heading' || key === '#payment_heading') {
          state.log('APPLY_FRAG Ignorando fragmento de título: "' + key + '".', null, 'APPLY_FRAG');
        } else if (key === '.woocommerce-additional-fields' || key === '.woocommerce-additional-fields__field-wrapper') {
          $('#tab-pagamento .woocommerce-additional-fields__field-wrapper').replaceWith(value);
          state.log('APPLY_FRAG Fragment "' + key + '" (Order Notes) aplicado dentro da aba 5.', null, 'APPLY_FRAG');
        } else {
          // exclui fragmentos que já são tratados por abas
          if (
            key !== '.woocommerce-checkout-review-order-table' &&
            key !== '.woocommerce-checkout-payment' &&
            key !== '.woocommerce-form-coupon' &&
            key !== '.woocommerce-additional-fields' &&
            key !== '.woocommerce-additional-fields__field-wrapper'
          ) {
            try {
              $(key).replaceWith(value);
              state.log('APPLY_FRAG Fragment "' + key + '" aplicado.', null, 'APPLY_FRAG');
            } catch (e) {
              state.log('APPLY_FRAG Falha ao aplicar fragment "' + key + '".', e && e.message, 'APPLY_FRAG');
            }
          }
        }
      });
    }

    state.armazenarDadosNoServidor = function armazenarDadosNoServidor(dataToSave) {
      state.currentPhase = 'STORE_OUT';
      state.log('STORE_OUT Chamando store_webhook_shipping para armazenar dados...', null, 'STORE_OUT');
      state.ajaxStoreStartTime = performance.now();

      return new Promise(function (resolve) {
        $.ajax({
          url: state.params.ajax_url,
          type: 'POST',
          dataType: 'json',
          data: {
            action: 'store_webhook_shipping',
            security: state.params.nonce,
            shipping_data: JSON.stringify(dataToSave),
          },
          success: function (response) {
            state.ajaxStoreEndTime = performance.now();
            state.currentPhase = 'STORE_IN';
            state.log('STORE_IN  store_webhook_shipping success (HTTP 200).', response, 'STORE_IN');

            var successFlag = typeof response.success === 'undefined' ? true : !!response.success;
            var responseData = response.data || {};
            var fragments = responseData.fragments || responseData;
            var hasFragments = fragments && typeof fragments === 'object' && Object.keys(fragments).length > 0;

            if (successFlag) {
              if (hasFragments) {
                var beforeTotal = $(
                  '#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount'
                )
                  .text()
                  .trim();
                state.log('DELTA     Total antes: ' + beforeTotal, null, 'TOTAL');

                applyFragments(fragments);
                ensurePaymentTabOrder();

                state.renderDuplicateTotal();
                state.fragmentsAppliedTime = performance.now();
                state.log('UPDATE_DONE Fragments aplicados (via SWHS).', null, 'UPDATE_DONE');

                var afterTotal = $(
                  '#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount'
                )
                  .text()
                  .trim();
                state.log('DELTA     Total depois: ' + afterTotal, null, 'TOTAL');
              } else {
                state.log('DEBUG     store_webhook_shipping success, mas sem fragments.', null, 'DEBUG');
              }

              state.log('DEBUG     Disparando updated_checkout após aplicar fragments (via SWHS).', null, 'DEBUG');
              $(document.body).trigger('updated_checkout');

              resolve(true);
            } else {
              var msg = (responseData && responseData.message) || 'Erro desconhecido ao salvar dados do frete.';
              state.log('ERROR     store_webhook_shipping retornou success=false', response, 'ERROR');
              $('.cep-erro').show().text('Erro ao salvar dados do frete: ' + msg);
              resolve(false);
            }
          },
          error: function (jqXHR, textStatus, errorThrown) {
            state.ajaxStoreEndTime = performance.now();
            state.currentPhase = 'STORE_IN';
            state.log(
              'STORE_IN  store_webhook_shipping error (HTTP ' + jqXHR.status + ').',
              { status: jqXHR.status, textStatus: textStatus, error: errorThrown, responseText: jqXHR.responseText },
              'STORE_IN'
            );
            $('.cep-erro').show().text('Erro ao salvar dados do frete. Tente novamente.');
            resolve(false);
          },
          complete: function () {
            state.currentPhase = 'STORE_DONE';
            state.log('STORE_DONE store_webhook_shipping request complete.', null, 'STORE_DONE');
          },
        });
      });
    };
  };
})(window);


