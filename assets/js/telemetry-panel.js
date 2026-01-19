(function (window) {
  'use strict';

  /**
   * Painel visual de telemetria para exibir métricas de eficiência
   * Acessível via console: ctwpmlTelemetry.logReport()
   */
  
  function createTelemetryPanel() {
    try {
      // Admin-only UI: não exibir painel/botão em usuários finais (mesmo com assets em cache).
      if (!window.cc_params || !(window.cc_params.is_admin_viewer === 1 || window.cc_params.is_admin_viewer === true || window.cc_params.is_admin_viewer === '1')) {
        return;
      }
    } catch (e0) {}
    if (document.getElementById('ctwpml-telemetry-panel')) return;
    
    var panel = document.createElement('div');
    panel.id = 'ctwpml-telemetry-panel';
    panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:999998;width:400px;max-height:80vh;background:#1a1a1a;color:#fff;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 10px 30px rgba(0,0,0,0.5);display:none;overflow-y:auto;font-family:ui-monospace,monospace;font-size:12px;';
    
    panel.innerHTML = 
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">' +
      '  <h3 style="margin:0;font-size:14px;font-weight:bold;color:#3483fa;">📊 Telemetria V1.0</h3>' +
      '  <button id="ctwpml-telemetry-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:0;width:24px;height:24px;">×</button>' +
      '</div>' +
      '<div id="ctwpml-telemetry-content"></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:8px;">' +
      '  <button id="ctwpml-telemetry-export" style="flex:1;padding:8px;background:#3483fa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Exportar JSON</button>' +
      '  <button id="ctwpml-telemetry-clear" style="flex:1;padding:8px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Limpar</button>' +
      '</div>';
    
    document.body.appendChild(panel);
    
    // Botão toggle (flutuante)
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'ctwpml-telemetry-toggle';
    toggleBtn.style.cssText = 'position:fixed;right:12px;top:12px;z-index:999999;background:#3483fa;color:#fff;border:none;border-radius:50%;width:48px;height:48px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:20px;';
    toggleBtn.textContent = '📊';
    toggleBtn.title = 'Telemetria V1.0';
    document.body.appendChild(toggleBtn);
    
    function updatePanel() {
      if (!window.CCTelemetry) return;
      var report = window.CCTelemetry.getReport();
      if (!report) {
        document.getElementById('ctwpml-telemetry-content').innerHTML = '<p style="color:#999;margin:0;">Nenhum dado disponível</p>';
        return;
      }
      
      var html = '<div style="margin-bottom:16px;">' +
        '<div style="color:#999;font-size:11px;margin-bottom:4px;">Sessão</div>' +
        '<div style="color:#fff;">Iniciada: ' + new Date(report.sessionStart).toLocaleTimeString('pt-BR') + '</div>' +
        '<div style="color:#fff;">Duração: ' + (report.sessionDuration / 1000).toFixed(1) + 's</div>' +
        '<div style="color:#fff;">Eventos: ' + report.totalEvents + '</div>' +
        '</div>';
      
      Object.keys(report.features).forEach(function(feature) {
        var f = report.features[feature];
        var successColor = parseFloat(f.successRate) >= 80 ? '#22c55e' : parseFloat(f.successRate) >= 50 ? '#f59e0b' : '#ef4444';
        
        html += '<div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid ' + successColor + ';">' +
          '<div style="font-weight:bold;margin-bottom:8px;color:#3483fa;">' + feature + '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">' +
          '<div><span style="color:#999;">Eventos:</span> <span style="color:#fff;">' + f.totalEvents + '</span></div>' +
          '<div><span style="color:#999;">Taxa Sucesso:</span> <span style="color:' + successColor + ';font-weight:bold;">' + f.successRate + '</span></div>' +
          '<div><span style="color:#999;">Sucessos:</span> <span style="color:#22c55e;">' + f.successCount + '</span></div>' +
          '<div><span style="color:#999;">Erros:</span> <span style="color:#ef4444;">' + f.errorCount + '</span></div>' +
          '<div><span style="color:#999;">Cliques:</span> <span style="color:#fff;">' + f.clickCount + '</span></div>' +
          '<div><span style="color:#999;">Duração Média:</span> <span style="color:#fff;">' + f.avgDuration + '</span></div>' +
          '</div>' +
          '</div>';
      });
      
      document.getElementById('ctwpml-telemetry-content').innerHTML = html;
    }
    
    toggleBtn.addEventListener('click', function() {
      var panel = document.getElementById('ctwpml-telemetry-panel');
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        updatePanel();
        // Atualizar a cada 2 segundos quando visível
        if (window.__ctwpmlTelemetryInterval) clearInterval(window.__ctwpmlTelemetryInterval);
        window.__ctwpmlTelemetryInterval = setInterval(updatePanel, 2000);
      } else {
        panel.style.display = 'none';
        if (window.__ctwpmlTelemetryInterval) {
          clearInterval(window.__ctwpmlTelemetryInterval);
          window.__ctwpmlTelemetryInterval = null;
        }
      }
    });
    
    document.getElementById('ctwpml-telemetry-close').addEventListener('click', function() {
      document.getElementById('ctwpml-telemetry-panel').style.display = 'none';
      if (window.__ctwpmlTelemetryInterval) {
        clearInterval(window.__ctwpmlTelemetryInterval);
        window.__ctwpmlTelemetryInterval = null;
      }
    });
    
    document.getElementById('ctwpml-telemetry-export').addEventListener('click', function() {
      if (!window.CCTelemetry) return;
      var json = window.CCTelemetry.exportReport();
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ctwpml-telemetry-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    
    document.getElementById('ctwpml-telemetry-clear').addEventListener('click', function() {
      if (confirm('Limpar todos os dados de telemetria?')) {
        if (window.CCTelemetry) window.CCTelemetry.clear();
        updatePanel();
      }
    });
  }
  
  // Criar painel quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTelemetryPanel);
  } else {
    createTelemetryPanel();
  }
  
  // Expor função para atualizar painel manualmente
  window.ctwpmlUpdateTelemetryPanel = function() {
    if (document.getElementById('ctwpml-telemetry-panel') && 
        document.getElementById('ctwpml-telemetry-panel').style.display !== 'none') {
      if (window.CCTelemetry) {
        var report = window.CCTelemetry.getReport();
        if (report) {
          var html = '<div style="margin-bottom:16px;">' +
            '<div style="color:#999;font-size:11px;margin-bottom:4px;">Sessão</div>' +
            '<div style="color:#fff;">Iniciada: ' + new Date(report.sessionStart).toLocaleTimeString('pt-BR') + '</div>' +
            '<div style="color:#fff;">Duração: ' + (report.sessionDuration / 1000).toFixed(1) + 's</div>' +
            '<div style="color:#fff;">Eventos: ' + report.totalEvents + '</div>' +
            '</div>';
          
          Object.keys(report.features).forEach(function(feature) {
            var f = report.features[feature];
            var successColor = parseFloat(f.successRate) >= 80 ? '#22c55e' : parseFloat(f.successRate) >= 50 ? '#f59e0b' : '#ef4444';
            
            html += '<div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid ' + successColor + ';">' +
              '<div style="font-weight:bold;margin-bottom:8px;color:#3483fa;">' + feature + '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">' +
              '<div><span style="color:#999;">Eventos:</span> <span style="color:#fff;">' + f.totalEvents + '</span></div>' +
              '<div><span style="color:#999;">Taxa Sucesso:</span> <span style="color:' + successColor + ';font-weight:bold;">' + f.successRate + '</span></div>' +
              '<div><span style="color:#999;">Sucessos:</span> <span style="color:#22c55e;">' + f.successCount + '</span></div>' +
              '<div><span style="color:#999;">Erros:</span> <span style="color:#ef4444;">' + f.errorCount + '</span></div>' +
              '<div><span style="color:#999;">Cliques:</span> <span style="color:#fff;">' + f.clickCount + '</span></div>' +
              '<div><span style="color:#999;">Duração Média:</span> <span style="color:#fff;">' + f.avgDuration + '</span></div>' +
              '</div>' +
              '</div>';
          });
          
          document.getElementById('ctwpml-telemetry-content').innerHTML = html;
        }
      }
    }
  };
})(window);
