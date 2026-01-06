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
    } catch (e) {}
    try {
      if (data) console.log('[CTWPML]', message, data);
      else console.log('[CTWPML]', message);
    } catch (e) {}
  }

  jQuery(function ($) {
    if (!$('#login-popup').length) return;

    function getParams() {
      return window.cc_params || {};
    }

    // Tabs Login/Criar conta
    $(document).on('click', '#login-popup .ctwpml-auth-tab', function () {
      var tab = $(this).data('tab');
      $('#login-popup .ctwpml-auth-tab').removeClass('is-active');
      $(this).addClass('is-active');
      $('#login-popup .ctwpml-auth-panel').hide();
      $('#login-popup .ctwpml-auth-panel[data-tab="' + tab + '"]').show();
    });

    $(document).on('submit', '#ctwpml-signup-form', function (e) {
      e.preventDefault();
      var p = getParams();
      var ajaxUrl = p.ajax_url;
      var nonce = p.signup_nonce;
      if (!ajaxUrl || !nonce) return;

      var name = ($('#ctwpml-signup-name').val() || '').trim();
      var email = ($('#ctwpml-signup-email').val() || '').trim().toLowerCase();

      var $msg = $('#ctwpml-signup-msg');
      setMsg($msg, '', false);

      if (!name || !email) {
        setMsg($msg, 'Preencha nome e e-mail.', true);
        return;
      }

      // Validar reCAPTCHA v2 (render explícito)
      var recaptchaResponse = '';
      if (typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaSignupId !== 'undefined') {
        try {
          recaptchaResponse = grecaptcha.getResponse(window.__ctwpmlRecaptchaSignupId) || '';
        } catch (e) {}
      }
      if (!recaptchaResponse) {
        setMsg($msg, 'Por favor, complete o reCAPTCHA.', true);
        return;
      }

      logCtwpml('Signup submit (AJAX) iniciado', { email: email });

      $('#ctwpml-signup-submit').prop('disabled', true);
      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_signup',
          _ajax_nonce: nonce,
          name: name,
          email: email,
          recaptcha_response: recaptchaResponse,
        },
        success: function (resp) {
          if (resp && resp.success) {
            setMsg($msg, 'Conta criada! Atualizando...', false);
            window.location.reload();
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao criar conta.';
          setMsg($msg, m, true);
          // Reseta reCAPTCHA após erro
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaSignupId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaSignupId);
              else grecaptcha.reset();
            } catch(e) {}
          }
        },
        error: function (xhr) {
          var m = 'Erro ao criar conta.';
          if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
            m = xhr.responseJSON.data.message || xhr.responseJSON.data;
          }
          setMsg($msg, m, true);
          // Reseta reCAPTCHA após erro
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaSignupId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaSignupId);
              else grecaptcha.reset();
            } catch(e) {}
          }
        },
        complete: function () {
          $('#ctwpml-signup-submit').prop('disabled', false);
        },
      });
    });

    // LOGIN via AJAX + reCAPTCHA (obrigatório)
    $(document).on('submit', '#ctwpml-login-form', function (e) {
      e.preventDefault();
      var p = getParams();
      var ajaxUrl = p.ajax_url;
      var nonce = p.login_nonce;
      if (!ajaxUrl || !nonce) return;

      var email = ($('#ctwpml-username').val() || '').trim().toLowerCase();
      var password = ($('#ctwpml-password').val() || '').trim();

      var $msg = $('#ctwpml-login-msg');
      setMsg($msg, '', false);

      if (!email || !password) {
        setMsg($msg, 'Preencha e-mail e senha.', true);
        return;
      }

      // reCAPTCHA obrigatório no login
      var recaptchaResponse = '';
      if (typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaLoginId !== 'undefined') {
        try {
          recaptchaResponse = grecaptcha.getResponse(window.__ctwpmlRecaptchaLoginId) || '';
        } catch (e) {}
      }
      if (!recaptchaResponse) {
        setMsg($msg, 'Por favor, complete o reCAPTCHA.', true);
        return;
      }

      logCtwpml('Login submit (AJAX) iniciado', { email: email });

      $('#ctwpml-login-submit').prop('disabled', true);
      $.ajax({
        url: ajaxUrl,
        type: 'POST',
        dataType: 'json',
        data: {
          action: 'ctwpml_login',
          _ajax_nonce: nonce,
          email: email,
          password: password,
          recaptcha_response: recaptchaResponse,
        },
        success: function (resp) {
          if (resp && resp.success) {
            setMsg($msg, 'Login realizado! Atualizando...', false);
            window.location.reload();
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao fazer login.';
          setMsg($msg, m, true);
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaLoginId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaLoginId);
              else grecaptcha.reset();
            } catch (e) {}
          }
        },
        error: function (xhr) {
          var m = 'Erro ao fazer login.';
          if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
            m = xhr.responseJSON.data.message || xhr.responseJSON.data;
          }
          setMsg($msg, m, true);
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaLoginId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaLoginId);
              else grecaptcha.reset();
            } catch (e) {}
          }
        },
        complete: function () {
          $('#ctwpml-login-submit').prop('disabled', false);
        },
      });
    });
  });
})(window);


