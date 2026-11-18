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
            state = { routes: [{ id: 1, slot: 1, revision: stops.length, state: 'draft', calculation, stops }] };
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
        $('[data-group-order="' + id + '"]').val('1').trigger('change');
        await until(() => $('[data-routes-drafts] .ppwoo-route-order').length === count);
    }
    await group(101, 1);
    $('[data-sheet-field="link"]').val('https://test.example.test/entrega').trigger('input');
    await group(102, 2);
    assert.equal($('[data-sheet-field="link"]').val(), 'https://test.example.test/entrega');
    assert.equal($('#tab-motoboy [data-order-id="101"]').prop('hidden'), true);
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
