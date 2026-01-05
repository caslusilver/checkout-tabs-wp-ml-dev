(function (window) {
  'use strict';

  function cpfDigits(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

  function isAllSameDigits(digits) {
    if (!digits || digits.length !== 11) return true;
    for (var i = 1; i < digits.length; i++) if (digits[i] !== digits[0]) return false;
    return true;
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
      if (!isAllSameDigits(cpf)) return cpf;
    }
  }

  function formatCpf(value) {
    var d = cpfDigits(value);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

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

    // CPF input mask
    $(document).on('input', '#ctwpml-signup-cpf', function () {
      var $i = $('#ctwpml-signup-cpf');
      var f = formatCpf($i.val());
      if ($i.val() !== f) $i.val(f);
    });

    // Mostrar/ocultar “Gerar CPF fictício”
    function syncFakeCpfVisibility() {
      var p = getParams();
      var allow = p && (p.allow_fake_cpf === 1 || p.allow_fake_cpf === '1');
      $('#ctwpml-generate-cpf').css('display', allow ? 'inline-block' : 'none');
    }
    syncFakeCpfVisibility();

    $(document).on('click', '#ctwpml-generate-cpf', function (e) {
      e.preventDefault();
      var p = getParams();
      var allow = p && (p.allow_fake_cpf === 1 || p.allow_fake_cpf === '1');
      if (!allow) return;

      var ok = window.confirm(
        'Atenção: o CPF gerado é definitivo e não poderá ser alterado depois.'
      );
      if (!ok) return;

      var digits = generateFakeCpfDigits();
      $('#ctwpml-signup-cpf').val(formatCpf(digits));
      $('#ctwpml-cpf-hint').show();
    });

    $(document).on('submit', '#ctwpml-signup-form', function (e) {
      e.preventDefault();
      var p = getParams();
      var ajaxUrl = p.ajax_url;
      var nonce = p.signup_nonce;
      if (!ajaxUrl || !nonce) return;

      var name = ($('#ctwpml-signup-name').val() || '').trim();
      var email = ($('#ctwpml-signup-email').val() || '').trim();
      var cpf = cpfDigits($('#ctwpml-signup-cpf').val());

      var $msg = $('#ctwpml-signup-msg');
      setMsg($msg, '', false);

      if (!name || !email || cpf.length !== 11) {
        setMsg($msg, 'Preencha nome, e-mail e CPF.', true);
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
          cpf: cpf,
        },
        success: function (resp) {
          if (resp && resp.success) {
            setMsg($msg, 'Conta criada! Atualizando...', false);
            window.location.reload();
            return;
          }
          var m = (resp && resp.data && resp.data.message) || (resp && resp.data) || 'Erro ao criar conta.';
          setMsg($msg, m, true);
        },
        error: function () {
          setMsg($msg, 'Erro ao criar conta.', true);
        },
        complete: function () {
          $('#ctwpml-signup-submit').prop('disabled', false);
        },
      });
    });
  });
})(window);


