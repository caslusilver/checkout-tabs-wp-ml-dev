/* eslint-disable no-console */
(function (window) {
  'use strict';

  var PARAMS = window.CTWPMLCepParams || {};
  var DEBUG = String(PARAMS.debug || '0') === '1';
  var ICON_URL = PARAMS.icon_url || '';
  var DEFAULT_TIMEOUT_MS = Number(PARAMS.request_timeout_ms || 12000);

  function log(msg, data) {
    if (!DEBUG) return;
    try {
      var st = window.CCCheckoutTabsState;
      if (st && typeof st.log === 'function') {
        st.log('CEP       ' + msg, data || {}, 'UI');
        return;
      }
    } catch (e) { }
    try {
      if (data) console.log('[CTWPML CEP] ' + msg, data);
      else console.log('[CTWPML CEP] ' + msg);
    } catch (e0) { }
  }

  function normalizeCep(cep) {
    return String(cep || '').replace(/\D/g, '').slice(0, 8);
  }

  function isValidCep(cep) {
    return typeof cep === 'string' && cep.length === 8;
  }

  function getSessionCache() {
    try {
      if (window.CTWPMLGeo && typeof window.CTWPMLGeo.getSessionCache === 'function') {
        return window.CTWPMLGeo.getSessionCache();
      }
    } catch (e) { }
    return null;
  }

  function extractValues(data) {
    var out = { shipping: '', deadline: '' };
    if (!data || typeof data !== 'object') return out;

    var candidatesShipping = [
      'frete', 'valor_frete', 'preco_frete', 'shipping', 'price', 'valor', 'preco', 'valor_total_frete'
    ];
    var candidatesDeadline = [
      'prazo', 'prazo_entrega', 'prazo_dias', 'prazo_entrega_dias', 'delivery', 'delivery_time', 'delivery_days', 'entrega'
    ];

    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== '') {
          return obj[key];
        }
      }
      return '';
    }

    var rawShipping = pick(data, candidatesShipping);
    var rawDeadline = pick(data, candidatesDeadline);

    if (!rawShipping && data.frete && typeof data.frete === 'object') {
      rawShipping = pick(data.frete, ['valor', 'preco', 'price']);
    }
    if (!rawDeadline && data.prazo && typeof data.prazo === 'object') {
      rawDeadline = pick(data.prazo, ['dias', 'valor', 'min', 'max']);
    }

    out.shipping = rawShipping !== '' ? String(rawShipping) : '';
    out.deadline = rawDeadline !== '' ? String(rawDeadline) : '';
    return out;
  }

  function setButtonState($btn, loading) {
    if (!$btn) return;
    if (loading) {
      $btn.setAttribute('disabled', 'disabled');
      $btn.classList.add('is-loading');
      $btn.classList.add('is-disabled');
      var loadingText = $btn.getAttribute('data-loading-text');
      if (loadingText) $btn.querySelector('.ctwpml-cep-button-text').textContent = loadingText;
    } else {
      $btn.removeAttribute('disabled');
      $btn.classList.remove('is-loading');
      $btn.classList.remove('is-disabled');
      var originalText = $btn.getAttribute('data-original-text');
      if (originalText) $btn.querySelector('.ctwpml-cep-button-text').textContent = originalText;
    }
  }

  function setError($form, msg) {
    if (!$form) return;
    var el = $form.querySelector('.ctwpml-cep-error');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function renderResults($form, data) {
    if (!$form) return;
    var el = $form.querySelector('.ctwpml-cep-results');
    if (!el) return;
    var values = extractValues(data);
    var html = '';
    if (values.shipping) {
      html += '<div class="ctwpml-cep-result"><span>Frete</span><strong>' + values.shipping + '</strong></div>';
    }
    if (values.deadline) {
      html += '<div class="ctwpml-cep-result"><span>Prazo</span><strong>' + values.deadline + '</strong></div>';
    }
    if (!html) {
      html = '<div class="ctwpml-cep-result-empty">Resposta recebida, mas sem valores reconheciveis.</div>';
    }
    el.innerHTML = html;
    el.style.display = 'block';
  }

  function bindFallbackLink($root) {
    if (!$root) return;
    var link = $root.querySelector('[data-ctwpml-cep-fallback]');
    if (!link) return;
    if (link.getAttribute('data-ctwpml-bound') === '1') return;
    link.setAttribute('data-ctwpml-bound', '1');
    link.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        if (window.CTWPMLGeoPrompt && typeof window.CTWPMLGeoPrompt.open === 'function') {
          window.CTWPMLGeoPrompt.open();
        }
      } catch (e0) { }
    });
  }

  function requestCep($form, cep) {
    var clean = normalizeCep(cep);
    if (!isValidCep(clean)) {
      setError($form, 'Informe um CEP valido (8 digitos).');
      return Promise.reject(new Error('CEP invalido'));
    }

    setError($form, '');
    var button = $form.querySelector('[data-ctwpml-cep-submit]');
    setButtonState(button, true);
    var t0 = Date.now();

    log('Envio de CEP', { cep: clean });

    if (!window.CTWPMLGeo || typeof window.CTWPMLGeo.requestAndFetchByCep !== 'function') {
      setButtonState(button, false);
      setError($form, 'Servico indisponivel. Tente novamente.');
      return Promise.reject(new Error('CTWPMLGeo indisponivel'));
    }

    var timeoutId = null;
    var timeoutMs = DEFAULT_TIMEOUT_MS;
    var timedOut = false;

    var timeoutPromise = new Promise(function (_, reject) {
      timeoutId = setTimeout(function () {
        timedOut = true;
        reject(new Error('timeout'));
      }, timeoutMs);
    });

    return Promise.race([
      window.CTWPMLGeo.requestAndFetchByCep(clean),
      timeoutPromise
    ])
      .then(function (data) {
        if (timeoutId) clearTimeout(timeoutId);
        renderResults($form, data);
        log('Resposta da API', data);
        log('Resposta do CEP', { ms: Date.now() - t0 });
        return data;
      })
      .catch(function (err) {
        if (timeoutId) clearTimeout(timeoutId);
        var msg = timedOut ? 'Tempo esgotado. Tente novamente.' : 'Nao foi possivel consultar o CEP.';
        setError($form, msg);
        log('Erro no CEP', { error: err && err.message ? err.message : String(err), ms: Date.now() - t0 });
        throw err;
      })
      .finally(function () {
        setButtonState(button, false);
      });
  }

  function bindForm($form) {
    if (!$form || $form.getAttribute('data-ctwpml-bound') === '1') return;
    $form.setAttribute('data-ctwpml-bound', '1');

    var input = $form.querySelector('[data-ctwpml-cep-input]');
    var button = $form.querySelector('[data-ctwpml-cep-submit]');
    if (!input || !button) return;

    if (ICON_URL) {
      var iconEl = $form.querySelector('.ctwpml-cep-button-icon img');
      if (iconEl) iconEl.src = ICON_URL;
    }

    button.setAttribute('data-original-text', button.querySelector('.ctwpml-cep-button-text').textContent || 'Consultar frete');
    button.setAttribute('data-loading-text', 'Consultando...');

    input.addEventListener('input', function () {
      var clean = normalizeCep(input.value);
      input.value = clean;
    });

    $form.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($form.__ctwpmlSubmitting) return;
      $form.__ctwpmlSubmitting = true;
      requestCep($form, input.value)
        .catch(function () { })
        .finally(function () {
          $form.__ctwpmlSubmitting = false;
        });
    });

    // Mostrar cache quando existir
    var cached = getSessionCache();
    if (cached && cached.data) {
      if (cached.meta && cached.meta.cep && !input.value) {
        input.value = cached.meta.cep;
      }
      renderResults($form, cached.data);
    }

    bindFallbackLink($form);
  }

  function ensureModal() {
    var overlay = document.getElementById('ctwpml-cep-modal-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'ctwpml-cep-modal-overlay';
    overlay.innerHTML =
      '' +
      '<div id="ctwpml-cep-modal" role="dialog" aria-modal="true" aria-label="Consulta de CEP">' +
      '  <h2 id="ctwpml-cep-modal-title">Consulte o frete pelo CEP</h2>' +
      '  <form class="ctwpml-cep-form" data-ctwpml-cep-form="1">' +
      '    <div class="ctwpml-cep-row">' +
      '      <input class="ctwpml-cep-input" data-ctwpml-cep-input="1" type="text" inputmode="numeric" placeholder="Digite aqui seu CEP" maxlength="8" pattern="[0-9]*" />' +
      '      <button type="submit" class="ctwpml-cep-button" data-ctwpml-cep-submit="1">' +
      '        <span class="ctwpml-cep-button-icon">' + (ICON_URL ? '<img src="' + ICON_URL + '" alt="" />' : '') + '</span>' +
      '        <span class="ctwpml-cep-button-text">Consultar frete</span>' +
      '        <span class="ctwpml-cep-spinner" aria-hidden="true"></span>' +
      '      </button>' +
      '    </div>' +
      '    <div class="ctwpml-cep-error" role="alert" aria-live="polite"></div>' +
      '    <div class="ctwpml-cep-results" aria-live="polite"></div>' +
      '    <a href="#" class="ctwpml-cep-fallback" data-ctwpml-cep-fallback="1">Nao sabe seu CEP?</a>' +
      '  </form>' +
      '</div>';

    document.body.appendChild(overlay);
    bindForm(overlay.querySelector('.ctwpml-cep-form'));
    return overlay;
  }

  function openModal() {
    var overlay = ensureModal();
    if (!overlay) return;
    overlay.style.display = 'flex';
    try {
      var input = overlay.querySelector('[data-ctwpml-cep-input]');
      if (input) input.focus();
    } catch (e) { }
  }

  function closeModal() {
    var overlay = document.getElementById('ctwpml-cep-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  function bindAll() {
    var forms = document.querySelectorAll('[data-ctwpml-cep-form]');
    for (var i = 0; i < forms.length; i++) {
      bindForm(forms[i]);
    }
  }

  window.CTWPMLCepForm = window.CTWPMLCepForm || {};
  window.CTWPMLCepForm.bindAll = bindAll;
  window.CTWPMLCepForm.openModal = openModal;
  window.CTWPMLCepForm.closeModal = closeModal;
  window.CTWPMLCepForm.requestCep = requestCep;
  window.CTWPMLCepForm.normalizeCep = normalizeCep;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindAll();
    });
  } else {
    bindAll();
  }
})(window);
