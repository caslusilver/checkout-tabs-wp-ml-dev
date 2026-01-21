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

  function formatBRL(value) {
    try {
      var n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
      if (!isFinite(n)) return String(value);
      return 'R$ ' + n.toFixed(2).replace('.', ',');
    } catch (e) {
      return String(value);
    }
  }

  function pickFirst(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== null && obj[k] !== '') {
        return obj[k];
      }
    }
    return '';
  }

  function getRawFromResponse(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.raw && typeof data.raw === 'object') return data.raw;
    return data;
  }

  function buildMethods(data) {
    var raw = getRawFromResponse(data);
    if (!raw || typeof raw !== 'object') return [];

    var defs = [
      { type: 'motoboy', labelKey: 'motoboy_ch', priceKey: 'preco_motoboy', deadlineKeys: ['prazo_motoboy'] },
      { type: 'sedex', labelKey: 'sedex_ch', priceKey: 'preco_sedex', deadlineKeys: ['prazo_sedex', 'prazo_sedex_1', 'prazo_sedex_2'] },
      { type: 'pacmini', labelKey: 'pacmini_ch', priceKey: 'preco_pac', deadlineKeys: ['prazo_pacmini', 'prazo_pac'] }
    ];

    var out = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var label = String(raw[d.labelKey] || '').trim();
      if (!label) continue; // regra: se *_ch vazio, ocultar

      var priceRaw = raw[d.priceKey];
      var priceText = '';
      if (priceRaw !== null && typeof priceRaw !== 'undefined' && String(priceRaw).trim() !== '') {
        priceText = String(priceRaw);
        if (priceText.indexOf('R$') === -1) {
          var n = Number(String(priceRaw).replace(',', '.').replace(/[^\d.]/g, ''));
          if (isFinite(n)) priceText = formatBRL(n);
        }
      }

      var deadlineRaw = pickFirst(raw, d.deadlineKeys);
      var deadlineText = '';
      if (deadlineRaw !== null && typeof deadlineRaw !== 'undefined' && String(deadlineRaw).trim() !== '') {
        deadlineText = String(deadlineRaw);
      }

      out.push({ type: d.type, label: label, priceText: priceText, deadlineText: deadlineText });
    }

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
    var methods = buildMethods(data);
    if (methods && methods.length) {
      var html2 = '<div class="ctwpml-cep-methods">';
      for (var i = 0; i < methods.length; i++) {
        var m = methods[i];
        html2 += '' +
          '<div class="ctwpml-cep-method ctwpml-cep-method--' + m.type + '">' +
          '  <div class="ctwpml-cep-method-top">' +
          '    <strong class="ctwpml-cep-method-name">' + m.label + '</strong>' +
          (m.priceText ? ('<span class="ctwpml-cep-method-price">' + m.priceText + '</span>') : '') +
          '  </div>' +
          (m.deadlineText ? ('<div class="ctwpml-cep-method-bottom"><span class="ctwpml-cep-method-deadline">Prazo: <strong>' + m.deadlineText + '</strong></span></div>') : '') +
          '</div>';
      }
      html2 += '</div>';
      el.innerHTML = html2;
      el.style.display = 'block';
      return;
    }

    // Fallback compat: render simples de valores genéricos (sem quebrar payload/contrato)
    var values = extractValues(data);
    var html = '';
    if (values.shipping) html += '<div class="ctwpml-cep-result"><span>Frete</span><strong>' + values.shipping + '</strong></div>';
    if (values.deadline) html += '<div class="ctwpml-cep-result"><span>Prazo</span><strong>' + values.deadline + '</strong></div>';
    if (!html) html = '<div class="ctwpml-cep-result-empty">Resposta recebida, mas sem valores reconheciveis.</div>';
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
      var t0 = Date.now();
      setError($root, '');

      var button = $root.querySelector('[data-ctwpml-cep-submit]');
      setButtonState(button, true);

      try {
        if (!window.CTWPMLGeo || typeof window.CTWPMLGeo.requestAndFetch !== 'function') {
          setError($root, 'Servico indisponivel. Tente novamente.');
          return;
        }
      } catch (e0) {
        setError($root, 'Servico indisponivel. Tente novamente.');
        return;
      }

      var timeoutId = null;
      var timedOut = false;
      var timeoutMs = DEFAULT_TIMEOUT_MS;
      var timeoutPromise = new Promise(function (_, reject) {
        timeoutId = setTimeout(function () {
          timedOut = true;
          reject(new Error('timeout'));
        }, timeoutMs);
      });

      Promise.race([window.CTWPMLGeo.requestAndFetch(), timeoutPromise])
        .then(function (data) {
          if (timeoutId) clearTimeout(timeoutId);
          renderResults($root, data);
          log('Fallback GEO OK', { ms: Date.now() - t0 });
        })
        .catch(function (err) {
          if (timeoutId) clearTimeout(timeoutId);
          var msg = timedOut ? 'Tempo esgotado. Tente novamente.' : 'Nao foi possivel obter a localizacao.';
          setError($root, msg);
          log('Fallback GEO erro', { error: err && err.message ? err.message : String(err), ms: Date.now() - t0 });
        })
        .finally(function () {
          setButtonState(button, false);
        });
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

  function bindAll() {
    var forms = document.querySelectorAll('[data-ctwpml-cep-form]');
    for (var i = 0; i < forms.length; i++) {
      bindForm(forms[i]);
    }
  }

  window.CTWPMLCepForm = window.CTWPMLCepForm || {};
  window.CTWPMLCepForm.bindAll = bindAll;
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
