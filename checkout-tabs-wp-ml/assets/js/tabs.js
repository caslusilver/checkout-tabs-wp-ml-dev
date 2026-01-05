(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupTabs = function setupTabs(state) {
    var $ = state.$;

    state.clickedAvancarCep = false;

    var dadosPessoaisFields = [
      '#billing_cellphone_field',
      '#billing_first_name_field',
      '#billing_last_name_field',
      '#billing_cpf_field',
      '#billing_email_field',
    ];

    var dadosEntregaFields = [
      '#billing_address_1_field',
      '#billing_number_field',
      '#billing_neighborhood_field',
      '#billing_city_field',
      '#billing_state_field',
      '#billing_complemento_field',
    ];

    function ensureCepErrorMessage() {
      if (!$('#billing_postcode_field .cep-erro').length) {
        $('#billing_postcode_field').append(
          '<div class="cep-erro">CEP não encontrado. Por favor, verifique e tente novamente.</div>'
        );
      }
    }

    state.updateProgressBar = function updateProgressBar(tabId) {
      var stepPercentage = 100 / 4; // 5 abas = 4 transições
      var stepIndex = 0;

      switch (tabId) {
        case 'tab-dados-pessoais':
          stepIndex = 0;
          break;
        case 'tab-cep':
          stepIndex = 1;
          break;
        case 'tab-dados-entrega':
          stepIndex = 2;
          break;
        case 'tab-resumo-frete':
          stepIndex = 3;
          break;
        case 'tab-pagamento':
          stepIndex = 4;
          break;
      }

      var progressWidth = stepIndex * stepPercentage;

      $('#progressBar').css('width', progressWidth + '%');
      $('#progressIndicator').css('left', progressWidth + '%');
      $('#progressBarCep').css('width', progressWidth + '%');
      $('#progressIndicatorCep').css('left', progressWidth + '%');
      $('#progressBarEndereco').css('width', progressWidth + '%');
      $('#progressIndicatorEndereco').css('left', progressWidth + '%');
      $('#progressBarResumo').css('width', progressWidth + '%');
      $('#progressIndicatorResumo').css('left', progressWidth + '%');
      $('#progressBarPagamento').css('width', progressWidth + '%');
      $('#progressIndicatorPagamento').css('left', progressWidth + '%');

      state.log(
        'UI        Progresso atualizado para a aba ' + tabId + '. Width: ' + progressWidth.toFixed(2) + '%',
        null,
        'UI'
      );
    };

    state.buildTabsAndMoveFields = function buildTabsAndMoveFields() {
      ensureCepErrorMessage();

      if (!$('#tab-dados-pessoais').length) {
        $(
          '' +
            '<div id="tab-dados-pessoais" class="checkout-tab active">' +
            '  <h3>Dados Pessoais</h3>' +
            '  <div class="progress-container">' +
            '    <div class="progress-bar" id="progressBar"></div>' +
            '    <div class="progress-indicator" id="progressIndicator"></div>' +
            '  </div>' +
            '  <p class="frete-info" style="margin-top:6px;">Preencha seus dados corretamente e garanta que seu WhatsApp esteja correto para facilitar nosso contato.</p>' +
            '</div>'
        ).insertBefore('#customer_details .col-1 .woocommerce-billing-fields__field-wrapper');
      }

      if (!$('#tab-cep').length) {
        $(
          '' +
            '<div id="tab-cep" class="checkout-tab">' +
            '  <h3 class="cep-title">Informe seu CEP</h3>' +
            '  <div class="progress-container">' +
            '    <div class="progress-bar" id="progressBarCep"></div>' +
            '    <div class="progress-indicator" id="progressIndicatorCep"></div>' +
            '  </div>' +
            '  <p class="cep-description">Precisamos do seu CEP para calcular o frete e preencher seu endereço automaticamente.</p>' +
            '</div>'
        ).insertAfter('#tab-dados-pessoais');
      }

      if (!$('#tab-dados-entrega').length) {
        $(
          '' +
            '<div id="tab-dados-entrega" class="checkout-tab">' +
            '  <h3>Endereço</h3>' +
            '  <div class="progress-container">' +
            '    <div class="progress-bar" id="progressBarEndereco"></div>' +
            '    <div class="progress-indicator" id="progressIndicatorEndereco"></div>' +
            '  </div>' +
            '  <p class="frete-info" style="margin-top:8px;">Falta pouco para finalizar seu pedido...</p>' +
            '</div>'
        ).insertAfter('#tab-cep');
      }

      if (!$('#tab-resumo-frete').length) {
        $(
          '' +
            '<div id="tab-resumo-frete" class="checkout-tab">' +
            '  <h3>Resumo do Pedido e Frete</h3>' +
            '  <div class="progress-container">' +
            '    <div class="progress-bar" id="progressBarResumo"></div>' +
            '    <div class="progress-indicator" id="progressIndicatorResumo"></div>' +
            '  </div>' +
            '</div>'
        ).insertAfter('#tab-dados-entrega');
      }

      if (!$('#tab-pagamento').length) {
        $(
          '' +
            '<div id="tab-pagamento" class="checkout-tab">' +
            '  <h3>Pagamento</h3>' +
            '  <div class="progress-container">' +
            '    <div class="progress-bar" id="progressBarPagamento"></div>' +
            '    <div class="progress-indicator" id="progressIndicatorPagamento"></div>' +
            '  </div>' +
            '</div>'
        ).insertAfter('#tab-resumo-frete');
      }

      $.each(dadosPessoaisFields, function (_, selector) {
        $(selector).appendTo('#tab-dados-pessoais');
      });
      $('#billing_postcode_field').appendTo('#tab-cep');
      $.each(dadosEntregaFields, function (_, selector) {
        $(selector).appendTo('#tab-dados-entrega');
      });

      // mover #order_review / order notes / cupom / payment para abas corretas
      var $orderReview = $('#order_review');
      if ($orderReview.length && $('#tab-resumo-frete').length) {
        state.log('DEBUG     Movendo #order_review para dentro de #tab-resumo-frete', null, 'INIT');
        $orderReview.appendTo('#tab-resumo-frete');
      }

      var $orderNotesWrapper = $('.woocommerce-additional-fields__field-wrapper');
      if ($orderNotesWrapper.length && $('#tab-pagamento').length) {
        state.log(
          'DEBUG     Movendo .woocommerce-additional-fields__field-wrapper para dentro de #tab-pagamento',
          null,
          'INIT'
        );
        $orderNotesWrapper.appendTo('#tab-pagamento');
      }

      var $customCouponBox = $('.e-coupon-box').first();
      var $targetTab = $('#tab-pagamento');
      if ($customCouponBox.length && $targetTab.length) {
        state.log(
          'DEBUG     Movendo bloco de cupom customizado (.e-coupon-box) para dentro de #tab-pagamento',
          null,
          'INIT'
        );
        $customCouponBox.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
        $('.e-coupon-box:not(:first)').remove();
      } else {
        var $couponAnchorContainer = $('.woocommerce-info.woocommerce-coupon-message').first();
        var $checkoutCoupon = $('.checkout_coupon').first();

        if ($couponAnchorContainer.length && $targetTab.length) {
          $couponAnchorContainer.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
        }
        if ($checkoutCoupon.length && $targetTab.length) {
          var $anchor = $('#tab-pagamento .woocommerce-info.woocommerce-coupon-message');
          if ($anchor.length) $checkoutCoupon.insertAfter($anchor);
          else $checkoutCoupon.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
        }
      }

      var $payment = $('#payment');
      if ($payment.length && $('#tab-pagamento').length) {
        state.log('DEBUG     Movendo #payment para dentro de #tab-pagamento', null, 'INIT');
        var $couponOrNotes = $('#tab-pagamento .e-coupon-box').length
          ? $('#tab-pagamento .e-coupon-box')
          : $('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
        if ($couponOrNotes.length) $payment.insertAfter($couponOrNotes);
        else $payment.appendTo('#tab-pagamento');
      }

      // toggle cupom custom
      $(document).on('click', '.e-show-coupon-form', function (e) {
        e.preventDefault();
        state.log('ACTION    Toggle custom coupon form', null, 'ACTION');
        $(this)
          .closest('.e-coupon-box')
          .find('.e-coupon-anchor')
          .slideToggle(300, function () {
            if ($(this).is(':visible')) $(this).find('input#coupon_code').focus();
          });
      });

      // abas iniciais
      $('#tab-cep, #tab-dados-entrega, #tab-resumo-frete, #tab-pagamento').removeClass('active').hide();
      $('#tab-dados-pessoais').addClass('active').show();
      $('#billing_persontype_field, .person-type-field').hide();
      $('#billing_country_field, .thwcfd-field-country').hide();
      $('#order_review_heading, #payment_heading').hide();

      // botões por aba
      if (!$('#tab-dados-pessoais .tab-buttons').length) {
        $('#tab-dados-pessoais').append('<div class="tab-buttons"></div>');
        $('#tab-dados-pessoais .tab-buttons').append(
          '<button type="button" id="btn-avancar-para-cep" class="checkout-next-btn">Avançar</button>'
        );
      }

      if (!$('#tab-cep .tab-buttons').length) {
        $('#tab-cep').append('<div class="tab-buttons"></div>');
        $('#tab-cep .tab-buttons').append(
          '<button type="button" id="btn-avancar-para-endereco" class="checkout-next-btn">Avançar</button>'
        );
        $('#tab-cep .tab-buttons').append(
          '<button type="button" id="btn-voltar-dados" class="checkout-back-btn">Voltar</button>'
        );
      }

      if (!$('#tab-dados-entrega .tab-buttons').length) {
        $('#tab-dados-entrega').append('<div class="tab-buttons"></div>');
        $('#tab-dados-entrega .tab-buttons').append(
          '<button type="button" id="btn-avancar-para-resumo" class="checkout-next-btn">Avançar para o Resumo</button>'
        );
        $('#tab-dados-entrega .tab-buttons').append(
          '<button type="button" id="btn-voltar-cep" class="checkout-back-btn">Voltar</button>'
        );
      }

      if (!$('#tab-resumo-frete .tab-buttons').length) {
        $('#tab-resumo-frete').append('<div class="tab-buttons"></div>');
        $('#tab-resumo-frete .tab-buttons').append(
          '<button type="button" id="btn-avancar-para-pagamento" class="checkout-next-btn">Avançar para Pagamento</button>'
        );
        $('#tab-resumo-frete .tab-buttons').append(
          '<button type="button" id="btn-voltar-endereco" class="checkout-back-btn">Voltar</button>'
        );
      }

      if (!$('#tab-pagamento .tab-buttons').length) {
        $('#tab-pagamento').append('<div class="tab-buttons"></div>');
        $('#tab-pagamento .tab-buttons').append(
          '<button type="button" id="btn-voltar-resumo" class="checkout-back-btn">Voltar</button>'
        );
      }

      if (!$('#tab-dados-entrega .tab-buttons .whatsapp-invalido').length) {
        $('<div class="whatsapp-invalido">Número de WhatsApp inválido. Por favor, verifique e corrija.</div>').insertBefore(
          '#tab-dados-entrega .tab-buttons .checkout-back-btn'
        );
      }
    };

    state.bindNavigation = function bindNavigation() {
      $('#btn-avancar-para-cep').on('click', function (e) {
        e.preventDefault();
        state.actionStartTime = performance.now();
        state.log('ACTION    Clique em "Avançar" (Dados Pessoais -> CEP)', null, 'ACTION');

        var nomeValido = ($('#billing_first_name').val() || '').trim().length > 1;
        var email = ($('#billing_email').val() || '').trim();
        var emailValido = email.length > 5 && email.indexOf('@') !== -1;

        if (!nomeValido || !emailValido) {
          alert('Por favor, preencha todos os campos obrigatórios de Dados Pessoais.');
          return;
        }

        $('#tab-dados-pessoais').removeClass('active').hide();
        $('#tab-cep').addClass('active').show();
        state.updateProgressBar('tab-cep');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-voltar-dados').on('click', function (e) {
        e.preventDefault();
        state.log('ACTION    Clique em "Voltar" (CEP -> Dados Pessoais)', null, 'ACTION');
        $('#tab-cep').removeClass('active').hide();
        $('#tab-dados-pessoais').addClass('active').show();
        state.updateProgressBar('tab-dados-pessoais');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-voltar-cep').on('click', function (e) {
        e.preventDefault();
        state.log('ACTION    Clique em "Voltar" (Endereço -> CEP)', null, 'ACTION');
        $('#tab-dados-entrega').removeClass('active').hide();
        $('#tab-cep').addClass('active').show();
        state.updateProgressBar('tab-cep');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-avancar-para-resumo').on('click', function (e) {
        e.preventDefault();
        state.actionStartTime = performance.now();
        state.log('ACTION    Clique em "Avançar para o Resumo" (Endereço -> Resumo/Frete)', null, 'ACTION');

        var endereco1Valido = ($('#billing_address_1').val() || '').trim().length > 2;
        var bairroValido = ($('#billing_neighborhood').val() || '').trim().length > 1;
        var cidadeValida = ($('#billing_city').val() || '').trim().length > 1;
        var estadoValido = ($('#billing_state').val() || '') !== '';
        var numeroValido = ($('#billing_number').val() || '').trim().length > 0;

        if (!endereco1Valido || !bairroValido || !cidadeValida || !estadoValido || !numeroValido) {
          alert('Por favor, preencha todos os campos obrigatórios de Endereço.');
          return;
        }

        $('#tab-dados-entrega').removeClass('active').hide();
        $('#tab-resumo-frete').addClass('active').show();
        state.updateProgressBar('tab-resumo-frete');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-voltar-endereco').on('click', function (e) {
        e.preventDefault();
        state.log('ACTION    Clique em "Voltar" (Resumo/Frete -> Endereço)', null, 'ACTION');
        $('#tab-resumo-frete').removeClass('active').hide();
        $('#tab-dados-entrega').addClass('active').show();
        state.updateProgressBar('tab-dados-entrega');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-avancar-para-pagamento').on('click', function (e) {
        e.preventDefault();
        state.actionStartTime = performance.now();
        state.log('ACTION    Clique em "Avançar para Pagamento" (Resumo/Frete -> Pagamento)', null, 'ACTION');
        $('#tab-resumo-frete').removeClass('active').hide();
        $('#tab-pagamento').addClass('active').show();
        state.updateProgressBar('tab-pagamento');
        state.updatePlaceOrderButtonState();
      });

      $('#btn-voltar-resumo').on('click', function (e) {
        e.preventDefault();
        state.log('ACTION    Clique em "Voltar" (Pagamento -> Resumo/Frete)', null, 'ACTION');
        $('#tab-pagamento').removeClass('active').hide();
        $('#tab-resumo-frete').addClass('active').show();
        state.updateProgressBar('tab-resumo-frete');
        state.updatePlaceOrderButtonState();
      });
    };
  };
})(window);


