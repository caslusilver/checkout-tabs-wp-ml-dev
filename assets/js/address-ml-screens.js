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
   * @deprecated Use renderShippingOptions para dados dinâmicos do backend.
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

  /**
   * Tela 2 (prazo - dinâmica): "Escolha quando sua compra chegará"
   * Renderiza as opções de frete dinamicamente com base nos dados do backend.
   * @param {Object} address - Endereço selecionado
   * @param {Array} shippingOptions - Lista de opções de frete do backend
   * @returns {string} HTML das opções
   */
  window.CCCheckoutTabs.AddressMlScreens.renderShippingOptions = function renderShippingOptions(address, shippingOptions) {
    // DEBUG: Usar debugMode global se disponível
    var debugMode = !!(window.cc_params && window.cc_params.debug);

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - address:', address);
      console.log('[CTWPML][DEBUG] renderShippingOptions - shippingOptions:', shippingOptions);
    }

    var addrLine = formatAddressSummary(address);

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - addrLine:', addrLine);
    }

    // Se não há opções, mostrar mensagem
    if (!shippingOptions || shippingOptions.length === 0) {
      if (debugMode) {
        console.log('[CTWPML][DEBUG] renderShippingOptions - Nenhuma opção disponível');
      }
      return (
        '<div class="ctwpml-shipping-header">' +
        '  <div class="ctwpml-shipping-title">Escolha quando sua compra chegará</div>' +
        '  <div class="ctwpml-shipping-address">' +
        '    <span class="ctwpml-shipping-pin">📍</span>' +
        '    <span class="ctwpml-shipping-address-text">Envio para ' + escapeHtml(addrLine || 'seu endereço') + '</span>' +
        '  </div>' +
        '</div>' +
        '<div class="ctwpml-shipping-no-options" style="padding:20px;text-align:center;color:#666;">' +
        '  <div style="font-size:24px;margin-bottom:8px;">📦</div>' +
        '  <div>Nenhuma opção de frete disponível para este endereço.</div>' +
        '  <div style="margin-top:8px;font-size:13px;color:#999;">Verifique se o endereço está completo e tente novamente.</div>' +
        '</div>'
      );
    }

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - Gerando ' + shippingOptions.length + ' opções');
    }

    var optionsHtml = '';
    shippingOptions.forEach(function (opt, idx) {
      var isFirst = idx === 0;

      if (debugMode) {
        console.log('[CTWPML][DEBUG] renderShippingOptions - Opção ' + idx + ':', opt);
      }

      optionsHtml +=
        '' +
        '<div class="ctwpml-shipping-option' + (isFirst ? ' is-selected' : '') + '" ' +
        'data-method-id="' + escapeHtml(opt.id) + '" ' +
        'data-type="' + escapeHtml(opt.type || '') + '" ' +
        'data-option="opt' + idx + '">' +
        '  <div class="ctwpml-shipping-option-left">' +
        '    <div class="ctwpml-shipping-radio"></div>' +
        '    <span class="ctwpml-shipping-option-text">' + escapeHtml(opt.label) + '</span>' +
        '  </div>' +
        '  <span class="ctwpml-shipping-price">' + escapeHtml(opt.price_text || '') + '</span>' +
        '</div>';
    });

    var html =
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
      '  </div>' +
      optionsHtml +
      '</div>' +
      '' +
      '<div class="ctwpml-shipping-footer">' +
      '  <button type="button" class="ctwpml-shipping-continue" id="ctwpml-shipping-continue">Continuar</button>' +
      '</div>';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - HTML gerado (primeiros 300 chars):', html.substring(0, 300));
    }

    return html;
  };

  /**
   * Tela 3: "Escolha como pagar"
   * Exibe métodos de pagamento (Pix, Boleto, Cartão) e totalizador no rodapé.
   * NOTA: Esta é apenas a estrutura visual, sem lógica de pagamento.
   * Inclui drawer de cupom (modal que sobe de baixo).
   * @param {Object} options - Opções de renderização
   * @param {string} options.totalText - Texto do total (ex: "R$ 185,33")
   * @returns {string} HTML da tela
   */
  window.CCCheckoutTabs.AddressMlScreens.renderPaymentScreen = function renderPaymentScreen(options) {
    options = options || {};
    var debugMode = !!(window.cc_params && window.cc_params.debug);
    var totalText = options.totalText || 'R$ 0,00';
    var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? window.cc_params.plugin_url : '';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderPaymentScreen - options:', options);
    }

    // URLs dos ícones
    var pixIconUrl = 'https://cubensisstore.com.br/wp-content/uploads/2026/01/artpoin-logo-pix-1-scaled.png';
    var cardIconUrl = 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bank-card.png';

    var html =
      '' +
      '<div class="ctwpml-payment-screen">' +
      // Header laranja com botão voltar
      '  <header class="ctwpml-payment-header">' +
      '    <button class="ctwpml-payment-back-button" id="ctwpml-payment-back">←</button>' +
      '    <h1 class="ctwpml-payment-header-title">Escolha como pagar</h1>' +
      '  </header>' +
      // Título da página
      '  <h2 class="ctwpml-payment-page-title">Escolha como pagar</h2>' +
      // Seção Recomendados
      '  <p class="ctwpml-payment-section-label">Recomendados</p>' +
      '  <div class="ctwpml-payment-group">' +
      // Pix
      '    <a href="#" class="ctwpml-payment-option" data-method="pix">' +
      '      <div class="ctwpml-payment-option-content">' +
      '        <div class="ctwpml-payment-icon">' +
      '          <img src="' + escapeHtml(pixIconUrl) + '" alt="Pix" />' +
      '        </div>' +
      '        <div class="ctwpml-payment-details">' +
      '          <h3 class="ctwpml-payment-method-title">Pix</h3>' +
      '          <p class="ctwpml-payment-method-subtitle">Aprovação imediata</p>' +
      '        </div>' +
      '      </div>' +
      '      <span class="ctwpml-payment-chevron">›</span>' +
      '    </a>' +
      // Boleto
      '    <a href="#" class="ctwpml-payment-option" data-method="boleto">' +
      '      <div class="ctwpml-payment-option-content">' +
      '        <div class="ctwpml-payment-icon ctwpml-payment-icon-barcode">║▌║</div>' +
      '        <div class="ctwpml-payment-details">' +
      '          <h3 class="ctwpml-payment-method-title">Boleto</h3>' +
      '          <p class="ctwpml-payment-method-subtitle">Aprovação em 1 a 2 dias úteis</p>' +
      '        </div>' +
      '      </div>' +
      '      <span class="ctwpml-payment-chevron">›</span>' +
      '    </a>' +
      '  </div>' +
      // Seção Cartões
      '  <p class="ctwpml-payment-section-label">Cartões</p>' +
      '  <div class="ctwpml-payment-group">' +
      // Novo cartão de crédito
      '    <a href="#" class="ctwpml-payment-option" data-method="card">' +
      '      <div class="ctwpml-payment-option-content">' +
      '        <div class="ctwpml-payment-icon">' +
      '          <img src="' + escapeHtml(cardIconUrl) + '" alt="Cartão" />' +
      '        </div>' +
      '        <div class="ctwpml-payment-details">' +
      '          <h3 class="ctwpml-payment-method-title ctwpml-payment-title-blue">Novo cartão de crédito</h3>' +
      '        </div>' +
      '      </div>' +
      '      <span class="ctwpml-payment-chevron">›</span>' +
      '    </a>' +
      '  </div>' +
      // Footer fixo (sticky)
      '  <div class="ctwpml-payment-footer">' +
      '    <span class="ctwpml-payment-coupon-link" id="ctwpml-payment-coupon">Inserir código do cupom</span>' +
      '    <div class="ctwpml-payment-total-row">' +
      '      <span class="ctwpml-payment-total-label">Você pagará</span>' +
      '      <span class="ctwpml-payment-total-value">' + escapeHtml(totalText) + '</span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      // Overlay e Drawer do Cupom (fora do container principal)
      '<div id="ctwpml-coupon-overlay" class="ctwpml-coupon-overlay"></div>' +
      '<div id="ctwpml-coupon-drawer" class="ctwpml-coupon-drawer">' +
      '  <div class="ctwpml-coupon-drawer-handle"></div>' +
      '  <div class="ctwpml-coupon-drawer-header">' +
      '    <button class="ctwpml-coupon-close-btn" id="ctwpml-coupon-close">✕</button>' +
      '    <h2 class="ctwpml-coupon-drawer-title">Cupons</h2>' +
      '  </div>' +
      '  <div class="ctwpml-coupon-drawer-content">' +
      '    <div class="ctwpml-coupon-insert-label">' +
      '      <span class="ctwpml-coupon-ticket-icon">🎫</span>' +
      '      <span class="ctwpml-coupon-insert-text">Inserir código</span>' +
      '    </div>' +
      '    <div class="ctwpml-coupon-input-wrapper">' +
      '      <input type="text" id="ctwpml-coupon-input" class="ctwpml-coupon-input" placeholder="Digite seu cupom" />' +
      '    </div>' +
      '    <button id="ctwpml-add-coupon-btn" class="ctwpml-add-coupon-btn" disabled>Adicionar cupom</button>' +
      '  </div>' +
      '</div>';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderPaymentScreen - HTML gerado (primeiros 300 chars):', html.substring(0, 300));
    }

    return html;
  };
})(window);


