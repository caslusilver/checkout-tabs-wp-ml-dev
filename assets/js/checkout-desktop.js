(() => {
    'use strict';
    const media = window.matchMedia('(min-width: 1024px)'), config = window.ctwpmlDesktopConfig || {};
    let frame = null, cart = null, cartSignature = '', inFlight = false, dirty = false, requestTimer = null, updating = false;
    const mounts = new Map();
    const host = () => window.CCCheckoutTabs?.WooHost;
    const snapshot = () => window.CCCheckoutTabsState?.desktopSnapshot?.() || {};
    const text = (element, value) => { if (element && element.textContent !== String(value ?? '')) element.textContent = value ?? ''; };
    const node = (tag, value, className) => { const el = document.createElement(tag); if (value != null) el.textContent = value; if (className) el.className = className; return el; };
    const safeImage = value => /^https?:\/\//i.test(value || '') ? value : '';
    function decorate(container, entry = false) {
        if (mounts.has(container)) return;
        const brand = node('div', null, 'ctwpml-desktop-brand');
        brand.dataset.ctwpmlDesktopOwned = '1';
        const name = node('strong', config.name || 'Sua compra');
        if (safeImage(config.logo)) {
            const img = node('img'); img.src = config.logo; img.alt = config.name || 'Logo da loja';
            name.hidden = true; img.onerror = () => { img.hidden = true; name.hidden = false; };
            brand.append(img);
        }
        const home = node('a', null, 'ctwpml-desktop-home'); home.href = config.home || '/'; home.setAttribute('aria-label', 'Página inicial');
        home.target = '_blank'; home.rel = 'noopener noreferrer';
        Array.from(brand.children).forEach(child => home.append(child)); home.append(name);
        brand.append(home, node('span', 'Compra segura', 'ctwpml-desktop-secure'));
        if (config.logoHeight) home.style.setProperty('--ctwpml-logo-height', Number(config.logoHeight) + 'px');
        const nav = node('nav', null, 'ctwpml-desktop-steps'); nav.setAttribute('aria-label', 'Etapas da compra'); nav.dataset.ctwpmlDesktopOwned = '1';
        for (const [value, label] of [['auth','Identificação'],['address','Entrega'],['payment','Pagamento'],['review','Conferência']]) {
            const button = node('button', label); button.type = 'button'; button.dataset.desktopStep = value;
            nav.append(button);
        }
        const summary = node('aside', null, 'ctwpml-desktop-summary'); summary.dataset.ctwpmlDesktopOwned = '1'; summary.setAttribute('aria-label', 'Resumo da sua compra');
        summary.append(node('small', 'SUA COMPRA'), node('h2', 'Confira o que você escolheu'));
        const items = node('div', null, 'ctwpml-desktop-items');
        const values = node('div', null, 'ctwpml-desktop-totals');
        for (const [key, label] of [['subtotal','Produtos'],['shipping','Entrega'],['discount','Descontos'],['total','Total']]) {
            const row = node('div'); row.dataset.desktopValue = key; row.append(node('span', label), node('strong', 'A confirmar')); values.append(row);
        }
        const address = node('div', null, 'ctwpml-desktop-address');
        const note = node('p', '', 'ctwpml-desktop-note'); note.setAttribute('role','status');
        summary.append(items, values, address, note, node('p','Seus dados ficam protegidos','ctwpml-desktop-protection'));
        container.prepend(brand, nav, summary);
        if (entry) {
            const actions = node('div', null, 'ctwpml-desktop-entry-actions');
            Array.from(container.children).filter(el => el !== brand && el !== nav && el !== summary).forEach(el => actions.append(el));
            container.append(actions);
        }
        nav.addEventListener('click', event => {
            const button = event.target.closest('button[data-desktop-step]');
            if (!button || button.disabled) return;
            // Somente caminhos de retorno já implementados; nunca avançar pulando validações.
            const selector = button.dataset.desktopStep === 'payment' ? '#ctwpml-review-change-payment' : '#ctwpml-review-change-shipping';
            document.querySelector(selector)?.click();
        });
        mounts.set(container, { entry, brand, nav, summary, items, values, address, note, itemSignature: '' });
    }
    function viewStep(view) { return view === 'review' ? 'review' : view === 'payment' ? 'payment' : view === 'auth' ? 'auth' : 'address'; }
    function render() {
        frame = null;
        const overlay = document.getElementById('ctwpml-address-modal-overlay');
        const modal = overlay?.querySelector('.ctwpml-modal');
        const entry = document.querySelector('#ctwpml-passkey-entry .ctwpml-passkey-dialog');
        if (media.matches) { if (modal) decorate(modal); if (entry) decorate(entry, true); }
        const open = overlay && getComputedStyle(overlay).display !== 'none';
        document.body.classList.toggle('ctwpml-desktop-open', !!(media.matches && open));
        if (overlay && overlay.classList.contains('ctwpml-desktop') !== media.matches) overlay.classList.toggle('ctwpml-desktop', media.matches);
        if (!media.matches) return;
        const state = snapshot(), totals = host()?.readTotals?.() || {}, coupons = host()?.readCoupons?.() || [];
        for (const [container, ui] of mounts) {
            if (!container.isConnected) { mounts.delete(container); continue; }
            const stage = ui.entry ? 'auth' : state.view === 'auth' ? 'review' : viewStep(state.view);
            for (const button of ui.nav.querySelectorAll('button')) {
                const active = button.dataset.desktopStep === stage;
                if (button.getAttribute('aria-current') !== (active ? 'step' : 'false')) button.setAttribute('aria-current',active ? 'step' : 'false');
                button.disabled = ui.entry || state.view !== 'review' || !['address','payment'].includes(button.dataset.desktopStep);
            }
            if (cart && ui.itemSignature !== cartSignature) {
                ui.items.replaceChildren();
                for (const product of cart.items || []) {
                    const row = node('div', null, 'ctwpml-desktop-item');
                    if (safeImage(product.thumbnail)) { const image = node('img'); image.src = product.thumbnail; image.alt = ''; row.append(image); }
                    const detail = node('div'); detail.append(node('strong', product.name), node('small', 'Quantidade: ' + product.quantity));
                    row.append(detail, node('strong', product.price)); ui.items.append(row);
                }
                if (!ui.items.children.length) text(ui.items, 'Os itens serão conferidos na etapa final.');
                ui.itemSignature = cartSignature;
            }
            if (!cart) text(ui.items, 'Carregando itens da compra…');
            const value = key => ui.values.querySelector('[data-desktop-value="'+key+'"] strong');
            text(value('subtotal'), totals.subtotalText || cart?.subtotal || 'A confirmar');
            text(value('shipping'), state.shipping ? (totals.shippingText || 'Atualizando…') : 'A escolher');
            text(value('total'), updating ? 'Atualizando…' : totals.totalText || cart?.total || 'A confirmar');
            const discount = coupons.map(coupon => coupon.code + ': ' + coupon.amountText).join(' · ');
            ui.values.querySelector('[data-desktop-value=discount]').hidden = !discount;
            text(value('discount'), discount);
            const selected = state.address;
            const line = selected ? [selected.address_1,selected.number,selected.complement,selected.neighborhood,selected.city,selected.state].filter(Boolean).join(' · ') : '';
            ui.address.hidden = ui.entry || !line;
            text(ui.address, line ? 'Entrega: ' + line : '');
            text(ui.note, updating ? 'Atualizando os valores da compra…' : '');
        }
        if (!cart && !inFlight) loadCart();
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(render); }
    async function loadCart() {
        if (!media.matches || !host()?.getCartThumbs) return;
        if (inFlight) { dirty = true; return; }
        inFlight = true;
        try { cart = await host().getCartThumbs(); cartSignature = JSON.stringify(cart.items || []); }
        catch (_) { if (!cart) { cart = {items:[]}; cartSignature = '[]'; } }
        finally { inFlight = false; schedule(); if (dirty) { dirty=false; refreshCart(); } }
    }
    function refreshCart() { clearTimeout(requestTimer); requestTimer = setTimeout(loadCart,150); schedule(); }
    const observed = new WeakSet();
    function attach() {
        for (const target of [document.getElementById('ctwpml-address-modal-overlay'),document.getElementById('ctwpml-passkey-entry')]) {
            if (!target || observed.has(target)) continue;
            observed.add(target);
            new MutationObserver(records => {
                if (records.some(record => !(record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest('[data-ctwpml-desktop-owned]'))) schedule();
            }).observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});
        }
        schedule();
    }
    // Observar criação/substituição do checkout, sem polling nem alteração dos campos editáveis.
    new MutationObserver(records => {
        if (records.some(record => Array.from(record.addedNodes).some(el => el.nodeType === 1 && (el.id === 'ctwpml-address-modal-overlay' || el.id === 'ctwpml-passkey-entry' || el.querySelector?.('#ctwpml-address-modal-overlay,#ctwpml-passkey-entry'))))) attach();
    }).observe(document.body,{childList:true,subtree:true});
    if (window.jQuery) {
        window.jQuery(document.body).on('update_checkout.ctwpmlDesktop', () => { updating=true; schedule(); });
        window.jQuery(document.body).on('updated_checkout.ctwpmlDesktop ctwpml_woo_updated.ctwpmlDesktop applied_coupon_in_checkout.ctwpmlDesktop removed_coupon_in_checkout.ctwpmlDesktop', () => { updating=false; refreshCart(); });
        window.jQuery(document).on('ctwpml_address_selected.ctwpmlDesktop', schedule);
    }
    media.addEventListener('change', () => { if (media.matches) refreshCart(); schedule(); });
    attach();
})();
