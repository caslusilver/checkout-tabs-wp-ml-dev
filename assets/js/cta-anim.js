(function (window) {
  'use strict';

  var $ = window.jQuery;
  if (!$) return;

  function getState() {
    // Exposto em assets/js/checkout-tabs.js quando debug está ativo.
    return window.CCCheckoutTabsState || null;
  }

  function debugEnabled() {
    try {
      var s = getState();
      if (s && s.params && (s.params.debug === 1 || s.params.debug === '1' || s.params.debug === true)) return true;
      if (window.cc_params && (window.cc_params.debug === 1 || window.cc_params.debug === '1' || window.cc_params.debug === true)) return true;
    } catch (e) {}
    return false;
  }

  function log(msg, data) {
    try {
      var s = getState();
      if (s && typeof s.log === 'function') {
        s.log(msg, data || {}, 'CTA');
        return;
      }
    } catch (e) {}
    if (debugEnabled()) {
      try {
        console.log('[CTWPML] CTA        ' + msg);
        if (data) console.log(data);
      } catch (e2) {}
    }
  }

  function checkpoint(name, ok, data) {
    try {
      var s = getState();
      if (s && typeof s.checkpoint === 'function') {
        s.checkpoint(name, !!ok, data || {});
        return;
      }
    } catch (e) {}
    // fallback: sem checkpoint fora do debug panel
    if (debugEnabled()) {
      try {
        console.log('[CTWPML] CHECK      ' + (ok ? '✓ OK ' : '✗ FAIL ') + name, data || {});
      } catch (e2) {}
    }
  }

  // Flag de segurança (default ligado se não estiver definido).
  var enabled = true;
  try {
    if (window.cc_params && typeof window.cc_params.cta_anim !== 'undefined') {
      enabled = !!(window.cc_params.cta_anim === 1 || window.cc_params.cta_anim === '1' || window.cc_params.cta_anim === true);
    }
  } catch (e) {}
  if (!enabled) return;

  var SELECTOR = '#ctwpml-review-confirm, #ctwpml-review-confirm-sticky';
  var CLS_LOADING = 'ctwpml-cta-loading';
  var CLS_SUCCESS = 'ctwpml-cta-success';
  var CLS_EXPAND = 'ctwpml-cta-expand';
  var OVERLAY_ID = 'ctwpml-success-overlay';
  var OVERLAY_VISIBLE = 'ctwpml-success-overlay--visible';

  var anim = {
    active: false,
    t1: null,
    t2: null,
    t3: null,
    clickAt: 0,
    checkoutStartedAt: 0,
    checkoutXhrStartAt: 0,
    checkoutXhrEndAt: 0,
    fallbackOverlayTimer: null,
  };

  function clearTimers() {
    if (anim.t1) clearTimeout(anim.t1);
    if (anim.t2) clearTimeout(anim.t2);
    if (anim.t3) clearTimeout(anim.t3);
    anim.t1 = anim.t2 = anim.t3 = null;
    if (anim.fallbackOverlayTimer) clearTimeout(anim.fallbackOverlayTimer);
    anim.fallbackOverlayTimer = null;
  }

  function resetCtas() {
    clearTimers();
    anim.active = false;
    anim.clickAt = 0;
    anim.checkoutStartedAt = 0;
    anim.checkoutXhrStartAt = 0;
    anim.checkoutXhrEndAt = 0;
    $(SELECTOR).removeClass(CLS_LOADING + ' ' + CLS_SUCCESS + ' ' + CLS_EXPAND);
    hideOverlay();
  }

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    $('body').append(
      '' +
        '<div id="' + OVERLAY_ID + '" aria-hidden="true">' +
        '  <div class="ctwpml-success-message">' +
        '    <h1>Pedido Confirmado!</h1>' +
        '    <p>Você será redirecionado para efetuar o pagamento...</p>' +
        '  </div>' +
        '</div>'
    );
  }

  function showOverlay(source) {
    ensureOverlay();
    var $ov = $('#' + OVERLAY_ID);
    $ov.addClass(OVERLAY_VISIBLE);
    checkpoint('CHK_CTA_SUCCESS_OVERLAY_VISIBLE', true, { source: source || 'unknown' });
  }

  function hideOverlay() {
    var $ov = $('#' + OVERLAY_ID);
    if (!$ov.length) return;
    $ov.removeClass(OVERLAY_VISIBLE);
  }

  function startAnimation() {
    if (anim.active) return;
    anim.active = true;
    anim.clickAt = Date.now();
    checkpoint('CHK_CTA_CLICK', true, { at: anim.clickAt });

    // Animar os dois botões (normal + sticky) para manter consistência visual.
    var $btns = $(SELECTOR);
    $btns.addClass(CLS_LOADING);
    checkpoint('CHK_CTA_LOADING_STARTED', true, {});

    // Se o checkout AJAX demorar para começar, mostra o overlay mesmo assim (UX).
    anim.fallbackOverlayTimer = setTimeout(function () {
      if (!anim.checkoutStartedAt) {
        showOverlay('fallback_500ms');
        log('Overlay de sucesso exibido por fallback (checkout ainda não iniciou)', { sinceClickMs: Date.now() - anim.clickAt });
      }
    }, 500);

    // Não travar o fluxo: sucesso visual rápido (sem delay artificial de 2s).
    anim.t1 = setTimeout(function () {
      $btns.removeClass(CLS_LOADING).addClass(CLS_SUCCESS);
      checkpoint('CHK_CTA_SUCCESS_STATE', true, { afterClickMs: Date.now() - anim.clickAt });
    }, 150);
  }

  // Clique no CTA do review (delegado, pois o HTML é re-renderizado).
  $(document).on('click', SELECTOR, function () {
    try {
      var $btn = $(this);
      if ($btn.is(':disabled')) return;
      if ($btn.hasClass(CLS_LOADING) || $btn.hasClass(CLS_SUCCESS)) return;
      startAnimation();
    } catch (e) {}
  });

  // Se Woo detectar erro (ex.: pagamento/termos), resetar para não “travar” no loading.
  $(document.body).on('checkout_error', function () {
    checkpoint('CHK_CTA_CHECKOUT_ERROR_EVENT', true, {});
    resetCtas();
  });

  // Se o usuário voltar e re-renderizar a tela, garantir que o estado visual não fique preso.
  $(document.body).on('ctwpml_woo_updated', function () {
    // Se houve update_checkout por qualquer motivo, não force reset.
    // Só reseta se ainda estiver em loading (evita ficar com overlay eterno).
    if ($(SELECTOR).hasClass(CLS_LOADING)) resetCtas();
  });

  // =========================================================
  // DEBUG de performance: medir tempo até o checkout (wc-ajax=checkout)
  // =========================================================
  function isCheckoutAjaxUrl(url) {
    url = String(url || '');
    return url.indexOf('wc-ajax=checkout') !== -1 || url.indexOf('wc-ajax=checkout&') !== -1;
  }

  // Captura início do request de checkout
  $(document).ajaxSend(function (_evt, jqXHR, settings) {
    try {
      var url = settings && settings.url ? String(settings.url) : '';
      if (!isCheckoutAjaxUrl(url)) return;
      anim.checkoutStartedAt = Date.now();
      anim.checkoutXhrStartAt = Date.now();
      checkpoint('CHK_CTA_WC_CHECKOUT_AJAX_SEND', true, {
        afterClickMs: anim.clickAt ? (anim.checkoutStartedAt - anim.clickAt) : null,
        url: url,
      });
      log('wc-ajax=checkout iniciado', {
        afterClickMs: anim.clickAt ? (anim.checkoutStartedAt - anim.clickAt) : null,
        url: url,
      });
      showOverlay('wc_ajax_checkout_send');
    } catch (e) {}
  });

  // Captura término do request de checkout + resposta (result/redirect)
  $(document).ajaxComplete(function (_evt, jqXHR, settings) {
    try {
      var url = settings && settings.url ? String(settings.url) : '';
      if (!isCheckoutAjaxUrl(url)) return;
      anim.checkoutXhrEndAt = Date.now();
      var durMs = anim.checkoutXhrStartAt ? (anim.checkoutXhrEndAt - anim.checkoutXhrStartAt) : null;
      var status = jqXHR ? jqXHR.status : null;
      var respText = jqXHR ? (jqXHR.responseText || '') : '';
      var parsed = null;
      try { parsed = respText ? JSON.parse(respText) : null; } catch (e0) {}

      var summary = {
        status: status,
        durationMs: durMs,
        result: parsed && parsed.result ? parsed.result : null,
        redirect: parsed && parsed.redirect ? parsed.redirect : null,
        hasMessages: parsed && parsed.messages ? true : false,
      };

      checkpoint('CHK_CTA_WC_CHECKOUT_AJAX_COMPLETE', status >= 200 && status < 500, summary);
      log('wc-ajax=checkout finalizado', summary);

      // Se o Woo respondeu com failure, não mantém a tela verde.
      if (parsed && parsed.result && String(parsed.result).toLowerCase() === 'failure') {
        hideOverlay();
        // Não resetamos tudo aqui porque o handler do modal já lida com checkout_error,
        // mas se não vier checkout_error, garantimos que o overlay não fique preso.
        resetCtas();
      }
    } catch (e) {}
  });
})(window);

