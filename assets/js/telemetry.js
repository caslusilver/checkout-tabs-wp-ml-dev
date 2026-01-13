(function (window) {
  'use strict';

  /**
   * Sistema de Telemetria para rastrear eficiência das funcionalidades
   * Versão 1.0 - Melhorias do Popup de Inicialização
   */
  window.CCTelemetry = window.CCTelemetry || {};

  var TELEMETRY_KEY = 'ctwpml_telemetry_v1';
  var MAX_EVENTS = 500; // Limite de eventos armazenados

  /**
   * Inicializa o sistema de telemetria
   */
  function initTelemetry() {
    try {
      if (!window.sessionStorage) return;
      var existing = sessionStorage.getItem(TELEMETRY_KEY);
      if (!existing) {
        sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify({
          version: '1.0',
          startTime: Date.now(),
          events: [],
          metrics: {}
        }));
      }
    } catch (e) {
      console.warn('[CTWPML Telemetry] Erro ao inicializar:', e);
    }
  }

  /**
   * Obtém dados de telemetria
   */
  function getTelemetryData() {
    try {
      if (!window.sessionStorage) return null;
      var raw = sessionStorage.getItem(TELEMETRY_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Salva dados de telemetria
   */
  function saveTelemetryData(data) {
    try {
      if (!window.sessionStorage) return;
      // Limitar número de eventos
      if (data.events && data.events.length > MAX_EVENTS) {
        data.events = data.events.slice(-MAX_EVENTS);
      }
      sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CTWPML Telemetry] Erro ao salvar:', e);
    }
  }

  /**
   * Registra um evento de telemetria
   * @param {string} feature - Nome da funcionalidade (ex: '1.1-recaptcha', '1.2-geolocation-animation')
   * @param {string} event - Tipo de evento (ex: 'start', 'success', 'error', 'click')
   * @param {object} data - Dados adicionais
   */
  window.CCTelemetry.track = function track(feature, event, data) {
    try {
      var telemetry = getTelemetryData();
      if (!telemetry) {
        initTelemetry();
        telemetry = getTelemetryData();
        if (!telemetry) return;
      }

      var timestamp = Date.now();
      var eventObj = {
        timestamp: timestamp,
        feature: feature,
        event: event,
        data: data || {}
      };

      telemetry.events.push(eventObj);

      // Atualizar métricas por funcionalidade
      if (!telemetry.metrics[feature]) {
        telemetry.metrics[feature] = {
          totalEvents: 0,
          successCount: 0,
          errorCount: 0,
          clickCount: 0,
          startTimes: [],
          durations: [],
          lastEvent: null
        };
      }

      var metrics = telemetry.metrics[feature];
      metrics.totalEvents++;
      metrics.lastEvent = eventObj;

      if (event === 'success') metrics.successCount++;
      if (event === 'error') metrics.errorCount++;
      if (event === 'click') metrics.clickCount++;
      if (event === 'start' && data && data.startTime) {
        metrics.startTimes.push(data.startTime);
      }
      // Salvar durations para eventos 'success' ou 'error' que têm duration
      // (end() emite 'success'/'error' com duration, não 'end')
      if ((event === 'success' || event === 'error') && data && typeof data.duration === 'number' && data.duration > 0) {
        metrics.durations.push(data.duration);
      }

      saveTelemetryData(telemetry);

      // Log no console se debug estiver ativo
      if (window.CCCheckoutTabsState && typeof window.CCCheckoutTabsState.log === 'function') {
        window.CCCheckoutTabsState.log('TELEMETRY [' + feature + '] ' + event, data, 'TELEMETRY');
      }
    } catch (e) {
      console.warn('[CTWPML Telemetry] Erro ao rastrear evento:', e);
    }
  };

  /**
   * Inicia rastreamento de uma funcionalidade
   * @param {string} feature - Nome da funcionalidade
   * @returns {number} startTime - Timestamp de início
   */
  window.CCTelemetry.start = function start(feature) {
    var startTime = performance.now();
    window.CCTelemetry.track(feature, 'start', { startTime: startTime });
    return startTime;
  };

  /**
   * Finaliza rastreamento de uma funcionalidade
   * @param {string} feature - Nome da funcionalidade
   * @param {number} startTime - Timestamp de início retornado por start()
   * @param {boolean} success - Se a operação foi bem-sucedida
   * @param {object} data - Dados adicionais
   */
  window.CCTelemetry.end = function end(feature, startTime, success, data) {
    var endTime = performance.now();
    var duration = startTime ? (endTime - startTime) : null;
    
    window.CCTelemetry.track(feature, success ? 'success' : 'error', {
      duration: duration,
      endTime: endTime,
      startTime: startTime,
      ...(data || {})
    });
    
    return duration;
  };

  /**
   * Registra um clique/interação
   * @param {string} feature - Nome da funcionalidade
   * @param {string} action - Ação realizada (ex: 'click-link', 'submit-form')
   * @param {object} data - Dados adicionais
   */
  window.CCTelemetry.click = function click(feature, action, data) {
    window.CCTelemetry.track(feature, 'click', {
      action: action,
      ...(data || {})
    });
  };

  /**
   * Gera relatório de eficiência
   * @returns {object} Relatório com métricas de todas as funcionalidades
   */
  window.CCTelemetry.getReport = function getReport() {
    var telemetry = getTelemetryData();
    if (!telemetry) return null;

    var report = {
      sessionStart: new Date(telemetry.startTime).toISOString(),
      sessionDuration: Date.now() - telemetry.startTime,
      totalEvents: telemetry.events.length,
      features: {}
    };

    // Calcular métricas por funcionalidade
    Object.keys(telemetry.metrics).forEach(function(feature) {
      var metrics = telemetry.metrics[feature];
      var avgDuration = metrics.durations.length > 0
        ? metrics.durations.reduce(function(a, b) { return a + b; }, 0) / metrics.durations.length
        : null;
      
      // Taxa de sucesso: successCount / (successCount + errorCount)
      // Ignora eventos informativos (start, click, etc) no denominador
      var completedOperations = metrics.successCount + metrics.errorCount;
      var successRate = completedOperations > 0
        ? (metrics.successCount / completedOperations) * 100
        : null; // null = sem operações concluídas ainda

      report.features[feature] = {
        totalEvents: metrics.totalEvents,
        successCount: metrics.successCount,
        errorCount: metrics.errorCount,
        clickCount: metrics.clickCount,
        completedOperations: completedOperations,
        successRate: successRate !== null ? successRate.toFixed(2) + '%' : 'N/A',
        avgDuration: avgDuration ? avgDuration.toFixed(2) + 'ms' : 'N/A',
        minDuration: metrics.durations.length > 0 ? Math.min.apply(null, metrics.durations).toFixed(2) + 'ms' : 'N/A',
        maxDuration: metrics.durations.length > 0 ? Math.max.apply(null, metrics.durations).toFixed(2) + 'ms' : 'N/A',
        lastEvent: metrics.lastEvent
      };
    });

    return report;
  };

  /**
   * Exporta relatório como JSON
   * @returns {string} JSON string do relatório
   */
  window.CCTelemetry.exportReport = function exportReport() {
    var report = window.CCTelemetry.getReport();
    var telemetry = getTelemetryData();
    
    return JSON.stringify({
      report: report,
      rawEvents: telemetry ? telemetry.events : [],
      timestamp: new Date().toISOString()
    }, null, 2);
  };

  /**
   * Limpa dados de telemetria
   */
  window.CCTelemetry.clear = function clear() {
    try {
      if (window.sessionStorage) {
        sessionStorage.removeItem(TELEMETRY_KEY);
        initTelemetry();
      }
    } catch (e) {
      console.warn('[CTWPML Telemetry] Erro ao limpar:', e);
    }
  };

  /**
   * Exibe relatório no console
   */
  window.CCTelemetry.logReport = function logReport() {
    var report = window.CCTelemetry.getReport();
    if (!report) {
      console.log('[CTWPML Telemetry] Nenhum dado disponível');
      return;
    }

    console.group('%c[CTWPML Telemetry] Relatório de Eficiência', 'color: #3483fa; font-weight: bold; font-size: 14px;');
    console.log('Sessão iniciada:', new Date(report.sessionStart).toLocaleString('pt-BR'));
    console.log('Duração da sessão:', (report.sessionDuration / 1000).toFixed(2) + 's');
    console.log('Total de eventos:', report.totalEvents);
    
    console.group('%cFuncionalidades', 'color: #666; font-weight: bold;');
    Object.keys(report.features).forEach(function(feature) {
      var f = report.features[feature];
      console.group('%c' + feature, 'color: #22c55e; font-weight: bold;');
      console.table(f);
      console.groupEnd();
    });
    console.groupEnd();
    
    console.groupEnd();
  };

  // Inicializar ao carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTelemetry);
  } else {
    initTelemetry();
  }

  // Expor função global para acesso via console
  window.ctwpmlTelemetry = window.CCTelemetry;
})(window);
