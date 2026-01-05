(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupAddressModal = function setupAddressModal(state) {
    var $ = state.$;

    function isLoggedIn() {
      return !!(state.params && (state.params.is_logged_in === 1 || state.params.is_logged_in === '1'));
    }

    function ensureModal() {
      if ($('#ctwpml-address-modal-overlay').length) return;

      $('body').append(
        '' +
          '<div id="ctwpml-address-modal-overlay" class="ctwpml-modal-overlay">' +
          '  <div class="ctwpml-modal" role="dialog" aria-modal="true" aria-label="Meus endereços">' +
          '    <div class="ctwpml-modal-header">' +
          '      <button type="button" class="ctwpml-modal-back" id="ctwpml-modal-back">←</button>' +
          '      <div class="ctwpml-modal-title" id="ctwpml-modal-title">Meus endereços</div>' +
          '    </div>' +
          '    <div class="ctwpml-modal-body">' +
          '      <div id="ctwpml-view-list">' +
          '        <div class="ctwpml-section-title">Escolha onde você quer receber sua compra</div>' +
          '        <div class="ctwpml-card">' +
          '          <div class="ctwpml-radio-selected"></div>' +
          '          <div class="ctwpml-address">' +
          '            <h3 id="ctwpml-addr-title">Endereço do checkout</h3>' +
          '            <p id="ctwpml-addr-line"></p>' +
          '            <p id="ctwpml-addr-name" style="margin-top:6px;"></p>' +
          '          </div>' +
          '        </div>' +
          '      </div>' +
          '      <div id="ctwpml-view-form" style="display:none;">' +
          '        <div class="ctwpml-section-title">Adicione um endereço</div>' +
          '        <div class="ctwpml-form-group">' +
          '          <label for="ctwpml-input-cep">CEP</label>' +
          '          <input id="ctwpml-input-cep" type="text" placeholder="Ex.: 05410001" inputmode="numeric" />' +
          '          <a class="ctwpml-link-right" href="#" id="ctwpml-nao-sei-cep">Não sei meu CEP</a>' +
          '        </div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-rua">Rua / Avenida</label><input id="ctwpml-input-rua" type="text" placeholder="Ex.: Avenida..." /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-numero">Número</label><input id="ctwpml-input-numero" type="text" placeholder="Ex.: 123" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-comp">Complemento (opcional)</label><input id="ctwpml-input-comp" type="text" placeholder="Ex.: Apto 201" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-info">Informações adicionais (opcional)</label><textarea id="ctwpml-input-info" rows="3" placeholder="Ex.: Entre ruas..."></textarea></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-nome">Nome completo</label><input id="ctwpml-input-nome" type="text" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-fone">Telefone de contato</label><input id="ctwpml-input-fone" type="text" /></div>' +
          '      </div>' +
          '    </div>' +
          '    <div class="ctwpml-footer">' +
          '      <button type="button" class="ctwpml-btn ctwpml-btn-primary" id="ctwpml-btn-primary">Continuar</button>' +
          '      <button type="button" class="ctwpml-btn ctwpml-btn-secondary" id="ctwpml-btn-secondary">Adicionar novo endereço</button>' +
          '    </div>' +
          '  </div>' +
          '</div>'
      );
    }

    function openModal() {
      if (!isLoggedIn()) return;
      ensureModal();
      refreshFromCheckoutFields();
      showList();
      $('#ctwpml-address-modal-overlay').css('display', 'flex');
    }

    function openLoginPopup() {
      // Usa Fancybox existente no site (sem duplicar libs).
      if (isLoggedIn()) return;
      if (!($.fancybox && typeof $.fancybox.open === 'function')) return;
      if (!$('#login-popup').length) return;
      $.fancybox.open({
        src: '#login-popup',
        type: 'inline',
        touch: false,
        smallBtn: false,
        toolbar: false,
        buttons: [],
      });
    }

    function closeModal() {
      $('#ctwpml-address-modal-overlay').hide();
    }

    function showList() {
      $('#ctwpml-modal-title').text('Meus endereços');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').show();
      $('#ctwpml-btn-primary').text('Continuar');
      $('#ctwpml-btn-secondary').text('Adicionar novo endereço');
    }

    function showForm() {
      $('#ctwpml-modal-title').text('Adicione um endereço');
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-form').show();
      $('#ctwpml-btn-primary').text('Salvar');
      $('#ctwpml-btn-secondary').text('Voltar');
      prefillFormFromCheckout();
    }

    function refreshFromCheckoutFields() {
      var rua = ($('#billing_address_1').val() || '').trim();
      var numero = ($('#billing_number').val() || '').trim();
      var bairro = ($('#billing_neighborhood').val() || '').trim();
      var cidade = ($('#billing_city').val() || '').trim();
      var uf = ($('#billing_state').val() || '').trim();
      var cep = ($('#billing_postcode').val() || '').trim();

      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      var nome = (first + ' ' + last).trim();

      $('#ctwpml-addr-title').text((rua || 'Endereço do checkout') + (numero ? ' ' + numero : ''));
      $('#ctwpml-addr-line').text([bairro, cidade, uf, cep ? 'CEP ' + cep : ''].filter(Boolean).join(', '));
      $('#ctwpml-addr-name').text(nome);
    }

    function prefillFormFromCheckout() {
      $('#ctwpml-input-cep').val((($('#billing_postcode').val() || '').replace(/\D/g, '') || '').trim());
      $('#ctwpml-input-rua').val((($('#billing_address_1').val() || '') || '').trim());
      $('#ctwpml-input-numero').val((($('#billing_number').val() || '') || '').trim());
      $('#ctwpml-input-comp').val((($('#billing_complemento').val() || '') || '').trim());

      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      $('#ctwpml-input-nome').val((first + ' ' + last).trim());
      $('#ctwpml-input-fone').val((($('#billing_cellphone').val() || '') || '').trim());
    }

    function applyFormToCheckout() {
      var cepDigits = ($('#ctwpml-input-cep').val() || '').replace(/\D/g, '');
      if (cepDigits) $('#billing_postcode').val(cepDigits).trigger('change');

      var rua = ($('#ctwpml-input-rua').val() || '').trim();
      if (rua) $('#billing_address_1').val(rua).trigger('change');

      var numero = ($('#ctwpml-input-numero').val() || '').trim();
      if (numero) $('#billing_number').val(numero).trigger('change');

      var comp = ($('#ctwpml-input-comp').val() || '').trim();
      if (comp) $('#billing_complemento').val(comp).trigger('change');

      var nome = ($('#ctwpml-input-nome').val() || '').trim();
      if (nome) {
        var parts = nome.split(' ');
        $('#billing_first_name').val(parts.shift() || '').trigger('change');
        $('#billing_last_name').val(parts.join(' ')).trigger('change');
      }

      var fone = ($('#ctwpml-input-fone').val() || '').trim();
      if (fone) $('#billing_cellphone').val(fone).trigger('change');
    }

    function ensureEntryPointButton() {
      if (!isLoggedIn()) return;
      if (!$('#tab-cep').length) return;
      if ($('#ctwpml-open-address-modal').length) return;
      $('#tab-cep').prepend(
        '<button type="button" id="ctwpml-open-address-modal" class="ctwpml-btn ctwpml-btn-secondary" style="margin: 0 0 12px;">Meus endereços</button>'
      );
    }

    // Bindings
    $(document).on('click', '#ctwpml-open-address-modal', function (e) {
      e.preventDefault();
      openModal();
    });
    $(document).on('click', '#ctwpml-modal-back', function () {
      closeModal();
    });
    $(document).on('click', '#ctwpml-btn-secondary', function () {
      if ($('#ctwpml-view-form').is(':visible')) showList();
      else showForm();
    });
    $(document).on('click', '#ctwpml-btn-primary', function () {
      if ($('#ctwpml-view-form').is(':visible')) {
        applyFormToCheckout();
        closeModal();
        // Usa o fluxo atual do plugin para consultar CEP + salvar frete + avançar.
        $('#btn-avancar-para-endereco').trigger('click');
      } else {
        closeModal();
      }
    });
    $(document).on('click', '#ctwpml-nao-sei-cep', function (e) {
      e.preventDefault();
      alert('Fluxo “Não sei meu CEP” será implementado na próxima etapa (3).');
    });

    // Reforço: quando a estrutura de abas é criada, injeta o botão de entrada.
    // Elementor pode renderizar tarde, então tentamos algumas vezes.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      ensureEntryPointButton();
      if ($('#ctwpml-open-address-modal').length || tries > 20) clearInterval(t);
    }, 500);

    // NOVO: iniciar fluxo automaticamente ao entrar no /checkout.
    // - logado: abre modal ML
    // - deslogado: abre popup de login (Fancybox)
    setTimeout(function () {
      try {
        if (isLoggedIn()) openModal();
        else openLoginPopup();
      } catch (e) {
        // ignora
      }
    }, 800);
  };
})(window);


