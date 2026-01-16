(function (window) {
  'use strict';

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

    // =========================================================
    // reCAPTCHA Loader (anti-loop + fallback api.js)
    // =========================================================
    var Recaptcha = (function () {
      var state = window.__ctwpmlRecaptchaState || {
        apiRequested: false,
        apiLoaded: false,
        renderInFlight: false,
        rendered: false,
        widgetId: null,
        attempts: 0,
        startedAt: 0,
        timerId: null,
        lastAbortReason: ''
      };
      window.__ctwpmlRecaptchaState = state;

      var MAX_ATTEMPTS = 20;
      var TIMEOUT_MS = 12000;
      var RETRY_MS = 450;

      function clearTimer() {
        if (state.timerId) {
          try { clearTimeout(state.timerId); } catch (e) { }
          state.timerId = null;
        }
      }

      function isAuthViewVisible() {
        try { return $('#ctwpml-view-auth').is(':visible'); } catch (e) { return false; }
      }

      function scriptAlreadyPresent() {
        try {
          var nodes = document.querySelectorAll('script[src*=\"recaptcha/api.js\"]');
          return !!(nodes && nodes.length);
        } catch (e) { return false; }
      }

      function injectApiJs() {
        if (state.apiRequested) return;
        state.apiRequested = true;

        if (scriptAlreadyPresent()) {
          return;
        }

        try {
          var s = document.createElement('script');
          s.async = true;
          s.defer = true;
          s.src = 'https://www.google.com/recaptcha/api.js?onload=ctwpmlRecaptchaOnload&render=explicit';
          s.onload = function () {
            state.apiLoaded = true;
            logCtwpml('CTWPML_RECAPTCHA_API_LOADED', {});
          };
          s.onerror = function () {
            state.apiLoaded = false;
            state.lastAbortReason = 'api_js_load_error';
          };
          document.head.appendChild(s);
          logCtwpml('CTWPML_RECAPTCHA_API_REQUESTED', {});
        } catch (e) {
          state.lastAbortReason = 'api_js_inject_error';
        }
      }

      function scheduleRetry(reason) {
        clearTimer();
        state.timerId = setTimeout(function () {
          ensureRendered({ reason: reason || 'retry' });
        }, RETRY_MS);
      }

      function hardFail(message, reason) {
        clearTimer();
        state.renderInFlight = false;
        state.lastAbortReason = String(reason || 'unknown');
        var $msg = $('#ctwpml-auth-msg');
        if ($msg.length) setMsg($msg, message || 'Não foi possível carregar o reCAPTCHA. Recarregue a página.', true);
        try {
          var btn0 = document.getElementById('ctwpml-auth-submit');
          if (btn0) { btn0.disabled = true; btn0.style.opacity = '0.6'; }
        } catch (e0) { }
        // Alta-sinal (sem spam)
        logCtwpml('CTWPML_RECAPTCHA_ABORT', { reason: state.lastAbortReason });
      }

      function ensureRendered(opts) {
        opts = opts || {};
        if (state.rendered || state.renderInFlight) return;

        if (!state.startedAt) {
          state.startedAt = Date.now();
          state.attempts = 0;
          // Alta-sinal (sem spam)
          logCtwpml('CTWPML_RECAPTCHA_START', { context: opts.reason || '' });
        }
        state.attempts += 1;

        if (state.attempts > MAX_ATTEMPTS || (Date.now() - state.startedAt) > TIMEOUT_MS) {
          hardFail('Não foi possível carregar o reCAPTCHA. Recarregue a página.', 'timeout_or_attempts');
          return;
        }

        if (!isAuthViewVisible()) {
          scheduleRetry('auth_view_not_visible');
          return;
        }

        var $container = $('#g-recaptcha');
        if (!$container.length) {
          scheduleRetry('missing_container');
          return;
        }
        if ($container.hasClass('recaptcha-rendered')) {
          state.rendered = true;
          return;
        }

        var siteKey = getSiteKey();
        if (!siteKey) {
          hardFail('reCAPTCHA não configurado. Configure em WooCommerce > Checkout Tabs ML.', 'missing_site_key');
          return;
        }

        if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
          injectApiJs();
          scheduleRetry('grecaptcha_not_ready');
          return;
        }

        state.renderInFlight = true;
        try {
          state.widgetId = grecaptcha.render($container[0], {
            sitekey: siteKey,
            callback: window.ctwpmlAuthEnable,
            'expired-callback': window.ctwpmlAuthDisable
          });
          window.__ctwpmlRecaptchaId = state.widgetId;
          $container.addClass('recaptcha-rendered');
          state.rendered = true;
          logCtwpml('CTWPML_RECAPTCHA_RENDERED', { widgetId: state.widgetId });
          try {
            var btn = document.getElementById('ctwpml-auth-submit');
            if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
          } catch (e1) { }
        } catch (e) {
          var msg = (e && e.message) ? String(e.message) : 'unknown';
          if (msg.indexOf('already been rendered') > -1) {
            $container.addClass('recaptcha-rendered');
            state.rendered = true;
            logCtwpml('CTWPML_RECAPTCHA_RENDERED', { widgetId: state.widgetId, note: 'already_rendered' });
          } else {
            scheduleRetry('render_error');
          }
        } finally {
          state.renderInFlight = false;
        }
      }

      function reset() {
        clearTimer();
        state.startedAt = 0;
        state.attempts = 0;
        state.rendered = false;
        state.renderInFlight = false;
        try {
          if (typeof grecaptcha !== 'undefined') {
            if (typeof window.__ctwpmlRecaptchaId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaId);
            else grecaptcha.reset();
          }
        } catch (e) { }
      }

      function cancel() {
        clearTimer();
      }

      return {
        ensureRendered: ensureRendered,
        reset: reset,
        cancel: cancel
      };
    })();

    window.ctwpmlRenderRecaptchaIfNeeded = function () {
      Recaptcha.ensureRendered({ reason: 'external_call' });
    };

    function resetRecaptcha() {
      Recaptcha.reset();
    }

    $(document).on('submit', '#ctwpml-auth-form', function (e) {
      e.preventDefault();
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
      if (loginPassword) flow = 'login';
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
        if (!window.confirm('Confira se este e-mail está correto antes de prosseguir.')) return;
      } else {
        setMsg($msg, 'Preencha seus dados para prosseguir.', true);
        return;
      }

      var recaptchaResponse = '';
      if (typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaId !== 'undefined') {
        try { recaptchaResponse = grecaptcha.getResponse(window.__ctwpmlRecaptchaId) || ''; } catch (e0) { }
      }
      if (!recaptchaResponse) {
        setMsg($msg, 'Você deve provar que não é um robô.', true);
        highlightRecaptchaError();
        return;
      }

      $('#ctwpml-auth-submit').prop('disabled', true);
      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        dataType: 'json',
        data: {
          action: (flow === 'login') ? 'ctwpml_login' : 'ctwpml_auth_email',
          _ajax_nonce: (flow === 'login') ? loginNonce : createNonce,
          email: (flow === 'login') ? loginEmail : createEmail,
          password: (flow === 'login') ? loginPassword : undefined,
          recaptcha_response: recaptchaResponse
        },
        success: function (resp) {
          if (resp && resp.success) {
            setMsg($msg, 'Entrando... Aguarde.', false);
            window.location.href = window.location.href.split('?')[0] + '?ctwpml_session_refresh=' + Date.now();
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
          $('#ctwpml-auth-submit').prop('disabled', false);
        }
      });
    });
  });
})(window);

