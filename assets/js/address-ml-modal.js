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
    // Evita que o handler de change do CEP do checkout limpe os campos quando nós mesmos setamos programaticamente.
    var suppressBillingCepClearOnce = false;
    var cepConsultedFor = '';
    var cepConsultInFlight = false;
    var selectedAddressId = null;
    var currentView = 'list'; // initial | list | form | shipping
    var addressesCache = [];
    var addressesCacheTimestamp = null;
    var CACHE_DURATION = 60000; // 1 minuto
    var isSavingAddress = false;

    // =========================================================
    // PERSISTÊNCIA DO ESTADO DO MODAL (sessionStorage)
    // =========================================================
    var CTWPML_MODAL_STATE_KEY = 'ctwpml_ml_modal_state_v1';
    var restoreStateOnOpen = null;

    function safeReadModalState() {
      try {
        if (!window.sessionStorage) return null;
        var raw = window.sessionStorage.getItem(CTWPML_MODAL_STATE_KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        return obj;
      } catch (e) {
        return null;
      }
    }

    function safeWriteModalState(obj) {
      try {
        if (!window.sessionStorage) return;
        window.sessionStorage.setItem(CTWPML_MODAL_STATE_KEY, JSON.stringify(obj));
      } catch (e) {}
    }

    function clearModalState() {
      try {
        if (!window.sessionStorage) return;
        window.sessionStorage.removeItem(CTWPML_MODAL_STATE_KEY);
      } catch (e) {}
    }

    function persistModalState(patch) {
      patch = patch || {};
      var prev = safeReadModalState() || {};
      var next = {
        open: typeof patch.open === 'boolean' ? patch.open : !!prev.open,
        view: patch.view || prev.view || currentView || 'list',
        selectedAddressId: (typeof patch.selectedAddressId !== 'undefined') ? patch.selectedAddressId : (selectedAddressId || prev.selectedAddressId || ''),
        selectedShipping: (typeof patch.selectedShipping !== 'undefined') ? patch.selectedShipping : (state.selectedShipping || prev.selectedShipping || null),
        selectedPaymentMethod: (typeof patch.selectedPaymentMethod !== 'undefined') ? patch.selectedPaymentMethod : (state.selectedPaymentMethod || prev.selectedPaymentMethod || ''),
        ts: Date.now(),
      };
      safeWriteModalState(next);
    }

    function tryRestoreModalOnBoot() {
      var s = safeReadModalState();
      if (!s || !s.open) {
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_VIEW_RESTORE', true, { restored: false, reason: 'no_state' });
        return;
      }
      // Só tenta restaurar se estivermos na página de checkout (form do Woo presente) e logado.
      var hasCheckoutForm = !!document.querySelector('form.checkout, form.woocommerce-checkout');
      if (!hasCheckoutForm || !isLoggedIn()) {
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_VIEW_RESTORE', false, { restored: false, reason: 'not_checkout_or_not_logged', hasCheckoutForm: hasCheckoutForm, isLoggedIn: isLoggedIn() });
        return;
      }
      restoreStateOnOpen = s;
      setTimeout(function () {
        try { openModal(); } catch (e) {}
      }, 50);
    }

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

    // =========================================================
    // CHECKPOINTS DE DEBUG - Valida saúde do sistema
    // =========================================================
    function runHealthCheckpoints() {
      if (typeof state.checkpoint !== 'function') return;

      // CHK_HOST_WOO - Verifica se o DOM do WooCommerce está presente
      var formCheckout = document.querySelector('form.checkout, form.woocommerce-checkout');
      var orderReview = document.querySelector('#order_review, .woocommerce-checkout-review-order');
      var payment = document.querySelector('#payment, .woocommerce-checkout-payment');
      var placeOrder = document.querySelector('#place_order');

      state.checkpoint('CHK_HOST_WOO (form.checkout)', !!formCheckout, { found: !!formCheckout });
      state.checkpoint('CHK_HOST_WOO (#order_review)', !!orderReview, { found: !!orderReview });
      state.checkpoint('CHK_HOST_WOO (#payment)', !!payment, { found: !!payment });
      state.checkpoint('CHK_HOST_WOO (#place_order)', !!placeOrder, { found: !!placeOrder });

      // CHK_OVERLAY_SUPPRESS - Overlay global do checkout está oculto
      var checkoutOverlay = document.querySelector('.checkout-loading-overlay');
      var overlayHidden = !checkoutOverlay || 
        window.getComputedStyle(checkoutOverlay).display === 'none' ||
        window.getComputedStyle(checkoutOverlay).opacity === '0';
      state.checkpoint('CHK_OVERLAY_SUPPRESS', overlayHidden, { overlayVisible: !overlayHidden });

      // CHK_ML_ONLY - Modo ML-only está ativo
      var mlOnly = document.body.classList.contains('ctwpml-ml-only');
      state.checkpoint('CHK_ML_ONLY', mlOnly, { bodyClass: mlOnly });

      // CHK_MODAL_VISIBLE - Modal está visível
      var modalOverlay = document.querySelector('#ctwpml-address-modal-overlay');
      var modalVisible = modalOverlay && window.getComputedStyle(modalOverlay).display !== 'none';
      state.checkpoint('CHK_MODAL_VISIBLE', modalVisible, { display: modalOverlay ? window.getComputedStyle(modalOverlay).display : 'not_found' });

      // CHK_SCROLL_ENABLED - Body scroll travado + modal scroll habilitado
      var bodyOverflow = window.getComputedStyle(document.body).overflow;
      var modalBody = document.querySelector('.ctwpml-modal-body');
      var modalBodyOverflow = modalBody ? window.getComputedStyle(modalBody).overflow : 'not_found';
      var scrollOk = bodyOverflow === 'hidden' && (modalBodyOverflow === 'auto' || modalBodyOverflow === 'scroll');
      state.checkpoint('CHK_SCROLL_ENABLED', scrollOk, { bodyOverflow: bodyOverflow, modalBodyOverflow: modalBodyOverflow });

      // CHK_ELEMENTOR_HIDDEN - Widget do Elementor escondido (se existir)
      var elementorWidget = document.querySelector('.elementor-widget-woocommerce-checkout-page');
      if (elementorWidget) {
        var style = window.getComputedStyle(elementorWidget);
        var isHidden = style.left === '-99999px' || style.opacity === '0' || style.position === 'fixed';
        state.checkpoint('CHK_ELEMENTOR_HIDDEN', isHidden, { left: style.left, opacity: style.opacity });
      }
    }

    // Checkpoint específico para gateways
    function checkGateways() {
      if (typeof state.checkpoint !== 'function') return;

      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost;
      if (woo && typeof woo.listGateways === 'function') {
        var gateways = woo.listGateways();
        var gatewayIds = gateways.map(function (g) { return g.id; });
        state.checkpoint('CHK_GATEWAYS', gateways.length > 0, { count: gateways.length, ids: gatewayIds });
      } else {
        state.checkpoint('CHK_GATEWAYS', false, { error: 'WooHost.listGateways não disponível' });
      }
    }

    // Checkpoint para blocos injetados
    function checkBlocks() {
      if (typeof state.checkpoint !== 'function') return;

      var hasPayment = $('#ctwpml-hidden-payment-block').length > 0 || $('#payment').length > 0;
      var hasReview = $('#ctwpml-hidden-review-block').length > 0 || $('#order_review').length > 0;
      state.checkpoint('CHK_BLOCKS (payment)', hasPayment, { hiddenBlock: $('#ctwpml-hidden-payment-block').length, native: $('#payment').length });
      state.checkpoint('CHK_BLOCKS (review)', hasReview, { hiddenBlock: $('#ctwpml-hidden-review-block').length, native: $('#order_review').length });
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

      // Modo ML definitivo: SEMPRE injeta no <body> para não ficar preso no container do Elementor/widget.
      // (O widget pode ser movido/offscreen via CSS e não deve arrastar o modal junto.)
      var $root = $('body');
      console.log('[CTWPML][DEBUG] ensureModal() - inserindo componente ML no body (modo fullscreen)');

      $root.append(
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
          '      <div id="ctwpml-view-payment" style="display:none;"></div>' +
          '      <div id="ctwpml-view-review" style="display:none;"></div>' +
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
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-comp">Complemento (opcional)</label><input id="ctwpml-input-comp" type="text" placeholder="Ex.: Apto 201" maxlength="13" /></div>' +
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
      persistModalState({ view: 'initial' });
      $('#ctwpml-modal-title').text('Escolha a forma de entrega');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
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

    /**
     * Define o método de frete selecionado no WooCommerce.
     * @param {string} methodId - ID do método (ex: 'flat_rate:3')
     * @param {Function} callback - Callback opcional após sucesso
     */
    function ctwpmlReadWooShippingDomSnapshot() {
      try {
        var nodes = document.querySelectorAll('input[name^="shipping_method"]');
        var inputs = Array.prototype.slice.call(nodes || []);
        var checked = null;
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i] && inputs[i].checked) {
            checked = inputs[i];
            break;
          }
        }
        return {
          count: inputs.length,
          checked: checked ? String(checked.value || '') : '',
          all: inputs.slice(0, 30).map(function (el) {
            return {
              name: String(el && el.name ? el.name : ''),
              value: String(el && el.value ? el.value : ''),
              checked: !!(el && el.checked),
              disabled: !!(el && el.disabled),
            };
          }),
        };
      } catch (e) {
        return { error: e && e.message ? e.message : 'snapshot_failed' };
      }
    }

    function setShippingMethodInWC(methodId, callback) {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };

      log('setShippingMethodInWC() - Definindo método:', methodId);

      if (!state.params || !state.params.ajax_url || !state.params.set_shipping_nonce) {
        log('setShippingMethodInWC() - ERRO: Parâmetros não disponíveis');
        return;
      }

      var requested = String(methodId || '');
      var beforeSnap = ctwpmlReadWooShippingDomSnapshot();
      // Guarda último resultado para bloquear avanço caso Woo não aplique.
      state.__ctwpmlLastShippingSet = {
        ok: null,
        requested: requested,
        applied: '',
        match: null,
        validationSkipped: null,
        requestedExists: null,
        ts: Date.now(),
      };
      try {
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_SHIPPING_SET_REQUEST', !!requested, {
            requested: requested,
            wooDomBefore: beforeSnap,
            selectedShippingState: state.selectedShipping || null,
          });
        }
      } catch (e0) {}

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_set_shipping_method',
          _ajax_nonce: state.params.set_shipping_nonce,
          method_id: methodId,
          address_id: String(selectedAddressId || ''),
        },
        success: function (resp) {
          log('setShippingMethodInWC() - Resposta:', resp);

          var ok = !!(resp && resp.success);
          try {
            if (state.__ctwpmlLastShippingSet && state.__ctwpmlLastShippingSet.requested === requested) {
              state.__ctwpmlLastShippingSet.ok = ok;
              state.__ctwpmlLastShippingSet.validationSkipped = resp && resp.data ? !!resp.data.validation_skipped : null;
              state.__ctwpmlLastShippingSet.requestedExists = resp && resp.data ? !!resp.data.requested_exists : null;
              state.__ctwpmlLastShippingSet.resp = resp;
            }
          } catch (e0a) {}
          try {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_SHIPPING_SET_RESPONSE', ok, { requested: requested, resp: resp });
            }
          } catch (e1) {}

          if (!ok) {
            log('setShippingMethodInWC() - ERRO na resposta:', resp);
            try {
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_SHIPPING_SET_APPLIED', false, {
                  requested: requested,
                  reason: 'ajax_error_or_wp_error',
                  resp: resp,
                });
              }
            } catch (e2) {}
            return;
          }

          // Checkpoint: sync do webhook_shipping no backend (para não remover SEDEX/Motoboy no update_checkout)
          try {
            if (typeof state.checkpoint === 'function') {
              var synced = resp && resp.data ? !!resp.data.webhook_synced : false;
              state.checkpoint('CHK_WEBHOOK_SHIPPING_SESSION_SYNC', synced, {
                addressId: String(selectedAddressId || ''),
                reason: resp && resp.data ? (resp.data.webhook_sync_reason || '') : '',
                values: resp && resp.data ? (resp.data.webhook_values || null) : null,
              });
            }
          } catch (e0x) {}

          // Checkpoint extra: retry do sync (quando a sessão só fica disponível após recálculo)
          try {
            if (typeof state.checkpoint === 'function') {
              var didRetry = resp && resp.data ? !!resp.data.did_retry_webhook_sync : false;
              var attempts = resp && resp.data ? (resp.data.webhook_sync_attempts || null) : null;
              state.checkpoint('CHK_WEBHOOK_SHIPPING_SYNC_RETRY', !didRetry || synced, {
                didRetry: didRetry,
                attempts: attempts,
                finalSynced: synced,
                finalReason: resp && resp.data ? (resp.data.webhook_sync_reason || '') : '',
              });
            }
          } catch (e0xr) {}

          // Checkpoint extra: validar se o Woo retornou total de frete > 0 após set/sync
          try {
            if (typeof state.checkpoint === 'function') {
              var shipTotalRaw = resp && resp.data ? resp.data.cart_shipping_total : null;
              var shipTotalNum = parseFloat(String(shipTotalRaw || '').replace(',', '.'));
              var shipOk = !!(shipTotalNum && shipTotalNum > 0);
              state.checkpoint('CHK_CART_SHIPPING_TOTAL_NONZERO', shipOk, {
                cart_shipping_total: shipTotalRaw,
                chosen_method: resp && resp.data ? resp.data.chosen_method : null,
                webhook_synced: synced,
                webhook_values: resp && resp.data ? (resp.data.webhook_values || null) : null,
              });
            }
          } catch (e0xs) {}

          // Observa o que o Woo realmente deixou "checked" após recalcular.
          var t0 = Date.now();
          $(document.body).one('updated_checkout', function () {
            var afterSnap = ctwpmlReadWooShippingDomSnapshot();
            var applied = afterSnap && afterSnap.checked ? String(afterSnap.checked) : '';
            var match = !!(applied && requested && applied === requested);
            log('setShippingMethodInWC() - POST updated_checkout snapshot', {
              requested: requested,
              applied: applied,
              match: match,
              ms: Date.now() - t0,
              wooDomAfter: afterSnap,
              apiAvailableRateIds: resp && resp.data ? (resp.data.available_rate_ids || []) : [],
            });
            try {
              if (state.__ctwpmlLastShippingSet && state.__ctwpmlLastShippingSet.requested === requested) {
                state.__ctwpmlLastShippingSet.applied = applied;
                state.__ctwpmlLastShippingSet.match = match;
              }
            } catch (e0b) {}
            try {
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_SHIPPING_SET_APPLIED', match, {
                  requested: requested,
                  applied: applied,
                  ms: Date.now() - t0,
                  domCount: afterSnap ? afterSnap.count : 0,
                  apiRequestedExists: resp && resp.data ? resp.data.requested_exists : undefined,
                  apiAvailableRateIds: resp && resp.data ? (resp.data.available_rate_ids || []) : [],
                });
              }
            } catch (e3) {}
          });

          // =========================================================
          // CRÍTICO: o Woo considera o radio shipping_method como fonte de verdade.
          // Precisamos marcar o input correspondente ANTES do update_checkout,
          // senão ele pode reverter para o método que estava checked (ex.: flat_rate:1).
          // =========================================================
          try {
            var $input = $('input[name^="shipping_method"][value="' + requested.replace(/"/g, '\\"') + '"]').first();
            var beforeRadio = ctwpmlReadWooShippingDomSnapshot();
            var radioOk = false;
            if ($input.length && !$input.prop('disabled')) {
              $input.prop('checked', true);
              // change real para o Woo capturar
              try { $input[0].dispatchEvent(new Event('change', { bubbles: true })); } catch (e1) { $input.trigger('change'); }
              radioOk = true;
            }
            var afterRadio = ctwpmlReadWooShippingDomSnapshot();
            log('setShippingMethodInWC() - Radio sync', {
              requested: requested,
              found: $input.length,
              disabled: $input.length ? !!$input.prop('disabled') : null,
              beforeChecked: beforeRadio ? beforeRadio.checked : '',
              afterChecked: afterRadio ? afterRadio.checked : '',
            });
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_SHIPPING_RADIO_SYNC', radioOk && afterRadio && afterRadio.checked === requested, {
                requested: requested,
                found: $input.length,
                disabled: $input.length ? !!$input.prop('disabled') : null,
                beforeChecked: beforeRadio ? beforeRadio.checked : '',
                afterChecked: afterRadio ? afterRadio.checked : '',
              });
            }
          } catch (e0y) {}

          log('setShippingMethodInWC() - Sucesso! Disparando update_checkout');
          try {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_OVERLAY_SOURCES', true, {
                source: 'set_shipping_method',
                hasBlockOverlay: document.querySelectorAll('.blockUI.blockOverlay').length,
                hasBlockMsg: document.querySelectorAll('.blockUI.blockMsg').length,
                hasNoticeGroup: document.querySelectorAll('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout').length,
              });
            }
          } catch (e4) {}

          // Trigger update_checkout para atualizar totais
          $(document.body).trigger('update_checkout');
          if (typeof callback === 'function') {
            callback(resp.data);
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          log('setShippingMethodInWC() - ERRO AJAX:', { status: jqXHR.status, textStatus: textStatus, error: errorThrown });
          try {
            if (state.__ctwpmlLastShippingSet && state.__ctwpmlLastShippingSet.requested === requested) {
              state.__ctwpmlLastShippingSet.ok = false;
              state.__ctwpmlLastShippingSet.error = { status: jqXHR && jqXHR.status ? jqXHR.status : '', textStatus: textStatus || '', error: errorThrown || '' };
            }
          } catch (e0c) {}
          try {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_SHIPPING_SET_RESPONSE', false, {
                requested: requested,
                status: jqXHR && jqXHR.status ? jqXHR.status : '',
                textStatus: textStatus || '',
                error: errorThrown || '',
              });
              state.checkpoint('CHK_SHIPPING_SET_APPLIED', false, {
                requested: requested,
                reason: 'ajax_transport_error',
              });
            }
          } catch (e5) {}
        },
      });
    }

    /**
     * Captura a URL da imagem do primeiro item do carrinho via DOM.
     * Tenta buscar em múltiplos seletores comuns do WooCommerce.
     * @returns {string} URL da imagem ou string vazia se não encontrar
     */
    function getFirstCartProductThumb() {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };

      var thumbUrl = '';

      // Lista de seletores para tentar (ordem de prioridade)
      var selectors = [
        // Order review (checkout clássico)
        '#order_review .cart_item img.attachment-woocommerce_thumbnail',
        '#order_review .cart_item img',
        '#order_review .product-thumbnail img',
        // Mini-cart
        '.woocommerce-mini-cart-item img',
        '.mini_cart_item img',
        // Checkout Elementor / outros templates
        '.woocommerce-checkout-review-order-table img',
        '.checkout-product-image img',
        // Cart table (se visível)
        '.woocommerce-cart-form .cart_item img',
        '.shop_table .cart_item img',
        // Fallback genérico
        '.product-thumbnail img',
        '.cart-item-image img',
      ];

      for (var i = 0; i < selectors.length; i++) {
        var $img = $(selectors[i]).first();
        if ($img.length && $img.attr('src')) {
          thumbUrl = $img.attr('src');
          log('getFirstCartProductThumb() - Imagem encontrada via seletor:', { selector: selectors[i], url: thumbUrl });
          break;
        }
      }

      if (!thumbUrl) {
        log('getFirstCartProductThumb() - Nenhuma imagem encontrada no DOM (usando placeholder)');
      }

      return thumbUrl;
    }

    /**
     * Busca até 3 miniaturas do carrinho via backend (WooCommerce).
     * Evita dependência do DOM do checkout (que varia por tema).
     * @param {Function} done - callback (thumbUrls:Array)
     */
    function getCartThumbUrls(done) {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };

      var safeDone = typeof done === 'function' ? done : function () {};

      if (!state.params || !state.params.ajax_url || !state.params.cart_thumbs_nonce) {
        log('getCartThumbUrls() - Parâmetros ausentes (ajax_url/cart_thumbs_nonce).');
        safeDone([]);
        return;
      }

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_get_cart_thumbs',
          _ajax_nonce: state.params.cart_thumbs_nonce,
        },
        success: function (resp) {
          if (resp && resp.success && resp.data && Array.isArray(resp.data.thumb_urls)) {
            log('getCartThumbUrls() - Miniaturas recebidas: ' + resp.data.thumb_urls.length, resp.data.thumb_urls);
            safeDone(resp.data.thumb_urls.slice(0, 3));
            return;
          }
          log('getCartThumbUrls() - Resposta inválida, usando vazio.', resp || {});
          safeDone([]);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          log('getCartThumbUrls() - ERRO AJAX:', { status: jqXHR.status, textStatus: textStatus, error: errorThrown });
          safeDone([]);
        },
      });
    }

    /**
     * Exibe a tela de seleção de frete, carregando opções do backend.
     */
    function showShippingPlaceholder() {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };

      log('showShippingPlaceholder() - INICIANDO', { selectedAddressId: selectedAddressId });

      currentView = 'shipping';
      persistModalState({ view: 'shipping' });
      $('#ctwpml-modal-title').text('Checkout');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
      $('#ctwpml-view-shipping').show();
      setFooterVisible(false);

      var it = selectedAddressId ? getAddressById(selectedAddressId) : null;
      log('showShippingPlaceholder() - Endereço selecionado:', it);

      // Buscar miniaturas do carrinho via backend (até 3).
      // Isso elimina o problema de "Nenhuma imagem encontrada" quando o tema não renderiza imagens no DOM.
      getCartThumbUrls(function (productThumbUrls) {
        log('showShippingPlaceholder() - productThumbUrls:', productThumbUrls);

        // Mostrar loading
        $('#ctwpml-view-shipping').html(
          '<div class="ctwpml-loading" style="padding:40px;text-align:center;">' +
            '<div class="ctwpml-spinner" style="width:40px;height:40px;border:3px solid rgba(0,117,255,0.2);border-top-color:#0075ff;border-radius:50%;animation:ctwpml-spin 0.8s linear infinite;margin:0 auto 16px;"></div>' +
            '<div>Carregando opções de frete...</div>' +
            '</div>'
        );

        // Verificar se temos os parâmetros necessários
        if (!state.params || !state.params.ajax_url || !state.params.shipping_options_nonce) {
          log('showShippingPlaceholder() - ERRO: Parâmetros não disponíveis, usando fallback');
          var hasScreensModule = !!(window.CCCheckoutTabs && window.CCCheckoutTabs.AddressMlScreens && typeof window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder === 'function');
      if (hasScreensModule) {
        var html = window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder(it);
        $('#ctwpml-view-shipping').html(html);
      } else {
        $('#ctwpml-view-shipping').html('<div class="ctwpml-section-title">Escolha quando sua compra chegará (fallback)</div>');
      }
          return;
        }

        log('showShippingPlaceholder() - Fazendo requisição AJAX para ctwpml_get_shipping_options');

        function getWooChosenShippingMethodId() {
          try {
            var $checked = $('input[name^="shipping_method"]:checked').first();
            return $checked.length ? String($checked.val() || '') : '';
          } catch (e) {}
          return '';
        }

        function pickPreferredShippingMethodId(options) {
          var preferred = '';
          try {
            if (state.selectedShipping && state.selectedShipping.methodId) preferred = String(state.selectedShipping.methodId);
          } catch (e) {}
          if (!preferred) preferred = getWooChosenShippingMethodId();
          if (preferred) {
            for (var i = 0; i < options.length; i++) {
              if (String(options[i].id || '') === preferred) return preferred;
            }
          }
          return options && options[0] ? String(options[0].id || '') : '';
        }

        function applySelectedShippingUI(methodId, options) {
          if (!methodId) return;
          $('#ctwpml-view-shipping .ctwpml-shipping-option').removeClass('is-selected');
          var $opt = $('#ctwpml-view-shipping .ctwpml-shipping-option[data-method-id="' + methodId + '"]').first();
          if ($opt.length) $opt.addClass('is-selected');

          // atualizar resumo (frete) e persistir no state
          var priceText = ($opt.data('price-text') || '').toString();
          var labelText = ($opt.find('.ctwpml-shipping-option-text').text() || '').trim();
          try { $('.ctwpml-shipping-summary-price').text(window.CCCheckoutTabs.AddressMlScreens.formatShippingSummaryPrice(priceText)); } catch (e) {}
          state.selectedShipping = {
            methodId: methodId,
            type: ($opt.data('type') || '').toString(),
            priceText: priceText,
            label: labelText,
          };
          persistModalState({ selectedShipping: state.selectedShipping, view: 'shipping' });

          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_SHIPPING_PERSISTENCE', true, {
              stateSelected: state.selectedShipping ? state.selectedShipping.methodId : '',
              wooChosen: getWooChosenShippingMethodId(),
              uiSelected: methodId,
            });
          }
        }

        // Buscar opções de frete do backend
        $.ajax({
          url: state.params.ajax_url,
          type: 'POST',
          dataType: 'json',
          data: {
            action: 'ctwpml_get_shipping_options',
            _ajax_nonce: state.params.shipping_options_nonce,
            address_id: String(selectedAddressId || ''),
          },
          success: function (resp) {
            log('showShippingPlaceholder() - Resposta recebida:', resp);

            var hasRenderOptions = !!(
              window.CCCheckoutTabs &&
              window.CCCheckoutTabs.AddressMlScreens &&
              typeof window.CCCheckoutTabs.AddressMlScreens.renderShippingOptions === 'function'
            );

            if (resp.success && resp.data && resp.data.options) {
              log('showShippingPlaceholder() - Opções encontradas: ' + resp.data.options.length, resp.data.options);

              // Checkpoint: opções de frete carregadas
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_SHIPPING_OPTIONS', resp.data.options.length > 0, { 
                  count: resp.data.options.length,
                  options: resp.data.options.map(function (o) { return o.id; })
                });
              }

              if (hasRenderOptions) {
                var html = window.CCCheckoutTabs.AddressMlScreens.renderShippingOptions(it, resp.data.options, {
                  productThumbUrls: productThumbUrls,
                });
                $('#ctwpml-view-shipping').html(html);
              } else {
                log('showShippingPlaceholder() - renderShippingOptions não disponível, usando placeholder');
                var htmlFallback = window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder(it);
                $('#ctwpml-view-shipping').html(htmlFallback);
              }

              // Seleção persistente (não resetar para 1ª opção se usuário já escolheu)
              var preferredId = pickPreferredShippingMethodId(resp.data.options);
              if (preferredId) {
                log('showShippingPlaceholder() - Seleção preferida:', { preferredId: preferredId, stateSelected: state.selectedShipping ? state.selectedShipping.methodId : '', wooChosen: getWooChosenShippingMethodId() });
                applySelectedShippingUI(preferredId, resp.data.options);
                // Só setar no WC se for diferente do escolhido atual
                var chosen = getWooChosenShippingMethodId();
                if (!chosen || chosen !== preferredId) {
                  setShippingMethodInWC(preferredId);
                }
              }
            } else {
              log('showShippingPlaceholder() - ERRO: Resposta inválida ou sem opções', resp);
              var errorMsg = resp.data && resp.data.message ? resp.data.message : 'Erro ao carregar opções de frete.';

              if (hasRenderOptions) {
                // Passar array vazio para mostrar mensagem de "nenhuma opção"
                var htmlEmpty = window.CCCheckoutTabs.AddressMlScreens.renderShippingOptions(it, [], {
                  productThumbUrls: productThumbUrls,
                });
                $('#ctwpml-view-shipping').html(htmlEmpty);
              } else {
                $('#ctwpml-view-shipping').html(
                  '<div class="ctwpml-error" style="padding:20px;text-align:center;color:#b42318;">' +
                    '<div style="font-size:24px;margin-bottom:8px;">⚠️</div>' +
                    '<div>' + errorMsg + '</div>' +
                    '</div>'
                );
              }
            }
          },
          error: function (jqXHR, textStatus, errorThrown) {
            log('showShippingPlaceholder() - ERRO AJAX:', { status: jqXHR.status, textStatus: textStatus, error: errorThrown });
            $('#ctwpml-view-shipping').html(
              '<div class="ctwpml-error" style="padding:20px;text-align:center;color:#b42318;">' +
                '<div style="font-size:24px;margin-bottom:8px;">⚠️</div>' +
                '<div>Erro de conexão. Tente novamente.</div>' +
                '</div>'
            );
          },
        });
      });
    }

    /**
     * Exibe a tela de seleção de pagamento.
     * Esta tela mostra os métodos de pagamento disponíveis (Pix, Boleto, Cartão).
     * NOTA: Esta é apenas a estrutura visual, sem lógica de pagamento.
     */
    function showPaymentScreen() {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      log('showPaymentScreen() - INICIANDO');

      currentView = 'payment';
      persistModalState({ view: 'payment' });
      // IMPORTANTE: a tela de pagamento é uma "view interna".
      // O header deve ser o do modal (sem header duplicado dentro do conteúdo).
      $('#ctwpml-modal-title').text('Escolha como pagar');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-review').hide();
      $('#ctwpml-view-payment').show();
      setFooterVisible(false);

      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;

      // Verificar se temos a função de renderização
      var hasRenderPayment = !!(
        window.CCCheckoutTabs &&
        window.CCCheckoutTabs.AddressMlScreens &&
        typeof window.CCCheckoutTabs.AddressMlScreens.renderPaymentScreen === 'function'
      );

      if (hasRenderPayment) {
        var totals0 = woo ? woo.readTotals() : { subtotalText: '', totalText: '' };
        var html = window.CCCheckoutTabs.AddressMlScreens.renderPaymentScreen({
          subtotalText: totals0.subtotalText || '',
          totalText: totals0.totalText || '',
        });
        $('#ctwpml-view-payment').html(html);
        log('showPaymentScreen() - Tela renderizada com sucesso');
      } else {
        log('showPaymentScreen() - ERRO: renderPaymentScreen não disponível, usando fallback');
        $('#ctwpml-view-payment').html(
          '<div style="padding:20px;text-align:center;">' +
            '<div style="color:#666;">Carregando métodos de pagamento...</div>' +
            '</div>'
        );
      }

      // Integração Woo: carrega blocos e sincroniza UI/valores.
      if (woo && typeof woo.ensureBlocks === 'function') {
        woo.ensureBlocks().then(function () {
          applyPaymentAvailabilityAndSync();
          // Checkpoint: tela de pagamento renderizada
          if (typeof state.checkpoint === 'function') {
            var paymentHtml = $('#ctwpml-view-payment').html() || '';
            state.checkpoint('CHK_PAYMENT_RENDERED', paymentHtml.length > 100, { htmlLength: paymentHtml.length });
            checkGateways();
          }
          // Checkpoint: títulos/estilos visíveis
          if (typeof state.checkpoint === 'function') {
            try {
              var titleEl = document.querySelector('.ctwpml-payment-method-title');
              var ok = !!(titleEl && String(titleEl.textContent || '').trim());
              var cs = titleEl ? window.getComputedStyle(titleEl) : null;
              state.checkpoint('CHK_PAYMENT_TITLES_VISIBLE', ok, titleEl ? {
                text: String(titleEl.textContent || '').trim(),
                display: cs ? cs.display : '',
                color: cs ? cs.color : '',
                fontSize: cs ? cs.fontSize : '',
              } : { found: false });
            } catch (e) {
              state.checkpoint('CHK_PAYMENT_TITLES_VISIBLE', false, { reason: 'exception' });
            }
          }
        }).catch(function (e) {
          log('WooHost.ensureBlocks() falhou', e);
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_PAYMENT_RENDERED', false, { error: e && e.message ? e.message : 'ensureBlocks falhou' });
          }
        });
      }
    }

    function applyPaymentAvailabilityAndSync() {
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo) return;

      var map = {
        pix: woo.matchGatewayId('pix'),
        boleto: woo.matchGatewayId('boleto'),
        card: woo.matchGatewayId('card'),
      };

      // Ocultar meios não disponíveis.
      ['pix', 'boleto', 'card'].forEach(function (k) {
        if (!map[k]) {
          $('.ctwpml-payment-option[data-method="' + k + '"]').hide();
        } else {
          $('.ctwpml-payment-option[data-method="' + k + '"]').show();
        }
      });

      // Atualizar valores do footer (subtotal/total)
      var totals = woo.readTotals();
      if (totals.subtotalText) $('#ctwpml-payment-subtotal-value').text(totals.subtotalText);
      if (totals.totalText) $('#ctwpml-payment-total-value').text(totals.totalText);

      // Guardar mapping para clique
      state.paymentGatewayMap = map;
    }

    function syncReviewTotalsFromWoo() {
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo) return;
      var totals = woo.readTotals();
      if (totals.subtotalText) $('#ctwpml-review-products-subtotal').text(totals.subtotalText);
      if (totals.shippingText) {
        try {
          var prev = ($('#ctwpml-review-shipping').text() || '').trim();
          $('#ctwpml-review-shipping').text(totals.shippingText);
          var sel = state.selectedShipping || {};
          var selectedPrice = String(sel.priceText || '');
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPPING_VALUE_SOURCE', true, {
              context: 'syncReviewTotalsFromWoo',
              source: 'wooTotals',
              domPrev: prev,
              domAfter: (totals.shippingText || '').trim(),
              selectedShippingPrice: selectedPrice,
              differsFromSelected: !!(selectedPrice && prev && selectedPrice !== prev),
            });
          }
          if (typeof state.log === 'function') state.log('Review frete atualizado via Woo totals', { prev: prev, next: totals.shippingText, selectedShippingPrice: selectedPrice }, 'REVIEW');
        } catch (e0) {
          $('#ctwpml-review-shipping').text(totals.shippingText);
        }
      }
      if (totals.totalText) {
        $('#ctwpml-review-total').text(totals.totalText);
        $('#ctwpml-review-payment-amount').text(totals.totalText);
        $('#ctwpml-review-sticky-total').text(totals.totalText);
      }
      var pay = woo.getSelectedGatewayLabel();
      if (pay) {
        $('#ctwpml-review-pay-tag').text(pay);
        $('#ctwpml-review-payment-method').text(pay);
      }
    }

    function mapShippingName(methodId) {
      if (methodId === 'flat_rate:1') return 'PAC Mini';
      if (methodId === 'flat_rate:5') return 'SEDEX';
      if (methodId === 'flat_rate:3') return 'Motoboy';
      return '';
    }

    function fillReviewShippingDetails() {
      var sel = state.selectedShipping || {};
      var methodId = String(sel.methodId || '');
      var methodName = mapShippingName(methodId);
      var priceText = String(sel.priceText || '');
      var label = String(sel.label || '');

      // linha "Frete" no topo: preferir o preço do método selecionado
      if (priceText) {
        $('#ctwpml-review-shipping').text(priceText);
        try {
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPPING_VALUE_SOURCE', true, {
              context: 'fillReviewShippingDetails',
              source: 'selectedShipping',
              selectedShippingPrice: priceText,
              selectedShipping: { methodId: methodId, label: label },
            });
          }
          if (typeof state.log === 'function') state.log('Review frete definido via selectedShipping', { priceText: priceText, methodId: methodId, label: label }, 'REVIEW');
        } catch (e0) {}
      } else {
        try {
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPPING_VALUE_SOURCE', false, {
              context: 'fillReviewShippingDetails',
              source: 'fallback',
              reason: 'no_selectedShipping_priceText',
              selectedShipping: sel || {},
            });
          }
        } catch (e1) {}
      }

      // Detalhe da entrega: título = método + preço, eta = label
      var eta = label ? ('Chegará ' + label) : '';
      if (eta) $('#ctwpml-review-shipment-eta').text(eta);

      var methodLine = methodName ? methodName : '';
      if (methodLine && priceText) methodLine += ' • ' + priceText;
      if (!methodLine && priceText) methodLine = priceText;
      if (methodLine) $('#ctwpml-review-shipment-title').text(methodLine);

      // Produto/quantidade (pega do order_review real quando existir)
      try {
        var $firstItem = $('#order_review .cart_item').first();
        if ($firstItem.length) {
          var name = ($firstItem.find('.product-name').clone().children().remove().end().text() || '').trim();
          var qty = ($firstItem.find('.product-quantity').text() || '').replace(/[^0-9]/g, '');
          if (name) $('#ctwpml-review-product-name').text(name);
          if (qty) $('#ctwpml-review-product-qty').text('Quantidade: ' + qty);
        }
      } catch (e) {}
    }

    function bindReviewStickyFooter() {
      var $container = $('.ctwpml-modal-body');
      var $footer = $('#ctwpml-review-sticky-footer');
      var summary = document.getElementById('ctwpml-review-initial-summary');
      if (!$container.length || !$footer.length || !summary) return;

      $container.off('scroll.ctwpmlReviewSticky').on('scroll.ctwpmlReviewSticky', function () {
        try {
          var summaryRect = summary.getBoundingClientRect();
          var containerRect = $container[0].getBoundingClientRect();
          // mostra quando o resumo já saiu da área visível do container
          var visibleTop = containerRect.top + 8;
          if (summaryRect.bottom < visibleTop) $footer.addClass('is-visible');
          else $footer.removeClass('is-visible');
        } catch (e) {}
      });

      // roda 1x
      $container.trigger('scroll.ctwpmlReviewSticky');
    }

    function ctwpmlSetReviewCtaEnabled(enabled) {
      $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky')
        .prop('disabled', !enabled)
        .css('opacity', enabled ? '' : '0.6');
    }

    function ctwpmlSyncWooTerms(checked) {
      // Termos nativos do Woo
      var $terms = $('#terms');
      if ($terms.length) $terms.prop('checked', !!checked).trigger('change');

      // Plugin antigo (cs_terms_policy_accepted)
      var $cs = $('#cs_terms_policy_accepted');
      if ($cs.length) $cs.prop('checked', !!checked).trigger('change');
    }

    function ctwpmlInitReviewTermsState() {
      var $checks = $('.ctwpml-review-terms-checkbox');
      if (!$checks.length) {
        // Se a tela não tem checkbox, não travamos CTA.
        ctwpmlSetReviewCtaEnabled(true);
        return;
      }
      var checked = $checks.first().is(':checked');
      ctwpmlSetReviewCtaEnabled(checked);
      ctwpmlSyncWooTerms(checked);
    }

    function showReviewConfirmScreen() {
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;

      currentView = 'review';
      persistModalState({ view: 'review' });
      $('#ctwpml-modal-title').text('Revise e confirme');
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').show();
      setFooterVisible(false);

      var hasRenderReview = !!(
        window.CCCheckoutTabs &&
        window.CCCheckoutTabs.AddressMlScreens &&
        typeof window.CCCheckoutTabs.AddressMlScreens.renderReviewConfirmScreen === 'function'
      );

      if (!hasRenderReview) {
        $('#ctwpml-view-review').html('<div style="padding:20px;text-align:center;color:#666;">Carregando...</div>');
        return;
      }

      var run = function () {
        var totals = woo ? woo.readTotals() : { subtotalText: '', shippingText: '', totalText: '' };
        var paymentLabel = woo ? woo.getSelectedGatewayLabel() : '';

        var it = selectedAddressId ? getAddressById(selectedAddressId) : null;
        // Fidelidade: título fixo, subtítulo com endereço selecionado (mesmo padrão do frete)
        var addressTitle = 'Enviar no meu endereço';
        var addressSubtitle = it ? formatFullAddressLine(it) : '';

        // Ícones do Review (preferência: assets locais do plugin)
        var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? String(window.cc_params.plugin_url) : '';
        var billingIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/recipt.png') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bill.png';
        var shippingIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/gps-1.png') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/gps-1.png';
        var paymentIconUrl = '';
        try {
          if ((state.selectedPaymentMethod || '').toString() === 'pix') {
            paymentIconUrl = 'https://cubensisstore.com.br/wp-content/uploads/2026/01/artpoin-logo-pix-1-scaled.png';
          } else {
            paymentIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/bank-card.png') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bank-card.png';
          }
        } catch (e0) {}

        // Billing (checkout real)
        var billingName = '';
        try {
          var n1 = ($('#billing_first_name').val() || '').trim();
          var n2 = ($('#billing_last_name').val() || '').trim();
          billingName = (n1 + ' ' + n2).trim();
        } catch (e) {}
        if (!billingName) {
          billingName = ($('#ctwpml-input-nome').val() || '').trim();
        }
        var billingCpf = ($('#billing_cpf').val() || $('#ctwpml-input-cpf').val() || '').trim();
        if (billingCpf && billingCpf.indexOf('CPF') !== 0) billingCpf = 'CPF ' + billingCpf;

        var setHtml = function (thumbs) {
          var html = window.CCCheckoutTabs.AddressMlScreens.renderReviewConfirmScreen({
            productCount: thumbs && typeof thumbs.count === 'number' ? thumbs.count : 0,
            subtotalText: totals.subtotalText || '',
            shippingText: totals.shippingText || '',
            totalText: totals.totalText || '',
            paymentLabel: paymentLabel || '',
            billingName: billingName || '',
            billingCpf: billingCpf || '',
            addressTitle: addressTitle || '',
            addressSubtitle: addressSubtitle || '',
            billingIconUrl: billingIconUrl,
            shippingIconUrl: shippingIconUrl,
            paymentIconUrl: paymentIconUrl,
            thumbUrls: thumbs && Array.isArray(thumbs.thumb_urls) ? thumbs.thumb_urls : [],
          });
          $('#ctwpml-view-review').html(html);
          $('#ctwpml-review-errors').hide().text('');
          fillReviewShippingDetails();
          bindReviewStickyFooter();
          ctwpmlInitReviewTermsState();

          // Checkpoint: tela de review renderizada
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_RENDERED', html.length > 100, { 
              htmlLength: html.length,
              hasTotal: !!totals.totalText,
              hasPayment: !!paymentLabel
            });
          }

          // Debug robusto do valor do frete no Review (fonte vs DOM) para diagnosticar fallback/overwrite.
          try {
            var sel0 = state.selectedShipping || {};
            var dom0 = ($('#ctwpml-review-shipping').text() || '').trim();
            var wooTotals0 = woo ? (woo.readTotals ? woo.readTotals() : {}) : {};
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_REVIEW_SHIPPING_SNAPSHOT', true, {
                phase: 'after_render',
                selectedShipping: sel0,
                wooTotalsShipping: wooTotals0 && wooTotals0.shippingText ? String(wooTotals0.shippingText) : '',
                domShipping: dom0,
              });
            }
            if (typeof state.log === 'function') state.log('Review shipping snapshot (after_render)', { selectedShipping: sel0, wooTotalsShipping: wooTotals0.shippingText, domShipping: dom0 }, 'REVIEW');
            setTimeout(function () {
              try {
                var sel1 = state.selectedShipping || {};
                var dom1 = ($('#ctwpml-review-shipping').text() || '').trim();
                var wooTotals1 = woo ? (woo.readTotals ? woo.readTotals() : {}) : {};
                if (typeof state.checkpoint === 'function') {
                  state.checkpoint('CHK_REVIEW_SHIPPING_SNAPSHOT', true, {
                    phase: 'after_render_400ms',
                    selectedShipping: sel1,
                    wooTotalsShipping: wooTotals1 && wooTotals1.shippingText ? String(wooTotals1.shippingText) : '',
                    domShipping: dom1,
                  });
                }
                if (typeof state.log === 'function') state.log('Review shipping snapshot (after_render_400ms)', { selectedShipping: sel1, wooTotalsShipping: wooTotals1.shippingText, domShipping: dom1 }, 'REVIEW');
              } catch (e9) {}
            }, 400);
          } catch (e8) {}
        };

        if (woo && typeof woo.getCartThumbs === 'function') {
          woo.getCartThumbs().then(setHtml).catch(function () { setHtml({ thumb_urls: [], count: 0 }); });
        } else {
          setHtml({ thumb_urls: [], count: 0 });
        }
      };

      if (woo && typeof woo.ensureBlocks === 'function') {
        woo.ensureBlocks().then(run).catch(run);
      } else {
        run();
      }
    }

    // Sempre que o Woo atualizar o checkout, refletimos no modal (subtotal/total).
    $(document.body).on('updated_checkout applied_coupon removed_coupon', function () {
      try {
        if (currentView === 'payment') applyPaymentAvailabilityAndSync();
        if (currentView === 'review') {
          syncReviewTotalsFromWoo();
          // Re-sincroniza termos (Woo pode re-renderizar o DOM).
          try {
            var checked = $('.ctwpml-review-terms-checkbox').first().is(':checked');
            ctwpmlSyncWooTerms(checked);
            ctwpmlSetReviewCtaEnabled(checked);
          } catch (e2) {}
        }
      } catch (e) {}
    });

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
      restoreStateOnOpen = safeReadModalState();
      
      // Modo fullscreen: mostrar componente inline e esconder abas antigas
      $('#ctwpml-address-modal-overlay').css('display', 'block');
      try {
        $('body').addClass('ctwpml-ml-open').css('overflow', 'hidden');
      } catch (e) {}
      // Marcar modal como "aberto" para restaurar após reload.
      persistModalState({ open: true, view: currentView || 'list' });
      // Compatibilidade: se existir root das abas antigas (modo não-ML), esconda.
      if ($('#cc-checkout-tabs-root').length) {
      $('#cc-checkout-tabs-root').hide();
      }
      console.log('[CTWPML][DEBUG] openModal() - componente ML exibido (fullscreen)');

      // =========================================================
      // CHECKPOINTS DE DEBUG - Executar após modal abrir
      // =========================================================
      setTimeout(function () {
        runHealthCheckpoints();
        checkBlocks();
        checkGateways();
      }, 500); // Aguarda render inicial
      
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

        // Aplicar restore (view + seleção) se houver.
        var restored = false;
        var targetView = 'initial';
        try {
          if (restoreStateOnOpen && restoreStateOnOpen.open) {
            // selectedAddressId (se existir no cache atual)
            if (restoreStateOnOpen.selectedAddressId) {
              var maybe = getAddressById(restoreStateOnOpen.selectedAddressId);
              if (maybe) selectedAddressId = restoreStateOnOpen.selectedAddressId;
            }
            // shipping selection
            if (restoreStateOnOpen.selectedShipping && restoreStateOnOpen.selectedShipping.methodId) {
              state.selectedShipping = restoreStateOnOpen.selectedShipping;
            }
            // payment selection
            if (restoreStateOnOpen.selectedPaymentMethod) {
              state.selectedPaymentMethod = restoreStateOnOpen.selectedPaymentMethod;
              try {
                var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
                if (woo && typeof woo.matchGatewayId === 'function' && typeof woo.selectGateway === 'function') {
                  var map = state.paymentGatewayMap || {};
                  var gId = map[state.selectedPaymentMethod] || woo.matchGatewayId(state.selectedPaymentMethod);
                  if (gId) woo.selectGateway(gId);
                }
              } catch (e2) {}
            }

            targetView = (restoreStateOnOpen.view || '').toString() || 'initial';
            restored = true;
          }
        } catch (e) {}

        console.log('[CTWPML][DEBUG] openModal() - restore view:', targetView, 'restored:', restored);
        if (restored && typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_VIEW_RESTORE', true, { restored: true, view: targetView, selectedAddressId: selectedAddressId || '' });
        } else if (!restored && typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_VIEW_RESTORE', true, { restored: false, view: 'initial', reason: 'no_previous_open_state' });
        }

        // Sempre que abrimos/restauramos o modal, garantir que o endereço selecionado esteja refletido no checkout real.
        try {
          if (selectedAddressId) applySelectedAddressToWooFields(selectedAddressId, 'openModal_restore:' + String(targetView || 'initial'));
        } catch (e3) {}

        if (targetView === 'shipping') return showShippingPlaceholder();
        if (targetView === 'payment') return showPaymentScreen();
        if (targetView === 'review') return showReviewConfirmScreen();
        if (targetView === 'form') return showFormForNewAddress();
        if (targetView === 'list') {
      showList();
          renderAddressList();
          return;
        }

        console.log('[CTWPML][DEBUG] openModal() - chamando showInitial()');
        showInitial();
      });
    }

    // Expor para outros módulos (ex.: preparing-checkout.js) conseguirem abrir o modal.
    // Mantemos em debug-friendly (não quebra se setup parcial).
    try {
      state.openAddressModal = openModal;
    } catch (e) {}

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

    function closeModal(opts) {
      opts = opts || {};
      var reason = opts.reason || 'unknown';
      var allowNavigateBack = (typeof opts.allowNavigateBack === 'boolean') ? opts.allowNavigateBack : true;

      state.log('ACTION    closeModal()', { reason: reason, allowNavigateBack: allowNavigateBack, currentView: currentView }, 'ACTION');
      console.log('[CTWPML][DEBUG] closeModal() - reason:', reason, 'allowNavigateBack:', allowNavigateBack, 'currentView:', currentView);

      $('#ctwpml-address-modal-overlay').hide();
      try {
        $('body').removeClass('ctwpml-ml-open').css('overflow', '');
      } catch (e) {}

      // Se o usuário fechou, não devemos restaurar automaticamente após reload.
      clearModalState();

      // NÃO redirecionar automaticamente pro carrinho (isso estava causando o bug).
      // Em modo fullscreen, se existir histórico de navegação, preferimos voltar.
      if (allowNavigateBack) {
        try {
          var hasHistory = (window.history && window.history.length && window.history.length > 1);
          var hasReferrer = !!(document.referrer && document.referrer !== window.location.href);
          if (hasHistory && hasReferrer) {
            state.log('ACTION    closeModal(): history.back()', { reason: reason, historyLength: window.history.length, referrer: document.referrer }, 'ACTION');
            window.history.back();
          }
        } catch (e2) {}
      }
    }

    function showList() {
      currentView = 'list';
      $('#ctwpml-modal-title').text('Meus endereços');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-list').show();
      $('#ctwpml-btn-primary').text('Continuar');
      $('#ctwpml-btn-secondary').text('Adicionar novo endereço');
      setFooterVisible(true);
      persistModalState({ view: 'list' });
    }

    function showForm() {
      currentView = 'form';
      $('#ctwpml-modal-title').text('Adicione um endereço');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
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
      persistModalState({ view: 'form' });
    }

    function showFormForNewAddress() {
      currentView = 'form';
      $('#ctwpml-modal-title').text('Adicionar endereço');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
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
      persistModalState({ view: 'form' });
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
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
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
      persistModalState({ selectedAddressId: selectedAddressId || '', view: currentView });
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

          // DEBUG: Logar campos de frete específicos da resposta do webhook
          if (typeof state.log === 'function') {
            state.log('WEBHOOK_IN (ML) [consultaEnderecoFrete] CAMPOS DE FRETE RECEBIDOS:', {
              motoboy_pr: webhookData?.motoboy_pr || 'NAO_EXISTE_NA_RESPOSTA',
              motoboy_pro: webhookData?.motoboy_pro || 'NAO_EXISTE_NA_RESPOSTA',
              sedex_pr: webhookData?.sedex_pr || 'NAO_EXISTE_NA_RESPOSTA',
              sedex_pro: webhookData?.sedex_pro || 'NAO_EXISTE_NA_RESPOSTA',
              pacmini_pr: webhookData?.pacmini_pr || 'NAO_EXISTE_NA_RESPOSTA',
              pacmini_pro: webhookData?.pacmini_pro || 'NAO_EXISTE_NA_RESPOSTA',
              allKeys: webhookData ? Object.keys(webhookData) : [],
            }, 'WEBHOOK_IN');
          }
          console.log('[CTWPML][WEBHOOK] consultaEnderecoFrete - RESPOSTA COMPLETA:', JSON.stringify(webhookData, null, 2));

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

          // Agora salvar o endereço no backend; payload será persistido APÓS obter address_id
          doSaveAddressToBackend(cepOnly, label, receiverName, normalized, done, webhookData);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (typeof state.log === 'function')
            state.log('WEBHOOK_IN (ML) [consultaEnderecoFrete] Erro (' + textStatus + ').', { status: jqXHR.status, error: errorThrown }, 'WEBHOOK_IN');
          
          // Mesmo com erro no webhook, tentar salvar o endereço usando dados em cache
          if (typeof state.log === 'function') state.log('UI        Salvando endereço sem resposta do webhook (usando cache)...', {}, 'UI');
          doSaveAddressToBackend(cepOnly, label, receiverName, lastCepLookup, done, null);
        },
      });
    }

    // v3.2.13: Função auxiliar para salvar endereço no backend (após validação do webhook)
    function doSaveAddressToBackend(cepOnly, label, receiverName, webhookData, done, webhookRawForPayload) {
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

            // Persistir payload do webhook associado ao ID do endereço salvo/atualizado
            if (selectedAddressId && webhookRawForPayload) {
              try {
                persistAddressPayload(selectedAddressId, webhookRawForPayload);
              } catch (e) {}
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
      // Se vier como array (ex.: [ { ... } ]), usar o primeiro item
      try {
        if (Array.isArray(raw) && raw.length) return raw[0] || null;
      } catch (e) {}
      if (typeof state.normalizarRespostaAPI === 'function') {
        try {
          return state.normalizarRespostaAPI(raw);
        } catch (e) {
          return raw;
        }
      }
      return raw;
    }

    function persistAddressPayload(addressId, raw) {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYLOAD_SAVE');
        } else {
          console.log('[CTWPML][PAYLOAD_SAVE] ' + msg, data || '');
        }
      };

      log('persistAddressPayload() - INICIANDO', { hasRaw: !!raw, addressId: addressId || '' });

      if (!raw) {
        log('persistAddressPayload() - ABORTADO: raw está vazio/null');
        return;
      }
      if (!addressId) {
        log('persistAddressPayload() - ABORTADO: addressId vazio');
        return;
      }
      if (!state.params || !state.params.ajax_url || !state.params.address_payload_nonce) {
        log('persistAddressPayload() - ABORTADO: params não disponíveis', {
          hasParams: !!state.params,
          hasAjaxUrl: !!(state.params && state.params.ajax_url),
          hasNonce: !!(state.params && state.params.address_payload_nonce),
        });
        return;
      }
      if (!isLoggedIn()) {
        log('persistAddressPayload() - ABORTADO: usuário não logado');
        return;
      }

      var normalized = normalizeApiPayload(raw);

      // DEBUG: Mostrar campos de frete especificamente
      log('persistAddressPayload() - CAMPOS DE FRETE NO RAW:', {
        motoboy_pr: raw.motoboy_pr || 'NAO_DEFINIDO',
        motoboy_pro: raw.motoboy_pro || 'NAO_DEFINIDO',
        sedex_pr: raw.sedex_pr || 'NAO_DEFINIDO',
        sedex_pro: raw.sedex_pro || 'NAO_DEFINIDO',
        pacmini_pr: raw.pacmini_pr || 'NAO_DEFINIDO',
        pacmini_pro: raw.pacmini_pro || 'NAO_DEFINIDO',
      });

      log('persistAddressPayload() - RAW COMPLETO:', raw);
      log('persistAddressPayload() - NORMALIZED:', normalized);

      var out = {
        raw: raw,
        normalized: normalized,
      };

      log('persistAddressPayload() - Enviando para o servidor...', { action: 'ctwpml_save_address_payload' });

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_save_address_payload',
          _ajax_nonce: state.params.address_payload_nonce,
          address_id: String(addressId),
          raw_json: JSON.stringify(raw),
          normalized_json: JSON.stringify(normalized),
        },
        success: function (resp) {
          log('persistAddressPayload() - SUCESSO! Resposta:', resp);
          if (resp && resp.success && resp.data) {
            log('persistAddressPayload() - Meta key salva:', resp.data.meta_key);
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          log('persistAddressPayload() - ERRO!', {
            status: jqXHR.status,
            textStatus: textStatus,
            error: errorThrown,
            responseText: jqXHR.responseText,
          });
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
      if (suppressBillingCepClearOnce) {
        try {
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_BILLING_CEP_CHANGED_SUPPRESSED', true, { only: only });
          if (typeof state.log === 'function') state.log('onBillingCepChanged() suprimido (mudança programática)', { only: only }, 'BILLING_SYNC');
        } catch (e0) {}
        return;
      }
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

    function ctwpmlBillingField$(idSelector, nameAttr) {
      var $el = $(idSelector);
      if ($el.length) return $el;
      if (nameAttr) {
        $el = $('input[name="' + nameAttr + '"], select[name="' + nameAttr + '"]').first();
        if ($el.length) return $el;
      }
      return $();
    }

    function ctwpmlSnapshotBillingFields() {
      var snap = {};
      try {
        var keys = [
          ['billing_postcode', 'billing_postcode'],
          ['billing_address_1', 'billing_address_1'],
          ['billing_number', 'billing_number'],
          ['billing_neighborhood', 'billing_neighborhood'],
          ['billing_city', 'billing_city'],
          ['billing_state', 'billing_state'],
        ];
        for (var i = 0; i < keys.length; i++) {
          var pair = keys[i];
          var $f = ctwpmlBillingField$('#' + pair[0], pair[1]);
          snap[pair[0]] = $f.length ? String($f.val() || '') : null;
        }
      } catch (e) {}
      return snap;
    }

    function applySelectedAddressToWooFields(addressId, context) {
      context = context || 'unknown';
      if (!addressId) return { ok: false, reason: 'no_address_id', context: context };

      var it = getAddressById(addressId);
      if (!it) return { ok: false, reason: 'address_not_found', addressId: addressId, context: context };

      var logSync = function (msg, data) {
        try {
          if (typeof state.log === 'function') state.log(msg, data || {}, 'BILLING_SYNC');
          else console.log('[CTWPML][BILLING_SYNC] ' + msg, data || {});
        } catch (e0) {}
      };

      var cep = String(it.cep || '').replace(/\D/g, '').slice(0, 8);
      var rua = String(it.address_1 || '');
      var numero = String(it.number || '');
      var bairro = String(it.neighborhood || '');
      var cidade = String(it.city || '');
      var uf = String(it.state || '');
      var comp = String(it.complement || '');

      var found = {
        billing_postcode: !!ctwpmlBillingField$('#billing_postcode', 'billing_postcode').length,
        billing_address_1: !!ctwpmlBillingField$('#billing_address_1', 'billing_address_1').length,
        billing_number: !!ctwpmlBillingField$('#billing_number', 'billing_number').length,
        billing_neighborhood: !!ctwpmlBillingField$('#billing_neighborhood', 'billing_neighborhood').length,
        billing_city: !!ctwpmlBillingField$('#billing_city', 'billing_city').length,
        billing_state: !!ctwpmlBillingField$('#billing_state', 'billing_state').length,
      };

      var before = ctwpmlSnapshotBillingFields();
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_BILLING_SYNC_ATTEMPT', true, {
          context: context,
          addressId: String(addressId),
          item: { cep: cep, address_1: rua, number: numero, neighborhood: bairro, city: cidade, state: uf },
          found: found,
          before: before,
        });
      }
      logSync('applySelectedAddressToWooFields() - tentativa', { context: context, addressId: addressId, cep: cep, found: found, before: before });

      // Proteger contra limpeza automática ao mudar CEP via código
      suppressBillingCepClearOnce = true;
      lastBillingCepOnly = cep;
      try {
        var $postcode = ctwpmlBillingField$('#billing_postcode', 'billing_postcode');
        if ($postcode.length) $postcode.val(cep).trigger('change');

        var $addr1 = ctwpmlBillingField$('#billing_address_1', 'billing_address_1');
        if ($addr1.length) $addr1.val(rua).trigger('change');

        var $num = ctwpmlBillingField$('#billing_number', 'billing_number');
        if ($num.length) $num.val(numero).trigger('change');

        var $neigh = ctwpmlBillingField$('#billing_neighborhood', 'billing_neighborhood');
        if ($neigh.length) $neigh.val(bairro).trigger('change');

        var $city = ctwpmlBillingField$('#billing_city', 'billing_city');
        if ($city.length) $city.val(cidade).trigger('change');

        var $state = ctwpmlBillingField$('#billing_state', 'billing_state');
        if ($state.length) $state.val(uf).trigger('change');

        // Opcional
        var $comp = ctwpmlBillingField$('#billing_complemento', 'billing_complemento');
        if ($comp.length) $comp.val(comp).trigger('change');

        try { refreshFromCheckoutFields(); } catch (e2) {}
        try { $(document.body).trigger('update_checkout'); } catch (e3) {}
      } finally {
        setTimeout(function () { suppressBillingCepClearOnce = false; }, 0);
      }

      var after = ctwpmlSnapshotBillingFields();
      var missing = [];
      if (after.billing_postcode === null) missing.push('billing_postcode');
      if (after.billing_address_1 === null) missing.push('billing_address_1');
      if (after.billing_number === null) missing.push('billing_number');
      if (after.billing_neighborhood === null) missing.push('billing_neighborhood');
      if (after.billing_city === null) missing.push('billing_city');
      if (after.billing_state === null) missing.push('billing_state');

      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_BILLING_SYNC_RESULT', missing.length === 0, {
          context: context,
          addressId: String(addressId),
          after: after,
          missingFields: missing,
        });
      }

      if (missing.length) {
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_BILLING_SYNC_MISSING_FIELDS', false, { context: context, missingFields: missing });
        logSync('applySelectedAddressToWooFields() - campos ausentes no DOM', { context: context, missing: missing, after: after });
      } else {
        logSync('applySelectedAddressToWooFields() - OK', { context: context, after: after });
      }

      return { ok: missing.length === 0, missingFields: missing, after: after, context: context };
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
      state.log('ACTION    [DEBUG] Click #ctwpml-modal-back', { currentView: currentView, historyLength: (window.history && window.history.length) || 0 }, 'ACTION');
      console.log('[CTWPML][DEBUG] Click #ctwpml-modal-back - currentView:', currentView, 'history.length:', (window.history && window.history.length) || 0);

      // Navegação entre telas:
      // payment → shipping
      // shipping → initial
      // list → initial
      // form → list
      // review → payment
      // initial → fecha modal (ou history.back quando for fullscreen)

      if (currentView === 'payment') {
        console.log('[CTWPML][DEBUG] - voltando de payment para shipping');
        showShippingPlaceholder();
        return;
      }
      if (currentView === 'review') {
        console.log('[CTWPML][DEBUG] - voltando de review para payment');
        showPaymentScreen();
        return;
      }
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
        closeModal({ reason: 'back_from_initial', allowNavigateBack: true });
        return;
      }
      console.log('[CTWPML][DEBUG] - fechando modal (view desconhecida)');
      closeModal({ reason: 'back_unknown_view', allowNavigateBack: true });
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
      // Garantir que o Woo (form.checkout) receba o endereço selecionado imediatamente.
      try {
        applySelectedAddressToWooFields(id, 'list_card_click');
      } catch (e0) {}
      // Evento para permitir reações externas (ex.: re-preparar checkout ao trocar endereço)
      try {
        $(document).trigger('ctwpml_address_selected', [id]);
      } catch (e2) {}
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
        // Continuar na lista de endereços: vai direto para a tela "Escolha quando sua compra chegará"
        state.log('ACTION    Click #ctwpml-btn-primary (lista) - avançando para tela de frete', { selectedAddressId: selectedAddressId }, 'ACTION');
        
        // Aplicar endereço selecionado aos campos billing_* (para consistência)
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
        
        // Ir direto para a tela de frete (não fecha o modal)
        showShippingPlaceholder();
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
      // No fluxo initial -> shipping, garantir sync do endereço selecionado antes de avançar.
      try {
        if (selectedAddressId) applySelectedAddressToWooFields(selectedAddressId, 'initial_go');
      } catch (e0) {}
      showShippingPlaceholder();
    });
    $(document).on('click', '#ctwpml-initial-manage', function (e) {
      e.preventDefault();
      state.log('ACTION    [DEBUG] Click #ctwpml-initial-manage - alterar endereço', {}, 'ACTION');
      console.log('[CTWPML][DEBUG] Click #ctwpml-initial-manage - ir para lista de endereços');
      showList();
      renderAddressList();
    });

    // Tela prazo: seleção de opção de frete (atualiza visual, resumo e WooCommerce)
    $(document).on('click', '#ctwpml-view-shipping .ctwpml-shipping-option', function (e) {
      e.preventDefault();

      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };

      var $this = $(this);
      var methodId = $this.data('method-id');
      var methodType = $this.data('type');
      var priceText = $this.data('price-text') || '';
      var labelText = ($this.find('.ctwpml-shipping-option-text').text() || '').trim();

      log('Click em opção de frete:', { methodId: methodId, type: methodType, priceText: priceText });

      // Atualizar visual (rádio)
      $('#ctwpml-view-shipping .ctwpml-shipping-option').removeClass('is-selected');
      $this.addClass('is-selected');

      log('Visual atualizado - opção selecionada');

      // Atualizar resumo de frete no rodapé (dinâmico)
      var formatFn = window.CCCheckoutTabs && 
                     window.CCCheckoutTabs.AddressMlScreens && 
                     typeof window.CCCheckoutTabs.AddressMlScreens.formatShippingSummaryPrice === 'function'
        ? window.CCCheckoutTabs.AddressMlScreens.formatShippingSummaryPrice
        : function(p) { return p || 'Grátis'; };

      var summaryPrice = formatFn(priceText);
      $('.ctwpml-shipping-summary-price').text(summaryPrice);

      log('Resumo atualizado:', { priceText: priceText, summaryPrice: summaryPrice });

      // Persistir seleção para a tela Review
      state.selectedShipping = {
        methodId: methodId || '',
        type: methodType || '',
        priceText: summaryPrice || priceText || '',
        label: labelText || '',
      };
      persistModalState({ selectedShipping: state.selectedShipping, view: 'shipping' });

      // Atualizar no WooCommerce (se methodId existir)
      if (methodId) {
        setShippingMethodInWC(methodId);
      }
    });

    // Tela prazo: botão Continuar (confirma seleção e avança)
    // Flag para evitar múltiplas esperas simultâneas
    var __shippingContinueWaiting = false;
    
    $(document).on('click', '#ctwpml-shipping-continue', function () {
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'SHIPPING');
        } else {
          console.log('[CTWPML][SHIPPING] ' + msg, data || '');
        }
      };
      
      var $btn = $(this);
      var $selected = $('#ctwpml-view-shipping .ctwpml-shipping-option.is-selected');
      var selectedMethod = $selected.data('method-id');
      var selectedType = $selected.data('type');
      var selectedPriceText = $selected.data('price-text') || '';
      var selectedLabelText = ($selected.find('.ctwpml-shipping-option-text').text() || '').trim();

      log('Click em Continuar - método selecionado:', { methodId: selectedMethod, type: selectedType });

      if (!selectedMethod) {
        log('ERRO: Nenhum método selecionado');
        showNotification('Selecione uma opção de entrega.', 'error');
        return;
      }
      
      // Função auxiliar para avançar para pagamento
      function proceedToPayment() {
        log('Método de frete confirmado, avançando para tela de pagamento');

        // Garantir persistência (caso tenha vindo via pré-seleção automática)
        state.selectedShipping = {
          methodId: selectedMethod || '',
          type: selectedType || '',
          priceText: selectedPriceText || '',
          label: selectedLabelText || '',
        };
        persistModalState({ selectedShipping: state.selectedShipping, view: 'shipping' });

        // Dispara evento customizado para que outros módulos possam reagir
        $(document.body).trigger('ctwpml_shipping_selected', {
          method_id: selectedMethod,
          type: selectedType,
        });

        log('Evento ctwpml_shipping_selected disparado');

        // Avançar para a tela de pagamento (não fecha o modal)
        showPaymentScreen();
      }
      
      // Função para restaurar botão ao estado normal
      function restoreButton() {
        __shippingContinueWaiting = false;
        $btn.prop('disabled', false).text('Continuar');
      }

      // Bloquear avanço se o Woo NÃO aplicou de fato o método selecionado (evita finalizar com PAC por fallback).
      try {
        var last = state.__ctwpmlLastShippingSet || null;
        var wooSnap = ctwpmlReadWooShippingDomSnapshot();
        var wooChecked = wooSnap && wooSnap.checked ? String(wooSnap.checked) : '';

        // Se tivemos tentativa de set pro mesmo método e falhou, não avança.
        if (last && last.requested === String(selectedMethod) && last.ok === false) {
          log('Bloqueando avanço: setShippingMethodInWC falhou para o método selecionado', { last: last, wooChecked: wooChecked });
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_SHIPPING_CONTINUE_BLOCKED', true, { reason: 'set_failed', selectedMethod: String(selectedMethod), last: last, wooChecked: wooChecked });
          showNotification('Não foi possível aplicar o frete selecionado no checkout. Tente escolher o frete novamente.', 'error', 4500);
          return;
        }

        // Se o Woo está com outro método checked, aguardar aplicação ao invés de pedir "tente novamente"
        if (wooChecked && String(wooChecked) !== String(selectedMethod)) {
          log('Aguardando aplicação: Woo checked != UI selected', { selectedMethod: String(selectedMethod), wooChecked: wooChecked, last: last });
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_SHIPPING_CONTINUE_BLOCKED', true, { reason: 'woo_mismatch_waiting', selectedMethod: String(selectedMethod), wooChecked: wooChecked, last: last });
          
          // Se já está aguardando, não faz nada
          if (__shippingContinueWaiting) {
            log('Já aguardando aplicação do frete...');
            return;
          }
          
          // Mostrar estado de "aguardando" no botão
          __shippingContinueWaiting = true;
          $btn.prop('disabled', true).text('Aplicando frete...');
          
          // Re-disparar setShippingMethodInWC para garantir que está em andamento
          setShippingMethodInWC(selectedMethod);
          
          // Aguardar updated_checkout e verificar novamente
          var waitStart = Date.now();
          var maxWait = 8000; // máximo 8 segundos
          
          var checkAndProceed = function() {
            var newSnap = ctwpmlReadWooShippingDomSnapshot();
            var newChecked = newSnap && newSnap.checked ? String(newSnap.checked) : '';
            
            log('Verificando após updated_checkout:', { newChecked: newChecked, selectedMethod: String(selectedMethod), elapsed: Date.now() - waitStart });
            
            if (newChecked === String(selectedMethod)) {
              // Sucesso! Avançar automaticamente
              log('Frete aplicado com sucesso, auto-avançando');
              if (typeof state.checkpoint === 'function') state.checkpoint('CHK_SHIPPING_CONTINUE_ALLOWED', true, { selectedMethod: String(selectedMethod), wooChecked: newChecked, autoAdvance: true });
              restoreButton();
              proceedToPayment();
            } else if (Date.now() - waitStart > maxWait) {
              // Timeout - restaurar e mostrar erro
              log('Timeout aguardando aplicação do frete');
              restoreButton();
              showNotification('O frete está demorando para aplicar. Tente novamente.', 'error', 4500);
            }
            // Se ainda não aplicou e não deu timeout, o próximo updated_checkout vai chamar novamente
          };
          
          // Escutar updated_checkout até aplicar ou timeout
          var onUpdatedCheckout = function() {
            if (!__shippingContinueWaiting) return; // já resolvido
            checkAndProceed();
          };
          
          $(document.body).on('updated_checkout.ctwpml_shipping_wait', onUpdatedCheckout);
          
          // Também verificar com polling como fallback (caso updated_checkout não dispare)
          var pollInterval = setInterval(function() {
            if (!__shippingContinueWaiting) {
              clearInterval(pollInterval);
              $(document.body).off('updated_checkout.ctwpml_shipping_wait');
              return;
            }
            if (Date.now() - waitStart > maxWait) {
              clearInterval(pollInterval);
              $(document.body).off('updated_checkout.ctwpml_shipping_wait');
              restoreButton();
              showNotification('O frete está demorando para aplicar. Tente novamente.', 'error', 4500);
              return;
            }
            // Verificar DOM periodicamente
            var pollSnap = ctwpmlReadWooShippingDomSnapshot();
            var pollChecked = pollSnap && pollSnap.checked ? String(pollSnap.checked) : '';
            if (pollChecked === String(selectedMethod)) {
              clearInterval(pollInterval);
              $(document.body).off('updated_checkout.ctwpml_shipping_wait');
              log('Frete aplicado (detectado via polling)');
              if (typeof state.checkpoint === 'function') state.checkpoint('CHK_SHIPPING_CONTINUE_ALLOWED', true, { selectedMethod: String(selectedMethod), wooChecked: pollChecked, autoAdvance: true, viaPolling: true });
              restoreButton();
              proceedToPayment();
            }
          }, 500);
          
          return;
        }

        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_SHIPPING_CONTINUE_ALLOWED', true, { selectedMethod: String(selectedMethod), wooChecked: wooChecked, last: last });
      } catch (e0) {
        log('Erro ao verificar estado do frete:', e0);
      }

      proceedToPayment();
    });

    // Tela 3 (Pagamento): clique em opção de pagamento (Pix, Boleto, Cartão)
    $(document).on('click', '.ctwpml-payment-option', function (e) {
      e.preventDefault();
      var $this = $(this);
      var method = $this.data('method') || '';

      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      log('Click em opção de pagamento:', { method: method });

      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      var map = state.paymentGatewayMap || {};
      var gatewayId = map[method] || (woo ? woo.matchGatewayId(method) : '');

      if (!woo || !gatewayId) {
        showNotification('Forma de pagamento indisponível no checkout.', 'error', 3500);
        return;
      }

      if (!woo.selectGateway(gatewayId)) {
        showNotification('Não foi possível selecionar o meio de pagamento.', 'error', 3500);
        return;
      }

      state.selectedPaymentMethod = method;
      persistModalState({ selectedPaymentMethod: method, view: 'payment' });

      // Avança para a próxima e última tela (revise e confirme)
      showReviewConfirmScreen();
    });

    // Tela 3 (Pagamento): clique no link de cupom - abre drawer
    $(document).on('click', '#ctwpml-payment-coupon', function (e) {
      e.preventDefault();
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      log('Click em inserir cupom - abrindo drawer');
      toggleCouponDrawer(true);
    });

    // Tela 3 (Pagamento): fechar drawer de cupom (click no overlay)
    $(document).on('click', '#ctwpml-coupon-overlay', function (e) {
      e.preventDefault();
      toggleCouponDrawer(false);
    });

    // Tela 3 (Pagamento): fechar drawer de cupom (click no botão X)
    $(document).on('click', '#ctwpml-coupon-close', function (e) {
      e.preventDefault();
      toggleCouponDrawer(false);
    });

    // Tela 3 (Pagamento): input no campo de cupom - habilita/desabilita botão
    $(document).on('input', '#ctwpml-coupon-input', function () {
      var value = $(this).val().trim();
      var $btn = $('#ctwpml-add-coupon-btn');
      
      if (value.length > 0) {
        $btn.addClass('is-active').prop('disabled', false);
      } else {
        $btn.removeClass('is-active').prop('disabled', true);
      }
    });

    // Tela 3 (Pagamento): click no botão adicionar cupom
    $(document).on('click', '#ctwpml-add-coupon-btn', function (e) {
      e.preventDefault();
      
      var $btn = $(this);
      if ($btn.prop('disabled')) return;
      
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      var couponCode = $('#ctwpml-coupon-input').val().trim();
      log('Click em adicionar cupom:', { code: couponCode });

      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo || typeof woo.ensureBlocks !== 'function') {
        showNotification('Checkout não está pronto para aplicar cupom.', 'error', 3500);
        return;
      }
      if (!couponCode) return;

      woo.ensureBlocks().then(function () {
        // Debug/Checkpoint: tentativa de injeção do bloco de cupom
        if (typeof state.checkpoint === 'function') {
          try {
            var last = window.CCCheckoutTabs && window.CCCheckoutTabs.__ctwpmlLastEnsureBlocks
              ? window.CCCheckoutTabs.__ctwpmlLastEnsureBlocks
              : null;
            if (last && last.coupon) {
              state.checkpoint('CHK_COUPON_BLOCK_FETCHED', !!last.coupon.fetched, {
                fetched: last.coupon.fetched,
                success: last.coupon.success,
                htmlLength: last.coupon.htmlLength,
              });
            } else {
              state.checkpoint('CHK_COUPON_BLOCK_FETCHED', false, { reason: 'no_lastEnsureBlocks' });
            }
          } catch (e0) {
            state.checkpoint('CHK_COUPON_BLOCK_FETCHED', false, { reason: 'exception' });
          }
        }

        // Debug/Checkpoint: presença de forms/elementor UI no DOM
        if (typeof state.checkpoint === 'function') {
          var counts = {
            checkout_coupon: document.querySelectorAll('form.checkout_coupon').length,
            woocommerce_checkout_form_coupon: document.querySelectorAll('#woocommerce-checkout-form-coupon').length,
            elementor_coupon_box: document.querySelectorAll('.e-coupon-box').length,
            elementor_apply_btn: document.querySelectorAll('.e-apply-coupon').length,
            elementor_coupon_code: document.querySelectorAll('.e-coupon-box #coupon_code, .e-coupon-anchor #coupon_code, #coupon_code').length,
          };
          state.checkpoint('CHK_COUPON_FORM_FOUND', (counts.checkout_coupon + counts.woocommerce_checkout_form_coupon) > 0 || counts.elementor_apply_btn > 0, counts);
        }

        // Preferir form padrão do Woo (tema ou injetado).
        var $form = $('form.checkout_coupon').first();
        if (!$form.length) $form = $('#woocommerce-checkout-form-coupon').first();
        if ($form.length) {
          var $code = $form.find('#coupon_code');
          if (!$code.length) $code = $form.find('input[name="coupon_code"]');
          if ($code.length) {
            $code.val(couponCode).trigger('input').trigger('change');
          }
          // O template padrão do Woo deixa o form como display:none; garantimos submit “de verdade”.
          try { $form.css('display', 'block'); } catch (e2) {}
          $form.trigger('submit');
        } else {
          // Fallback Elementor: usa UI do Elementor (input #coupon_code + botão .e-apply-coupon)
          try {
            var $show = $('.e-show-coupon-form').first();
            if ($show.length) $show.trigger('click');
          } catch (e3) {}

          var $elCode = $('.e-coupon-box #coupon_code, .e-coupon-anchor #coupon_code, #coupon_code').first();
          var $elApply = $('.e-apply-coupon').first();
          if ($elCode.length && $elApply.length) {
            $elCode.val(couponCode).trigger('input').trigger('change');
            // click real para permitir handlers do Elementor
            try { $elApply[0].click(); } catch (e4) { $elApply.trigger('click'); }
          } else {
            showNotification('Form de cupom não encontrado.', 'error', 3500);
            return;
          }
        }
        try {
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_OVERLAY_SOURCES', true, {
              source: 'apply_coupon',
              hasBlockOverlay: document.querySelectorAll('.blockUI.blockOverlay').length,
              hasBlockMsg: document.querySelectorAll('.blockUI.blockMsg').length,
              hasNoticeGroup: document.querySelectorAll('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout').length,
            });
          }
        } catch (e5) {}

        toggleCouponDrawer(false);

        // Após o Woo atualizar o checkout, sincronizamos os valores do footer.
        setTimeout(function () {
          applyPaymentAvailabilityAndSync();
        }, 600);
      });
    });

    /**
     * Toggle do drawer de cupom
     * @param {boolean} show - true para abrir, false para fechar
     */
    function toggleCouponDrawer(show) {
      var $overlay = $('#ctwpml-coupon-overlay');
      var $drawer = $('#ctwpml-coupon-drawer');
      
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      if (show) {
        log('Abrindo drawer de cupom');
        $overlay.addClass('is-active');
        $drawer.addClass('is-active');
        $('body').css('overflow', 'hidden'); // Trava scroll do fundo
        
        // Focar no input após animação
        setTimeout(function() {
          $('#ctwpml-coupon-input').focus();
        }, 350);
      } else {
        log('Fechando drawer de cupom');
        $overlay.removeClass('is-active');
        $drawer.removeClass('is-active');
        $('body').css('overflow', ''); // Restaura scroll
      }
    }

    // Tela 4 (Revise e confirme): links de alteração
    $(document).on('click', '#ctwpml-review-change-payment', function (e) {
      e.preventDefault();
      showPaymentScreen();
    });
    $(document).on('click', '#ctwpml-review-change-shipping', function (e) {
      e.preventDefault();
      // conforme layout: este link abre lista de endereços
      showList();
    });
    $(document).on('click', '#ctwpml-review-change-address', function (e) {
      e.preventDefault();
      // conforme layout: este link altera/seleciona prazo de entrega
      showShippingPlaceholder();
    });
    $(document).on('click', '#ctwpml-review-change-billing', function (e) {
      e.preventDefault();
      showFormForEditAddress();
    });

    // Tela 4 (Revise e confirme): termos (sync entre checkbox topo e sticky + Woo)
    $(document).on('change', '.ctwpml-review-terms-checkbox', function () {
      try {
        var checked = $(this).is(':checked');
        // sync entre os dois checkboxes do modal
        $('.ctwpml-review-terms-checkbox').prop('checked', checked);
        // habilita/desabilita CTA
        ctwpmlSetReviewCtaEnabled(checked);
        // sync no Woo (terms + cs_terms_policy_accepted)
        ctwpmlSyncWooTerms(checked);
        // limpa erro se marcou
        if (checked) $('#ctwpml-review-errors').hide().text('');
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_REVIEW_TERMS_CHANGED', true, { checked: checked });
      } catch (e0) {}
    });

    // Tela 4 (Revise e confirme): confirmar compra
    $(document).on('click', '#ctwpml-review-confirm, #ctwpml-review-confirm-sticky', function (e) {
      e.preventDefault();

      var log = function (msg, data) {
        try {
          if (typeof state.log === 'function') state.log(msg, data || {}, 'REVIEW');
        } catch (_) {}
      };

      // Bloqueio por termos: se não aceitou, não tenta submit.
      try {
        var $terms = $('.ctwpml-review-terms-checkbox').first();
        if ($terms.length && !$terms.is(':checked')) {
          showNotification('Você precisa aceitar os termos para continuar.', 'error', 3500);
          var $boxT = $('#ctwpml-review-errors');
          if ($boxT.length) $boxT.text('Você precisa aceitar os termos para continuar.').show();
          ctwpmlSetReviewCtaEnabled(false);
          ctwpmlSyncWooTerms(false);
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_REVIEW_TERMS_REQUIRED', false, {});
          return;
        }
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_REVIEW_TERMS_REQUIRED', true, { checked: $terms.length ? true : null });
      } catch (eT) {}

      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo || !woo.hasCheckoutForm || !woo.hasCheckoutForm()) {
        showNotification('Não foi possível finalizar: form do checkout não encontrado.', 'error', 4500);
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_CTA_SUBMIT', false, { reason: 'no_form' });
        return;
      }

      if (!woo.getSelectedGatewayId || !woo.getSelectedGatewayId()) {
        showNotification('Selecione uma forma de pagamento para continuar.', 'error', 3500);
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_CTA_SUBMIT', false, { reason: 'no_gateway' });
        return;
      }

      // Evita duplo clique.
      $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky').prop('disabled', true).css('opacity', '0.7');

      // Se o Woo emitir erro, reabilita CTA e loga.
      $(document.body).one('checkout_error', function () {
        try {
          $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky').prop('disabled', false).css('opacity', '');
          var $err = $('.woocommerce-error, .woocommerce-NoticeGroup-checkout').first();
          var errText = $err.length ? $err.text().trim() : '';
          log('checkout_error recebido', { text: errText });
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_CHECKOUT_ERROR', true, {
            text: errText,
            hasWooError: document.querySelectorAll('.woocommerce-error').length,
            hasNoticeGroup: document.querySelectorAll('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout').length,
          });

          // Exibir erro dentro do modal (senão parece que o botão “não funciona”).
          if (!errText) errText = 'Não foi possível finalizar. Verifique os campos obrigatórios e tente novamente.';
          showNotification(errText, 'error', 5000);

          var $box = $('#ctwpml-review-errors');
          if ($box.length) {
            $box.text(errText).show();
            // Scroll interno do modal até o erro.
            var $modalBody = $('.ctwpml-modal-body').first();
            if ($modalBody.length) {
              try {
                var top = $box.position().top;
                $modalBody.animate({ scrollTop: $modalBody.scrollTop() + top - 16 }, 250);
              } catch (e3) {}
            }
          }
        } catch (_) {}
      });

      // (Opcional) garante update_checkout antes do submit.
      try { $(document.body).trigger('update_checkout'); } catch (e2) {}

      // Preferência 1: click NATIVO no botão submit
      var btn = document.getElementById('place_order');
      if (btn && typeof btn.click === 'function') {
        log('CTA submit via place_order.click() nativo');
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PLACE_ORDER_NATIVE', true, {});
        btn.click();
        return;
      }
      if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PLACE_ORDER_NATIVE', false, { found: !!btn });

      // Preferência 2: submit NATIVO do form
      var form = document.querySelector('form.checkout, form.woocommerce-checkout');
      if (form && typeof form.submit === 'function') {
        log('CTA submit via form.checkout.submit() nativo');
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_FORM_SUBMIT_NATIVE', true, {});
        form.submit();
        return;
      }
      if (typeof state.checkpoint === 'function') state.checkpoint('CHK_FORM_SUBMIT_NATIVE', false, { found: !!form });

      // Fallback: jQuery submit
      $('form.checkout, form.woocommerce-checkout').first().trigger('submit');
      log('CTA submit via jQuery trigger(submit)');
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


