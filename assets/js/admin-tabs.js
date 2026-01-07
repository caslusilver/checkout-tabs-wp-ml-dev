jQuery(function ($) {
  'use strict';

  function setActiveTab(tab) {
    $('.ctwpml-admin-tab').removeClass('nav-tab-active');
    $('.ctwpml-admin-tab[data-tab="' + tab + '"]').addClass('nav-tab-active');

    $('.ctwpml-admin-tab-panel').hide();
    $('.ctwpml-admin-tab-panel[data-tab="' + tab + '"]').show();
  }

  function updateUrl(tab) {
    if (!window.CTWPMLAdminTabs || !CTWPMLAdminTabs.page) return;
    var url = new URL(window.location.href);
    url.searchParams.set('page', CTWPMLAdminTabs.page);
    url.searchParams.set('tab', tab);
    window.history.pushState({ tab: tab }, '', url.toString());
  }

  $(document).on('click', '.ctwpml-admin-tab', function (e) {
    e.preventDefault();
    var tab = $(this).data('tab');
    if (!tab) return;

    setActiveTab(tab);
    updateUrl(tab);
  });

  window.addEventListener('popstate', function (e) {
    if (e && e.state && e.state.tab) setActiveTab(e.state.tab);
  });
});



