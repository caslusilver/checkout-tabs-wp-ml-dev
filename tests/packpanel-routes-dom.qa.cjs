// Run with node --test and jquery@3/jsdom@26 available via NODE_PATH.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');
const jquery = require('jquery');

test('routing preserves edits and copies the correct stop in both tabs', async t => {
    const orders = [101, 102, 103, 104].map((id, index) => ({
        id, number: String(id), name: 'Pessoa ' + id, address: 'Rua ' + id,
        delivery_message: 'Nome: Pessoa ' + id + '\nEndereço: Rua ' + id,
        position: index + 1, shipping_paid: 70, currency: 'BRL', delivery_state: 'on_route'
    }));
    const cards = orders.map(order => `<article class="motoboy-order" data-order-id="${order.id}">
        <div class="ppwoo-fold-head"><input type="checkbox" class="ppwoo-route-pick"><button class="ppwoo-fold-button"></button></div>
        <input class="tracking-link"><textarea class="ppwoo-delivery-message">${order.delivery_message}</textarea>
        <button class="ppwoo-copy-delivery">Copiar</button></article>`).join('');
    const markup = `<div class="painel-empacotamento"><nav class="painel-tabs">
        <button class="tab-button" data-tab="motoboy">Motoboy</button><button class="tab-button" data-tab="rotas">Rotas</button>
        <button class="tab-button" data-tab="em-rota">Em rota</button></nav>
        <div id="tab-motoboy" class="tab-content"><button data-fold-all></button><input type="checkbox" data-select-motoboy-all>
        <button data-calculate-selected disabled></button><p data-route-feedback></p>${cards}</div>
        <div id="tab-rotas" class="tab-content"><p data-route-feedback></p><div data-routes-preview></div><div data-routes-drafts></div></div>
        <div id="tab-em-rota" class="tab-content"><p data-route-feedback></p><div data-routes-active></div><div data-routes-history-list></div></div></div>`;
    const { window } = new JSDOM(markup, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://test.example.test/pack' });
    t.after(() => window.close());
    const $ = window.$ = window.jQuery = jquery(window);
    const visible = $.expr.pseudos.visible;
    $.expr.pseudos.visible = node => node.classList.contains('ppwoo-route-map') || visible(node);
    const mapLabels = [];
    const draw = () => {};
    window.HTMLCanvasElement.prototype.getContext = () => ({
        scale: draw, beginPath: draw, moveTo: draw, lineTo: draw, stroke: draw, arc: draw, fill: draw,
        fillText: label => mapLabels.push(label)
    });
    const origin = { lat: -23.55, lng: -46.63 };
    const locations = orders.map((_, index) => ({ lat: -23.56 + index / 1000, lng: -46.62 + index / 1000 }));
    const calculation = { token: 'one', issues: [], distance_meters: 1500, duration_seconds: 450,
        origin, path: [origin, ...locations],
        stops: orders.map((order, index) => ({ order_id: order.id, eta_seconds: order.position * 100, location: locations[index] })) };
    let state = { routes: [] };
    const requests = [];
    const clipboard = [];
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: value => { clipboard.push(value); return Promise.resolve(); } } });
    window.PPWOO = { ajax_url: '/admin-ajax.php', nonce: 'fixture' };
    window.PPWOO_ROUTES = { max_batch: 80 };
    $.ajax = async ({ data }) => {
        const { command, ...input } = JSON.parse(data.payload);
        requests.push({ command, input });
        if (command === 'plan') return { success: true, data: { ...state, calculation, orders } };
        if (command === 'group') {
            const stops = [...(state.routes[0]?.stops || []), orders.find(order => order.id === input.order_id)];
            state = { routes: [{ ...state.routes[0], id: 1, slot: 1, revision: stops.length, state: 'draft', calculation, stops }] };
        }
        if (command === 'save') {
            state.routes[0].sheet = input.sheet;
            state.routes[0].revision++;
            state.routes[0].stops.forEach(order => { order.cost = input.sheet.costs[order.id]; });
        }
        if (command === 'dispatch') {
            state.routes[0].state = 'dispatched';
            state.routes[0].stops[0].event_state = 'uncertain';
        }
        if (command === 'close') state.routes[0].stops[0].delivery_state = 'closed';
        return { success: true, data: state };
    };
    for (const script of ['panel.js', 'routes.js']) {
        window.eval(readFileSync(join(__dirname, '../packing-panel-woo-dev/assets/js', script), 'utf8'));
    }
    const until = async predicate => {
        for (let attempt = 0; attempt < 50 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(predicate(), 'UI did not reach the expected state');
    };
    await until(() => requests.length && $('[data-fold-all]').text() === 'Recolher todos');
    $('#tab-motoboy [data-order-id="104"] .ppwoo-copy-delivery').trigger('click');
    assert.equal(clipboard.pop(), orders[3].delivery_message);
    $('[data-fold-all]').trigger('click');
    assert.equal($('.ppwoo-card-collapsed').length, 4);
    $('[data-select-motoboy-all]').prop('checked', true).trigger('change');
    $('[data-calculate-selected]').trigger('click');
    await until(() => $('[data-group-order="101"]').length === 1);
    assert.deepEqual(requests.find(r => r.command === 'plan').input.order_ids, [101, 102, 103, 104]);
    await until(() => $('[data-routes-preview] canvas').length === 1);
    assert.deepEqual(mapLabels, ['O', '1', '2', '3', '4']);
    assert.equal($('script[src*="maps.googleapis.com"]').length, 0);

    async function group(id, count) {
        $('[data-routes-preview] [data-group-order="' + id + '"]').val('1').trigger('change');
        await until(() => $('[data-routes-drafts] .ppwoo-route-order').length === count);
    }
    await group(101, 1);
    $('[data-sheet-field="link"]').val('https://test.example.test/entrega').trigger('input');
    await group(102, 2);
    assert.equal($('[data-sheet-field="link"]').val(), 'https://test.example.test/entrega');
    assert.equal($('#tab-motoboy [data-order-id="101"]').prop('hidden'), false);
    assert.match($('#tab-motoboy [data-order-id="101"] .ppwoo-membership').text(), /Rota 1/);
    for (const [index, button] of $('[data-routes-drafts] .ppwoo-copy-delivery').toArray().entries()) {
        button.closest('details').open = true;
        button.click();
        assert.equal(clipboard.pop(), orders[index].delivery_message);
    }

    // Exercise the shared pointer handler without relying on browser layout in JSDOM.
    function slide(control, distance) {
        Object.defineProperty(control, 'clientWidth', { configurable: true, value: 320 });
        Object.defineProperty(control.querySelector('.ppwoo-swipe-thumb'), 'offsetWidth', { configurable: true, value: 44 });
        control.getBoundingClientRect = () => ({ left: 0, right: 320, width: 320 });
        for (const [event, x] of [['pointerdown', 20], ['pointermove', 20 + distance], ['pointerup', 20 + distance]]) {
            const target = event === 'pointerdown' ? control.querySelector('.ppwoo-swipe-thumb') : window.document;
            const pointer = new window.MouseEvent(event, { bubbles: true, cancelable: true, clientX: x, button: 0 });
            Object.defineProperty(pointer, 'pointerId', { value: 1 });
            target.dispatchEvent(pointer);
        }
    }
    await group(103, 3);
    await group(104, 4);
    $('[data-sheet-field="phone"]').val('11900000000').trigger('input');
    $('[data-sheet-field="code"]').val('4321').trigger('input');
    $('[data-sheet-cost]').val('20').trigger('input');
    await until(() => !$('[data-dispatch-route]')[0].disabled);
    const send = $('[data-dispatch-route]')[0];
    slide(send, 0);
    slide(send, 90);
    assert.equal(requests.filter(r => r.command === 'dispatch').length, 0);
    slide(send, 300);
    await until(() => $('[data-routes-active] .ppwoo-copy-delivery').length === 4);
    assert.equal(requests.filter(r => r.command === 'dispatch').length, 1);
    assert.match($('[data-routes-active]').text(), /Envio sem confirmação/);
    assert.equal($('[data-retry-order], [data-resume-route]').length, 0);
    $('[data-routes-active] .ppwoo-copy-delivery').last().trigger('click');
    assert.equal(clipboard.pop(), orders[3].delivery_message);
    $('[data-close-order="101"]').prop('checked', true).trigger('change');
    slide($('[data-close-route]')[0], 300);
    await until(() => !$('[data-close-order="101"]').length);
    assert.deepEqual(requests.find(r => r.command === 'close').input.order_ids, [101]);
    assert.equal($('[data-close-order]').length, 3);
});

