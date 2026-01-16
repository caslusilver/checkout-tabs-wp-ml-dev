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
      var $container = $('#g-recaptcha');
      var siteKey = getSiteKey();

      logCtwpml('Tentando renderizar reCAPTCHA (single)', {
        grecaptchaExists: typeof grecaptcha !== 'undefined',
        containerExists: $container.length > 0,
        alreadyRendered: $container.hasClass('recaptcha-rendered'),
        containerVisible: $container.is(':visible'),
        hasSiteKey: !!siteKey
      });

      if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
        setTimeout(renderRecaptchaIfNeeded, 500);
        return;
      }
      if (!$container.length) return;
      if (!$container.is(':visible')) {
        setTimeout(renderRecaptchaIfNeeded, 300);
        return;
      }
      if (!siteKey) {
        logCtwpml('reCAPTCHA: site key ausente (configure em WooCommerce > Checkout Tabs ML)', {});
        try {
          var btn0 = document.getElementById('ctwpml-auth-submit');
          if (btn0) { btn0.disabled = true; btn0.style.opacity = '0.6'; }
        } catch (e0) { }
        return;
      }
      if ($container.hasClass('recaptcha-rendered')) return;

      try {
        window.__ctwpmlRecaptchaId = grecaptcha.render($container[0], {
          sitekey: siteKey,
          callback: window.ctwpmlAuthEnable,
          'expired-callback': window.ctwpmlAuthDisable
        });
        $container.addClass('recaptcha-rendered');
        logCtwpml('reCAPTCHA renderizado (single)', { widgetId: window.__ctwpmlRecaptchaId });
        var btn = document.getElementById('ctwpml-auth-submit');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
      } catch (e) {
        logCtwpml('Erro ao renderizar reCAPTCHA', { error: e && e.message });
        if (e && e.message && e.message.indexOf('already been rendered') > -1) {
          $container.addClass('recaptcha-rendered');
        }
      }
    }

    function resetRecaptcha() {
      if (typeof grecaptcha === 'undefined') return;
      try {
        if (typeof window.__ctwpmlRecaptchaId !== 'undefined') {
          grecaptcha.reset(window.__ctwpmlRecaptchaId);
        } else {
          grecaptcha.reset();
        }
      } catch (e) { }
    }

    window.ctwpmlRenderRecaptchaIfNeeded = renderRecaptchaIfNeeded;

    $(document).on('submit', '#ctwpml-auth-form', function (e) {
      e.preventDefault();
      var p = getParams();
      var ajaxUrl = p.ajax_url;
      var nonce = p.auth_email_nonce;
      if (!ajaxUrl || !nonce) return;

      var email = ($('#ctwpml-auth-email').val() || '').trim().toLowerCase();
      var $msg = $('#ctwpml-auth-msg');
      setMsg($msg, '', false);

      if (!email) {
        setMsg($msg, 'Preencha o e-mail.', true);
        return;
      }

      if (!window.confirm('Confira se este e-mail está correto antes de prosseguir.')) {
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

      logCtwpml('Auth email submit (AJAX) iniciado', { email: email });

      $('#ctwpml-auth-submit').prop('disabled', true);
      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_auth_email',
          _ajax_nonce: nonce,
          email: email,
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

    renderRecaptchaIfNeeded();
  });
})(window);


