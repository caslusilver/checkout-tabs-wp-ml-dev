(function (window) {
  window.CCCheckoutTabs = window.CCCheckoutTabs || {};

  function getParams() {
    return window.cc_params || {};
  }

  function getAjaxUrl() {
    return String(getParams().ajax_url || '');
  }

  function getBlocksNonce() {
    return String(getParams().checkout_blocks_nonce || '');
  }

  function getCartThumbsNonce() {
    return String(getParams().cart_thumbs_nonce || '');
  }

  function isDebug() {
    return !!(getParams().debug);
  }

  function log(msg, data) {
    if (!isDebug()) return;
    try {
      console.log('[CTWPML][WOO_HOST] ' + msg, data || '');
    } catch (e) {}
  }

  function getCheckoutFormEl() {
    return document.querySelector('body.woocommerce-checkout form.checkout') || document.querySelector('form.checkout');
  }

  function ensureHiddenBlocksRoot() {
    var form = getCheckoutFormEl() || document.querySelector('.woocommerce-checkout') || document.body;
    if (!form) return null;

    var existing = form.querySelector('#ctwpml-wc-hidden-blocks');
    if (existing) return existing;

    var root = document.createElement('div');
    root.id = 'ctwpml-wc-hidden-blocks';
    // Não usar display:none (pode quebrar scripts de gateway que dependem de visibilidade).
    // Mantemos offscreen/invisível, mas presente no DOM.
    root.style.position = 'fixed';
    root.style.left = '-99999px';
    root.style.top = '-99999px';
    root.style.width = '1px';
    root.style.height = '1px';
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden', 'true');
    form.appendChild(root);
    return root;
  }

  function ajaxPost(data) {
    return new Promise(function (resolve, reject) {
      if (!window.jQuery) return reject(new Error('jQuery ausente'));
      var $ = window.jQuery;
      $.ajax({
        url: getAjaxUrl(),
        type: 'POST',
        dataType: 'json',
        data: data,
        success: function (resp) { resolve(resp); },
        error: function (xhr, status, err) { reject({ xhr: xhr, status: status, err: err }); },
      });
    });
  }

  function fetchBlock(action) {
    var nonce = getBlocksNonce();
    if (!getAjaxUrl() || !nonce) return Promise.reject(new Error('Parâmetros de blocks ausentes'));
    return ajaxPost({ action: action, _ajax_nonce: nonce });
  }

  function hasPaymentInDom() {
    return !!document.querySelector('#payment input[name="payment_method"]');
  }

  function hasReviewInDom() {
    return !!document.querySelector('#order_review') || !!document.querySelector('.woocommerce-checkout-review-order-table');
  }

  function hasCouponInDom() {
    return !!document.querySelector('form.checkout_coupon') || !!document.querySelector('#woocommerce-checkout-form-coupon');
  }

  async function ensureBlocks() {
    var root = ensureHiddenBlocksRoot();
    if (!root) {
      log('ensureBlocks() - sem form.checkout, não cria host');
      return { ok: false, reason: 'no_form' };
    }

    // Evitar duplicar IDs do Woo: só injeta se o bloco não existir na página.
    var needsPayment = !hasPaymentInDom();
    var needsReview = !hasReviewInDom();
    var needsCoupon = !hasCouponInDom();

    var tasks = [];
    if (needsPayment) tasks.push(fetchBlock('ctwpml_get_payment_block').then(function (r) { return { k: 'payment', r: r }; }));
    if (needsReview) tasks.push(fetchBlock('ctwpml_get_review_block').then(function (r) { return { k: 'review', r: r }; }));
    if (needsCoupon) tasks.push(fetchBlock('ctwpml_get_coupon_block').then(function (r) { return { k: 'coupon', r: r }; }));

    if (!tasks.length) {
      log('ensureBlocks() - DOM já possui payment/review/coupon, nada a injetar');
      return { ok: true, injected: false };
    }

    var results = await Promise.allSettled(tasks);
    results.forEach(function (it) {
      if (it.status !== 'fulfilled') return;
      var k = it.value.k;
      var resp = it.value.r || {};
      if (!resp.success) {
        log('ensureBlocks() - falha ao obter bloco: ' + k, resp);
        return;
      }
      var html = (resp.data && typeof resp.data.html === 'string') ? resp.data.html : '';
      if (k === 'coupon' && html === '') {
        // cupons desabilitados → ok
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'ctwpml-wc-block ctwpml-wc-block-' + k;
      wrap.innerHTML = html;
      root.appendChild(wrap);
    });

    return { ok: true, injected: true };
  }

  function getPaymentRoot() {
    // Preferir o bloco real do tema (#payment). Se não existir, o injetado estará no root escondido.
    return document.querySelector('#payment') || document.querySelector('#ctwpml-wc-hidden-blocks #payment');
  }

  function getReviewRoot() {
    return document.querySelector('#order_review') || document.querySelector('#ctwpml-wc-hidden-blocks #order_review') || document.querySelector('#ctwpml-wc-hidden-blocks .woocommerce-checkout-review-order');
  }

  function normalizeText(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function listGateways() {
    var root = getPaymentRoot();
    if (!root) return [];
    var inputs = root.querySelectorAll('input[name="payment_method"]');
    var out = [];
    inputs.forEach(function (input) {
      var id = String(input.value || '');
      var label = root.querySelector('label[for="payment_method_' + CSS.escape(id) + '"]');
      var labelText = label ? label.textContent : '';
      out.push({
        id: id,
        text: normalizeText(labelText),
        rawLabel: labelText || id,
      });
    });
    return out;
  }

  function matchGatewayId(kind) {
    var gateways = listGateways();
    if (!gateways.length) return '';

    var needles = [];
    if (kind === 'pix') needles = ['pix'];
    if (kind === 'boleto') needles = ['boleto', 'bank slip', 'bankslip'];
    if (kind === 'card') needles = ['cartao', 'credito', 'credit', 'card'];

    for (var i = 0; i < gateways.length; i++) {
      var g = gateways[i];
      for (var j = 0; j < needles.length; j++) {
        if (g.text.indexOf(needles[j]) !== -1) return g.id;
      }
    }
    return '';
  }

  function selectGateway(gatewayId) {
    var root = getPaymentRoot();
    if (!root || !gatewayId) return false;
    var input = root.querySelector('input[name="payment_method"][value="' + CSS.escape(gatewayId) + '"]');
    if (!input) return false;
    input.checked = true;
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    return true;
  }

  function getSelectedGatewayId() {
    var root = getPaymentRoot();
    if (!root) return '';
    var checked = root.querySelector('input[name="payment_method"]:checked');
    return checked ? String(checked.value || '') : '';
  }

  function getSelectedGatewayLabel() {
    var id = getSelectedGatewayId();
    if (!id) return '';
    var root = getPaymentRoot();
    if (!root) return '';
    var label = root.querySelector('label[for="payment_method_' + CSS.escape(id) + '"]');
    return label ? String(label.textContent || '').trim() : id;
  }

  function readTotals() {
    var root = getReviewRoot() || document;
    var subtotalEl = root.querySelector('tr.cart-subtotal td');
    var shippingEl = root.querySelector('tr.shipping td, tr.shipping th, .woocommerce-shipping-totals td');
    var totalEl = root.querySelector('tr.order-total td') || root.querySelector('.order-total .woocommerce-Price-amount');

    return {
      subtotalText: subtotalEl ? subtotalEl.textContent.trim() : '',
      shippingText: shippingEl ? shippingEl.textContent.trim() : '',
      totalText: totalEl ? totalEl.textContent.trim() : '',
    };
  }

  async function getCartThumbs() {
    var nonce = getCartThumbsNonce();
    if (!getAjaxUrl() || !nonce) return { thumb_urls: [], count: 0 };
    var resp = await ajaxPost({ action: 'ctwpml_get_cart_thumbs', _ajax_nonce: nonce });
    if (!resp || !resp.success || !resp.data) return { thumb_urls: [], count: 0 };
    return {
      thumb_urls: Array.isArray(resp.data.thumb_urls) ? resp.data.thumb_urls.slice(0, 3) : [],
      count: Number(resp.data.count || 0),
    };
  }

  window.CCCheckoutTabs.WooHost = {
    ensureBlocks: ensureBlocks,
    listGateways: listGateways,
    matchGatewayId: matchGatewayId,
    selectGateway: selectGateway,
    getSelectedGatewayId: getSelectedGatewayId,
    getSelectedGatewayLabel: getSelectedGatewayLabel,
    readTotals: readTotals,
    getCartThumbs: getCartThumbs,
    hasCheckoutForm: function () { return !!getCheckoutFormEl(); },
  };
})(window);