test('autosave serializes edits, exposes failures and preserves a loaded map and global privacy', async t => {
    const markup = `<div class="painel-empacotamento">
        <div id="tab-motoboy" class="tab-content"><button data-calculate-selected></button></div>
        <div id="tab-rotas" class="tab-content active"><button data-reload-routes></button><p data-route-feedback></p>
        <div data-routes-preview></div><div data-routes-drafts></div></div>
        <div id="tab-em-rota" class="tab-content"><div data-routes-active></div><div data-routes-history-list></div></div></div>`;
    const { window } = new JSDOM(markup, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://test.example.test/pack' });
    t.after(() => window.close());
    const $ = window.$ = window.jQuery = jquery(window);
    $.expr.pseudos.visible = () => true;
    let fitted = 0;
    window.google = { maps: {
        Map: class { fitBounds() { fitted++; } },
        OverlayView: class { setMap() {} },
        Polyline: class { setMap() {} },
        LatLngBounds: class { extend() {} },
        event: { clearInstanceListeners() {} }
    } };
    const order = { id: 101, number: '101', name: 'Pessoa fictícia', address: 'Endereço fictício',
        phone: '123456789', dial_code: '+33', phone_country: 'FR', position: 1, cost: '', shipping_paid: 70 };
    const calc = { token: 'stable', issues: [], distance_meters: 25700, duration_seconds: 7860,
        destination_order_id: 101, origin: { lat: -23.5, lng: -46.6 },
        path: [{ lat: -23.5, lng: -46.6 }, { lat: -23.6, lng: -46.7 }],
        stops: [{ order_id: 101, location: { lat: -23.6, lng: -46.7 }, eta_seconds: 7860 }] };
    const state = { routes: [{ id: 1, slot: 2, revision: 1, state: 'draft', sheet: {}, calculation: calc, stops: [order] }] };
    const calls = [];
    const pending = [];
    let inFlight = 0;
    let maximum = 0;
    window.PPWOO = { ajax_url: '/admin-ajax.php', nonce: 'fixture' };
    window.PPWOO_ROUTES = { max_batch: 100 };
    $.ajax = async ({ data }) => {
        const input = JSON.parse(data.payload);
        calls.push(input);
        if (input.command === 'save') {
            inFlight++; maximum = Math.max(maximum, inFlight);
            return new Promise((resolve, reject) => pending.push(fail => {
                inFlight--;
                if (fail) {
                    if (fail === 'conflict') state.routes[0].revision++;
                    reject({ message: 'Falha simulada', status: fail === 'conflict' ? 409 : 502 }); return;
                }
                assert.equal(input.revision, state.routes[0].revision, 'save uses current revision');
                state.routes[0].revision++;
                state.routes[0].sheet = input.sheet;
                state.routes[0].stops[0].cost = input.sheet.costs['101'];
                resolve({ success: true, data: structuredClone(state) });
            }));
        }
        return { success: true, data: structuredClone(state) };
    };
    window.eval(readFileSync(join(__dirname, '../packing-panel-woo-dev/assets/js/routes.js'), 'utf8'));
    const until = async predicate => {
        for (let i = 0; i < 250 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(predicate(), 'Expected UI state');
    };
    await until(() => $('[data-dispatch-route]').length === 1);
    $('[data-route-id="1"]')[0].open = true;
    await until(() => fitted === 1);
    const mapNode = $('.ppwoo-route-map')[0];
    assert.equal($('.ppwoo-route-stops').length, 0, 'single stop has no redundant outer fold');
    assert.match($('.ppwoo-route-metrics').text(), /2 h 11 min/);
    assert.match($('.ppwoo-phone-country').text(), /França/);
    $('[data-sheet-field="link"]').val('https://test.example.test/primeiro').trigger('input');
    await until(() => pending.length === 1);
    $('[data-sheet-field="link"]').val('https://test.example.test/segundo').trigger('input');
    $('[data-reload-routes]').trigger('click');
    assert.equal(calls.filter(call => call.command === 'list').length, 1, 'no polling over save');
    pending.shift()(false);
    await until(() => pending.length === 1);
    assert.equal($('[data-sheet-field="link"]').val(), 'https://test.example.test/segundo', 'old response never overwrites newer edit');
    pending.shift()(false);
    await until(() => $('[data-sheet-status]').text() === 'Rascunho salvo');
    assert.equal(state.routes[0].sheet.link, 'https://test.example.test/segundo');
    assert.equal(maximum, 1, 'autosaves never overlap');
    $('[data-sheet-field="code"]').val('4321').trigger('input');
    await until(() => pending.length === 1);
    pending.shift()(true);
    await until(() => $('[data-sheet-status]').hasClass('is-error'));
    assert.equal($('[data-sheet-field="code"]').val(), '4321', 'failure retains local value');
    assert.equal($('[data-save-sheet]')[0].hidden, false);
    $('[data-save-sheet]').trigger('click');
    await until(() => pending.length === 1);
    pending.shift()(false);
    await until(() => $('[data-sheet-status]').text() === 'Rascunho salvo');
    $('[data-sheet-field="code"]').val('5432').trigger('input');
    await until(() => pending.length === 1);
    pending.shift()('conflict');
    await until(() => $('[data-sheet-status]').hasClass('is-error'));
    let confirmations = 0;
    window.confirm = () => { confirmations++; return false; };
    $('[data-save-sheet]').trigger('click');
    assert.equal(pending.length, 0, 'conflict never overwrites without an explicit decision');
    window.confirm = () => { confirmations++; return true; };
    $('[data-save-sheet]').trigger('click');
    await until(() => pending.length === 1);
    pending.shift()(false);
    await until(() => $('[data-sheet-status]').text() === 'Rascunho salvo');
    assert.equal(confirmations, 2);
    $('#tab-rotas [data-privacy="recipient"]').trigger('click');
    assert.equal($('.painel-empacotamento').hasClass('ppwoo-hide-route-recipient'), true);
    assert.equal($('[data-privacy="recipient"][aria-pressed="true"]').length, 2, 'controls synchronized between tabs');
    $('[data-recalculate-route]').trigger('click');
    await until(() => calls.some(call => call.command === 'recalculate'));
    await until(() => !$('.painel-empacotamento').hasClass('ppwoo-routes-busy'));
    assert.equal($('.ppwoo-route-map')[0], mapNode, 'same calculation retains the actual map node');
    assert.equal(fitted, 1, 'refresh does not reset map framing');
    assert.equal($('.painel-empacotamento').hasClass('ppwoo-hide-route-recipient'), true);
});
