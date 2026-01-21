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
    var n = null;
    try {
      if (typeof value === 'number') n = value;
      else if (typeof value === 'string') {
        var s = value.replace(',', '.').replace(/[^\d.]/g, '');
        n = s ? parseFloat(s) : null;
      }
    } catch (e) { n = null; }
    if (n === null || isNaN(n)) return '';
    try {
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (e0) {
      return 'R$ ' + String(n.toFixed(2)).replace('.', ',');
    }
  }

  function buildMethods(data) {
    var out = [];
    if (!data || typeof data !== 'object') return out;

    function add(kind, label, ctxKey, priceKey, prazoKey, extra) {
      var ctx = (data && data[ctxKey] != null) ? String(data[ctxKey]) : '';
      var priceRaw = (data && data[priceKey] != null) ? data[priceKey] : '';
      var prazoRaw = (data && data[prazoKey] != null) ? data[prazoKey] : '';
      if (!ctx && (priceRaw === '' || priceRaw === null) && !prazoRaw && !extra) return;
      out.push({
        kind: kind,
        label: label,
        context: ctx,
        priceText: formatBRL(priceRaw) || (priceRaw !== '' ? String(priceRaw) : ''),
        prazoText: prazoRaw ? String(prazoRaw) : (extra && extra.prazoText ? String(extra.prazoText) : ''),
      });
    }

    // Motoboy
    var motoboyPrazo = data.prazo_motoboy || (data.freteMotoboy && data.freteMotoboy.prazo) || '';
    var motoboyPrice = data.preco_motoboy || (data.freteMotoboy && data.freteMotoboy.valor) || '';
    add('motoboy', 'Motoboy', 'motoboy_ch', 'preco_motoboy', 'prazo_motoboy', { prazoText: motoboyPrazo, priceRaw: motoboyPrice });
    // Sedex
    var sedexPrazo = '';
    if (data.prazo_sedex_1 && data.prazo_sedex_2) sedexPrazo = String(data.prazo_sedex_1) + ' a ' + String(data.prazo_sedex_2);
    else sedexPrazo = data.prazo_sedex || '';
    add('sedex', 'Sedex', 'sedex_ch', 'preco_sedex', 'prazo_sedex', { prazoText: sedexPrazo });
    // PAC Mini
    var pacPrazo = data.prazo_pacmini || data.prazo_pac || '';
    add('pacmini', 'PAC Mini', 'pacmini_ch', 'preco_pac', 'prazo_pacmini', { prazoText: pacPrazo });

    // Dedup simples por kind
    var seen = {};
    var uniq = [];
    for (var i = 0; i < out.length; i++) {
      if (seen[out[i].kind]) continue;
      seen[out[i].kind] = true;
      uniq.push(out[i]);
    }
    return uniq;
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
    var html = '';
    if (methods && methods.length) {
      for (var i = 0; i < methods.length; i++) {
        var m = methods[i];
        html += '<div class="ctwpml-cep-method">';
        html += '  <div class="ctwpml-cep-method-top">';
        html += '    <strong class="ctwpml-cep-method-name">' + String(m.label || '') + '</strong>';
        if (m.priceText) html += '    <span class="ctwpml-cep-method-price">' + String(m.priceText) + '</span>';
        html += '  </div>';
        if (m.prazoText) html += '  <div class="ctwpml-cep-method-prazo">' + String(m.prazoText) + '</div>';
        if (m.context) html += '  <div class="ctwpml-cep-method-context">' + String(m.context) + '</div>';
        html += '</div>';
      }
    } else {
      html = '<div class="ctwpml-cep-result-empty">Nenhuma opcao de frete disponivel para este CEP.</div>';
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
        // Regra: nunca abrir pop-up. Fallback voluntário: pedir geolocalização nativa direto.
        if (window.CTWPMLGeo && typeof window.CTWPMLGeo.requestAndFetch === 'function') {
          window.CTWPMLGeo.requestAndFetch().catch(function () { });
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
