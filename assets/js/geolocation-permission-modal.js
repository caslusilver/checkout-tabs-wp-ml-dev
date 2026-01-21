(function (window) {
  'use strict';

  var PARAMS = window.CTWPMLGeoParams || {};
  var GEO = window.CTWPMLGeo || {};
  var PROMPT_SHOWN_KEY = 'ctwpml_geo_prompt_shown';
  var GEO_ENABLED = String(PARAMS.geo_enabled || '1') === '1';
  var DEBUG_GEO = String(PARAMS.debug || '0') === '1';

  function geoLog(msg, data) {
    if (!DEBUG_GEO) return;
    try {
      var prefix = '[CTWPML GEO DEBUG] ';
      if (data) console.log(prefix + msg, data);
      else console.log(prefix + msg);
    } catch (e) { }
  }

  function safeSessionGet(key) {
    try {
      if (!window.sessionStorage) return null;
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSessionSet(key, val) {
    try {
      if (!window.sessionStorage) return;
      sessionStorage.setItem(key, String(val));
    } catch (e) { }
  }

  function createModalIfMissing() {
    if (document.getElementById('ctwpml-geo-modal-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'ctwpml-geo-modal-overlay';
    overlay.innerHTML =
      '' +
      '<div id="ctwpml-geo-modal" role="dialog" aria-modal="true" aria-label="Permissão de localização">' +
      '  <h2 id="ctwpml-geo-modal-title">Você confirma ter mais de 18 anos?</h2>' +
      '  <div class="ctwpml-geo-benefits">' +
      '    <p class="ctwpml-geo-benefit-text">🔞 Este site é destinado exclusivamente a maiores de idade.</p>' +
      '  </div>' +
      '  <button id="ctwpml-geo-allow" type="button">Confirmo ser MAIOR de 18 anos</button>' +
      '  <button id="ctwpml-geo-later" type="button">Sou MENOR de 18 anos</button>' +
      '  <small id="ctwpml-geo-fineprint">Ao confirmar, você autoriza o uso da sua localização em tempo real para exibir preços e prazos de entrega mais precisos conforme sua região.</small>' +
      '  <div id="ctwpml-geo-status" aria-live="polite"></div>' +
      '</div>';

    document.body.appendChild(overlay);
  }

  function showModal() {
    createModalIfMissing();
    var overlay = document.getElementById('ctwpml-geo-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
  }

  function closeModal() {
    var overlay = document.getElementById('ctwpml-geo-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  function setStatus(msg, isLoading) {
    var el = document.getElementById('ctwpml-geo-status');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = '<span class="ctwpml-geo-loading-text">' +
        (msg || 'Carregando') +
        '<span class="ctwpml-dots"></span></span>';
    } else {
      el.textContent = msg || '';
    }
  }

  function setButtonsDisabled(disabled) {
    var a = document.getElementById('ctwpml-geo-allow');
    var b = document.getElementById('ctwpml-geo-later');
    if (a) a.disabled = !!disabled;
    if (b) b.disabled = !!disabled;
  }

  function bindEventsOnce() {
    createModalIfMissing();

    var allowBtn = document.getElementById('ctwpml-geo-allow');
    var laterBtn = document.getElementById('ctwpml-geo-later');
    if (!allowBtn || !laterBtn) return;

    if (allowBtn.getAttribute('data-ctwpml-bound') === '1') return;
    allowBtn.setAttribute('data-ctwpml-bound', '1');

    allowBtn.addEventListener('click', function () {
      // Telemetria: início da solicitação de geolocalização
      var telemetryStart = window.CCTelemetry ? window.CCTelemetry.start('1.2-geolocation-animation') : null;
      
      setButtonsDisabled(true);
      setStatus('Ativando localização', true);
      
      // Telemetria: animação iniciada
      if (window.CCTelemetry) {
        window.CCTelemetry.track('1.2-geolocation-animation', 'animation-start', {
          timestamp: Date.now()
        });
      }

      Promise.resolve()
        .then(function () {
          if (typeof GEO.requestAndFetch !== 'function') throw new Error('Cliente de geolocalização não carregou.');
          return GEO.requestAndFetch();
        })
        .then(function (data) {
          // Telemetria: geolocalização obtida com sucesso
          if (window.CCTelemetry && telemetryStart) {
            window.CCTelemetry.end('1.2-geolocation-animation', telemetryStart, true, {
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : []
            });
          }
          
          setStatus('');
          closeModal();
        })
        .catch(function (err) {
          // Telemetria: erro ao obter geolocalização
          if (window.CCTelemetry && telemetryStart) {
            window.CCTelemetry.end('1.2-geolocation-animation', telemetryStart, false, {
              error: err && err.message ? err.message : 'unknown_error'
            });
          }
          
          var msg = (err && err.message) || 'Não foi possível obter sua localização.';
          setStatus(msg);
          setButtonsDisabled(false);
        });
    });

    laterBtn.addEventListener('click', function () {
      closeModal();
    });
  }

  window.CTWPMLGeoPrompt = window.CTWPMLGeoPrompt || {};
  window.CTWPMLGeoPrompt.open = function () {
    // Quando a feature estiver desativada no admin, nenhum popup deve aparecer.
    if (!GEO_ENABLED) return;
    bindEventsOnce();
    showModal();
  };
  function shouldShowModalViaPermissionsApi() {
    geoLog('Verificando permissions API...');

    if (!navigator || !navigator.permissions || !navigator.permissions.query) {
      geoLog('Permissions API não disponível, retornando true');
      return Promise.resolve(true);
    }
    return navigator.permissions
      .query({ name: 'geolocation' })
      .then(function (res) {
        geoLog('Permissions query result:', res ? res.state : 'null');
        // só mostra se estiver em prompt (evita insistir se já negado ou concedido)
        return res && res.state === 'prompt';
      })
      .catch(function (err) {
        geoLog('Permissions query error:', err);
        return true;
      });
  }

  function init() {
    if (!GEO_ENABLED) {
      try {
        // Quando a geolocalização automática está desativada:
        // - nunca abrir pop-ups/modais automaticamente
        // - apenas reaplicar cache existente (se houver)
        if (typeof GEO.ensureSessionCache === 'function') {
          GEO.ensureSessionCache();
        }
      } catch (e0) { }
      return;
    }
    // Telemetria: inicialização do modal de geolocalização
    if (window.CCTelemetry) {
      window.CCTelemetry.track('1.3-geolocation-debug', 'init-start', {
        hasGeolocation: 'geolocation' in navigator,
        hasPermissions: !!(navigator && navigator.permissions),
        hasGEO: typeof GEO.ensureSessionCache === 'function',
        hasRequestAndFetch: typeof GEO.requestAndFetch === 'function'
      });
    }
    
    geoLog('init() chamado');
    geoLog('navigator.geolocation disponível:', 'geolocation' in navigator);
    geoLog('navigator.permissions disponível:', !!(navigator && navigator.permissions));
    geoLog('GEO.ensureSessionCache:', typeof GEO.ensureSessionCache);
    geoLog('GEO.requestAndFetch:', typeof GEO.requestAndFetch);
    
    // 1) Se já existe cache na sessão, já entrega o contrato e não mostra modal.
    if (typeof GEO.ensureSessionCache === 'function' && GEO.ensureSessionCache()) {
      // Telemetria: cache encontrado, não mostra modal
      if (window.CCTelemetry) {
        window.CCTelemetry.track('1.3-geolocation-debug', 'cache-hit', {
          skipped: true
        });
      }
      return;
    }

    // 2) Modal só 1x por sessão
    if (safeSessionGet(PROMPT_SHOWN_KEY) === '1') return;
    safeSessionSet(PROMPT_SHOWN_KEY, '1');

    // 3) Mostrar modal apenas quando fizer sentido
    shouldShowModalViaPermissionsApi().then(function (shouldShow) {
      // Telemetria: resultado da verificação de permissões
      if (window.CCTelemetry) {
        window.CCTelemetry.track('1.3-geolocation-debug', 'permission-check-result', {
          shouldShow: shouldShow,
          promptShown: safeSessionGet(PROMPT_SHOWN_KEY) === '1'
        });
      }
      
      if (!shouldShow) {
        // se já estiver granted, tenta buscar sem modal (sem prompt nativo)
        if (typeof GEO.requestAndFetch === 'function') {
          GEO.requestAndFetch().catch(function () { });
        }
        return;
      }
      bindEventsOnce();
      showModal();
      
      // Telemetria: modal exibido
      if (window.CCTelemetry) {
        window.CCTelemetry.track('1.3-geolocation-debug', 'modal-shown', {
          timestamp: Date.now()
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);



