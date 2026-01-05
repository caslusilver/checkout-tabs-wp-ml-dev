(function (window) {
  'use strict';

  jQuery(function ($) {
    var forceDebug = false;
    try {
      forceDebug = new URLSearchParams(window.location.search).get('ctwpml_debug') === '1';
    } catch (e) {}

    // Se o theme/builder impedir o wp_localize_script (cc_params undefined), ainda permitimos
    // subir o debug visual via query param/localStorage para diagnóstico.
    if (typeof window.cc_params === 'undefined') {
      try {
        if (!forceDebug && window.localStorage && localStorage.getItem('ctwpml_debug') !== '1') return;
      } catch (e) {
        if (!forceDebug) return;
      }
      window.cc_params = { debug: 1 };
    }
    window.CCCheckoutTabs = window.CCCheckoutTabs || {};

    var state = {
      $: $,
      params: window.cc_params,
    };

    // expõe para depuração quando debug=true
    window.CCCheckoutTabsState = state;

    if (window.CCCheckoutTabs.setupLogger) window.CCCheckoutTabs.setupLogger(state);
    // Se estamos em modo “debug-only” (sem cc_params real), não inicializa o restante.
    if (!state.params || !state.params.ajax_url) return;
    if (window.CCCheckoutTabs.setupUI) window.CCCheckoutTabs.setupUI(state);
    if (window.CCCheckoutTabs.setupTabs) window.CCCheckoutTabs.setupTabs(state);
    if (window.CCCheckoutTabs.setupStore) window.CCCheckoutTabs.setupStore(state);
    if (window.CCCheckoutTabs.setupWebhook) window.CCCheckoutTabs.setupWebhook(state);
    if (window.CCCheckoutTabs.setupWooEvents) window.CCCheckoutTabs.setupWooEvents(state);
    if (window.CCCheckoutTabs.setupAddressModal) window.CCCheckoutTabs.setupAddressModal(state);

    // bootstrap (ordem importa)
    if (state.buildTabsAndMoveFields) state.buildTabsAndMoveFields();
    if (state.bindNavigation) state.bindNavigation();
    if (state.bindCepAdvance) state.bindCepAdvance();
  });
})(window);


