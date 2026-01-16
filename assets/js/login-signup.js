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
    if (!$('#login-popup').length) return;

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

    // =========================================================
    // reCAPTCHA Controller (anti-loop / anti-render duplicado)
    // =========================================================
    var RecaptchaCtl = (function () {
      var timerId = null;
      var startedAt = 0;
      var attempts = 0;
      var rendered = false;
      var renderInFlight = false;

      var MAX_ATTEMPTS = 20;
      var TIMEOUT_MS = 10000;
      var RETRY_MS = 400;

      function clearTimer() {
        if (timerId) {
          try { clearTimeout(timerId); } catch (e) { }
          timerId = null;
        }
      }

      function scheduleRetry(reason) {
        clearTimer();
        timerId = setTimeout(function () {
          ensureRendered({ reason: reason || 'retry' });
        }, RETRY_MS);
      }

      function hardFail(message) {
        clearTimer();
        renderInFlight = false;
        var $msg = $('#ctwpml-auth-msg');
        if ($msg.length) setMsg($msg, message || 'Não foi possível carregar o reCAPTCHA. Recarregue a página.', true);
        try {
          var btn0 = document.getElementById('ctwpml-auth-submit');
          if (btn0) { btn0.disabled = true; btn0.style.opacity = '0.6'; }
        } catch (e0) { }
      }

      function isPopupVisible() {
        try { return $('#login-popup').is(':visible'); } catch (e) { return false; }
      }

      function ensureRendered(opts) {
        opts = opts || {};
        if (rendered || renderInFlight) return;

        if (!startedAt) startedAt = Date.now();
        attempts += 1;

        if (attempts > MAX_ATTEMPTS || (Date.now() - startedAt) > TIMEOUT_MS) {
          hardFail('Não foi possível carregar o reCAPTCHA. Recarregue a página.');
          logCtwpml('reCAPTCHA abortado (timeout/attempts)', { attempts: attempts, elapsedMs: Date.now() - startedAt, reason: opts.reason || '' });
          return;
        }

        if (!isPopupVisible()) {
          scheduleRetry('popup_not_visible');
          return;
        }

        var $container = $('#g-recaptcha');
        if (!$container.length) return;
        if ($container.hasClass('recaptcha-rendered')) {
          rendered = true;
          return;
        }

        var siteKey = getSiteKey();
        if (!siteKey) {
          hardFail('reCAPTCHA não configurado. Configure em WooCommerce > Checkout Tabs ML.');
          return;
        }

        if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
          scheduleRetry('grecaptcha_not_ready');
          return;
        }

        renderInFlight = true;
        try {
          window.__ctwpmlRecaptchaId = grecaptcha.render($container[0], {
            sitekey: siteKey,
            callback: window.ctwpmlAuthEnable,
            'expired-callback': window.ctwpmlAuthDisable
          });
          $container.addClass('recaptcha-rendered');
          rendered = true;
          logCtwpml('reCAPTCHA renderizado (ctl)', { widgetId: window.__ctwpmlRecaptchaId });
          try {
            var btn = document.getElementById('ctwpml-auth-submit');
            if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
          } catch (e1) { }
        } catch (e) {
          var msg = (e && e.message) ? String(e.message) : 'unknown';
          logCtwpml('Erro ao renderizar reCAPTCHA (ctl)', { error: msg });
          if (msg.indexOf('already been rendered') > -1) {
            $container.addClass('recaptcha-rendered');
            rendered = true;
          } else {
            scheduleRetry('render_error');
          }
        } finally {
          renderInFlight = false;
        }
      }

      function reset() {
        clearTimer();
        attempts = 0;
        startedAt = 0;
        rendered = false;
        renderInFlight = false;
        try {
          if (typeof grecaptcha !== 'undefined') {
            if (typeof window.__ctwpmlRecaptchaId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaId);
            else grecaptcha.reset();
          }
        } catch (e) { }
      }

      return {
        ensureRendered: ensureRendered,
        reset: reset,
        cancelRetries: clearTimer
      };
    })();

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

    function renderRecaptchaIfNeeded() {
      RecaptchaCtl.ensureRendered({ reason: 'renderRecaptchaIfNeeded' });
    }

    function resetRecaptcha() {
      RecaptchaCtl.reset();
    }

    window.ctwpmlRenderRecaptchaIfNeeded = renderRecaptchaIfNeeded;

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
      } else if (flow === 'create') {
        if (!createEmail) {
          setMsg($msg, 'Preencha o e-mail para criar conta.', true);
          return;
        }
        if (!window.confirm('Confira se este e-mail está correto antes de prosseguir.')) {
          return;
        }
      } else {
        setMsg($msg, 'Preencha seus dados para prosseguir.', true);
        return;
      }

      var recaptchaResponse = '';
      if (typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaId !== 'undefined') {
        try {
          recaptchaResponse = grecaptcha.getResponse(window.__ctwpmlRecaptchaId) || '';
        } catch (e0) { }
      }
      if (!recaptchaResponse) {
        setMsg($msg, 'Você deve provar que não é um robô.', true);
        highlightRecaptchaError();
        return;
      }

      if (flow === 'create' && !createNonce) {
        setMsg($msg, 'Configuração inválida. Recarregue a página.', true);
        return;
      }
      if (flow === 'login' && !loginNonce) {
        setMsg($msg, 'Configuração inválida. Recarregue a página.', true);
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

    $(document).on('click', '#login-popup .popup-close-button', function () {
      if ($.fancybox) $.fancybox.close();
      var cartUrl = (window.cc_params && window.cc_params.cart_url) ? String(window.cc_params.cart_url) : '';
      if (cartUrl) {
        window.location.href = cartUrl;
      }
    });

    // Importante: NÃO renderizar no ready (popup está oculto).
    // Render acontece via afterShow do Fancybox chamando window.ctwpmlRenderRecaptchaIfNeeded().
  });
})(window);


