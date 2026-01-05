(function ($) {
  'use strict';

  if (typeof CTWPMLAdminTabs === 'undefined' || !CTWPMLAdminTabs.page) {
    return;
  }

  var refreshInterval = null;

  function refreshLogs() {
    $.ajax({
      url: ajaxurl,
      type: 'POST',
      data: {
        action: 'ctwpml_get_logs',
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

  $(document).ready(function () {
    // Handlers dos botões
    $('#ctwpml-copy-logs-btn').on('click', copyLogs);
    $('#ctwpml-clear-logs-btn').on('click', clearLogs);

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
        }
      }, 5000);
    }

    // Iniciar auto-refresh se a aba Debug estiver ativa
    var currentTab = window.location.hash.replace('#', '') || 'integracoes';
    if (currentTab === 'debug') {
      startAutoRefresh();
      refreshLogs(); // Refresh imediato
    }

    // Monitorar mudanças de aba
    $('.ctwpml-admin-tab').on('click', function () {
      var tab = $(this).data('tab');
      if (tab === 'debug') {
        startAutoRefresh();
        refreshLogs(); // Refresh imediato ao entrar na aba
      } else {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    });
  });
})(jQuery);

