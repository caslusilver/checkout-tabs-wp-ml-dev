(function (window) {
  'use strict';

  console.log('[CTWPML][DEBUG] address-ml-screens.js - CARREGADO');

  window.CCCheckoutTabs = window.CCCheckoutTabs || {};
  window.CCCheckoutTabs.AddressMlScreens = window.CCCheckoutTabs.AddressMlScreens || {};

  console.log('[CTWPML][DEBUG] address-ml-screens.js - CCCheckoutTabs.AddressMlScreens criado');

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/\'/g, '&#039;');
  }

  function formatAddressSummary(address) {
    if (!address) return '';
    var a1 = (address.address_1 || '').trim();
    var num = (address.number || '').trim();
    var bairro = (address.neighborhood || '').trim();
    var cidade = (address.city || '').trim();
    var uf = (address.state || '').trim();
    var cep = (address.cep || '').trim();

    var line1 = (a1 ? a1 : 'Endereço') + (num ? ' ' + num : '');
    var parts = [];
    if (bairro) parts.push(bairro);
    if (cidade) parts.push(cidade);
    if (uf) parts.push(uf);
    if (cep) parts.push('CEP ' + cep);
    return line1 + (parts.length ? ' - ' + parts.join(', ') : '');
  }

  /**
   * Tela 1 (antes da lista/edição): Resumo do endereço selecionado.
   * - Sem "Grátis" (apenas chevron).
   * NOTA: Retorna apenas o conteúdo interno (sem wrapper #ctwpml-view-initial).
   */
  window.CCCheckoutTabs.AddressMlScreens.renderInitial = function renderInitial(address) {
    console.log('[CTWPML][DEBUG] renderInitial chamado com address:', address);
    var title = 'Enviar no meu endereço';
    var detail = formatAddressSummary(address) || 'Selecione um endereço para entrega.';
    var label = (address && address.label) ? String(address.label) : '';

    console.log('[CTWPML][DEBUG] renderInitial - title:', title, 'detail:', detail, 'label:', label);

    var html = (
      '' +
      '<div class="ctwpml-initial-card" id="ctwpml-initial-card">' +
      '  <a href="#" class="ctwpml-initial-card-main" id="ctwpml-initial-go">' +
      '    <div class="ctwpml-initial-row">' +
      '      <span class="ctwpml-initial-title">' + escapeHtml(title) + '</span>' +
      '      <span class="ctwpml-initial-chevron">›</span>' +
      '    </div>' +
      '    <p class="ctwpml-initial-detail">' + escapeHtml(detail) + '</p>' +
      (label ? '    <p class="ctwpml-initial-label">' + escapeHtml(label) + '</p>' : '') +
      '  </a>' +
      '  <div class="ctwpml-initial-footer">' +
      '    <a href="#" class="ctwpml-initial-manage" id="ctwpml-initial-manage">Alterar ou escolher outro endereço</a>' +
      '  </div>' +
      '</div>'
    );

    console.log('[CTWPML][DEBUG] renderInitial - HTML gerado:', html.substring(0, 200) + '...');
    return html;
  };

  /**
   * Tela 2 (prazo - placeholder): "Escolha quando sua compra chegará"
   * - Preenche endereço.
   * - Sem "Grátis" (placeholders pro valor do frete selecionado).
   * NOTA: Retorna apenas o conteúdo interno (sem wrapper #ctwpml-view-shipping).
   */
  window.CCCheckoutTabs.AddressMlScreens.renderShippingPlaceholder = function renderShippingPlaceholder(address) {
    console.log('[CTWPML][DEBUG] renderShippingPlaceholder chamado com address:', address);
    var addrLine = formatAddressSummary(address);

    // Placeholders: serão substituídos na próxima etapa quando a seleção de frete estiver integrada.
    var pricePlaceholder = '—';

    console.log('[CTWPML][DEBUG] renderShippingPlaceholder - addrLine:', addrLine);

    var html = (
      '' +
      '<div class="ctwpml-shipping-header">' +
      '  <div class="ctwpml-shipping-title">Escolha quando sua compra chegará</div>' +
      '  <div class="ctwpml-shipping-address">' +
      '    <span class="ctwpml-shipping-pin">📍</span>' +
      '    <span class="ctwpml-shipping-address-text">Envio para ' + escapeHtml(addrLine || 'seu endereço') + '</span>' +
      '  </div>' +
      '</div>' +
      '' +
      '<div class="ctwpml-shipping-card">' +
      '  <div class="ctwpml-shipping-package">' +
      '    <span class="ctwpml-shipping-package-title">Envio 1</span>' +
      '    <div class="ctwpml-shipping-thumb" aria-hidden="true"></div>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-shipping-option is-selected" data-option="opt1">' +
      '    <div class="ctwpml-shipping-option-left">' +
      '      <div class="ctwpml-shipping-radio"></div>' +
      '      <span class="ctwpml-shipping-option-text">Entre quinta-feira e sexta-feira</span>' +
      '    </div>' +
      '    <span class="ctwpml-shipping-price">' + escapeHtml(pricePlaceholder) + '</span>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-shipping-option" data-option="opt2">' +
      '    <div class="ctwpml-shipping-option-left">' +
      '      <div class="ctwpml-shipping-radio"></div>' +
      '      <span class="ctwpml-shipping-option-text">Sexta-feira</span>' +
      '    </div>' +
      '    <span class="ctwpml-shipping-price">' + escapeHtml(pricePlaceholder) + '</span>' +
      '  </div>' +
      '</div>' +
      '' +
      '<div class="ctwpml-shipping-footer">' +
      '  <div class="ctwpml-shipping-summary-row">' +
      '    <span>Frete</span>' +
      '    <span class="ctwpml-shipping-summary-price">' + escapeHtml(pricePlaceholder) + '</span>' +
      '  </div>' +
      '  <button type="button" class="ctwpml-shipping-continue" id="ctwpml-shipping-continue">Continuar</button>' +
      '</div>'
    );

    console.log('[CTWPML][DEBUG] renderShippingPlaceholder - HTML gerado (primeiros 200 chars):', html.substring(0, 200));
    return html;
  };
})(window);


