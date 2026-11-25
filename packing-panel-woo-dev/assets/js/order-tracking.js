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
    let failures = 0;
    const node = (tag, text, attrs = {}) => {
        const element = document.createElement(tag);
        if (text !== null) element.textContent = text;
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    };
    const date = value => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const safeLink = value => /^https?:\/\//i.test(value || '') ? value : '';
    const time = value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    function brand(data) {
        const header = node('header', null, { class: 'tracking-brand' });
        const name = node('strong', script.dataset.brandName || 'Acompanhe seu pedido');
        const logo = safeLink(script.dataset.logo);
        if (logo) {
            const image = node('img', null, { src: logo, alt: script.dataset.brandName || 'Logo da loja' });
            name.hidden = true;
            image.addEventListener('error', () => { image.hidden = true; name.hidden = false; });
            header.append(image);
        }
        header.append(name, node('small', 'Pedido #' + data.number + (data.route ? ' · Rota ' + data.route : '')));
        return header;
    }
    function status(text) { root.querySelector('.tracking-status').textContent = text; }
    async function request(command) {
        if (previewNonce && command !== 'confirm') command = 'preview';
        const body = new URLSearchParams({ action: 'ppwoo_order_tracking', order_id: id || '', command });
        if (command === 'read' && Number.isInteger(snapshot?.route_revision)) body.set('known_revision', snapshot.route_revision);
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
        // Mesmas cores das etapas do entregador, sem mudar o estado comercial do pedido.
        root.dataset.trackingState = data.preparing || data.waiting_driver ? (data.waiting_driver ? 'ready' : 'preparing') :
            (['started', 'arrived', 'delivered'].includes(data.driver_stage) ? data.driver_stage : 'ready');
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
            if (data.admin_preview && data.dispatch_review) content.append(node('p', 'Esta previsão antiga precisa de revisão: não foi possível identificar o fuso original com segurança.', { class: 'tracking-delay' }));
            if (data.delayed && !data.waiting_driver) {
                const delay = node('section', null, { class: 'tracking-delay' });
                delay.append(node('strong', 'O envio está um pouco atrasado'), node('p', data.driver_assigned ?
                    'O motoboy já foi definido. Estamos aguardando a saída do seu pedido.' : 'Estamos com um pouco de dificuldade para encontrar o motoboy. Assim que encontrarmos, você verá uma atualização nesta página.'));
                content.append(delay);
            }
            content.append(node('p', data.waiting_driver ? 'A previsão de chegada será atualizada com o início do percurso.' : 'O prazo de chegada será informado depois da saída, com base na sua posição na rota.', { class: 'tracking-explanation' }),
                node('p', 'Esta página se atualiza automaticamente. Você pode acompanhar por este mesmo link.', { class: 'tracking-auto' }), node('p', data.admin_preview ? 'Prévia administrativa — apenas leitura' : '', { class: 'tracking-status', role: 'status' }));
            root.replaceChildren(brand(data), content);
            return;
        }
        if (root.classList.contains('tracking-preparing')) root.replaceChildren();
        preparationSignature = null;
        root.classList.remove('tracking-preparing');
        if (!root.querySelector('.tracking-content')) {
            const mapPanel = node('div', null, { class: 'tracking-map-panel' });
            const canvas = node('div', '', { class: 'tracking-map', id: 'tracking-map', role: 'region', 'aria-label': 'Mapa da sua entrega' });
            const expand = node('button', 'Ampliar mapa', { type: 'button', class: 'tracking-map-expand', 'aria-expanded': 'false', 'aria-controls': 'tracking-map' });
            expand.addEventListener('click', () => {
                const expanded = mapPanel.classList.toggle('is-expanded');
                expand.setAttribute('aria-expanded', String(expanded));
                expand.textContent = expanded ? 'Reduzir mapa' : 'Ampliar mapa';
                // Mantém o centro e o zoom escolhidos, sem recriar o mapa ou expor novas coordenadas.
                if (map && window.google?.maps?.event) {
                    const center = map.getCenter?.();
                    window.google.maps.event.trigger(map, 'resize');
                    if (center) map.setCenter(center);
                }
            });
            mapPanel.append(canvas, expand);
            root.replaceChildren(brand(data), mapPanel, node('div', '', { class: 'tracking-content' }));
            const content = root.querySelector('.tracking-content');
            const heading = node('div', null, { class: 'tracking-heading' });
            const title = node('div', null);
            const stageTitle = node('div', null, { class: 'tracking-stage-title', role: 'status', 'aria-live': 'polite' });
            stageTitle.append(node('span', null, { class: 'tracking-live', 'aria-hidden': 'true' }), node('h1', 'Seu pedido está a caminho'));
            title.append(node('p', 'ENTREGA EM ANDAMENTO', { class: 'tracking-reference' }), stageTitle);
            heading.append(title);
            const stop = node('div', null, { class: 'tracking-stop' });
            const position = node('div', null, { class: 'tracking-position-group' });
            const positionLabel = node('div', null, { class: 'tracking-position-label' });
            positionLabel.append(node('strong', ''), node('small', ''));
            position.append(node('strong', '', { class: 'tracking-position' }), positionLabel);
            stop.append(position, node('div', '', { class: 'tracking-arrival' }));
            content.append(heading, stop);
            const receipt = node('section', null, { class: 'tracking-receipt' });
            const label = node('label', 'Recebeu seu pedido? Deslize para confirmar.', { for: 'tracking-slide' });
            const range = node('input', null, { type: 'range', id: 'tracking-slide', min: '0', max: '100', value: '0', 'aria-label': 'Deslize para confirmar o recebimento' });
            let drag = null, keyboard = false;
            range.addEventListener('pointerdown', event => {
                keyboard = false;
                const rect = range.getBoundingClientRect();
                drag = event.clientX <= rect.left + 55 ? { x: event.clientX, id: event.pointerId, width: rect.width } : null;
                try { range.setPointerCapture(event.pointerId); } catch (_) { /* captura nativa pode estar indisponível */ }
            });
            range.addEventListener('pointerup', event => {
                const completed = drag && drag.id === event.pointerId && event.clientX - drag.x >= Math.max(16, (drag.width - 48) * .5) && Number(range.value) >= 75;
                drag = null;
                label.textContent = 'Recebeu seu pedido? Deslize para confirmar.';
                if (completed) confirmReceipt(); else range.value = 0;
            });
            range.addEventListener('pointercancel', () => { drag = null; range.value = 0; label.textContent = 'Recebeu seu pedido? Deslize para confirmar.'; });
            range.addEventListener('change', () => { if (!drag && !confirming && !keyboard) range.value = 0; });
            range.addEventListener('keydown', event => {
                keyboard = true;
                // Acessibilidade pelo próprio slider, sem botão de confirmação por toque.
                if (event.key === 'Enter' && Number(range.value) >= 75) { event.preventDefault(); confirmReceipt(); }
            });
            range.addEventListener('input', () => { if (drag) label.textContent = Number(range.value) >= 75 ? 'Solte para confirmar' : 'Recebeu seu pedido? Deslize para confirmar.'; });
            const track = node('div', null, { class: 'tracking-slide-track' });
            track.append(node('span', 'Deslize para confirmar →', { 'aria-hidden': 'true' }), range);
            receipt.append(label, track);
            const actions = node('div', null, { class: 'tracking-actions' });
            actions.append(node('a', 'Rastrear na Uber ↗', { class: 'tracking-link', target: '_blank', rel: 'noopener noreferrer' }));
            const whatsapp = node('a', null, { class: 'tracking-whatsapp', target: '_blank', rel: 'noopener noreferrer' });
            if (safeLink(script.dataset.whatsappIcon)) whatsapp.append(node('img', null, { src: script.dataset.whatsappIcon, alt: '', 'aria-hidden': 'true' }));
            whatsapp.append(node('span', 'Falar com motoboy'));
            actions.append(whatsapp);
            const code = node('section', null, { class: 'tracking-code', hidden: '' });
            const codeLabel = node('div', null);
            codeLabel.append(node('small', 'Informe no destino final'), node('strong', 'Código da corrida'));
            const copy = node('button', '', { type: 'button', class: 'tracking-code-copy', 'aria-label': 'Copiar código da corrida' });
            copy.addEventListener('click', async () => {
                if (!snapshot?.last || !snapshot.code) return;
                try { await navigator.clipboard.writeText(String(snapshot.code)); status('Código copiado.'); }
                catch (_) { status('Não foi possível copiar. Informe o código exibido ao motoboy.'); }
            });
            code.append(codeLabel, copy);
            const details = node('details', null, { class: 'tracking-details' });
            details.append(node('summary', 'Endereço e detalhes da entrega'));
            const info = node('div', null, { class: 'tracking-detail-content' });
            info.append(node('div', null, { class: 'tracking-address' }), node('p', '', { class: 'tracking-stage-description' }),
                node('p', '', { class: 'tracking-explanation' }), node('p', '', { class: 'tracking-departure' }),
                node('p', 'Trajeto calculado · origem e outras paradas aproximadas · trechos privados ocultos · sem localização ao vivo', { class: 'tracking-map-note' }),
                node('p', '', { class: 'tracking-expiry' }));
            details.append(info);
            const footer = node('footer', null, { class: 'tracking-footer' });
            footer.append(node('span', 'Atualizações automáticas'), node('span', '', { class: 'tracking-estimate-note' }));
            content.append(receipt, actions, code, details, footer, node('p', '', { class: 'tracking-status', role: 'status' }));
        }
        root.querySelector('.tracking-brand small').textContent = 'Pedido #' + data.number + ' · Rota ' + data.route;
        const stages = { started: 'O motoboy está a caminho', arrived: 'O motoboy chegou à sua parada', delivered: 'O motoboy registrou a entrega' };
        root.querySelector('.tracking-reference').textContent = data.driver_stage === 'delivered' ? 'CONFIRME O RECEBIMENTO' : 'ENTREGA EM ANDAMENTO';
        const title = root.querySelector('.tracking-heading h1'), message = stages[data.driver_stage] || 'Seu pedido está a caminho';
        if (title.textContent !== message) title.textContent = message;
        root.querySelector('.tracking-stage-description').textContent = data.driver_stage === 'delivered' ? 'Se você já recebeu seu pedido, confirme pelo slide de recebimento.' :
            data.driver_stage === 'arrived' ? 'Prepare-se para receber seu pedido.' : 'A previsão e o rastreio são atualizados automaticamente.';
        const code = root.querySelector('.tracking-code');
        code.querySelector('.tracking-code-copy').textContent = String(data.code || '') + ' ⧉';
        code.hidden = !data.last || !data.code;
        root.querySelector('.tracking-position').textContent = data.position;
        const positionLabel = root.querySelector('.tracking-position-label');
        positionLabel.querySelector('strong').textContent = 'Sua parada de ' + data.total;
        positionLabel.querySelector('small').textContent = data.last ? 'Destino final' : 'Antes do destino final';
        const address = root.querySelector('.tracking-address');
        address.replaceChildren(node('strong', 'Seu endereço'), node('p', data.address));
        if (data.current_position && data.driver_stage === 'ready') address.append(node('small', 'O motoboy está na etapa da parada ' + data.current_position + '.'));
        const arrival = root.querySelector('.tracking-arrival');
        const eta = Date.parse(data.eta_at);
        const sameDay = Number.isFinite(eta) && new Date(eta).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR');
        const estimate = data.driver_stage === 'arrived' ? 'Chegou agora' : data.driver_stage === 'delivered' ? 'Entrega registrada' :
            Number.isFinite(eta) ? (sameDay ? time(data.eta_at) : date(data.eta_at)) : 'Consulte o rastreio';
        arrival.replaceChildren(node('span', 'Chegada estimada'), node('strong', estimate));
        root.querySelector('.tracking-departure').textContent = 'Saída: ' + date(data.departed_at) + ' · previsão aproximada';
        root.querySelector('.tracking-estimate-note').textContent = eta < Date.now() && !['arrived', 'delivered'].includes(data.driver_stage) ? 'Previsão ultrapassada' : 'Previsão aproximada';
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
            failures = 0;
            render(result.unchanged ? snapshot : result);
        } catch (error) {
            failures++;
            if (error.status === 403 || error.status === 410 || !snapshot) {
                root.replaceChildren(node('p', error.message, { class: 'tracking-status' }), node('button', 'Tentar novamente', { type: 'button', 'data-retry': '' }));
                root.querySelector('[data-retry]').onclick = () => { map = null; mapSignature = null; load(); };
                if (error.status === 403 || error.status === 410) {
                    finished = true;
                    root.querySelector('[data-retry]').remove();
                    root.append(node('p', 'Se precisar, solicite um novo link à loja.'));
                }
            } else status(error.message);
        } finally { busy = false; if (!finished && !confirming) timer = setTimeout(load, snapshot ? Math.min(30000, 5000 * 2 ** failures) : 30000); }
    }
    document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) load(); });
    if (!/^[1-9]\d*$/.test(id || '')) root.textContent = 'Abra o link recebido para acompanhar sua entrega. Em caso de dificuldade, entre em contato com a loja.';
    else load();
})();
