(function (window) {
  'use strict';

  function setMsg($el, text, isError) {
    $el.text(String(text || ''));
    $el.css('display', text ? 'block' : 'none');
    $el.css('color', isError ? '#b42318' : '#067647');
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

      // Validar reCAPTCHA v2
      var recaptchaResponse = $('#ctwpml-recaptcha-container').find('.g-recaptcha-response').val();
      if (!recaptchaResponse) {
        setMsg($msg, 'Por favor, complete o reCAPTCHA.', true);
        return;
      }

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
            try { grecaptcha.reset(); } catch(e) {}
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
            try { grecaptcha.reset(); } catch(e) {}
          }
        },
        complete: function () {
          $('#ctwpml-signup-submit').prop('disabled', false);
        },
      });
    });
  });
})(window);


