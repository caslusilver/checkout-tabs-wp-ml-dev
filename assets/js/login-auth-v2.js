(function (window) {
  'use strict';

  // Definido antes de api.js (inclusive quando Google carrega antes do DOM ready).
  window.ctwpmlRecaptchaOnload = function () {
    if (window.ctwpmlRenderRecaptchaIfNeeded) window.ctwpmlRenderRecaptchaIfNeeded();
  };

  function setMsg($el, text, isError) {
    $el.text(String(text || ''));
    $el.css('display', text ? 'block' : 'none');
    $el.css('color', isError ? '#b42318' : '#067647');
  }

  function logCtwpml(message, data) {
    try {
      var st = window.CCCheckoutTabsState;
      if (st && typeof st.log === 'function') {
        st.log(String(message || ''), data || {}, 'UI');
        return;
      }
    } catch (e) { }
    try {
      if (data) console.log('[CTWPML]', message, data);
      else console.log('[CTWPML]', message);
    } catch (e) { }
  }

  jQuery(function ($) {
    $(document).on('click', '.ctwpml-password-toggle', function () {
      var button = this;
      var input = document.getElementById(button.getAttribute('aria-controls'));
      if (!input) return;

      var showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-pressed', showPassword ? 'true' : 'false');
      button.setAttribute('aria-label', showPassword ? 'Ocultar senha' : 'Mostrar senha');
      button.setAttribute('title', showPassword ? 'Ocultar senha' : 'Mostrar senha');
      input.focus();
    });

    if (!$('#ctwpml-auth-template').length && !$('#ctwpml-view-auth').length) return;

    function getParams() {
      return window.cc_params || {};
    }

    function getSiteKey() {
      var $container = $('#g-recaptcha');
      var siteKey = (window.cc_params && window.cc_params.recaptcha_site_key) ? String(window.cc_params.recaptcha_site_key) : '';
      if (!siteKey) {
        try { siteKey = String($container.attr('data-sitekey') || ''); } catch (e) { }
      }
      return siteKey;
    }

    function highlightRecaptchaError() {
      var $container = $('#ctwpml-recaptcha-container');
      var $widget = $('#g-recaptcha');
      if ($container.length) {
        $container.addClass('ctwpml-recaptcha-error');
        $container.css({
          'border': '2px solid #dc2626',
          'border-radius': '4px',
          'padding': '4px',
          'background-color': 'rgba(220, 38, 38, 0.05)'
        });
      }
      if ($widget.length) {
        $widget.css({
          'outline': '2px solid #dc2626',
          'outline-offset': '2px'
        });
      }
      setTimeout(function () {
        if ($container.length) {
          $container.removeClass('ctwpml-recaptcha-error');
          $container.css({
            'border': '',
            'border-radius': '',
            'padding': '',
            'background-color': ''
          });
        }
        if ($widget.length) {
          $widget.css({
            'outline': '',
            'outline-offset': ''
          });
        }
      }, 3500);
    }

    var authInFlight = false, captchaValid = false;
    function recaptchaEnabled() { return Number(getParams().recaptcha_enabled) !== 0; }
    function captchaResponse() {
      if (!recaptchaEnabled() || !captchaValid) return '';
      try { return typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaId === 'number' ? grecaptcha.getResponse(window.__ctwpmlRecaptchaId) || '' : ''; }
      catch (e) { return ''; }
    }
    function syncAuthButton() {
      var disabled = authInFlight || (recaptchaEnabled() && !captchaResponse());
      $('#ctwpml-auth-submit').prop('disabled', disabled).css('opacity', disabled ? '0.6' : '1');
    }
    window.ctwpmlAuthEnable = function () { captchaValid = true; syncAuthButton(); };
    window.ctwpmlAuthDisable = function () {
      captchaValid = false;
      syncAuthButton();
      if (recaptchaEnabled()) setMsg($('#ctwpml-auth-msg'), 'A verificação expirou. Confirme novamente para continuar.', true);
    };

    var Recaptcha = (function () {
      var state = { widgetId: null, rendered: false, renderInFlight: false, attempts: 0, startedAt: 0, timerId: null, apiRequested: false };
      window.__ctwpmlRecaptchaState = state;
      function clearTimer() { if (state.timerId) clearTimeout(state.timerId); state.timerId = null; }
      function hardFail(reason) {
        clearTimer(); state.renderInFlight = false; captchaValid = false;
        setMsg($('#ctwpml-auth-msg'), 'Não foi possível carregar a verificação de segurança. Tente carregar novamente ou fale com o suporte.', true);
        $('#ctwpml-recaptcha-retry').prop('hidden', false);
        syncAuthButton();
        logCtwpml('CTWPML_RECAPTCHA_ABORT', { reason: reason });
      }
      function injectApiJs() {
        if (state.apiRequested || document.querySelector('script[src*="recaptcha/api.js"]')) return;
        state.apiRequested = true;
        var script = document.createElement('script');
        script.async = true; script.defer = true; script.dataset.ctwpmlRecaptcha = '1';
        script.src = 'https://www.google.com/recaptcha/api.js?onload=ctwpmlRecaptchaOnload&render=explicit';
        script.onerror = function () { hardFail('api_load_error'); };
        document.head.appendChild(script);
        logCtwpml('CTWPML_RECAPTCHA_API_REQUESTED', {});
      }
      function ensureRendered() {
        clearTimer();
        if (!recaptchaEnabled()) { $('#ctwpml-recaptcha-container').hide(); syncAuthButton(); return; }
        // Acesso rápido pode cobrir o formulário. Não gastar o prazo nem renderizar iframe oculto.
        if (!$('#ctwpml-auth-form').is(':visible')) { state.startedAt = 0; state.attempts = 0; return; }
        if (state.rendered || state.renderInFlight) { syncAuthButton(); return; }
        if (!state.startedAt) { state.startedAt = Date.now(); logCtwpml('CTWPML_RECAPTCHA_START', {}); }
        if (++state.attempts > 25 || Date.now() - state.startedAt > 12000) { hardFail('timeout'); return; }
        var container = document.getElementById('g-recaptcha'), key = getSiteKey();
        if (!container || !key) { hardFail('missing_configuration'); return; }
        if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
          injectApiJs(); state.timerId = setTimeout(ensureRendered, 450); return;
        }
        state.renderInFlight = true;
        try {
          state.widgetId = grecaptcha.render(container, {
            sitekey: key,
            size: container.clientWidth && container.clientWidth < 304 ? 'compact' : 'normal',
            callback: function () { captchaValid = true; $('#ctwpml-recaptcha-retry').prop('hidden', true); setMsg($('#ctwpml-auth-msg'), '', false); syncAuthButton(); },
            'expired-callback': window.ctwpmlAuthDisable,
            'error-callback': function () { hardFail('challenge_network_error'); }
          });
          window.__ctwpmlRecaptchaId = state.widgetId;
          state.rendered = true;
          $('#ctwpml-recaptcha-retry').prop('hidden', true);
          logCtwpml('CTWPML_RECAPTCHA_RENDERED', {});
        } catch (e) { hardFail('render_failed'); }
        finally { state.renderInFlight = false; syncAuthButton(); }
      }
      function reset() {
        clearTimer(); captchaValid = false;
        try { if (state.widgetId !== null && typeof grecaptcha !== 'undefined') grecaptcha.reset(state.widgetId); } catch (e) { }
        syncAuthButton();
      }
      function retry() {
        clearTimer(); state.startedAt = 0; state.attempts = 0; state.apiRequested = false;
        if (state.rendered) { reset(); $('#ctwpml-recaptcha-retry').prop('hidden', true); return; }
        if (typeof grecaptcha === 'undefined') document.querySelectorAll('script[data-ctwpml-recaptcha],#google-recaptcha-v2-js').forEach(function (node) { node.remove(); });
        ensureRendered();
      }
      return { ensureRendered: ensureRendered, reset: reset, retry: retry, cancel: clearTimer };
    })();
    window.ctwpmlRenderRecaptchaIfNeeded = Recaptcha.ensureRendered;
    function resetRecaptcha() { Recaptcha.reset(); }
    $(document).on('click', '#ctwpml-recaptcha-retry', function () { if (!authInFlight) Recaptcha.retry(); });
    $(window).on('pagehide', Recaptcha.cancel);
    syncAuthButton();

    function normalizeFullName(fullName) {
      try {
        return String(fullName || '').replace(/\s+/g, ' ').trim();
      } catch (e) {
        return '';
      }
    }

    function getStoredCheckoutName() {
      var keys = ['ctwpml_auth_resume_v1', 'ctwpml_ml_form_state_v1'];
      for (var i = 0; i < keys.length; i++) {
        try {
          if (!window.sessionStorage) continue;
          var raw = window.sessionStorage.getItem(keys[i]);
          if (!raw) continue;
          var snap = JSON.parse(raw);
          if (!snap || typeof snap !== 'object') continue;
          var candidates = [
            snap.billingName || '',
            snap.nome || '',
            snap.formSnapshot && snap.formSnapshot.nome ? snap.formSnapshot.nome : '',
            snap.addressSnapshot && snap.addressSnapshot.receiver_name ? snap.addressSnapshot.receiver_name : '',
            snap.billingSnapshot ? ((snap.billingSnapshot.firstName || '') + ' ' + (snap.billingSnapshot.lastName || '')).trim() : ''
          ];
          for (var j = 0; j < candidates.length; j++) {
            var name = normalizeFullName(candidates[j]);
            if (name) return name;
          }
        } catch (e0) { }
      }
      return '';
    }

    function getCheckoutBillingName() {
      var candidates = [];
      try { candidates.push(($('#ctwpml-input-nome').val() || '').trim()); } catch (e0) { }
      try {
        var first = ($('#billing_first_name').val() || '').trim();
        var last = ($('#billing_last_name').val() || '').trim();
        candidates.push((first + ' ' + last).trim());
      } catch (e1) { }
      candidates.push(getStoredCheckoutName());
      for (var i = 0; i < candidates.length; i++) {
        var name = normalizeFullName(candidates[i]);
        if (name) return name;
      }
      return '';
    }

    $(document).on('submit', '#ctwpml-auth-form', function (e) {
      e.preventDefault();
      if (authInFlight) return;
      var $form = $(this);
      var p = getParams();
      var ajaxUrl = p.ajax_url;
      var createNonce = p.auth_email_nonce;
      var loginNonce = p.login_nonce;
      if (!ajaxUrl) return;

      var loginEmail = ($('#ctwpml-login-email').val() || '').trim().toLowerCase();
      var loginPassword = ($('#ctwpml-login-password').val() || '').trim();
      var createEmail = ($('#ctwpml-create-email').val() || '').trim().toLowerCase();
      var $msg = $('#ctwpml-auth-msg');
      setMsg($msg, '', false);

      var flow = '';
      var explicitMode = String($form.attr('data-ctwpml-auth-mode') || '').toLowerCase();
      if (explicitMode === 'login') flow = 'login';
      else if (explicitMode === 'create') flow = 'create';
      else if (loginPassword) flow = 'login';
      else if (createEmail) flow = 'create';

      if (flow === 'login') {
        if (!loginEmail || !loginPassword) {
          setMsg($msg, 'Preencha e-mail e senha.', true);
          return;
        }
        if (!loginNonce) {
          setMsg($msg, 'Configuração inválida. Recarregue a página.', true);
          return;
        }
      } else if (flow === 'create') {
        if (!createEmail) {
          setMsg($msg, 'Preencha o e-mail para criar conta.', true);
          return;
        }
        if (!createNonce) {
          setMsg($msg, 'Configuração inválida. Recarregue a página.', true);
          return;
        }
        if (explicitMode !== 'create' && !window.confirm('Confira se este e-mail está correto antes de prosseguir.')) return;
      } else {
        setMsg($msg, 'Preencha seus dados para prosseguir.', true);
        return;
      }

      var recaptchaResponse = captchaResponse();
      if (recaptchaEnabled() && !recaptchaResponse) {
        setMsg($msg, 'Complete a verificação de segurança para continuar.', true);
        highlightRecaptchaError(); Recaptcha.ensureRendered();
        return;
      }

      authInFlight = true; syncAuthButton();
      var requestData = {
        action: (flow === 'login') ? 'ctwpml_login' : 'ctwpml_auth_email',
        _ajax_nonce: (flow === 'login') ? loginNonce : createNonce,
        email: (flow === 'login') ? loginEmail : createEmail,
        password: (flow === 'login') ? loginPassword : undefined,
        recaptcha_response: recaptchaResponse
      };
      var checkoutName = getCheckoutBillingName();
      if (flow === 'create' && checkoutName) requestData.name = checkoutName;
      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        dataType: 'json',
        data: requestData,
        success: function (resp) {
          if (resp && resp.success) {
            setMsg($msg, 'Entrando... Aguarde.', false);
            if (window.CTWPMLPrepare) window.CTWPMLPrepare.showPreparingOverlay('Acesso confirmado. Carregando seus dados…');
            var resumeUrl = new URL(window.location.href);
            resumeUrl.searchParams.set('ctwpml_session_refresh', String(Date.now()));
            window.location.assign(resumeUrl.href);
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao autenticar.';
          setMsg($msg, m, true);
          resetRecaptcha();
        },
        error: function (xhr) {
          var m = 'Erro ao autenticar.';
          if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
            m = xhr.responseJSON.data.message || xhr.responseJSON.data;
          }
          setMsg($msg, m, true);
          resetRecaptcha();
        },
        complete: function () {
          authInFlight = false; syncAuthButton();
        }
      });
    });
  });
})(window);

