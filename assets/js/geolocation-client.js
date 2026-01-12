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
      return safeJsonParse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeSessionCache(data) {
    try {
      if (!window.sessionStorage) return;
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) { }
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

  function fetchProxy(lat, lon) {
    var payload = {
      latitude: Number(lat).toFixed(6),
      longitude: Number(lon).toFixed(6),
      version: '1.0',
      event: 'geolocation',
    };

    var url = getRestUrl();
    log('fetch ->', url, payload);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (resp) {
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
    var cached = readSessionCache();
    if (!cached) return false;
    log('cache hit (sessionStorage)');
    persistContract(cached);
    return true;
  }

  function requestAndFetch() {
    // Garantir 1 chamada por sessão
    if (ensureDataFromSessionCache()) return Promise.resolve(readSessionCache());

    return requestCoords()
      .then(function (pos) {
        var lat = pos && pos.coords ? pos.coords.latitude : null;
        var lon = pos && pos.coords ? pos.coords.longitude : null;
        if (lat === null || lon === null) throw new Error('Coords inválidas.');
        return fetchProxy(lat, lon);
      })
      .then(function (data) {
        writeSessionCache(data);
        persistContract(data);
        return data;
      });
  }

  window.CTWPMLGeo = window.CTWPMLGeo || {};
  window.CTWPMLGeo.ensureSessionCache = ensureDataFromSessionCache;
  window.CTWPMLGeo.requestAndFetch = requestAndFetch;
  window.CTWPMLGeo.getRestUrl = getRestUrl;
})(window);



