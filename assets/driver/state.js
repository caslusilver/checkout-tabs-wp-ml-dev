(function (root) {
    'use strict';
    function apply(state, event, confirmed = []) {
        const next = JSON.parse(JSON.stringify(state));
        // PHP representa um mapa vazio como []; normalize antes de usar UUIDs como chaves.
        next.devices = { ...state.devices };
        const index = next.stops.findIndex(stop => stop.id === event.stop_id);
        if (index < 0 || next.status === 'completed' && event.type !== 'correct' || event.version !== next.version || event.seq !== (next.devices[event.device] || 0) + 1) throw new Error('A rota mudou. Confira as pendências.');
        if (event.type === 'correct') {
            if (index > next.current || next.stops[index].state === 'ready' || next.stops.slice(index).some(stop => confirmed.includes(stop.id))) throw new Error('Recebimento confirmado ou etapa indisponível para correção.');
            next.stops.forEach((stop, i) => { if (i >= index) stop.state = i === index ? 'started' : 'ready'; });
            next.current = index; next.status = 'started';
        } else {
            if (index !== next.current) throw new Error('Conclua a parada atual.');
            const phase = next.stops[index].state;
            if (event.type === 'start' && phase === 'ready' && index === 0) { next.stops[index].state = 'started'; next.status = 'started'; }
            else if (event.type === 'arrive' && phase === 'started') next.stops[index].state = 'arrived';
            else if (event.type === 'complete' && phase === 'arrived') {
                next.stops[index].state = 'delivered';
                if (index + 1 < next.stops.length) { next.current++; next.stops[next.current].state = 'started'; }
                else next.status = 'completed';
            } else throw new Error('Etapa inválida.');
        }
        next.version++; next.devices[event.device] = event.seq;
        return next;
    }
    function optimistic(snapshot, queue) {
        let state = snapshot.driver;
        const confirmed = (snapshot.stops || []).filter(stop => stop.confirmed).map(stop => stop.id);
        for (const event of queue) state = apply(state, event, confirmed);
        return state;
    }
    const api = { apply, optimistic };
    if (typeof module !== 'undefined') module.exports = api;
    else root.CTDriverState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
