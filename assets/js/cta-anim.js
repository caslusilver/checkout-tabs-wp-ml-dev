(function (window) {
  'use strict';

  var $ = window.jQuery;
  if (!$) return;

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

  var anim = {
    active: false,
    t1: null,
    t2: null,
    t3: null,
  };

  function clearTimers() {
    if (anim.t1) clearTimeout(anim.t1);
    if (anim.t2) clearTimeout(anim.t2);
    if (anim.t3) clearTimeout(anim.t3);
    anim.t1 = anim.t2 = anim.t3 = null;
  }

  function resetCtas() {
    clearTimers();
    anim.active = false;
    $(SELECTOR).removeClass(CLS_LOADING + ' ' + CLS_SUCCESS + ' ' + CLS_EXPAND);
  }

  function startAnimation() {
    if (anim.active) return;
    anim.active = true;

    // Animar os dois botões (normal + sticky) para manter consistência visual.
    var $btns = $(SELECTOR);
    $btns.addClass(CLS_LOADING);

    anim.t1 = setTimeout(function () {
      $btns.removeClass(CLS_LOADING).addClass(CLS_SUCCESS);
      anim.t2 = setTimeout(function () {
        $btns.addClass(CLS_EXPAND);
        anim.t3 = setTimeout(function () {
          // Não fazemos redirect manual. O Woo fará navegação para “obrigado”.
          // Mantemos a classe até a página descarregar.
        }, 800);
      }, 1000);
    }, 2000);
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
    resetCtas();
  });

  // Se o usuário voltar e re-renderizar a tela, garantir que o estado visual não fique preso.
  $(document.body).on('ctwpml_woo_updated', function () {
    // Se houve update_checkout por qualquer motivo, não force reset.
    // Só reseta se ainda estiver em loading (evita ficar com overlay eterno).
    if ($(SELECTOR).hasClass(CLS_LOADING)) resetCtas();
  });
})(window);

