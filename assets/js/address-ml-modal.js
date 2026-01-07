(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupAddressModal = function setupAddressModal(state) {
    console.log('[CTWPML][DEBUG] setupAddressModal() - INICIANDO');
    console.log('[CTWPML][DEBUG] setupAddressModal() - AddressMlScreens disponível:', !!(window.CCCheckoutTabs && window.CCCheckoutTabs.AddressMlScreens));
    if (window.CCCheckoutTabs && window.CCCheckoutTabs.AddressMlScreens) {
      console.log('[CTWPML][DEBUG] setupAddressModal() - renderInitial:', typeof window.CCCheckoutTabs.AddressMlScreens.renderInitial);
      console.log('[CTWPML][DEBUG] setupAddressModal() - renderShippingPlaceholder:', typeof window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder);
    }

    var $ = state.$;
    var cepDebounceTimer = null;
    var lastCepOnly = '';
    var isClearingCep = false;
    var lastBillingCepOnly = '';
    var cepConsultedFor = '';
    var cepConsultInFlight = false;
    var selectedAddressId = null;
    var currentView = 'list'; // initial | list | form | shipping
    var addressesCache = [];
    var addressesCacheTimestamp = null;
    var CACHE_DURATION = 60000; // 1 minuto
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

    // Spinner azul + blur backdrop para operações AJAX
    function showModalSpinner() {
      if (!$('#ctwpml-modal-spinner').length) {
        $('#ctwpml-address-modal-overlay').append(
          '<div id="ctwpml-modal-spinner" style="' +
            'position:fixed;' +
            'top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.3);' +
            'backdrop-filter:blur(2px);' +
            '-webkit-backdrop-filter:blur(2px);' +
            'display:flex;align-items:center;justify-content:center;' +
            'z-index:99999;' +
            '">' +
            '<div class="ctwpml-spinner" style="' +
              'width:50px;height:50px;' +
              'border:4px solid rgba(0,117,255,0.2);' +
              'border-top-color:#0075ff;' +
              'border-radius:50%;' +
              'animation:ctwpml-spin 0.8s linear infinite;' +
            '"></div>' +
            '</div>'
        );
      } else {
        $('#ctwpml-modal-spinner').show();
      }
      // Bloqueia interação apenas dentro do overlay (evita “clique morto” global)
      $('#ctwpml-address-modal-overlay').css('pointer-events', 'none');
      $('#ctwpml-modal-spinner').css('pointer-events', 'auto');
    }

    function hideModalSpinner() {
      $('#ctwpml-modal-spinner').hide();
      $('#ctwpml-address-modal-overlay').css('pointer-events', '');
    }

    /**
     * Exibe notificação toast para o usuário
     * @param {string} message - Mensagem a exibir
     * @param {string} type - Tipo: 'success' ou 'error'
     * @param {number} duration - Duração em ms (padrão: 3000)
     */
    function showNotification(message, type, duration) {
      type = type || 'success';
      duration = duration || 3000;

      var bgColor = type === 'success' ? '#067647' : '#b42318';
      var textColor = '#fff';
      var icon = type === 'success' ? '✓' : '✕';

      var $notif = $('<div class="ctwpml-notification">')
        .html(
          '<span class="ctwpml-notification-icon" style="font-size: 18px;">' +
            icon +
            '</span>' +
            '<span class="ctwpml-notification-text">' +
            String(message) +
            '</span>'
        )
        .css({
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          'background-color': bgColor,
          color: textColor,
          padding: '14px 24px',
          'border-radius': '8px',
          'font-weight': '700',
          'font-size': '15px',
          'z-index': '999999',
          'box-shadow': '0 4px 16px rgba(0,0,0,0.2)',
          opacity: '0',
          transition: 'opacity 0.3s ease',
          display: 'flex',
          'align-items': 'center',
          gap: '10px',
          'max-width': '90%',
          'text-align': 'center',
        });

      $('body').append($notif);

      // Fade in
      setTimeout(function () {
        $notif.css('opacity', '1');
      }, 100);

      // Fade out e remover
      setTimeout(function () {
        $notif.css('opacity', '0');
        setTimeout(function () {
          $notif.remove();
        }, 300);
      }, duration);

      // Log para debug
      state.log('UI        Notificação exibida: ' + message, { type: type }, 'UI');
    }

    function ensureModal() {
      if ($('#ctwpml-address-modal-overlay').length) return;

      // Modo fullscreen: insere no topo do checkout (antes das abas antigas)
      var $checkoutForm = $('form.checkout').first();
      var $tabsRoot = $('#cc-checkout-tabs-root');
      var $insertTarget = $tabsRoot.length ? $tabsRoot : $checkoutForm;

      if (!$insertTarget.length) {
        // Fallback: body
        $insertTarget = $('body');
        console.log('[CTWPML][DEBUG] ensureModal() - usando body como fallback');
      }

      console.log('[CTWPML][DEBUG] ensureModal() - inserindo componente ML antes de:', $insertTarget.attr('id') || $insertTarget.prop('tagName'));

      $insertTarget.before(
        '' +
          '<div id="ctwpml-address-modal-overlay" class="ctwpml-modal-overlay">' +
          '  <div class="ctwpml-modal" role="dialog" aria-modal="true" aria-label="Meus endereços">' +
          '    <div class="ctwpml-modal-header">' +
          '      <button type="button" class="ctwpml-modal-back" id="ctwpml-modal-back"><img src="' + (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/arrow-back.png" alt="Voltar" /></button>' +
          '      <div class="ctwpml-modal-title" id="ctwpml-modal-title">Meus endereços</div>' +
          '    </div>' +
          '    <div class="ctwpml-modal-body">' +
          '      <div id="ctwpml-view-initial" style="display:none;"></div>' +
          '      <div id="ctwpml-view-shipping" style="display:none;"></div>' +
          '      <div id="ctwpml-view-list">' +
          '        <div class="ctwpml-section-title">Escolha onde você quer receber sua compra</div>' +
          '        <div id="ctwpml-address-list"></div>' +
          '      </div>' +
          '      <div id="ctwpml-view-form" style="display:none;">' +
          '        <div class="ctwpml-section-title">Adicione um endereço</div>' +
          '        <div id="ctwpml-login-banner" class="ctwpml-login-banner" style="display:none;"></div>' +
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
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-numero">Número</label><input id="ctwpml-input-numero" type="text" placeholder="Ex.: 123 ou SN" /></div>' +
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
          '          <div class="ctwpml-form-group"><label for="ctwpml-input-fone">Seu WhatsApp</label><input id="ctwpml-input-fone" type="tel" inputmode="tel" placeholder="11 9 1234-5678" /></div>' +
          '          <div class="ctwpml-form-group" id="ctwpml-group-cpf">' +
          '            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">' +
          '              <label for="ctwpml-input-cpf" style="margin:0;">CPF</label>' +
          '              <a class="ctwpml-link-right" href="#" id="ctwpml-generate-cpf-modal" style="position:static; display:none;">Gerar CPF fictício</a>' +
          '            </div>' +
          '            <input id="ctwpml-input-cpf" type="text" placeholder="000.000.000-00" inputmode="numeric" autocomplete="off" />' +
          '            <div class="ctwpml-inline-hint" id="ctwpml-cpf-hint" style="display:none;">Este CPF é fictício e serve apenas para identificar seus pedidos. Guarde este número caso precise retirar encomendas nos Correios.</div>' +
          '          </div>' +
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

    function setFooterVisible(visible) {
      if (visible) $('.ctwpml-footer').show();
      else $('.ctwpml-footer').hide();
    }

    function showInitial() {
      state.log('UI        [DEBUG] showInitial() chamado', { selectedAddressId: selectedAddressId, addressesCacheLength: addressesCache.length }, 'UI');
      console.log('[CTWPML][DEBUG] showInitial() - selectedAddressId:', selectedAddressId, 'cache:', addressesCache.length);

      currentView = 'initial';
      $('#ctwpml-modal-title').text('Escolha a forma de entrega');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-initial').show();
      setFooterVisible(false);

      var it = selectedAddressId ? getAddressById(selectedAddressId) : null;
      state.log('UI        [DEBUG] showInitial() - endereço encontrado:', { address: it }, 'UI');
      console.log('[CTWPML][DEBUG] showInitial() - endereço:', it);

      var hasScreensModule = !!(window.CCCheckoutTabs && window.CCCheckoutTabs.AddressMlScreens && typeof window.CCCheckoutTabs.AddressMlScreens.renderInitial === 'function');
      state.log('UI        [DEBUG] showInitial() - AddressMlScreens disponível:', { hasScreensModule: hasScreensModule }, 'UI');
      console.log('[CTWPML][DEBUG] showInitial() - AddressMlScreens disponível:', hasScreensModule);

      if (hasScreensModule) {
        var html = window.CCCheckoutTabs.AddressMlScreens.renderInitial(it);
        console.log('[CTWPML][DEBUG] showInitial() - HTML gerado (primeiros 300 chars):', html ? html.substring(0, 300) : 'null');
        $('#ctwpml-view-initial').html(html);
        state.log('UI        [DEBUG] showInitial() - HTML injetado em #ctwpml-view-initial', {}, 'UI');
      } else {
        console.log('[CTWPML][DEBUG] showInitial() - AddressMlScreens NÃO disponível, usando fallback');
        $('#ctwpml-view-initial').html('<div class="ctwpml-section-title">Endereço (fallback - scripts não carregaram)</div>');
        state.log('ERROR     [DEBUG] showInitial() - AddressMlScreens NÃO disponível!', {}, 'ERROR');
      }

      // Verificar se o HTML foi injetado
      var initialContent = $('#ctwpml-view-initial').html();
      console.log('[CTWPML][DEBUG] showInitial() - conteúdo final de #ctwpml-view-initial (primeiros 200 chars):', initialContent ? initialContent.substring(0, 200) : 'vazio');
    }

    function showShippingPlaceholder() {
      state.log('UI        [DEBUG] showShippingPlaceholder() chamado', { selectedAddressId: selectedAddressId }, 'UI');
      console.log('[CTWPML][DEBUG] showShippingPlaceholder() - selectedAddressId:', selectedAddressId);

      currentView = 'shipping';
      $('#ctwpml-modal-title').text('Checkout');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').show();
      setFooterVisible(false);

      var it = selectedAddressId ? getAddressById(selectedAddressId) : null;
      console.log('[CTWPML][DEBUG] showShippingPlaceholder() - endereço:', it);

      var hasScreensModule = !!(window.CCCheckoutTabs && window.CCCheckoutTabs.AddressMlScreens && typeof window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder === 'function');
      console.log('[CTWPML][DEBUG] showShippingPlaceholder() - AddressMlScreens disponível:', hasScreensModule);

      if (hasScreensModule) {
        var html = window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder(it);
        console.log('[CTWPML][DEBUG] showShippingPlaceholder() - HTML gerado (primeiros 300 chars):', html ? html.substring(0, 300) : 'null');
        $('#ctwpml-view-shipping').html(html);
      } else {
        console.log('[CTWPML][DEBUG] showShippingPlaceholder() - AddressMlScreens NÃO disponível');
        $('#ctwpml-view-shipping').html('<div class="ctwpml-section-title">Escolha quando sua compra chegará (fallback)</div>');
      }
    }

    function syncLoginBanner() {
      var email = (state.params && state.params.user_email) ? String(state.params.user_email) : '';
      if (!email) {
        $('#ctwpml-login-banner').hide().text('');
        return;
      }
      $('#ctwpml-login-banner')
        .text('Bem-vindo, você está logado como ' + email + '.')
        .show();
    }

    function cpfDigitsOnly(value) {
      return String(value || '').replace(/\D/g, '').slice(0, 11);
    }

    function formatCpf(value) {
      var d = cpfDigitsOnly(value);
      if (d.length <= 3) return d;
      if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
      if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
      return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
    }

    function calcCpfVerifier(baseDigits, startWeight) {
      var sum = 0;
      for (var i = 0; i < baseDigits.length; i++) {
        sum += parseInt(baseDigits[i], 10) * (startWeight - i);
      }
      var r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    }

    function generateFakeCpfDigits() {
      while (true) {
        var base = '';
        for (var i = 0; i < 9; i++) base += String(Math.floor(Math.random() * 10));
        if (/^(\d)\1{8}$/.test(base)) continue;
        var d1 = calcCpfVerifier(base, 10);
        var d2 = calcCpfVerifier(base + String(d1), 11);
        var cpf = base + String(d1) + String(d2);
        if (!(/^(\d)\1{10}$/.test(cpf))) return cpf;
      }
    }

    function isCpfLocked() {
      var $cpf = getBillingCpfInput();
      if (!$cpf.length) return false;
      // Se o checkout marcou readonly, espelhamos no modal.
      return $cpf.is('[readonly]') || $cpf.is(':disabled');
    }

    function getBillingCpfInput() {
      var $cpf = $('#billing_cpf');
      if ($cpf.length) return $cpf;
      $cpf = $('input[name="billing_cpf"]').first();
      if ($cpf.length) return $cpf;
      return $();
    }

    function logAny(message, data) {
      try {
        if (typeof state.log === 'function') {
          state.log(message, data || {}, 'CTWPML');
          return;
        }
      } catch (e) {}
      try {
        if (data) console.log('[CTWPML]', message, data);
        else console.log('[CTWPML]', message);
      } catch (e) {}
    }

    function syncCpfUiFromCheckout() {
      var locked = isCpfLocked();
      var $cpf = getBillingCpfInput();
      var cpfVal = $cpf.length ? $cpf.val() || '' : '';
      $('#ctwpml-input-cpf').val(formatCpf(cpfVal));
      $('#ctwpml-input-cpf').prop('readonly', locked);

      var allow = !!(state.params && (state.params.allow_fake_cpf === 1 || state.params.allow_fake_cpf === '1'));
      $('#ctwpml-generate-cpf-modal').css('display', allow && !locked ? 'inline-block' : 'none');
    }

    function loadContactMeta() {
      if (!isLoggedIn()) return;

      state.log('UI        Carregando dados de contato do perfil...', {}, 'UI');

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        data: {
          action: 'ctwpml_get_contact_meta',
        },
        success: function (response) {
          if (response && response.success && response.data) {
            var whatsapp = response.data.whatsapp || '';
            var cpf = response.data.cpf || '';
            var cpfLocked = response.data.cpf_locked || false;

            state.log('UI        Dados de contato carregados', { 
              whatsapp: whatsapp, 
              cpf: cpf,
              cpfLocked: cpfLocked 
            }, 'UI');

            if (whatsapp) {
              $('#ctwpml-input-fone').val(formatPhone(whatsapp));
            }

            if (cpf) {
              $('#ctwpml-input-cpf').val(formatCpf(cpf));
              if (cpfLocked) {
                $('#ctwpml-input-cpf').prop('readonly', true);
                $('#ctwpml-generate-cpf-modal').hide();
              }
            }
          } else {
            state.log('UI        Nenhum dado de contato encontrado no perfil', {}, 'UI');
          }
        },
        error: function (xhr, status, error) {
          state.log('UI        Erro ao carregar dados de contato', { 
            status: status, 
            error: error 
          }, 'UI');
        },
      });
    }

    function saveContactMeta(callback) {
      if (!isLoggedIn()) {
        if (callback) callback();
        return;
      }

      // IMPORTANTE: Remover máscara do WhatsApp antes de enviar
      var whatsappRaw = $('#ctwpml-input-fone').val() || '';
      var whatsappDigits = phoneDigits(whatsappRaw); // Remove formatação
      var cpfRaw = $('#ctwpml-input-cpf').val() || '';
      var cpfDigits = cpfDigitsOnly(cpfRaw); // Remove formatação

      state.log('UI        Salvando dados de contato', { 
        whatsapp: whatsappDigits, 
        cpf: cpfDigits 
      }, 'UI');

      showModalSpinner();

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        data: {
          action: 'ctwpml_save_contact_meta',
          whatsapp: whatsappDigits,
          cpf: cpfDigits,
        },
        success: function (response) {
          if (response && response.success) {
            state.log('UI        Dados de contato salvos com sucesso', response.data, 'UI');
            if (response.data && response.data.cpf_locked) {
              $('#ctwpml-input-cpf').prop('readonly', true);
              $('#ctwpml-generate-cpf-modal').hide();
            }
            // Feedback de sucesso para contato também (se salvar apenas contato)
            showNotification('Dados de contato salvos com sucesso!', 'success', 2000);
          } else {
            var errorMsg = (response && response.data && response.data.message) || 'Erro ao salvar dados de contato';
            showNotification(errorMsg, 'error', 3000);
            state.log('UI        Erro ao salvar dados de contato', response, 'UI');
          }
          if (callback) callback(response);
        },
        error: function (xhr, status, error) {
          state.log('UI        Erro AJAX ao salvar dados de contato', { 
            status: status, 
            error: error,
            responseText: xhr.responseText 
          }, 'UI');
          showNotification('Erro ao salvar dados. Tente novamente.', 'error', 3000);
          if (callback) callback();
        },
        complete: function () {
          hideModalSpinner();
        },
      });
    }

    function openModal() {
      state.log('UI        [DEBUG] openModal() chamado', { isLoggedIn: isLoggedIn() }, 'UI');
      console.log('[CTWPML][DEBUG] openModal() - isLoggedIn:', isLoggedIn());

      if (!isLoggedIn()) {
        console.log('[CTWPML][DEBUG] openModal() - usuário NÃO logado, abortando');
        return;
      }

      ensureModal();
      refreshFromCheckoutFields();
      
      // Modo fullscreen: mostrar componente inline e esconder abas antigas
      $('#ctwpml-address-modal-overlay').css('display', 'block');
      $('#cc-checkout-tabs-root').hide();
      console.log('[CTWPML][DEBUG] openModal() - componente ML exibido, abas antigas escondidas');
      
      // Mostrar spinner enquanto carrega endereços
      showModalSpinner();
      
      loadAddresses(function () {
        hideModalSpinner();
        var items = dedupeAddresses(addressesCache);
        state.log('UI        [DEBUG] openModal() - loadAddresses callback', { itemsLength: items.length, selectedAddressId: selectedAddressId }, 'UI');
        console.log('[CTWPML][DEBUG] openModal() - loadAddresses callback - items:', items.length, 'selectedAddressId:', selectedAddressId);

        if (!items.length) {
          // Se não houver endereços, vai direto pro formulário (fluxo atual).
          console.log('[CTWPML][DEBUG] openModal() - sem endereços, mostrando formulário');
          showFormForNewAddress();
          return;
        }
        if (!selectedAddressId) {
          selectedAddressId = items[0].id;
          console.log('[CTWPML][DEBUG] openModal() - selectedAddressId definido para:', selectedAddressId);
        }
        console.log('[CTWPML][DEBUG] openModal() - chamando showInitial()');
        showInitial();
      });
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
        // Evita fechar clicando fora (UX no checkout). ESC continua funcionando.
        clickOutside: false,
        clickSlide: false,
        // Compatibilidade: algumas versões usam closeClickOutside.
        closeClickOutside: false,
        smallBtn: false,
        toolbar: false,
        buttons: [],
        afterShow: function() {
          state.log('UI        Popup de login aberto (afterShow)', {}, 'UI');
          
          var siteKeyFixa = '6LfWXPIqAAAAAF3U6KDkq9WnI1IeYh8uQ1ZvqiPX';

          // Render explícito: SIGNUP (ID unificado g-recaptcha como no exemplo)
          var $signupContainer = $('#g-recaptcha');
          if (typeof grecaptcha !== 'undefined' && $signupContainer.length && !$signupContainer.hasClass('recaptcha-rendered')) {
            try {
              window.__ctwpmlRecaptchaSignupId = grecaptcha.render($signupContainer[0], {
                sitekey: siteKeyFixa,
                callback: window.ctwpmlSignupEnable,
                'expired-callback': window.ctwpmlSignupDisable,
              });
              $signupContainer.addClass('recaptcha-rendered');
              state.log('UI        reCAPTCHA signup renderizado', { widgetId: window.__ctwpmlRecaptchaSignupId }, 'UI');
            } catch (e) {
              state.log('ERROR     Erro ao renderizar reCAPTCHA signup', { error: e && e.message }, 'ERROR');
            }
          }

          // Render explícito: LOGIN
          var $loginContainer = $('#g-recaptcha-login');
          if (typeof grecaptcha !== 'undefined' && $loginContainer.length && !$loginContainer.hasClass('recaptcha-rendered')) {
            try {
              window.__ctwpmlRecaptchaLoginId = grecaptcha.render($loginContainer[0], {
                sitekey: siteKeyFixa,
                callback: window.ctwpmlLoginEnable,
                'expired-callback': window.ctwpmlLoginDisable,
              });
              $loginContainer.addClass('recaptcha-rendered');
              state.log('UI        reCAPTCHA login renderizado', { widgetId: window.__ctwpmlRecaptchaLoginId }, 'UI');
            } catch (e) {
              state.log('ERROR     Erro ao renderizar reCAPTCHA login', { error: e && e.message }, 'ERROR');
            }
          }
        }
      });
    }

    function closeModal() {
      console.log('[CTWPML][DEBUG] closeModal() - escondendo componente ML');
      $('#ctwpml-address-modal-overlay').hide();
      // Modo fullscreen: ao fechar, redireciona para o carrinho
      var cartUrl = window.wc_cart_params && window.wc_cart_params.cart_url ? window.wc_cart_params.cart_url : '/carrinho/';
      console.log('[CTWPML][DEBUG] closeModal() - redirecionando para:', cartUrl);
      window.location.href = cartUrl;
    }

    function showList() {
      currentView = 'list';
      $('#ctwpml-modal-title').text('Meus endereços');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').show();
      $('#ctwpml-btn-primary').text('Continuar');
      $('#ctwpml-btn-secondary').text('Adicionar novo endereço');
      setFooterVisible(true);
    }

    function showForm() {
      currentView = 'form';
      $('#ctwpml-modal-title').text('Adicione um endereço');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-form').show();
      $('#ctwpml-btn-primary').text('Salvar');
      $('#ctwpml-btn-secondary').text('Voltar');
      selectedAddressId = null;
      prefillFormFromCheckout();
      syncLoginBanner();
      syncCpfUiFromCheckout();
      loadContactMeta(); // Carregar WhatsApp e CPF salvos
      setFooterVisible(true);
    }

    function showFormForNewAddress() {
      currentView = 'form';
      $('#ctwpml-modal-title').text('Adicionar endereço');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
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
      syncLoginBanner();
      syncCpfUiFromCheckout();
      // v3.2.13: Carregar CPF e WhatsApp do perfil (user_meta) para novo endereço
      loadContactMeta();
      setFooterVisible(true);
    }

    function showFormForEditAddress(addressId) {
      var item = getAddressById(addressId);
      if (!item) {
        showFormForNewAddress();
        return;
      }
      currentView = 'form';
      selectedAddressId = item.id;
      $('#ctwpml-modal-title').text('Editar endereço');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
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
      
      // v3.2.7: Definir 'Casa' como padrão se label estiver vazio (endereços antigos)
      var labelValue = String(item.label || 'Casa');
      setTypeSelection(labelValue);
      
      setRuaHint('', false);
      clearFormErrors();

      // v3.2.7: Sincronizar campos billing_* do WooCommerce para validação funcionar
      $('#billing_postcode').val(item.cep || '').trigger('change');
      $('#billing_address_1').val(item.address_1 || '').trigger('change');
      $('#billing_number').val(item.number || '').trigger('change');
      $('#billing_city').val(item.city || '').trigger('change');
      $('#billing_state').val(item.state || '').trigger('change');
      $('#billing_neighborhood').val(item.neighborhood || '').trigger('change');

      // Nome: usar receiver_name do endereço ou nome do checkout
      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      var receiverName = String(item.receiver_name || (first + ' ' + last)).trim();
      $('#ctwpml-input-nome').val(receiverName);
      
      // WhatsApp: tentar do checkout primeiro
      var phoneFromCheckout = ($('#billing_cellphone').val() || '').trim();
      $('#ctwpml-input-fone').val(formatPhone(phoneFromCheckout));
      
      // v3.2.7: Se WhatsApp/CPF estiverem vazios, carregar do perfil (user_meta)
      var needsContactMeta = !phoneFromCheckout;
      if (needsContactMeta) {
        loadContactMeta(function(meta) {
          if (meta) {
            // Preencher WhatsApp se estiver vazio
            if (!$('#ctwpml-input-fone').val() && meta.whatsapp) {
              $('#ctwpml-input-fone').val(formatPhone(meta.whatsapp));
            }
          }
        });
      }
      
      syncLoginBanner();
      syncCpfUiFromCheckout();
      setFooterVisible(true);
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
      var $el = safeSelector(selectorOrGroupId);
      if (!$el.length) return;
      if (isError) $el.addClass('is-error');
      else $el.removeClass('is-error');
    }

    function validateForm() {
      clearFormErrors();
      var ok = true;
      var errors = [];

      var cepOnly = cepDigits($('#ctwpml-input-cep').val());
      if (cepOnly.length !== 8) {
        setFieldError('#ctwpml-input-cep', true);
        ok = false;
        errors.push('CEP inválido');
      }

      var rua = ($('#ctwpml-input-rua').val() || '').trim();
      if (!rua) {
        setFieldError('#ctwpml-group-rua', true);
        setRuaHint('Não encontramos Rua/Avenida automaticamente. Preencha manualmente com atenção.', true);
        ok = false;
        errors.push('Rua obrigatória');
      }

      // v3.2.13: Verificar cidade/UF com fallback para lastCepLookup (quando billing_* não existir no DOM)
      var city = '';
      var st = '';
      
      // Tentar do checkout primeiro (se existir)
      if ($('#billing_city').length) city = ($('#billing_city').val() || '').trim();
      if ($('#billing_state').length) st = ($('#billing_state').val() || '').trim();
      
      // Fallback: usar lastCepLookup (cache da consulta de CEP)
      if (!city && lastCepLookup) {
        city = lastCepLookup.localidade || lastCepLookup.cidade || lastCepLookup.city || '';
      }
      if (!st && lastCepLookup) {
        st = lastCepLookup.uf || lastCepLookup.estado || lastCepLookup.state || '';
      }
      
      // Fallback: extrair do texto de confirmação do CEP (setCepConfirm)
      if (!city || !st) {
        var confirmText = $('#ctwpml-cep-confirm-text').text() || '';
        // Formato: "Cidade - UF" ou "Bairro, Cidade - UF"
        var match = confirmText.match(/([^,\-]+)\s*-\s*([A-Z]{2})/i);
        if (match) {
          if (!city) city = (match[1] || '').trim();
          if (!st) st = (match[2] || '').trim();
        }
      }
      
      if (!city || !st) {
        setFieldError('#ctwpml-input-cep', true);
        ok = false;
        errors.push('Cidade/UF ausentes (recarregue o CEP)');
      }

      var labelOk = $('#ctwpml-type-home').hasClass('is-active') || $('#ctwpml-type-work').hasClass('is-active');
      if (!labelOk) {
        $('#ctwpml-type-home, #ctwpml-type-work').addClass('is-error');
        ok = false;
        errors.push('Tipo Casa/Trabalho não selecionado');
      }

      var name = ($('#ctwpml-input-nome').val() || '').trim();
      if (!name) {
        setFieldError('#ctwpml-input-nome', true);
        ok = false;
        errors.push('Nome obrigatório');
      }

      var phone = phoneDigits($('#ctwpml-input-fone').val());
      if (phone.length < 10) {
        setFieldError('#ctwpml-input-fone', true);
        ok = false;
        errors.push('WhatsApp inválido');
      }

      // CPF obrigatório no fluxo (se já estiver locked, estará preenchido via checkout).
      var cpf = cpfDigitsOnly($('#ctwpml-input-cpf').val());
      if (cpf.length !== 11) {
        setFieldError('#ctwpml-group-cpf', true);
        ok = false;
        errors.push('CPF inválido');
      }

      if (errors.length > 0) {
        state.log('ERROR     validateForm falhou', { errors: errors, city: city, st: st, hasLastCepLookup: !!lastCepLookup }, 'ERROR');
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

    function persistSelectedAddressId(id) {
      if (!id) return;
      if (!state.params || !state.params.ajax_url || !state.params.addresses_nonce) return;
      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_set_selected_address',
          _ajax_nonce: state.params.addresses_nonce,
          id: String(id),
        },
      });
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
      
      // Usar cache se disponível e não expirado
      var now = Date.now();
      if (addressesCache.length > 0 && addressesCacheTimestamp) {
        if ((now - addressesCacheTimestamp) < CACHE_DURATION) {
          // Cache válido, usar dados em cache
          done();
          return;
        }
      }
      
      state.log('UI        [DEBUG] loadAddresses() - iniciando AJAX', {}, 'UI');
      console.log('[CTWPML][DEBUG] loadAddresses() - iniciando AJAX para ctwpml_get_addresses');

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_get_addresses',
          _ajax_nonce: state.params.addresses_nonce,
        },
        success: function (resp) {
          state.log('UI        [DEBUG] loadAddresses() - resposta recebida', { resp: resp }, 'UI');
          console.log('[CTWPML][DEBUG] loadAddresses() - resposta AJAX:', resp);

          if (resp && resp.success && resp.data && Array.isArray(resp.data.items)) {
            addressesCache = dedupeAddresses(resp.data.items);
            addressesCacheTimestamp = Date.now(); // Atualiza timestamp
            console.log('[CTWPML][DEBUG] loadAddresses() - endereços carregados:', addressesCache.length);
            if (resp.data && resp.data.selected_address_id) {
              selectedAddressId = resp.data.selected_address_id;
              console.log('[CTWPML][DEBUG] loadAddresses() - selected_address_id do backend:', selectedAddressId);
            } else {
              console.log('[CTWPML][DEBUG] loadAddresses() - backend NÃO retornou selected_address_id');
            }
          } else {
            console.log('[CTWPML][DEBUG] loadAddresses() - resposta inválida ou sem items');
            addressesCache = [];
            addressesCacheTimestamp = null;
            selectedAddressId = null;
          }
          done();
        },
        error: function (xhr, status, error) {
          state.log('ERROR     [DEBUG] loadAddresses() - erro AJAX', { status: status, error: error }, 'ERROR');
          console.log('[CTWPML][DEBUG] loadAddresses() - erro AJAX:', status, error);
          addressesCache = [];
          addressesCacheTimestamp = null;
          selectedAddressId = null;
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
      showModalSpinner();

      var cepOnly = cepDigits($('#ctwpml-input-cep').val());
      var label = '';
      if ($('#ctwpml-type-home').hasClass('is-active')) label = 'Casa';
      if ($('#ctwpml-type-work').hasClass('is-active')) label = 'Trabalho';

      var receiverName = ($('#ctwpml-input-nome').val() || '').trim();
      var whatsappDigits = phoneDigits($('#ctwpml-input-fone').val());
      var cpfDigits = cpfDigitsOnly($('#ctwpml-input-cpf').val());

      // v3.2.13: Primeiro, chamar webhook com evento consultaEnderecoFrete (completo)
      var webhookPayload = {
        cep: cepOnly,
        evento: 'consultaEnderecoFrete',
        whatsapp: whatsappDigits,
        cpf: cpfDigits,
        nome: receiverName,
      };

      if (typeof state.log === 'function') state.log('WEBHOOK_OUT (ML) [consultaEnderecoFrete] Salvando...', webhookPayload, 'WEBHOOK_OUT');

      $.ajax({
        url: state.params.webhook_url,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        timeout: 20000,
        crossDomain: true,
        xhrFields: { withCredentials: false },
        data: JSON.stringify(webhookPayload),
        success: function (webhookData) {
          if (typeof state.log === 'function') state.log('WEBHOOK_IN (ML) [consultaEnderecoFrete] Resposta.', webhookData, 'WEBHOOK_IN');

          // v3.2.13: Verificar whatsappValido
          var normalized = normalizeApiPayload(webhookData);
          if (normalized && normalized.whatsappValido === false) {
            isSavingAddress = false;
            $('#ctwpml-btn-primary').prop('disabled', false);
            hideModalSpinner();
            setFieldError('#ctwpml-input-fone', true);
            showNotification('Por favor, confira o seu número de WhatsApp.', 'error', 5000);
            done({ ok: false, message: 'WhatsApp inválido.' });
            return;
          }

          // Persistir payload completo no perfil
          persistAddressPayload(webhookData);

          // Agora salvar o endereço no backend
          doSaveAddressToBackend(cepOnly, label, receiverName, normalized, done);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (typeof state.log === 'function')
            state.log('WEBHOOK_IN (ML) [consultaEnderecoFrete] Erro (' + textStatus + ').', { status: jqXHR.status, error: errorThrown }, 'WEBHOOK_IN');
          
          // Mesmo com erro no webhook, tentar salvar o endereço usando dados em cache
          if (typeof state.log === 'function') state.log('UI        Salvando endereço sem resposta do webhook (usando cache)...', {}, 'UI');
          doSaveAddressToBackend(cepOnly, label, receiverName, lastCepLookup, done);
        },
      });
    }

    // v3.2.13: Função auxiliar para salvar endereço no backend (após validação do webhook)
    function doSaveAddressToBackend(cepOnly, label, receiverName, webhookData, done) {
      // Usar dados do webhook ou fallback para lastCepLookup ou campos do checkout
      var neighborhood = '';
      var city = '';
      var st = '';

      if (webhookData) {
        neighborhood = webhookData.bairro || webhookData.neighborhood || '';
        city = webhookData.localidade || webhookData.cidade || webhookData.city || '';
        st = webhookData.uf || webhookData.estado || webhookData.state || '';
      }

      // Fallback para lastCepLookup
      if (!city && lastCepLookup) {
        neighborhood = lastCepLookup.bairro || lastCepLookup.neighborhood || neighborhood;
        city = lastCepLookup.localidade || lastCepLookup.cidade || lastCepLookup.city || city;
        st = lastCepLookup.uf || lastCepLookup.estado || lastCepLookup.state || st;
      }

      // Fallback para campos do checkout (se existirem)
      if (!city && $('#billing_city').length) city = ($('#billing_city').val() || '').trim();
      if (!st && $('#billing_state').length) st = ($('#billing_state').val() || '').trim();
      if (!neighborhood && $('#billing_neighborhood').length) neighborhood = ($('#billing_neighborhood').val() || '').trim();

      var address = {
        id: selectedAddressId ? selectedAddressId : '',
        label: label,
        receiver_name: receiverName,
        cep: cepOnly,
        address_1: ($('#ctwpml-input-rua').val() || '').trim(),
        number: ($('#ctwpml-input-numero').val() || '').trim(),
        complement: ($('#ctwpml-input-comp').val() || '').trim(),
        neighborhood: neighborhood,
        city: city,
        state: st,
        extra_info: ($('#ctwpml-input-info').val() || '').trim(),
      };

      if (typeof state.log === 'function') state.log('UI        Salvando endereço no backend...', address, 'UI');

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
            // Sucesso: atualiza cache e timestamp
            if (Array.isArray(resp.data.items)) {
              addressesCache = dedupeAddresses(resp.data.items);
            }
            addressesCacheTimestamp = Date.now(); // Reset cache timer

            if (resp.data.item && resp.data.item.id) {
              selectedAddressId = resp.data.item.id;
            }

            // Mostrar notificação de sucesso
            showNotification('Endereço salvo com sucesso!', 'success', 2500);

            done({ ok: true });
          } else {
            var errorMsg = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao salvar endereço.';
            showNotification(errorMsg, 'error', 4000);
            done({ ok: false, message: errorMsg });
          }
        },
        error: function () {
          isSavingAddress = false;
          $('#ctwpml-btn-primary').prop('disabled', false);
          showNotification('Erro ao salvar endereço. Tente novamente.', 'error', 4000);
          done({ ok: false, message: 'Erro ao salvar endereço.' });
        },
        complete: function () {
          hideModalSpinner();
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
            addressesCacheTimestamp = Date.now(); // Reset cache timer
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
      var ruaPreenchida = false;
      if (dados.logradouro) {
        $('#ctwpml-input-rua').val(String(dados.logradouro));
        setRuaHint('', false);
        ruaPreenchida = true;
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
      
      // v3.2.13: Após preencher rua automaticamente, mover cursor para o campo número
      if (ruaPreenchida && !$('#ctwpml-input-numero').val()) {
        setTimeout(function() {
          $('#ctwpml-input-numero').focus();
        }, 100);
      }
    }

    // v3.2.13: Cache da última consulta de CEP para uso na validação (fallback quando billing_* não existir)
    var lastCepLookup = null;

    function consultCepAndFillForm() {
      var cepOnlyDigits = cepDigits($('#ctwpml-input-cep').val());
      if (cepOnlyDigits.length !== 8) return;
      if (cepConsultInFlight) return;
      if (cepConsultedFor && cepConsultedFor === cepOnlyDigits) return;

      // Preenche o checkout antes para manter consistência de estado (se existir).
      if ($('#billing_postcode').length) {
        $('#billing_postcode').val(cepOnlyDigits).trigger('change');
      }

      // v3.2.13: Payload MÍNIMO para consulta rápida de CEP (evento: consultaCep)
      var payload = {
        cep: cepOnlyDigits,
        evento: 'consultaCep',
      };

      if (typeof state.log === 'function') state.log('WEBHOOK_OUT (ML) [consultaCep] Consulta rápida de CEP...', payload, 'WEBHOOK_OUT');

      cepConsultInFlight = true;
      $.ajax({
        url: state.params.webhook_url,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        timeout: 10000, // timeout menor para consulta rápida
        crossDomain: true,
        xhrFields: { withCredentials: false },
        data: JSON.stringify(payload),
        success: function (data) {
          cepConsultInFlight = false;
          cepConsultedFor = cepOnlyDigits;
          if (typeof state.log === 'function') state.log('WEBHOOK_IN (ML) [consultaCep] Resposta recebida.', data, 'WEBHOOK_IN');
          
          // v3.2.13: Salvar em memória para uso na validação (fallback)
          lastCepLookup = normalizeApiPayload(data);
          
          fillFormFromApiData(data);
          // NÃO persiste no perfil aqui — isso será feito no Salvar com evento completo
        },
        error: function (jqXHR, textStatus, errorThrown) {
          cepConsultInFlight = false;
          if (typeof state.log === 'function')
            state.log(
              'WEBHOOK_IN (ML) [consultaCep] Erro (' + textStatus + ').',
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
      syncCpfUiFromCheckout();

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

      var cpf = cpfDigitsOnly($('#ctwpml-input-cpf').val());
      if (cpf) {
        var $cpf = getBillingCpfInput();
        if ($cpf.length) {
          $cpf.val(cpf).trigger('change');
        } else {
          logAny('applyFormToCheckout: campo billing_cpf não encontrado.', { cpf: cpf });
        }
      }
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
    state.log('INIT      Address modal: bind de eventos registrado (delegado)', {}, 'INIT');

    $(document).on('click', '#ctwpml-open-address-modal', function (e) {
      e.preventDefault();
      openModal();
    });
    $(document).on('click', '#ctwpml-modal-back', function () {
      state.log('ACTION    [DEBUG] Click #ctwpml-modal-back', { currentView: currentView }, 'ACTION');
      console.log('[CTWPML][DEBUG] Click #ctwpml-modal-back - currentView:', currentView);

      // Navegação entre telas:
      // shipping → initial
      // list → initial
      // form → list
      // initial → fecha modal (ou history.back quando for fullscreen)

      if (currentView === 'shipping') {
        console.log('[CTWPML][DEBUG] - voltando de shipping para initial');
        showInitial();
        return;
      }
      if (currentView === 'list') {
        console.log('[CTWPML][DEBUG] - voltando de list para initial');
        showInitial();
        return;
      }
      if (currentView === 'form') {
        console.log('[CTWPML][DEBUG] - voltando de form para list');
        showList();
        renderAddressList();
        return;
      }
      if (currentView === 'initial') {
        console.log('[CTWPML][DEBUG] - fechando modal (estava em initial)');
        closeModal();
        return;
      }
      console.log('[CTWPML][DEBUG] - fechando modal (view desconhecida)');
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

    // CPF (modal): máscara + geração fictícia
    $(document).on('input', '#ctwpml-input-cpf', function () {
      var $i = $('#ctwpml-input-cpf');
      var f = formatCpf($i.val());
      if ($i.val() !== f) $i.val(f);
      // Mantém checkout sincronizado
      var $cpf = getBillingCpfInput();
      if ($cpf.length) {
        $cpf.val(cpfDigitsOnly(f)).trigger('change');
      } else {
        logAny('CPF sync: campo billing_cpf não encontrado no checkout.', { value: cpfDigitsOnly(f) });
      }
    });

    $(document).on('click', '#ctwpml-generate-cpf-modal', function (e) {
      e.preventDefault();
      
      // Verificar se CPF já está travado
      if (isCpfLocked()) {
        alert('Seu CPF já foi definido e não pode ser alterado.');
        return;
      }
      
      var allow = !!(state.params && (state.params.allow_fake_cpf === 1 || state.params.allow_fake_cpf === '1'));
      if (!allow) return;

      // Verificar se já existe CPF preenchido (11 dígitos)
      var cpfCurrent = $('#ctwpml-input-cpf').val() || '';
      var cpfDigits = cpfCurrent.replace(/\D/g, '');
      if (cpfDigits.length === 11) {
        alert('Você já possui um CPF cadastrado. Não é possível gerar outro.');
        return;
      }

      logAny('CPF fictício (modal): usuário clicou em gerar.', {});
      var ok = window.confirm('Atenção: o CPF gerado é definitivo e não poderá ser alterado depois.');
      if (!ok) return;

      var cpf = generateFakeCpfDigits();
      $('#ctwpml-input-cpf').val(formatCpf(cpf));
      $('#ctwpml-cpf-hint').show();
      var $cpf = getBillingCpfInput();
      if ($cpf.length) {
        $cpf.val(cpf).trigger('change');
        logAny('CPF fictício (modal): aplicado no checkout.', { cpf: cpf });
      } else {
        logAny('CPF fictício (modal): NÃO encontrou campo billing_cpf no checkout.', { cpf: cpf });
      }

      // Salvar imediatamente no servidor e aplicar lock
      saveContactMeta(function(response) {
        if (response && response.success && response.data && response.data.cpf_locked) {
          $('#ctwpml-input-cpf').prop('readonly', true);
          $('#ctwpml-generate-cpf-modal').hide();
          logAny('CPF fictício (modal): salvo e travado permanentemente.', { cpf: cpf });
          alert('CPF gerado e salvo permanentemente no seu perfil.');
        }
      });
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
      persistSelectedAddressId(id);
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
      state.log('ACTION    Click #ctwpml-btn-primary', { isFormVisible: $('#ctwpml-view-form').is(':visible') }, 'ACTION');
      if ($('#ctwpml-view-form').is(':visible')) {
        if (!validateForm()) {
          state.log('ERROR     validateForm falhou (não salvou)', {}, 'ERROR');
          return;
        }
        applyFormToCheckout();
        // Salvar WhatsApp e CPF antes do endereço
        saveContactMeta(function () {
          saveAddressFromForm(function (res) {
            if (!res || !res.ok) {
              // Não precisa de alert, a notificação já foi exibida
              state.log('ERROR     saveAddressFromForm falhou', res || {}, 'ERROR');
              return;
            }

            // Aguardar 800ms para usuário ver a confirmação, depois voltar para lista
            setTimeout(function () {
              showList();
              renderAddressList();
            }, 800);
          });
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

    // Tela inicial (antes da lista): card do endereço selecionado
    $(document).on('click', '#ctwpml-initial-go', function (e) {
      e.preventDefault();
      state.log('ACTION    [DEBUG] Click #ctwpml-initial-go - avançar para prazo', {}, 'ACTION');
      console.log('[CTWPML][DEBUG] Click #ctwpml-initial-go - avançar para tela de prazo');
      showShippingPlaceholder();
    });
    $(document).on('click', '#ctwpml-initial-manage', function (e) {
      e.preventDefault();
      state.log('ACTION    [DEBUG] Click #ctwpml-initial-manage - alterar endereço', {}, 'ACTION');
      console.log('[CTWPML][DEBUG] Click #ctwpml-initial-manage - ir para lista de endereços');
      showList();
      renderAddressList();
    });

    // Tela prazo (placeholder): seleção visual apenas (sem integrar frete ainda)
    $(document).on('click', '#ctwpml-view-shipping .ctwpml-shipping-option', function (e) {
      e.preventDefault();
      $('#ctwpml-view-shipping .ctwpml-shipping-option').removeClass('is-selected');
      $(this).addClass('is-selected');
    });
    $(document).on('click', '#ctwpml-shipping-continue', function () {
      closeModal();
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
      console.log('[CTWPML][DEBUG] setTimeout 800ms - auto abertura do modal');
      console.log('[CTWPML][DEBUG] setTimeout - isLoggedIn:', isLoggedIn());
      try {
        if (isLoggedIn()) {
          console.log('[CTWPML][DEBUG] setTimeout - chamando openModal()');
          openModal();
        } else {
          console.log('[CTWPML][DEBUG] setTimeout - chamando openLoginPopup()');
          openLoginPopup();
        }
      } catch (e) {
        console.log('[CTWPML][DEBUG] setTimeout - ERRO:', e);
      }
    }, 800);

    console.log('[CTWPML][DEBUG] setupAddressModal() - FINALIZADO');
  };
})(window);


