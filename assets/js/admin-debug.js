(function ($) {
  'use strict';

  if (typeof CTWPMLAdminTabs === 'undefined' || !CTWPMLAdminTabs.page) {
    return;
  }

  var refreshInterval = null;

  function debugNonce() {
    return CTWPMLAdminTabs.debug_log_nonce || '';
  }

  function refreshLogs() {
    $.ajax({
      url: ajaxurl,
      type: 'POST',
      data: {
        action: 'ctwpml_get_logs',
        _ajax_nonce: debugNonce(),
      },
      success: function (response) {
        if (response.success && response.data && response.data.logs) {
          var logs = response.data.logs;
          var content = logs.join('\n');
          $('#ctwpml-debug-logs-textarea').val(content);
          
          // Auto-scroll para o final
          var textarea = document.getElementById('ctwpml-debug-logs-textarea');
          if (textarea) {
            textarea.scrollTop = textarea.scrollHeight;
          }
          
          $('#ctwpml-logs-status').text('Atualizado: ' + new Date().toLocaleTimeString('pt-BR'));
        }
      },
      error: function () {
        $('#ctwpml-logs-status').text('Erro ao atualizar logs');
      },
    });
  }

  function refreshIsolatedLog() {
    $.ajax({
      url: ajaxurl,
      type: 'POST',
      data: {
        action: 'ctwpml_get_isolated_log',
        _ajax_nonce: debugNonce(),
      },
      success: function (response) {
        if (response.success && response.data) {
          var content = response.data.log || '';
          $('#ctwpml-isolated-log-textarea').val(content);
          var textarea = document.getElementById('ctwpml-isolated-log-textarea');
          if (textarea) textarea.scrollTop = textarea.scrollHeight;
          $('#ctwpml-isolated-log-status').text('Atualizado: ' + new Date().toLocaleTimeString('pt-BR'));
        }
      },
      error: function () {
        $('#ctwpml-isolated-log-status').text('Erro ao atualizar arquivo isolado');
      },
    });
  }

  function copyLogs() {
    var textarea = document.getElementById('ctwpml-debug-logs-textarea');
    if (!textarea) return;

    var content = textarea.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(
        function () {
          $('#ctwpml-logs-status').text('✓ Logs copiados!').css('color', '#46b450');
          setTimeout(function () {
            $('#ctwpml-logs-status').text('').css('color', '');
          }, 3000);
        },
        function () {
          $('#ctwpml-logs-status').text('✗ Erro ao copiar').css('color', '#dc3232');
        }
      );
    } else {
      // Fallback para navegadores antigos
      textarea.select();
      try {
        document.execCommand('copy');
        $('#ctwpml-logs-status').text('✓ Logs copiados!').css('color', '#46b450');
        setTimeout(function () {
          $('#ctwpml-logs-status').text('').css('color', '');
        }, 3000);
      } catch (e) {
        $('#ctwpml-logs-status').text('✗ Erro ao copiar').css('color', '#dc3232');
      }
    }
  }

  function clearLogs() {
    if (!confirm('Tem certeza que deseja limpar todos os logs?')) {
      return;
    }

    $.ajax({
      url: ajaxurl,
      type: 'POST',
      data: {
        action: 'ctwpml_clear_logs',
        _ajax_nonce: debugNonce(),
      },
      success: function (response) {
        if (response.success) {
          $('#ctwpml-debug-logs-textarea').val('');
          $('#ctwpml-logs-status').text('✓ Logs limpos!').css('color', '#46b450');
          setTimeout(function () {
            $('#ctwpml-logs-status').text('').css('color', '');
          }, 3000);
        } else {
          $('#ctwpml-logs-status').text('✗ Erro ao limpar logs').css('color', '#dc3232');
        }
      },
      error: function () {
        $('#ctwpml-logs-status').text('✗ Erro ao limpar logs').css('color', '#dc3232');
      },
    });
  }

  function copyIsolatedLog() {
    var textarea = document.getElementById('ctwpml-isolated-log-textarea');
    if (!textarea) return;

    var content = textarea.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(
        function () {
          $('#ctwpml-isolated-log-status').text('✓ Arquivo isolado copiado!').css('color', '#46b450');
        },
        function () {
          $('#ctwpml-isolated-log-status').text('✗ Erro ao copiar').css('color', '#dc3232');
        }
      );
    } else {
      textarea.select();
      try {
        document.execCommand('copy');
        $('#ctwpml-isolated-log-status').text('✓ Arquivo isolado copiado!').css('color', '#46b450');
      } catch (e) {
        $('#ctwpml-isolated-log-status').text('✗ Erro ao copiar').css('color', '#dc3232');
      }
    }
  }

  function clearIsolatedLog() {
    if (!confirm('Tem certeza que deseja limpar o arquivo isolado?')) return;

    $.ajax({
      url: ajaxurl,
      type: 'POST',
      data: {
        action: 'ctwpml_clear_isolated_log',
        _ajax_nonce: debugNonce(),
      },
      success: function (response) {
        if (response.success) {
          $('#ctwpml-isolated-log-textarea').val('');
          $('#ctwpml-isolated-log-status').text('✓ Arquivo isolado limpo!').css('color', '#46b450');
        } else {
          $('#ctwpml-isolated-log-status').text('✗ Erro ao limpar arquivo isolado').css('color', '#dc3232');
        }
      },
      error: function () {
        $('#ctwpml-isolated-log-status').text('✗ Erro ao limpar arquivo isolado').css('color', '#dc3232');
      },
    });
  }

  function downloadIsolatedLog() {
    if (CTWPMLAdminTabs.isolated_log_download_url) {
      window.location.href = CTWPMLAdminTabs.isolated_log_download_url;
    }
  }

  $(document).ready(function () {
    // Handlers dos botões
    $('#ctwpml-copy-logs-btn').on('click', copyLogs);
    $('#ctwpml-clear-logs-btn').on('click', clearLogs);
    $('#ctwpml-copy-isolated-log-btn').on('click', copyIsolatedLog);
    $('#ctwpml-download-isolated-log-btn').on('click', downloadIsolatedLog);
    $('#ctwpml-clear-isolated-log-btn').on('click', clearIsolatedLog);

    // Auto-refresh a cada 5 segundos (apenas na aba Debug)
    function startAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      refreshInterval = setInterval(function () {
        // Verificar se a aba Debug está ativa
        var debugTab = $('.ctwpml-admin-tab-panel[data-tab="debug"]');
        if (debugTab.length && debugTab.is(':visible')) {
          refreshLogs();
          refreshIsolatedLog();
        }
      }, 5000);
    }

    // Iniciar auto-refresh se a aba Debug estiver ativa
    var currentTab = window.location.hash.replace('#', '') || 'integracoes';
    if (currentTab === 'debug') {
      startAutoRefresh();
      refreshLogs(); // Refresh imediato
      refreshIsolatedLog();
    }

    // Monitorar mudanças de aba
    $('.ctwpml-admin-tab').on('click', function () {
      var tab = $(this).data('tab');
      if (tab === 'debug') {
        startAutoRefresh();
        refreshLogs(); // Refresh imediato ao entrar na aba
        refreshIsolatedLog();
      } else {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    });
  });
})(jQuery);


