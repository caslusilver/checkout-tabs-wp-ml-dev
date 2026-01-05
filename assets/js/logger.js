(function (window) {
  'use strict';

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  window.CCCheckoutTabs.setupLogger = function setupLogger(state) {
    var $ = state.$;
    var debugMode = state.params && (state.params.debug === true || state.params.debug === 1 || state.params.debug === '1');

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
      if ($('#debug-panel').length) return;

      $('body').append(
        '' +
          '<div id="debug-panel-button">Ver Logs</div>' +
          '<div id="debug-panel">' +
          '  <button id="debug-panel-close">×</button>' +
          '  <h3>Logs de Debug</h3>' +
          '  <button id="copy-logs" style="margin-bottom: 10px;">Copiar Logs</button>' +
          '  <button id="clear-logs" style="margin-bottom: 10px; margin-left: 10px;">Limpar</button>' +
          '  <pre id="debug-log-content"></pre>' +
          '</div>'
      );

      $('#debug-panel-button').on('click', function () {
        $('#debug-panel').toggle();
      });

      $('#debug-panel-close').on('click', function () {
        $('#debug-panel').hide();
      });

      $('#copy-logs').on('click', function () {
        var logContent = $('#debug-log-content').text();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(logContent).then(function () {
            alert('Logs copiados para a área de transferência!');
          });
        }
      });

      $('#clear-logs').on('click', function () {
        $('#debug-log-content').empty();
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
      var logMessage = '[' + timestamp + '] ' + phaseLabel + ' ' + message + timingInfo;

      console.log(logMessage);
      if (data) console.log(data);

      if ($('#debug-log-content').length) {
        var logItem = document.createElement('div');
        logItem.textContent = logMessage;

        if (data) {
          var pre = document.createElement('pre');
          pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
          pre.style.marginLeft = '20px';
          pre.style.color = '#0066cc';
          logItem.appendChild(pre);
        }

        $('#debug-log-content').append(logItem);
        $('#debug-log-content').scrollTop($('#debug-log-content')[0].scrollHeight);
      }
    };
  };
})(window);


