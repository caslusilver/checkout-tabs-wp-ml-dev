(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupAddressModal = function setupAddressModal(state) {
    var $ = state.$;
    var cepDebounceTimer = null;
    var lastCepOnly = '';
    var isClearingCep = false;
    var lastBillingCepOnly = '';
    var cepConsultedFor = '';
    var cepConsultInFlight = false;
    var selectedAddressId = null;
    var addressesCache = [];
    var isSavingAddress = false;

    function cepDigits(value) {
      return String(value || '').replace(/\D/g, '').slice(0, 8);
    }

    function formatCep(value) {
      var digits = cepDigits(value);
      if (digits.length <= 5) return digits;
      return digits.slice(0, 5) + '-' + digits.slice(5);
    }

    function phoneDigits(value) {
      return String(value || '').replace(/\D/g, '').slice(0, 11);
    }

    // Formato pedido: "XX - X XXXX-XXXX" (11 dígitos).
    function formatPhone(value) {
      var d = phoneDigits(value);
      if (!d) return '';
      if (d.length <= 2) return d;
      if (d.length <= 3) return d.slice(0, 2) + ' - ' + d.slice(2);
      if (d.length <= 7) return d.slice(0, 2) + ' - ' + d.slice(2, 3) + ' ' + d.slice(3);
      return d.slice(0, 2) + ' - ' + d.slice(2, 3) + ' ' + d.slice(3, 7) + '-' + d.slice(7);
    }

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
          '        <div id="ctwpml-address-list"></div>' +
          '      </div>' +
          '      <div id="ctwpml-view-form" style="display:none;">' +
          '        <div class="ctwpml-section-title">Adicione um endereço</div>' +
          '        <div class="ctwpml-form-group">' +
          '          <label for="ctwpml-input-cep">CEP</label>' +
          '          <input id="ctwpml-input-cep" type="text" placeholder="00000-000" inputmode="numeric" autocomplete="postal-code" />' +
          '          <a class="ctwpml-link-right" href="#" id="ctwpml-nao-sei-cep">Não sei meu CEP</a>' +
          '          <div id="ctwpml-cep-confirm" class="ctwpml-cep-confirm" aria-live="polite">' +
          '            <div class="ctwpml-cep-icon">📍</div>' +
          '            <div>' +
          '              <div class="ctwpml-cep-text" id="ctwpml-cep-confirm-text"></div>' +
          '              <div class="ctwpml-cep-subtext" id="ctwpml-cep-confirm-subtext"></div>' +
          '            </div>' +
          '          </div>' +
          '        </div>' +
          '        <div class="ctwpml-form-group" id="ctwpml-group-rua">' +
          '          <label for="ctwpml-input-rua">Rua / Avenida</label>' +
          '          <input id="ctwpml-input-rua" type="text" placeholder="Ex.: Avenida..." />' +
          '          <div class="ctwpml-inline-hint" id="ctwpml-rua-hint" style="display:none;"></div>' +
          '        </div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-numero">Número</label><input id="ctwpml-input-numero" type="text" placeholder="Ex.: 123" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-comp">Complemento (opcional)</label><input id="ctwpml-input-comp" type="text" placeholder="Ex.: Apto 201" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-info">Informações adicionais (opcional)</label><textarea id="ctwpml-input-info" rows="3" placeholder="Ex.: Entre ruas..."></textarea></div>' +
          '        <div class="ctwpml-type-label">Este é o seu trabalho ou sua casa?</div>' +
          '        <div class="ctwpml-type-option" id="ctwpml-type-home" role="button" tabindex="0">' +
          '          <div class="ctwpml-type-radio"></div>' +
          '          <span>🏠 Casa</span>' +
          '        </div>' +
          '        <div class="ctwpml-type-option" id="ctwpml-type-work" role="button" tabindex="0">' +
          '          <div class="ctwpml-type-radio"></div>' +
          '          <span>💼 Trabalho</span>' +
          '        </div>' +
          '        <div class="ctwpml-contact-section">' +
          '          <div class="ctwpml-contact-title">Dados de contato</div>' +
          '          <div class="ctwpml-contact-subtitle">Se houver algum problema no envio, você receberá uma ligação neste número.</div>' +
          '          <div class="ctwpml-form-group"><label for="ctwpml-input-nome">Nome completo</label><input id="ctwpml-input-nome" type="text" /></div>' +
          '          <div class="ctwpml-form-group"><label for="ctwpml-input-fone">Seu WhatsApp</label><input id="ctwpml-input-fone" type="text" /></div>' +
          '          <a href="#" class="ctwpml-delete-link" id="ctwpml-delete-address" style="display:none;">Excluir endereço</a>' +
          '        </div>' +
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
      loadAddresses(function () {
        showList();
        renderAddressList();
      });
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
      selectedAddressId = null;
      prefillFormFromCheckout();
    }

    function showFormForNewAddress() {
      $('#ctwpml-modal-title').text('Adicionar endereço');
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-form').show();
      $('#ctwpml-btn-primary').text('Salvar');
      $('#ctwpml-btn-secondary').text('Voltar');
      selectedAddressId = null;
      $('#ctwpml-delete-address').hide();
      lastCepOnly = '';
      cepConsultedFor = '';
      cepConsultInFlight = false;
      // Limpa campos, mas mantém nome/telefone (facilita UX no checkout).
      $('#ctwpml-input-cep').val('');
      $('#ctwpml-input-rua').val('');
      $('#ctwpml-input-numero').val('');
      $('#ctwpml-input-comp').val('');
      $('#ctwpml-input-info').val('');
      setCepConfirmVisible(false);
      setRuaHint('', false);
      clearFormErrors();
      setTypeSelection('');
      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      $('#ctwpml-input-nome').val((first + ' ' + last).trim());
      $('#ctwpml-input-fone').val(formatPhone((($('#billing_cellphone').val() || '') || '').trim()));
    }

    function showFormForEditAddress(addressId) {
      var item = getAddressById(addressId);
      if (!item) {
        showFormForNewAddress();
        return;
      }
      selectedAddressId = item.id;
      $('#ctwpml-modal-title').text('Editar endereço');
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-form').show();
      $('#ctwpml-btn-primary').text('Salvar');
      $('#ctwpml-btn-secondary').text('Voltar');
      $('#ctwpml-delete-address').show();

      $('#ctwpml-input-cep').val(formatCep(item.cep || ''));
      lastCepOnly = cepDigits(item.cep || '');
      cepConsultedFor = lastCepOnly;
      cepConsultInFlight = false;
      $('#ctwpml-input-rua').val(String(item.address_1 || ''));
      $('#ctwpml-input-numero').val(String(item.number || ''));
      $('#ctwpml-input-comp').val(String(item.complement || ''));
      $('#ctwpml-input-info').val(String(item.extra_info || ''));
      setCepConfirm(String(item.city || ''), String(item.state || ''), String(item.neighborhood || ''));
      setTypeSelection(String(item.label || ''));
      setRuaHint('', false);
      clearFormErrors();

      // Nome/telefone continuam vindo do checkout.
      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      $('#ctwpml-input-nome').val(String(item.receiver_name || (first + ' ' + last)).trim());
      $('#ctwpml-input-fone').val(formatPhone((($('#billing_cellphone').val() || '') || '').trim()));
    }

    function setTypeSelection(label) {
      label = String(label || '').toLowerCase();
      $('#ctwpml-type-home').removeClass('is-active');
      $('#ctwpml-type-work').removeClass('is-active');
      if (label === 'casa') $('#ctwpml-type-home').addClass('is-active');
      if (label === 'trabalho') $('#ctwpml-type-work').addClass('is-active');
    }

    function setRuaHint(message, visible) {
      var $hint = $('#ctwpml-rua-hint');
      if (!$hint.length) return;
      if (!visible) {
        $hint.hide().text('');
        return;
      }
      $hint.text(String(message || '')).show();
    }

    function clearFormErrors() {
      $('#ctwpml-view-form .ctwpml-form-group').removeClass('is-error');
      $('#ctwpml-view-form .ctwpml-type-option').removeClass('is-error');
    }

    function setFieldError(selectorOrGroupId, isError) {
      var $el = $(selectorOrGroupId);
      if (!$el.length) return;
      if (isError) $el.addClass('is-error');
      else $el.removeClass('is-error');
    }

    function validateForm() {
      clearFormErrors();
      var ok = true;

      var cepOnly = cepDigits($('#ctwpml-input-cep').val());
      if (cepOnly.length !== 8) {
        setFieldError('#ctwpml-input-cep', true);
        ok = false;
      }

      var rua = ($('#ctwpml-input-rua').val() || '').trim();
      if (!rua) {
        setFieldError('#ctwpml-group-rua', true);
        setRuaHint('Não encontramos Rua/Avenida automaticamente. Preencha manualmente com atenção.', true);
        ok = false;
      }

      // Campos obrigatórios server-side vêm do checkout (bairro/cidade/UF). Se estiverem vazios,
      // forçamos o usuário a revisar o CEP/consulta.
      var city = ($('#billing_city').val() || '').trim();
      var st = ($('#billing_state').val() || '').trim();
      if (!city || !st) {
        setFieldError('#ctwpml-input-cep', true);
        ok = false;
      }

      var labelOk = $('#ctwpml-type-home').hasClass('is-active') || $('#ctwpml-type-work').hasClass('is-active');
      if (!labelOk) {
        $('#ctwpml-type-home, #ctwpml-type-work').addClass('is-error');
        ok = false;
      }

      var name = ($('#ctwpml-input-nome').val() || '').trim();
      if (!name) {
        setFieldError('#ctwpml-input-nome', true);
        ok = false;
      }

      var phone = phoneDigits($('#ctwpml-input-fone').val());
      if (phone.length < 10) {
        setFieldError('#ctwpml-input-fone', true);
        ok = false;
      }

      return ok;
    }

    function getAddressById(id) {
      if (!id) return null;
      for (var i = 0; i < addressesCache.length; i++) {
        if (addressesCache[i] && String(addressesCache[i].id) === String(id)) return addressesCache[i];
      }
      return null;
    }

    function setSelectedAddressId(id) {
      selectedAddressId = id || null;
      renderAddressList();
    }

    function normalizeStringForKey(s) {
      return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '');
    }

    function addressFingerprint(it) {
      if (!it) return '';
      return [
        normalizeStringForKey(it.label),
        normalizeStringForKey(it.cep),
        normalizeStringForKey(it.address_1),
        normalizeStringForKey(it.number),
        normalizeStringForKey(it.complement),
        normalizeStringForKey(it.neighborhood),
        normalizeStringForKey(it.city),
        normalizeStringForKey(it.state),
      ].join('|');
    }

    function dedupeAddresses(items) {
      if (!Array.isArray(items)) return [];
      var out = [];
      var seen = {};
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var fp = addressFingerprint(it);
        if (!fp) {
          out.push(it);
          continue;
        }
        if (seen[fp]) continue;
        seen[fp] = true;
        out.push(it);
      }
      return out;
    }

    function formatFullAddressLine(it) {
      it = it || {};
      var label = (it.label || '').trim();
      var number = (it.number || '').trim();
      var prefix = '';
      if (label) prefix = label + (number ? ' ' + number : '');
      else if (number) prefix = number;

      var location = [];
      if (it.neighborhood) location.push(it.neighborhood);
      if (it.city) location.push(it.city);
      if (it.state) location.push(it.state);

      var line = '';
      if (prefix) line += prefix;
      if (prefix && location.length) line += ' - ';
      line += location.join(', ');
      if (it.cep) line += (line ? ', ' : '') + 'CEP ' + formatCep(it.cep);
      return line;
    }

    function renderAddressList() {
      var $list = $('#ctwpml-address-list');
      if (!$list.length) return;

      var items = dedupeAddresses(addressesCache);
      if (!items.length) {
        // Se não houver endereços, vai direto pro formulário (como no fluxo oficial).
        showFormForNewAddress();
        return;
      }

      if (!selectedAddressId) selectedAddressId = items[0].id;

      var html = '';
      for (var j = 0; j < items.length; j++) {
        var it = items[j] || {};
        var selected = String(it.id) === String(selectedAddressId);
        var title = (it.address_1 || 'Endereço') + (it.number ? ' ' + it.number : '');
        var line = formatFullAddressLine(it);
        var receiverName = (it.receiver_name || '').trim();
        if (!receiverName) {
          // Compatibilidade com endereços antigos: usa o nome do checkout se existir.
          receiverName = ($('#billing_first_name').val() || '').trim();
          var ln = ($('#billing_last_name').val() || '').trim();
          receiverName = (receiverName + ' ' + ln).trim();
        }
        html +=
          '' +
          '<div class="ctwpml-card ' +
          (selected ? 'is-selected' : '') +
          '" data-address-id="' +
          String(it.id) +
          '" style="cursor:pointer; margin-bottom: 12px;">' +
          '  <div class="ctwpml-radio-selected"></div>' +
          '  <div class="ctwpml-address">' +
          '    <h3>' +
          escapeHtml(String(title || '')) +
          '</h3>' +
          '    <p>' +
          escapeHtml(String(line || '')) +
          '</p>' +
          (receiverName ? '<p style="margin-top:5px;">' + escapeHtml(String(receiverName)) + '</p>' : '') +
          '    <a href="#" class="ctwpml-edit-link ctwpml-edit-saved-address" data-address-id="' +
          String(it.id) +
          '">Editar endereço</a>' +
          '  </div>' +
          '</div>';
      }
      $list.html(html);
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/\'/g, '&#039;');
    }

    function loadAddresses(done) {
      done = typeof done === 'function' ? done : function () {};
      if (!state.params || !state.params.ajax_url || !state.params.addresses_nonce) {
        addressesCache = [];
        done();
        return;
      }
      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_get_addresses',
          _ajax_nonce: state.params.addresses_nonce,
        },
        success: function (resp) {
          if (resp && resp.success && resp.data && Array.isArray(resp.data.items)) {
            addressesCache = dedupeAddresses(resp.data.items);
          } else {
            addressesCache = [];
          }
          done();
        },
        error: function () {
          addressesCache = [];
          done();
        },
      });
    }

    function saveAddressFromForm(done) {
      done = typeof done === 'function' ? done : function () {};
      if (!state.params || !state.params.ajax_url || !state.params.addresses_nonce) {
        done({ ok: false, message: 'AJAX indisponível.' });
        return;
      }
      if (isSavingAddress) {
        done({ ok: false, message: 'Salvando... aguarde.' });
        return;
      }
      isSavingAddress = true;
      $('#ctwpml-btn-primary').prop('disabled', true);

      var cepOnly = cepDigits($('#ctwpml-input-cep').val());
      var label = '';
      if ($('#ctwpml-type-home').hasClass('is-active')) label = 'Casa';
      if ($('#ctwpml-type-work').hasClass('is-active')) label = 'Trabalho';

      var receiverName = ($('#ctwpml-input-nome').val() || '').trim();
      var address = {
        id: selectedAddressId ? selectedAddressId : '',
        label: label,
        receiver_name: receiverName,
        cep: cepOnly,
        address_1: ($('#ctwpml-input-rua').val() || '').trim(),
        number: ($('#ctwpml-input-numero').val() || '').trim(),
        complement: ($('#ctwpml-input-comp').val() || '').trim(),
        neighborhood: ($('#billing_neighborhood').val() || '').trim(),
        city: ($('#billing_city').val() || '').trim(),
        state: ($('#billing_state').val() || '').trim(),
        extra_info: ($('#ctwpml-input-info').val() || '').trim(),
      };

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_save_address',
          _ajax_nonce: state.params.addresses_nonce,
          address: address,
        },
        success: function (resp) {
          isSavingAddress = false;
          $('#ctwpml-btn-primary').prop('disabled', false);
          if (resp && resp.success && resp.data) {
            if (Array.isArray(resp.data.items)) addressesCache = dedupeAddresses(resp.data.items);
            if (resp.data.item && resp.data.item.id) selectedAddressId = resp.data.item.id;
            done({ ok: true });
          } else {
            done({ ok: false, message: (resp && resp.data) || 'Erro ao salvar endereço.' });
          }
        },
        error: function () {
          isSavingAddress = false;
          $('#ctwpml-btn-primary').prop('disabled', false);
          done({ ok: false, message: 'Erro ao salvar endereço.' });
        },
      });
    }

    function deleteAddress(addressId, done) {
      done = typeof done === 'function' ? done : function () {};
      if (!state.params || !state.params.ajax_url || !state.params.addresses_nonce) {
        done({ ok: false, message: 'AJAX indisponível.' });
        return;
      }
      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_delete_address',
          _ajax_nonce: state.params.addresses_nonce,
          id: String(addressId || ''),
        },
        success: function (resp) {
          if (resp && resp.success && resp.data && Array.isArray(resp.data.items)) {
            addressesCache = dedupeAddresses(resp.data.items);
            done({ ok: true });
          } else {
            done({ ok: false, message: (resp && resp.data) || 'Erro ao excluir endereço.' });
          }
        },
        error: function () {
          done({ ok: false, message: 'Erro ao excluir endereço.' });
        },
      });
    }

    function setCepConfirmVisible(visible) {
      var $box = $('#ctwpml-cep-confirm');
      if (!$box.length) return;
      if (visible) $box.addClass('is-visible');
      else $box.removeClass('is-visible');
    }

    function setCepConfirm(city, uf, bairro) {
      var c = (city || '').trim();
      var s = (uf || '').trim();
      var b = (bairro || '').trim();

      if (!c && !s && !b) {
        setCepConfirmVisible(false);
        return;
      }

      // Linha principal: "Cidade, UF"
      var title = [c, s].filter(Boolean).join(', ');
      var subtitle = b ? b : '';
      $('#ctwpml-cep-confirm-text').text(title);
      $('#ctwpml-cep-confirm-subtext').text(subtitle);
      setCepConfirmVisible(true);
    }

    function fillFormFromApiData(raw) {
      if (!raw) return;
      // Reutiliza normalização do webhook.js (já registrada em state).
      var dados = raw;
      if (typeof state.normalizarRespostaAPI === 'function') {
        dados = state.normalizarRespostaAPI(raw);
      } else if (Array.isArray(raw)) {
        dados = raw.length ? raw[0] : null;
      }
      if (!dados) return;

      // Preenche inputs do modal.
      if (dados.logradouro) {
        $('#ctwpml-input-rua').val(String(dados.logradouro));
        setRuaHint('', false);
      } else {
        setRuaHint('Não encontramos Rua/Avenida automaticamente. Preencha manualmente com atenção.', true);
      }
      if (dados.numero) $('#ctwpml-input-numero').val(String(dados.numero));
      if (dados.complemento) $('#ctwpml-input-comp').val(String(dados.complemento));

      // Confirmação visual do CEP (Cidade/UF/Bairro)
      // Suporta chaves normalizadas (localidade/uf/bairro) e alternativas comuns.
      var cidade = dados.localidade || dados.cidade || dados.city || '';
      var uf = dados.uf || dados.estado || dados.state || '';
      var bairro = dados.bairro || dados.neighborhood || '';
      setCepConfirm(String(cidade || ''), String(uf || ''), String(bairro || ''));

      // Preenche campos do checkout também (inclui campos que não existem no modal).
      if (dados.logradouro) $('#billing_address_1').val(String(dados.logradouro)).trigger('change');
      if (dados.numero) $('#billing_number').val(String(dados.numero)).trigger('change');
      if (dados.bairro) $('#billing_neighborhood').val(String(dados.bairro)).trigger('change');
      if (dados.localidade) $('#billing_city').val(String(dados.localidade)).trigger('change');
      if (dados.uf) $('#billing_state').val(String(dados.uf)).trigger('change');
      if (dados.complemento) $('#billing_complemento').val(String(dados.complemento)).trigger('change');

      refreshFromCheckoutFields();
    }

    function consultCepAndFillForm() {
      var cepOnlyDigits = cepDigits($('#ctwpml-input-cep').val());
      if (cepOnlyDigits.length !== 8) return;
      if (cepConsultInFlight) return;
      if (cepConsultedFor && cepConsultedFor === cepOnlyDigits) return;

      // Preenche o checkout antes para manter consistência de estado.
      $('#billing_postcode').val(cepOnlyDigits).trigger('change');

      var payload = {
        cep: cepOnlyDigits,
        evento: 'consultaEnderecoFrete',
        whatsapp:
          typeof state.removerMascaraWhatsApp === 'function'
            ? state.removerMascaraWhatsApp($('#ctwpml-input-fone').val() || $('#billing_cellphone').val())
            : (String($('#billing_cellphone').val() || '').replace(/\D/g, '')),
        cpf: String($('#billing_cpf').val() || '').replace(/\D/g, ''),
        nome: ($('#ctwpml-input-nome').val() || ($('#billing_first_name').val() + ' ' + $('#billing_last_name').val()) || '').trim(),
      };

      if (typeof state.log === 'function') state.log('WEBHOOK_OUT (ML) Consultando CEP para preencher formulário...', payload, 'WEBHOOK_OUT');

      // Chama o mesmo webhook do plugin, sem armazenar no servidor ainda.
      cepConsultInFlight = true;
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
          cepConsultInFlight = false;
          cepConsultedFor = cepOnlyDigits;
          if (typeof state.log === 'function') state.log('WEBHOOK_IN (ML) Resposta recebida.', data, 'WEBHOOK_IN');
          fillFormFromApiData(data);
          persistAddressPayload(data);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cepConsultInFlight = false;
          if (typeof state.log === 'function')
            state.log(
              'WEBHOOK_IN (ML) Erro na consulta do CEP (' + textStatus + ').',
              { status: jqXHR.status, error: errorThrown, responseText: jqXHR.responseText },
              'WEBHOOK_IN'
            );
        },
      });
    }

    function normalizeApiPayload(raw) {
      if (!raw) return null;
      if (typeof state.normalizarRespostaAPI === 'function') {
        try {
          return state.normalizarRespostaAPI(raw);
        } catch (e) {
          return raw;
        }
      }
      return raw;
    }

    function persistAddressPayload(raw) {
      if (!raw) return;
      if (!state.params || !state.params.ajax_url || !state.params.address_payload_nonce) return;
      if (!isLoggedIn()) return;

      var normalized = normalizeApiPayload(raw);
      var out = {
        raw: raw,
        normalized: normalized,
      };

      if (typeof state.log === 'function') {
        state.log('ADDRESS_PAYLOAD_SAVE_OUT (ML) Salvando payload no perfil...', out, 'STORE_OUT');
      }

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_save_address_payload',
          _ajax_nonce: state.params.address_payload_nonce,
          raw_json: JSON.stringify(raw),
          normalized_json: JSON.stringify(normalized),
        },
        success: function (resp) {
          if (typeof state.log === 'function') {
            state.log('ADDRESS_PAYLOAD_SAVE_IN (ML) Resultado do save.', resp, 'STORE_IN');
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (typeof state.log === 'function') {
            state.log(
              'ADDRESS_PAYLOAD_SAVE_IN (ML) Erro ao salvar payload (' + textStatus + ').',
              { status: jqXHR.status, error: errorThrown, responseText: jqXHR.responseText },
              'STORE_IN'
            );
          }
        },
      });
    }

    function clearAddressFieldsOnCepChange() {
      if (isClearingCep) return;
      isClearingCep = true;
      try {
        // Modal inputs
        $('#ctwpml-input-rua').val('');
        $('#ctwpml-input-numero').val('');
        $('#ctwpml-input-comp').val('');
        $('#ctwpml-input-info').val('');
        setCepConfirmVisible(false);

        // Checkout fields (limpa tudo exceto o CEP)
        $('#billing_address_1').val('').trigger('change');
        $('#billing_number').val('').trigger('change');
        $('#billing_neighborhood').val('').trigger('change');
        $('#billing_city').val('').trigger('change');
        $('#billing_state').val('').trigger('change');
        $('#billing_complemento').val('').trigger('change');
        cepConsultedFor = '';
        cepConsultInFlight = false;
      } finally {
        isClearingCep = false;
      }
    }

    function onBillingCepChanged() {
      var only = cepDigits($('#billing_postcode').val());
      if (only === lastBillingCepOnly) return;
      lastBillingCepOnly = only;
      clearAddressFieldsOnCepChange();
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
      var cepVal = formatCep($('#billing_postcode').val());
      $('#ctwpml-input-cep').val(cepVal);
      lastCepOnly = cepDigits(cepVal);
      lastBillingCepOnly = lastCepOnly;
      cepConsultedFor = lastCepOnly;
      cepConsultInFlight = false;
      $('#ctwpml-input-rua').val((($('#billing_address_1').val() || '') || '').trim());
      $('#ctwpml-input-numero').val((($('#billing_number').val() || '') || '').trim());
      $('#ctwpml-input-comp').val((($('#billing_complemento').val() || '') || '').trim());
      setRuaHint('', false);
      clearFormErrors();

      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      $('#ctwpml-input-nome').val((first + ' ' + last).trim());
      $('#ctwpml-input-fone').val(formatPhone((($('#billing_cellphone').val() || '') || '').trim()));

      // Confirmação visual usando campos do checkout (se já preenchidos)
      var cidade = ($('#billing_city').val() || '').trim();
      var uf = ($('#billing_state').val() || '').trim();
      var bairro = ($('#billing_neighborhood').val() || '').trim();
      setCepConfirm(cidade, uf, bairro);
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
      if (fone) $('#billing_cellphone').val(phoneDigits(fone)).trigger('change');
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
    $(document).on('click', '#ctwpml-edit-address', function (e) {
      e.preventDefault();
      // Editar endereço do checkout (não persiste)
      showForm();
    });

    $(document).on('click', '.ctwpml-edit-saved-address', function (e) {
      e.preventDefault();
      var id = $(this).data('address-id');
      showFormForEditAddress(id);
    });

    $(document).on('click', '#ctwpml-type-home', function (e) {
      e.preventDefault();
      setTypeSelection('Casa');
    });
    $(document).on('click', '#ctwpml-type-work', function (e) {
      e.preventDefault();
      setTypeSelection('Trabalho');
    });

    $(document).on('click', '#ctwpml-delete-address', function (e) {
      e.preventDefault();
      if (!selectedAddressId) return;
      if (!window.confirm('Excluir este endereço?')) return;
      deleteAddress(selectedAddressId, function (res) {
        if (!res || !res.ok) {
          alert((res && res.message) || 'Erro ao excluir endereço.');
          return;
        }
        selectedAddressId = null;
        showList();
        renderAddressList();
      });
    });

    $(document).on('click', '#ctwpml-address-list .ctwpml-card', function (e) {
      // Se clicar no link, não trata como seleção aqui.
      if ($(e.target).closest('a').length) return;
      var id = $(this).data('address-id');
      setSelectedAddressId(id);
    });
    $(document).on('click', '#ctwpml-btn-secondary', function () {
      if ($('#ctwpml-view-form').is(':visible')) {
        showList();
        renderAddressList();
      } else {
        showFormForNewAddress();
      }
    });
    $(document).on('click', '#ctwpml-btn-primary', function () {
      if ($('#ctwpml-view-form').is(':visible')) {
        if (!validateForm()) {
          return;
        }
        applyFormToCheckout();
        saveAddressFromForm(function (res) {
          if (!res || !res.ok) {
            alert((res && res.message) || 'Erro ao salvar endereço.');
            return;
          }
          showList();
          renderAddressList();
        });
      } else {
        // Continuar: aplica o endereço selecionado (se for salvo) e segue o fluxo atual.
        if (selectedAddressId) {
          var it = getAddressById(selectedAddressId);
          if (it) {
            $('#billing_postcode').val(String(it.cep || '')).trigger('change');
            if (it.address_1) $('#billing_address_1').val(String(it.address_1)).trigger('change');
            if (it.number) $('#billing_number').val(String(it.number)).trigger('change');
            if (it.complement) $('#billing_complemento').val(String(it.complement)).trigger('change');
            if (it.neighborhood) $('#billing_neighborhood').val(String(it.neighborhood)).trigger('change');
            if (it.city) $('#billing_city').val(String(it.city)).trigger('change');
            if (it.state) $('#billing_state').val(String(it.state)).trigger('change');
            refreshFromCheckoutFields();
          }
        }
        closeModal();
        $('#btn-avancar-para-endereco').trigger('click');
      }
    });
    $(document).on('click', '#ctwpml-nao-sei-cep', function (e) {
      e.preventDefault();
      alert('Fluxo “Não sei meu CEP” será implementado na próxima etapa (3).');
    });

    // Tela 2: ao preencher o CEP, consulta webhook e preenche campos automaticamente.
    $(document).on('input', '#ctwpml-input-cep', function () {
      var $input = $('#ctwpml-input-cep');
      var formatted = formatCep($input.val());
      if ($input.val() !== formatted) $input.val(formatted);

      var only = cepDigits($input.val());
      if (only !== lastCepOnly) {
        lastCepOnly = only;
        clearAddressFieldsOnCepChange();
      }

      if (cepDebounceTimer) clearTimeout(cepDebounceTimer);
      cepDebounceTimer = setTimeout(function () {
        consultCepAndFillForm();
      }, 250);
    });

    // Mobile: ao sair do campo (OK/Next no teclado), dispara consulta se CEP tiver 8 dígitos.
    $(document).on('blur', '#ctwpml-input-cep', function () {
      consultCepAndFillForm();
    });

    // Ao editar qualquer campo, remove estado de erro para feedback imediato.
    $(document).on('input change', '#ctwpml-view-form input, #ctwpml-view-form textarea', function () {
      $(this).closest('.ctwpml-form-group').removeClass('is-error');
      if ($(this).is('#ctwpml-input-rua')) setRuaHint('', false);
    });

    // Se o usuário alterar o CEP direto no checkout (fora do modal), limpamos os campos também.
    $(document).on('input change', '#billing_postcode', function () {
      onBillingCepChanged();
    });

    // Máscara/regex do celular no modal (XX - X XXXX-XXXX)
    $(document).on('input', '#ctwpml-input-fone', function () {
      var $input = $('#ctwpml-input-fone');
      var formatted = formatPhone($input.val());
      if ($input.val() !== formatted) $input.val(formatted);
      // Mantém o campo real do checkout com dígitos (máscaras do tema/plugin podem formatar depois).
      $('#billing_cellphone').val(phoneDigits(formatted)).trigger('change');
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


