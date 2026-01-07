(function (window) {
  'use strict';

  function hasJQ() {
    return typeof window.jQuery === 'function';
  }

  function isDebug() {
    return !!(window.cc_params && window.cc_params.debug);
  }

  function log(msg, data) {
    if (!isDebug()) return;
    try {
      console.log('[CTWPML][PREPARE] ' + msg, data || '');
    } catch (e) {}
  }

  function isCheckout() {
    return !!(document && document.body && document.body.classList && document.body.classList.contains('woocommerce-checkout'));
  }

  function isProductOrCart() {
    if (!document || !document.body || !document.body.classList) return false;
    return (
      document.body.classList.contains('single-product') ||
      document.body.classList.contains('woocommerce-cart')
    );
  }

  var SS_KEY_ENTER = 'ctwpml_prepare_on_checkout';
  var SS_KEY_DONE = 'ctwpml_prepare_done_for_checkout_entry';
  var SS_KEY_LAST_ADDR = 'ctwpml_prepare_last_address_id';

  function setPrepareFlag() {
    try {
      window.sessionStorage.setItem(SS_KEY_ENTER, '1');
      window.sessionStorage.removeItem(SS_KEY_DONE);
      log('Prepare flag set (will show overlay on checkout).');
    } catch (e) {}
  }

  function hasPrepareFlag() {
    try {
      return window.sessionStorage.getItem(SS_KEY_ENTER) === '1' && window.sessionStorage.getItem(SS_KEY_DONE) !== '1';
    } catch (e) {
      return false;
    }
  }

  function markPrepareDone() {
    try {
      window.sessionStorage.setItem(SS_KEY_DONE, '1');
      window.sessionStorage.removeItem(SS_KEY_ENTER);
    } catch (e) {}
  }

  function getLastPreparedAddressId() {
    try {
      return window.sessionStorage.getItem(SS_KEY_LAST_ADDR) || '';
    } catch (e) {
      return '';
    }
  }

  function setLastPreparedAddressId(id) {
    try {
      window.sessionStorage.setItem(SS_KEY_LAST_ADDR, String(id || ''));
    } catch (e) {}
  }

  function ensureOverlay() {
    var el = document.getElementById('ctwpml-preparing-overlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'ctwpml-preparing-overlay';
    el.className = 'ctwpml-preparing-overlay';
    el.innerHTML =
      '' +
      '<div class="ctwpml-preparing-center">' +
      '  <div class="ctwpml-preparing-title">Preparando tudo para sua compra</div>' +
      '  <div class="ctwpml-preparing-spinner" aria-hidden="true"></div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function showOverlay() {
    var el = ensureOverlay();
    el.classList.add('is-visible');
  }

  function hideOverlay() {
    var el = ensureOverlay();
    el.classList.remove('is-visible');
  }

  function ajaxPost(data) {
    return new Promise(function (resolve, reject) {
      if (!hasJQ()) return reject(new Error('jQuery indisponível'));
      if (!window.cc_params || !window.cc_params.ajax_url) return reject(new Error('cc_params.ajax_url indisponível'));
      window.jQuery.ajax({
        url: window.cc_params.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: data,
        success: function (resp) {
          resolve(resp);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          reject({ jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown });
        },
      });
    });
  }

  function callWebhookConsultaEnderecoFrete(address, contact) {
    return new Promise(function (resolve, reject) {
      if (!hasJQ()) return reject(new Error('jQuery indisponível'));
      var url = window.cc_params && window.cc_params.webhook_url ? window.cc_params.webhook_url : '';
      if (!url) return reject(new Error('cc_params.webhook_url indisponível'));

      var payload = {
        cep: (address && address.cep) ? String(address.cep).replace(/\D/g, '') : '',
        evento: 'consultaEnderecoFrete',
        whatsapp: (contact && contact.whatsapp) ? String(contact.whatsapp) : '',
        cpf: (contact && contact.cpf) ? String(contact.cpf) : '',
        nome: (address && address.receiver_name) ? String(address.receiver_name) : '',
      };

      log('Chamando webhook consultaEnderecoFrete', payload);

      window.jQuery.ajax({
        url: url,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        timeout: 20000,
        crossDomain: true,
        xhrFields: { withCredentials: false },
        data: JSON.stringify(payload),
        success: function (resp) {
          resolve(resp);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          reject({ jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown });
        },
      });
    });
  }

  function normalizeWebhookPayload(raw) {
    try {
      if (Array.isArray(raw) && raw.length) return raw[0] || null;
    } catch (e) {}
    return raw;
  }

  function extractShippingOptionsCount(resp) {
    try {
      if (resp && resp.success && resp.data && Array.isArray(resp.data.options)) return resp.data.options.length;
    } catch (e) {}
    return 0;
  }

  // Prepara um endereço específico: garante que exista payload (se não existir, chama webhook e salva),
  // e que ctwpml_get_shipping_options retorne opções.
  function prepareForAddress(address) {
    var addressId = address && address.id ? String(address.id) : '';
    if (!addressId) return Promise.reject(new Error('address.id ausente'));

    log('Preparando para address_id=' + addressId);

    return ajaxPost({
      action: 'ctwpml_get_shipping_options',
      _ajax_nonce: window.cc_params.shipping_options_nonce,
      address_id: addressId,
    }).then(function (resp) {
      var count = extractShippingOptionsCount(resp);
      log('get_shipping_options (antes) count=' + count, resp);
      if (count > 0) return { ok: true, addressId: addressId, options: resp.data.options };

      // Sem opções: tentar chamar webhook e salvar payload por address_id
      return ajaxPost({
        action: 'ctwpml_get_contact_meta',
        _ajax_nonce: window.cc_params.addresses_nonce,
      })
        .then(function (contactResp) {
          var contact = (contactResp && contactResp.success && contactResp.data) ? contactResp.data : {};
          return callWebhookConsultaEnderecoFrete(address, contact);
        })
        .then(function (webhookRaw) {
          var normalized = normalizeWebhookPayload(webhookRaw);
          log('Webhook retorno (normalizado)', normalized);
          return ajaxPost({
            action: 'ctwpml_save_address_payload',
            _ajax_nonce: window.cc_params.address_payload_nonce,
            address_id: addressId,
            raw_json: JSON.stringify(webhookRaw),
            normalized_json: JSON.stringify(normalized),
          });
        })
        .then(function (saveResp) {
          log('save_address_payload resp', saveResp);
          return ajaxPost({
            action: 'ctwpml_get_shipping_options',
            _ajax_nonce: window.cc_params.shipping_options_nonce,
            address_id: addressId,
          });
        })
        .then(function (resp2) {
          var count2 = extractShippingOptionsCount(resp2);
          log('get_shipping_options (depois) count=' + count2, resp2);
          return { ok: count2 > 0, addressId: addressId, options: (resp2.data && resp2.data.options) ? resp2.data.options : [] };
        });
    });
  }

  function autoOpenAddressModal() {
    try {
      if (window.CCCheckoutTabsState && typeof window.CCCheckoutTabsState.openAddressModal === 'function') {
        log('Auto-abrindo modal via CCCheckoutTabsState.openAddressModal()');
        window.CCCheckoutTabsState.openAddressModal();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isLoggedIn() {
    return !!(window.cc_params && window.cc_params.is_logged_in);
  }

  function initCheckoutPreparation() {
    if (!isCheckout()) return;
    if (!window.cc_params || !window.cc_params.ajax_url) return;

    // Só roda automaticamente se veio do Produto/Carrinho nesta entrada do checkout.
    if (!hasPrepareFlag()) return;

    // Verificar se o usuário está logado ANTES de mostrar o overlay.
    // Se não estiver logado, não mostra o spinning (o popup de login vai aparecer via modal).
    if (!isLoggedIn()) {
      log('Usuário não logado - não mostra overlay (popup de login será exibido pelo modal)');
      markPrepareDone();
      // Deixa o modal lidar com o login; não auto-abre aqui.
      return;
    }

    // Usuário está logado: mostra overlay, prepara o primeiro endereço, depois abre modal.
    log('Usuário logado - iniciando preparação do checkout');
    showOverlay();

    ajaxPost({ action: 'ctwpml_get_addresses', _ajax_nonce: window.cc_params.addresses_nonce })
      .then(function (resp) {
        var items = resp && resp.success && resp.data && Array.isArray(resp.data.items) ? resp.data.items : [];
        var first = items[0] || null;
        if (!first) throw new Error('Nenhum endereço cadastrado para preparar');
        log('Primeiro endereço encontrado: ' + first.id, first);
        setLastPreparedAddressId(first.id);
        return prepareForAddress(first);
      })
      .then(function (result) {
        log('Preparação inicial concluída', result);
      })
      .catch(function (err) {
        log('Preparação inicial falhou (seguindo sem bloquear)', err);
      })
      .finally(function () {
        hideOverlay();
        markPrepareDone();
        // Auto-abrir modal após terminar a preparação (mesmo que tenha falhado, para usuário agir)
        autoOpenAddressModal();
      });
  }

  function bindPrepareOnBuyRedirect() {
    if (!isProductOrCart()) return;
    if (!hasJQ()) return;

    // Cart: botão padrão do WooCommerce
    window.jQuery(document).on('click', 'a.checkout-button, .checkout-button', function () {
      setPrepareFlag();
    });

    // Product: se o tema redireciona ao checkout via botão custom, tentamos capturar links que apontem para checkout
    window.jQuery(document).on('click', 'a[href*="/checkout"], a[href*="checkout"]', function () {
      setPrepareFlag();
    });
  }

  // Força chamada ao webhook para um endereço (sempre, para garantir dados atualizados).
  // Similar ao que acontece quando o usuário salva um endereço.
  function forceRefreshPayloadForAddress(address) {
    var addressId = address && address.id ? String(address.id) : '';
    if (!addressId) return Promise.reject(new Error('address.id ausente'));

    log('Forçando atualização de payload para address_id=' + addressId);

    // Sempre chama webhook e salva (não verifica se já existe payload)
    return ajaxPost({
      action: 'ctwpml_get_contact_meta',
      _ajax_nonce: window.cc_params.addresses_nonce,
    })
      .then(function (contactResp) {
        var contact = (contactResp && contactResp.success && contactResp.data) ? contactResp.data : {};
        log('Contact meta obtido', contact);
        return callWebhookConsultaEnderecoFrete(address, contact);
      })
      .then(function (webhookRaw) {
        var normalized = normalizeWebhookPayload(webhookRaw);
        log('Webhook retorno (normalizado) para troca de endereço', normalized);
        return ajaxPost({
          action: 'ctwpml_save_address_payload',
          _ajax_nonce: window.cc_params.address_payload_nonce,
          address_id: addressId,
          raw_json: JSON.stringify(webhookRaw),
          normalized_json: JSON.stringify(normalized),
        });
      })
      .then(function (saveResp) {
        log('Payload salvo após troca de endereço', saveResp);
        return { ok: true, addressId: addressId };
      });
  }

  // Quando usuário troca endereço selecionado no modal, prepara novamente (spinner reaparece só durante a troca).
  // SEMPRE chama o webhook ao trocar, como se estivesse salvando o endereço.
  function bindReprepareOnAddressChange() {
    if (!isCheckout()) return;
    if (!hasJQ()) return;

    window.jQuery(document).on('ctwpml_address_selected', function (e, addressId) {
      var newId = String(addressId || '');
      var lastId = getLastPreparedAddressId();
      if (!newId || newId === lastId) return;

      log('Endereço trocado: ' + lastId + ' -> ' + newId + ' - chamando webhook para atualizar payload');
      showOverlay();

      ajaxPost({ action: 'ctwpml_get_addresses', _ajax_nonce: window.cc_params.addresses_nonce })
        .then(function (resp) {
          var items = resp && resp.success && resp.data && Array.isArray(resp.data.items) ? resp.data.items : [];
          var found = null;
          for (var i = 0; i < items.length; i++) {
            if (String(items[i].id || '') === newId) {
              found = items[i];
              break;
            }
          }
          if (!found) throw new Error('Endereço selecionado não encontrado na lista');
          
          // Sempre força atualização do payload (como se estivesse salvando)
          return forceRefreshPayloadForAddress(found);
        })
        .then(function (result) {
          log('Re-preparação concluída (payload atualizado)', result);
          setLastPreparedAddressId(newId);
        })
        .catch(function (err) {
          log('Re-preparação falhou', err);
        })
        .finally(function () {
          hideOverlay();
        });
    });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindPrepareOnBuyRedirect();
      bindReprepareOnAddressChange();
      initCheckoutPreparation();
    });
  } else {
    bindPrepareOnBuyRedirect();
    bindReprepareOnAddressChange();
    initCheckoutPreparation();
  }
})(window);


