/* eslint-disable no-console */
(function (window) {
  'use strict';

  var PARAMS = window.CTWPMLCepParams || {};
  var DEBUG = String(PARAMS.debug || '0') === '1';
  var ICON_URL = PARAMS.icon_url || '';
  var DEFAULT_TIMEOUT_MS = Number(PARAMS.request_timeout_ms || 12000);
  var GEO_ENABLED = String(PARAMS.geo_enabled || '1') === '1';

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

  function formatCepMask(cep) {
    var digits = normalizeCep(cep);
    if (digits.length <= 5) return digits;
    return digits.slice(0, 5) + '-' + digits.slice(5);
  }

  function isValidCep(cep) {
    return normalizeCep(cep).length === 8;
  }

  function getSessionCache() {
    try {
      if (window.CTWPMLGeo && typeof window.CTWPMLGeo.getSessionCache === 'function') {
        return window.CTWPMLGeo.getSessionCache();
      }
    } catch (e) { }
    return null;
  }

  function normalizeApiResponse(data) {
    if (data && data.data) data = data.data;
    // O webhook pode retornar array com 1 item. Manter compatibilidade.
    if (Array.isArray(data)) return data.length ? data[0] : null;
    if (data && typeof data === 'object') return data;
    return null;
  }

  function getRawFromResponse(data) {
    var normalized = normalizeApiResponse(data);
    if (!normalized || typeof normalized !== 'object') return null;
    if (normalized.raw && typeof normalized.raw === 'object') return normalized.raw;
    return normalized;
  }

  function isNonEmpty(val) {
    return val !== null && typeof val !== 'undefined' && String(val).trim() !== '';
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

  function pickFirstKey(raw, keys) {
    if (!raw || typeof raw !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(raw, k) && isNonEmpty(raw[k])) {
        return raw[k];
      }
    }
    return '';
  }

  function formatRange(a, b) {
    var v1 = isNonEmpty(a) ? String(a).trim() : '';
    var v2 = isNonEmpty(b) ? String(b).trim() : '';
    if (v1 && v2) return v1 + ' a ' + v2;
    return v1 || v2 || '';
  }

  function formatPrazo(value, unit) {
    var raw = isNonEmpty(value) ? String(value).trim() : '';
    if (!raw) return '';
    if (/[a-zA-Z]/.test(raw)) return raw;
    var num = Number(String(raw).replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isFinite(num)) return raw;
    if (unit === 'min') return num + (num === 1 ? ' minuto' : ' minutos');
    return num + (num === 1 ? ' dia' : ' dias');
  }

  function buildMethods(data) {
    var raw = getRawFromResponse(data);
    if (!raw || typeof raw !== 'object') return [];

    function buildPriceText(priceRaw) {
      if (!isNonEmpty(priceRaw)) return '';
      var txt = String(priceRaw).trim();
      if (txt.indexOf('R$') !== -1) return txt;
      var n = Number(txt.replace(',', '.').replace(/[^\d.]/g, ''));
      return isFinite(n) ? formatBRL(n) : txt;
    }

    function buildMotoboy() {
      var label = String(raw.motoboy_ch || '').trim();
      if (!label) return null;
      var priceRaw = isNonEmpty(raw.preco_motoboy) ? raw.preco_motoboy
        : (raw.freteMotoboy && isNonEmpty(raw.freteMotoboy.valor) ? raw.freteMotoboy.valor : raw.motoboy_pro);
      var deadlineRaw = isNonEmpty(raw.prazo_motoboy) ? raw.prazo_motoboy
        : (raw.freteMotoboy && isNonEmpty(raw.freteMotoboy.prazo) ? raw.freteMotoboy.prazo : '');
      return { type: 'motoboy', label: label, priceText: buildPriceText(priceRaw), deadlineText: formatPrazo(deadlineRaw, 'min') };
    }

    function buildSedex() {
      var label = String(raw.sedex_ch || '').trim();
      if (!label) return null;
      var priceRaw = isNonEmpty(raw.preco_sedex) ? raw.preco_sedex
        : (raw.freteSedex && isNonEmpty(raw.freteSedex.valor) ? raw.freteSedex.valor : raw.sedex_pro);
      var deadlineRaw = (raw.freteSedex && isNonEmpty(raw.freteSedex.prazo)) ? raw.freteSedex.prazo : raw.prazo_sedex;
      return { type: 'sedex', label: label, priceText: buildPriceText(priceRaw), deadlineText: formatPrazo(deadlineRaw, 'dia') };
    }

    function buildPacmini() {
      var label = String(raw.pacmini_ch || '').trim();
      if (!label) return null;
      var priceRaw = isNonEmpty(raw.preco_pac) ? raw.preco_pac
        : (raw.fretePACMini && isNonEmpty(raw.fretePACMini.valor) ? raw.fretePACMini.valor : raw.pacmini_pro);
      var legacy = pickFirstKey(raw, ['prazo_pacmini', 'prazo_pac']);
      var deadlineRaw = (raw.fretePACMini && isNonEmpty(raw.fretePACMini.prazo)) ? raw.fretePACMini.prazo : legacy;
      return { type: 'pacmini', label: label, priceText: buildPriceText(priceRaw), deadlineText: formatPrazo(deadlineRaw, 'dia') };
    }

    var out = [];
    var m1 = buildMotoboy();
    var m2 = buildSedex();
    var m3 = buildPacmini();
    if (m1) out.push(m1);
    if (m2) out.push(m2);
    if (m3) out.push(m3);
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
      var html2 = '' +
        '<div class="ctwpml-cep-table-wrapper">' +
        '<table class="ctwpml-cep-table" role="table">' +
        '  <thead>' +
        '    <tr>' +
        '      <th>Método</th>' +
        '      <th>Prazo</th>' +
        '      <th>Preço</th>' +
        '    </tr>' +
        '  </thead>' +
        '  <tbody>';
      for (var i = 0; i < methods.length; i++) {
        var m = methods[i];
        html2 += '' +
          '<tr class="ctwpml-cep-row-method ctwpml-cep-row-method--' + m.type + '">' +
          '  <td>' + m.label + '</td>' +
          '  <td>' + (m.deadlineText || '—') + '</td>' +
          '  <td>' + (m.priceText || '—') + '</td>' +
          '</tr>';
      }
      html2 += '' +
        '  </tbody>' +
        '</table>' +
        '</div>';
      el.innerHTML = html2;
      el.style.display = 'block';
      return;
    }

    el.innerHTML = '<div class="ctwpml-cep-result-empty">Resposta recebida, mas sem fretes disponíveis.</div>';
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
      // Se popup estiver desativado, não abrir nada.
      if (!GEO_ENABLED) return;
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
    button.setAttribute('data-loading-text', 'Calculando...');

    function syncCepInput() {
      var masked = formatCepMask(input.value);
      if (input.value !== masked) input.value = masked;
      var enabled = isValidCep(input.value);
      button.disabled = !enabled;
      if (enabled) button.classList.remove('is-disabled');
      else button.classList.add('is-disabled');
    }

    input.addEventListener('input', function () {
      syncCepInput();
    });

    $form.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($form.__ctwpmlSubmitting) return;
      if (!isValidCep(input.value)) {
        setError($form, 'Informe um CEP valido.');
        return;
      }
      $form.__ctwpmlSubmitting = true;
      requestCep($form, input.value)
        .catch(function () { })
        .finally(function () {
          $form.__ctwpmlSubmitting = false;
          syncCepInput();
        });
    });

    // Mostrar cache quando existir
    var cached = getSessionCache();
    if (cached && cached.data) {
      if (cached.meta && cached.meta.cep && !input.value) {
        input.value = formatCepMask(cached.meta.cep);
      }
      renderResults($form, cached.data);
    }

    bindFallbackLink($form);
    syncCepInput();
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
