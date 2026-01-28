(function (window) {
  'use strict';

  var PARAMS = window.CTWPMLGeoParams || {};
  var DEBUG = String(PARAMS.debug || '0') === '1';

  function log() {
    if (!DEBUG) return;
    try {
      // eslint-disable-next-line no-console
      console.log.apply(console, ['[CTWPML GEO]'].concat([].slice.call(arguments)));
    } catch (e) { }
  }

  function getRestUrl() {
    if (PARAMS && typeof PARAMS.rest_url === 'string' && PARAMS.rest_url) return PARAMS.rest_url;
    // fallback best-effort
    return (window.location.origin || '') + '/wp-json/geolocation/v1/send';
  }

  var CACHE_KEY = 'ctwpml_geo_freteData';
  var CACHE_TTL_MS = Number(PARAMS.cache_ttl_ms || (30 * 60 * 1000));
  if (!CACHE_TTL_MS || CACHE_TTL_MS < 0) CACHE_TTL_MS = 30 * 60 * 1000;
  var REQUEST_TIMEOUT_MS = Number(PARAMS.request_timeout_ms || 12000);
  if (!REQUEST_TIMEOUT_MS || REQUEST_TIMEOUT_MS < 0) REQUEST_TIMEOUT_MS = 12000;

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function readSessionCache() {
    try {
      if (!window.sessionStorage) return null;
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = safeJsonParse(raw);
      if (!parsed) return null;
      if (parsed && parsed.expires_at) {
        if (Date.now() > parsed.expires_at) {
          sessionStorage.removeItem(CACHE_KEY);
          return null;
        }
        return parsed;
      }
      // Compat: cache antigo sem metadata
      return { data: parsed, meta: { source: 'legacy' }, expires_at: 0 };
    } catch (e) {
      return null;
    }
  }

  function normalizeCachePayload(payload) {
    if (!payload) return null;
    if (payload && typeof payload === 'object' && typeof payload.data !== 'undefined') {
      return payload;
    }
    return { data: payload, meta: {}, storedAt: Date.now() };
  }

  function writeSessionCache(payload) {
    try {
      if (!window.sessionStorage) return;
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (e) { }
  }

  function getSessionCache() {
    return normalizeCachePayload(readSessionCache());
  }

  function persistContract(data) {
    // Telemetria: início da persistência de dados
    var telemetryStart = window.CCTelemetry ? window.CCTelemetry.start('1.5-hide-placeholders') : null;
    
    // CONTRATO: manter como no plugin antigo
    try {
      window.freteData = data;
    } catch (e) { }
    try {
      if (window.localStorage) localStorage.setItem('freteData', JSON.stringify(data));
    } catch (e) { }
    try {
      document.dispatchEvent(new CustomEvent('freteDataReady', { detail: data }));
    } catch (e) { }

    // Após persistir, marcar elementos como resolvidos
    try {
      var pending = document.querySelectorAll('.ctwpml-pending-value');
      var resolvedCount = 0;
      for (var i = 0; i < pending.length; i++) {
        pending[i].classList.add('ctwpml-resolved');
        resolvedCount++;
      }
      
      // Telemetria: elementos marcados como resolvidos
      if (window.CCTelemetry && telemetryStart) {
        window.CCTelemetry.end('1.5-hide-placeholders', telemetryStart, true, {
          pendingElementsFound: pending.length,
          resolvedCount: resolvedCount,
          hasData: !!data
        });
      }
      
      // Disparar evento customizado de resolução
      document.dispatchEvent(new CustomEvent('ctwpml_values_resolved', { detail: data }));
    } catch (e) {
      // Telemetria: erro ao marcar elementos
      if (window.CCTelemetry && telemetryStart) {
        window.CCTelemetry.end('1.5-hide-placeholders', telemetryStart, false, {
          error: e && e.message ? e.message : 'unknown_error'
        });
      }
    }
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = null;
    var timerId = null;
    var opts = options || {};
    var ms = typeof timeoutMs === 'number' ? timeoutMs : 12000;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      opts.signal = controller.signal;
      timerId = setTimeout(function () {
        try { controller.abort(); } catch (e) { }
      }, ms);
    }

    return fetch(url, opts).then(function (resp) {
      if (timerId) clearTimeout(timerId);
      if (!resp.ok) {
        return resp
          .json()
          .then(function (err) {
            throw new Error((err && err.message) || 'Erro no proxy geolocation');
          })
          .catch(function () {
            return resp.text().then(function (txt) {
              throw new Error(txt || 'Erro no proxy geolocation');
            });
          });
      }
      return resp.json();
    }).catch(function (err) {
      if (timerId) clearTimeout(timerId);
      throw err;
    });
  }

  function fetchProxy(payload) {
    var url = getRestUrl();
    log('fetch ->', url, payload);
    return fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, REQUEST_TIMEOUT_MS);
  }

  function fetchProxyGeo(lat, lon) {
    return fetchProxy({
      latitude: Number(lat).toFixed(6),
      longitude: Number(lon).toFixed(6),
      version: '1.0',
      event: 'geolocation',
    });
  }

  function fetchProxyCep(cep) {
    return fetchProxy({
      cep: String(cep || ''),
      version: '1.0',
      event: 'CEP',
    });
  }

  function requestCoords() {
    return new Promise(function (resolve, reject) {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocalização não suportada.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve(pos);
        },
        function (err) {
          reject(err || new Error('Falha ao obter localização.'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  function ensureDataFromSessionCache() {
    var cached = getSessionCache();
    if (!cached || !cached.data) return false;
    log('cache hit (sessionStorage)');
    persistContract(cached.data);
    return true;
  }

  function requestAndFetch() {
    // Garantir 1 chamada por sessão
    if (ensureDataFromSessionCache()) return Promise.resolve(getSessionCache());

    return requestCoords()
      .then(function (pos) {
        var lat = pos && pos.coords ? pos.coords.latitude : null;
        var lon = pos && pos.coords ? pos.coords.longitude : null;
        if (lat === null || lon === null) throw new Error('Coords inválidas.');
        return fetchProxyGeo(lat, lon);
      })
      .then(function (data) {
        var payload = { data: data, meta: { event: 'geolocation' }, storedAt: Date.now() };
        writeSessionCache(payload);
        persistContract(data);
        return payload;
      });
  }

  function getCepRestUrl() {
    try {
      var cepParams = window.CTWPMLCepParams || {};
      if (cepParams && typeof cepParams.rest_url === 'string' && cepParams.rest_url) {
        return cepParams.rest_url;
      }
    } catch (e) { }
    return getRestUrl();
  }

  function fetchProxyByCep(cep) {
    var payload = {
      cep: String(cep || ''),
      version: '1.0',
      event: 'cep',
    };

    var url = getCepRestUrl();
    log('fetch(cep) ->', url, payload);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (resp) {
      if (!resp.ok) {
        return resp
          .json()
          .then(function (err) {
            throw new Error((err && err.message) || 'Erro no proxy CEP');
          })
          .catch(function () {
            return resp.text().then(function (txt) {
              throw new Error(txt || 'Erro no proxy CEP');
            });
          });
      }
      return resp.json();
    });
  }

  function requestAndFetchByCep(cep) {
    var clean = String(cep || '').replace(/\D/g, '').slice(0, 8);
    if (clean.length !== 8) return Promise.reject(new Error('CEP inválido.'));

    var cached = getSessionCache();
    if (cached && cached.meta && cached.meta.cep === clean && cached.data) {
      persistContract(cached.data);
      return Promise.resolve(cached);
    }

    return fetchProxyByCep(clean).then(function (data) {
      var payload = { data: data, meta: { event: 'cep', cep: clean }, storedAt: Date.now() };
      writeSessionCache(payload);
      persistContract(data);
      return payload;
    });
  }

  window.CTWPMLGeo = window.CTWPMLGeo || {};
  window.CTWPMLGeo.ensureSessionCache = ensureDataFromSessionCache;
  window.CTWPMLGeo.requestAndFetch = requestAndFetch;
  window.CTWPMLGeo.requestAndFetchByCep = requestAndFetchByCep;
  window.CTWPMLGeo.getSessionCache = getSessionCache;
  window.CTWPMLGeo.getRestUrl = getRestUrl;
})(window);



