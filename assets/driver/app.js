(() => {
    'use strict';
    const root = document.getElementById('ctwpml-driver'), script = document.getElementById('ctdrv-script');
    if (!root || !script) return;
    const hash = new URLSearchParams(location.hash.slice(1)), routeId = Number(hash.get('rota'));
    let token = hash.get('acesso');
    history.replaceState(null, '', location.pathname + location.search + (routeId ? '#rota=' + routeId : ''));
    if (!Number.isSafeInteger(routeId) || routeId < 1) { root.textContent = 'Abra o link da rota recebido do responsável pelo envio.'; return; }
    const key = script.dataset.scope + ':' + routeId;
    let db, record, syncing = false, acting = false, timer, map, mapPromise, mapSignature, markers = [], offlineReady = false, offlineFailed = false, denied = false, suspended = false, dragging = false, notice = '', reviewDone = false;
    const tab = crypto.randomUUID(), channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ctdrv-' + key) : null;
    const q = selector => root.querySelector(selector);
    const colors = { ready: '#1765d8', started: '#9a5700', arrived: '#168343', delivered: '#168343' };
    const safeURL = value => /^https:\/\//.test(value || '') ? value : '';
    let firstRead = true;
    function openDB() { return new Promise((resolve, reject) => {
        const request = indexedDB.open('ctwpml-driver-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('routes', { keyPath: 'key' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Não foi possível salvar a rota neste navegador. Libere o armazenamento antes de iniciar.'));
    }); }
    function edit(change, broadcast = true) { return new Promise((resolve, reject) => {
        const tx = db.transaction('routes', 'readwrite'), store = tx.objectStore('routes'); let value;
        const get = store.get(key);
        get.onsuccess = () => { try {
            value = get.result || { key, routeId, device: crypto.randomUUID(), queue: [], discarded: [], selected: 0, conflict: false };
            change(value); store.put(value);
        } catch (error) { tx.abort(); reject(error); } };
        tx.oncomplete = () => { record = value; if (broadcast) channel?.postMessage({ tab }); resolve(value); };
        tx.onerror = tx.onabort = () => reject(new Error('Não foi possível salvar. A etapa não foi avançada.'));
    }); }
    function prune() { return new Promise((resolve, reject) => {
        const tx = db.transaction('routes', 'readwrite'), cursor = tx.objectStore('routes').openCursor();
        cursor.onsuccess = () => { const row = cursor.result; if (!row) return;
            if (row.value.snapshot && (!row.value.expires || row.value.expires < Date.now())) { const value = row.value; value.snapshot = null; row.update(value); }
            row.continue();
        };
        tx.oncomplete = resolve; tx.onerror = tx.onabort = reject;
    }); }
    function effective(row = record) { return CTDriverState.optimistic(row.snapshot, row.queue); }
    function confirmed(row = record) { return (row.snapshot?.stops || []).filter(stop => stop.confirmed).map(stop => stop.id); }
    function shell() {
        root.innerHTML = '<article class="driver-app"><p class="connection-banner" role="status"></p><div class="driver-map"><div class="map-tools"><button type="button" data-focus>Focar parada</button><button type="button" data-expand>Expandir</button></div><div class="map-canvas" role="region" aria-label="Mapa da rota"></div></div><div class="driver-sheet"><div class="route-row"><span class="route-label"></span><button type="button" data-stops>Paradas <span data-position></span> ☷</button></div><div class="destination-title"><span data-stage></span><strong data-order></strong></div><p class="recipient" data-name></p><h1 data-address></h1><p class="address-detail" data-detail></p><a class="contact-link" data-whatsapp target="_blank" rel="noopener noreferrer"><span data-number></span><small>Toque para falar pelo WhatsApp ↗</small></a><a class="waze-link" data-waze target="_blank" rel="noopener noreferrer">Abrir com Waze ↗</a><p class="current-message" data-message role="status"></p><div class="swipe-area"><label for="driver-slide"></label><input id="driver-slide" type="range" min="0" max="100" value="0" aria-label="Deslize para confirmar a etapa"><span class="swipe-arrow" aria-hidden="true">→</span></div><p class="sync-state" data-sync></p><button class="correction" type="button" data-correct hidden>Corrigir esta parada</button><button type="button" data-reconcile hidden>Conferir pendências</button></div><section class="stop-menu" hidden aria-label="Paradas da rota"><div class="stop-menu-title"><h2>Paradas da rota</h2><button type="button" data-close-list>Fechar</button></div><div data-stop-list></div></section><section class="driver-done" hidden><div class="done-check">✓</div><h2>Rota concluída!</h2><p>Muito obrigado e boa viagem.</p><p data-done-sync></p></section></article>';
        q('[data-stops]').onclick = () => { q('.stop-menu').hidden = false; };
        const review = document.createElement('button'); review.type = 'button'; review.textContent = 'Consultar paradas ou corrigir'; review.dataset.review = '';
        review.onclick = () => { reviewDone = true; q('.driver-done').hidden = true; q('.stop-menu').hidden = false; }; q('.driver-done').append(review);
        q('[data-close-list]').onclick = () => { q('.stop-menu').hidden = true; };
        q('[data-correct]').onclick = () => { if (window.confirm('Corrigir esta parada e retornar a sequência posterior para aguardando?')) act('correct'); };
        q('[data-reconcile]').onclick = reconcile;
        q('[data-focus]').onclick = () => { const point = record.snapshot.map?.points?.find(point => point.order_id === record.snapshot.stops[record.selected]?.id); if (map && point?.location) { map.panTo(point.location); map.setZoom(16); } };
        q('[data-expand]').onclick = () => { const open = q('.driver-app').classList.toggle('map-expanded'); q('[data-expand]').textContent = open ? 'Recolher' : 'Expandir'; if (map) google.maps.event.trigger(map, 'resize'); };
        const slider = q('#driver-slide'); let start = null, keyboard = false;
        slider.addEventListener('pointerdown', event => { keyboard = false; dragging = true; const rect = slider.getBoundingClientRect(); start = event.clientX <= rect.left + 55 ? { x: event.clientX, width: rect.width, id: event.pointerId } : null; try { slider.setPointerCapture(event.pointerId); } catch (_) {} });
        slider.addEventListener('input', () => { if (dragging) q('.swipe-area label').textContent = Number(slider.value) >= 75 ? 'Solte para confirmar' : slider.getAttribute('aria-label'); });
        slider.addEventListener('pointerup', event => { const full = start && event.pointerId === start.id && event.clientX - start.x >= Math.max(16, (start.width - 48) * .5) && Number(slider.value) >= 75; start = null; dragging = false; if (full) act(); else { slider.value = 0; render(); } });
        slider.addEventListener('pointercancel', () => { dragging = false; start = null; slider.value = 0; render(); });
        slider.addEventListener('change', () => { if (!start && !keyboard && !acting) slider.value = 0; });
        slider.addEventListener('keydown', event => { keyboard = true; if (event.key === 'Enter' && Number(slider.value) >= 75) { event.preventDefault(); act(); } });
        root.addEventListener('touchmove', event => { if (event.touches.length > 1 && !event.target.closest('.driver-map')) event.preventDefault(); }, { passive: false });
        for (const type of ['gesturestart', 'gesturechange', 'gestureend']) root.addEventListener(type, event => { if (!event.target.closest('.driver-map')) event.preventDefault(); }, { passive: false });
    }
    function render() {
        if (suspended || !record?.snapshot || dragging || !q('.driver-app')) return;
        let state;
        try { state = effective(); } catch (_) { state = record.snapshot.driver; record.conflict = true; }
        const rows = record.snapshot.stops || [], index = Math.min(record.selected || 0, Math.max(0, rows.length - 1)), stop = rows[index];
        const done = state.status === 'completed' || record.snapshot.closed;
        q('.driver-done').hidden = !done || reviewDone && !record.snapshot.closed;
        q('[data-review]').hidden = !!record.snapshot.closed;
        q('[data-done-sync]').textContent = record.queue.length ? 'Conclusão salva neste aparelho. Aguardando sincronização.' : 'Corrida encerrada e sincronizada.';
        q('.connection-banner').textContent = record.conflict ? 'Há ações para conferir. Os endereços continuam disponíveis.' : !navigator.onLine ? 'Sem internet — usando a rota salva neste aparelho.' : offlineFailed ? 'Reabertura offline indisponível. Mantenha esta aba aberta.' : !offlineReady ? 'Salvando acesso offline. Não feche a página até concluir.' : 'Rota disponível offline neste aparelho.';
        q('[data-sync]').textContent = record.queue.length ? record.queue.length + ' ações salvas no aparelho · ' + (syncing ? 'sincronizando…' : 'aguardando conexão') : 'Tudo sincronizado';
        q('[data-reconcile]').hidden = !record.conflict;
        if (!stop) return;
        const phase = state.stops[index].state, isCurrent = index === state.current && !done, blocked = record.conflict || record.snapshot.pending_dispatch;
        q('.driver-app').style.setProperty('--dm-state', colors[phase]);
        q('.route-label').textContent = 'ROTA ' + record.snapshot.slot; q('[data-position]').textContent = (index + 1) + ' de ' + rows.length;
        q('[data-order]').textContent = 'Pedido #' + stop.number; q('[data-name]').textContent = stop.name; q('[data-address]').textContent = stop.address; q('[data-detail]').textContent = stop.detail;
        q('[data-stage]').textContent = phase === 'delivered' ? 'Parada concluída' : !isCurrent ? 'Aguardando sua vez' : phase === 'ready' ? 'Pronto para iniciar' : phase === 'started' ? 'A caminho' : 'Chegada registrada';
        q('[data-number]').textContent = stop.phone;
        q('[data-whatsapp]').hidden = !safeURL(stop.whatsapp); if (safeURL(stop.whatsapp)) q('[data-whatsapp]').href = stop.whatsapp;
        const navigate = isCurrent && phase !== 'ready' && !record.snapshot.pending_dispatch;
        q('[data-waze]').setAttribute('aria-disabled', String(!navigate));
        if (navigate && safeURL(stop.waze)) q('[data-waze]').href = stop.waze; else q('[data-waze]').removeAttribute('href');
        const label = phase === 'ready' ? 'Deslize para iniciar a rota' : phase === 'started' ? 'Deslize para confirmar chegada' : index + 1 === rows.length ? 'Deslize para concluir a rota' : 'Concluir e iniciar a próxima parada';
        q('.swipe-area label').textContent = record.snapshot.pending_dispatch ? 'Aguardando a loja confirmar a retirada' : !isCurrent ? 'Conclua a parada atual para avançar' : label;
        const slider = q('#driver-slide'); slider.value = 0; slider.disabled = !isCurrent || !!blocked || acting;
        q('.swipe-area').classList.toggle('disabled', slider.disabled); slider.setAttribute('aria-label', q('.swipe-area label').textContent);
        q('[data-correct]').hidden = phase === 'ready'; q('[data-correct]').disabled = stop.confirmed || !!blocked || acting;
        q('[data-correct]').textContent = stop.confirmed ? 'Recebimento confirmado — revisão só pelo administrador' : 'Corrigir esta parada';
        q('[data-message]').textContent = notice || (phase === 'arrived' ? (record.queue.length ? 'Chegada salva. O cliente será atualizado após a sincronização.' : 'Chegada registrada no acompanhamento do cliente.') : phase === 'started' ? 'Ao chegar, deslize para registrar a chegada.' : 'Inicie a rota para abrir a navegação.');
        const list = q('[data-stop-list]'); list.replaceChildren();
        rows.forEach((row, i) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'stop-choice'; button.setAttribute('aria-current', String(i === index));
            const number = document.createElement('span'); number.className = 'stop-index'; number.textContent = i + 1; number.style.color = colors[state.stops[i].state];
            const text = document.createElement('span'); text.textContent = row.name;
            const address = document.createElement('small'); address.textContent = row.address; text.append(address);
            const status = document.createElement('small'); status.textContent = row.confirmed ? 'Recebimento confirmado' : state.stops[i].state === 'delivered' ? 'Concluída' : i === state.current ? 'Parada atual' : 'Aguardando sua vez'; text.append(status);
            button.append(number, text); button.onclick = async () => { await edit(value => { value.selected = i; }); q('.stop-menu').hidden = true; notice = ''; render(); }; list.append(button);
        });
        drawMap(record.snapshot, state, index);
    }

    async function act(type) {
        if (acting || !record?.snapshot) return;
        acting = true; const slider = q('#driver-slide'); slider.disabled = true;
        let navigate = '';
        try {
            const displayed = effective(), expected = displayed.version;
            const selected = record.selected || 0, shown = record.snapshot.stops[selected];
            const action = type || (displayed.stops[selected].state === 'ready' ? 'start' : displayed.stops[selected].state === 'started' ? 'arrive' : 'complete');
            await edit(value => {
                if (value.conflict || value.snapshot.pending_dispatch) throw new Error('Confira o estado da rota antes de continuar.');
                const state = effective(value);
                if (state.version !== expected) throw new Error('A rota mudou em outra aba. Confira a etapa e deslize novamente.');
                const event = { id: crypto.randomUUID(), device: value.device, seq: (state.devices[value.device] || 0) + 1,
                    version: state.version, stop_id: shown.id, type: action, at: new Date().toISOString() };
                const next = CTDriverState.apply(state, event, confirmed(value));
                value.queue.push(event); value.selected = next.current;
                reviewDone = false;
                if (action === 'start' || action === 'complete' && next.status !== 'completed') navigate = safeURL(value.snapshot.stops[next.current].waze);
            });
            notice = 'Ação salva neste aparelho.'; render();
            // Persistência concluída ANTES de abrir outro contexto. Nunca substituir
            // este painel, mesmo quando o navegador bloquear ou o usuário cancelar.
            if (navigate) {
                notice = 'Etapa salva. Use Abrir com Waze se a navegação não abrir.';
                try { window.open(navigate, '_blank', 'noopener,noreferrer'); }
                catch (_) { /* O link explícito continua disponível no painel. */ }
            }
        } catch (error) { notice = error.message; }
        finally { acting = false; render(); sync(); }
    }

    async function network(events = []) {
        const body = { route_id: routeId, events }; if (token) body.token = token;
        if (!firstRead && !events.length && Number.isInteger(record?.snapshot?.route_revision)) body.known_revision = record.snapshot.route_revision;
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 23000);
        try {
            const response = await fetch(script.dataset.endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
                headers: { 'X-CTDRV': '1' }, body: new URLSearchParams({ action: 'ctwpml_driver', payload: JSON.stringify(body) }) });
            const result = await response.json();
            if (!response.ok || !result.success) { const error = new Error(result.data?.message || 'Não foi possível conferir a rota.'); error.status = response.status; throw error; }
            token = null; firstRead = false; return result.data;
        } finally { clearTimeout(timeout); }
    }
    async function sync() {
        if (suspended || syncing || acting || dragging || denied || document.hidden || !navigator.onLine || record?.conflict) return;
        syncing = true; clearTimeout(timer);
        try {
            await edit(() => {}, false);
            const pending = record.queue.slice(0, 20), data = await network(pending), ids = new Set(pending.map(event => event.id));
            await edit(value => {
                value.queue = value.queue.filter(event => !ids.has(event.id));
                if (!data.unchanged && (!value.snapshot || data.driver.version >= value.snapshot.driver.version &&
                    (!Number.isInteger(data.route_revision) || !Number.isInteger(value.snapshot.route_revision) || data.route_revision >= value.snapshot.route_revision))) value.snapshot = data;
                value.expires = Date.now() + 7 * 86400000;
                if (data.closed && !value.queue.length) { value.selected = 0; value.snapshot = { route_id: data.route_id, closed: true, driver: data.driver }; }
            });
            notice = ''; render();
        } catch (error) {
            if ([403,410].includes(error.status)) {
                denied = true;
                await edit(value => { value.snapshot = null; value.conflict = true; });
                map = null; markers = []; mapSignature = null;
                root.textContent = 'Este acesso foi encerrado ou revogado. Peça ajuda ao responsável. As referências das ações pendentes foram preservadas neste aparelho.';
            } else {
                if ([409,422].includes(error.status)) await edit(value => { value.conflict = true; });
                notice = error.message || 'Sem resposta. As ações permanecem salvas.'; render();
                if (!record?.snapshot && q('.connection-banner')) q('.connection-banner').textContent = notice + ' Tentaremos novamente ao reconectar.';
            }
        } finally { syncing = false; if (!suspended) { if (record?.snapshot) render(); timer = setTimeout(sync, record?.queue.length && !record.conflict ? 3000 : notice ? 20000 : 5000); } }
    }
    async function reconcile() {
        if (!navigator.onLine) { notice = 'Reconecte para consultar o estado confirmado pela loja.'; render(); return; }
        if (!window.confirm('Conferir o estado da loja e abandonar as ações locais conflitantes? As referências serão guardadas para revisão.')) return;
        try {
            const data = await network();
            await edit(value => { value.discarded = [...value.discarded, ...value.queue].slice(-1000); value.queue = []; value.snapshot = data; value.expires = Date.now() + 7 * 86400000; value.conflict = false; value.selected = data.driver.current; });
            notice = 'Estado da loja recuperado. Pendências anteriores preservadas para conferência.'; render(); sync();
        } catch (error) { notice = error.message; render(); }
    }

    async function drawMap(data, state, selected) {
        if (!data.maps_key || !data.map?.points?.length) { q('.map-canvas').textContent = 'Mapa indisponível. Endereços e Waze continuam abaixo.'; return; }
        if (!mapPromise) mapPromise = new Promise((resolve, reject) => {
            if (window.google?.maps?.Map) { resolve(google.maps); return; }
            window.ctdrvMapsReady = () => resolve(google.maps);
            const source = document.createElement('script'); source.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(data.maps_key) + '&callback=ctdrvMapsReady&loading=async';
            source.referrerPolicy = 'strict-origin-when-cross-origin'; source.onerror = () => reject(new Error('Mapa indisponível. Use o endereço salvo.')); document.head.append(source);
            setTimeout(() => reject(new Error('Mapa indisponível. Use o endereço salvo.')), 15000);
        });
        try {
            const maps = await mapPromise, signature = JSON.stringify(data.map);
            if (denied || !q('.map-canvas') || record?.snapshot?.closed) return;
            if (signature !== mapSignature) {
                map = new maps.Map(q('.map-canvas'), { mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'greedy' });
                const bounds = new maps.LatLngBounds(); markers = [];
                if (data.map.origin) { bounds.extend(data.map.origin); new maps.Marker({ map, position: data.map.origin, label: 'S', title: 'Saída' }); }
                for (const point of data.map.points) {
                    bounds.extend(point.location); markers.push({ id: point.order_id, marker: new maps.Marker({ map, position: point.location, zIndex: 5 }) });
                }
                new maps.Polyline({ map, path: data.map.path, strokeColor: '#1765d8', strokeWeight: 5, zIndex: 1 }); map.fitBounds(bounds, 45); mapSignature = signature;
            }
            markers.forEach(({ id, marker }) => { const index = state.stops.findIndex(stop => stop.id === id); if (index < 0) return;
                marker.setLabel({ text: String(index + 1), color: '#fff', fontWeight: '700' });
                marker.setIcon({ path: maps.SymbolPath.CIRCLE, scale: index === selected ? 20 : 16, fillColor: colors[state.stops[index].state], fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' });
            });
        } catch (error) { if (!map && q('.map-canvas')) q('.map-canvas').textContent = error.message; }
    }
    async function worker() {
        if (!('serviceWorker' in navigator)) { offlineFailed = true; notice = 'Este navegador não permite reabrir a página offline. Mantenha a aba aberta.'; render(); return; }
        try {
            const registration = await navigator.serviceWorker.register(script.dataset.worker, { scope: location.pathname });
            const active = registration.installing || registration.waiting;
            if (active) await new Promise((resolve, reject) => { active.addEventListener('statechange', () => { if (active.state === 'activated') resolve(); if (active.state === 'redundant') reject(new Error('Offline indisponível')); }); });
            offlineReady = true; render();
        } catch (_) { offlineFailed = true; notice = 'Não foi possível preparar a reabertura offline. Mantenha esta aba aberta e confira a configuração PWA.'; render(); }
    }
    (async () => {
        try { db = await openDB(); await prune(); await edit(() => {}, false); shell(); if (record.snapshot) render(); else q('.connection-banner').textContent = 'Carregando a rota autorizada. O primeiro acesso precisa de internet.'; worker(); await sync(); }
        catch (error) { root.textContent = error.message; }
    })();
    channel?.addEventListener('message', async event => { if (event.data?.tab !== tab && db && !acting && !dragging) { await edit(() => {}, false); render(); } });
    window.addEventListener('online', () => { notice = ''; sync(); });
    window.addEventListener('offline', render);
    document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) sync(); });
    window.addEventListener('pagehide', () => { suspended = true; clearTimeout(timer); });
    window.addEventListener('pageshow', () => { suspended = false; sync(); });
})();
