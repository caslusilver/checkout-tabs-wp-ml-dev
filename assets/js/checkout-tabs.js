(function (window) {
  'use strict';

  jQuery(function ($) {
    if (typeof window.cc_params === 'undefined') return;
    window.CCCheckoutTabs = window.CCCheckoutTabs || {};

    var state = {
      $: $,
      params: window.cc_params,
    };

    // expõe para depuração quando debug=true
    window.CCCheckoutTabsState = state;

    if (window.CCCheckoutTabs.setupLogger) window.CCCheckoutTabs.setupLogger(state);
    if (window.CCCheckoutTabs.setupUI) window.CCCheckoutTabs.setupUI(state);
    if (window.CCCheckoutTabs.setupTabs) window.CCCheckoutTabs.setupTabs(state);
    if (window.CCCheckoutTabs.setupStore) window.CCCheckoutTabs.setupStore(state);
    if (window.CCCheckoutTabs.setupWebhook) window.CCCheckoutTabs.setupWebhook(state);
    if (window.CCCheckoutTabs.setupWooEvents) window.CCCheckoutTabs.setupWooEvents(state);

    // bootstrap (ordem importa)
    if (state.buildTabsAndMoveFields) state.buildTabsAndMoveFields();
    if (state.bindNavigation) state.bindNavigation();
    if (state.bindCepAdvance) state.bindCepAdvance();
  });
})(window);


