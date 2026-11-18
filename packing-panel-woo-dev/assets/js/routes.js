(function ($, config, panelConfig) {
    'use strict';
    if (!config || !panelConfig) return;

    $(function () {
        const $panel = $('.painel-empacotamento').first();
        if (!$panel.find('#tab-rotas').length) return;

        const collapsed = new Set();
        const sheets = new Map();
        const closeSelections = new Map();
        const openGroups = new Set();
        const hidden = { recipient: false, values: false };
        let dashboard = { routes: [] };
        let preview = null;
        let historyNext = 0;
        let busy = false;
        let pollRequest = null;
        let mapsLibrary;

        function el(tag, attrs, ...content) {
            const node = document.createElement(tag);
            Object.entries(attrs || {}).forEach(([key, value]) => {
                if (value !== null && value !== undefined) node.setAttribute(key, String(value));
            });
            content.flat().forEach(child => {
                if (child != null) node.append(child instanceof Node ? child : String(child));
            });
            return node;
        }

        function button(label, attrs) {
            return el('button', { type: 'button', class: 'ppwoo-routes-button', ...attrs }, label);
        }

        function check(checked, attributes) {
            const input = el('input', { type: 'checkbox', ...attributes });
            input.checked = !!checked;
            return input;
        }

        function swipe(label, attributes) {
            return el('button', {
                type: 'button', class: 'slide-button ppwoo-swipe-action ppwoo-route-slide',
                'data-swipe-label': label, 'data-swipe-complete-label': 'Solte para confirmar',
                'aria-label': label, ...attributes
            }, el('span', { class: 'ppwoo-swipe-label' }, label),
            el('span', { class: 'ppwoo-swipe-thumb', 'aria-hidden': 'true' },
                el('span', { class: 'dashicons dashicons-yes' })));
        }

        function resetSwipe(buttonNode) {
            const $button = $(buttonNode);
            $button.removeClass('is-dragging is-complete').css({
                '--ppwoo-swipe-offset': '0px', '--ppwoo-swipe-progress': '0%'
            }).attr('aria-valuenow', '0');
            $button.find('.ppwoo-swipe-label').text($button.attr('data-swipe-label'));
        }

        function debug(command, result, data = {}) {
            if (!window.ppDebug || command === 'list') return;
            const route = Number.isInteger(data.route_id) ? ' · rota #' + data.route_id : '';
            const order = Number.isInteger(data.order_id) && data.order_id > 0 ? ' · pedido #' + data.order_id : '';
            window.ppDebug.log('Rotas: ' + command + ' · ' + result + route + order);
        }

        function activeTab() {
            return $panel.find('.tab-content.active').first();
        }

        function feedback(message, error) {
            activeTab().find('[data-route-feedback]').text(message || '').toggleClass('is-error', !!error);
        }

        async function api(command, data) {
            debug(command, 'solicitado', data);
            try {
                const response = await $.ajax({
                    method: 'POST', dataType: 'json', url: panelConfig.ajax_url, timeout: 35000,
                    data: { action: 'ppwoo_routes', nonce: panelConfig.nonce, payload: JSON.stringify({ command, ...data }) }
                });
                if (!response || !response.success || !response.data) throw new Error('Resposta inválida do painel.');
                debug(command, 'concluído', data);
                return response.data;
            } catch (error) {
                debug(command, 'falha' + (error.status ? ' HTTP ' + error.status : ''), data);
                throw new Error(error.responseJSON?.data?.message || error.message ||
                    'A resposta não chegou. Atualize as rotas para conferir o estado.');
            }
        }

        async function act(command, payload, options = {}) {
            if (busy) return;
            busy = true;
            const setBusy = value => {
                $panel.find('#tab-rotas, #tab-em-rota').attr('aria-busy', String(value));
                $panel.find('[data-routes-preview], [data-routes-drafts], [data-routes-active], [data-routes-history-list]')
                    .prop('inert', value);
            };
            setBusy(true);
            feedback(options.loading || 'Processando…');
            $panel.addClass('ppwoo-routes-busy');
            updateSelection();
            let errorMessage = '';
            try {
                if (pollRequest) await pollRequest;
                const data = await api(command, payload);
                if (options.after) options.after(data);
                if (command !== 'history') update(data, true);
                feedback(options.message || '');
                if (options.refreshMotoboy) $panel.find('.ppwoo-refresh-button').trigger('click');
            } catch (error) {
                errorMessage = error.message;
                feedback(errorMessage, true);
            } finally {
                busy = false;
                setBusy(false);
                $panel.removeClass('ppwoo-routes-busy');
                if (options.slider) resetSwipe(options.slider);
                updateSelection();
                updateDeliverySelections();
            }
            return !errorMessage;
        }

        function applyCollapsed(card) {
            const isCollapsed = collapsed.has(Number(card.dataset.orderId));
            card.classList.toggle('ppwoo-card-collapsed', isCollapsed);
            const toggle = card.querySelector('.ppwoo-fold-button');
            if (toggle) {
                toggle.textContent = isCollapsed ? 'Abrir' : 'Recolher';
                toggle.setAttribute('aria-expanded', String(!isCollapsed));
            }
        }

        function updateSelection() {
            const grouped = new Set(dashboard.routes.flatMap(route => route.stops.map(stop => stop.id)));
            $panel.find('#tab-motoboy .motoboy-order').each(function () {
                const checkbox = this.querySelector('.ppwoo-route-pick');
                if (checkbox) {
                    const reserved = grouped.has(Number(this.dataset.orderId));
                    this.hidden = reserved;
                    checkbox.disabled = reserved;
                    if (reserved) checkbox.checked = false;
                }
                applyCollapsed(this);
            });
            const $checkboxes = $panel.find('#tab-motoboy .ppwoo-route-pick:not(:disabled)');
            const count = $checkboxes.filter(':checked').length;
            $panel.find('[data-select-motoboy-all]').prop({
                checked: count > 0 && count === $checkboxes.length, indeterminate: count > 0 && count < $checkboxes.length,
                disabled: !$checkboxes.length
            });
            const $cards = $panel.find('#tab-motoboy .motoboy-order:not([hidden])');
            $panel.find('[data-fold-all]').text($cards.length && $cards.filter('.ppwoo-card-collapsed').length === $cards.length
                ? 'Abrir todos' : 'Recolher todos');
            $panel.find('[data-calculate-selected]').prop('disabled', busy || !count)
                .text(count ? 'Calcular rotas (' + count + ')' : 'Calcular rotas');
        }

        function groupSelect(order, source, previewToken) {
            const select = el('select', {
                'aria-label': 'Rota do pedido ' + order.number, 'data-group-order': order.id,
                'data-source': source?.id || 0, 'data-preview-token': previewToken
            });
            const slots = dashboard.routes.filter(route => route.state === 'draft').map(route => route.slot);
            const options = Array.from(new Set([1, 2, 3, 4, ...slots])).sort((a, b) => a - b);
            select.append(el('option', { value: 0 }, 'Sem rota'));
            options.forEach(slot => select.append(el('option', { value: slot }, 'Rota ' + slot)));
            if (slots.length >= 4) select.append(el('option', { value: -1 }, 'Nova rota'));
            select.value = String(source ? source.slot : 0);
            return select;
        }

        function updatePrivacyButton(node) {
            const key = node.dataset.privacy;
            node.setAttribute('aria-pressed', String(hidden[key]));
            node.querySelector('.dashicons').className = 'dashicons dashicons-' + (hidden[key] ? 'hidden' : 'visibility');
            node.querySelector('[data-privacy-label]').textContent = (hidden[key] ? 'Mostrar ' : 'Ocultar ') +
                (key === 'recipient' ? 'destinatário' : 'valores');
        }

        function privateControls() {
            const controls = ['recipient', 'values'].map(key => {
                const node = button('', { 'data-privacy': key });
                node.append(el('span', { class: 'dashicons', 'aria-hidden': 'true' }),
                    el('span', { 'data-privacy-label': '' }));
                updatePrivacyButton(node);
                return node;
            });
            return el('div', { class: 'ppwoo-routes-toolbar ppwoo-routes-private' }, controls);
        }

        function money(order) {
            if (!Number.isFinite(order.shipping_paid)) return '—';
            try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: order.currency || 'BRL' }).format(order.shipping_paid); }
            catch (_) { return order.shipping_paid.toFixed(2); }
        }

        function orderInfo(order, position, groupKey) {
            const key = groupKey + '-order-' + order.id;
            const details = el('details', { class: 'ppwoo-route-order', 'data-group-key': key },
                el('summary', {},
                    position ? 'Parada ' + position + ' · ' : '',
                    '#' + order.number,
                    el('span', { class: 'ppwoo-route-private-recipient' }, order.name ? ' · ' + order.name : '')),
                el('div', { class: 'ppwoo-route-private-recipient' },
                    el('p', {}, [order.address, order.complement].filter(Boolean).join(' · ') || 'Endereço indisponível'),
                    order.whatsapp && /^https:\/\/wa\.me\/\d+$/.test(order.whatsapp)
                        ? el('a', { href: order.whatsapp, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp ' + order.phone)
                        : el('span', {}, order.phone || ''),
                    order.delivery_message ? el('div', { class: 'ppwoo-routes-toolbar' },
                        el('textarea', { class: 'ppwoo-delivery-message', hidden: '', readonly: '', tabindex: '-1' }, order.delivery_message),
                        button('Copiar dados para o motoboy', { class: 'ppwoo-routes-button ppwoo-copy-delivery' })) : null));
            if (order.deadline) details.append(el('p', {}, 'Previsão: ' + order.deadline));
            details.open = openGroups.has(key);
            return details;
        }

        function mapPanel(calc, previous) {
            if (!calc?.stops?.length) return null;
            if (previous && previous.dataset.calculation === calc.token) return previous;
            const wrap = el('div', { class: 'ppwoo-route-map-wrap' });
            wrap.dataset.calculation = calc.token;
            const map = el('div', { class: 'ppwoo-route-map', 'aria-label': 'Mapa da rota com paradas numeradas' });
            map.routeCalculation = calc;
            wrap.append(map, el('details', { class: 'ppwoo-route-metrics', open: '' },
                el('summary', {}, 'Distância e duração'),
                el('p', {}, (calc.distance_meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km · ' +
                    Math.ceil(calc.duration_seconds / 60) + ' min estimados')));
            return wrap;
        }

        function issueMessage(code) {
            return ({
                not_found: 'Endereço não localizado.', no_route: 'Sem trajeto para essa parada.',
                provider_limit: 'Limite do provedor. Separe o pedido em outro grupo e recalcule.',
                quota: 'Cota do serviço atingida.', invalid_address: 'Confira o endereço do pedido.'
            })[code] || 'O ponto precisa de revisão.';
        }

        function renderPreview() {
            const container = $panel.find('[data-routes-preview]')[0];
            if (!preview) {
                disposeMaps(container);
                container.replaceChildren();
                return;
            }
            const grouped = new Set(dashboard.routes.flatMap(route => route.stops.map(stop => stop.id)));
            const remaining = preview.orders.filter(order => !grouped.has(order.id) && !preview.removed.has(order.id));
            if (!remaining.length) {
                // Mantém o token para reaproveitar o cálculo se um grupo tiver os mesmos pedidos.
                disposeMaps(container);
                container.replaceChildren();
                return;
            }
            const byId = new Map(remaining.map(order => [order.id, order]));
            const ordered = [...preview.calculation.stops, ...preview.calculation.issues];
            const box = el('section', { class: 'ppwoo-route-card' },
                el('h3', {}, 'Prévia da seleção'), privateControls(),
                mapPanel(preview.calculation, container.querySelector('.ppwoo-route-map-wrap')),
                el('p', {}, 'Use o seletor de cada pedido para confirmar o grupo. Depois, confira o cálculo do grupo.'));
            const list = el('div', { class: 'ppwoo-route-orders' });
            ordered.forEach(item => {
                const order = byId.get(item.order_id);
                if (!order) return;
                const position = preview.calculation.stops.findIndex(stop => stop.order_id === order.id) + 1;
                list.append(el('div', { class: 'ppwoo-route-row' }, orderInfo(order, position, 'preview'),
                    item.code ? el('p', { class: 'ppwoo-routes-warning' }, issueMessage(item.code)) : null,
                    el('div', { class: 'ppwoo-routes-toolbar' }, groupSelect(order, null, preview.calculation.token),
                        button('Desmarcar', { 'data-unselect-preview': order.id }))));
            });
            box.append(list, button('Dispensar prévia', { 'data-dismiss-preview': '' }));
            disposeMaps(container);
            container.replaceChildren(box);
        }

        function formFor(route) {
            const saved = route.sheet || {};
            const unsaved = sheets.get(route.id) || {};
            const fields = el('div', { class: 'ppwoo-route-sheet' },
                el('h4', {}, 'Ficha da rota'),
                el('label', {}, 'Link de rastreio', el('input', {
                    type: 'text', inputmode: 'url', maxlength: 2048, class: 'tracking-link', 'data-sheet-field': 'link',
                    value: unsaved.link ?? saved.link ?? ''
                })),
                el('label', {}, 'WhatsApp do motoboy', el('input', {
                    type: 'tel', class: 'motoboy-whatsapp', 'data-sheet-field': 'phone', value: unsaved.phone ?? saved.phone ?? ''
                })),
                el('label', { class: 'ppwoo-route-private-recipient' }, 'Código de finalização da última parada', el('input', {
                    type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 10,
                    'data-sheet-field': 'code', value: unsaved.code ?? saved.code ?? ''
                })),
                el('div', { class: 'ppwoo-route-costs' }, route.stops.map(order => el('label', {},
                    el('strong', {}, 'Parada ' + order.position + ' · #' + order.number,
                        el('span', { class: 'ppwoo-route-private-recipient' }, order.name ? ' · ' + order.name : '')),
                    el('small', { class: 'ppwoo-route-private-values' }, 'Frete pago pelo cliente: ' + money(order)),
                    el('span', { class: 'ppwoo-route-private-values' }, 'Custo negociado (R$)'),
                    el('input', {
                        type: 'text', inputmode: 'decimal', maxlength: 10, 'data-sheet-cost': order.id,
                        class: 'ppwoo-route-private-values', 'aria-label': 'Custo negociado do pedido ' + order.number,
                        value: unsaved.costs?.[order.id] ?? order.cost ?? ''
                    })))));
            fields.append(el('div', { class: 'ppwoo-routes-toolbar' }, button('Salvar ficha', { 'data-save-sheet': route.id })));
            const ready = route.calculation?.stops?.length === route.stops.length && !route.calculation.issues.length;
            const control = swipe('Deslize para concluir envio', { 'data-dispatch-route': route.id });
            control.disabled = !ready;
            if (!ready) fields.append(el('p', { class: 'ppwoo-routes-warning' }, 'Calcule a rota e resolva as paradas pendentes para despachar.'));
            fields.append(control);
            return fields;
        }

        function renderDrafts() {
            const container = $panel.find('[data-routes-drafts]')[0];
            const previous = new Map(Array.from(container.children, node => [node.dataset.routeId, node]));
            const fragment = document.createDocumentFragment();
            const drafts = dashboard.routes.filter(route => route.state === 'draft');
            if (!drafts.length) fragment.append(el('p', {}, 'Nenhuma rota em preparação.'));
            drafts.forEach(route => {
                const key = 'draft-' + route.id;
                const box = el('details', { class: 'ppwoo-route-card', 'data-group-key': key, 'data-route-id': route.id });
                box.open = openGroups.has(key);
                const body = el('div', { class: 'ppwoo-group-body' }, privateControls(),
                    mapPanel(route.calculation, previous.get(String(route.id))?.querySelector('.ppwoo-route-map-wrap')));
                const issueById = new Map((route.calculation?.issues || []).map(issue => [issue.order_id, issue.code]));
                const calculationByOrder = new Map((route.calculation?.stops || []).map(stop => [stop.order_id, stop]));
                const stops = el('details', { class: 'ppwoo-route-stops', 'data-group-key': key + '-stops' },
                    el('summary', {}, 'Paradas e pedidos (' + route.stops.length + ')'));
                stops.open = openGroups.has(key + '-stops');
                route.stops.forEach(order => {
                    const estimate = calculationByOrder.get(order.id);
                    const distance = Number.isFinite(estimate?.distance_meters)
                        ? ' · ' + (estimate.distance_meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km' : '';
                    stops.append(el('div', { class: 'ppwoo-route-row' }, orderInfo(order, order.position, key),
                        estimate ? el('small', {}, 'Estimativa após a saída: ' + Math.ceil(estimate.eta_seconds / 60) + ' min' + distance) : null,
                        issueById.has(order.id) ? el('p', { class: 'ppwoo-routes-warning' }, issueMessage(issueById.get(order.id))) : null,
                        groupSelect(order, route)));
                });
                body.append(button(route.calculation ? 'Recalcular rota' : 'Calcular esta rota',
                    { 'data-recalculate-route': route.id }), stops, formFor(route));
                box.append(el('summary', {}, 'Rota ' + route.slot + ' · ' + route.stops.length + ' pedidos'), body);
                fragment.append(box);
            });
            disposeMaps(container);
            container.replaceChildren(fragment);
        }

        const eventLabels = {
            queued: 'Na fila de envio', sending: 'Enviando', accepted: 'Recebido pelo webhook',
            failed: 'Falha de envio', uncertain: 'A conferir', waiting: 'Aguardando'
        };
        const resultLabels = {
            order_unavailable: 'Pedido indisponível para despacho.',
            order_save: 'Falha ao salvar o pedido.',
            webhook_setup: 'Confira o webhook HTTPS de despacho.',
            rejected: 'O webhook rejeitou o evento.',
            connection: 'A conexão caiu antes da confirmação.',
            worker_interrupted: 'A tentativa foi interrompida.'
        };

        function deliveryGroup(route, isHistory) {
            const key = (isHistory ? 'history-' : 'sent-') + route.id;
            const selection = closeSelections.get(route.id) || new Set();
            const open = route.stops.filter(order => order.delivery_state === 'on_route');
            const received = route.stops.filter(order => order.event_state === 'accepted').length;
            const box = el('details', { class: 'ppwoo-route-card', 'data-group-key': key, 'data-route-id': route.id });
            box.open = openGroups.has(key);
            box.append(el('summary', {}, 'Rota ' + route.slot + ' · Saída #' + route.id +
                (isHistory ? ' · Encerrada' : ' · ' + open.length + ' em rota')));
            const body = el('div', { class: 'ppwoo-group-body' }, privateControls(),
                el('progress', { value: received, max: route.stops.length, 'aria-label': 'Eventos recebidos' }),
                el('p', {}, received + ' de ' + route.stops.length + ' eventos recebidos'));
            if (route.departed_at) body.append(el('small', {}, 'Saída: ' + new Date(route.departed_at).toLocaleString('pt-BR')));
            if (open.length) body.append(el('label', {},
                check(false, { 'data-select-delivery-all': route.id }), ' Selecionar todos ainda em rota'));
            route.stops.forEach(order => {
                const canRetry = order.event_state === 'failed' || (order.event_state === 'uncertain' && dashboard.retry_uncertain);
                body.append(el('div', { class: 'ppwoo-route-row' },
                    order.delivery_state === 'on_route'
                        ? el('label', {}, check(selection.has(order.id), { 'data-close-order': order.id }), ' Incluir na baixa') : null,
                    orderInfo(order, order.position, key),
                    el('small', {}, (order.delivery_state === 'closed' ? 'Baixa registrada · ' : '') +
                        (eventLabels[order.event_state] || 'Aguardando') + (order.attempt ? ' · tentativa ' + order.attempt : '')),
                    order.code ? el('small', {}, resultLabels[order.code] || (/^http_\d+$/.test(order.code) ? order.code.replace('http_', 'HTTP ') : '')) : null,
                    canRetry ? button('Reenviar este pedido', { 'data-retry-order': order.id, 'data-route-id': route.id }) : null));
            });
            if (route.stops.some(order => order.event_state === 'queued' || order.event_state === 'uncertain')) {
                body.append(button('Retomar pedidos na fila', { 'data-resume-route': route.id }));
            }
            if (open.length) body.append(swipe('Deslize para finalizar selecionados', { 'data-close-route': route.id }));
            box.append(body);
            return box;
        }

        function renderActive() {
            const parent = $panel.find('[data-routes-active]')[0];
            const active = dashboard.routes.filter(route => route.state === 'dispatched');
            parent.replaceChildren(...(active.length ? active.map(route => deliveryGroup(route, false))
                : [el('p', {}, 'Nenhum pedido em rota.')]));
            updateDeliverySelections();
        }

        function updateDeliverySelections() {
            dashboard.routes.filter(route => route.state === 'dispatched').forEach(route => {
                const selected = closeSelections.get(route.id) || new Set();
                const open = route.stops.filter(order => order.delivery_state === 'on_route');
                const count = open.filter(order => selected.has(order.id)).length;
                $panel.find('[data-close-route="' + route.id + '"]').prop('disabled', busy || !count);
                $panel.find('[data-select-delivery-all="' + route.id + '"]').prop({
                    checked: count > 0 && count === open.length, indeterminate: count > 0 && count < open.length
                });
            });
        }

        function update(data, full) {
            const previous = JSON.stringify(dashboard.routes.filter(route => route.state === 'dispatched'));
            const oldResults = new Map(dashboard.routes.flatMap(route =>
                route.stops.map(stop => [stop.id, stop.event_state + ':' + stop.attempt])));
            dashboard = data;
            data.routes.filter(route => route.state === 'dispatched').forEach(route => route.stops.forEach(stop => {
                if (oldResults.get(stop.id) !== stop.event_state + ':' + stop.attempt) {
                    debug('disparo', eventLabels[stop.event_state] || 'Aguardando', { route_id: route.id, order_id: stop.id });
                }
            }));
            updateSelection();
            if (full) {
                renderPreview();
                renderDrafts();
            }
            if (full || previous !== JSON.stringify(data.routes.filter(route => route.state === 'dispatched'))) renderActive();
            drawVisibleMaps();
        }

        async function poll(full) {
            if (document.hidden || pollRequest || busy || $panel.find('.ppwoo-route-slide.is-dragging').length) return;
            const tab = activeTab().attr('id');
            if (!full && tab !== 'tab-em-rota') return;
            pollRequest = api('list', {}).then(data => {
                if (!busy && !$panel.find('.ppwoo-route-slide.is-dragging').length) update(data, full);
            }).catch(error => feedback(error.message, true));
            try { await pollRequest; }
            finally { pollRequest = null; }
        }

        function loadMaps() {
            if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
            if (!config.maps_key) return Promise.reject(new Error('Configure a chave do Google Maps nas configurações de rotas.'));
            if (!mapsLibrary) {
                mapsLibrary = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    const callback = 'ppwooRoutesMapsReady';
                    const fail = () => reject(new Error('O mapa não carregou. Use a lista de paradas ou confira a configuração do Google Maps.'));
                    const timer = setTimeout(fail, 12000);
                    window[callback] = () => {
                        clearTimeout(timer);
                        resolve(window.google.maps);
                    };
                    window.gm_authFailure = fail;
                    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
                        key: config.maps_key, loading: 'async', callback, v: 'weekly', language: 'pt-BR', region: 'BR'
                    });
                    script.async = true;
                    script.onerror = () => { clearTimeout(timer); fail(); };
                    document.head.appendChild(script);
                });
            }
            return mapsLibrary;
        }

        function marker(maps, map, point, label, isOrigin) {
            const marker = new maps.OverlayView();
            const node = el('span', { class: isOrigin ? 'ppwoo-route-marker is-origin' : 'ppwoo-route-marker',
                title: isOrigin ? 'Origem' : 'Parada ' + label }, label);
            marker.onAdd = function () { this.getPanes().overlayLayer.appendChild(node); };
            marker.draw = function () {
                const pixel = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lng));
                if (pixel) Object.assign(node.style, { left: pixel.x + 'px', top: pixel.y + 'px' });
            };
            marker.onRemove = function () { node.remove(); };
            marker.setMap(map);
            return marker;
        }

        function disposeMaps(container) {
            container.querySelectorAll('.ppwoo-route-map').forEach(node => {
                (node.routeOverlays || []).forEach(overlay => overlay.setMap(null));
                if (node.routeMap) window.google?.maps?.event?.clearInstanceListeners(node.routeMap);
            });
        }

        function drawVisibleMaps() {
            window.requestAnimationFrame(() => {
                $panel.find('.ppwoo-route-map:visible').each(function () {
                    if (this.dataset.drawn || !this.routeCalculation) return;
                    const node = this;
                    node.dataset.drawn = '1';
                    const calc = node.routeCalculation;
                    loadMaps().then(maps => {
                        if (!node.isConnected || !$(node).is(':visible')) {
                            delete node.dataset.drawn;
                            return;
                        }
                        const map = new maps.Map(node, {
                            center: calc.origin, zoom: 12, clickableIcons: false, gestureHandling: 'cooperative',
                            mapTypeControl: false, streetViewControl: false, fullscreenControl: false
                        });
                        node.routeMap = map;
                        const bounds = new maps.LatLngBounds();
                        calc.path.forEach(point => bounds.extend(point));
                        node.routeOverlays = [
                            marker(maps, map, calc.origin, 'O', true),
                            ...calc.stops.map((stop, index) => marker(maps, map, stop.location, String(index + 1), false)),
                            new maps.Polyline({ map, path: calc.path, strokeColor: '#1658b8', strokeOpacity: 0.9, strokeWeight: 4 })
                        ];
                        map.fitBounds(bounds, 28);
                    }).catch(error => { node.textContent = error.message; });
                });
            });
        }

        function currentRoute(id) {
            return dashboard.routes.find(route => route.id === Number(id));
        }

        function sheetInput(id, card) {
            const sheet = { costs: {} };
            card.querySelectorAll('[data-sheet-field]').forEach(input => { sheet[input.dataset.sheetField] = input.value; });
            card.querySelectorAll('[data-sheet-cost]').forEach(input => { sheet.costs[input.dataset.sheetCost] = input.value; });
            sheets.set(id, sheet);
            return sheet;
        }

        $panel[0].addEventListener('toggle', event => {
            const node = event.target;
            if (!node.dataset?.groupKey || !node.isConnected) return;
            if (node.open) openGroups.add(node.dataset.groupKey);
            else openGroups.delete(node.dataset.groupKey);
            drawVisibleMaps();
        }, true);
        $panel.on('ppwoo:panel-refreshed', updateSelection);
        $panel.on('click', '.ppwoo-fold-button', function () {
            const card = this.closest('.motoboy-order');
            const id = Number(card.dataset.orderId);
            if (!collapsed.delete(id)) collapsed.add(id);
            updateSelection();
        });
        $panel.on('click', '[data-fold-all]', function () {
            const close = this.textContent === 'Recolher todos';
            $panel.find('#tab-motoboy .motoboy-order:not([hidden])').each(function () {
                const id = Number(this.dataset.orderId);
                if (close) collapsed.add(id); else collapsed.delete(id);
            });
            updateSelection();
        });
        $panel.on('change', '.ppwoo-route-pick', updateSelection);
        $panel.on('change', '[data-select-motoboy-all]', function () {
            $panel.find('#tab-motoboy .ppwoo-route-pick:not(:disabled)').prop('checked', this.checked);
            updateSelection();
        });
        $panel.on('click', '[data-calculate-selected]', function () {
            const ids = $panel.find('.ppwoo-route-pick:checked:not(:disabled)').map(function () {
                return Number(this.closest('[data-order-id]').dataset.orderId);
            }).get();
            if (!ids.length) return;
            if (ids.length > config.max_batch) {
                feedback('Selecione até ' + config.max_batch + ' pedidos por cálculo. Os demais seguem disponíveis na aba Motoboy.', true);
                return;
            }
            act('plan', { order_ids: ids }, { loading: 'Consultando o n8n…', after: data => {
                preview = { calculation: data.calculation, orders: data.orders, removed: new Set() };
                $panel.find('.tab-button[data-tab="rotas"]').trigger('click');
            } });
        });
        $panel.on('click', '[data-unselect-preview]', function () {
            const id = Number(this.dataset.unselectPreview);
            preview.removed.add(id);
            $panel.find('.motoboy-order[data-order-id="' + id + '"] .ppwoo-route-pick').prop('checked', false);
            debug('prévia', 'pedido desmarcado');
            renderPreview();
            updateSelection();
            drawVisibleMaps();
        });
        $panel.on('click', '[data-dismiss-preview]', function () {
            preview = null;
            renderPreview();
        });
        $panel.on('change', '[data-group-order]', function () {
            const orderId = Number(this.dataset.groupOrder);
            const source = currentRoute(this.dataset.source);
            const slot = Number(this.value);
            const target = dashboard.routes.find(route => route.state === 'draft' && route.slot === slot);
            const transfer = source && sheets.get(source.id)?.costs?.[orderId];
            this.value = String(source?.slot || 0);
            act('group', {
                order_id: orderId, slot, preview: this.dataset.previewToken || '', source_id: source?.id || 0,
                source_revision: source?.revision, target_id: target?.id || 0, target_revision: target?.revision
            }, { refreshMotoboy: true, message: 'Grupo atualizado.', after: data => {
                const group = data.routes.find(route => route.state === 'draft' && route.stops.some(order => order.id === orderId));
                if (group) {
                    openGroups.add('draft-' + group.id);
                    if (transfer != null) {
                        const saved = sheets.get(group.id) || {};
                        sheets.set(group.id, { ...saved, costs: { ...saved.costs, [orderId]: transfer } });
                    }
                }
            } });
        });
        $panel.on('click', '[data-recalculate-route]', function () {
            const route = currentRoute(this.dataset.recalculateRoute);
            if (route) act('recalculate', { route_id: route.id, revision: route.revision, preview: preview?.calculation.token }, {
                loading: 'Calculando o grupo…', message: 'Cálculo atualizado. Confira as paradas.'
            });
        });
        $panel.on('input', '[data-sheet-field], [data-sheet-cost]', function () {
            const card = this.closest('[data-route-id]');
            if (card) sheetInput(Number(card.dataset.routeId), card);
        });
        $panel.on('click', '[data-save-sheet]', function () {
            const route = currentRoute(this.dataset.saveSheet);
            if (!route) return;
            const sheet = sheetInput(route.id, this.closest('[data-route-id]'));
            act('save', { route_id: route.id, revision: route.revision, sheet }, {
                message: 'Ficha salva.', after: () => sheets.delete(route.id)
            });
        });
        $panel.on('ppwoo:slide-complete', '[data-dispatch-route]', function () {
            const route = currentRoute(this.dataset.dispatchRoute);
            if (!route || busy) { resetSwipe(this); return; }
            const sheet = sheetInput(route.id, this.closest('[data-route-id]'));
            act('dispatch', { route_id: route.id, revision: route.revision, sheet }, {
                slider: this, refreshMotoboy: true, message: 'Saída registrada. Acompanhe os disparos por pedido.',
                after: () => {
                    sheets.delete(route.id);
                    openGroups.add('sent-' + route.id);
                    $panel.find('.tab-button[data-tab="em-rota"]').trigger('click');
                }
            });
        });
        $panel.on('change', '[data-close-order], [data-select-delivery-all]', function () {
            const route = currentRoute(this.closest('[data-route-id]').dataset.routeId);
            if (!route) return;
            const ids = closeSelections.get(route.id) || new Set();
            if (this.hasAttribute('data-select-delivery-all')) {
                ids.clear();
                if (this.checked) route.stops.filter(order => order.delivery_state === 'on_route').forEach(order => ids.add(order.id));
            } else if (this.checked) ids.add(Number(this.dataset.closeOrder));
            else ids.delete(Number(this.dataset.closeOrder));
            closeSelections.set(route.id, ids);
            if (this.hasAttribute('data-select-delivery-all')) renderActive();
            updateDeliverySelections();
        });
        $panel.on('ppwoo:slide-complete', '[data-close-route]', function () {
            const route = currentRoute(this.dataset.closeRoute);
            const ids = Array.from(closeSelections.get(route?.id) || []);
            if (!route || !ids.length || busy) { resetSwipe(this); return; }
            act('close', { route_id: route.id, revision: route.revision, order_ids: ids }, {
                slider: this, message: 'Baixa registrada.', after: () => closeSelections.delete(route.id)
            });
        });
        $panel.on('click', '[data-retry-order], [data-resume-route]', function () {
            const routeId = Number(this.dataset.routeId || this.dataset.resumeRoute);
            const retry = !!this.dataset.retryOrder;
            const route = currentRoute(routeId);
            const revision = route?.revision || Number(this.closest('details[data-route-id]').dataset.revision);
            if (retry && !window.confirm('Reenviar o evento deste pedido?')) return;
            act(retry ? 'retry' : 'resume', { route_id: routeId, revision, order_id: Number(this.dataset.retryOrder || 0) }, {
                message: 'Processamento solicitado.',
                after: () => {
                    if (!route) {
                        $panel.find('[data-routes-history-list]').empty();
                        $panel.find('[data-routes-history]').text('Atualizar histórico');
                        historyNext = 0;
                    }
                }
            });
        });
        $panel.on('click', '[data-privacy]', function () {
            const key = this.dataset.privacy;
            hidden[key] = !hidden[key];
            $panel.toggleClass('ppwoo-hide-route-' + key, hidden[key]);
            $panel.find('[data-privacy="' + key + '"]').each((_, node) => updatePrivacyButton(node));
        });
        $panel.on('click', '[data-reload-routes]', () => poll(true));
        $panel.on('click', '.tab-button[data-tab="rotas"], .tab-button[data-tab="em-rota"]', drawVisibleMaps);
        $panel.on('click', '[data-routes-history]', function () {
            const $list = $panel.find('[data-routes-history-list]');
            act('history', { before: historyNext }, { after: data => {
                if (!historyNext) $list.empty();
                if (!data.routes.length) $list.append(el('p', {}, 'Nenhuma rota encerrada.'));
                data.routes.forEach(route => {
                    const node = deliveryGroup(route, true);
                    node.dataset.revision = String(route.revision);
                    $list.append(node);
                });
                historyNext = data.history_next;
                this.textContent = historyNext ? 'Carregar mais do histórico' : 'Atualizar histórico';
            } });
        });

        updateSelection();
        poll(true);
        setInterval(() => poll(false), 6000);
    });
})(jQuery, window.PPWOO_ROUTES, window.PPWOO);
