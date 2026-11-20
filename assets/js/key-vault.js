(() => {
    'use strict';
    const root = document.querySelector('.ctwpml-vault');
    if (!root) return;
    const draft = root.querySelector('#ctwpml-new-key'), timers = new WeakMap();
    const globalStatus = root.querySelector('.ctv-global-status');
    function status(node, text, error = false) { node.textContent = text; node.classList.toggle('is-error', error); }
    function conceal(row) {
        clearTimeout(timers.get(row));
        const input = row.querySelector('input'); input.type = 'password'; input.value = '';
        const button = row.querySelector('[data-key-action="show"]');
        button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', 'Mostrar chave ' + row.dataset.name);
        button.querySelector('[data-toggle-label]').textContent = 'Mostrar';
    }
    function reveal(row, value) {
        if (document.hidden || !row.isConnected) return;
        const input = row.querySelector('input'); input.value = value; input.type = 'text';
        const button = row.querySelector('[data-key-action="show"]');
        button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-label', 'Ocultar chave ' + row.dataset.name);
        button.querySelector('[data-toggle-label]').textContent = 'Ocultar';
        clearTimeout(timers.get(row)); timers.set(row, setTimeout(() => conceal(row), 60000));
    }
    async function request(operation, name) {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const body = new URLSearchParams({ action: 'ctwpml_vault', operation, name, nonce: root.dataset.nonce });
            if (operation === 'delete') body.set('confirmed', '1');
            const response = await fetch(root.dataset.endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, body });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.data?.message || 'Não foi possível concluir. Atualize a página e tente novamente.');
            return result.data;
        } finally { clearTimeout(timeout); }
    }
    async function copy(value) {
        if (navigator.clipboard?.writeText) {
            try { await navigator.clipboard.writeText(value); return; } catch (_) { /* alternativa para navegadores sem permissão */ }
        }
        const text = document.createElement('textarea'); text.value = value; text.className = 'ctv-copy-fallback';
        root.append(text); let copied = false;
        try { text.focus(); text.select(); copied = document.execCommand('copy'); } catch (_) { /* oferecer seleção manual */ }
        finally { text.value = ''; text.remove(); }
        if (!copied) throw new Error('Cópia automática indisponível. Selecione o valor exibido e use Copiar no navegador.');
    }
    root.addEventListener('click', async event => {
        const button = event.target.closest('[data-key-action]');
        if (!button || button.disabled) return;
        const row = button.closest('.ctv-key'), operation = button.dataset.keyAction, message = row.querySelector('.ctv-row-status');
        if (row.dataset.busy === '1') return;
        if (operation === 'show' && row.querySelector('input').type === 'text') { conceal(row); status(message, 'Valor oculto.'); return; }
        if (operation === 'delete' && !window.confirm('Remover a chave “' + row.dataset.name + '” deste site? A cópia do gerenciador anterior com esse mesmo nome também será removida, se existir. As integrações que usam esta chave podem parar.')) return;
        row.dataset.busy = '1'; row.querySelectorAll('button').forEach(button => { button.disabled = true; });
        status(message, operation === 'name' ? 'Copiando nome…' : operation === 'delete' ? 'Removendo…' : 'Consultando chave…');
        try {
            if (operation === 'name') { await copy(row.dataset.name); status(message, 'Nome copiado.'); }
            else if (operation === 'delete') {
                await request('delete', row.dataset.name); conceal(row); row.remove();
                const count = root.querySelectorAll('.ctv-key').length; root.querySelector('[data-count]').textContent = count;
                root.querySelector('.ctv-empty').hidden = count > 0; status(globalStatus, 'Chave removida deste site.');
            } else {
                const data = await request('read', row.dataset.name);
                if (typeof data.value !== 'string' || !data.value) throw new Error('Valor indisponível.');
                if (document.hidden) { status(message, 'Clique novamente ao voltar à página.'); return; }
                if (operation === 'show') { reveal(row, data.value); status(message, 'O valor será ocultado automaticamente em um minuto.'); }
                else {
                    try { await copy(data.value); status(message, 'Chave copiada. Cole o mesmo valor no outro site.'); }
                    catch (error) { reveal(row, data.value); row.querySelector('input').select(); throw error; }
                }
            }
        } catch (error) { status(message, error.name === 'AbortError' ? 'A consulta demorou. Tente novamente.' : error.message, true); }
        finally { row.dataset.busy = '0'; row.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
    });
    root.querySelector('#ctwpml-generate-key').addEventListener('click', () => {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        draft.value = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        status(globalStatus, 'Chave gerada. Salve para cadastrá-la neste site.');
    });
    root.querySelector('[data-new-toggle]').addEventListener('click', event => {
        const button = event.currentTarget, show = draft.type === 'password'; draft.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(show)); button.setAttribute('aria-label', (show ? 'Ocultar' : 'Mostrar') + ' valor da nova chave');
        button.querySelector('span:last-child').textContent = show ? 'Ocultar' : 'Mostrar';
    });
    root.querySelector('[data-new-copy]').addEventListener('click', async () => {
        if (!draft.value) { status(globalStatus, 'Preencha ou gere uma chave antes de copiar.', true); return; }
        try { await copy(draft.value); status(globalStatus, 'Valor copiado. Você ainda precisa salvar esta chave.'); }
        catch (error) { draft.type = 'text'; draft.select(); status(globalStatus, error.message, true); }
    });
    function hideAll() { root.querySelectorAll('.ctv-key').forEach(conceal); draft.type = 'password';
        const button = root.querySelector('[data-new-toggle]'); button.setAttribute('aria-pressed', 'false'); button.querySelector('span:last-child').textContent = 'Mostrar';
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) hideAll(); });
    window.addEventListener('pagehide', hideAll);
})();
