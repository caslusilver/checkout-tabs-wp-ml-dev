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
    var complement = (address.complement || '').trim();
    var bairro = (address.neighborhood || '').trim();
    var cidade = (address.city || '').trim();
    var uf = (address.state || '').trim();
    var cep = (address.cep || '').trim();

    // Linha 1: Rua + Número + Complemento
    var line1 = (a1 ? a1 : 'Endereço') + (num ? ', ' + num : '');
    if (complement) {
      line1 += ' - ' + complement;
    }
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

    var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? String(window.cc_params.plugin_url) : '';
    var gpsIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/gps-1.svg') : '';
    var pinHtml = gpsIconUrl
      ? '<img class="ctwpml-shipping-pin-icon" src="' + escapeHtml(gpsIconUrl) + '" alt="" aria-hidden="true" />'
      : '📍';

    var html = (
      '' +
      '<div class="ctwpml-shipping-header">' +
      '  <div class="ctwpml-shipping-title">Escolha quando sua compra chegará</div>' +
      '  <div class="ctwpml-shipping-address">' +
      '    <span class="ctwpml-shipping-pin">' + pinHtml + '</span>' +
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
   * Converte price_text em texto para o resumo (mostra "Grátis" se for zero/vazio)
   * @param {string} priceText - Texto do preço (ex: "R$ 15,00" ou "")
   * @returns {string} Texto formatado para exibição no resumo
   */
  function formatShippingSummaryPrice(priceText) {
    if (!priceText) return 'Grátis';
    var cleaned = String(priceText).replace(/[^\d,\.]/g, '').replace(',', '.');
    var num = parseFloat(cleaned);
    if (isNaN(num) || num === 0) return 'Grátis';
    return priceText;
  }

  /**
   * Tela 2 (prazo - dinâmica): "Escolha quando sua compra chegará"
   * Renderiza as opções de frete dinamicamente com base nos dados do backend.
   * @param {Object} address - Endereço selecionado
   * @param {Array} shippingOptions - Lista de opções de frete do backend
   * @param {Object} options - Opções extras (productThumbUrl)
   * @returns {string} HTML das opções
   */
  window.CCCheckoutTabs.AddressMlScreens.renderShippingOptions = function renderShippingOptions(address, shippingOptions, options) {
    options = options || {};
    // DEBUG: Usar debugMode global se disponível
    var debugMode = !!(window.cc_params && window.cc_params.debug);

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - address:', address);
      console.log('[CTWPML][DEBUG] renderShippingOptions - shippingOptions:', shippingOptions);
      console.log('[CTWPML][DEBUG] renderShippingOptions - options:', options);
    }

    var addrLine = formatAddressSummary(address);
    var productThumbUrls = Array.isArray(options.productThumbUrls) ? options.productThumbUrls : [];
    // Compatibilidade: se alguém ainda passar productThumbUrl (string), converte para array.
    if (!productThumbUrls.length && options.productThumbUrl) {
      productThumbUrls = [String(options.productThumbUrl)];
    }
    productThumbUrls = productThumbUrls.slice(0, 3);

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - addrLine:', addrLine);
      console.log('[CTWPML][DEBUG] renderShippingOptions - productThumbUrls:', productThumbUrls);
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

    // Pegar preço da primeira opção para o resumo inicial
    var firstOptionPrice = shippingOptions[0] ? shippingOptions[0].price_text : '';
    var initialSummaryPrice = formatShippingSummaryPrice(firstOptionPrice);

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - firstOptionPrice:', firstOptionPrice);
      console.log('[CTWPML][DEBUG] renderShippingOptions - initialSummaryPrice:', initialSummaryPrice);
    }

    // URLs dos ícones de frete
    var correioIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/correio.svg') : '';
    var motoboyIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/motoboy.svg') : '';

    // Função para determinar o ícone de frete baseado no label (retorna HTML do wrapper com img)
    function getShippingIconHtml(label) {
      var labelLower = String(label || '').toLowerCase();
      var iconUrl = '';
      // Motoboy/Expresso
      if (labelLower.indexOf('motoboy') !== -1 || labelLower.indexOf('expresso') !== -1 || labelLower.indexOf('express') !== -1) {
        iconUrl = motoboyIconUrl;
      }
      // Correios (Sedex, PAC, Mini, etc)
      else if (labelLower.indexOf('sedex') !== -1 || labelLower.indexOf('pac') !== -1 || labelLower.indexOf('mini') !== -1 || labelLower.indexOf('correio') !== -1) {
        iconUrl = correioIconUrl;
      }
      // Retorna wrapper com ícone ou vazio
      if (iconUrl) {
        return '<span class="ctwpml-shipping-option-icon"><img src="' + escapeHtml(iconUrl) + '" alt="" width="20" height="20" /></span>';
      }
      return '';
    }

    var optionsHtml = '';
    shippingOptions.forEach(function (opt, idx) {
      var isFirst = idx === 0;
      var priceText = opt.price_text || '';
      var shippingIconHtml = getShippingIconHtml(opt.label);

      if (debugMode) {
        console.log('[CTWPML][DEBUG] renderShippingOptions - Opção ' + idx + ':', opt, 'iconHtml:', shippingIconHtml ? 'sim' : 'nao');
      }

      optionsHtml +=
        '' +
        '<div class="ctwpml-shipping-option' + (isFirst ? ' is-selected' : '') + '" ' +
        'data-method-id="' + escapeHtml(opt.id) + '" ' +
        'data-type="' + escapeHtml(opt.type || '') + '" ' +
        'data-price-text="' + escapeHtml(priceText) + '" ' +
        'data-option="opt' + idx + '">' +
        '  <div class="ctwpml-shipping-option-left">' +
        '    <div class="ctwpml-shipping-radio"></div>' +
        shippingIconHtml +
        '    <span class="ctwpml-shipping-option-label">' + escapeHtml(opt.label) + '</span>' +
        '  </div>' +
        '  <span class="ctwpml-shipping-price">' + escapeHtml(priceText) + '</span>' +
        '</div>';
    });

    // Gerar HTML das miniaturas (até 3). Se vazio, mantém placeholder atual.
    var thumbHtml = '';
    if (productThumbUrls && productThumbUrls.length) {
      thumbHtml = '<div class="ctwpml-shipping-thumbs" aria-hidden="true">';
      productThumbUrls.forEach(function (url) {
        if (!url) return;
        thumbHtml += '<div class="ctwpml-shipping-thumb"><img src="' + escapeHtml(String(url)) + '" alt="Produto" /></div>';
      });
      thumbHtml += '</div>';
    } else {
      thumbHtml = '<div class="ctwpml-shipping-thumb" aria-hidden="true"></div>';
    }

    var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? String(window.cc_params.plugin_url) : '';
    var gpsIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/gps-1.svg') : '';

    var pinHtml = gpsIconUrl
      ? '<img class="ctwpml-shipping-pin-icon" src="' + escapeHtml(gpsIconUrl) + '" alt="" aria-hidden="true" />'
      : '📍';

    var html =
      '' +
      '<div class="ctwpml-shipping-header">' +
      '  <div class="ctwpml-shipping-title">Escolha quando sua compra chegará</div>' +
      '  <div class="ctwpml-shipping-address">' +
      '    <span class="ctwpml-shipping-pin">' + pinHtml + '</span>' +
      '    <span class="ctwpml-shipping-address-text">Envio para ' + escapeHtml(addrLine || 'seu endereço') + '</span>' +
      '  </div>' +
      '</div>' +
      '' +
      '<div class="ctwpml-shipping-card">' +
      '  <div class="ctwpml-shipping-package">' +
      '    <span class="ctwpml-shipping-package-title">Envio 1</span>' +
      thumbHtml +
      '  </div>' +
      optionsHtml +
      '</div>' +
      '' +
      '<div class="ctwpml-shipping-footer">' +
      '  <div class="ctwpml-shipping-summary-row">' +
      '    <span>Frete</span>' +
      '    <span class="ctwpml-shipping-summary-price">' + escapeHtml(initialSummaryPrice) + '</span>' +
      '  </div>' +
      '  <button type="button" class="ctwpml-shipping-continue" id="ctwpml-shipping-continue">Continuar</button>' +
      '</div>';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderShippingOptions - HTML gerado (primeiros 300 chars):', html.substring(0, 300));
    }

    return html;
  };

  // Exportar utilitário para uso externo (atualização do resumo em tempo real)
  window.CCCheckoutTabs.AddressMlScreens.formatShippingSummaryPrice = formatShippingSummaryPrice;

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
    var subtotalText = options.subtotalText || '';
    var hasDiscount =
      options.originalTotal &&
      options.discountedTotal &&
      String(options.originalTotal) !== String(options.discountedTotal);
    var couponName = options.couponName ? String(options.couponName) : '';
    var hasSubtotalDiscount =
      options.originalSubtotal &&
      options.discountedSubtotal &&
      String(options.originalSubtotal) !== String(options.discountedSubtotal);
    var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? window.cc_params.plugin_url : '';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderPaymentScreen - options:', options);
    }

    // URLs dos ícones (agora SVGs locais do plugin)
    var pixIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/pix.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/artpoin-logo-pix-1-scaled.png';
    var cardIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/bank-card.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bank-card.png';
    var boletoIconUrl = pluginUrl ? (pluginUrl + 'assets/img/icones/bar-code.svg') : '';

    var totalRowHtml = '';
    if (hasDiscount) {
      totalRowHtml =
        '    <div class="ctwpml-payment-total-row has-discount">' +
        '      <span class="ctwpml-payment-total-label">Você pagará</span>' +
        '      <div class="ctwpml-payment-price-wrapper">' +
        '        <span class="ctwpml-payment-original-price" id="ctwpml-payment-original-price">' + escapeHtml(options.originalTotal) + '</span>' +
        '        <span class="ctwpml-payment-discounted-price" id="ctwpml-payment-total-value">' + escapeHtml(options.discountedTotal) + '</span>' +
        (couponName ? '        <span class="ctwpml-discount-tag" id="ctwpml-discount-tag">' + escapeHtml(couponName) + '</span>' : '') +
        '      </div>' +
        '    </div>';
    } else {
      totalRowHtml =
        '    <div class="ctwpml-payment-total-row">' +
        '      <span class="ctwpml-payment-total-label">Você pagará</span>' +
        '      <span class="ctwpml-payment-total-value" id="ctwpml-payment-total-value">' + escapeHtml(totalText) + '</span>' +
        '    </div>';
    }

    var subtotalRowHtml = '';
    if (hasSubtotalDiscount) {
      subtotalRowHtml =
        '    <div class="ctwpml-payment-subtotal-row has-discount">' +
        '      <span class="ctwpml-payment-subtotal-label">Subtotal</span>' +
        '      <span class="ctwpml-payment-subtotal-value" id="ctwpml-payment-subtotal-value">' +
        '        <span class="ctwpml-payment-subtotal-original">' + escapeHtml(options.originalSubtotal) + '</span>' +
        '        <span class="ctwpml-payment-subtotal-discounted" id="ctwpml-payment-subtotal-discounted">' + escapeHtml(options.discountedSubtotal) + '</span>' +
        '      </span>' +
        '    </div>';
    } else {
      subtotalRowHtml =
        '    <div class="ctwpml-payment-subtotal-row">' +
        '      <span class="ctwpml-payment-subtotal-label">Subtotal</span>' +
        '      <span class="ctwpml-payment-subtotal-value" id="ctwpml-payment-subtotal-value">' + escapeHtml(subtotalText) + '</span>' +
        '    </div>';
    }

    var html =
      '' +
      '<div class="ctwpml-payment-screen ctwpml-ml-layout">' +
      '  <div class="ctwpml-ml-left">' +
      // IMPORTANTE: Não renderizar header/footer de página aqui.
      // O header único deve ser o do modal (ctwpml-modal-header).
      // Conteúdo abaixo é apenas a "tela interna".
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
      '        <div class="ctwpml-payment-icon">' +
      '          <img src="' + escapeHtml(boletoIconUrl) + '" alt="Boleto" />' +
      '        </div>' +
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
      '  </div>' + // left
      '  <div class="ctwpml-ml-right">' +
      // Summary/rodapé (vira coluna direita no desktop e footer no mobile)
      '  <div class="ctwpml-payment-footer">' +
      '    <span class="ctwpml-payment-coupon-link" id="ctwpml-payment-coupon">Inserir código do cupom</span>' +
      subtotalRowHtml +
      '    <div class="ctwpml-coupons-block" id="ctwpml-payment-coupons" style="display:none;"></div>' +
      totalRowHtml +
      '  </div>' +
      '  </div>' + // right
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
      '      <span class="ctwpml-coupon-ticket-icon"><img src="' + escapeHtml(pluginUrl + 'assets/img/icones/coupom-icon.svg') + '" alt="" width="18" height="18" /></span>' +
      '      <span class="ctwpml-coupon-insert-text">Inserir código</span>' +
      '    </div>' +
      '    <div class="ctwpml-coupon-input-wrapper">' +
      '      <input type="text" id="ctwpml-coupon-input" class="ctwpml-coupon-input" placeholder="Digite seu cupom" />' +
      '    </div>' +
      '    <button type="button" id="ctwpml-add-coupon-btn" class="ctwpml-add-coupon-btn" disabled>Adicionar cupom</button>' +
      '  </div>' +
      '</div>';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderPaymentScreen - HTML gerado (primeiros 300 chars):', html.substring(0, 300));
    }

    return html;
  };

  /**
   * Tela 4: "Revise e confirme"
   * Estrutura interna do modal (sem <html>/<head>/<body> e sem header duplicado).
   */
  window.CCCheckoutTabs.AddressMlScreens.renderReviewConfirmScreen = function renderReviewConfirmScreen(options) {
    options = options || {};
    var debugMode = !!(window.cc_params && window.cc_params.debug);
    var pluginUrl = (window.cc_params && window.cc_params.plugin_url) ? String(window.cc_params.plugin_url) : '';
    var billingIconUrl = options.billingIconUrl || (pluginUrl ? (pluginUrl + 'assets/img/icones/recipt.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bill.png');
    var shippingIconUrl = options.shippingIconUrl || (pluginUrl ? (pluginUrl + 'assets/img/icones/gps-1.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/gps-1.png');
    var paymentIconUrl = options.paymentIconUrl || (pluginUrl ? (pluginUrl + 'assets/img/icones/bank-card.svg') : 'https://cubensisstore.com.br/wp-content/uploads/2026/01/bank-card.png');
    var checkIconUrl = options.checkIconUrl || (pluginUrl ? (pluginUrl + 'assets/img/icones/check.svg') : '');

    var productCount = typeof options.productCount === 'number' ? options.productCount : 0;
    var subtotalText = options.subtotalText || '';
    var shippingText = options.shippingText || '';
    var totalText = options.totalText || '';
    var paymentLabel = options.paymentLabel || '';
    var billingName = options.billingName || '';
    var billingCpf = options.billingCpf || '';
    var addressTitle = options.addressTitle || '';
    var addressSubtitle = options.addressSubtitle || '';
    var thumbUrls = Array.isArray(options.thumbUrls) ? options.thumbUrls : [];
    var items = Array.isArray(options.items) ? options.items : [];

    // Bloco de entrega: removemos thumbs e usamos um ícone dinâmico (definido no JS do modal)
    var shipmentIconHtml = '<div class="ctwpml-review-shipment-icon" id="ctwpml-review-shipment-icon" aria-hidden="true"></div>';

    var itemsHtml = '';
    if (items.length) {
      itemsHtml = '<div class="ctwpml-review-products-list" id="ctwpml-review-products-list">';
      items.forEach(function (item) {
        if (!item) return;
        var name = item.name ? String(item.name) : '';
        var price = item.price ? String(item.price) : '';
        var qty = (typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity, 10)) || 0;
        var thumb = item.thumbnail ? String(item.thumbnail) : '';
        itemsHtml +=
          '<div class="ctwpml-review-product-item">' +
          '  <div class="ctwpml-review-product-thumb">' +
          (thumb ? ('    <img src="' + escapeHtml(thumb) + '" alt="Produto" />') : '') +
          '  </div>' +
          '  <div class="ctwpml-review-product-meta">' +
          '    <div class="ctwpml-review-product-name">' + escapeHtml(name) + '</div>' +
          '    <div class="ctwpml-review-product-qty">Qtd: ' + escapeHtml(String(qty)) + '</div>' +
          '  </div>' +
          '  <div class="ctwpml-review-product-price">' + escapeHtml(price) + '</div>' +
          '</div>';
      });
      itemsHtml += '</div>';
    }

    var html =
      '' +
      '<div class="ctwpml-review-screen">' +
      '  <div class="ctwpml-review-summary-top" id="ctwpml-review-initial-summary">' +
      '    <div class="ctwpml-review-errors" id="ctwpml-review-errors" style="display:none;"></div>' +
      '    <div class="ctwpml-review-row">' +
      '      <span>Produtos (' + escapeHtml(String(productCount)) + ')</span>' +
      '      <span id="ctwpml-review-products-subtotal">' + escapeHtml(subtotalText) + '</span>' +
      '    </div>' +
      '    <div class="ctwpml-review-row">' +
      '      <span>Frete</span>' +
      '      <span id="ctwpml-review-shipping">' + escapeHtml(shippingText) + '</span>' +
      '    </div>' +
      '    <div class="ctwpml-coupons-block ctwpml-coupons-block--review" id="ctwpml-review-coupons" style="display:none;"></div>' +
      '    <div class="ctwpml-review-total-row">' +
      '      <span>Você pagará</span>' +
      '      <span class="ctwpml-review-total-right" id="ctwpml-review-total-wrapper">' +
      '        <span class="ctwpml-review-original-total" id="ctwpml-review-original-total" style="display:none;"></span>' +
      '        <span id="ctwpml-review-total">' + escapeHtml(totalText) + '</span>' +
      '      </span>' +
      '    </div>' +
      '    <span class="ctwpml-review-pay-tag" id="ctwpml-review-pay-tag">' + escapeHtml(paymentLabel) + '</span>' +
      '    <div class="ctwpml-review-terms">' +
      '      <label class="ctwpml-review-terms-label">' +
      '        <input type="checkbox" id="ctwpml-review-terms" class="ctwpml-review-terms-checkbox" />' +
      '        <span>' + (function () { ' +
      '          try {' +
      '            var url = (window.cc_params && window.cc_params.privacy_policy_url) ? String(window.cc_params.privacy_policy_url) : \"\";' +
      '            if (url) {' +
      '              return \"Li e concordo com os termos e a <a class=\\\"ctwpml-privacy-link\\\" href=\\\"\" + escapeHtml(url) + \"\\\" target=\\\"_blank\\\" rel=\\\"noopener\\\">política de privacidade</a>.\";' +
      '            }' +
      '          } catch (e) {}' +
      '          return \"Li e concordo com os termos e a política de privacidade.\";' +
      '        }()) + '</span>' +
      '      </label>' +
      '    </div>' +
      '    <button type="button" class="ctwpml-review-btn-confirm" id="ctwpml-review-confirm">' +
      '      <span>Confirmar a compra</span>' +
      (checkIconUrl ? ('      <img src="' + escapeHtml(checkIconUrl) + '" class="ctwpml-success-icon" alt="Sucesso" aria-hidden="true" />') : '') +
      '    </button>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-review-section-label">Faturamento</div>' +
      '  <div class="ctwpml-review-card">' +
      '    <div class="ctwpml-review-card-header">' +
      '      <div class="ctwpml-review-card-icon" aria-hidden="true"><img src="' + escapeHtml(billingIconUrl) + '" alt="" /></div>' +
      '      <div class="ctwpml-review-card-content">' +
      '        <div class="ctwpml-review-card-title" id="ctwpml-review-billing-name">' + escapeHtml(billingName) + '</div>' +
      '        <div class="ctwpml-review-card-text" id="ctwpml-review-billing-cpf">' + escapeHtml(billingCpf) + '</div>' +
      '      </div>' +
      '    </div>' +
      '    <a href="#" class="ctwpml-review-change-link" id="ctwpml-review-change-billing">Modificar dados de faturamento</a>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-review-section-label">Detalhe da entrega</div>' +
      '  <div class="ctwpml-review-card">' +
      '    <div class="ctwpml-review-card-header">' +
      '      <div class="ctwpml-review-card-icon" aria-hidden="true"><img src="' + escapeHtml(shippingIconUrl) + '" alt="" /></div>' +
      '      <div class="ctwpml-review-card-content">' +
      '        <div class="ctwpml-review-card-title" id="ctwpml-review-address-title">' + escapeHtml(addressTitle) + '</div>' +
      '        <div class="ctwpml-review-card-text" id="ctwpml-review-address-subtitle">' + escapeHtml(addressSubtitle) + '</div>' +
      '        <a href="#" class="ctwpml-review-change-link ctwpml-review-change-link-inline" id="ctwpml-review-change-shipping">Alterar ou escolher outro endereço</a>' +
      '      </div>' +
      '    </div>' +
      '    <div class="ctwpml-review-shipment-detail">' +
      shipmentIconHtml +
      '      <div class="ctwpml-review-shipment-info">' +
      '        <div class="ctwpml-review-shipment-title" id="ctwpml-review-shipment-title"></div>' +
      '        <div class="ctwpml-review-shipment-eta" id="ctwpml-review-shipment-eta"></div>' +
      '        <div class="ctwpml-review-shipment-product" id="ctwpml-review-product-name"></div>' +
      '        <div class="ctwpml-review-shipment-qty" id="ctwpml-review-product-qty"></div>' +
      '      </div>' +
      '    </div>' +
      itemsHtml +
      '    <a href="#" class="ctwpml-review-change-link" id="ctwpml-review-change-address">Alterar ou escolher outro prazo de entrega</a>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-review-section-label">Detalhe do pagamento</div>' +
      '  <div class="ctwpml-review-card">' +
      '    <div class="ctwpml-review-card-header">' +
      '      <div class="ctwpml-review-card-icon" aria-hidden="true"><img src="' + escapeHtml(paymentIconUrl) + '" alt="" /></div>' +
      '      <div class="ctwpml-review-card-content">' +
      '        <div class="ctwpml-review-card-title" id="ctwpml-review-payment-method">' + escapeHtml(paymentLabel) + '</div>' +
      '        <div class="ctwpml-review-card-text" id="ctwpml-review-payment-amount">' + escapeHtml(totalText) + '</div>' +
      '        <div class="ctwpml-review-card-text ctwpml-review-card-hint">Ao confirmar a compra, você verá as informações para pagar.</div>' +
      '      </div>' +
      '    </div>' +
      '    <a href="#" class="ctwpml-review-change-link" id="ctwpml-review-change-payment">Alterar forma de pagamento</a>' +
      '  </div>' +
      '' +
      '  <div class="ctwpml-review-sticky-footer" id="ctwpml-review-sticky-footer">' +
      '    <div class="ctwpml-review-sticky-total-row">' +
      '      <span>Total</span>' +
      '      <span class="ctwpml-review-total-right" id="ctwpml-review-sticky-total-wrapper">' +
      '        <span class="ctwpml-review-original-total" id="ctwpml-review-sticky-original-total" style="display:none;"></span>' +
      '        <span id="ctwpml-review-sticky-total">' + escapeHtml(totalText) + '</span>' +
      '      </span>' +
      '    </div>' +
      '    <div class="ctwpml-review-terms ctwpml-review-terms--sticky">' +
      '      <label class="ctwpml-review-terms-label">' +
      '        <input type="checkbox" id="ctwpml-review-terms-sticky" class="ctwpml-review-terms-checkbox" />' +
      '        <span>' + (function () { ' +
      '          try {' +
      '            var url = (window.cc_params && window.cc_params.privacy_policy_url) ? String(window.cc_params.privacy_policy_url) : \"\";' +
      '            if (url) {' +
      '              return \"Li e concordo com os termos e a <a class=\\\"ctwpml-privacy-link\\\" href=\\\"\" + escapeHtml(url) + \"\\\" target=\\\"_blank\\\" rel=\\\"noopener\\\">política de privacidade</a>.\";' +
      '            }' +
      '          } catch (e) {}' +
      '          return \"Li e concordo com os termos e a política de privacidade.\";' +
      '        }()) + '</span>' +
      '      </label>' +
      '    </div>' +
      '    <button type="button" class="ctwpml-review-btn-confirm" id="ctwpml-review-confirm-sticky">' +
      '      <span>Confirmar a compra</span>' +
      (checkIconUrl ? ('      <img src="' + escapeHtml(checkIconUrl) + '" class="ctwpml-success-icon" alt="Sucesso" aria-hidden="true" />') : '') +
      '    </button>' +
      '  </div>' +
      '</div>';

    if (debugMode) {
      console.log('[CTWPML][DEBUG] renderReviewConfirmScreen - HTML gerado (primeiros 300 chars):', html.substring(0, 300));
    }

    return html;
  };
})(window);


