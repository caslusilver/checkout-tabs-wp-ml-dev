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
    var formDirty = false;

    // =========================================================
    // STATE MACHINE DE CUPOM (hardening v4.2)
    // Evita conflitos entre AJAX do modal e eventos do Woo
    // =========================================================
    state.__ctwpmlCouponBusy = false;
    state.__ctwpmlCouponBusyTs = 0;

    /**
     * Marca início de operação de cupom (apply/remove)
     * Enquanto busy, listeners do Woo não devem re-renderizar UI de cupom
     */
    function setCouponBusy(busy) {
      state.__ctwpmlCouponBusy = !!busy;
      state.__ctwpmlCouponBusyTs = busy ? Date.now() : 0;
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_COUPON_BUSY_STATE', true, { busy: !!busy, ts: state.__ctwpmlCouponBusyTs });
      }
    }

    /**
     * Verifica se está em operação de cupom (com timeout de segurança de 10s)
     */
    function isCouponBusy() {
      if (!state.__ctwpmlCouponBusy) return false;
      // Timeout de segurança: se demorar mais de 10s, libera
      if (Date.now() - state.__ctwpmlCouponBusyTs > 10000) {
        state.__ctwpmlCouponBusy = false;
        state.__ctwpmlCouponBusyTs = 0;
        return false;
      }
      return true;
    }

    // =========================================================
    // FUNÇÕES DE UI DE CUPOM (escopo do módulo - hardening v4.2)
    // Extraídas para serem acessíveis de qualquer handler
    // =========================================================

    function hasSavedAddresses() {
      return Array.isArray(addressesCache) && addressesCache.length > 0;
    }

    /**
     * Reseta a UI do botão de cupom (spinner, loading, etc.)
     */
    function ctwpmlResetCouponUi() {
      try {
        var $btn = $('#ctwpml-add-coupon-btn');
        // Remover spinner/loading state
        $btn.removeClass('is-success is-loading').prop('disabled', false);
        var origText = $btn.data('original-text');
        if (origText) $btn.text(origText);
        // Remover ícone de sucesso se existir
        $btn.find('.ctwpml-coupon-success-icon').remove();
        $('#ctwpml-coupon-input').removeClass('is-error');
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_COUPON_UI_RESET', true, {});
        }
      } catch (e0) {
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_COUPON_UI_RESET', false, { error: String(e0.message || e0) });
        }
      }
    }

    /**
     * Mostra ícone de sucesso (confirm-cupom.svg) após aplicar cupom
     * v4.3: Não fecha automaticamente - o caller decide quando fechar
     */
    function ctwpmlShowCouponSuccessIcon() {
      try {
        var $btn = $('#ctwpml-add-coupon-btn');
        var confirmIconUrl = (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/icones/confirm-cupom.svg';
        $btn.removeClass('is-loading').addClass('is-success');
        // Inserir ícone de sucesso antes do texto
        if (!$btn.find('.ctwpml-coupon-success-icon').length) {
          $btn.prepend('<span class="ctwpml-coupon-success-icon"><img src="' + confirmIconUrl + '" alt="Sucesso" width="22" height="22"></span> ');
        }
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_COUPON_SUCCESS_ICON_SHOWN', true, {});
        }
        // v4.3: Removido o setTimeout que fechava automaticamente
        // O caller (handler AJAX) agora controla quando fechar para evitar "quebra visual"
      } catch (e0) {
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_COUPON_SUCCESS_ICON_SHOWN', false, { error: String(e0.message || e0) });
        }
      }
    }

    /**
     * Toggle do drawer de cupom (escopo do módulo)
     * @param {boolean} show - true para abrir, false para fechar
     */
    function ctwpmlToggleCouponDrawer(show) {
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

    // =========================================================
    // PERSISTÊNCIA DO ESTADO DO MODAL (sessionStorage)
    // =========================================================
    var CTWPML_MODAL_STATE_KEY = 'ctwpml_ml_modal_state_v1';
    var CTWPML_ORDER_COMPLETED_KEY = 'ctwpml_ml_order_completed_v1';
    var CTWPML_AUTH_RESUME_KEY = 'ctwpml_auth_resume_v1';
    var CTWPML_ORDER_COMPLETED_TTL_MS = 5 * 60 * 1000;
    var restoreStateOnOpen = null;
    var authResumeContext = null;

    function readAuthResumeSnapshot() {
      try {
        if (!window.sessionStorage) return null;
        var raw = window.sessionStorage.getItem(CTWPML_AUTH_RESUME_KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        return obj;
      } catch (e) {
        return null;
      }
    }

    function clearAuthResumeSnapshot() {
      try {
        if (!window.sessionStorage) return;
        window.sessionStorage.removeItem(CTWPML_AUTH_RESUME_KEY);
      } catch (e) {}
    }

    function saveAuthResumeSnapshot(payload) {
      try {
        if (!window.sessionStorage) return;
        var base = payload && typeof payload === 'object' ? payload : {};
        base.ts = Date.now();
        window.sessionStorage.setItem(CTWPML_AUTH_RESUME_KEY, JSON.stringify(base));
      } catch (e) {}
    }

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

    function markOrderCompleted(meta) {
      try {
        if (!window.sessionStorage) return;
        var payload = {
          ts: Date.now(),
          meta: meta || {},
        };
        window.sessionStorage.setItem(CTWPML_ORDER_COMPLETED_KEY, JSON.stringify(payload));
        clearModalState();
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_CTA_WC_CHECKOUT_AJAX_COMPLETE', true, {
            source: (meta && meta.source) || 'unknown',
            payload: meta || {},
          });
        }
      } catch (e) {}
    }

    function wasOrderCompletedRecently() {
      try {
        if (!window.sessionStorage) return false;
        var raw = window.sessionStorage.getItem(CTWPML_ORDER_COMPLETED_KEY);
        if (!raw) return false;
        var obj = JSON.parse(raw);
        if (!obj || !obj.ts) return false;
        var age = Date.now() - Number(obj.ts || 0);
        if (age < 0 || age > CTWPML_ORDER_COMPLETED_TTL_MS) {
          window.sessionStorage.removeItem(CTWPML_ORDER_COMPLETED_KEY);
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
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
        pendingAuth: (typeof patch.pendingAuth === 'boolean') ? patch.pendingAuth : !!prev.pendingAuth,
        ts: Date.now(),
      };
      safeWriteModalState(next);
    }

    function tryRestoreModalOnBoot() {
      if (wasOrderCompletedRecently()) {
        clearModalState();
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_VIEW_RESTORE', false, { restored: false, reason: 'order_completed_recently' });
        }
        return;
      }
      var s = safeReadModalState();
      if (!s || !s.open) {
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_VIEW_RESTORE', true, { restored: false, reason: 'no_state' });
        return;
      }
      // Só tenta restaurar se estivermos na página de checkout (form do Woo presente).
      var hasCheckoutForm = !!document.querySelector('form.checkout, form.woocommerce-checkout');
      if (!hasCheckoutForm) {
        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_VIEW_RESTORE', false, { restored: false, reason: 'not_checkout', hasCheckoutForm: hasCheckoutForm });
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
      var htmlOverflow = window.getComputedStyle(document.documentElement).overflow;
      var modalBody = document.querySelector('.ctwpml-modal-body');
      var modalBodyOverflow = modalBody ? window.getComputedStyle(modalBody).overflowY : 'not_found';
      var modalBodyH = modalBody ? (modalBody.clientHeight || 0) : 0;
      var modalBodySH = modalBody ? (modalBody.scrollHeight || 0) : 0;
      var modalHasScroll = modalBody ? (modalBodySH > modalBodyH + 2) : false;

      var modalVisibleNow = !!(modalOverlay && window.getComputedStyle(modalOverlay).display !== 'none');
      // Considera “scroll ok” quando:
      // - modal está visível (senão não faz sentido falhar), e
      // - modal-body tem overflowY auto/scroll, e
      // - o fundo está travado via class OU overflow hidden (html/body) quando fullscreen.
      var bodyLocked = document.body.classList.contains('ctwpml-ml-open') || bodyOverflow === 'hidden' || htmlOverflow === 'hidden';
      var scrollOk = !modalVisibleNow ? true : (bodyLocked && (modalBodyOverflow === 'auto' || modalBodyOverflow === 'scroll'));

      state.checkpoint('CHK_SCROLL_ENABLED', scrollOk, {
        modalVisible: modalVisibleNow,
        bodyOverflow: bodyOverflow,
        htmlOverflow: htmlOverflow,
        bodyLocked: bodyLocked,
        modalBodyOverflowY: modalBodyOverflow,
        modalBodyClientHeight: modalBodyH,
        modalBodyScrollHeight: modalBodySH,
        modalHasScroll: modalHasScroll,
      });

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

    // Spinner lock/refcount: evita “janela” sem spinner em fluxos encadeados (contato -> endereço).
    var ctwpmlSpinnerLocks = 0;
    function ctwpmlSpinnerAcquire(source) {
      try {
        ctwpmlSpinnerLocks = (ctwpmlSpinnerLocks || 0) + 1;
        showModalSpinner();
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_SPINNER_ACQUIRE', true, { source: String(source || ''), locks: ctwpmlSpinnerLocks });
        }
      } catch (e0) {}
    }
    function ctwpmlSpinnerRelease(source) {
      try {
        ctwpmlSpinnerLocks = Math.max(0, (ctwpmlSpinnerLocks || 0) - 1);
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_SPINNER_RELEASE', true, { source: String(source || ''), locks: ctwpmlSpinnerLocks });
        }
        if (ctwpmlSpinnerLocks === 0) {
          hideModalSpinner();
        }
      } catch (e0) {}
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

      // Se existir root do shortcode [checkout_ml], montamos DENTRO dele (sem overlay fullscreen).
      // Caso contrário, mantém comportamento legado (injeta no body).
      var $inlineRoot = $('#ctwpml-root');
      var rootMode = !!($inlineRoot && $inlineRoot.length);
      var $root = rootMode ? $inlineRoot : $('body');
      console.log(
        '[CTWPML][DEBUG] ensureModal() - inserindo componente ML em ' +
          (rootMode ? '#ctwpml-root (modo inline)' : 'body (modo fullscreen legado)')
      );

      $root.append(
        '' +
          '<div id="ctwpml-address-modal-overlay" class="ctwpml-modal-overlay' +
          (rootMode ? ' ctwpml-modal-overlay--root' : '') +
          '">' +
          '  <div class="ctwpml-modal" role="dialog" aria-modal="true" aria-label="Meus endereços">' +
          '    <div class="ctwpml-modal-header">' +
          '      <button type="button" class="ctwpml-modal-back" id="ctwpml-modal-back"><span class="ctwpml-modal-back-icon" aria-hidden="true"></span><img src="' + (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/arrow-back.svg" alt="Voltar" /></button>' +
          '      <div class="ctwpml-modal-title" id="ctwpml-modal-title">Meus endereços</div>' +
          '    </div>' +
          '    <div class="ctwpml-modal-body">' +
          '      <div id="ctwpml-view-auth" style="display:none;"></div>' +
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
          '            <div class="ctwpml-cep-icon"><img src="' + (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/icones/pin-drop.svg" alt="" width="20" height="20" /></div>' +
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
          '        <div class="ctwpml-form-group" id="ctwpml-group-bairro"><label for="ctwpml-input-bairro">Bairro</label><input id="ctwpml-input-bairro" type="text" placeholder="Ex.: Centro" autocomplete="address-level3" /></div>' +
          '        <div class="ctwpml-form-group"><label for="ctwpml-input-info">Informações adicionais (opcional)</label><textarea id="ctwpml-input-info" rows="3" placeholder="Ex.: Entre ruas..."></textarea></div>' +
          '        <div class="ctwpml-type-label">Este é o seu trabalho ou sua casa?</div>' +
          '        <div class="ctwpml-type-option" id="ctwpml-type-home" role="button" tabindex="0">' +
          '          <div class="ctwpml-type-radio"></div>' +
          '          <span><img src="' + (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/icones/home.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Casa</span>' +
          '        </div>' +
          '        <div class="ctwpml-type-option" id="ctwpml-type-work" role="button" tabindex="0">' +
          '          <div class="ctwpml-type-radio"></div>' +
          '          <span><img src="' + (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '') + 'assets/img/icones/work.svg" alt="" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Trabalho</span>' +
          '        </div>' +
          '        <div class="ctwpml-contact-section">' +
          '          <div class="ctwpml-contact-title">Dados de contato</div>' +
          '          <div class="ctwpml-contact-subtitle">Se houver algum problema no envio, você receberá uma ligação neste número.</div>' +
          '          <div class="ctwpml-form-group"><label for="ctwpml-input-nome">Nome completo</label><input id="ctwpml-input-nome" type="text" /></div>' +
          '          <div class="ctwpml-form-group" id="ctwpml-group-phone">' +
          '            <label for="ctwpml-input-fone">Telefone / WhatsApp</label>' +
          '            <div class="ctwpml-phone-wrap" id="ctwpml-phone-wrap">' +
          '              <select id="ctwpml-phone-country" autocomplete="off" placeholder="DDI"></select>' +
          '              <input id="ctwpml-input-fone" type="tel" inputmode="numeric" placeholder="Digite o número" autocomplete="tel" />' +
          '              <input type="hidden" id="ctwpml-phone-full" name="phone_full" />' +
          '            </div>' +
          '          </div>' +
          '          <div class="ctwpml-form-group" id="ctwpml-group-cpf">' +
          '            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">' +
          '              <label for="ctwpml-input-cpf" style="margin:0;">CPF</label>' +
          '              <a class="ctwpml-link-right" href="#" id="ctwpml-generate-cpf-modal" style="position:static; display:none;">Gerar CPF fictício</a>' +
          '            </div>' +
          '            <input id="ctwpml-input-cpf" type="text" placeholder="000.000.000-00" inputmode="numeric" autocomplete="off" />' +
          '            <div class="ctwpml-inline-hint" id="ctwpml-cpf-hint" style="display:none;">Este CPF é fictício e serve apenas para identificar seus pedidos. Guarde este número caso precise retirar encomendas nos Correios.</div>' +
          '          </div>' +
          '          <div class="ctwpml-form-group" id="ctwpml-group-email">' +
          '            <label for="ctwpml-input-email">E-mail</label>' +
          '            <input id="ctwpml-input-email" type="email" placeholder="seu@email.com" autocomplete="email" />' +
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

    function ensureWooNeighborhoodInputs() {
      try {
        var form = document.querySelector('form.checkout, form.woocommerce-checkout');
        if (!form) return false;

        var ensureHidden = function (id, name) {
          try {
            if (form.querySelector('#' + id + ', input[name="' + name + '"]')) return false;
            var wrap = form.querySelector('.ctwpml-hidden-fields');
            if (!wrap) {
              wrap = document.createElement('div');
              wrap.className = 'ctwpml-hidden-fields';
              wrap.style.display = 'none';
              form.appendChild(wrap);
            }
            var input = document.createElement('input');
            input.type = 'hidden';
            input.id = id;
            input.name = name;
            input.value = '';
            wrap.appendChild(input);
            return true;
          } catch (e0) {
            return false;
          }
        };

        // Campo alvo que a validação está exigindo em vários setups.
        ensureHidden('billing_neighborhood', 'billing_neighborhood');
        // Variações comuns em plugins/temas.
        ensureHidden('billing_neighbourhood', 'billing_neighbourhood');
        ensureHidden('billing_bairro', 'billing_bairro');

        return true;
      } catch (e1) {
        return false;
      }
    }

    function showAuthView(opts) {
      opts = opts || {};
      currentView = 'auth';
      try {
        if (opts.preserveView) {
          persistModalState({ view: String(opts.returnView || 'review'), pendingAuth: true });
        } else {
          persistModalState({ view: 'auth' });
        }
      } catch (e0) {}
      $('#ctwpml-modal-title').text('Entrar');
      $('#ctwpml-view-initial').hide();
      $('#ctwpml-view-list').hide();
      $('#ctwpml-view-form').hide();
      $('#ctwpml-view-shipping').hide();
      $('#ctwpml-view-payment').hide();
      $('#ctwpml-view-review').hide();
      $('#ctwpml-view-auth').show();
      setFooterVisible(false);

      // Move o template do auth (servido pelo PHP) para dentro do modal, evitando IDs duplicados.
      try {
        if (!$('#ctwpml-view-auth').children().length) {
          var $tpl = $('#ctwpml-auth-template');
          if ($tpl.length) {
            $('#ctwpml-view-auth').append($tpl.children());
            $tpl.remove();
          }
        }
      } catch (e1) {}

      // Render do reCAPTCHA acontece quando a view auth está visível
      try {
        if (window.ctwpmlRenderRecaptchaIfNeeded) window.ctwpmlRenderRecaptchaIfNeeded();
      } catch (e2) {}
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

    // =========================================================
    // CUPONS (lista + remover) - helpers
    // =========================================================
    function ctwpmlParseBRLToNumber(text) {
      // Aceita: "R$ 79,00", "- R$ 30,00", "−R$30,00", "79,00"
      var s = String(text || '').trim();
      if (!s) return null;
      // normalizar sinal “menos” unicode
      s = s.replace(/\u2212/g, '-');
      // manter apenas dígitos, separadores e sinal
      var negative = s.indexOf('-') !== -1;
      s = s.replace(/[^0-9.,]/g, '');
      if (!s) return null;
      // pt-BR: vírgula é decimal; ponto é milhar (pode existir)
      // remover separadores de milhar
      var parts = s.split(',');
      if (parts.length > 2) {
        // se tiver múltiplas vírgulas, mantém a última como decimal
        var last = parts.pop();
        s = parts.join('') + ',' + last;
      }
      s = s.replace(/\./g, '');
      s = s.replace(',', '.');
      var n = parseFloat(s);
      if (!isFinite(n)) return null;
      return negative ? -Math.abs(n) : n;
    }

    function ctwpmlFormatNumberToBRL(amount) {
      var n = typeof amount === 'number' ? amount : null;
      if (n === null || !isFinite(n)) return '';
      try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
      } catch (e) {
        // fallback simples
        var fixed = (Math.round(n * 100) / 100).toFixed(2);
        return 'R$ ' + fixed.replace('.', ',');
      }
    }

    function ctwpmlSumCouponDiscountFromWooCoupons(coupons) {
      coupons = Array.isArray(coupons) ? coupons : [];
      var sum = 0;
      for (var i = 0; i < coupons.length; i++) {
        var it = coupons[i] || {};
        var v = ctwpmlParseBRLToNumber(it.amountText || '');
        if (v === null) continue;
        sum += Math.abs(v);
      }
      return sum;
    }

    function ctwpmlTotalsRoughlyMatch(aText, bText) {
      var a = ctwpmlParseBRLToNumber(aText);
      var b = ctwpmlParseBRLToNumber(bText);
      if (a === null || b === null) return false;
      return Math.abs(a - b) < 0.02; // tolerância 2 centavos
    }

    // =========================================================
    // STATE ÚNICO DE TOTAIS/CUPOM + RENDER ÚNICO (v4.7)
    // Objetivo: tudo que aparece "só após reload" deve ser renderizado imediatamente no mesmo ciclo.
    // =========================================================
    state.__ctwpmlTotalsState = state.__ctwpmlTotalsState || {
      totals: { subtotalText: '', shippingText: '', totalText: '' },
      coupons: [], // [{code, amountText}]
      discount: { hasDiscount: false, originalTotalText: '', discountedTotalText: '' },
      updatedAt: 0,
      source: '',
    };

    function ctwpmlDeriveDiscountState(totals, coupons) {
      totals = totals || {};
      coupons = Array.isArray(coupons) ? coupons : [];
      var totalNowNum = ctwpmlParseBRLToNumber(totals.totalText || '');
      var discountSum = ctwpmlSumCouponDiscountFromWooCoupons(coupons);
      if (totalNowNum === null || discountSum <= 0.001) {
        return { hasDiscount: false, originalTotalText: '', discountedTotalText: String(totals.totalText || '') };
      }
      var original = totalNowNum + discountSum;
      var originalText = ctwpmlFormatNumberToBRL(original);
      return {
        hasDiscount: true,
        originalTotalText: originalText,
        discountedTotalText: String(totals.totalText || ''),
      };
    }

    function ctwpmlUpdateTotalsStateFromWoo(source) {
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo) return;
      var totals = woo.readTotals ? (woo.readTotals() || {}) : {};
      var coupons = [];
      try { coupons = woo.readCoupons ? (woo.readCoupons() || []) : []; } catch (e0) { coupons = []; }
      state.__ctwpmlTotalsState.totals = {
        subtotalText: String(totals.subtotalText || ''),
        shippingText: String(totals.shippingText || ''),
        totalText: String(totals.totalText || ''),
      };
      // normalizar para {code, amountText}
      state.__ctwpmlTotalsState.coupons = coupons.map(function (c) {
        return { code: String((c && c.code) || ''), amountText: String((c && c.amountText) || '') };
      });
      state.__ctwpmlTotalsState.discount = ctwpmlDeriveDiscountState(state.__ctwpmlTotalsState.totals, state.__ctwpmlTotalsState.coupons);
      state.__ctwpmlTotalsState.updatedAt = Date.now();
      state.__ctwpmlTotalsState.source = String(source || 'woo');
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_TOTALS_STATE_UPDATED_FROM_WOO', true, {
          source: state.__ctwpmlTotalsState.source,
          totalText: state.__ctwpmlTotalsState.totals.totalText,
          couponCodes: state.__ctwpmlTotalsState.coupons.map(function (x) { return String(x.code || ''); }),
          hasDiscount: !!state.__ctwpmlTotalsState.discount.hasDiscount,
        });
      }
    }

    function ctwpmlUpdateTotalsStateFromAjax(data, source) {
      data = data || {};
      var totals = {
        subtotalText: String(data.subtotal_text || ''),
        shippingText: String(data.shipping_text || ''),
        totalText: String(data.total_text || ''),
      };
      var coupons = Array.isArray(data.coupons) ? data.coupons : [];
      var normalizedCoupons = coupons.map(function (c) {
        return { code: String((c && c.code) || ''), amountText: String((c && c.amount_text) || (c && c.amountText) || '') };
      });
      state.__ctwpmlTotalsState.totals = totals;
      state.__ctwpmlTotalsState.coupons = normalizedCoupons;

      // Preferir originalTotal do attempt (quando existe), mas derivar sempre como fallback.
      var derived = ctwpmlDeriveDiscountState(totals, normalizedCoupons);
      if (state.__ctwpmlCouponAttempt && state.__ctwpmlCouponAttempt.originalTotal) {
        derived.originalTotalText = String(state.__ctwpmlCouponAttempt.originalTotal || derived.originalTotalText || '');
        derived.discountedTotalText = String(totals.totalText || derived.discountedTotalText || '');
        derived.hasDiscount = !!(derived.originalTotalText && derived.discountedTotalText && normalizedCoupons.length);
      }
      state.__ctwpmlTotalsState.discount = derived;
      state.__ctwpmlTotalsState.updatedAt = Date.now();
      state.__ctwpmlTotalsState.source = String(source || 'ajax');
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_TOTALS_STATE_UPDATED_FROM_AJAX', true, {
          source: state.__ctwpmlTotalsState.source,
          totalText: state.__ctwpmlTotalsState.totals.totalText,
          couponCodes: state.__ctwpmlTotalsState.coupons.map(function (x) { return String(x.code || ''); }),
          hasDiscount: !!state.__ctwpmlTotalsState.discount.hasDiscount,
        });
      }
    }

    function ctwpmlResyncReviewShipping(source, data) {
      try {
        var sel = state.selectedShipping || {};
        var priceText = String(sel.priceText || '');
        if (priceText) {
          $('#ctwpml-review-shipping').text(priceText);
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_SHIPPING_UI_RESYNC_AFTER_COUPON', true, { source: String(source || ''), value: priceText, from: 'selectedShipping' });
          }
          return;
        }
        if (data && data.shipping_text) {
          $('#ctwpml-review-shipping').text(String(data.shipping_text || ''));
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_SHIPPING_UI_RESYNC_AFTER_COUPON', true, { source: String(source || ''), value: String(data.shipping_text || ''), from: 'ajax' });
          }
        }
      } catch (e0) {}
    }

    function ctwpmlRenderTotalsUI(source) {
      var totals = (state.__ctwpmlTotalsState && state.__ctwpmlTotalsState.totals) ? state.__ctwpmlTotalsState.totals : {};
      var discount = (state.__ctwpmlTotalsState && state.__ctwpmlTotalsState.discount) ? state.__ctwpmlTotalsState.discount : { hasDiscount: false };

      // Payment: subtotal/total
      try {
        if (totals.subtotalText) $('#ctwpml-payment-subtotal-value').text(totals.subtotalText);
      } catch (e0) {}
      try {
        var $totalRow = $('.ctwpml-payment-total-row').first();
        if ($totalRow.length) {
          if (discount && discount.hasDiscount && discount.originalTotalText && discount.discountedTotalText) {
            $totalRow.addClass('has-discount');
            $totalRow.html(
              '<span class="ctwpml-payment-total-label">Você pagará</span>' +
              '<div class="ctwpml-payment-price-wrapper">' +
              '  <span class="ctwpml-payment-original-price" id="ctwpml-payment-original-price">' + escapeHtml(discount.originalTotalText) + '</span>' +
              '  <span class="ctwpml-payment-discounted-price" id="ctwpml-payment-total-value">' + escapeHtml(discount.discountedTotalText) + '</span>' +
              '</div>'
            );
          } else {
            $totalRow.removeClass('has-discount');
            $totalRow.html(
              '<span class="ctwpml-payment-total-label">Você pagará</span>' +
              '<span class="ctwpml-payment-total-value" id="ctwpml-payment-total-value">' + escapeHtml(String(totals.totalText || '')) + '</span>'
            );
          }
        } else if (totals.totalText) {
          $('#ctwpml-payment-total-value').text(totals.totalText);
        }
      } catch (e1) {}

      // Review topo + sticky: total + original riscado
      try {
        if (totals.subtotalText) $('#ctwpml-review-products-subtotal').text(totals.subtotalText);
        if (totals.totalText) {
          $('#ctwpml-review-total').text(totals.totalText);
          $('#ctwpml-review-payment-amount').text(totals.totalText);
          $('#ctwpml-review-sticky-total').text(totals.totalText);
        }
        var $reviewRow = $('.ctwpml-review-total-row').first();
        var $reviewOrig = $('#ctwpml-review-original-total');
        var $stickyRow = $('.ctwpml-review-sticky-total-row').first();
        var $stickyOrig = $('#ctwpml-review-sticky-original-total');
        if (discount && discount.hasDiscount && discount.originalTotalText) {
          $reviewOrig.text(discount.originalTotalText).show();
          $reviewRow.addClass('has-discount');
          if ($stickyOrig.length) $stickyOrig.text(discount.originalTotalText).show();
          if ($stickyRow.length) $stickyRow.addClass('has-discount');
        } else {
          $reviewOrig.text('').hide();
          $reviewRow.removeClass('has-discount');
          if ($stickyOrig.length) $stickyOrig.text('').hide();
          if ($stickyRow.length) $stickyRow.removeClass('has-discount');
        }
      } catch (e2) {}

      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_TOTALS_UI_RENDERED', true, {
          source: String(source || ''),
          view: String(currentView || ''),
          hasDiscount: !!(discount && discount.hasDiscount),
          originalTotalText: discount ? String(discount.originalTotalText || '') : '',
          totalText: String(totals.totalText || ''),
        });
      }
    }

    function ctwpmlNormalizeCouponAmount(amountText) {
      var s = String(amountText || '').trim();
      if (!s) return '';
      if (s.indexOf('-') === 0 || s.indexOf('−') === 0) return s;
      return '- ' + s;
    }

    function ctwpmlBuildCouponsHtml(coupons, context) {
      coupons = Array.isArray(coupons) ? coupons : [];
      if (!coupons.length) return '';
      var title = coupons.length > 1 ? 'Cupons aplicados' : 'Cupom aplicado';
      // Ícones SVG
      var pluginUrl = (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '');
      var removeIconUrl = pluginUrl + 'assets/img/icones/remover-cupom.svg';
      var couponIconUrl = pluginUrl + 'assets/img/icones/coupom-icon.svg';
      var html = '<div class="ctwpml-coupons-title">' + escapeHtml(title) + '</div>';
      for (var i = 0; i < coupons.length; i++) {
        var it = coupons[i] || {};
        var code = String(it.code || '').trim();
        var amount = ctwpmlNormalizeCouponAmount(it.amountText || '');
        if (!code && !amount) continue;
        // v4.6: Ordem (DOM) exigida: ÍCONE → NOME → REMOVER (e valor à direita)
        html += '' +
          '<div class="ctwpml-coupon-row" data-coupon-code="' + escapeHtml(code) + '">' +
          '  <div class="ctwpml-coupon-left">' +
          '    <img src="' + escapeHtml(couponIconUrl) + '" alt="" class="ctwpml-coupon-icon" width="16" height="16" />' +
          '    <span class="ctwpml-coupon-code">' + escapeHtml(code ? code.toUpperCase() : 'CUPOM') + '</span>' +
          '    <button type="button" class="ctwpml-coupon-remove" data-coupon-code="' + escapeHtml(code) + '" data-ctwpml-context="' + escapeHtml(context || '') + '" title="Remover cupom"><img src="' + escapeHtml(removeIconUrl) + '" alt="Remover" width="18" height="18"></button>' +
          '  </div>' +
          '  <div class="ctwpml-coupon-right">' +
          '    <span class="ctwpml-coupon-amount">' + escapeHtml(amount) + '</span>' +
          '  </div>' +
          '</div>';
      }
      return html;
    }

    function ctwpmlRenderCouponsBlock(targetId, coupons, context) {
      try {
        var el = document.getElementById(String(targetId || ''));
        if (!el) return;
        var html = ctwpmlBuildCouponsHtml(coupons, context);
        if (!html) {
          el.innerHTML = '';
          el.style.display = 'none';
        } else {
          el.innerHTML = html;
          el.style.display = '';
        }
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_COUPONS_RENDERED', true, {
            context: String(context || ''),
            targetId: String(targetId || ''),
            count: Array.isArray(coupons) ? coupons.length : 0,
            codes: Array.isArray(coupons) ? coupons.map(function (c) { return String((c && c.code) || ''); }) : [],
          });
        }
      } catch (e0) {}
    }

    function ctwpmlTryClickRemoveCoupon(code, context) {
      code = String(code || '').trim();
      if (!code) return { ok: false, reason: 'empty_code' };
      var selectors = [];
      try { selectors.push('a.woocommerce-remove-coupon[data-coupon="' + CSS.escape(code) + '"]'); } catch (e0) {}
      selectors.push('a.woocommerce-remove-coupon[data-coupon="' + code.replace(/"/g, '\\"') + '"]');
      selectors.push('a.woocommerce-remove-coupon[data-coupon="' + code.toLowerCase() + '"]');
      selectors.push('a.woocommerce-remove-coupon[data-coupon="' + code.toUpperCase() + '"]');

      var link = null;
      for (var i = 0; i < selectors.length; i++) {
        try {
          link = document.querySelector(selectors[i]);
          if (link) break;
        } catch (e1) {}
      }
      if (!link) return { ok: false, reason: 'remove_link_not_found', code: code };
      try { link.click(); } catch (e2) { try { window.jQuery(link).trigger('click'); } catch (e3) {} }
      return { ok: true, code: code };
    }

    function applyPaymentAvailabilityAndSync(eventType) {
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
      var coupons = [];
      try {
        coupons = woo.readCoupons ? (woo.readCoupons() || []) : [];
      } catch (e0) {
        coupons = [];
      }
      // Sempre refletir cupons no Payment (lista abaixo do subtotal)
      ctwpmlRenderCouponsBlock('ctwpml-payment-coupons', coupons, 'payment');

      // v4.0: UI de desconto/cupom (preço riscado + valor final)
      // Guardamos tentativa/estado em state para sobreviver a updated_checkout.
      state.__ctwpmlPaymentDiscount = state.__ctwpmlPaymentDiscount || null;
      state.__ctwpmlCouponAttempt = state.__ctwpmlCouponAttempt || null;

      // v4.2: Usar funções extraídas do escopo do módulo (ctwpmlResetCouponUi, ctwpmlShowCouponSuccessIcon)
      // Isso evita ReferenceError quando chamadas de fora deste escopo

      function renderTotalsNoDiscount() {
        try {
          var $totalRow = $('.ctwpml-payment-total-row').first();
          var $subtotalRow = $('.ctwpml-payment-subtotal-row').first();

          if ($subtotalRow.length) {
            $subtotalRow.removeClass('has-discount');
            // garantir formato simples
            $subtotalRow.html(
              '<span class="ctwpml-payment-subtotal-label">Subtotal</span>' +
              '<span class="ctwpml-payment-subtotal-value" id="ctwpml-payment-subtotal-value">' + escapeHtml(totals.subtotalText || '') + '</span>'
            );
          } else if (totals.subtotalText) {
            $('#ctwpml-payment-subtotal-value').text(totals.subtotalText);
          }

          if ($totalRow.length) {
            $totalRow.removeClass('has-discount');
            $totalRow.html(
              '<span class="ctwpml-payment-total-label">Você pagará</span>' +
              '<span class="ctwpml-payment-total-value" id="ctwpml-payment-total-value">' + escapeHtml(totals.totalText || '') + '</span>'
            );
          } else if (totals.totalText) {
            $('#ctwpml-payment-total-value').text(totals.totalText);
          }
        } catch (e1) {
          if (totals.subtotalText) $('#ctwpml-payment-subtotal-value').text(totals.subtotalText);
          if (totals.totalText) $('#ctwpml-payment-total-value').text(totals.totalText);
        }
      }

      function renderTotalsWithDiscount(discount) {
        try {
          var $totalRow = $('.ctwpml-payment-total-row').first();
          var $subtotalRow = $('.ctwpml-payment-subtotal-row').first();

          // v4.3: Subtotal com desconto - valor original riscado ao lado do atual
          if ($subtotalRow.length && discount.originalSubtotal && discount.discountedSubtotal && String(discount.originalSubtotal) !== String(discount.discountedSubtotal)) {
            $subtotalRow.addClass('has-discount');
            $subtotalRow.html(
              '<span class="ctwpml-payment-subtotal-label">Subtotal</span>' +
              '<span class="ctwpml-payment-subtotal-value" id="ctwpml-payment-subtotal-value">' +
              '  <span class="ctwpml-payment-subtotal-original">' + escapeHtml(discount.originalSubtotal) + '</span>' +
              '  <span class="ctwpml-payment-subtotal-discounted" id="ctwpml-payment-subtotal-discounted">' + escapeHtml(discount.discountedSubtotal) + '</span>' +
              '</span>'
            );
          } else if ($subtotalRow.length) {
            $subtotalRow.removeClass('has-discount');
            $subtotalRow.html(
              '<span class="ctwpml-payment-subtotal-label">Subtotal</span>' +
              '<span class="ctwpml-payment-subtotal-value" id="ctwpml-payment-subtotal-value">' + escapeHtml(totals.subtotalText || '') + '</span>'
            );
          }

          // v4.3: Total "Você pagará" - tudo em 1 linha: label esquerda, valor original riscado + valor atual direita
          if ($totalRow.length) {
            $totalRow.addClass('has-discount');
            $totalRow.html(
              '<span class="ctwpml-payment-total-label">Você pagará</span>' +
              '<div class="ctwpml-payment-price-wrapper">' +
              '  <span class="ctwpml-payment-original-price" id="ctwpml-payment-original-price">' + escapeHtml(discount.originalTotal || '') + '</span>' +
              '  <span class="ctwpml-payment-discounted-price" id="ctwpml-payment-total-value">' + escapeHtml(discount.discountedTotal || (totals.totalText || '')) + '</span>' +
              '</div>'
            );
          }
        } catch (e2) {
          renderTotalsNoDiscount();
        }
      }

      // Evento de remoção do cupom: limpa estado e volta ao normal
      if (String(eventType || '') === 'removed_coupon') {
        state.__ctwpmlPaymentDiscount = null;
        state.__ctwpmlCouponAttempt = null;
        ctwpmlResetCouponUi();
        renderTotalsNoDiscount();
        // lista já foi renderizada acima; manter consistente
      } else {
        // v4.4: Persistência pós-reload
        // Se houver cupons aplicados mas não temos attempt, derivar valor original pelo DOM do Woo:
        // originalTotal = totalAtual + soma(descontos)
        try {
          var hasCoupons = Array.isArray(coupons) && coupons.length > 0;
          if (hasCoupons && totals && totals.totalText) {
            var discountSum = ctwpmlSumCouponDiscountFromWooCoupons(coupons);
            var totalNow = ctwpmlParseBRLToNumber(totals.totalText);
            if (totalNow !== null && discountSum > 0.001) {
              state.__ctwpmlPaymentDiscount = {
                originalTotal: ctwpmlFormatNumberToBRL(totalNow + discountSum),
                discountedTotal: String(totals.totalText || ''),
                // subtotal original é ambíguo (pode ser cupom em shipping), então não forçamos aqui
                originalSubtotal: '',
                discountedSubtotal: '',
                couponName: '',
              };
            }
          }
        } catch (eDerive) {}

        // Se houver tentativa recente, tenta derivar “antes/depois”
        var attempt = state.__ctwpmlCouponAttempt;
        if (attempt && attempt.originalTotal && totals.totalText) {
          var changed = String(attempt.originalTotal) !== String(totals.totalText);
          if (changed) {
            state.__ctwpmlPaymentDiscount = {
              originalTotal: String(attempt.originalTotal || ''),
              discountedTotal: String(totals.totalText || ''),
              originalSubtotal: String(attempt.originalSubtotal || ''),
              discountedSubtotal: String(totals.subtotalText || ''),
              couponName: String(attempt.couponName || attempt.code || ''),
            };
            // v4.1: Mostrar ícone de sucesso com animação
            try { ctwpmlShowCouponSuccessIcon(); } catch (e4) {}
            try { $('#ctwpml-coupon-input').removeClass('is-error'); } catch (e5) {}
          } else if (String(eventType || '') === 'applied_coupon') {
            // Cupom aplicado sem mudar total (ex.: efeito só no frete, etc.) – mantém UI normal.
            // v4.1: Mostrar ícone de sucesso com animação
            try { ctwpmlShowCouponSuccessIcon(); } catch (e6) {}
            try { $('#ctwpml-coupon-input').removeClass('is-error'); } catch (e7) {}
          } else if (String(eventType || '') === 'apply_coupon') {
            // Tentativa concluída sem efeito aparente no total: marcar visualmente como erro (sem travar o usuário).
            try { 
              var $btn = $('#ctwpml-add-coupon-btn');
              $btn.removeClass('is-success is-loading').prop('disabled', false);
              var origText = $btn.data('original-text');
              if (origText) $btn.text(origText);
            } catch (e8) {}
            try { $('#ctwpml-coupon-input').addClass('is-error'); } catch (e9) {}
            try {
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_COUPON_APPLY_NO_CHANGE', false, {
                  code: String(attempt.code || ''),
                  originalTotal: String(attempt.originalTotal || ''),
                  afterTotal: String(totals.totalText || ''),
                  beforeCouponCodes: Array.isArray(attempt.beforeCouponCodes) ? attempt.beforeCouponCodes : [],
                  couponCount: Array.isArray(coupons) ? coupons.length : 0,
                  couponCodes: Array.isArray(coupons) ? coupons.map(function (c) { return String((c && c.code) || ''); }) : [],
                });
              }
            } catch (e10) {}
          }
        }

        if (state.__ctwpmlPaymentDiscount && state.__ctwpmlPaymentDiscount.originalTotal && state.__ctwpmlPaymentDiscount.discountedTotal) {
          renderTotalsWithDiscount(state.__ctwpmlPaymentDiscount);
        } else {
          renderTotalsNoDiscount();
        }
      }

      // v4.7: Sincronizar state único e render único imediatamente
      try { ctwpmlUpdateTotalsStateFromWoo('payment_sync'); } catch (eS0) {}
      try { ctwpmlRenderTotalsUI('payment_sync'); } catch (eS1) {}

      // Guardar mapping para clique
      state.paymentGatewayMap = map;
    }

    function syncReviewTotalsFromWoo() {
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      if (!woo) return;
      var totals = woo.readTotals();
      var coupons = [];
      try {
        coupons = woo.readCoupons ? (woo.readCoupons() || []) : [];
      } catch (e0) {
        coupons = [];
      }
      if (totals.subtotalText) $('#ctwpml-review-products-subtotal').text(totals.subtotalText);
      if (totals.shippingText) {
        try {
          var prev = ($('#ctwpml-review-shipping').text() || '').trim();
          var sel = state.selectedShipping || {};
          var selectedPrice = String(sel.priceText || '');
          var rawShipping = String(totals.shippingText || '').trim();
          var parsed = ctwpmlParseBRLToNumber(rawShipping);
          var isValidShipping = parsed !== null && rawShipping.length < 25;

          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPPING_RAW_WOO', true, {
              context: 'syncReviewTotalsFromWoo',
              raw: rawShipping,
              length: rawShipping.length,
              parsed: parsed,
              isValid: isValidShipping,
            });
          }

          if (selectedPrice) {
            $('#ctwpml-review-shipping').text(selectedPrice);
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_REVIEW_SHIPPING_APPLIED_SOURCE', true, {
                context: 'syncReviewTotalsFromWoo',
                source: 'selectedShipping',
                value: selectedPrice,
                domPrev: prev,
              });
            }
          } else if (isValidShipping) {
            $('#ctwpml-review-shipping').text(rawShipping);
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_REVIEW_SHIPPING_APPLIED_SOURCE', true, {
                context: 'syncReviewTotalsFromWoo',
                source: 'wooTotals',
                value: rawShipping,
                domPrev: prev,
              });
            }
          } else {
            // Evita substituir por texto concatenado/ilegível
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_REVIEW_SHIPPING_APPLIED_SOURCE', false, {
                context: 'syncReviewTotalsFromWoo',
                source: 'skipped_invalid',
                value: rawShipping,
                domPrev: prev,
              });
            }
          }
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPPING_VALUE_SOURCE', true, {
              context: 'syncReviewTotalsFromWoo',
              source: selectedPrice ? 'selectedShipping' : (isValidShipping ? 'wooTotals' : 'skipped_invalid'),
              domPrev: prev,
              domAfter: ($('#ctwpml-review-shipping').text() || '').trim(),
              selectedShippingPrice: selectedPrice,
              differsFromSelected: !!(selectedPrice && prev && selectedPrice !== prev),
            });
          }
          if (typeof state.log === 'function') state.log('Review frete atualizado via Woo totals', { prev: prev, next: $('#ctwpml-review-shipping').text(), selectedShippingPrice: selectedPrice }, 'REVIEW');
        } catch (e0) {
          $('#ctwpml-review-shipping').text(totals.shippingText);
        }
      }
      if (totals.totalText) {
        $('#ctwpml-review-total').text(totals.totalText);
        $('#ctwpml-review-payment-amount').text(totals.totalText);
        $('#ctwpml-review-sticky-total').text(totals.totalText);
      }
      // v4.4: Review (topo + sticky) com valor original riscado + verde quando houver cupom
      try {
        var hasCoupons = Array.isArray(coupons) && coupons.length > 0;
        var $reviewTotalRow = $('.ctwpml-review-total-row').first();
        var $reviewOriginal = $('#ctwpml-review-original-total');
        var $stickyOriginal = $('#ctwpml-review-sticky-original-total');
        var $stickyRow = $('.ctwpml-review-sticky-total-row').first();
        if (hasCoupons && totals && totals.totalText) {
          var discountSum = ctwpmlSumCouponDiscountFromWooCoupons(coupons);
          var totalNow = ctwpmlParseBRLToNumber(totals.totalText);
          if (totalNow !== null && discountSum > 0.001) {
            var originalText = ctwpmlFormatNumberToBRL(totalNow + discountSum);
            $reviewOriginal.text(originalText).show();
            $reviewTotalRow.addClass('has-discount');
            if ($stickyOriginal.length) {
              $stickyOriginal.text(originalText).show();
            }
            if ($stickyRow.length) $stickyRow.addClass('has-discount');
          }
        } else {
          // sem cupons: limpar
          $reviewOriginal.text('').hide();
          $reviewTotalRow.removeClass('has-discount');
          if ($stickyOriginal.length) $stickyOriginal.text('').hide();
          if ($stickyRow.length) $stickyRow.removeClass('has-discount');
        }
      } catch (e3) {}
      // Cupons aplicados (logo abaixo do frete)
      ctwpmlRenderCouponsBlock('ctwpml-review-coupons', coupons, 'review');
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
      var pluginUrl = (state.params && state.params.plugin_url) ? String(state.params.plugin_url) : '';

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

      var methodLine = methodName ? methodName : '';
      if (methodLine && priceText) methodLine += ' • ' + priceText;
      if (!methodLine && priceText) methodLine = priceText;
      if (methodLine) $('#ctwpml-review-shipment-title').text(methodLine);

      // Detalhe da entrega: segunda linha (prazo) usa exatamente o label retornado.
      // Regras:
      // - Só exibe se houver label
      // - Se for motoboy, exibe em verde via classe
      try {
        var $eta = $('#ctwpml-review-shipment-eta');
        if (!$eta.length) return;
        $eta.removeClass('is-motoboy');
        if (!label) {
          $eta.text('').hide();
        } else {
          $eta.text(label).show();
          if (methodId === 'flat_rate:3') $eta.addClass('is-motoboy');
        }
      } catch (eEta) {}

      // Ícone dinâmico da modalidade: Motoboy vs Correios
      try {
        var iconUrl = '';
        if (methodName && /motoboy/i.test(methodName)) {
          iconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/motoboy.svg') : '';
        } else if (methodName && /(sedex|pac|mini)/i.test(methodName)) {
          iconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/correio.svg') : '';
        }
        if (iconUrl) {
          $('#ctwpml-review-shipment-icon').html('<img src="' + iconUrl + '" alt="" />');
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPMENT_ICON_SET', true, { methodId: methodId, methodName: methodName, icon: iconUrl });
          }
        } else {
          $('#ctwpml-review-shipment-icon').empty();
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_REVIEW_SHIPMENT_ICON_SET', false, { methodId: methodId, methodName: methodName, reason: 'no_match_or_no_pluginUrl' });
          }
        }
      } catch (eI) {}

      // Quantidade total de itens no carrinho (fonte: resumo do carrinho)
      try {
        // Evita conteúdo antigo nesse campo (a lista de produtos já é exibida abaixo)
        $('#ctwpml-review-product-name').text('');

        var qtyTotal = Number(state.reviewCartItemCount || 0);
        if (qtyTotal > 0) {
          $('#ctwpml-review-product-qty').text('Quantidade: ' + qtyTotal);
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_REVIEW_SHIPMENT_QTY', true, { qty: qtyTotal });
        } else {
          $('#ctwpml-review-product-qty').text('');
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_REVIEW_SHIPMENT_QTY', false, { qty: qtyTotal });
        }
      } catch (eQ) {}
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
        var billingIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/recipt.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bill.png';
        var shippingIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/gps-1.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/gps-1.png';
        var paymentIconUrl = '';
        try {
          if ((state.selectedPaymentMethod || '').toString() === 'pix') {
            paymentIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/pix.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/artpoin-logo-pix-1-scaled.png';
          } else {
            paymentIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/bank-card.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bank-card.png';
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

        var setHtml = function (summary) {
          summary = summary || {};
          var itemCount = typeof summary.item_count === 'number'
            ? summary.item_count
            : (typeof summary.count === 'number' ? summary.count : 0);
          var items = Array.isArray(summary.items) ? summary.items : [];
          var thumbUrls = Array.isArray(summary.thumb_urls) ? summary.thumb_urls : [];
          var subtotalText = summary.subtotal ? String(summary.subtotal) : (totals.subtotalText || '');
          var totalText = summary.total ? String(summary.total) : (totals.totalText || '');

          // Fonte da verdade para quantidade no bloco de entrega (Review)
          state.reviewCartItemCount = Number(itemCount || 0);

          var html = window.CCCheckoutTabs.AddressMlScreens.renderReviewConfirmScreen({
            productCount: itemCount,
            subtotalText: subtotalText,
            shippingText: totals.shippingText || '',
            totalText: totalText,
            paymentLabel: paymentLabel || '',
            billingName: billingName || '',
            billingCpf: billingCpf || '',
            addressTitle: addressTitle || '',
            addressSubtitle: addressSubtitle || '',
            billingIconUrl: billingIconUrl,
            shippingIconUrl: shippingIconUrl,
            paymentIconUrl: paymentIconUrl,
            thumbUrls: thumbUrls,
            items: items,
          });
          $('#ctwpml-view-review').html(html);
          $('#ctwpml-review-errors').hide().text('');
          fillReviewShippingDetails();
          bindReviewStickyFooter();
          ctwpmlInitReviewTermsState();
          try {
            if (authResumeContext && authResumeContext.resumeAfterAuth) {
              var resumeTerms = !!authResumeContext.termsChecked;
              if (resumeTerms) {
                $('.ctwpml-review-terms-checkbox').prop('checked', true);
                ctwpmlSyncWooTerms(true);
                ctwpmlSetReviewCtaEnabled(true);
              }
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_AUTH_RESUME_APPLIED', true, { termsChecked: resumeTerms, autoSubmit: !!authResumeContext.autoSubmit });
              }
              if (authResumeContext.autoSubmit && resumeTerms) {
                setTimeout(function () {
                  try {
                    $('#ctwpml-review-confirm').first().trigger('click');
                  } catch (eR0) {}
                }, 120);
              }
              clearAuthResumeSnapshot();
              authResumeContext = null;
            }
          } catch (eAR) {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_AUTH_RESUME_APPLIED', false, { error: String(eAR || '') });
            }
          }
          // Cupons aplicados: render imediato (sem depender de updated_checkout)
          try {
            var cps0 = woo && woo.readCoupons ? (woo.readCoupons() || []) : [];
            ctwpmlRenderCouponsBlock('ctwpml-review-coupons', cps0, 'review');
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPONS_RENDERED', true, { context: 'review_after_render', count: Array.isArray(cps0) ? cps0.length : 0 });
            }
          } catch (eC0) {}

          // v4.7: Aplicar imediatamente o mesmo render de desconto do Payment no topo + sticky do Review
          try {
            ctwpmlUpdateTotalsStateFromWoo('review_after_render');
            ctwpmlRenderTotalsUI('review_after_render');
          } catch (eT0) {}

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
          woo.getCartThumbs().then(setHtml).catch(function () {
            setHtml({ thumb_urls: [], count: 0, item_count: 0, items: [], subtotal: '', total: '' });
          });
        } else {
          setHtml({ thumb_urls: [], count: 0, item_count: 0, items: [], subtotal: '', total: '' });
        }
      };

      if (woo && typeof woo.ensureBlocks === 'function') {
        woo.ensureBlocks().then(run).catch(run);
      } else {
        run();
      }
    }

    // Sempre que o Woo atualizar o checkout, refletimos no modal (subtotal/total).
    $(document.body).on('updated_checkout applied_coupon removed_coupon', function (e) {
      try {
        var eventType = e && e.type ? e.type : '';

        // v4.2: Guard - se cupom está "busy" (operação AJAX em andamento), 
        // os eventos applied_coupon/removed_coupon são nossos e não devemos re-processar
        // O updated_checkout do Woo também é esperado e já tratamos via AJAX response
        if (isCouponBusy()) {
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_WOO_EVENT_SKIPPED_COUPON_BUSY', true, { event: eventType, currentView: currentView });
          }
          // Não fazemos nada - deixamos o AJAX handler do modal controlar a UI
          return;
        }

        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_WOO_EVENT_PROCESSED', true, { event: eventType, currentView: currentView, couponBusy: false });
        }

        if (currentView === 'payment') applyPaymentAvailabilityAndSync(eventType);
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

    function loadContactMeta(callback) {

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
            var phoneFull = response.data.phone_full || '';
            var countryCode = response.data.country_code || '';
            var dialCode = response.data.dial_code || '';
            var cpf = response.data.cpf || '';
            var cpfLocked = response.data.cpf_locked || false;

            state.log('UI        Dados de contato carregados', { 
              whatsapp: whatsapp, 
              phoneFull: phoneFull,
              countryCode: countryCode,
              dialCode: dialCode,
              cpf: cpf,
              cpfLocked: cpfLocked 
            }, 'UI');

            // Telefone (novo formato): se phone_full existir, restaurar país + máscara; senão fallback para whatsapp.
            try {
              if (window.ctwpmlPhoneWidget && typeof window.ctwpmlPhoneWidget.setPhoneFull === 'function' && phoneFull) {
                window.ctwpmlPhoneWidget.setPhoneFull(String(phoneFull));
              } else if (whatsapp) {
                $('#ctwpml-input-fone').val(formatPhone(whatsapp));
                // Também tenta popular hidden para persistência
                var digits = phoneDigits(whatsapp);
                if (digits && (digits.length === 10 || digits.length === 11)) {
                  var h = document.getElementById('ctwpml-phone-full');
                  if (h) h.value = '+55' + digits;
                }
              }
            } catch (e0) {
              if (whatsapp) $('#ctwpml-input-fone').val(formatPhone(whatsapp));
            }

            if (cpf) {
              $('#ctwpml-input-cpf').val(formatCpf(cpf));
              if (cpfLocked) {
                $('#ctwpml-input-cpf').prop('readonly', true);
                $('#ctwpml-generate-cpf-modal').hide();
              }
            }
            var email = '';
            try {
              email = response && response.data && response.data.email ? String(response.data.email).trim() : '';
            } catch (eEmail) {}
            if (email) {
              try {
                if (!($('#ctwpml-input-email').val() || '').trim()) {
                  $('#ctwpml-input-email').val(email);
                }
                var $billingEmail = ctwpmlBillingField$('#billing_email', 'billing_email');
                if ($billingEmail.length && !($billingEmail.val() || '').trim()) {
                  ctwpmlSetFieldValue($billingEmail, email);
                }
                if (typeof state.checkpoint === 'function') {
                  state.checkpoint('CHK_CONTACT_EMAIL_RESTORE', true, { hasEmail: true });
                }
              } catch (eEmail2) {}
            } else {
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_CONTACT_EMAIL_RESTORE', false, { hasEmail: false });
              }
            }
            if (typeof callback === 'function') {
              try {
                callback(response.data);
              } catch (eCb) {}
            }
          } else {
            state.log('UI        Nenhum dado de contato encontrado no perfil', {}, 'UI');
            if (typeof callback === 'function') {
              try {
                callback(null);
              } catch (eCb2) {}
            }
          }
        },
        error: function (xhr, status, error) {
          state.log('UI        Erro ao carregar dados de contato', { 
            status: status, 
            error: error 
          }, 'UI');
          if (typeof callback === 'function') {
            try {
              callback(null);
            } catch (eCb3) {}
          }
        },
      });
    }

    function saveContactMeta(optionsOrCallback, maybeCallback) {
      var opts = {};
      var callback = null;
      if (typeof optionsOrCallback === 'function') {
        callback = optionsOrCallback;
      } else {
        opts = optionsOrCallback && typeof optionsOrCallback === 'object' ? optionsOrCallback : {};
        callback = typeof maybeCallback === 'function' ? maybeCallback : null;
      }

      // v2.0 [2.3] (novo formato): o valor fonte da verdade é #ctwpml-phone-full
      var phoneFull = '';
      var countryCode = '';
      var dialCode = '';
      var whatsappDigits = '';
      try {
        phoneFull = ($('#ctwpml-phone-full').val() || '').toString();
        if (window.ctwpmlPhoneWidget && typeof window.ctwpmlPhoneWidget.getSelectedCountry === 'function') {
          countryCode = String(window.ctwpmlPhoneWidget.getSelectedCountry() || '');
          dialCode = String(window.ctwpmlPhoneWidget.getDialCode ? window.ctwpmlPhoneWidget.getDialCode() : '');
        }
        // compat: whatsapp = apenas dígitos (pode incluir DDI)
        whatsappDigits = phoneFull ? String(phoneFull).replace(/\D/g, '') : phoneDigits($('#ctwpml-input-fone').val() || '');
      } catch (e0) {
        whatsappDigits = phoneDigits($('#ctwpml-input-fone').val() || '');
      }
      var cpfRaw = $('#ctwpml-input-cpf').val() || '';
      var cpfDigits = cpfDigitsOnly(cpfRaw); // Remove formatação
      var emailInput = ($('#ctwpml-input-email').val() || '').trim();
      var emailToSave = ctwpmlIsValidEmail(emailInput) ? emailInput : '';

      state.log('UI        Salvando dados de contato', { 
        whatsapp: whatsappDigits, 
        phone_full: phoneFull,
        country_code: countryCode,
        dial_code: dialCode,
        cpf: cpfDigits,
        email_present: !!emailToSave
      }, 'UI');
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_CONTACT_META_SAVE_ATTEMPT', true, { hasEmail: !!emailToSave });
      }

      var spinnerManagedByCaller = !!(opts && opts.spinnerManagedByCaller);
      if (!spinnerManagedByCaller) ctwpmlSpinnerAcquire('save_contact_meta');

      $.ajax({
        url: state.params.ajax_url,
        type: 'POST',
        data: {
          action: 'ctwpml_save_contact_meta',
          whatsapp: whatsappDigits,
          phone_full: phoneFull,
          country_code: countryCode,
          dial_code: dialCode,
          cpf: cpfDigits,
          email: emailToSave,
        },
        success: function (response) {
          if (response && response.success) {
            state.log('UI        Dados de contato salvos com sucesso', response.data, 'UI');
            if (response.data && response.data.cpf_locked) {
              $('#ctwpml-input-cpf').prop('readonly', true);
              $('#ctwpml-generate-cpf-modal').hide();
            }
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_CONTACT_META_SAVE_OK', true, { hasEmail: !!emailToSave });
            }
            // Feedback de sucesso para contato (somente quando não for fluxo de salvar endereço)
            if (!opts || !opts.silent) {
              showNotification('Dados de contato salvos com sucesso!', 'success', 2000);
            }
          } else {
            var errorMsg = (response && response.data && response.data.message) || 'Erro ao salvar dados de contato';
            showNotification(errorMsg, 'error', 3000);
            state.log('UI        Erro ao salvar dados de contato', response, 'UI');
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_CONTACT_META_SAVE_FAIL', false, { hasEmail: !!emailToSave, reason: 'server_error' });
            }
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
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_CONTACT_META_SAVE_FAIL', false, { hasEmail: !!emailToSave, reason: 'ajax_error', status: status });
          }
          if (callback) callback();
        },
        complete: function () {
          if (!spinnerManagedByCaller) ctwpmlSpinnerRelease('save_contact_meta');
        },
      });
    }

    // v2.0 [2.3]: Campo DDI (NOVO FORMATO: TomSelect + IMask) - baseado no modelo externo
    function initInternationalPhoneInput() {
      try {
        var selectEl = document.getElementById('ctwpml-phone-country');
        var inputEl = document.getElementById('ctwpml-input-fone');
        var hiddenEl = document.getElementById('ctwpml-phone-full');

        if (!selectEl || !inputEl || !hiddenEl) {
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PHONE_WIDGET_INIT', false, { reason: 'missing_dom', hasSelect: !!selectEl, hasInput: !!inputEl, hasHidden: !!hiddenEl });
          return;
        }

        if (String(inputEl.getAttribute('data-ctwpml-phone-initialized') || '') === '1') return;

        // deps
        if (!window.IMask || !window.TomSelect) {
          if (typeof state.log === 'function') state.log('UI        v2.0 [2.3] deps ausentes (IMask/TomSelect)', { hasIMask: !!window.IMask, hasTomSelect: !!window.TomSelect }, 'UI');
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PHONE_WIDGET_INIT', false, { reason: 'missing_deps', hasIMask: !!window.IMask, hasTomSelect: !!window.TomSelect });
          return;
        }

        // countryData: ISO2 -> [Nome, DDI, Máscara]
        var countryData = {
          BR: ['Brasil', '55', '(00) 00000-0000'],
          US: ['Estados Unidos', '1', '(000) 000-0000'],
          PT: ['Portugal', '351', '000 000 000'],
          AO: ['Angola', '244', '000 000 000'],
          AR: ['Argentina', '54', '(000) 000-0000'],
          AU: ['Austrália', '61', '0000 000 000'],
          GB: ['Reino Unido', '44', '0000 000000'],
          DE: ['Alemanha', '49', '0000 0000000'],
          ES: ['Espanha', '34', '000 000 000'],
          FR: ['França', '33', '0 00 00 00 00'],
          IT: ['Itália', '39', '000 000 0000'],
          CA: ['Canadá', '1', '(000) 000-0000'],
          JP: ['Japão', '81', '00-0000-0000'],
          CN: ['China', '86', '000 0000 0000'],
          PY: ['Paraguai', '595', '000 000 000'],
          UY: ['Uruguai', '598', '00 000 000'],
          CL: ['Chile', '56', '9 0000 0000'],
          CO: ['Colômbia', '57', '000 000 0000'],
          MX: ['México', '52', '(000) 000-0000'],
          PE: ['Peru', '51', '000 000 000'],
          VE: ['Venezuela', '58', '(000) 000-0000'],
          ZA: ['África do Sul', '27', '00 000 0000'],
          CH: ['Suíça', '41', '00 000 00 00'],
          SE: ['Suécia', '46', '00-000 000 00'],
          NL: ['Holanda', '31', '06 00000000'],
          BE: ['Bélgica', '32', '000 00 00 00'],
          AT: ['Áustria', '43', '000 0000000'],
          DK: ['Dinamarca', '45', '00 00 00 00'],
          NO: ['Noruega', '47', '000 00 000'],
          FI: ['Finlândia', '358', '00 000 0000'],
          NZ: ['Nova Zelândia', '64', '000 000 000'],
          IE: ['Irlanda', '353', '00 000 0000'],
          TR: ['Turquia', '90', '(000) 000 00 00'],
          KR: ['Coreia do Sul', '82', '00-0000-0000'],
          IL: ['Israel', '972', '00-000-0000'],
          SA: ['Arábia Saudita', '966', '00 000 0000'],
          AE: ['Emirados Árabes', '971', '00 000 0000'],
          IN: ['Índia', '91', '00000 00000'],
          ID: ['Indonésia', '62', '000-0000-0000'],
          RU: ['Rússia', '7', '(000) 000-00-00'],
          PL: ['Polônia', '48', '000 000 000'],
          UA: ['Ucrânia', '380', '00 000 00 00'],
          XX: ['Outro', '', '000000000000000'],
        };

        function getFlagEmoji(code) {
          try {
            if (code === 'XX') return '🌐';
            return String(code || '')
              .toUpperCase()
              .replace(/./g, function (char) {
                return String.fromCodePoint(char.charCodeAt(0) + 127397);
              });
          } catch (e) {
            return '';
          }
        }

        var options = [];
        Object.keys(countryData).forEach(function (code) {
          if (code === 'XX') return;
          options.push({
            value: code,
            text: countryData[code][0],
            ddi: countryData[code][1],
            flag: getFlagEmoji(code),
          });
        });
        options.sort(function (a, b) {
          return String(a.text || '').localeCompare(String(b.text || ''));
        });
        options.push({ value: 'XX', text: 'Outro', ddi: '+', flag: getFlagEmoji('XX') });

        var maskInstance = null;

        function updateHidden(countryCode, ddi, unmaskedValue) {
          var val = String(unmaskedValue || '');
          var ddiStr = String(ddi || '');
          var full = '';
          if (countryCode === 'XX') {
            full = val ? ('+' + val.replace(/\D/g, '')) : '';
          } else {
            full = val ? ('+' + ddiStr + val.replace(/\D/g, '')) : '';
          }
          hiddenEl.value = full;

          // Mantém billing_cellphone sincronizado (somente dígitos)
          var digits = full ? full.replace(/\D/g, '') : '';
          if (digits) $('#billing_cellphone').val(digits).trigger('change');

          if (typeof state.log === 'function') {
            state.log('UI        v2.0 [2.3] Phone accept', { country: countryCode, ddi: ddiStr ? ('+' + ddiStr) : '', digitsLen: digits.length, phone_full: full.slice(0, 8) + '...' }, 'UI');
          }
        }

        function updateMask(countryCode, isInitCall) {
          var data = countryData[countryCode];
          if (!data) return;
          var maskPattern = data[2];
          var ddi = data[1];

          if (maskInstance && typeof maskInstance.destroy === 'function') {
            try { maskInstance.destroy(); } catch (e0) {}
          }

          var maskOpts = { lazy: true };
          if (countryCode === 'BR') {
            maskOpts.mask = [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }];
          } else {
            maskOpts.mask = maskPattern;
          }

          try {
            maskInstance = window.IMask(inputEl, maskOpts);
            maskInstance.on('accept', function () {
              updateHidden(countryCode, ddi, maskInstance.unmaskedValue);
            });

            if (countryCode === 'BR') inputEl.placeholder = '(11) 99999-9999';
            else inputEl.placeholder = String(maskPattern || '').replace(/0/g, '0');

            // No modelo, ao trocar país limpa input/hidden (mantém UX consistente)
            if (!isInitCall) {
              inputEl.value = '';
              hiddenEl.value = '';
              $('#billing_cellphone').val('').trigger('change');
            }

            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_PHONE_COUNTRY_CHANGED', true, { country: countryCode, dial_code: ddi ? ('+' + ddi) : '' });
            }
          } catch (e1) {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_PHONE_COUNTRY_CHANGED', false, { error: e1 && e1.message, country: countryCode });
            }
          }
        }

        var tom = new window.TomSelect(selectEl, {
          options: options,
          items: ['BR'],
          valueField: 'value',
          labelField: 'text',
          searchField: ['text', 'ddi'],
          maxOptions: null,
          create: false,
          openOnFocus: true,
          render: {
            option: function (data, escape) {
              var ddiLabel = data.ddi === '+' ? '' : '+' + escape(data.ddi);
              return (
                '<div class="option-content" style="display:flex; align-items:center;">' +
                '  <span class="option-flag" style="font-size:24px;margin-right:8px;line-height:1;">' + (data.flag || '') + '</span>' +
                '  <div style="display:flex; flex-direction:column; margin-left:10px;">' +
                '    <span class="option-name" style="font-weight:bold;">' + escape(data.text || '') + '</span>' +
                '    <span class="option-ddi" style="color:#555;">' + ddiLabel + '</span>' +
                '  </div>' +
                '</div>'
              );
            },
            item: function (data, escape) {
              var ddiLabel = data.ddi === '+' ? '' : '+' + escape(data.ddi);
              return (
                '<div class="option-content" style="display:flex; align-items:center;">' +
                '  <span class="option-flag" style="font-size:24px;line-height:1;">' + (data.flag || '') + '</span>' +
                '  <span class="option-ddi" style="margin-left:5px;">' + ddiLabel + '</span>' +
                '</div>'
              );
            },
          },
          dropdownParent: 'body',
          onDropdownOpen: function (dropdown) {
            try {
              var searchInput = dropdown.querySelector('.dropdown-input');
              if (searchInput) {
                searchInput.setAttribute('inputmode', 'numeric');
                searchInput.setAttribute('pattern', '[0-9]*');
              }
            } catch (e0) {}
          },
        });

        tom.on('change', function (val) {
          updateMask(String(val || ''), false);
          try { setTimeout(function () { inputEl.focus(); }, 100); } catch (e0) {}
        });

        function setNationalDigits(countryCode, digits, opts) {
          try {
            var cc = String(countryCode || '').toUpperCase();
            var only = String(digits || '').replace(/\D/g, '');
            if (!cc) cc = 'BR';

            // BR: nunca permitir que o DDI apareça no input (somente no seletor).
            // Se vier um número com DDI repetido (ex.: 5555...), remove apenas um prefixo de DDI.
            if (cc === 'BR') {
              var brDdi = String((countryData.BR && countryData.BR[1]) || '55');
              if (only.length >= 12 && only.indexOf(brDdi) === 0) {
                only = only.slice(brDdi.length);
              }
            }

            tom.setValue(cc, true);
            updateMask(cc, true);

            if (maskInstance) {
              try { maskInstance.unmaskedValue = only; } catch (e1) {}
            } else {
              inputEl.value = only;
            }

            var ddi = (countryData[cc] && countryData[cc][1]) ? String(countryData[cc][1]) : '';
            updateHidden(cc, ddi, only);
          } catch (e0) {}
        }

        // API para o resto do modal
        window.ctwpmlPhoneWidget = {
          getSelectedCountry: function () { return String(tom.getValue() || ''); },
          getDialCode: function () {
            var cc = String(tom.getValue() || '');
            var ddi = (countryData[cc] && countryData[cc][1]) ? String(countryData[cc][1]) : '';
            return ddi ? ('+' + ddi) : '';
          },
          getPhoneFull: function () { return String(hiddenEl.value || ''); },
          getDigits: function () { return String(hiddenEl.value || '').replace(/\D/g, ''); },
          setNationalDigits: function (countryCode, digits) {
            setNationalDigits(countryCode, digits);
          },
          setPhoneFull: function (phoneFull) {
            try {
              var pf = String(phoneFull || '').trim();
              if (!pf) return;
              var hasPlus = pf.indexOf('+') === 0;
              var digits = pf.replace(/\D/g, '');
              if (!digits) return;

              // Se não vier em formato E.164 (sem +), NÃO tenta inferir DDI.
              // Isso evita “roubar” prefixos (ex.: DDD 55) e duplicar DDI no input.
              if (!hasPlus) {
                setNationalDigits('BR', digits);
                return;
              }

              // Encontrar país por match de DDI (maior DDI primeiro)
              var best = { code: 'XX', ddi: '', rest: digits };
              Object.keys(countryData).forEach(function (code) {
                var ddi = (countryData[code] && countryData[code][1]) ? String(countryData[code][1]) : '';
                if (!ddi) return;
                if (digits.indexOf(ddi) === 0 && ddi.length > (best.ddi || '').length) {
                  best = { code: code, ddi: ddi, rest: digits.slice(ddi.length) };
                }
              });

              tom.setValue(best.code, true);
              updateMask(best.code, true);
              if (maskInstance) {
                try { maskInstance.unmaskedValue = String(best.rest || ''); } catch (e1) {}
              } else {
                inputEl.value = String(best.rest || '');
              }
              updateHidden(best.code, best.ddi, String(best.rest || ''));
            } catch (e0) {}
          },
        };

        // init default BR
        updateMask('BR', true);
        inputEl.setAttribute('data-ctwpml-phone-initialized', '1');

        if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PHONE_WIDGET_INIT', true, { defaultCountry: 'BR' });
        if (typeof state.log === 'function') state.log('UI        v2.0 [2.3] Phone widget inicializado (TomSelect+IMask)', {}, 'UI');
      } catch (e0) {
        try {
          if (typeof state.checkpoint === 'function') state.checkpoint('CHK_PHONE_WIDGET_INIT', false, { error: e0 && e0.message });
        } catch (_) {}
      }
    }

    function openModal(opts) {
      opts = opts || {};
      var resumeSnapshot = opts && opts.resumeSnapshot ? opts.resumeSnapshot : null;
      if (resumeSnapshot) authResumeContext = resumeSnapshot;
      state.log('UI        [DEBUG] openModal() chamado', { isLoggedIn: isLoggedIn(), resumeAfterAuth: !!resumeSnapshot }, 'UI');
      console.log('[CTWPML][DEBUG] openModal() - isLoggedIn:', isLoggedIn(), 'resumeAfterAuth:', !!resumeSnapshot);

      ensureModal();
      // Garantir que o checkout Woo tenha um campo de bairro, mesmo quando o tema/plugin não renderiza.
      try { ensureWooNeighborhoodInputs(); } catch (e0) {}
      refreshFromCheckoutFields();
      restoreStateOnOpen = resumeSnapshot || safeReadModalState();
      
      // Modo fullscreen: mostrar componente inline e esconder abas antigas
      $('#ctwpml-address-modal-overlay').css('display', 'block');
      try {
        var rootMode = !!document.getElementById('ctwpml-root');
        // Root mode: ainda é overlay fullscreen; travar scroll do fundo para evitar conflito com scroll interno.
        if (rootMode) {
          $('body').addClass('ctwpml-ml-open ctwpml-ml-open--root').css('overflow', 'hidden');
        } else {
          $('body').addClass('ctwpml-ml-open').css('overflow', 'hidden');
        }
      } catch (e) {}
      if (resumeSnapshot && resumeSnapshot.view) {
        currentView = String(resumeSnapshot.view);
      }
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
      
      function restoreAndShow() {
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
      }

      if (resumeSnapshot && resumeSnapshot.addressSnapshot) {
        try {
          addressesCache = [resumeSnapshot.addressSnapshot];
          addressesCacheTimestamp = Date.now();
        } catch (eS0) {}
      }
      if (resumeSnapshot && resumeSnapshot.selectedAddressId) {
        selectedAddressId = resumeSnapshot.selectedAddressId;
      }
      if (opts && opts.skipLoadAddresses && resumeSnapshot) {
        hideModalSpinner();
        return restoreAndShow();
      }

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

        restoreAndShow();
      });
    }

    // Expor para outros módulos (ex.: preparing-checkout.js) conseguirem abrir o modal.
    // Mantemos em debug-friendly (não quebra se setup parcial).
    try {
      state.openAddressModal = openModal;
    } catch (e) {}

    function openLoginPopup() {
      // Depreciado: auth agora acontece dentro do modal ML (view auth), sem Fancybox/popup.
      openModal();
    }

    function closeModal(opts) {
      opts = opts || {};
      var reason = opts.reason || 'unknown';
      var allowNavigateBack = (typeof opts.allowNavigateBack === 'boolean') ? opts.allowNavigateBack : true;

      state.log('ACTION    closeModal()', { reason: reason, allowNavigateBack: allowNavigateBack, currentView: currentView }, 'ACTION');
      console.log('[CTWPML][DEBUG] closeModal() - reason:', reason, 'allowNavigateBack:', allowNavigateBack, 'currentView:', currentView);

      // Modo root (shortcode): não "fecha" o checkout ML (senão a página fica vazia).
      // Mantém a UI visível e deixa o handler (se houver) decidir navegação (ex.: ir pro carrinho).
      try {
        if (document.getElementById('ctwpml-root')) {
          state.log('ACTION    closeModal(): rootMode ativo, ignorando hide()', { reason: reason }, 'ACTION');
          return;
        }
      } catch (eR) {}

      $('#ctwpml-address-modal-overlay').hide();
      try {
        $('body').removeClass('ctwpml-ml-open ctwpml-ml-open--root').css('overflow', '');
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
      formDirty = false;
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
      formDirty = false;
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
      initInternationalPhoneInput(); // v2.0 [2.3] (TomSelect + IMask)
      loadContactMeta(); // Carregar WhatsApp e CPF salvos
      setFooterVisible(true);
      persistModalState({ view: 'form' });
    }

    function showFormForNewAddress() {
      currentView = 'form';
      formDirty = false;
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
      $('#ctwpml-input-bairro').val('');
      $('#ctwpml-input-info').val('');
      setCepConfirmVisible(false);
      setRuaHint('', false);
      clearFormErrors();
      setTypeSelection('');
      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      $('#ctwpml-input-nome').val((first + ' ' + last).trim());
      var emailCheckout = ($('#billing_email').val() || '').trim();
      if (!emailCheckout) {
        try {
          emailCheckout = (state.params && state.params.user_email) ? String(state.params.user_email).trim() : '';
        } catch (e0) {}
      }
      if (emailCheckout) $('#ctwpml-input-email').val(emailCheckout);
      $('#ctwpml-input-fone').val(formatPhone((($('#billing_cellphone').val() || '') || '').trim()));
      syncLoginBanner();
      syncCpfUiFromCheckout();
      // v3.2.13: Carregar CPF e WhatsApp do perfil (user_meta) para novo endereço
      initInternationalPhoneInput(); // v2.0 [2.3] (TomSelect + IMask)
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
      formDirty = false;
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
      $('#ctwpml-input-bairro').val(String(item.neighborhood || ''));
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
      try { ensureWooNeighborhoodInputs(); } catch (e0) {}
      try { if (item.neighborhood) ctwpmlSetNeighborhoodInWoo(String(item.neighborhood)); } catch (e1) {}

      // Nome: usar receiver_name do endereço ou nome do checkout
      var first = ($('#billing_first_name').val() || '').trim();
      var last = ($('#billing_last_name').val() || '').trim();
      var receiverName = String(item.receiver_name || (first + ' ' + last)).trim();
      $('#ctwpml-input-nome').val(receiverName);
      
      // WhatsApp: fonte da verdade é phone_full do perfil; billing_cellphone é fallback.
      initInternationalPhoneInput(); // v2.0 [2.3]

      // 1) Primeiro tenta perfil (phone_full) para evitar duplicidade de DDI no input.
      loadContactMeta(function (meta) {
        var filled = false;
        try {
          if (meta && meta.phone_full && window.ctwpmlPhoneWidget && typeof window.ctwpmlPhoneWidget.setPhoneFull === 'function') {
            window.ctwpmlPhoneWidget.setPhoneFull(String(meta.phone_full));
            filled = true;
          }
        } catch (e0) {}

        // 2) Fallback: billing_cellphone do checkout (assumir nacional BR e nunca injetar DDI no input).
        if (!filled) {
          var phoneFromCheckout = ($('#billing_cellphone').val() || '').trim();
          try {
            var digits = phoneDigits(String(phoneFromCheckout || ''));
            if (digits && window.ctwpmlPhoneWidget) {
              // Se já vier com DDI 55 + DDD + número (13 dígitos), remove DDI para preencher só o nacional no input.
              if (digits.length >= 12 && digits.indexOf('55') === 0) {
                digits = digits.slice(2);
              }
              if (typeof window.ctwpmlPhoneWidget.setNationalDigits === 'function') {
                window.ctwpmlPhoneWidget.setNationalDigits('BR', digits);
              } else if (typeof window.ctwpmlPhoneWidget.setPhoneFull === 'function') {
                window.ctwpmlPhoneWidget.setPhoneFull('+' + '55' + digits);
              } else {
                $('#ctwpml-input-fone').val(formatPhone(phoneFromCheckout));
              }
            } else {
              $('#ctwpml-input-fone').val(formatPhone(phoneFromCheckout));
            }
          } catch (e1) {
            $('#ctwpml-input-fone').val(formatPhone(phoneFromCheckout));
          }
        }
      });
      
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

    function ctwpmlNormalizeFullName(fullName) {
      try {
        return String(fullName || '')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (e) {
        return '';
      }
    }

    function ctwpmlParseFullName(fullName) {
      var normalized = ctwpmlNormalizeFullName(fullName);
      if (!normalized) return { normalized: '', firstName: '', lastName: '', hasSurname: false };

      var firstSpaceIdx = normalized.indexOf(' ');
      if (firstSpaceIdx === -1) {
        return { normalized: normalized, firstName: normalized, lastName: '', hasSurname: false };
      }

      var firstName = normalized.slice(0, firstSpaceIdx).trim();
      var lastName = normalized.slice(firstSpaceIdx + 1).trim();
      return { normalized: normalized, firstName: firstName, lastName: lastName, hasSurname: !!lastName };
    }

    function ctwpmlIsValidEmail(email) {
      var v = (email || '').toString().trim().toLowerCase();
      if (!v) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }

    function ctwpmlConfirmGuestEmail(email, context) {
      var normalized = (email || '').toString().trim().toLowerCase();
      if (!normalized) return false;
      if (state.confirmedEmailValue && state.confirmedEmailValue === normalized) {
        return true;
      }
      var ok = window.confirm('Confirme se este e-mail está correto: ' + normalized);
      if (!ok) {
        showNotification('Confirme o e-mail para continuar.', 'error', 3500);
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_EMAIL_CONFIRM', false, { email: normalized, context: String(context || '') });
        }
        return false;
      }
      state.confirmedEmailValue = normalized;
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_EMAIL_CONFIRM', true, { email: normalized, context: String(context || '') });
      }
      return true;
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

      var bairroUi = ($('#ctwpml-input-bairro').val() || '').trim();
      if (!bairroUi) {
        setFieldError('#ctwpml-group-bairro', true);
        ok = false;
        errors.push('Bairro obrigatório');
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
      } else {
        // Woo exige sobrenome em muitos setups. Mantemos um único campo no modal ("Nome completo")
        // e garantimos que tudo após o 1º espaço seja tratado como sobrenome.
        var parsedName = ctwpmlParseFullName(name);
        if (!parsedName.hasSurname) {
          setFieldError('#ctwpml-input-nome', true);
          ok = false;
          errors.push('Sobrenome obrigatório');
        }
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

      var email = ($('#ctwpml-input-email').val() || '').trim();
      if (!ctwpmlIsValidEmail(email)) {
        setFieldError('#ctwpml-group-email', true);
        ok = false;
        errors.push('E-mail inválido');
      }

      if (errors.length > 0) {
        state.log('ERROR     validateForm falhou', { errors: errors, city: city, st: st, hasLastCepLookup: !!lastCepLookup }, 'ERROR');

        // UX: rolar automaticamente para o primeiro erro e focar o campo.
        try {
          var $body = $('.ctwpml-modal-body').first();
          var bodyEl = $body.length ? $body[0] : null;

          var $firstErr = $('#ctwpml-view-form .ctwpml-form-group.is-error:visible, #ctwpml-view-form input.is-error:visible, #ctwpml-view-form textarea.is-error:visible, #ctwpml-view-form .ctwpml-type-option.is-error:visible').first();
          var $focus = null;

          if ($firstErr.length) {
            if ($firstErr.is('input,textarea')) {
              $focus = $firstErr;
            } else {
              $focus = $firstErr.find('input,textarea').filter(':visible').first();
              if (!$focus.length && $firstErr.is('.ctwpml-type-option')) {
                $focus = $firstErr; // opção casa/trabalho
              }
            }

            var targetEl = ($focus && $focus.length) ? $focus[0] : $firstErr[0];

            if (bodyEl && targetEl && targetEl.getBoundingClientRect) {
              var footerH = 0;
              try {
                var $footer = $('.ctwpml-footer:visible').first();
                footerH = $footer.length ? ($footer.outerHeight() || 0) : 0;
              } catch (e0) {}
              if (!footerH) footerH = 180;

              var bodyRect = bodyEl.getBoundingClientRect();
              var targetRect = targetEl.getBoundingClientRect();

              var vv = window.visualViewport;
              var viewportTop = vv ? (vv.offsetTop || 0) : 0;
              var viewportBottom = vv ? ((vv.offsetTop || 0) + (vv.height || window.innerHeight)) : window.innerHeight;

              var padding = 16;
              var targetTopOffset = 40;
              var visibleTop = Math.max(bodyRect.top, viewportTop) + targetTopOffset;
              var visibleBottom = Math.min(bodyRect.bottom, viewportBottom) - footerH - padding;
              if (visibleBottom < visibleTop) visibleBottom = visibleTop + 10;

              var nextTop = bodyEl.scrollTop;
              var delta = 0;
              if (targetRect.top < visibleTop) {
                delta = (targetRect.top - visibleTop) - 12;
                nextTop = Math.max(0, bodyEl.scrollTop + delta);
              } else if (targetRect.bottom > visibleBottom) {
                delta = (targetRect.bottom - visibleBottom) + 12;
                nextTop = Math.max(0, bodyEl.scrollTop + delta);
              }

              try {
                $body.stop(true).animate({ scrollTop: nextTop }, 250);
              } catch (e1) {
                bodyEl.scrollTop = nextTop;
              }

              try {
                if (state && typeof state.checkpoint === 'function') {
                  state.checkpoint('CHK_SCROLL_TO_FIRST_ERROR', true, {
                    fieldId: String(($focus && $focus.length && $focus[0] && $focus[0].id) ? $focus[0].id : ''),
                    delta: delta,
                    nextTop: nextTop,
                  });
                }
              } catch (e2) {}
            }

            // Foco após iniciar scroll (ajuda mobile/teclado).
            if ($focus && $focus.length) {
              setTimeout(function () {
                try { $focus.focus(); } catch (e3) {}
              }, 80);
            }
          }
        } catch (e4) {}
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
      var label = (it.label || '').trim(); // Casa/Trabalho (opcional)
      var a1 = (it.address_1 || '').trim();
      var number = (it.number || '').trim();
      var complement = (it.complement || '').trim();

      // Linha 1: Rua + Número + Complemento
      var line1 = (a1 ? a1 : 'Endereço') + (number ? ', ' + number : '');
      if (complement) line1 += ' - ' + complement;

      var parts = [];
      if (it.neighborhood) parts.push(String(it.neighborhood));
      if (it.city) parts.push(String(it.city));
      if (it.state) parts.push(String(it.state));

      var line = line1 + (parts.length ? ' - ' + parts.join(', ') : '');
      if (it.cep) line += (line ? ', ' : '') + 'CEP ' + formatCep(it.cep);

      // Prefixo opcional com label (não duplicar número aqui)
      if (label) line = label + ': ' + line;
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

    function saveAddressFromForm(optionsOrDone, maybeDone) {
      var opts = {};
      var done = null;
      if (typeof optionsOrDone === 'function') {
        done = optionsOrDone;
      } else {
        opts = optionsOrDone && typeof optionsOrDone === 'object' ? optionsOrDone : {};
        done = typeof maybeDone === 'function' ? maybeDone : null;
      }
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
      var spinnerManagedByCaller = !!(opts && opts.spinnerManagedByCaller);
      if (!spinnerManagedByCaller) ctwpmlSpinnerAcquire('save_address_flow');

      var cepOnly = cepDigits($('#ctwpml-input-cep').val());
      var label = '';
      if ($('#ctwpml-type-home').hasClass('is-active')) label = 'Casa';
      if ($('#ctwpml-type-work').hasClass('is-active')) label = 'Trabalho';

      var receiverName = ($('#ctwpml-input-nome').val() || '').trim();
      // v2.0 [2.3] (novo formato): preferir digits do hidden phone_full
      var whatsappDigits = '';
      try {
        var phoneFull = ($('#ctwpml-phone-full').val() || '').toString();
        whatsappDigits = phoneFull ? phoneFull.replace(/\D/g, '') : phoneDigits($('#ctwpml-input-fone').val());
      } catch (e0) {
        whatsappDigits = phoneDigits($('#ctwpml-input-fone').val());
      }
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
            if (!spinnerManagedByCaller) ctwpmlSpinnerRelease('save_address_flow');
            setFieldError('#ctwpml-input-fone', true);
            showNotification('Por favor, confira o seu número de WhatsApp.', 'error', 5000);
            done({ ok: false, message: 'WhatsApp inválido.' });
            return;
          }

          // Agora salvar o endereço no backend; payload será persistido APÓS obter address_id
          doSaveAddressToBackend(cepOnly, label, receiverName, normalized, done, webhookData, { spinnerManagedByCaller: spinnerManagedByCaller });
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (typeof state.log === 'function')
            state.log('WEBHOOK_IN (ML) [consultaEnderecoFrete] Erro (' + textStatus + ').', { status: jqXHR.status, error: errorThrown }, 'WEBHOOK_IN');
          
          // Mesmo com erro no webhook, tentar salvar o endereço usando dados em cache
          if (typeof state.log === 'function') state.log('UI        Salvando endereço sem resposta do webhook (usando cache)...', {}, 'UI');
          doSaveAddressToBackend(cepOnly, label, receiverName, lastCepLookup, done, null, { spinnerManagedByCaller: spinnerManagedByCaller });
        },
      });
    }

    // v3.2.13: Função auxiliar para salvar endereço no backend (após validação do webhook)
    function doSaveAddressToBackend(cepOnly, label, receiverName, webhookData, done, webhookRawForPayload, opts) {
      opts = opts && typeof opts === 'object' ? opts : {};
      var spinnerManagedByCaller = !!opts.spinnerManagedByCaller;
      // Usar dados do webhook ou fallback para lastCepLookup ou campos do checkout
      var neighborhood = '';
      var city = '';
      var st = '';

      // Prioridade: input do usuário no modal (campo Bairro).
      try {
        neighborhood = ($('#ctwpml-input-bairro').val() || '').trim();
      } catch (e0) {}

      if (webhookData) {
        neighborhood = neighborhood || webhookData.bairro || webhookData.neighborhood || '';
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

      // Garantir que o Woo tenha o valor no campo (quando existir ou for injetado).
      try { ensureWooNeighborhoodInputs(); } catch (e1) {}
      try { if (neighborhood) ctwpmlSetNeighborhoodInWoo(String(neighborhood)); } catch (e2) {}

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
          if (!spinnerManagedByCaller) ctwpmlSpinnerRelease('save_address_flow');
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
      if (bairro) $('#ctwpml-input-bairro').val(String(bairro));

      // Preenche campos do checkout também (inclui campos que não existem no modal).
      if (dados.logradouro) $('#billing_address_1').val(String(dados.logradouro)).trigger('change');
      if (dados.numero) $('#billing_number').val(String(dados.numero)).trigger('change');
      try { ensureWooNeighborhoodInputs(); } catch (e0) {}
      if (bairro) {
        try { ctwpmlSetNeighborhoodInWoo(String(bairro)); } catch (e1) {}
      }
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
        $('#ctwpml-input-bairro').val('');
        $('#ctwpml-input-info').val('');
        setCepConfirmVisible(false);

        // Checkout fields (limpa tudo exceto o CEP)
        try { ensureWooNeighborhoodInputs(); } catch (e0) {}
        $('#billing_address_1').val('').trigger('change');
        $('#billing_number').val('').trigger('change');
        try {
          var els = ctwpmlFindNeighborhoodFields();
          for (var i = 0; i < els.length; i++) {
            var $f = $(els[i]);
            ctwpmlSetFieldValue($f, '');
          }
        } catch (e1) {}
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

    function ctwpmlNormalizeText(val) {
      try {
        return String(val || '').trim();
      } catch (e) {
        return '';
      }
    }

    function ctwpmlDispatchNativeEvent(el, type) {
      try {
        if (!el || !type) return;
        var evt = null;
        try {
          evt = new Event(type, { bubbles: true });
        } catch (e0) {
          // IE/old fallback
          evt = document.createEvent('Event');
          evt.initEvent(type, true, true);
        }
        el.dispatchEvent(evt);
      } catch (e1) {}
    }

    function ctwpmlSetFieldValue($field, value) {
      try {
        if (!$field || !$field.length) return false;
        var el = $field.get(0);
        if (el) {
          try { el.value = value; } catch (e0) {}
          // Eventos nativos (alguns checkouts usam listeners fora do jQuery)
          ctwpmlDispatchNativeEvent(el, 'input');
          ctwpmlDispatchNativeEvent(el, 'change');
        }
        // Compat jQuery
        try { $field.val(value).trigger('input').trigger('change'); } catch (e1) {}
        return true;
      } catch (e2) {
        return false;
      }
    }

    function ctwpmlFindNeighborhoodFields() {
      var fields = [];
      try {
        var selectors = [
          '#billing_neighborhood',
          'input[name="billing_neighborhood"]',
          'input[name="billing_neighbourhood"]',
          'input[name="billing_bairro"]',
          // fallback compat: alguns plugins usam address_2 como bairro
          '#billing_address_2',
          'input[name="billing_address_2"]',
          // shipping (casos onde validação está amarrada no shipping)
          '#shipping_neighborhood',
          'input[name="shipping_neighborhood"]',
          'input[name="shipping_neighbourhood"]',
          'input[name="shipping_bairro"]',
        ];

        for (var i = 0; i < selectors.length; i++) {
          var $f = $(selectors[i]).first();
          if ($f.length) {
            var el = $f.get(0);
            if (el && fields.indexOf(el) === -1) fields.push(el);
          }
        }
      } catch (e0) {}
      return fields;
    }

    function ctwpmlSnapshotNeighborhoodFields() {
      var out = [];
      try {
        var els = ctwpmlFindNeighborhoodFields();
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          out.push({
            id: el && el.id ? String(el.id) : '',
            name: el && el.name ? String(el.name) : '',
            value: el ? ctwpmlNormalizeText(el.value) : '',
          });
        }
      } catch (e0) {}
      return out;
    }

    function ctwpmlGetWooNeighborhoodSnapshot() {
      var out = { neighborhood: null, address_2: null, fields: [] };
      try {
        // Preferência: manter os snapshots antigos (para compat com logs existentes)
        var $n = ctwpmlBillingField$('#billing_neighborhood', 'billing_neighborhood');
        out.neighborhood = $n.length ? ctwpmlNormalizeText($n.val()) : null;
      } catch (e0) {}
      try {
        var $a2 = ctwpmlBillingField$('#billing_address_2', 'billing_address_2');
        out.address_2 = $a2.length ? ctwpmlNormalizeText($a2.val()) : null;
      } catch (e1) {}
      try {
        out.fields = ctwpmlSnapshotNeighborhoodFields();
      } catch (e2) {}
      return out;
    }

    function ctwpmlHasNeighborhoodValue() {
      var snap = ctwpmlGetWooNeighborhoodSnapshot();
      try {
        var a = ctwpmlNormalizeText(snap.neighborhood);
        var b = ctwpmlNormalizeText(snap.address_2);
        if ((a && a.length > 1) || (b && b.length > 1)) return true;
      } catch (e0) {}
      try {
        var fields = snap && snap.fields ? snap.fields : [];
        for (var i = 0; i < fields.length; i++) {
          var v = ctwpmlNormalizeText(fields[i] && fields[i].value ? fields[i].value : '');
          if (v && v.length > 1) return true;
        }
      } catch (e1) {}
      return false;
    }

    function ctwpmlPickFirstNonEmpty(candidates) {
      try {
        for (var i = 0; i < candidates.length; i++) {
          var v = ctwpmlNormalizeText(candidates[i]);
          if (v && v.length > 1) return v;
        }
      } catch (e) {}
      return '';
    }

    function ctwpmlResolveNeighborhoodCandidate(it) {
      // Fonte preferencial: endereço salvo; fallback: lastCepLookup; fallback: freteData; fallback: campos Woo já preenchidos.
      var candidates = [];
      try {
        candidates.push(it && (it.neighborhood || it.bairro) ? (it.neighborhood || it.bairro) : '');
      } catch (e0) {}
      try {
        if (typeof lastCepLookup !== 'undefined' && lastCepLookup) {
          candidates.push(lastCepLookup.bairro || lastCepLookup.neighborhood || '');
        }
      } catch (e1) {}
      try {
        if (window && window.freteData) {
          candidates.push(window.freteData.bairro || window.freteData.neighborhood || '');
        }
      } catch (e2) {}
      try {
        var snap = ctwpmlGetWooNeighborhoodSnapshot();
        candidates.push(snap.neighborhood || '');
        candidates.push(snap.address_2 || '');
        if (snap && snap.fields && snap.fields.length) {
          for (var i = 0; i < snap.fields.length; i++) {
            candidates.push((snap.fields[i] && snap.fields[i].value) || '');
          }
        }
      } catch (e3) {}
      return ctwpmlPickFirstNonEmpty(candidates);
    }

    function ctwpmlSetNeighborhoodInWoo(bairro, opts) {
      opts = opts || {};
      var value = ctwpmlNormalizeText(bairro);
      if (!value || value.length <= 1) return { ok: false, reason: 'empty_value', value: value };

      var wrote = { billing_neighborhood: false, billing_neighbourhood: false, billing_bairro: false, billing_address_2: false, shipping_neighborhood: false };

      // 1) Campo "oficial" (quando existir)
      try {
        var $n = ctwpmlBillingField$('#billing_neighborhood', 'billing_neighborhood');
        if ($n.length) {
          ctwpmlSetFieldValue($n, value);
          wrote.billing_neighborhood = true;
        }
      } catch (e0) {}

      // Variações comuns (plugins/temas)
      try {
        var $nn = $('input[name="billing_neighbourhood"]').first();
        if ($nn.length) {
          ctwpmlSetFieldValue($nn, value);
          wrote.billing_neighbourhood = true;
        }
      } catch (eN0) {}
      try {
        var $nb = $('input[name="billing_bairro"]').first();
        if ($nb.length) {
          ctwpmlSetFieldValue($nb, value);
          wrote.billing_bairro = true;
        }
      } catch (eN1) {}

      // 2) Compat: alguns plugins validam bairro em billing_address_2.
      // Regra anti-conflito: só escreve se estiver vazio OU já igual ao bairro (não sobrescreve complemento real).
      try {
        var $a2 = ctwpmlBillingField$('#billing_address_2', 'billing_address_2');
        if ($a2.length) {
          var cur = ctwpmlNormalizeText($a2.val());
          if (!cur || cur === value) {
            ctwpmlSetFieldValue($a2, value);
            wrote.billing_address_2 = true;
          }
        }
      } catch (e1) {}

      // 3) Shipping (último recurso): só escreve se existir e estiver vazio (anti-conflito)
      try {
        var $sn = $('#shipping_neighborhood, input[name="shipping_neighborhood"], input[name="shipping_neighbourhood"], input[name="shipping_bairro"]').first();
        if ($sn.length) {
          var scur = ctwpmlNormalizeText($sn.val());
          if (!scur || scur === value) {
            ctwpmlSetFieldValue($sn, value);
            wrote.shipping_neighborhood = true;
          }
        }
      } catch (e2) {}

      return { ok: true, value: value, wrote: wrote };
    }

    var ctwpmlNeighborhoodResync = {};
    function ctwpmlScheduleNeighborhoodResync(expectedBairro, key) {
      var value = ctwpmlNormalizeText(expectedBairro);
      if (!value || value.length <= 1) return;
      key = String(key || 'default');

      // Guard: no máximo 2 tentativas por key (evita loop/conflito).
      if (!ctwpmlNeighborhoodResync[key]) ctwpmlNeighborhoodResync[key] = { attempts: 0 };

      var attempt = function (ms) {
        setTimeout(function () {
          try {
            if (!ctwpmlNeighborhoodResync[key] || ctwpmlNeighborhoodResync[key].attempts >= 2) return;
            if (ctwpmlHasNeighborhoodValue()) return;
            ctwpmlNeighborhoodResync[key].attempts += 1;
            ctwpmlSetNeighborhoodInWoo(value);
            if (state && typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_BILLING_NEIGHBORHOOD_RESYNC', true, { key: key, ms: ms, value: value, attempts: ctwpmlNeighborhoodResync[key].attempts });
            }
          } catch (e0) {}
        }, ms);
      };

      attempt(250);
      attempt(800);

      // cleanup best-effort
      setTimeout(function () {
        try { delete ctwpmlNeighborhoodResync[key]; } catch (e0) {}
      }, 2500);
    }

    function ctwpmlSnapshotBillingFields() {
      var snap = {};
      try {
        var keys = [
          ['billing_postcode', 'billing_postcode'],
          ['billing_address_1', 'billing_address_1'],
          ['billing_number', 'billing_number'],
          ['billing_neighborhood', 'billing_neighborhood'],
          ['billing_address_2', 'billing_address_2'],
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
      var bairroExpected = ctwpmlResolveNeighborhoodCandidate(it);

      var found = {
        billing_postcode: !!ctwpmlBillingField$('#billing_postcode', 'billing_postcode').length,
        billing_address_1: !!ctwpmlBillingField$('#billing_address_1', 'billing_address_1').length,
        billing_number: !!ctwpmlBillingField$('#billing_number', 'billing_number').length,
        billing_neighborhood: !!ctwpmlBillingField$('#billing_neighborhood', 'billing_neighborhood').length,
        billing_address_2: !!ctwpmlBillingField$('#billing_address_2', 'billing_address_2').length,
        billing_city: !!ctwpmlBillingField$('#billing_city', 'billing_city').length,
        billing_state: !!ctwpmlBillingField$('#billing_state', 'billing_state').length,
      };

      var before = ctwpmlSnapshotBillingFields();
      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_BILLING_SYNC_ATTEMPT', true, {
          context: context,
          addressId: String(addressId),
          item: { cep: cep, address_1: rua, number: numero, neighborhood: bairro, neighborhood_expected: bairroExpected, city: cidade, state: uf },
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

        // Bairro: robusto (endereço salvo + fallbacks) + compat com plugins que usam billing_address_2.
        // Regra: nunca sobrescrever com vazio.
        if (bairroExpected) ctwpmlSetNeighborhoodInWoo(bairroExpected);

        var $city = ctwpmlBillingField$('#billing_city', 'billing_city');
        if ($city.length) $city.val(cidade).trigger('change');

        var $state = ctwpmlBillingField$('#billing_state', 'billing_state');
        if ($state.length) $state.val(uf).trigger('change');

        // Opcional
        var $comp = ctwpmlBillingField$('#billing_complemento', 'billing_complemento');
        if ($comp.length) $comp.val(comp).trigger('change');

        try { refreshFromCheckoutFields(); } catch (e2) {}
        try { $(document.body).trigger('update_checkout'); } catch (e3) {}

        // Re-sync leve: alguns temas/plugins limpam bairro após update_checkout.
        try {
          ctwpmlScheduleNeighborhoodResync(bairroExpected, 'billing_sync:' + String(addressId) + ':' + String(context) + ':' + String(cep));
        } catch (e4) {}
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
      try { ensureWooNeighborhoodInputs(); } catch (e0) {}
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
      var emailCheckout = ($('#billing_email').val() || '').trim();
      if (!emailCheckout) {
        try {
          emailCheckout = (state.params && state.params.user_email) ? String(state.params.user_email).trim() : '';
        } catch (e0) {}
      }
      if (emailCheckout) $('#ctwpml-input-email').val(emailCheckout);
      $('#ctwpml-input-fone').val(formatPhone((($('#billing_cellphone').val() || '') || '').trim()));
      syncCpfUiFromCheckout();

      // Confirmação visual usando campos do checkout (se já preenchidos)
      var cidade = ($('#billing_city').val() || '').trim();
      var uf = ($('#billing_state').val() || '').trim();
      var bairro = ($('#billing_neighborhood').val() || '').trim();
      setCepConfirm(cidade, uf, bairro);
      if (bairro) $('#ctwpml-input-bairro').val(String(bairro));
    }

    function applyFormToCheckout() {
      try { ensureWooNeighborhoodInputs(); } catch (e0) {}

      var cepDigits = ($('#ctwpml-input-cep').val() || '').replace(/\D/g, '');
      if (cepDigits) $('#billing_postcode').val(cepDigits).trigger('change');

      var rua = ($('#ctwpml-input-rua').val() || '').trim();
      if (rua) $('#billing_address_1').val(rua).trigger('change');

      var numero = ($('#ctwpml-input-numero').val() || '').trim();
      if (numero) $('#billing_number').val(numero).trigger('change');

      var comp = ($('#ctwpml-input-comp').val() || '').trim();
      if (comp) $('#billing_complemento').val(comp).trigger('change');

      var bairroUi = ($('#ctwpml-input-bairro').val() || '').trim();
      if (bairroUi) {
        try { ctwpmlSetNeighborhoodInWoo(String(bairroUi)); } catch (e1) {}
      }

      var nome = ($('#ctwpml-input-nome').val() || '').trim();
      if (nome) {
        var parsed = ctwpmlParseFullName(nome);
        // Mantém compat: mesmo campo no modal, mas split consistente (tudo após 1º espaço = sobrenome).
        if (parsed.firstName) $('#billing_first_name').val(parsed.firstName).trigger('change');
        if (parsed.lastName) $('#billing_last_name').val(parsed.lastName).trigger('change');
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_BILLING_NAME_SPLIT', !!(parsed.firstName && parsed.lastName), {
            normalized: parsed.normalized,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
          });
        }
      }

      var email = ($('#ctwpml-input-email').val() || '').trim();
      if (email) {
        var $email = ctwpmlBillingField$('#billing_email', 'billing_email');
        if ($email.length) ctwpmlSetFieldValue($email, email);
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
      if (!$('#tab-cep').length) return;
      if ($('#ctwpml-open-address-modal').length) return;
      $('#tab-cep').prepend(
        '<button type="button" id="ctwpml-open-address-modal" class="ctwpml-btn ctwpml-btn-secondary" style="margin: 0 0 12px;">Meus endereços</button>'
      );
    }

    // Bindings
    state.ctaManual = true;
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

      if (currentView === 'auth') {
        // Saída explícita: voltar ao carrinho
        var cartUrlA = (state.params && state.params.cart_url) ? String(state.params.cart_url) : '';
        closeModal({ reason: 'auth_exit_to_cart', allowNavigateBack: false });
        if (cartUrlA) {
          setTimeout(function () {
            try { window.location.href = cartUrlA; } catch (eN0) {}
          }, 0);
        }
        return;
      }
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
        if (formDirty) {
          try {
            if (state && typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_FORM_DIRTY_BLOCK_BACK', true, { via: 'modal_back' });
            }
          } catch (e0) {}
          // Produto decidiu: OK = voltar sem salvar / Cancelar = continuar editando
          if (!window.confirm('Você tem alterações não salvas. Deseja voltar sem salvar?')) {
            return;
          }
        }
        if (!hasSavedAddresses()) {
          var cartUrl0 = (state.params && state.params.cart_url) ? String(state.params.cart_url) : '';
          if (cartUrl0) {
            closeModal({ reason: 'back_from_form_no_addresses', allowNavigateBack: false });
            setTimeout(function () {
              try { window.location.href = cartUrl0; } catch (eN0) {}
            }, 0);
          } else {
            closeModal({ reason: 'back_from_form_no_addresses_fallback', allowNavigateBack: true });
          }
          return;
        }
        showList();
        renderAddressList();
        return;
      }
      if (currentView === 'initial') {
        console.log('[CTWPML][DEBUG] - fechando modal (estava em initial)');
        // v5.x: no início do fluxo, voltar deve sair do checkout e ir para o carrinho
        var cartUrl = (state.params && state.params.cart_url) ? String(state.params.cart_url) : '';
        if (cartUrl) {
          closeModal({ reason: 'back_from_initial', allowNavigateBack: false });
          try {
            if (typeof state.checkpoint === 'function') state.checkpoint('CHK_NAV_BACK_TO_CART', true, { cartUrl: cartUrl });
          } catch (eC) {}
          setTimeout(function () {
            try { window.location.href = cartUrl; } catch (eN) {}
          }, 0);
        } else {
          try {
            if (typeof state.checkpoint === 'function') state.checkpoint('CHK_NAV_BACK_TO_CART', false, { reason: 'missing_cart_url' });
          } catch (eC2) {}
          // fallback: comportamento antigo (history)
          closeModal({ reason: 'back_from_initial_fallback', allowNavigateBack: true });
        }
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
        if (formDirty) {
          try {
            if (state && typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_FORM_DIRTY_BLOCK_BACK', true, { via: 'footer_secondary' });
            }
          } catch (e0) {}
          if (!window.confirm('Você tem alterações não salvas. Deseja voltar sem salvar?')) {
            return;
          }
        }
        if (!hasSavedAddresses()) {
          var cartUrl1 = (state.params && state.params.cart_url) ? String(state.params.cart_url) : '';
          if (cartUrl1) {
            closeModal({ reason: 'footer_back_no_addresses', allowNavigateBack: false });
            setTimeout(function () {
              try { window.location.href = cartUrl1; } catch (eN1) {}
            }, 0);
          } else {
            closeModal({ reason: 'footer_back_no_addresses_fallback', allowNavigateBack: true });
          }
          return;
        }
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
        if (!isLoggedIn()) {
          var emailSave = ($('#ctwpml-input-email').val() || '').trim().toLowerCase();
          if (!ctwpmlIsValidEmail(emailSave)) {
            setFieldError('#ctwpml-group-email', true);
            showNotification('Informe um e-mail válido para continuar.', 'error', 3500);
            return;
          }
          if (!ctwpmlConfirmGuestEmail(emailSave, 'save_address')) {
            return;
          }
        }
        applyFormToCheckout();
        // Spinner deve persistir até confirmação + retorno para lista (evita confusão/janela sem bloqueio).
        ctwpmlSpinnerAcquire('primary_save_click');

        var releaseOnce = function (ok) {
          try { ctwpmlSpinnerRelease('primary_save_click'); } catch (e0) {}
        };

        // Salvar WhatsApp e CPF antes do endereço (sem mexer no spinner aqui).
        saveContactMeta({ silent: true, spinnerManagedByCaller: true }, function () {
          saveAddressFromForm({ spinnerManagedByCaller: true }, function (res) {
            if (!res || !res.ok) {
              // Não precisa de alert, a notificação já foi exibida
              state.log('ERROR     saveAddressFromForm falhou', res || {}, 'ERROR');
              releaseOnce(false);
              return;
            }

            // Toast de sucesso já foi exibido dentro do save; agora voltamos para lista e só então liberamos spinner.
            showList();
            renderAddressList();
            releaseOnce(true);
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
      ctwpmlToggleCouponDrawer(true);
    });

    // Tela 3 (Pagamento): fechar drawer de cupom (click no overlay)
    $(document).on('click', '#ctwpml-coupon-overlay', function (e) {
      e.preventDefault();
      ctwpmlToggleCouponDrawer(false);
    });

    // Tela 3 (Pagamento): fechar drawer de cupom (click no botão X)
    $(document).on('click', '#ctwpml-coupon-close', function (e) {
      e.preventDefault();
      ctwpmlToggleCouponDrawer(false);
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

    // Tela 3 (Pagamento): click no botão adicionar cupom - via AJAX controlado (sem reload)
    $(document).on('click', '#ctwpml-add-coupon-btn', function (e) {
      e.preventDefault();
      try { e.stopPropagation(); } catch (e0) {}
      
      var $btn = $(this);
      if ($btn.prop('disabled') || $btn.hasClass('is-loading')) return;
      
      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      var couponCode = $('#ctwpml-coupon-input').val().trim();
      log('Click em adicionar cupom (AJAX):', { code: couponCode });

      if (!couponCode) return;

      var ajaxUrl = state.params && state.params.ajax_url ? state.params.ajax_url : '';
      var couponNonce = state.params && state.params.coupon_nonce ? state.params.coupon_nonce : '';

      if (!ajaxUrl || !couponNonce) {
        showNotification('Configuração inválida. Recarregue a página.', 'error', 3500);
        return;
      }

      // Capturar totais antes para exibir preço riscado
      var woo = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
      var before = woo && woo.readTotals ? woo.readTotals() : {};
      state.__ctwpmlCouponAttempt = {
        code: String(couponCode || ''),
        couponName: String(couponCode || '').toUpperCase(),
        originalTotal: String(before.totalText || ''),
        originalSubtotal: String(before.subtotalText || ''),
        ts: Date.now(),
      };

      // v4.2: Marcar cupom como "busy" para blindar eventos concorrentes do Woo
      setCouponBusy(true);

      // Mostrar spinner no botão
      var originalBtnText = $btn.text();
      $btn.addClass('is-loading').prop('disabled', true).data('original-text', originalBtnText);
      $('#ctwpml-add-coupon-btn').removeClass('is-success');
      $('#ctwpml-coupon-input').removeClass('is-error');

      if (typeof state.checkpoint === 'function') {
        state.checkpoint('CHK_COUPON_APPLY_AJAX_SENT', true, { code: couponCode, busy: true });
      }

      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        data: {
          action: 'ctwpml_apply_coupon',
          _ajax_nonce: couponNonce,
          coupon_code: couponCode,
        },
        success: function (resp) {
          log('Resposta apply_coupon AJAX:', resp);

          if (resp && resp.success && resp.data) {
            // Sucesso: atualizar UI com dados retornados
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_AJAX_OK', true, { code: couponCode, data: resp.data });
            }

            // Guardar desconto para exibir preço riscado
            state.__ctwpmlPaymentDiscount = {
              originalTotal: state.__ctwpmlCouponAttempt.originalTotal,
              discountedTotal: resp.data.total_text || '',
              originalSubtotal: state.__ctwpmlCouponAttempt.originalSubtotal,
              discountedSubtotal: resp.data.subtotal_text || '',
              couponName: String(couponCode || '').toUpperCase(),
            };

            // Atualizar lista de cupons na UI
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_UPDATE_UI_START', true, { code: couponCode, couponsCount: (resp.data.coupons || []).length });
            }
            ctwpmlUpdateCouponsFromAjax(resp.data.coupons || [], 'payment');
            ctwpmlUpdateCouponsFromAjax(resp.data.coupons || [], 'review');

            // Atualizar totais na UI
            ctwpmlUpdateTotalsFromAjax(resp.data);
            // v4.7: Atualização imediata (sem depender de reload/navegação)
            try {
              ctwpmlUpdateTotalsStateFromAjax(resp.data, 'apply_ajax_success');
              ctwpmlRenderTotalsUI('apply_ajax_success');
              ctwpmlResyncReviewShipping('apply_ajax_success', resp.data);
            } catch (eR0) {}

            // Mostrar sucesso no botão
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_SHOW_SUCCESS_START', true, { code: couponCode });
            }
            ctwpmlShowCouponSuccessIcon();
            $('#ctwpml-coupon-input').val('');

            // v4.4: Só fechar drawer quando o Woo terminar de atualizar (updated_checkout)
            // e os totais do DOM baterem com o total esperado. Evita ver "HTML não renderizado" / layout intermediário.
            (function waitWooAndFinalize() {
              var expectedTotalText = String(resp.data.total_text || '');
              var startedAt = Date.now();
              var maxWait = 8000;
              var finalized = false;

              var finalize = function (reason) {
                if (finalized) return;
                finalized = true;
                try { $(document.body).off('updated_checkout.ctwpml_coupon_apply_wait'); } catch (e0) {}
                try { clearInterval(poll); } catch (e1) {}

                // fechar drawer
                ctwpmlToggleCouponDrawer(false);

                // liberar state machine e resetar botão (só após estabilizar)
                setCouponBusy(false);
                $btn.removeClass('is-loading').prop('disabled', false);
                var origText = $btn.data('original-text');
                if (origText) $btn.text(origText);

                if (typeof state.checkpoint === 'function') {
                  state.checkpoint('CHK_COUPON_APPLY_DRAWER_CLOSED', true, { code: couponCode, reason: String(reason || ''), elapsedMs: Date.now() - startedAt });
                }
              };

              var giveUpKeepOpen = function (reason, lastSnap) {
                if (finalized) return;
                finalized = true;
                try { $(document.body).off('updated_checkout.ctwpml_coupon_apply_wait'); } catch (e0) {}
                try { clearInterval(poll); } catch (e1) {}

                // NÃO fechar o drawer no timeout: evita expor UI "meio atualizada"
                // Libera o estado/botão para o usuário tentar novamente, mantendo o drawer aberto.
                setCouponBusy(false);
                $btn.removeClass('is-loading').prop('disabled', false);
                var origText = $btn.data('original-text');
                if (origText) $btn.text(origText);

                if (typeof state.checkpoint === 'function') {
                  state.checkpoint('CHK_COUPON_APPLY_WAIT_TIMEOUT_KEEP_OPEN', false, {
                    code: couponCode,
                    reason: String(reason || ''),
                    expectedTotal: expectedTotalText,
                    last: lastSnap || {},
                    elapsedMs: Date.now() - startedAt,
                  });
                }
                showNotification('O checkout ainda está atualizando. Aguarde mais alguns segundos antes de fechar.', 'info', 3500);
              };

              var checkNow = function (source) {
                try {
                  var w = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
                  var t = w && w.readTotals ? w.readTotals() : {};
                  var cps = [];
                  try { cps = w && w.readCoupons ? (w.readCoupons() || []) : []; } catch (e0) { cps = []; }
                  var couponFound = false;
                  var lc = String(couponCode || '').toLowerCase();
                  if (lc && cps && cps.length) {
                    couponFound = cps.some(function (c) { return String((c && c.code) || '').toLowerCase() === lc; });
                  }
                  var matches = ctwpmlTotalsRoughlyMatch(t.totalText || '', expectedTotalText);
                  // Debug de visibilidade: só em updated_checkout/poll para não gerar spam
                  if (typeof state.checkpoint === 'function' && (source === 'updated_checkout' || source === 'poll')) {
                    state.checkpoint('CHK_COUPON_APPLY_WAIT_SNAPSHOT', true, {
                      source: String(source || ''),
                      expectedTotal: expectedTotalText,
                      wooTotal: String(t.totalText || ''),
                      matches: !!matches,
                      couponFound: !!couponFound,
                      wooCoupons: cps && cps.length ? cps.map(function (c) { return String((c && c.code) || ''); }) : [],
                      elapsedMs: Date.now() - startedAt,
                    });
                  }
                  if (matches) {
                    if (typeof state.checkpoint === 'function') {
                      state.checkpoint('CHK_COUPON_APPLY_WOO_TOTAL_MATCH', true, { source: String(source || ''), expected: expectedTotalText, wooTotal: String(t.totalText || '') });
                    }
                    finalize('woo_total_match:' + String(source || ''));
                    return true;
                  }
                  // Fallback: se o cupom já apareceu no DOM do Woo, considera aplicado e fecha
                  // (evita depender exclusivamente do total, que pode variar por texto/ruído)
                  if (couponFound) {
                    if (typeof state.checkpoint === 'function') {
                      state.checkpoint('CHK_COUPON_APPLY_WOO_COUPON_FOUND', true, { source: String(source || ''), code: couponCode, wooTotal: String(t.totalText || ''), expectedTotal: expectedTotalText });
                    }
                    finalize('woo_coupon_found:' + String(source || ''));
                    return true;
                  }
                } catch (e2) {}
                return false;
              };

              // 1) escutar eventos do Woo
              $(document.body).on('updated_checkout.ctwpml_coupon_apply_wait', function () {
                if (finalized) return;
                if (checkNow('updated_checkout')) return;
                if (Date.now() - startedAt > maxWait) {
                  // Capturar último snapshot antes de desistir
                  var w = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
                  var t = w && w.readTotals ? w.readTotals() : {};
                  var cps = [];
                  try { cps = w && w.readCoupons ? (w.readCoupons() || []) : []; } catch (e0) { cps = []; }
                  giveUpKeepOpen('timeout_updated_checkout', { wooTotal: String(t.totalText || ''), wooCoupons: cps.map(function (c) { return String((c && c.code) || ''); }) });
                }
              });

              // 2) fallback: polling curto (caso updated_checkout não dispare)
              var poll = setInterval(function () {
                if (finalized) return;
                if (checkNow('poll')) return;
                if (Date.now() - startedAt > maxWait) {
                  var w = window.CCCheckoutTabs && window.CCCheckoutTabs.WooHost ? window.CCCheckoutTabs.WooHost : null;
                  var t = w && w.readTotals ? w.readTotals() : {};
                  var cps = [];
                  try { cps = w && w.readCoupons ? (w.readCoupons() || []) : []; } catch (e0) { cps = []; }
                  giveUpKeepOpen('timeout_poll', { wooTotal: String(t.totalText || ''), wooCoupons: cps.map(function (c) { return String((c && c.code) || ''); }) });
                }
              }, 200);

              // 3) check imediato (às vezes já está pronto)
              checkNow('immediate');
            })();

            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_SHOW_SUCCESS_DONE', true, { code: couponCode });
            }

            // Disparar evento para que o Woo atualize (fragments)
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_TRIGGER_WOO_EVENTS', true, { code: couponCode, couponBusy: isCouponBusy() });
            }
            $(document.body).trigger('update_checkout');
            $(document.body).trigger('applied_coupon', [couponCode]);

          } else {
            // Erro
            var errorMsg = (resp && resp.data && resp.data.message) ? resp.data.message : 'Cupom inválido.';
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_APPLY_AJAX_FAIL', false, { code: couponCode, error: errorMsg });
            }
            showNotification(errorMsg, 'error', 4000);
            $('#ctwpml-coupon-input').addClass('is-error');
          }

          // v4.4: No sucesso, finalize() controla o reset/close após estabilizar.
          // No erro, liberamos imediatamente.
          if (!(resp && resp.success && resp.data)) {
            setCouponBusy(false);
            $btn.removeClass('is-loading').prop('disabled', false);
            var origText = $btn.data('original-text');
            if (origText) $btn.text(origText);
          }
        },
        error: function (xhr, status, error) {
          log('Erro AJAX apply_coupon:', { status: status, error: error });
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_COUPON_APPLY_AJAX_ERROR', false, { status: status, error: error });
          }
          showNotification('Erro ao aplicar cupom. Tente novamente.', 'error', 4000);

          // v4.2: Liberar state machine de cupom
          setCouponBusy(false);

          $btn.removeClass('is-loading').prop('disabled', false);
          var origText = $btn.data('original-text');
          if (origText) $btn.text(origText);
        },
      });
    });

    /**
     * Atualiza a lista de cupons na UI a partir da resposta AJAX
     * @param {Array} coupons - Lista de cupons [{code, amount_text}]
     * @param {string} context - 'payment' ou 'review'
     */
    function ctwpmlUpdateCouponsFromAjax(coupons, context) {
      var targetId = context === 'review' ? 'ctwpml-review-coupons' : 'ctwpml-payment-coupons';
      var $block = $('#' + targetId);
      if (!$block.length) return;

      if (!coupons || coupons.length === 0) {
        $block.hide().empty();
        return;
      }

      // v4.6: Usa layout unificado (ícone → nome → remover; valor à direita)
      var pluginUrl = (window.cc_params && window.cc_params.plugin_url ? window.cc_params.plugin_url : '');
      var removeIconUrl = pluginUrl + 'assets/img/icones/remover-cupom.svg';
      var couponIconUrl = pluginUrl + 'assets/img/icones/coupom-icon.svg';
      var title = coupons.length > 1 ? 'Cupons aplicados' : 'Cupom aplicado';
      var html = '<div class="ctwpml-coupons-title">' + title + '</div>';

      coupons.forEach(function (c) {
        var code = String(c.code || '').toUpperCase();
        var amount = String(c.amount_text || '');
        html +=
          '<div class="ctwpml-coupon-row" data-coupon-code="' + code.toLowerCase() + '">' +
          '  <div class="ctwpml-coupon-left">' +
          '    <img src="' + couponIconUrl + '" alt="" class="ctwpml-coupon-icon" width="16" height="16" />' +
          '    <span class="ctwpml-coupon-code">' + code + '</span>' +
          '    <button type="button" class="ctwpml-coupon-remove" data-coupon-code="' + code.toLowerCase() + '" data-ctwpml-context="' + context + '" title="Remover cupom"><img src="' + removeIconUrl + '" alt="Remover" width="18" height="18"></button>' +
          '  </div>' +
          '  <div class="ctwpml-coupon-right">' +
          '    <span class="ctwpml-coupon-amount">' + amount + '</span>' +
          '  </div>' +
          '</div>';
      });

      $block.html(html).show();
    }

    /**
     * Atualiza os totais na UI a partir da resposta AJAX
     * @param {Object} data - Dados {subtotal_text, total_text, shipping_text, discount_text}
     */
    function ctwpmlUpdateTotalsFromAjax(data) {
      if (!data) return;

      // Tela Payment
      if (data.subtotal_text) {
        var $subtotalVal = $('#ctwpml-payment-subtotal-value');
        if ($subtotalVal.length) $subtotalVal.text(data.subtotal_text);
      }
      if (data.total_text) {
        var $totalVal = $('#ctwpml-payment-total-value');
        if ($totalVal.length) $totalVal.text(data.total_text);
      }

      // Tela Review
      if (data.subtotal_text) {
        $('#ctwpml-review-products-subtotal').text(data.subtotal_text);
      }
      if (data.total_text) {
        $('#ctwpml-review-total').text(data.total_text);
        $('#ctwpml-review-payment-amount').text(data.total_text);
        $('#ctwpml-review-sticky-total').text(data.total_text);

        // v4.5: Atualizar valor original na Review (topo + sticky) se tivermos attempt
        var $reviewTotalRow = $('.ctwpml-review-total-row').first();
        var $reviewOriginal = $('#ctwpml-review-original-total');
        var $stickyRow = $('.ctwpml-review-sticky-total-row').first();
        var $stickyOriginal = $('#ctwpml-review-sticky-original-total');
        if (state.__ctwpmlCouponAttempt && state.__ctwpmlCouponAttempt.originalTotal) {
          $reviewOriginal.text(state.__ctwpmlCouponAttempt.originalTotal).show();
          $reviewTotalRow.addClass('has-discount');
          if ($stickyOriginal.length) $stickyOriginal.text(state.__ctwpmlCouponAttempt.originalTotal).show();
          if ($stickyRow.length) $stickyRow.addClass('has-discount');
        }
      }
    }

    // v4.2: toggleCouponDrawer foi movida para ctwpmlToggleCouponDrawer() no escopo do módulo

    // Remover cupom (lista em Payment/Review) - via AJAX controlado (sem reload)
    $(document).on('click', '.ctwpml-coupon-remove', function (e) {
      e.preventDefault();
      try { e.stopPropagation(); } catch (e0) {}

      var code = String($(this).data('coupon-code') || '').trim();
      var context = String($(this).data('ctwpml-context') || '').trim();
      var $btn = $(this);
      var $row = $btn.closest('.ctwpml-coupon-row');
      if (!code) return;

      var log = function (msg, data) {
        if (typeof state.log === 'function') {
          state.log(msg, data || {}, 'PAYMENT');
        } else {
          console.log('[CTWPML][PAYMENT] ' + msg, data || '');
        }
      };

      log('Remover cupom (AJAX):', { code: code, context: context });

      var ajaxUrl = state.params && state.params.ajax_url ? state.params.ajax_url : '';
      var couponNonce = state.params && state.params.coupon_nonce ? state.params.coupon_nonce : '';

      if (!ajaxUrl || !couponNonce) {
        showNotification('Configuração inválida. Recarregue a página.', 'error', 3500);
        return;
      }

      // v4.2: Marcar cupom como "busy" para blindar eventos concorrentes do Woo
      setCouponBusy(true);

      // Mostrar spinner no botão enquanto processa
      try {
        $btn.prop('disabled', true);
        var originalContent = $btn.html();
        $btn.data('original-content', originalContent);
        $btn.html('<span class="ctwpml-coupon-spinner"></span>');
      } catch (e1) {}

      if (typeof state.checkpoint === 'function') {
        try { state.checkpoint('CHK_COUPON_REMOVE_AJAX_SENT', true, { code: code, context: context, busy: true }); } catch (e2) {}
      }

      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        data: {
          action: 'ctwpml_remove_coupon',
          _ajax_nonce: couponNonce,
          coupon_code: code,
        },
        success: function (resp) {
          log('Resposta remove_coupon AJAX:', resp);

          if (resp && resp.success && resp.data) {
            // Sucesso
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_REMOVE_AJAX_OK', true, { code: code, data: resp.data });
            }

            // Limpar estado de desconto
            state.__ctwpmlPaymentDiscount = null;
            state.__ctwpmlCouponAttempt = null;

            // v4.3: Limpar valor original na Review
            var $reviewTotalRow = $('.ctwpml-review-total-row').first();
            var $reviewOriginal = $('#ctwpml-review-original-total');
            $reviewOriginal.text('').hide();
            $reviewTotalRow.removeClass('has-discount');

            // Remover linha da UI com animação
            $row.fadeOut(200, function () {
              $(this).remove();
              // Se não houver mais cupons, esconder o bloco
              var remainingCoupons = resp.data.coupons || [];
              if (remainingCoupons.length === 0) {
                $('#ctwpml-payment-coupons').hide().empty();
                $('#ctwpml-review-coupons').hide().empty();
              }
            });

            // Atualizar totais na UI
            ctwpmlUpdateTotalsFromAjax(resp.data);

            // v4.7: Re-render completo imediato (frete + totais) sem depender de eventos posteriores
            try {
              ctwpmlUpdateTotalsStateFromAjax(resp.data, 'remove_ajax_success');
              ctwpmlRenderTotalsUI('remove_ajax_success');
              ctwpmlResyncReviewShipping('remove_ajax_success', resp.data);
            } catch (eR1) {}

            // v4.2: Liberar state machine de cupom
            setCouponBusy(false);

            // Disparar evento para que o Woo atualize (fragments)
            $(document.body).trigger('update_checkout');
            $(document.body).trigger('removed_coupon', [code]);

          } else {
            // Erro
            var errorMsg = (resp && resp.data && resp.data.message) ? resp.data.message : 'Não foi possível remover o cupom.';
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_COUPON_REMOVE_AJAX_FAIL', false, { code: code, error: errorMsg });
            }
            showNotification(errorMsg, 'error', 3500);

            // v4.2: Liberar state machine de cupom
            setCouponBusy(false);

            // Restaurar botão
            try {
              var orig = $btn.data('original-content');
              if (orig) $btn.html(orig);
              $btn.prop('disabled', false);
            } catch (e3) {}
          }
        },
        error: function (xhr, status, error) {
          log('Erro AJAX remove_coupon:', { status: status, error: error });
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_COUPON_REMOVE_AJAX_ERROR', false, { status: status, error: error });
          }
          showNotification('Erro ao remover cupom. Tente novamente.', 'error', 3500);

          // v4.2: Liberar state machine de cupom
          setCouponBusy(false);

          // Restaurar botão
          try {
            var orig = $btn.data('original-content');
            if (orig) $btn.html(orig);
            $btn.prop('disabled', false);
          } catch (e4) {}
        },
      });
    });

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
      // UX: primeiro vai para lista de endereços cadastrados
      showList();
      renderAddressList();
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
      try { e.stopImmediatePropagation(); } catch (e0) {}

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

      function getBillingEmail() {
        try {
          var localEmail = ($('#ctwpml-input-email').val() || '').trim().toLowerCase();
          if (localEmail) return localEmail;
        } catch (e0) {}
        try {
          var email = ($('#billing_email').val() || '').trim().toLowerCase();
          if (email) return email;
        } catch (e1) {}
        try {
          return (state.params && state.params.user_email) ? String(state.params.user_email).trim().toLowerCase() : '';
        } catch (e2) {}
        return '';
      }

      function isValidEmail(email) {
        try {
          return ctwpmlIsValidEmail(email);
        } catch (e0) {
          return !!(email && email.indexOf('@') > 0 && email.indexOf('.') > 0);
        }
      }

      function persistContactMetaBeforeCheckout(done) {
        try { showModalSpinner(); } catch (e0) {}
        saveContactMeta({ silent: true, spinnerManagedByCaller: true }, function (response) {
          try { hideModalSpinner(); } catch (e1) {}
          if (!response || !response.success) {
            showNotification('Não foi possível salvar seus dados. Tente novamente.', 'error', 4000);
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_CONTACT_META_PERSIST_BEFORE_ORDER', false, {});
            }
            if (typeof done === 'function') done(false);
            return;
          }
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_CONTACT_META_PERSIST_BEFORE_ORDER', true, {});
          }
          if (typeof done === 'function') done(true);
        });
      }

      if (!isLoggedIn()) {
        var emailToConfirm = getBillingEmail();
        if (!isValidEmail(emailToConfirm)) {
          showNotification('Informe um e-mail válido para continuar.', 'error', 4000);
          var $emailBox0 = $('#ctwpml-review-errors');
          if ($emailBox0.length) {
            $emailBox0.text('Informe um e-mail válido para continuar.').show();
          }
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_EMAIL_REQUIRED_BLOCK', false, { reason: 'invalid_or_empty' });
          }
          return;
        }
        try {
          var $billingEmailSync = ctwpmlBillingField$('#billing_email', 'billing_email');
          if ($billingEmailSync.length) ctwpmlSetFieldValue($billingEmailSync, emailToConfirm);
        } catch (eSync0) {}
        if (!state.skipAuthCheckOnce) {
          var emailToCheck = emailToConfirm;
          if (!state.params || !state.params.ajax_url || !state.params.check_email_nonce) {
            showNotification('Não foi possível validar o e-mail. Recarregue a página.', 'error', 4000);
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_EMAIL_REQUIRED_BLOCK', false, { reason: 'missing_nonce' });
            }
            return;
          }

          var $ctaAuth = $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky');
          $ctaAuth.prop('disabled', true).css('opacity', '0.7');
          showModalSpinner();
          $.ajax({
            url: state.params.ajax_url,
            type: 'POST',
            dataType: 'json',
            data: {
              action: 'ctwpml_check_email',
              _ajax_nonce: state.params.check_email_nonce,
              email: emailToCheck,
            },
            success: function (resp) {
              hideModalSpinner();
              $ctaAuth.prop('disabled', false).css('opacity', '');
              if (resp && resp.success && resp.data && resp.data.exists) {
                try {
                  var termsChecked = $('.ctwpml-review-terms-checkbox').first().is(':checked');
                  var addressSnapshot = null;
                  try {
                    if (selectedAddressId) addressSnapshot = getAddressById(selectedAddressId) || null;
                  } catch (eA0) {}
                  saveAuthResumeSnapshot({
                    view: currentView || 'review',
                    selectedAddressId: selectedAddressId || '',
                    selectedShipping: state.selectedShipping || null,
                    selectedPaymentMethod: state.selectedPaymentMethod || '',
                    termsChecked: !!termsChecked,
                    autoSubmit: !!termsChecked,
                    addressSnapshot: addressSnapshot,
                    resumeAfterAuth: true,
                  });
                  if (typeof state.checkpoint === 'function') {
                    state.checkpoint('CHK_AUTH_RESUME_SNAPSHOT', true, { view: currentView || 'review', termsChecked: !!termsChecked });
                  }
                } catch (eSnap) {
                  if (typeof state.checkpoint === 'function') {
                    state.checkpoint('CHK_AUTH_RESUME_SNAPSHOT', false, { error: String(eSnap || '') });
                  }
                }
                showAuthView({ preserveView: true, returnView: 'review' });
                return;
              }
              state.skipAuthCheckOnce = true;
              setTimeout(function () {
                $ctaAuth.first().trigger('click');
              }, 50);
            },
            error: function () {
              hideModalSpinner();
              $ctaAuth.prop('disabled', false).css('opacity', '');
              showNotification('Não foi possível validar o e-mail. Tente novamente.', 'error', 4000);
            },
          });
          return;
        }
        state.skipAuthCheckOnce = false;
        persistContactMetaBeforeCheckout(function (ok) {
          if (!ok) return;
          proceedToCheckoutSubmit();
        });
        return;
      }

      proceedToCheckoutSubmit();

      function proceedToCheckoutSubmit() {
      // v2.0 [2.2]: overlay de preparação ao tentar finalizar compra (intenção de compra).
      // Importante: só mostra após validar termos + gateway para não “piscar” com erro imediato.
      var prep = window.CTWPMLPrepare || null;
      // Garantir que o overlay NÃO apareça ao confirmar compra (cinto de segurança).
      try {
        if (prep && typeof prep.hidePreparingOverlay === 'function') {
          prep.hidePreparingOverlay();
        }
      } catch (eP0) {}
      if (typeof state.checkpoint === 'function') {
        try { state.checkpoint('CHK_PREPARE_OVERLAY_FORCE_HIDE_ON_CONFIRM', true, {}); } catch (eC) {}
      }
      log('CTA click: iniciando finalização', { overlayShown: false, gateway: woo.getSelectedGatewayId ? woo.getSelectedGatewayId() : '' });

      // Hardening: evita checkout_error por "Bairro obrigatório" quando o Woo/tema limpa ou valida em outro campo.
      // Regra: tenta preencher automaticamente; se ainda estiver vazio, bloqueia o submit com mensagem clara.
      try {
        if (!ctwpmlHasNeighborhoodValue()) {
          var cand = '';
          try {
            // Preferir endereço selecionado (se houver) para obter bairro; fallback resolve via lastCepLookup/freteData/campos Woo.
            cand = ctwpmlResolveNeighborhoodCandidate(typeof selectedAddressId !== 'undefined' && selectedAddressId ? getAddressById(selectedAddressId) : null);
          } catch (eN0) {
            cand = ctwpmlResolveNeighborhoodCandidate(null);
          }
          if (cand) ctwpmlSetNeighborhoodInWoo(cand);
        }
        if (!ctwpmlHasNeighborhoodValue()) {
          showNotification('Campo \"Bairro\" é obrigatório. Verifique o endereço e tente novamente.', 'error', 5000);
          if (typeof state.checkpoint === 'function') {
            var diag = {
              context: 'pre_submit_block',
              selectedAddressId: (typeof selectedAddressId !== 'undefined' ? String(selectedAddressId || '') : ''),
              candidate: cand || '',
              snapshot: ctwpmlGetWooNeighborhoodSnapshot(),
            };
            try {
              if (typeof lastCepLookup !== 'undefined' && lastCepLookup) diag.lastCepLookup = { bairro: lastCepLookup.bairro || '', neighborhood: lastCepLookup.neighborhood || '' };
            } catch (eD0) {}
            try {
              if (window && window.freteData) diag.freteData = { bairro: window.freteData.bairro || '', neighborhood: window.freteData.neighborhood || '' };
            } catch (eD1) {}
            state.checkpoint('CHK_BILLING_NEIGHBORHOOD_REQUIRED_BLOCK', false, diag);
          }
          return;
        }
      } catch (eN1) {}

      // Evita duplo clique.
      try {
        if (window.CTWPMLCtaAnim && typeof window.CTWPMLCtaAnim.start === 'function') {
          window.CTWPMLCtaAnim.start($('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky'));
        }
      } catch (eA0) {}
      $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky').prop('disabled', true).css('opacity', '0.7');

      // Se o Woo emitir erro, reabilita CTA e loga.
      $(document.body).one('checkout_error', function () {
        try {
          $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky').prop('disabled', false).css('opacity', '');
          // Hide overlay se estiver visível
          try {
            if (prep && typeof prep.hidePreparingOverlay === 'function') prep.hidePreparingOverlay();
          } catch (eP1) {}
          var $err = $('.woocommerce-error, .woocommerce-NoticeGroup-checkout').first();
          var errText = $err.length ? $err.text().trim() : '';
          log('checkout_error recebido', { text: errText });
          if (typeof state.checkpoint === 'function') {
            var errDiag = {
              text: errText,
              hasWooError: document.querySelectorAll('.woocommerce-error').length,
              hasNoticeGroup: document.querySelectorAll('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout').length,
            };
            try { errDiag.neighborhood = ctwpmlGetWooNeighborhoodSnapshot(); } catch (eN0) {}
            state.checkpoint('CHK_CHECKOUT_ERROR', true, errDiag);
          }

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
          try {
            loadContactMeta(function (meta) {
              var email = meta && meta.email ? String(meta.email).trim() : '';
              if (typeof state.checkpoint === 'function') {
                state.checkpoint('CHK_CONTACT_RESTORE_AFTER_ERROR', true, { hasEmail: !!email });
              }
            });
          } catch (eR0) {
            if (typeof state.checkpoint === 'function') {
              state.checkpoint('CHK_CONTACT_RESTORE_AFTER_ERROR', false, { error: String(eR0) });
            }
          }
        } catch (_) {}
      });

      // (Opcional) garante update_checkout antes do submit.
      try { $(document.body).trigger('update_checkout'); } catch (e2) {}

      // Watchdog: se nada acontecer (sem redirect/sem erro) por muito tempo, liberar para retry.
      try {
        setTimeout(function () {
          try {
            // Se ainda está na mesma página e CTA continua desabilitado, liberar.
            var $cta = $('#ctwpml-review-confirm, #ctwpml-review-confirm-sticky');
            if ($cta.length && $cta.is(':disabled')) {
              $cta.prop('disabled', false).css('opacity', '');
              if (prep && typeof prep.hidePreparingOverlay === 'function') prep.hidePreparingOverlay();
              log('Watchdog: liberando CTA após timeout', { ms: 25000 });
              if (typeof state.checkpoint === 'function') state.checkpoint('CHK_CTA_WATCHDOG_RELEASE', true, { ms: 25000 });
            }
          } catch (eW) {}
        }, 25000);
      } catch (eW0) {}

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
      }
    });

    // Checkout Woo: sucesso (AJAX) -> limpar estado do modal e evitar restore em nova compra
    $(document.body).on('checkout_place_order_success', function (e, data) {
      try {
        var payload = data || {};
        var result = payload && payload.result ? String(payload.result) : '';
        markOrderCompleted({
          source: 'checkout_place_order_success',
          result: result,
          redirect: payload && payload.redirect ? String(payload.redirect) : '',
        });
      } catch (e0) {}
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
    $(document).on('input change', '#ctwpml-view-form input, #ctwpml-view-form textarea', function (e) {
      $(this).closest('.ctwpml-form-group').removeClass('is-error');
      if ($(this).is('#ctwpml-input-rua')) setRuaHint('', false);

      // Dirty state (somente em interações do usuário; eventos programáticos não contam).
      try {
        if (currentView === 'form' && !formDirty && e && e.originalEvent) {
          formDirty = true;
          if (state && typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_FORM_DIRTY_ON', true, { fieldId: String(this && this.id ? this.id : '') });
          }
        }
      } catch (e0) {}
    });

    $(document).on('input change', '#ctwpml-input-email, #billing_email', function () {
      try {
        var current = (($(this).val() || '') + '').trim().toLowerCase();
        if (state.confirmedEmailValue && current !== state.confirmedEmailValue) {
          state.confirmedEmailValue = '';
          if (typeof state.checkpoint === 'function') {
            state.checkpoint('CHK_EMAIL_CONFIRM_RESET', true, { reason: 'email_changed' });
          }
        }
      } catch (e0) {}
    });

    // v2.0 [2.1]: Auto-scroll ao focar campos perto do footer fixo (evita sobreposição/teclado).
    // Delegado para funcionar após re-render de views.
    function ctwpmlAutoScrollInModal(targetEl, reason, topOffsetPx) {
      try {
        var $body = $('.ctwpml-modal-body').first();
        if (!$body.length) return;
        var bodyEl = $body[0];
        if (!bodyEl || !targetEl || !targetEl.getBoundingClientRect) return;

        var footerH = 0;
        try {
          var $footer = $('.ctwpml-footer:visible').first();
          footerH = $footer.length ? ($footer.outerHeight() || 0) : 0;
        } catch (e0) {}
        if (!footerH) footerH = 180;

        var bodyRect = bodyEl.getBoundingClientRect();
        var tRect = targetEl.getBoundingClientRect();

        var vv = window.visualViewport;
        var viewportTop = vv ? (vv.offsetTop || 0) : 0;
        var viewportH = vv ? (vv.height || window.innerHeight) : window.innerHeight;
        var viewportBottom = vv ? ((vv.offsetTop || 0) + viewportH) : window.innerHeight;

        var padding = 16;
        // v3.2.52 (UX): auto-scroll por proporção
        // Objetivo: deixar ~80% de espaço abaixo do campo (campo perto de ~20% do topo do viewport).
        // Mantemos compat com topOffsetPx (assinatura antiga), mas a regra principal é proporcional.
        var desiredTop = viewportTop + Math.round(viewportH * 0.2);
        var minTop = Math.max(bodyRect.top, viewportTop) + 12;
        var maxTop = Math.min(bodyRect.bottom, viewportBottom) - footerH - padding - 40;
        if (maxTop < minTop) maxTop = minTop + 10;
        if (desiredTop < minTop) desiredTop = minTop;
        if (desiredTop > maxTop) desiredTop = maxTop;
        var visibleTop = desiredTop;
        var visibleBottom = Math.min(bodyRect.bottom, viewportBottom) - footerH - padding;
        if (visibleBottom < visibleTop) visibleBottom = visibleTop + 10;

        var shouldScroll = false;
        var nextTop = bodyEl.scrollTop;
        var delta = 0;

        // Para foco: só ajusta se sair da janela visível (evita “pulos” desnecessários).
        // Para cliques no DDI/wrap: preferimos alinhar o input no topo desejado para sobrar espaço para o dropdown abrir para baixo.
        var forceAlign = String(reason || '').indexOf('ddi') >= 0;
        if (forceAlign) {
          delta = (tRect.top - visibleTop);
          if (Math.abs(delta) > 10) {
            nextTop = Math.max(0, bodyEl.scrollTop + delta);
            shouldScroll = true;
          }
        } else {
          if (tRect.top < visibleTop) {
            delta = (tRect.top - visibleTop) - 12;
            nextTop = Math.max(0, bodyEl.scrollTop + delta);
            shouldScroll = true;
          } else if (tRect.bottom > visibleBottom) {
            // Em vez de “empurrar” só até caber, alinhamos o topo no ponto desejado (20%).
            delta = (tRect.top - visibleTop);
            nextTop = Math.max(0, bodyEl.scrollTop + delta);
            shouldScroll = true;
          }
        }

        if (!shouldScroll) return;

        try {
          $body.stop(true).animate({ scrollTop: nextTop }, 220);
        } catch (e1) {
          bodyEl.scrollTop = nextTop;
        }

        if (state && typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_SCROLL_FOCUS_MOBILE', true, {
            reason: String(reason || ''),
            fieldId: String(targetEl.id || ''),
            footerH: footerH,
            delta: delta,
            nextTop: nextTop,
            desiredTop: visibleTop,
            vvHeight: vv ? vv.height : null,
          });
        }
        if (typeof state.log === 'function') {
          state.log('UI        v2.0 [2.1] Auto-scroll no foco (mobile)', {
            reason: String(reason || ''),
            fieldId: String(targetEl.id || ''),
            footerH: footerH,
            delta: delta,
            scrollTop: bodyEl.scrollTop,
            nextTop: nextTop,
            desiredTop: visibleTop,
            vvHeight: vv ? vv.height : null,
          }, 'UI');
        }
      } catch (e2) {}
    }

    $(document).on('focus', '#ctwpml-view-form input, #ctwpml-view-form textarea', function () {
      // 1ª passada: imediata (antes do teclado terminar animação)
      ctwpmlAutoScrollInModal(this, 'focus_immediate');
      // 2ª passada: após o teclado abrir (principalmente mobile)
      try {
        var el = this;
        setTimeout(function () {
          ctwpmlAutoScrollInModal(el, 'focus_delayed');
        }, 260);
      } catch (e3) {}
    });

    // Auto-scroll também ao tocar no seletor de DDI (TomSelect) - faz parte do mesmo campo.
    $(document).on('click', '.ctwpml-phone-wrap, .ctwpml-phone-wrap .ts-control, .ctwpml-phone-wrap .ts-wrapper', function (e) {
      try {
        // Evitar disparar em cliques fora da tela do form.
        if (!$('#ctwpml-view-form').is(':visible')) return;
        var inputEl = document.getElementById('ctwpml-input-fone');
        if (!inputEl) return;
        ctwpmlAutoScrollInModal(inputEl, 'ddi_click');
        // Segunda passada para acompanhar animação do teclado.
        setTimeout(function () {
          ctwpmlAutoScrollInModal(inputEl, 'ddi_click_delayed');
        }, 260);
      } catch (e0) {}
    });

    // Se o usuário alterar o CEP direto no checkout (fora do modal), limpamos os campos também.
    $(document).on('input change', '#billing_postcode', function () {
      onBillingCepChanged();
    });

    // Máscara/regex do celular no modal
    $(document).on('input', '#ctwpml-input-fone', function () {
      var $input = $('#ctwpml-input-fone');

      // v2.0 [2.3] (novo formato): IMask controla o input; aqui só mantemos sincronização defensiva
      try {
        var phoneFull = ($('#ctwpml-phone-full').val() || '').toString();
        var digits = phoneFull ? phoneFull.replace(/\D/g, '') : phoneDigits($input.val());
        if (digits) $('#billing_cellphone').val(digits).trigger('change');
        return;
      } catch (e0) {}

      // Fallback (se widget não estiver ativo)
      var formatted = formatPhone($input.val());
      if ($input.val() !== formatted) $input.val(formatted);
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

    function resumeAfterAuthIfNeeded() {
      try {
        var snapshot = readAuthResumeSnapshot();
        if (!snapshot) return false;
        if (!isLoggedIn()) return false;
        snapshot.open = true;
        snapshot.view = (snapshot.view || 'review');
        snapshot.resumeAfterAuth = true;
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_AUTH_RESUME_READY', true, { view: snapshot.view, autoSubmit: !!snapshot.autoSubmit });
        }
        openModal({ skipLoadAddresses: true, resumeSnapshot: snapshot });
        return true;
      } catch (e0) {
        if (typeof state.checkpoint === 'function') {
          state.checkpoint('CHK_AUTH_RESUME_READY', false, { error: String(e0 || '') });
        }
        return false;
      }
    }

    // NOVO: iniciar fluxo automaticamente ao entrar no /checkout.
    // - logado: abre modal ML
    // - deslogado: abre view auth dentro do modal ML (sem Fancybox)
    setTimeout(function () {
      console.log('[CTWPML][DEBUG] setTimeout 800ms - auto abertura do modal');
      console.log('[CTWPML][DEBUG] setTimeout - isLoggedIn:', isLoggedIn());
      try {
        if (resumeAfterAuthIfNeeded()) return;
        console.log('[CTWPML][DEBUG] setTimeout - chamando openModal() (auth dentro do modal)');
        openModal();
      } catch (e) {
        console.log('[CTWPML][DEBUG] setTimeout - ERRO:', e);
      }
    }, 800);

    console.log('[CTWPML][DEBUG] setupAddressModal() - FINALIZADO');
  };
})(window);


