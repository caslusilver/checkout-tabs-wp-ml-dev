(() => {
    'use strict';
    const root = document.getElementById('ppwoo-tracking');
    const script = document.getElementById('ppwoo-tracking-script');
    if (!root || !script) return;
    const mobileTouch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (mobileTouch) {
        // Bloqueia a ampliação do documento; os eventos do mapa continuam no SDK.
        for (const name of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(name, event => event.preventDefault(), { passive: false });
        document.addEventListener('touchmove', event => {
            if (event.touches.length > 1 && !event.target.closest?.('.tracking-map')) event.preventDefault();
        }, { passive: false });
    }
    const params = new URLSearchParams(location.hash.slice(1));
    const id = params.get('pedido');
    let token = params.get('acesso');
    const previewNonce = params.get('previa');
    // O segredo nunca fica em query string, storage JS, referências ou scripts externos.
    history.replaceState(null, '', location.pathname + location.search + (id ? '#pedido=' + encodeURIComponent(id) : ''));
    let busy = false, finished = false, timer, snapshot, map, mapSignature, mapsPromise, confirming = false, preparationSignature;
    const node = (tag, text, attrs = {}) => {
        const element = document.createElement(tag);
        if (text !== null) element.textContent = text;
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    };
    const date = value => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const safeLink = value => /^https?:\/\//i.test(value || '') ? value : '';
    function status(text) { root.querySelector('.tracking-status').textContent = text; }
    async function request(command) {
        if (previewNonce && command !== 'confirm') command = 'preview';
        const body = new URLSearchParams({ action: 'ppwoo_order_tracking', order_id: id || '', command });
        if (command === 'preview') body.set('preview_nonce', previewNonce);
        if (token && command === 'exchange') body.set('token', token);
        const response = await fetch(script.dataset.endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'X-PPWOO-Central': '1' }, body });
        const result = await response.json();
        if (!response.ok || !result.success) {
            const error = new Error(result.data?.message || 'Não foi possível atualizar. Tente novamente.');
            error.status = response.status;
            throw error;
        }
        return result.data;
    }
    function mapsLibrary(key) {
        if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
        if (mapsPromise) return mapsPromise;
        mapsPromise = new Promise((resolve, reject) => {
            window.ppwooCentralMapsReady = () => resolve(window.google.maps);
            const source = document.createElement('script');
            source.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=ppwooCentralMapsReady&loading=async';
            source.onerror = () => reject(new Error('Mapa indisponível. Use o rastreio da viagem.'));
            source.referrerPolicy = 'strict-origin-when-cross-origin';
            document.head.append(source);
            setTimeout(() => reject(new Error('Mapa indisponível. Use o rastreio da viagem.')), 15000);
        });
        return mapsPromise;
    }
    async function drawMap(data, container) {
        const signature = JSON.stringify(data.map);
        if (signature === mapSignature && map) return;
        if (!data.maps_key || !data.map.points.length) { container.textContent = 'Mapa indisponível. Seu rastreio e contato continuam abaixo.'; return; }
        try {
            const maps = await mapsLibrary(data.maps_key);
            if (finished || !container.isConnected) return;
            map = new maps.Map(container, { mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: mobileTouch ? 'greedy' : 'cooperative' });
            const bounds = new maps.LatLngBounds();
            const points = data.map.points;
            points.forEach(point => {
                const position = { lat: point.lat, lng: point.lng };
                bounds.extend(position);
                if (!point.own) new maps.Circle({ map, center: position, radius: 2500, strokeWeight: 0, fillColor: '#1765d8', fillOpacity: .09 });
                new maps.Marker({ map, position, label: { text: String(point.position), color: point.own ? '#fff' : '#1765d8', fontWeight: '700' },
                    zIndex: point.own ? 10 : 5, title: point.own ? 'Sua parada' : 'Parada aproximada',
                    icon: { path: maps.SymbolPath.CIRCLE, scale: point.own ? 19 : 15, fillColor: point.own ? '#1765d8' : '#fff', fillOpacity: 1, strokeColor: '#1765d8', strokeWeight: 2 } });
            });
            if (data.map.origin) {
                const originCircle = new maps.Circle({ map, center: data.map.origin, radius: 10000, strokeWeight: 2,
                    strokeColor: '#946013', strokeOpacity: .7, fillColor: '#e6bc68', fillOpacity: .18, zIndex: 0 });
                bounds.union(originCircle.getBounds());
                new maps.Marker({ map, position: data.map.origin, title: 'Região aproximada de saída', zIndex: 4,
                    icon: { path: maps.SymbolPath.CIRCLE, scale: 0, strokeWeight: 0 },
                    label: { text: 'Região de saída', color: '#61400b', fontWeight: '700' } });
            }
            for (const path of data.map.paths || []) {
                new maps.Polyline({ map, path, strokeColor: '#1765d8', strokeOpacity: .85, strokeWeight: 5, zIndex: 1 });
                path.forEach(point => bounds.extend(point));
            }
            map.fitBounds(bounds, 50);
            maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 15) map.setZoom(15); });
            mapSignature = signature;
        } catch (error) { if (container.isConnected) container.textContent = error.message; }
    }
    function render(data) {
        snapshot = data;
        if (data.preparing || data.waiting_driver) {
            const signature = JSON.stringify(data);
            if (signature === preparationSignature && root.classList.contains('tracking-preparing')) return;
            preparationSignature = signature;
            map = null; mapSignature = null;
            root.classList.add('tracking-preparing');
            const content = node('section', null, { class: 'tracking-content tracking-preparation' });
            const heading = node('div', null, { class: 'tracking-heading' });
            const pulse = node('span', null, { class: 'tracking-live' + (data.waiting_driver ? ' is-blue' : ''), role: 'img', 'aria-label': data.waiting_driver ? 'Aguardando início do percurso' : 'Preparação em andamento' });
            heading.append(node('h1', data.waiting_driver ? 'O motoboy já está com o seu pedido' : 'Estamos preparando o seu pedido'), pulse);
            content.append(node('p', 'PEDIDO #' + data.number, { class: 'tracking-reference' }), node('p', '✓ Pagamento aprovado', { class: 'tracking-approved' }), heading,
                node('p', data.waiting_driver ? 'Estamos aguardando ele iniciar o percurso.' : 'Assim que ele sair, o mapa, a previsão e os dados do motoboy aparecerão aqui.', { class: 'tracking-prep-intro' }));
            const dispatch = node('div', null, { class: 'tracking-arrival' });
            dispatch.append(node('span', data.waiting_driver ? 'Próxima etapa' : 'Previsão de envio'));
            if (data.waiting_driver) dispatch.append(node('small', 'Retirada na loja concluída'), node('strong', 'Início do percurso'), node('small', 'Você verá a atualização aqui assim que o motoboy iniciar a corrida.'));
            else if (data.dispatch_at) dispatch.append(node('span', data.dispatch_day), node('strong', 'A partir das ' + data.dispatch_time), node('small', 'Este é o horário previsto para sair da loja.'));
            else dispatch.append(node('strong', 'A confirmar'), node('small', 'Consulte a loja sobre o próximo despacho.'));
            content.append(dispatch);
            if (data.delayed && !data.waiting_driver) {
                const delay = node('section', null, { class: 'tracking-delay' });
                delay.append(node('strong', 'O envio está um pouco atrasado'), node('p', data.driver_assigned ?
                    'O motoboy já foi definido. Estamos aguardando a saída do seu pedido.' : 'Estamos com um pouco de dificuldade para encontrar o motoboy. Assim que encontrarmos, você verá uma atualização nesta página.'));
                content.append(delay);
            }
            content.append(node('p', data.waiting_driver ? 'A previsão de chegada será atualizada com o início do percurso.' : 'O prazo de chegada será informado depois da saída, com base na sua posição na rota.', { class: 'tracking-explanation' }),
                node('p', 'Esta página se atualiza automaticamente. Você pode acompanhar por este mesmo link.', { class: 'tracking-auto' }), node('p', data.admin_preview ? 'Prévia administrativa — apenas leitura' : '', { class: 'tracking-status', role: 'status' }));
            root.replaceChildren(content);
            return;
        }
        if (root.classList.contains('tracking-preparing')) root.replaceChildren();
        preparationSignature = null;
        root.classList.remove('tracking-preparing');
        if (!root.querySelector('.tracking-content')) {
            root.replaceChildren(node('div', '', { class: 'tracking-map', role: 'region', 'aria-label': 'Mapa da sua entrega' }), node('div', '', { class: 'tracking-content' }));
            const content = root.querySelector('.tracking-content');
            content.append(node('p', 'Trajeto calculado · trechos privados ocultos · sem localização ao vivo', { class: 'tracking-map-note' }));
            const heading = node('div', null, { class: 'tracking-heading' });
            const title = node('div', null);
            title.append(node('p', '', { class: 'tracking-reference' }), node('h1', 'Seu pedido está a caminho'));
            heading.append(title, node('div', '', { class: 'tracking-code' }));
            const stop = node('div', null, { class: 'tracking-stop' });
            stop.append(node('strong', '', { class: 'tracking-position' }), node('div', null, { class: 'tracking-address' }));
            content.append(heading, stop, node('div', '', { class: 'tracking-arrival' }), node('p', '', { class: 'tracking-explanation' }));
            content.append(node('a', 'Acompanhar viagem pela Uber ↗', { class: 'tracking-link', target: '_blank', rel: 'noopener noreferrer' }));
            content.append(node('p', 'Precisa falar com o motoboy?', { class: 'tracking-driver-label' }), node('a', 'Falar pelo WhatsApp ↗', { class: 'tracking-whatsapp', target: '_blank', rel: 'noopener noreferrer' }));
            const receipt = node('section', null, { class: 'tracking-receipt' });
            const label = node('label', 'Recebeu seu pedido? Deslize para confirmar.', { for: 'tracking-slide' });
            const range = node('input', null, { type: 'range', id: 'tracking-slide', min: '0', max: '100', value: '0', 'aria-label': 'Deslize até o fim para confirmar o recebimento' });
            let drag = null, keyboard = false;
            range.addEventListener('pointerdown', event => {
                keyboard = false;
                const rect = range.getBoundingClientRect();
                drag = event.clientX <= rect.left + 55 ? { x: event.clientX, id: event.pointerId, width: rect.width } : null;
                try { range.setPointerCapture(event.pointerId); } catch (_) { /* captura nativa pode estar indisponível */ }
            });
            range.addEventListener('pointerup', event => {
                const completed = drag && drag.id === event.pointerId && event.clientX - drag.x >= Math.max(40, drag.width * .6) && Number(range.value) >= 98;
                drag = null;
                if (completed) confirmReceipt(); else range.value = 0;
            });
            range.addEventListener('pointercancel', () => { drag = null; range.value = 0; });
            range.addEventListener('change', () => { if (!drag && !confirming && !keyboard) range.value = 0; });
            range.addEventListener('keydown', event => {
                keyboard = true;
                // Acessibilidade pelo próprio slider, sem botão de confirmação por toque.
                if (event.key === 'Enter' && Number(range.value) >= 98) { event.preventDefault(); confirmReceipt(); }
            });
            receipt.append(label, range, node('p', '', { class: 'tracking-status', role: 'status' }));
            content.append(receipt, node('p', '', { class: 'tracking-expiry' }));
        }
        root.querySelector('.tracking-reference').textContent = 'PEDIDO #' + data.number + ' · ROTA ' + data.route;
        const code = root.querySelector('.tracking-code');
        code.replaceChildren(node('small', 'Código da corrida'), node('strong', data.code));
        code.hidden = !data.last || !data.code;
        root.querySelector('.tracking-position').textContent = data.position;
        const address = root.querySelector('.tracking-address');
        address.replaceChildren(node('strong', 'Sua parada de ' + data.total), node('p', data.address));
        const arrival = root.querySelector('.tracking-arrival');
        const eta = Date.parse(data.eta_at);
        arrival.replaceChildren(node('span', 'Chegada estimada'), node('strong', Number.isFinite(eta) ? date(data.eta_at) : 'Consulte o rastreio'),
            node('small', 'Saída: ' + date(data.departed_at) + (eta < Date.now() ? ' · prazo estimado ultrapassado; consulte o motoboy.' : ' · previsão aproximada')));
        root.querySelector('.tracking-explanation').textContent = data.last ? 'Seu endereço é o destino final desta corrida. Informe o código ao motoboy na finalização.' :
            'A corrida segue' + (data.final_area ? ' até ' + data.final_area : ' até o destino final') + '. Antes, o motoboy fará uma parada no seu endereço.';
        for (const [selector, href] of [['.tracking-link', data.tracking_link], ['.tracking-whatsapp', data.driver_whatsapp]]) {
            const element = root.querySelector(selector);
            element.hidden = !safeLink(href);
            if (safeLink(href)) element.href = href;
        }
        root.querySelector('.tracking-expiry').textContent = 'Link disponível até ' + date(data.expires_at) + ', ou até a confirmação.';
        root.querySelector('.tracking-receipt').hidden = !!data.admin_preview;
        if (data.admin_preview) root.querySelector('.tracking-expiry').textContent = 'Prévia administrativa — apenas leitura. O link público pode estar encerrado.';
        drawMap(data, root.querySelector('.tracking-map'));
    }
    async function confirmReceipt() {
        if (previewNonce || snapshot?.admin_preview) return;
        if (confirming || finished) return;
        if (busy) { root.querySelector('#tracking-slide').value = 0; status('Atualizando o pedido. Aguarde e confirme novamente.'); return; }
        confirming = true;
        clearTimeout(timer);
        const range = root.querySelector('#tracking-slide');
        range.disabled = true;
        status('Registrando recebimento…');
        try {
            await request('confirm');
            finished = true;
            token = null;
            root.replaceChildren(node('section', null, { class: 'tracking-thanks', role: 'status' }));
            root.firstChild.append(node('div', '✓', { class: 'tracking-success-mark' }), node('h1', 'Recebimento confirmado!'), node('p', 'Muito obrigado. Até a próxima!'));
        } catch (error) {
            status(error.status === 403 || error.status === 410 ? error.message : 'Não conseguimos confirmar a resposta. Tente novamente para conferir e concluir com segurança.');
            range.value = 0; range.disabled = false;
        } finally { confirming = false; }
    }
    async function load() {
        if (busy || finished || confirming || document.hidden) return;
        clearTimeout(timer);
        busy = true;
        try {
            const result = await request(token ? 'exchange' : 'read');
            token = null;
            render(result);
        } catch (error) {
            if (error.status === 403 || error.status === 410 || !snapshot) {
                root.replaceChildren(node('p', error.message, { class: 'tracking-status' }), node('button', 'Tentar novamente', { type: 'button', 'data-retry': '' }));
                root.querySelector('[data-retry]').onclick = () => { map = null; mapSignature = null; load(); };
                if (error.status === 403 || error.status === 410) {
                    finished = true;
                    root.querySelector('[data-retry]').remove();
                    root.append(node('p', 'Se precisar, solicite um novo link à loja.'));
                }
            } else status(error.message);
        } finally { busy = false; if (!finished && !confirming) timer = setTimeout(load, 30000); }
    }
    document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) load(); });
    if (!/^[1-9]\d*$/.test(id || '')) root.textContent = 'Abra o link recebido para acompanhar sua entrega. Em caso de dificuldade, entre em contato com a loja.';
    else load();
})();
