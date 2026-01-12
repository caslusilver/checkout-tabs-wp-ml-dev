(function (window) {
  'use strict';

  var GEO = window.CTWPMLGeo || {};
  var PROMPT_SHOWN_KEY = 'ctwpml_geo_prompt_shown';

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
    } catch (e) {}
  }

  function createModalIfMissing() {
    if (document.getElementById('ctwpml-geo-modal-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'ctwpml-geo-modal-overlay';
    overlay.innerHTML =
      '' +
      '<div id="ctwpml-geo-modal" role="dialog" aria-modal="true" aria-label="Permissão de localização">' +
      '  <h2 id="ctwpml-geo-modal-title">Permita que o site utilize sua localização em tempo real</h2>' +
      '  <div class="ctwpml-geo-benefits">' +
      '    <div class="ctwpml-geo-benefit">' +
      '      <span class="ctwpml-geo-benefit-icon">🏷️</span>' +
      '      <p class="ctwpml-geo-benefit-text">Exibimos <strong>preços e prazos de frete exatos</strong> para a sua rua automaticamente.</p>' +
      '    </div>' +
      '    <div class="ctwpml-geo-benefit">' +
      '      <span class="ctwpml-geo-benefit-icon">🏍️</span>' +
      '      <p class="ctwpml-geo-benefit-text">Ative para verificar se você está na área de <strong>entrega em até 40 minutos</strong> via motoboy (SP).</p>' +
      '    </div>' +
      '    <div class="ctwpml-geo-benefit">' +
      '      <span class="ctwpml-geo-benefit-icon">🇧🇷</span>' +
      '      <p class="ctwpml-geo-benefit-text"><strong>Enviamos com rapidez para todo o Brasil</strong> via transportadora.</p>' +
      '    </div>' +
      '  </div>' +
      '  <button id="ctwpml-geo-allow" type="button">Permitir</button>' +
      '  <button id="ctwpml-geo-later" type="button">Agora não</button>' +
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

  function setStatus(msg) {
    var el = document.getElementById('ctwpml-geo-status');
    if (el) el.textContent = msg || '';
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
      setButtonsDisabled(true);
      setStatus('Ativando localização…');

      Promise.resolve()
        .then(function () {
          if (typeof GEO.requestAndFetch !== 'function') throw new Error('Cliente de geolocalização não carregou.');
          return GEO.requestAndFetch();
        })
        .then(function () {
          setStatus('');
          closeModal();
        })
        .catch(function (err) {
          var msg = (err && err.message) || 'Não foi possível obter sua localização.';
          setStatus(msg);
          setButtonsDisabled(false);
        });
    });

    laterBtn.addEventListener('click', function () {
      closeModal();
    });
  }

  function shouldShowModalViaPermissionsApi() {
    if (!navigator || !navigator.permissions || !navigator.permissions.query) return Promise.resolve(true);
    return navigator.permissions
      .query({ name: 'geolocation' })
      .then(function (res) {
        // só mostra se estiver em prompt (evita insistir se já negado ou concedido)
        return res && res.state === 'prompt';
      })
      .catch(function () {
        return true;
      });
  }

  function init() {
    // 1) Se já existe cache na sessão, já entrega o contrato e não mostra modal.
    if (typeof GEO.ensureSessionCache === 'function' && GEO.ensureSessionCache()) return;

    // 2) Modal só 1x por sessão
    if (safeSessionGet(PROMPT_SHOWN_KEY) === '1') return;
    safeSessionSet(PROMPT_SHOWN_KEY, '1');

    // 3) Mostrar modal apenas quando fizer sentido
    shouldShowModalViaPermissionsApi().then(function (shouldShow) {
      if (!shouldShow) {
        // se já estiver granted, tenta buscar sem modal (sem prompt nativo)
        if (typeof GEO.requestAndFetch === 'function') {
          GEO.requestAndFetch().catch(function () {});
        }
        return;
      }
      bindEventsOnce();
      showModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);



