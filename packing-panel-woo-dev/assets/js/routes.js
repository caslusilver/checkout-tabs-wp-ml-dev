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
        let expandedMap = null;
        let saveTimer;
        let saveRequest = null;
        let lastReload = 0;
        const saveErrors = new Map();
        const editRevisions = new Map();
        const saveConflicts = new Set();
        const seenMemberships = new Map();
        const routeColors = ['#1658b8', '#7550a4', '#197365', '#96511d', '#9a4267', '#476475'];

        function routeStyle(slot) {
            return '--ppwoo-route-color:' + routeColors[(Math.max(1, Number(slot)) - 1) % routeColors.length];
        }

        function duration(seconds) {
            const minutes = Math.ceil((Number(seconds) || 0) / 60);
            if (minutes < 60) return minutes + ' min';
            return Math.floor(minutes / 60) + ' h' + (minutes % 60 ? ' ' + minutes % 60 + ' min' : '');
        }

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
                const failure = new Error(error.responseJSON?.data?.message || error.message ||
                    'A resposta não chegou. Atualize o painel para conferir o estado.');
                failure.status = error.status;
                throw failure;
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
                const revisions = new Map(dashboard.routes.map(route => [route.id, route.revision]));
                if (!await flushAutosaves(true)) throw new Error('Confira a ficha que não foi salva antes de continuar.');
                for (const [idKey, revisionKey] of [['route_id', 'revision'], ['source_id', 'source_revision'], ['target_id', 'target_revision']]) {
                    if (payload[idKey] && revisions.get(payload[idKey]) === payload[revisionKey]) {
                        payload[revisionKey] = currentRoute(payload[idKey])?.revision ?? payload[revisionKey];
                    }
                }
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
                updateReadiness();
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
            const grouped = new Map(dashboard.routes.flatMap(route => route.stops.map(stop => [stop.id, { route, stop }])));
            $panel.find('#tab-motoboy .motoboy-order').each(function () {
                const checkbox = this.querySelector('.ppwoo-route-pick');
                if (checkbox) {
                    const membership = grouped.get(Number(this.dataset.orderId));
                    const reserved = membership && membership.route.state !== 'draft';
                    const badge = this.querySelector('.ppwoo-membership') || el('small', { class: 'ppwoo-membership' });
                    if (!badge.isConnected) this.querySelector('.ppwoo-fold-head')?.append(badge);
                    badge.textContent = membership ? 'Rota ' + membership.route.slot + ' · Parada ' + membership.stop.position : 'Sem rota';
                    badge.setAttribute('style', routeStyle(membership?.route.slot || 1));
                    this.classList.toggle('ppwoo-in-draft', !!membership && !reserved);
                    const orderId = Number(this.dataset.orderId);
                    if (membership && !reserved && seenMemberships.get(orderId) !== membership.route.id) collapsed.add(orderId);
                    if (membership) seenMemberships.set(orderId, membership.route.id);
                    else seenMemberships.delete(orderId);
                    const contact = membership?.stop;
                    if (contact) {
                        const phoneLine = this.querySelector('.whatsapp-to-copy');
                        const info = phoneLine?.querySelector('.ppwoo-phone-country');
                        if (phoneLine && !info) phoneLine.append(phoneCountry(contact));
                    }
                    this.hidden = !!reserved;
                    checkbox.disabled = !!reserved;
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
                .text(count ? 'Visualizar rota da seleção (' + count + ')' : 'Visualizar rota da seleção')
                .addClass('ppwoo-routes-button ppwoo-routes-primary');
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
            if (source) select.setAttribute('style', routeStyle(source.slot));
            return select;
        }

        function updatePrivacyButton(node) {
            const key = node.dataset.privacy;
            node.setAttribute('aria-pressed', String(hidden[key]));
            node.querySelector('.dashicons').className = 'dashicons dashicons-' + (hidden[key] ? 'hidden' : 'visibility');
            const label = key === 'recipient' ? 'Destinatário' : 'Valores';
            node.querySelector('[data-privacy-label]').textContent = label;
            node.setAttribute('aria-label', (hidden[key] ? 'Mostrar ' : 'Ocultar ') + label.toLowerCase() + ' em todas as rotas');
            node.title = node.getAttribute('aria-label');
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

        function copyIcon(value, label) {
            return el('button', { type: 'button', class: 'copy-button ppwoo-copy-value',
                'data-copy-value': value || '', title: label, 'aria-label': label },
                el('span', { class: 'dashicons dashicons-admin-page', 'aria-hidden': 'true' }));
        }

        function pendingLabel(count) {
            return count === 0 ? 'Todas as entregas finalizadas' : count + (count === 1 ? ' entrega pendente' : ' entregas pendentes');
        }

        function destinationInfo(route) {
            const calc = route.calculation;
            const valid = calc && !calc.issues?.length && calc.stops?.length === route.stops.length &&
                (route.state !== 'draft' || !calc.expires_at || calc.expires_at * 1000 > Date.now());
            const last = valid && route.stops.find(order => order.id === calc.destination_order_id);
            return el('small', { class: 'ppwoo-route-destination', 'data-route-destination': route.id },
                last ? el('span', { class: 'ppwoo-route-private-recipient' }, 'Destino final: ' + (last.name || 'Pedido #' + last.number) + ' · ' +
                    (last.address_display || last.address || 'Endereço indisponível'))
                    : (route.state === 'draft' ? 'Destino a confirmar · recalcule' : 'Destino não disponível'));
        }

        function orderInfo(order, position, groupKey, context = {}) {
            const key = groupKey + '-order-' + order.id;
            const address = order.address_display || order.address || 'Endereço indisponível';
            const badge = el('span', { class: 'ppwoo-route-badge', style: context.slot ? routeStyle(context.slot) : '' },
                context.slot ? 'Rota ' + context.slot : 'Sem rota');
            const client = el('div', { class: 'order-client-info' },
                el('h4', {}, 'Cliente:'),
                el('p', { class: 'client-name-to-copy' }, el('span', {}, order.name || ''), copyIcon(order.name, 'Copiar nome')),
                el('h4', {}, 'WhatsApp:'),
                el('p', { class: 'whatsapp-to-copy' },
                    order.whatsapp && /^https:\/\/wa\.me\/\d+$/.test(order.whatsapp)
                        ? el('a', { class: 'ppwoo-whatsapp-link', href: order.whatsapp, target: '_blank', rel: 'noopener noreferrer' }, order.phone)
                        : el('span', {}, order.phone || ''), copyIcon(order.phone, 'Copiar WhatsApp')), phoneCountry(order));
            const delivery = el('div', { class: 'order-address' }, el('h4', {}, 'Endereço:'),
                el('p', { class: 'address-to-copy' }, el('span', {}, address), copyIcon(order.address_copy || address, 'Copiar endereço')),
                order.postcode ? el('p', { class: 'cep' }, 'CEP: ' + order.postcode) : null,
                order.complement ? el('p', { class: 'billing-complemento' }, 'Complemento: ' + order.complement) : null);
            if (order.delivery_message) delivery.append(
                el('textarea', { class: 'ppwoo-delivery-message', hidden: '', readonly: '', tabindex: '-1' }, order.delivery_message),
                el('p', { class: 'ppwoo-delivery-copy-line' }, 'Dados para o motoboy',
                    el('button', { type: 'button', class: 'copy-button ppwoo-copy-delivery', title: 'Copiar dados para o motoboy',
                        'aria-label': 'Copiar dados para o motoboy' }, el('span', { class: 'dashicons dashicons-admin-page', 'aria-hidden': 'true' }))));
            const details = el('details', { class: 'ppwoo-route-order', 'data-group-key': key },
                el('summary', {},
                    el('span', { class: 'ppwoo-stop-position' }, position ? 'Parada ' + position + ' de ' + context.total +
                        (order.is_last ? ' · Última parada' : '') : 'Parada pendente'),
                    el('span', { class: 'ppwoo-route-identity' }, '#' + order.number,
                        el('span', { class: 'ppwoo-route-private-recipient' }, order.name ? ' · ' + order.name : '')),
                    el('small', { class: 'ppwoo-route-private-recipient ppwoo-order-address-summary' }, address),
                    context.pending !== undefined ? el('small', { class: 'ppwoo-order-pending' }, pendingLabel(context.pending)) : null),
                el('div', { class: 'ppwoo-route-customer-card ppwoo-route-private-recipient' },
                    el('div', { class: 'order-header' }, el('h3', {}, 'Pedido #' + order.number), badge), client, delivery));
            if (order.deadline) details.append(el('p', {}, 'Previsão: ' + order.deadline));
            details.open = openGroups.has(key);
            return details;
        }

        function tripInfo(route) {
            const trip = route.trip;
            if (!trip) return el('p', { class: 'ppwoo-trip-info' }, 'Dados da viagem não disponíveis.');
            return el('section', { class: 'ppwoo-trip-info ppwoo-route-private-recipient', 'aria-label': 'Dados da viagem' },
                el('h4', {}, 'Viagem'),
                el('div', { class: 'ppwoo-trip-contact' },
                    el('span', {}, 'WhatsApp do motoboy: ',
                        /^https:\/\/wa\.me\/\d+$/.test(trip.whatsapp || '')
                            ? el('a', { href: trip.whatsapp, target: '_blank', rel: 'noopener noreferrer' }, trip.phone)
                            : (trip.phone || 'Não informado')),
                    trip.code ? el('span', { class: 'ppwoo-trip-code-group' }, 'Código ',
                        el('strong', { class: 'ppwoo-trip-code' }, trip.code)) : null),
                trip.link && /^https?:\/\//.test(trip.link) ? el('p', { class: 'ppwoo-trip-tracking' },
                    el('a', { href: trip.link, target: '_blank', rel: 'noopener noreferrer' }, trip.link)) : null,
                route.state === 'dispatched' ? el('div', { class: 'ppwoo-trip-actions' },
                    button('Compartilhar', { 'data-share-trip': route.id }),
                    button('⧉', { 'data-copy-trip': route.id, title: 'Copiar mensagem para um destinatário', 'aria-label': 'Copiar mensagem para um destinatário' })) : null);
        }

        function driverPreview(value) {
            let digits = String(value || '').replace(/\D/g, '');
            if (/^55\d{10,11}$/.test(digits)) digits = digits.slice(2);
            return /^\d{10,11}$/.test(digits) ? 'https://wa.me/55' + digits : '';
        }

        function chooseTripRecipient(route, copying) {
            const dialog = el('dialog', { class: 'ppwoo-trip-share-dialog' }, el('h3', {}, copying ? 'Copiar para quem?' : 'Compartilhar com quem?'));
            const close = () => { dialog.close(); dialog.remove(); };
            dialog.addEventListener('cancel', close);
            route.stops.filter(order => order.delivery_state === 'on_route').forEach(order => {
                const choose = button('Parada ' + order.position + ' · #' + order.number + ' · ' + order.name);
                choose.addEventListener('click', async () => {
                    choose.disabled = true;
                    try {
                        let result;
                        try { result = await api('tracking_link', { route_id: route.id, order_id: order.id }); }
                        catch (error) {
                            if (!/venceu/.test(error.message) || !window.confirm('O link venceu. Gerar novo acesso de 24 horas e invalidar o anterior?')) throw error;
                            result = await api('tracking_link', { route_id: route.id, order_id: order.id, renew: true });
                        }
                        const last = route.calculation?.destination_order_id === order.id;
                        const parts = ['Seu pedido #' + order.number + ' está a caminho.',
                            'Sua parada é a ' + order.position + ' de ' + route.stops.length + '.',
                            'WhatsApp do motoboy: ' + (route.trip?.whatsapp || ''),
                            last ? 'Informe este código para finalização da corrida: ' + route.trip.code : 'O motoboy fará uma parada no seu endereço antes de seguir para o destino final.',
                            'Aqui está o link de rastreio da sua viagem pela Uber: ' + (route.trip?.link || ''),
                            'Acompanhe seu pedido e confirme o recebimento: ' + result.tracking_url];
                        const message = parts.join('\n\n');
                        const text = el('textarea', { readonly: '', rows: '10', 'aria-label': 'Mensagem para o destinatário' }, message);
                        dialog.replaceChildren(el('h3', {}, 'Parada ' + order.position + ' · ' + order.name), text);
                        if (copying) dialog.append(copyIcon(message, 'Copiar mensagem completa'));
                        else if (/^https:\/\/wa\.me\/\d+$/.test(order.whatsapp || '')) dialog.append(el('a', {
                            class: 'ppwoo-routes-button', href: order.whatsapp + '?text=' + encodeURIComponent(message), target: '_blank', rel: 'noopener noreferrer'
                        }, 'Abrir WhatsApp com a mensagem'));
                        else dialog.append(el('p', {}, 'WhatsApp do cliente indisponível. Use Copiar para enviar por outro canal.'));
                        const done = button('Fechar'); done.addEventListener('click', close); dialog.append(done);
                    } catch (error) { choose.disabled = false; choose.textContent = error.message; }
                });
                dialog.append(choose);
            });
            const cancel = button('Fechar'); cancel.addEventListener('click', close); dialog.append(cancel);
            $panel[0].append(dialog); dialog.showModal();
        }

        function phoneCountry(order) {
            let country = order.phone_country;
            // Só inferir prefixos inequívocos já conhecidos; não usar o país de entrega.
            if (!country) country = ({ '+33': 'FR', '+351': 'PT', '+49': 'DE', '+39': 'IT', '+34': 'ES', '+81': 'JP' })[order.dial_code];
            let label = order.dial_code || '';
            if (country && country !== 'BR') {
                let name = country;
                try { name = new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(country); } catch (_) { /* DDI continua visível */ }
                const flag = Array.from(country, letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
                label += ' · ' + flag + ' ' + name;
            }
            return el('small', { class: 'ppwoo-phone-country' }, label);
        }

        function mapPanel(calc, previous) {
            if (!calc?.stops?.length) return null;
            if (previous && previous.dataset.calculation === calc.token) return previous;
            const wrap = el('div', { class: 'ppwoo-route-map-wrap' });
            wrap.dataset.calculation = calc.token;
            const map = el('div', { class: 'ppwoo-route-map', 'aria-label': 'Mapa da rota com paradas numeradas' });
            map.routeCalculation = calc;
            const controls = el('div', { class: 'ppwoo-map-controls', 'aria-label': 'Visualização do mapa' },
                button('Focar saída', { 'data-focus-origin': '', disabled: '' }),
                button('Expandir', { 'data-expand-map': '', 'aria-expanded': 'false', 'aria-label': 'Expandir mapa' }));
            wrap.append(el('div', { class: 'ppwoo-route-map-stage' }, map, controls), el('details', { class: 'ppwoo-route-metrics', open: '' },
                el('summary', {}, 'Distância e duração'),
                el('p', {}, (calc.distance_meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km · ' +
                    duration(calc.duration_seconds) + ' estimados')));
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
            const remaining = preview.orders.filter(order => !preview.removed.has(order.id));
            if (!remaining.length) {
                // Mantém o token para reaproveitar o cálculo se um grupo tiver os mesmos pedidos.
                disposeMaps(container);
                container.replaceChildren();
                return;
            }
            const byId = new Map(remaining.map(order => [order.id, order]));
            const ordered = [...preview.calculation.stops, ...preview.calculation.issues];
            const box = el('section', { class: 'ppwoo-route-card' },
                el('h3', {}, 'Prévia da seleção'),
                mapPanel(preview.calculation, container.querySelector('.ppwoo-route-map-wrap')),
                el('p', {}, 'Use o seletor de cada pedido para confirmar o grupo. Depois, confira o cálculo do grupo.'));
            const list = el('div', { class: 'ppwoo-route-orders' });
            const assigned = el('details', { class: 'ppwoo-preview-assigned', 'data-group-key': 'preview-assigned' });
            const assignedList = el('div', { class: 'ppwoo-route-orders' });
            assigned.open = openGroups.has('preview-assigned');
            let assignedCount = 0;
            ordered.forEach(item => {
                const order = byId.get(item.order_id);
                if (!order) return;
                const position = preview.calculation.stops.findIndex(stop => stop.order_id === order.id) + 1;
                order.is_last = preview.calculation.destination_order_id === order.id;
                const source = dashboard.routes.find(route => route.state === 'draft' && route.stops.some(stop => stop.id === order.id));
                const row = el('div', { class: 'ppwoo-route-row' }, orderInfo(order, position, 'preview', { slot: source?.slot, total: preview.orders.length }),
                    item.code ? el('p', { class: 'ppwoo-routes-warning' }, issueMessage(item.code)) : null,
                    el('div', { class: 'ppwoo-routes-toolbar' }, groupSelect(order, source, preview.calculation.token),
                        button('Desmarcar', { 'data-unselect-preview': order.id, title: 'Retirar da prévia, mantendo a rota atribuída' })));
                if (source) { assignedList.append(row); assignedCount++; }
                else list.append(row);
            });
            if (assignedCount) {
                assigned.append(el('summary', {}, 'Pedidos atribuídos (' + assignedCount + ')'), assignedList);
                list.append(assigned);
            }
            box.append(list, button('Dispensar prévia', { 'data-dismiss-preview': '' }));
            disposeMaps(container);
            container.replaceChildren(box);
        }

        function formFor(route) {
            const saved = route.sheet || {};
            const unsaved = sheets.get(route.id) || {};
            const fields = el('div', { class: 'ppwoo-route-sheet' },
                el('h4', {}, 'Ficha da rota'),
                el('label', { class: 'ppwoo-route-private-recipient' }, 'Link de rastreio', el('input', {
                    type: 'text', inputmode: 'url', maxlength: 2048, class: 'tracking-link', 'data-sheet-field': 'link',
                    value: unsaved.link ?? saved.link ?? ''
                })),
                el('label', { class: 'ppwoo-route-private-recipient' }, 'WhatsApp do motoboy', el('a', {
                    'data-driver-preview': '', href: driverPreview(unsaved.phone ?? saved.phone),
                    hidden: driverPreview(unsaved.phone ?? saved.phone) ? null : '', target: '_blank', rel: 'noopener noreferrer'
                }, 'Conversar com o motoboy ↗'), el('input', {
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
            fields.append(el('p', { class: 'ppwoo-sheet-status', 'data-sheet-status': route.id, role: 'status' },
                sheets.has(route.id) ? (saveErrors.get(route.id) || 'Alterações aguardando salvamento…') : 'Rascunho salvo'),
                button('Tentar salvar novamente', { 'data-save-sheet': route.id, hidden: saveErrors.has(route.id) ? null : '' }));
            const control = swipe('Deslize para concluir envio', { 'data-dispatch-route': route.id });
            fields.append(el('p', { class: 'ppwoo-routes-warning', 'data-dispatch-reason': route.id, role: 'status' }));
            fields.append(control);
            return fields;
        }

        function dispatchReason(route, sheet) {
            const calc = route.calculation;
            if (!calc || (calc.expires_at && calc.expires_at * 1000 <= Date.now())) return 'Recalcule esta rota: a composição mudou ou o cálculo expirou.';
            if (calc.issues.length) return 'Confira as paradas com aviso e recalcule esta rota.';
            if (calc.stops.length !== route.stops.length) return 'Recalcule esta rota para incluir todos os pedidos.';
            if (!/^https?:\/\//i.test(sheet.link || '')) return 'Preencha um link de rastreio válido.';
            if (!/^\d{10,11}$/.test((sheet.phone || '').replace(/\D/g, ''))) return 'Preencha o WhatsApp do motoboy com DDD.';
            if (!/^\d{1,10}$/.test(sheet.code || '') || Number(sheet.code) < 1) return 'Preencha o código de finalização da última parada.';
            if (route.stops.some(order => !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(String(sheet.costs?.[order.id] ?? order.cost ?? '').trim()))) {
                return 'Preencha o custo negociado de cada pedido.';
            }
            return '';
        }

        function updateReadiness() {
            dashboard.routes.filter(route => route.state === 'draft').forEach(route => {
                const sheet = sheets.get(route.id) || { ...route.sheet, costs: Object.fromEntries(route.stops.map(order => [order.id, order.cost])) };
                const reason = dispatchReason(route, sheet);
                $panel.find('[data-dispatch-reason="' + route.id + '"]').text(reason);
                $panel.find('[data-dispatch-route="' + route.id + '"]').prop('disabled', !!reason || busy);
                const calculated = !!route.calculation && !route.calculation.issues?.length &&
                    route.calculation.stops.length === route.stops.length &&
                    (!route.calculation.expires_at || route.calculation.expires_at * 1000 > Date.now());
                $panel.find('[data-recalculate-route="' + route.id + '"]').toggleClass('is-calculated', calculated);
                $panel.find('[data-calc-status="' + route.id + '"]').text(calculated ? 'Cálculo atualizado' : 'Cálculo pendente');
                $panel.find('[data-route-destination="' + route.id + '"]').each((_, node) => {
                    const next = destinationInfo(route);
                    if (node.textContent !== next.textContent) node.replaceWith(next);
                });
            });
        }

        function renderDrafts() {
            const container = $panel.find('[data-routes-drafts]')[0];
            const previous = new Map(Array.from(container.children, node => [node.dataset.routeId, node]));
            const fragment = document.createDocumentFragment();
            const drafts = dashboard.routes.filter(route => route.state === 'draft');
            if (!drafts.length) fragment.append(el('p', {}, 'Nenhuma rota em preparação.'));
            drafts.forEach(route => {
                const key = 'draft-' + route.id;
                const box = el('details', { class: 'ppwoo-route-card', 'data-group-key': key, 'data-route-id': route.id, style: routeStyle(route.slot) });
                box.open = openGroups.has(key);
                const body = el('div', { class: 'ppwoo-group-body' },
                    mapPanel(route.calculation, previous.get(String(route.id))?.querySelector('.ppwoo-route-map-wrap')));
                const issueById = new Map((route.calculation?.issues || []).map(issue => [issue.order_id, issue.code]));
                const calculationByOrder = new Map((route.calculation?.stops || []).map(stop => [stop.order_id, stop]));
                const stops = el('details', { class: 'ppwoo-route-stops', 'data-group-key': key + '-stops' },
                    el('summary', {}, 'Paradas e pedidos (' + route.stops.length + ')'));
                stops.open = openGroups.has(key + '-stops');
                route.stops.forEach(order => {
                    order.is_last = route.calculation?.destination_order_id === order.id;
                    const estimate = calculationByOrder.get(order.id);
                    const distance = Number.isFinite(estimate?.distance_meters)
                        ? ' · ' + (estimate.distance_meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km' : '';
                    stops.append(el('div', { class: 'ppwoo-route-row' }, orderInfo(order, order.position, key, { slot: route.slot, total: route.stops.length }),
                        estimate ? el('small', { class: 'ppwoo-route-estimate' }, 'Estimativa após a saída: ' + duration(estimate.eta_seconds) + distance) : null,
                        issueById.has(order.id) ? el('p', { class: 'ppwoo-routes-warning' }, issueMessage(issueById.get(order.id))) : null,
                        el('div', { class: 'ppwoo-routes-toolbar' }, groupSelect(order, route),
                            button('Desmarcar', { 'data-remove-from-route': order.id, 'data-source-route': route.id,
                                title: 'Tirar desta rota e voltar para Sem rota' }))));
                });
                body.append(...(route.stops.length === 1 ? Array.from(stops.children).slice(1) : [stops]), formFor(route));
                const calculate = swipe(route.calculation ? 'Deslize: recalcular' : 'Deslize: calcular', {
                    'data-recalculate-route': route.id,
                    class: 'slide-button ppwoo-swipe-action ppwoo-route-slide ppwoo-route-calc-slide',
                    'aria-label': (route.calculation ? 'Recalcular' : 'Calcular') + ' rota ' + route.slot + ': deslize até o fim'
                });
                box.append(el('summary', { class: 'ppwoo-route-heading' },
                    el('span', { class: 'ppwoo-route-heading-title' }, 'Rota ' + route.slot + ' · ' + route.stops.length + ' pedidos',
                        el('small', { 'data-calc-status': route.id }, route.calculation ? 'Cálculo atualizado' : 'Cálculo pendente'),
                        destinationInfo(route)), calculate), body);
                fragment.append(box);
            });
            disposeMaps(container);
            container.replaceChildren(fragment);
            updateReadiness();
        }

        const eventLabels = {
            queued: 'Aguardando envio', sending: 'Enviando evento…', accepted: '✓ Evento enviado com sucesso',
            failed: 'Falha de envio', uncertain: 'Envio sem confirmação', waiting: 'Aguardando'
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
            const box = el('details', { class: 'ppwoo-route-card', 'data-group-key': key, 'data-route-id': route.id, style: routeStyle(route.slot) });
            box.open = openGroups.has(key);
            box.append(el('summary', {}, 'Rota ' + route.slot + ' · Saída #' + route.id +
                (isHistory ? ' · Encerrada' : ' · ' + pendingLabel(open.length)), destinationInfo(route)));
            const body = el('div', { class: 'ppwoo-group-body' },
                mapPanel(route.calculation, $panel.find('[data-routes-active] [data-route-id="' + route.id + '"] .ppwoo-route-map-wrap')[0]), tripInfo(route));
            if (route.stops.some(order => ['queued', 'sending'].includes(order.event_state))) body.append(
                el('progress', { value: received, max: route.stops.length, 'aria-label': 'Envio dos eventos em andamento' }),
                el('p', {}, 'Enviando eventos · ' + received + ' de ' + route.stops.length));
            body.append(el('p', { class: 'ppwoo-route-pending', role: 'status' }, pendingLabel(open.length)));
            if (route.departed_at) body.append(el('p', { class: 'ppwoo-route-departure' }, 'Saída: ' + new Date(route.departed_at).toLocaleString('pt-BR')));
            if (open.length) body.append(el('label', { class: 'ppwoo-route-select-all' },
                check(false, { 'data-select-delivery-all': route.id, 'aria-label': 'Selecionar todas as entregas pendentes para finalizar' }), ' Selecionar todos'));
            route.stops.forEach(order => {
                const canRetry = order.event_state === 'failed' || (order.event_state === 'uncertain' && dashboard.retry_uncertain);
                order.is_last = route.calculation?.destination_order_id === order.id;
                body.append(el('div', { class: 'ppwoo-route-row' },
                    order.delivery_state === 'on_route'
                        ? el('label', {}, check(selection.has(order.id), { 'data-close-order': order.id }), ' Incluir na baixa') : null,
                    orderInfo(order, order.position, key, { slot: route.slot, total: route.stops.length, pending: open.length }),
                    el('small', { class: 'ppwoo-route-event-status' + (order.event_state === 'accepted' ? ' is-success' : '') },
                        (order.delivery_state === 'closed' ? 'Entrega finalizada · ' : '') + (eventLabels[order.event_state] || 'Aguardando')),
                    order.code && order.event_state !== 'accepted' ? el('small', {}, resultLabels[order.code] || '') : null,
                    order.event_state === 'uncertain' && !canRetry
                        ? el('small', {}, 'Confira se o n8n recebeu o evento para evitar enviar o pedido duas vezes.') : null,
                    canRetry ? button('Reenviar este pedido', { 'data-retry-order': order.id, 'data-route-id': route.id }) : null));
            });
            if (route.stops.some(order => order.event_state === 'queued')) {
                body.append(button('Retomar pedidos na fila', { 'data-resume-route': route.id }));
            }
            if (open.length) body.append(swipe('Deslize para finalizar selecionados', { 'data-close-route': route.id }));
            box.append(body);
            return box;
        }

        function renderActive() {
            const parent = $panel.find('[data-routes-active]')[0];
            const active = dashboard.routes.filter(route => route.state === 'dispatched');
            const nodes = active.length ? active.map(route => deliveryGroup(route, false)) : [el('p', {}, 'Nenhum pedido em rota.')];
            disposeMaps(parent);
            parent.replaceChildren(...nodes);
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
                    debug('disparo', (eventLabels[stop.event_state] || 'Aguardando') +
                        (stop.attempt ? ' · tentativa ' + stop.attempt : '') +
                        (/^http_\d+$/.test(stop.code || '') ? ' · ' + stop.code : ''), { route_id: route.id, order_id: stop.id });
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
            if (document.hidden || pollRequest || busy || saveRequest || $panel.find('.ppwoo-route-slide.is-dragging').length) return;
            const tab = activeTab().attr('id');
            if (!full && tab !== 'tab-em-rota') return;
            if (full && Date.now() - lastReload < 5000) { feedback('Painel atualizado há poucos segundos.'); return; }
            if (full) { feedback('Atualizando painel…'); $panel.find('[data-reload-routes]').prop('disabled', true); }
            pollRequest = api('list', {}).then(data => {
                if (!busy && !$panel.find('.ppwoo-route-slide.is-dragging').length) update(data, full);
                if (full) { lastReload = Date.now(); feedback('Painel atualizado.'); }
            }).catch(error => feedback(error.message, true));
            try { await pollRequest; }
            finally { pollRequest = null; $panel.find('[data-reload-routes]').prop('disabled', false); }
        }

        function loadMaps() {
            if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
            if (!mapsLibrary) {
                mapsLibrary = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    const callback = 'ppwooRoutesMapsReady';
                    const fail = () => {
                        reject(new Error('O mapa não carregou. Confira a configuração do Google Maps.'));
                        $panel.find('.ppwoo-route-map').each(function () {
                            if (!this.routeMap) return;
                            (this.routeOverlays || []).forEach(overlay => overlay.setMap(null));
                            delete this.routeMap;
                            const focus = this.closest('.ppwoo-route-map-stage')?.querySelector('[data-focus-origin]');
                            if (focus) focus.disabled = true;
                            drawRouteDiagram(this, this.routeCalculation);
                            if (!this.parentNode.querySelector('.ppwoo-map-notice')) this.after(el('p', { class: 'ppwoo-map-notice' },
                                'O Google recusou a chave do mapa. Confira as restrições e o faturamento em PackPanel → Rotas.'));
                        });
                    };
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
            marker.onAdd = function () { this.getPanes().markerLayer.appendChild(node); };
            marker.draw = function () {
                const pixel = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lng));
                if (pixel) Object.assign(node.style, { left: pixel.x + 'px', top: pixel.y + 'px' });
            };
            marker.onRemove = function () { node.remove(); };
            marker.setMap(map);
            return marker;
        }

        function disposeMaps(container) {
            if (expandedMap && container.contains(expandedMap.placeholder)) closeExpandedMap();
            container.querySelectorAll('.ppwoo-route-map').forEach(node => {
                (node.routeOverlays || []).forEach(overlay => overlay.setMap(null));
                if (node.routeMap) window.google?.maps?.event?.clearInstanceListeners(node.routeMap);
            });
        }

        function resizeMap(stage) {
            const node = stage.querySelector('.ppwoo-route-map');
            const map = node?.routeMap;
            if (map) {
                const center = map.getCenter();
                window.requestAnimationFrame(() => {
                    window.google?.maps?.event?.trigger?.(map, 'resize');
                    if (center) map.setCenter(center);
                });
            } else if (node?.routeCalculation) {
                node.parentNode.querySelectorAll('.ppwoo-route-diagram-caption').forEach(caption => caption.remove());
                drawRouteDiagram(node, node.routeCalculation);
            }
        }

        function closeExpandedMap() {
            if (!expandedMap) return;
            const { dialog, stage, placeholder, control, overflow } = expandedMap;
            expandedMap = null;
            placeholder.replaceWith(stage);
            if (dialog.open && typeof dialog.close === 'function') dialog.close();
            dialog.remove();
            document.body.style.overflow = overflow;
            control.textContent = 'Expandir';
            control.setAttribute('aria-expanded', 'false');
            control.setAttribute('aria-label', 'Expandir mapa');
            resizeMap(stage);
            control.focus({ preventScroll: true });
        }

        function expandMap(control) {
            if (expandedMap) { closeExpandedMap(); return; }
            const stage = control.closest('.ppwoo-route-map-stage');
            const placeholder = el('span', { hidden: '' });
            const dialog = el('dialog', { class: 'ppwoo-map-dialog', 'aria-label': 'Mapa ampliado da rota', 'aria-modal': 'true' });
            stage.before(placeholder);
            dialog.append(stage);
            $panel[0].append(dialog);
            expandedMap = { dialog, stage, placeholder, control, overflow: document.body.style.overflow };
            document.body.style.overflow = 'hidden';
            control.textContent = 'Recolher';
            control.setAttribute('aria-expanded', 'true');
            control.setAttribute('aria-label', 'Recolher mapa');
            dialog.addEventListener('cancel', event => { event.preventDefault(); closeExpandedMap(); });
            dialog.addEventListener('close', () => { if (expandedMap?.dialog === dialog) closeExpandedMap(); });
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
            control.focus({ preventScroll: true });
            resizeMap(stage);
        }

        function drawRouteDiagram(node, calc) {
            const canvas = el('canvas', { role: 'img', 'aria-label': 'Trajeto com origem e paradas numeradas' });
            const context = canvas.getContext('2d');
            if (!context) {
                node.textContent = 'Consulte as paradas na lista da rota.';
                return;
            }

            const width = node.clientWidth || 320;
            const height = node.clientHeight || 200;
            const density = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * density);
            canvas.height = Math.round(height * density);
            context.scale(density, density);

            const points = [calc.origin, ...calc.stops.map(stop => stop.location), ...calc.path];
            const latitudes = points.map(point => point.lat);
            const longitudes = points.map(point => point.lng);
            const minLat = Math.min(...latitudes);
            const maxLat = Math.max(...latitudes);
            const minLng = Math.min(...longitudes);
            const maxLng = Math.max(...longitudes);
            const lngScale = Math.max(.01, Math.cos(calc.origin.lat * Math.PI / 180));
            const scale = Math.min(Math.max(1, width - 48) / Math.max(.00001, (maxLng - minLng) * lngScale),
                Math.max(1, height - 48) / Math.max(.00001, maxLat - minLat));
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;
            const position = point => [width / 2 + (point.lng - centerLng) * scale * lngScale,
                height / 2 - (point.lat - centerLat) * scale];

            context.beginPath();
            context.moveTo(...position(calc.path[0]));
            calc.path.slice(1).forEach(point => context.lineTo(...position(point)));
            context.strokeStyle = '#1658b8';
            context.lineWidth = 3;
            context.lineJoin = 'round';
            context.stroke();

            context.font = 'bold 12px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            [calc.origin, ...calc.stops.map(stop => stop.location)].forEach((point, index) => {
                const [x, y] = position(point);
                context.beginPath();
                context.arc(x, y, 12, 0, Math.PI * 2);
                context.fillStyle = index ? '#124eaa' : '#17624e';
                context.fill();
                context.fillStyle = '#fff';
                context.fillText(index ? String(index) : 'O', x, y);
            });
            node.replaceChildren(canvas);
            node.after(el('p', { class: 'ppwoo-route-diagram-caption' }, 'Esquema do trajeto · ',
                el('span', { translate: 'no' }, 'Google Maps')));
        }

        function drawVisibleMaps() {
            window.requestAnimationFrame(() => {
                $panel.find('.ppwoo-route-map:visible').each(function () {
                    if (this.dataset.drawn || !this.routeCalculation) return;
                    const node = this;
                    node.dataset.drawn = '1';
                    const calc = node.routeCalculation;
                    if (!config.maps_key && !window.google?.maps?.Map) {
                        drawRouteDiagram(node, calc);
                        node.after(el('p', { class: 'ppwoo-map-notice' }, 'Para ver ruas e zoom, configure a chave Google Maps em PackPanel → Rotas.'));
                        return;
                    }
                    loadMaps().then(maps => {
                        if (!node.isConnected || !$(node).is(':visible')) {
                            delete node.dataset.drawn;
                            return;
                        }
                        const map = new maps.Map(node, {
                            center: calc.origin, zoom: 12, clickableIcons: false, gestureHandling: 'cooperative',
                            mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true
                        });
                        node.routeMap = map;
                        node.closest('.ppwoo-route-map-stage').querySelector('[data-focus-origin]').disabled = false;
                        const bounds = new maps.LatLngBounds();
                        calc.path.forEach(point => bounds.extend(point));
                        node.routeOverlays = [
                            marker(maps, map, calc.origin, 'O', true),
                            ...calc.stops.map((stop, index) => marker(maps, map, stop.location, String(index + 1), false)),
                            new maps.Polyline({ map, path: calc.path, strokeColor: '#1658b8', strokeOpacity: 0.9, strokeWeight: 4 })
                        ];
                        map.fitBounds(bounds, 28);
                    }).catch(() => {
                        if (node.isConnected && $(node).is(':visible')) {
                            drawRouteDiagram(node, calc);
                            node.after(el('p', { class: 'ppwoo-map-notice' }, 'Google Maps não carregou. Confira a chave, domínio autorizado e faturamento em PackPanel → Rotas. O esquema abaixo não mostra ruas.'));
                            debug('mapa', 'falha de carregamento');
                        }
                        else delete node.dataset.drawn;
                    });
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
            if (!sheets.has(id)) editRevisions.set(id, currentRoute(id)?.revision);
            sheets.set(id, sheet);
            saveErrors.delete(id);
            return sheet;
        }

        function saveStatus(id, message, failed = false) {
            $panel.find('[data-sheet-status="' + id + '"]').text(message).toggleClass('is-error', failed);
            $panel.find('[data-save-sheet="' + id + '"]').prop('hidden', !failed);
        }

        function flushAutosaves(force = false) {
            if (saveRequest) return saveRequest.then(ok => ok && force && sheets.size ? flushAutosaves(force) : ok);
            if (busy && !force) { scheduleSave(); return Promise.resolve(false); }
            const pending = Array.from(sheets.entries()).find(([id]) => currentRoute(id)?.state === 'draft' && !saveErrors.has(id));
            if (!pending) return Promise.resolve(!Array.from(sheets.keys()).some(id => currentRoute(id)?.state === 'draft' && saveErrors.has(id)));
            const [id, snapshot] = pending;
            saveStatus(id, 'Salvando…');
            saveRequest = (async () => {
                try {
                    if (pollRequest) await pollRequest;
                    const route = currentRoute(id);
                    if (!route || route.state !== 'draft') return true;
                    const data = await api('save', { route_id: id, revision: editRevisions.get(id) ?? route.revision, sheet: snapshot });
                    const saved = data.routes.find(item => item.id === id);
                    if (!saved || saved.state !== 'draft') throw new Error('A rota mudou. Atualize o painel para conferir.');
                    // Não renderizar o formulário enquanto o operador digita.
                    dashboard.routes = dashboard.routes.map(item => item.id === id ? saved : item);
                    editRevisions.set(id, saved.revision);
                    if (JSON.stringify(sheets.get(id)) === JSON.stringify(snapshot)) {
                        sheets.delete(id);
                        saveStatus(id, 'Rascunho salvo');
                    } else saveStatus(id, 'Alterações aguardando salvamento…');
                    updateReadiness();
                    return true;
                } catch (error) {
                    if (error.status === 409) saveConflicts.add(id);
                    saveErrors.set(id, 'Não foi possível salvar: ' + error.message);
                    saveStatus(id, saveErrors.get(id), true);
                    return false;
                } finally { saveRequest = null; }
            })();
            return saveRequest.then(ok => {
                if (ok && sheets.size) return flushAutosaves(force);
                return ok;
            });
        }

        function scheduleSave() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => { if (!document.hidden) flushAutosaves(); }, 1000);
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
        $panel.on('click', '[data-remove-from-route]', function () {
            const source = currentRoute(this.dataset.sourceRoute);
            const id = Number(this.dataset.removeFromRoute);
            if (!source || busy) return;
            act('group', {
                order_id: id, slot: 0, source_id: source.id, source_revision: source.revision,
                target_id: 0, preview: preview?.calculation.token || ''
            }, {
                refreshMotoboy: true, message: 'Pedido voltou para Sem rota. Recalcule o grupo alterado.',
                after: () => {
                    preview?.removed.delete(id);
                    openGroups.delete('draft-' + source.id + '-order-' + id);
                }
            });
        });
        $panel.on('change', '[data-group-order]', function () {
            const orderId = Number(this.dataset.groupOrder);
            const source = currentRoute(this.dataset.source);
            const slot = Number(this.value);
            const target = dashboard.routes.find(route => route.state === 'draft' && route.slot === slot);
            this.value = String(source?.slot || 0);
            act('group', {
                order_id: orderId, slot, preview: this.dataset.previewToken || '', source_id: source?.id || 0,
                source_revision: source?.revision, target_id: target?.id || 0, target_revision: target?.revision
            }, { refreshMotoboy: true, message: 'Grupo atualizado.', after: data => {
                const group = data.routes.find(route => route.state === 'draft' && route.stops.some(order => order.id === orderId));
                if (group) {
                    openGroups.delete('preview-order-' + orderId);
                    openGroups.delete('preview-assigned');
                }
            } });
        });
        $panel.on('click', '[data-recalculate-route]', event => {
            event.preventDefault();
            event.stopPropagation();
        });
        $panel.on('ppwoo:slide-complete', '[data-recalculate-route]', function () {
            const route = currentRoute(this.dataset.recalculateRoute);
            if (!route || busy) { resetSwipe(this); return; }
            act('recalculate', { route_id: route.id, revision: route.revision, preview: preview?.calculation.token }, {
                loading: 'Calculando o grupo…', message: 'Cálculo atualizado. Abra a rota para conferir as paradas.', slider: this
            });
        });
        $panel.on('input', '[data-sheet-field], [data-sheet-cost]', function () {
            const card = this.closest('[data-route-id]');
            if (card) {
                if (this.dataset.sheetField === 'phone') {
                    const link = card.querySelector('[data-driver-preview]');
                    if (link) { const href = driverPreview(this.value); link.hidden = !href; link.href = href; }
                }
                const id = Number(card.dataset.routeId);
                sheetInput(id, card);
                saveStatus(id, 'Alterações aguardando salvamento…');
                updateReadiness();
                scheduleSave();
            }
        });
        $panel.on('click', '[data-share-trip], [data-copy-trip]', function () {
            const route = currentRoute(Number(this.dataset.shareTrip || this.dataset.copyTrip));
            if (route) chooseTripRecipient(route, this.hasAttribute('data-copy-trip'));
        });
        $panel.on('click', '[data-save-sheet]', async function () {
            const id = Number(this.dataset.saveSheet);
            if (busy || saveRequest) return;
            if (saveConflicts.has(id)) {
                if (!window.confirm('A rota mudou em outra sessão. Deseja tentar salvar os dados que você está vendo sobre o rascunho atual?')) return;
                try {
                    const data = await api('list', {});
                    const route = data.routes.find(item => item.id === id && item.state === 'draft');
                    if (!route) throw new Error('A rota não está mais em preparação. Confira o painel.');
                    dashboard.routes = dashboard.routes.map(item => item.id === id ? route : item);
                    editRevisions.set(id, route.revision);
                    saveConflicts.delete(id);
                } catch (error) { saveStatus(id, error.message, true); return; }
            }
            saveErrors.delete(id);
            flushAutosaves();
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
        $panel.on('click', '[data-focus-origin]', function () {
            const node = this.closest('.ppwoo-route-map-stage').querySelector('.ppwoo-route-map');
            if (!node.routeMap) return;
            node.routeMap.panTo(node.routeCalculation.origin);
            node.routeMap.setZoom(16);
        });
        $panel.on('click', '[data-expand-map]', function () { expandMap(this); });
        $panel.on('keydown', '.ppwoo-map-dialog', function (event) {
            if (event.key === 'Escape') { event.preventDefault(); closeExpandedMap(); }
            if (event.key !== 'Tab') return;
            const controls = Array.from(this.querySelectorAll('button:not(:disabled), [tabindex="0"], a[href]'))
                .filter(node => $(node).is(':visible'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
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

        $panel.find('#tab-rotas, #tab-em-rota').each(function () { this.prepend(privateControls()); });
        $panel.find('[data-calculate-selected]').addClass('ppwoo-routes-button ppwoo-routes-primary');
        window.addEventListener('beforeunload', event => {
            if (!sheets.size && !saveRequest) return;
            event.preventDefault();
            event.returnValue = '';
        });
        document.addEventListener('visibilitychange', () => { if (!document.hidden && sheets.size) scheduleSave(); });
        updateSelection();
        poll(true);
        setInterval(() => { poll(false); updateReadiness(); }, 6000);
    });
})(jQuery, window.PPWOO_ROUTES, window.PPWOO);
