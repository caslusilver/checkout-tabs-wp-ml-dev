(function (window) {
  'use strict';

  function setMsg($el, text, isError, allowHtml) {
    // Se allowHtml=true, usa .html() para permitir links clicáveis
    // Caso contrário, usa .text() para segurança (escapa HTML)
    if (allowHtml) {
      $el.html(String(text || ''));
    } else {
      $el.text(String(text || ''));
    }
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

    // Tabs Login/Criar conta
    $(document).on('click', '#login-popup .ctwpml-auth-tab', function () {
      var tab = $(this).data('tab');
      $('#login-popup .ctwpml-auth-tab').removeClass('is-active');
      $(this).addClass('is-active');
      $('#login-popup .ctwpml-auth-panel').hide();
      $('#login-popup .ctwpml-auth-panel[data-tab="' + tab + '"]').show();

      // v3.2.10: Renderizar reCAPTCHA quando a aba de signup for mostrada
      if (tab === 'signup') {
        // Aguardar o DOM atualizar antes de renderizar
        setTimeout(function () {
          renderSignupRecaptchaIfNeeded();
        }, 100);
      }
    });

    // v3.2.10: Função robusta para renderizar reCAPTCHA do signup
    function renderSignupRecaptchaIfNeeded() {
      var siteKeyFixa = '6LfWXPIqAAAAAF3U6KDkq9WnI1IeYh8uQ1ZvqiPX';
      var $signupContainer = $('#g-recaptcha');

      logCtwpml('Tentando renderizar reCAPTCHA signup', {
        grecaptchaExists: typeof grecaptcha !== 'undefined',
        containerExists: $signupContainer.length > 0,
        alreadyRendered: $signupContainer.hasClass('recaptcha-rendered'),
        containerVisible: $signupContainer.is(':visible')
      });

      // Se grecaptcha não está disponível, aguardar e tentar novamente
      if (typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
        logCtwpml('grecaptcha não disponível, tentando novamente em 500ms');
        setTimeout(renderSignupRecaptchaIfNeeded, 500);
        return;
      }

      if (!$signupContainer.length) {
        logCtwpml('Container #g-recaptcha não encontrado');
        return;
      }

      if ($signupContainer.hasClass('recaptcha-rendered')) {
        logCtwpml('reCAPTCHA signup já renderizado');
        return;
      }

      try {
        window.__ctwpmlRecaptchaSignupId = grecaptcha.render($signupContainer[0], {
          sitekey: siteKeyFixa,
          callback: window.ctwpmlSignupEnable,
          'expired-callback': window.ctwpmlSignupDisable,
        });
        $signupContainer.addClass('recaptcha-rendered');
        logCtwpml('reCAPTCHA signup renderizado COM SUCESSO', { widgetId: window.__ctwpmlRecaptchaSignupId });

        // Desabilitar botão até completar reCAPTCHA
        var btnS = document.getElementById('ctwpml-signup-submit');
        if (btnS) { btnS.disabled = true; btnS.style.opacity = '0.6'; }
      } catch (e) {
        logCtwpml('Erro ao renderizar reCAPTCHA signup', { error: e && e.message });
        // Se já foi renderizado, ignore o erro
        if (e && e.message && e.message.indexOf('already been rendered') > -1) {
          $signupContainer.addClass('recaptcha-rendered');
        }
      }
    }

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
      var telemetryStart = window.CCTelemetry ? window.CCTelemetry.start('1.1-recaptcha-signup') : null;
      var recaptchaResponse = '';
      if (typeof grecaptcha !== 'undefined' && typeof window.__ctwpmlRecaptchaSignupId !== 'undefined') {
        try {
          recaptchaResponse = grecaptcha.getResponse(window.__ctwpmlRecaptchaSignupId) || '';
        } catch (e) { }
      }
      if (!recaptchaResponse) {
        // Telemetria: reCAPTCHA não preenchido
        if (window.CCTelemetry) {
          window.CCTelemetry.track('1.1-recaptcha-signup', 'error', {
            reason: 'recaptcha_not_completed',
            hasWidget: typeof window.__ctwpmlRecaptchaSignupId !== 'undefined'
          });
        }
        
        var linkHtml = '<a href="#" id="ctwpml-goto-recaptcha" style="color:#3483fa;font-weight:bold;">Clique aqui para completar o reCAPTCHA</a>';
        setMsg($msg, 'Por favor, complete o reCAPTCHA. ' + linkHtml, true, true); // allowHtml=true para o link funcionar

        // Handler para voltar à aba de login e destacar reCAPTCHA (remove anterior para não acumular)
        $(document).off('click', '#ctwpml-goto-recaptcha').on('click', '#ctwpml-goto-recaptcha', function (e) {
          e.preventDefault();
          
          // Telemetria: clique no link de redirecionamento
          if (window.CCTelemetry) {
            window.CCTelemetry.click('1.1-recaptcha-signup', 'click-redirect-link', {
              fromTab: 'signup',
              toTab: 'login'
            });
          }
          
          // Trocar para aba login
          $('#login-popup .ctwpml-auth-tab[data-tab="login"]').trigger('click');
          
          // Aguardar a aba de login aparecer e o reCAPTCHA estar visível
          setTimeout(function() {
            var recContainer = $('#ctwpml-recaptcha-login-container');
            var recWidget = $('#g-recaptcha-login');
            
            // Adicionar classe de erro no container e destacar com stroke vermelho
            if (recContainer.length) {
              recContainer.addClass('ctwpml-recaptcha-error');
              recContainer.css({
                'border': '2px solid #dc2626',
                'border-radius': '4px',
                'padding': '4px',
                'background-color': 'rgba(220, 38, 38, 0.05)'
              });
            }
            
            // Também destacar o widget do reCAPTCHA se existir
            if (recWidget.length) {
              recWidget.css({
                'outline': '2px solid #dc2626',
                'outline-offset': '2px'
              });
            }
            
            // Scroll suave para o reCAPTCHA
            if (recContainer.length && recContainer[0].scrollIntoView) {
              recContainer[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Telemetria: reCAPTCHA destacado com sucesso
            if (window.CCTelemetry) {
              window.CCTelemetry.track('1.1-recaptcha-signup', 'highlight-applied', {
                containerFound: recContainer.length > 0,
                widgetFound: recWidget.length > 0,
                scrollApplied: recContainer.length > 0
              });
            }
            
            // Remover destaque após 5 segundos
            setTimeout(function() {
              recContainer.removeClass('ctwpml-recaptcha-error');
              recContainer.css({
                'border': '',
                'border-radius': '',
                'padding': '',
                'background-color': ''
              });
              recWidget.css({
                'outline': '',
                'outline-offset': ''
              });
              
              // Telemetria: destaque removido
              if (window.CCTelemetry) {
                window.CCTelemetry.track('1.1-recaptcha-signup', 'highlight-removed', {
                  duration: 5000
                });
              }
            }, 5000);
          }, 300); // Aguardar 300ms para garantir que a aba foi trocada
        });
        return;
      }
      
      // Telemetria: reCAPTCHA validado com sucesso
      if (window.CCTelemetry && telemetryStart) {
        window.CCTelemetry.end('1.1-recaptcha-signup', telemetryStart, true, {
          hasResponse: !!recaptchaResponse
        });
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
            // Telemetria: signup bem-sucedido
            if (window.CCTelemetry) {
              window.CCTelemetry.track('1.4-session-persistence', 'success', {
                action: 'signup',
                userId: resp.data && resp.data.user_id ? resp.data.user_id : null
              });
            }
            
            setMsg($msg, 'Conta criada! Atualizando...', false);
            // Reload forçado para garantir nova sessão
            window.location.href = window.location.href.split('?')[0] + '?ctwpml_session_refresh=' + Date.now();
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao criar conta.';
          setMsg($msg, m, true);
          // Reseta reCAPTCHA após erro
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaSignupId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaSignupId);
              else grecaptcha.reset();
            } catch (e) { }
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
            } catch (e) { }
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
        } catch (e) { }
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
            // Telemetria: login bem-sucedido
            if (window.CCTelemetry) {
              window.CCTelemetry.track('1.4-session-persistence', 'success', {
                action: 'login',
                userEmail: resp.data && resp.data.user_email ? resp.data.user_email : null
              });
            }
            
            setMsg($msg, 'Login realizado! Atualizando...', false);
            // Reload forçado para garantir nova sessão
            window.location.href = window.location.href.split('?')[0] + '?ctwpml_session_refresh=' + Date.now();
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao fazer login.';
          setMsg($msg, m, true);
          if (typeof grecaptcha !== 'undefined') {
            try {
              if (typeof window.__ctwpmlRecaptchaLoginId !== 'undefined') grecaptcha.reset(window.__ctwpmlRecaptchaLoginId);
              else grecaptcha.reset();
            } catch (e) { }
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
            } catch (e) { }
          }
        },
        complete: function () {
          $('#ctwpml-login-submit').prop('disabled', false);
        },
      });
    });
  });
})(window);


