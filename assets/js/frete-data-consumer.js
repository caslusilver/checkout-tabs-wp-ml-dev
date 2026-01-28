/* eslint-disable no-console */
(function (window) {
  'use strict';

  var SESSION_KEY = 'ctwpml_geo_freteData';
  var LOCAL_KEY = 'freteData';

  function safeJsonParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function readSessionCache() {
    try {
      if (!window.sessionStorage) return null;
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = safeJsonParse(raw);
      if (!parsed) return null;
      if (parsed && parsed.expires_at && Date.now() > parsed.expires_at) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      // Compat: cache antigo
      if (parsed && parsed.data) return parsed.data;
      return parsed;
    } catch (e0) {
      return null;
    }
  }

  function readLocalFreteData() {
    try {
      if (!window.localStorage) return null;
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      return safeJsonParse(raw);
    } catch (e0) {
      return null;
    }
  }

  function cssEscape(s) {
    try {
      if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s));
    } catch (e) { }
    // fallback simples: remove caracteres perigosos
    return String(s).replace(/[^a-zA-Z0-9_\-]/g, '');
  }

  function fillDynamicSpans(data) {
    if (!data || typeof data !== 'object') return;
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = data[k];
      if (v === null || typeof v === 'undefined') continue;
      if (typeof v === 'object') continue; // preserva payload, não serializa objetos
      var sel = '.' + cssEscape(k);
      var nodes = null;
      try { nodes = document.querySelectorAll(sel); } catch (e0) { nodes = null; }
      if (!nodes || !nodes.length) continue;
      for (var j = 0; j < nodes.length; j++) {
        try { nodes[j].textContent = String(v); } catch (e1) { }
      }
    }
  }

  function publish(data, source) {
    if (!data || typeof data !== 'object') return;
    try { window.freteData = data; } catch (e0) { }
    // Não regrava localStorage aqui para não estender TTL indevidamente; apenas reaplica.
    try { document.dispatchEvent(new CustomEvent('freteDataReady', { detail: data })); } catch (e1) { }
    fillDynamicSpans(data);
    try { document.dispatchEvent(new CustomEvent('ctwpml_values_resolved', { detail: data })); } catch (e2) { }
    // DEBUG leve (sem spam)
    try {
      if (window.cc_params && window.cc_params.debug) {
        console.log('[CTWPML][FRETE_CONSUMER] applied source=' + String(source || 'unknown'));
      }
    } catch (e3) { }
  }

  // Reaplicar sempre que uma consulta ocorrer (CEP ou geo), sem alterar payload.
  document.addEventListener('freteDataReady', function (e) {
    try { fillDynamicSpans(e && e.detail ? e.detail : null); } catch (_) { }
  });

  function boot() {
    // NÃO consulta API. Apenas reaproveita dados existentes.
    var fromSession = readSessionCache();
    if (fromSession) {
      publish(fromSession, 'session');
      return;
    }
    var fromLocal = readLocalFreteData();
    if (fromLocal) {
      publish(fromLocal, 'localStorage');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

