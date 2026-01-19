(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupLogger = function setupLogger(state) {
    var $ = state.$;
    var forceDebug = false;
    try {
      forceDebug = new URLSearchParams(window.location.search).get('ctwpml_debug') === '1';
    } catch (e) {}
    try {
      if (!forceDebug && window.localStorage && localStorage.getItem('ctwpml_debug') === '1') forceDebug = true;
    } catch (e) {}

    var debugMode =
      forceDebug ||
      (state.params && (state.params.debug === true || state.params.debug === 1 || state.params.debug === '1'));

    // Admin-only UI: captura pode ficar ativa para coletar logs (backend/console),
    // mas o painel visual nunca deve aparecer para usuário final.
    var isAdminViewer = false;
    try {
      isAdminViewer = !!(state.params && (state.params.is_admin_viewer === 1 || state.params.is_admin_viewer === true || state.params.is_admin_viewer === '1'));
    } catch (e0) {}

    state.currentPhase = '';
    state.actionStartTime = 0;
    state.ajaxWebhookStartTime = 0;
    state.ajaxWebhookEndTime = 0;
    state.ajaxStoreStartTime = 0;
    state.ajaxStoreEndTime = 0;
    state.ajaxWCStartTime = 0;
    state.ajaxWCEndTime = 0;
    state.fragmentsAppliedTime = 0;

    function ensureDebugPanel() {
      if (!debugMode) return;
      if (!isAdminViewer) return;
      if ($('#debug-panel').length) return;

      $('body').append(
        '' +
          '<div id="debug-panel-button" style="position:fixed;right:12px;bottom:12px;z-index:999999;background:#111;color:#fff;border-radius:999px;padding:10px 14px;font-weight:800;cursor:pointer;border:1px solid rgba(255,255,255,0.12);box-shadow:0 10px 30px rgba(0,0,0,0.35);">Ver Logs</div>' +
          '<div id="debug-panel" style="position:fixed;right:12px;bottom:58px;z-index:999999;width:min(720px,calc(100vw - 24px));max-width:720px;height:min(520px,calc(100vh - 90px));background:#111;color:#fff;border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 10px 30px rgba(0,0,0,0.35);display:none;overflow:hidden;">' +
          '  <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;">' +
          '    <div style="font-weight:800;">CTWPML Debug</div>' +
          '    <div style="display:flex;gap:8px;align-items:center;">' +
          '      <button type="button" id="copy-logs" style="border:0;border-radius:999px;padding:6px 10px;font-weight:700;cursor:pointer;">Copiar</button>' +
          '      <button type="button" id="clear-logs" style="border:0;border-radius:999px;padding:6px 10px;font-weight:700;cursor:pointer;">Limpar</button>' +
          '      <button type="button" id="debug-panel-close" style="border:0;border-radius:999px;padding:6px 10px;font-weight:700;cursor:pointer;">Fechar</button>' +
          '    </div>' +
          '  </div>' +
          '  <textarea id="debug-log-content" readonly style="width:100%;height:calc(100% - 48px);background:#0b0b0b;color:#d1d5db;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px;box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\\\"Liberation Mono\\\",\\\"Courier New\\\",monospace;font-size:12px;line-height:1.35;resize:none;"></textarea>' +
          '</div>'
      );

      $('#debug-panel-button').on('click', function () {
        $('#debug-panel').toggle();
      });

      $('#debug-panel-close').on('click', function () {
        $('#debug-panel').hide();
      });

      $('#copy-logs').on('click', function () {
        var logContent = $('#debug-log-content').val() || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(logContent).then(function () {
            alert('Logs copiados para a área de transferência!');
          });
        }
      });

      $('#clear-logs').on('click', function () {
        $('#debug-log-content').val('');
        if (window.console && console.clear) console.clear();
      });
    }

    function normalizePhase(phase) {
      if (phase === 'AJAX_OUT_WEBHOOK') return 'WEBHOOK_OUT';
      if (phase === 'AJAX_IN_WEBHOOK') return 'WEBHOOK_IN';
      if (phase === 'AJAX_OUT_STORE') return 'STORE_OUT';
      if (phase === 'AJAX_IN_STORE') return 'STORE_IN';
      if (phase === 'AJAX_OUT_WC') return 'WC_OUT';
      if (phase === 'AJAX_IN_WC') return 'WC_IN';
      if (phase === 'FRAG_APP') return 'APPLY_FRAG';
      if (phase === 'FRAG_DONE') return 'UPDATE_DONE';
      return phase || '';
    }

    /**
     * Checkpoint de debug: registra SUCCESS ou FAIL para uma verificação específica.
     * Útil para validar que cada melhoria está funcionando.
     * 
     * @param {string} name - Nome do checkpoint (ex: 'CHK_HOST_WOO', 'CHK_GATEWAYS')
     * @param {boolean} ok - true = sucesso, false = falha
     * @param {object} data - Dados adicionais para debug
     */
    state.checkpoint = function checkpoint(name, ok, data) {
      if (!debugMode) return;
      ensureDebugPanel();

      var status = ok ? '✓ OK' : '✗ FAIL';
      var message = status + '   ' + name;
      
      var timestamp = new Date().toLocaleTimeString('pt-BR', {
        hour12: false,
        second: 'numeric',
        fractionalSecondDigits: 3,
      });

      var logMessage = '[CTWPML] [' + timestamp + '] CHECK      ' + message;

      // Cor diferente no console
      if (ok) {
        console.log('%c' + logMessage, 'color: #22c55e; font-weight: bold;');
      } else {
        console.log('%c' + logMessage, 'color: #ef4444; font-weight: bold;');
      }
      if (data) console.log(data);

      // Adiciona ao painel de debug
      if ($('#debug-log-content').length) {
        var ta = $('#debug-log-content');
        var line = logMessage;
        if (data) {
          try {
            line += '\n  → ' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
          } catch (e) {
            line += '\n  → ' + String(data);
          }
        }
        var cur = ta.val() || '';
        ta.val(cur ? cur + '\n' + line : line);
        ta.scrollTop(ta[0].scrollHeight);
      }

      // Salva no backend
      if (state.params && state.params.ajax_url) {
        var payload = new FormData();
        payload.append('action', 'ctwpml_save_log');
        payload.append('level', ok ? 'info' : 'error');
        payload.append('message', logMessage);
        payload.append('timestamp', Date.now());

        if (navigator.sendBeacon) {
          navigator.sendBeacon(state.params.ajax_url, payload);
        } else if (window.fetch) {
          fetch(state.params.ajax_url, {
            method: 'POST',
            body: payload,
            keepalive: true,
          }).catch(function () {});
        }
      }
    };

    state.log = function log(message, data, phase) {
      if (!debugMode) return;
      ensureDebugPanel();

      if (phase) state.currentPhase = phase;
      phase = normalizePhase(phase || state.currentPhase || 'DEBUG');

      var timestamp = new Date().toLocaleTimeString('pt-BR', {
        hour12: false,
        second: 'numeric',
        fractionalSecondDigits: 3,
      });

      var timingInfo = '';
      if (phase === 'WEBHOOK_IN') {
        var d1 =
          state.ajaxWebhookEndTime > state.ajaxWebhookStartTime
            ? state.ajaxWebhookEndTime - state.ajaxWebhookStartTime
            : 0;
        timingInfo = ' Δajax=' + d1.toFixed(0) + 'ms';
      } else if (phase === 'STORE_IN') {
        var d2 =
          state.ajaxStoreEndTime > state.ajaxStoreStartTime
            ? state.ajaxStoreEndTime - state.ajaxStoreStartTime
            : 0;
        timingInfo = ' Δajax=' + d2.toFixed(0) + 'ms';
      } else if (phase === 'WC_IN') {
        var d3 =
          state.ajaxWCEndTime > state.ajaxWCStartTime
            ? state.ajaxWCEndTime - state.ajaxWCStartTime
            : 0;
        timingInfo = ' Δajax=' + d3.toFixed(0) + 'ms';
      }

      if (phase === 'UPDATE_DONE' || phase === 'UI') {
        var total =
          performance.now() > state.actionStartTime
            ? performance.now() - state.actionStartTime
            : 0;
        timingInfo = ' Total time = ' + total.toFixed(0) + 'ms';
      }

      var phaseLabel = (phase + '          ').slice(0, 10);
      var logMessage = '[CTWPML] [' + timestamp + '] ' + phaseLabel + ' ' + message + timingInfo;

      console.log(logMessage);
      if (data) console.log(data);

      if ($('#debug-log-content').length) {
        var ta = $('#debug-log-content');
        var line = logMessage;
        if (data) {
          try {
            line += '\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
          } catch (e) {
            line += '\n' + String(data);
          }
        }
        var cur = ta.val() || '';
        ta.val(cur ? cur + '\n' + line : line);
        ta.scrollTop(ta[0].scrollHeight);
      }

      // Enviar log ao backend para exibição no admin
      if (state.params && state.params.ajax_url) {
        var payload = new FormData();
        payload.append('action', 'ctwpml_save_log');
        payload.append('level', phase === 'ERROR' ? 'error' : 'info');
        payload.append('message', logMessage);
        payload.append('timestamp', Date.now());

        // Usar sendBeacon (assíncrono, não bloqueia) ou fetch com keepalive
        if (navigator.sendBeacon) {
          navigator.sendBeacon(state.params.ajax_url, payload);
        } else if (window.fetch) {
          fetch(state.params.ajax_url, {
            method: 'POST',
            body: payload,
            keepalive: true,
          }).catch(function () {});
        }
      }
    };

    // Inicializa UI imediatamente para garantir visibilidade mesmo se outros scripts quebrarem depois.
    if (debugMode) {
      ensureDebugPanel();

      if (!window.__CTWPML_DEBUG_CAPTURED) {
        window.__CTWPML_DEBUG_CAPTURED = true;
        window.addEventListener('error', function (e) {
          try {
            state.log(
              'ERROR     window.error: ' + (e && e.message ? e.message : 'unknown'),
              { filename: e && e.filename, lineno: e && e.lineno, colno: e && e.colno },
              'ERROR'
            );
          } catch (_) {}
        });
        window.addEventListener('unhandledrejection', function (e) {
          try {
            state.log(
              'ERROR     unhandledrejection',
              { reason: e && e.reason ? (e.reason.message || e.reason) : 'unknown' },
              'ERROR'
            );
          } catch (_) {}
        });
      }
    }
  };
})(window);


