(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupWebhook = function setupWebhook(state) {
    var $ = state.$;

    state.freteData = null;
    state.consultaEmAndamento = false;

    function applyMasksIfAvailable() {
      if (typeof $.fn.mask === 'undefined') {
        state.log('AVISO     Plugin jQuery Mask não disponível. Máscaras não aplicadas.', null, 'DEBUG');
        return;
      }

      $('#billing_postcode')
        .attr({ type: 'tel', inputmode: 'numeric', pattern: '[0-9]*' })
        .mask('00000-000');
      $('#billing_cellphone').mask('(00) 00000-0000');
    }

    state.removerMascaraWhatsApp = function removerMascaraWhatsApp(numero) {
      return (numero || '').replace(/\D/g, '');
    };

    state.normalizarRespostaAPI = function normalizarRespostaAPI(data) {
      state.log('DEBUG     Normalizando resposta da API bruta', data, 'DEBUG');
      if (Array.isArray(data)) return data.length > 0 ? data[0] : null;
      if (typeof data === 'object' && data !== null) return data;
      return null;
    };

    state.processarDadosEnderecoFrete = function processarDadosEnderecoFrete(dados) {
      state.log('DEBUG     Processando dados de endereço e frete recebidos do webhook...', null, 'DEBUG');

      if (!dados) {
        $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento')
          .val('')
          .trigger('change');
        $('.cep-erro').show().text('Resposta do CEP inválida ou vazia. Verifique se o CEP existe.');
        state.freteData = null;
        return false;
      }

      dados = state.normalizarRespostaAPI(dados);
      if (!dados) {
        $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento')
          .val('')
          .trigger('change');
        $('.cep-erro').show().text('Resposta do CEP inválida após normalização. Verifique se o CEP existe.');
        state.freteData = null;
        return false;
      }

      state.log('DEBUG     Dados normalizados do webhook para processamento:', dados, 'DEBUG');
      state.freteData = dados;

      try {
        var anyAddressFieldFilledByWebhook = false;

        var mapping = {
          logradouro: '#billing_address_1',
          numero: '#billing_number',
          bairro: '#billing_neighborhood',
          localidade: '#billing_city',
          uf: '#billing_state',
          complemento: '#billing_complemento',
        };

        Object.keys(mapping).forEach(function (apiField) {
          var sel = mapping[apiField];
          var $field = $(sel);
          if (!$field.length) return;

          var fieldValue = dados[apiField];
          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
            if ($field.val() !== fieldValue) $field.val(fieldValue).trigger('change');
            if (apiField === 'logradouro' && String(fieldValue).trim() !== '') anyAddressFieldFilledByWebhook = true;
          } else {
            if ($field.val() !== '') $field.val('').trigger('change');
          }
        });

        var currentCity = $('#billing_city').val() || '';
        var currentState = $('#billing_state').val() || '';
        if (currentCity || currentState) {
          $('#tab-resumo-frete #order_review .location-city.billing_city_field, #tab-resumo-frete #order_review .woocommerce-shipping-destination .location').text(
            currentCity + ', ' + currentState
          );
        } else {
          $('#tab-resumo-frete #order_review .location-city.billing_city_field, #tab-resumo-frete #order_review .woocommerce-shipping-destination .location').text(
            ''
          );
        }

        if (anyAddressFieldFilledByWebhook && ($('#billing_number').val() || '').trim() === '') {
          $('#billing_number').focus();
        }

        if (!anyAddressFieldFilledByWebhook && ($('#billing_address_1').val() || '').trim() === '') {
          $('.cep-erro').show().text('CEP encontrado, mas dados de endereço incompletos. Por favor, preencha o endereço manualmente.');
        } else {
          $('.cep-erro').hide();
        }

        if (dados.whatsappValido === false) $('.whatsapp-invalido').show();
        else $('.whatsapp-invalido').hide();

        var temDadosFreteValidos =
          (dados.fretePACMini && typeof dados.fretePACMini.valor !== 'undefined' && parseFloat(dados.fretePACMini.valor) > 0) ||
          (dados.freteSedex && typeof dados.freteSedex.valor !== 'undefined' && parseFloat(dados.freteSedex.valor) > 0) ||
          (dados.freteMotoboy && typeof dados.freteMotoboy.valor !== 'undefined' && parseFloat(dados.freteMotoboy.valor) > 0);

        return anyAddressFieldFilledByWebhook || temDadosFreteValidos;
      } catch (e) {
        state.log('ERROR     Erro fatal ao processar dados do webhook no frontend:', e && e.message, 'ERROR');
        $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento')
          .val('')
          .trigger('change');
        $('.cep-erro').show().text('Ocorreu um erro ao processar os dados do CEP. Tente novamente.');
        state.freteData = null;
        return false;
      }
    };

    state.consultarCepEFrete = function consultarCepEFrete() {
      return new Promise(function (resolve) {
        if (state.consultaEmAndamento) {
          state.log('DEBUG     Consulta já em andamento, ignorando.', null, 'DEBUG');
          resolve(false);
          return;
        }
        state.consultaEmAndamento = true;
        state.freteData = null;

        var cep = ($('#billing_postcode').val() || '').replace(/\D/g, '');
        var whatsapp = state.removerMascaraWhatsApp($('#billing_cellphone').val());
        var firstName = ($('#billing_first_name').val() || '').trim();
        var lastName = ($('#billing_last_name').val() || '').trim();
        var nomeCompleto = (firstName + ' ' + lastName).trim();
        var cpf = ($('#billing_cpf').val() || '').replace(/\D/g, '');

        var payload = {
          cep: cep,
          evento: 'consultaEnderecoFrete',
          whatsapp: whatsapp,
          cpf: cpf,
          nome: nomeCompleto,
        };

        state.currentPhase = 'WEBHOOK_OUT';
        state.log('WEBHOOK_OUT Iniciando consulta de endereço e frete via webhook...', payload, 'WEBHOOK_OUT');
        state.ajaxWebhookStartTime = performance.now();

        $.ajax({
          url: state.params.webhook_url,
          type: 'POST',
          contentType: 'application/json',
          dataType: 'json',
          timeout: 15000,
          crossDomain: true,
          xhrFields: { withCredentials: false },
          data: JSON.stringify(payload),
          success: function (data) {
            state.ajaxWebhookEndTime = performance.now();
            state.currentPhase = 'WEBHOOK_IN';
            state.log('WEBHOOK_IN  Resposta do webhook recebida (HTTP 200).', data, 'WEBHOOK_IN');

            var okFrontend = state.processarDadosEnderecoFrete(data);
            if (okFrontend && state.freteData) {
              state.armazenarDadosNoServidor(state.freteData).then(function (okStore) {
                resolve(!!okStore);
              });
            } else {
              resolve(false);
            }
          },
          error: function (jqXHR, textStatus, errorThrown) {
            state.ajaxWebhookEndTime = performance.now();
            state.currentPhase = 'WEBHOOK_IN';
            state.log(
              'WEBHOOK_IN  Erro na requisição AJAX para o webhook (' + textStatus + ').',
              { status: jqXHR.status, textStatus: textStatus, error: errorThrown, responseText: jqXHR.responseText },
              'WEBHOOK_IN'
            );
            $('.cep-erro')
              .show()
              .text('Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.');
            $('#btn-avancar-para-endereco').removeClass('btn-processing');
            state.setProcessingState(false, 'cep_chain_fail');
            resolve(false);
          },
          complete: function () {
            state.currentPhase = 'WEBHOOK_DONE';
            state.log('WEBHOOK_DONE Webhook AJAX request complete', null, 'WEBHOOK_DONE');
            $('#tab-cep').removeClass('cep-loading');
            state.consultaEmAndamento = false;
          },
        });
      });
    };

    state.handleUpdatedCheckoutForCepAdvance = function handleUpdatedCheckoutForCepAdvance() {
      state.log(
        'DEBUG     handleUpdatedCheckoutForCepAdvance chamado (triggered by updated_checkout). Verificando aba ativa...',
        null,
        'DEBUG'
      );

      state.clickedAvancarCep = false;

      if (!state.freteData) {
        $('#btn-avancar-para-endereco').removeClass('btn-processing');
        state.setProcessingState(false, 'updated_checkout_frete_data_null');
        state.updatePlaceOrderButtonState();
        state.renderDuplicateTotal();
        return;
      }

      if (!$('#tab-cep').hasClass('active')) {
        $('#btn-avancar-para-endereco').removeClass('btn-processing');
        state.setProcessingState(false, 'updated_checkout_cep_listener_skip');
        state.updatePlaceOrderButtonState();
        state.renderDuplicateTotal();
        return;
      }

      $('#tab-cep').removeClass('active').hide();
      $('#tab-dados-entrega').addClass('active').show();
      state.updateProgressBar('tab-dados-entrega');

      $('#btn-avancar-para-endereco').removeClass('btn-processing');
      state.setProcessingState(false, 'updated_checkout_cep_success');
      state.updatePlaceOrderButtonState();
      state.renderDuplicateTotal();
    };

    state.bindCepAdvance = function bindCepAdvance() {
      // Delegado para suportar renderização tardia (Elementor) e re-render do Woo fragments.
      $(document).on('click', '#btn-avancar-para-endereco', function (e) {
        e.preventDefault();
        state.actionStartTime = performance.now();
        state.log('ACTION    Clique em "Avançar" (CEP -> Endereço) para consultar CEP/Frete', null, 'ACTION');

        state.consultaEmAndamento = false;
        state.clickedAvancarCep = true;

        var $btn = $(this);
        if ($btn.hasClass('btn-processing')) return;

        var cepValue = ($('#billing_postcode').val() || '').replace(/\D/g, '');
        if (!cepValue || cepValue.length !== 8) {
          $('.cep-erro').show().text('CEP inválido. Informe os 8 dígitos do CEP.');
          $btn.removeClass('btn-processing');
          state.setProcessingState(false, 'cep_validation_fail');
          state.updatePlaceOrderButtonState();
          state.clickedAvancarCep = false;
          return;
        }

        $('.cep-erro').hide();
        $btn.addClass('btn-processing');
        state.setProcessingState(true, 'cep_button_click');
        $('#tab-cep').addClass('cep-loading');

        state.consultarCepEFrete().then(function (ok) {
          if (ok) {
            // IMPORTANTE: não depender de `updated_checkout` aqui, pois o Woo pode disparar
            // `updated_checkout` automático (digitando CEP) e consumir listeners `.one()`,
            // impedindo o avanço mesmo com store OK.
            state.handleUpdatedCheckoutForCepAdvance();
            return;
          } else {
            $btn.removeClass('btn-processing');
            state.setProcessingState(false, 'cep_chain_fail');
            state.updatePlaceOrderButtonState();
            state.clickedAvancarCep = false;
          }
        });
      });
    };

    // UX: quando alterar CEP, ocultar erro
    $(document).on('change', '#billing_postcode', function () {
      var cep = ($(this).val() || '').replace(/\D/g, '');
      if (cep.length === 8) $('.cep-erro').hide();
      else $('.cep-erro').hide();
    });

    applyMasksIfAvailable();
  };
})(window);


