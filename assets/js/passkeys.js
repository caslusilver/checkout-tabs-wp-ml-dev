(() => {
    'use strict';
    const config = window.ctwpmlPasskeyConfig;
    if (!config) return;
    let busy = false, skipEntry = false, continueCheckout = null, previousFocus = null;
    const entry = () => document.getElementById('ctwpml-passkey-entry');
    const supported = () => window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;
    const showMessage = (card, text) => { const message = card?.querySelector('.ctwpml-passkey-message'); if (message) message.textContent = text; };
    async function post(action, values = {}) {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const body = new URLSearchParams({ action });
            Object.entries(values).forEach(([key, value]) => {
                if (value && typeof value === 'object') Object.entries(value).forEach(([sub, text]) => body.set(key + '[' + sub + ']', text ?? ''));
                else body.set(key, value ?? '');
            });
            const response = await fetch(config.ajax, { method: 'POST', credentials: 'same-origin', cache: 'no-store', body, signal: controller.signal });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error('request_failed');
            return result.data;
        } finally { clearTimeout(timeout); }
    }
    const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const encode = value => {
        let text = '';
        for (const byte of new Uint8Array(value)) text += String.fromCharCode(byte);
        return btoa(text);
    };
    function optionsForBrowser(options, create) {
        const result = { ...options, challenge: decode(options.challenge) };
        if (create) result.user = { ...options.user, id: decode(options.user.id) };
        const list = create ? 'excludeCredentials' : 'allowCredentials';
        if (options[list]) result[list] = options[list].map(item => ({ ...item, id: decode(item.id) }));
        return result;
    }
    function returnToPage() {
        const url = new URL(window.location.href);
        url.searchParams.set('ctwpml_session_refresh', String(Date.now()));
        // Nova navegação reconhece o cookie do motor e recebe nonces e endereços da sessão correta.
        window.location.assign(url.href);
    }
    function closeEntry() {
        if (busy) return;
        if (entry()) entry().hidden = true;
        skipEntry = true;
        previousFocus?.focus();
        const next = continueCheckout;
        continueCheckout = null;
        if (next) next();
    }
    window.CTWPMLPasskeys = {
        offer(next) {
            if (!config.checkout || config.loggedIn || skipEntry || !entry() || !supported()) return false;
            continueCheckout = next;
            previousFocus = document.activeElement;
            entry().hidden = false;
            entry().querySelector('[data-ctwpml-passkey-login]').focus();
            return true;
        }
    };
    async function authenticate(button, create) {
        if (busy) return;
        const card = button.closest('.ctwpml-passkey-card') || button.parentElement;
        if (!supported()) { showMessage(card, 'Este navegador não oferece acesso rápido. Entre de outra forma.'); return; }
        busy = true;
        const buttons = Array.from(document.querySelectorAll('[data-ctwpml-passkey-login], [data-ctwpml-passkey-register], [data-ctwpml-passkey-skip], [data-ctwpml-passkey-dismiss]'));
        buttons.forEach(element => { element.disabled = true; });
        showMessage(card, 'Confirme no seu aparelho…');
        try {
            const context = await post('ctwpml_passkey_context');
            if (!create && context.loggedIn) { returnToPage(); return; }
            if (create && (!context.loggedIn || !context.canRegister)) throw new Error('session_changed');
            const options = await post(create ? 'secure_passkeys_frontend_get_register_options' : 'secure_passkeys_frontend_get_login_options', { nonce: context.nonce });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Math.min(120000, Math.max(10000, Number(options.timeout) || 60000)));
            let credential;
            try { credential = await navigator.credentials[create ? 'create' : 'get']({ publicKey: optionsForBrowser(options, create), signal: controller.signal }); }
            finally { clearTimeout(timeout); }
            if (!credential) throw new Error('cancelled');
            const response = { clientDataJSON: encode(credential.response.clientDataJSON) };
            if (create) response.attestationObject = encode(credential.response.attestationObject);
            else {
                response.authenticatorData = encode(credential.response.authenticatorData);
                response.signature = encode(credential.response.signature);
                response.userHandle = credential.response.userHandle ? encode(credential.response.userHandle) : '';
            }
            await post(create ? 'secure_passkeys_frontend_register_passkey' : 'secure_passkeys_frontend_login', {
                nonce: context.nonce, challenge: options.challenge, id: credential.id, rawId: encode(credential.rawId), type: credential.type, response,
                ...(create ? { security_key_name: 'Acesso rapido' } :
                    { ctwpml_context: config.checkout && button.closest('#ctwpml-view-auth') ? 'checkout-late' : 'entry' })
            });
            showMessage(card, create ? 'Acesso ativado. Na próxima compra, use seus dados salvos.' : 'Acesso confirmado. Carregando seus dados…');
            if (create) { button.hidden = true; card.querySelector('[data-ctwpml-passkey-dismiss]')?.remove(); }
            else returnToPage();
        } catch (error) {
            const cancelled = ['NotAllowedError', 'AbortError'].includes(error.name) || error.message === 'cancelled';
            showMessage(card, cancelled ? 'Acesso cancelado ou chave indisponível. Você pode tentar novamente ou continuar de outra forma.' :
                create ? 'Não foi possível salvar o acesso. Sua compra pode continuar normalmente.' : 'Não foi possível entrar. Tente novamente ou entre de outra forma.');
        } finally { busy = false; buttons.forEach(element => { element.disabled = false; }); }
    }
    document.addEventListener('click', event => {
        const login = event.target.closest('[data-ctwpml-passkey-login]');
        const register = event.target.closest('[data-ctwpml-passkey-register]');
        if (login || register) { event.preventDefault(); authenticate(login || register, !!register); }
        const password = event.target.closest('[data-ctwpml-passkey-password]');
        if (password) {
            event.preventDefault();
            const popup = password.closest('.ctwpml-login-popup');
            popup.classList.remove('ctwpml-passkey-first');
            popup.querySelector('#ctwpml-login-email')?.focus();
        }
        if (event.target.closest('[data-ctwpml-passkey-skip]')) { event.preventDefault(); closeEntry(); }
        const dismiss = event.target.closest('[data-ctwpml-passkey-dismiss]');
        if (dismiss && !busy) {
            const invite = dismiss.closest('[data-ctwpml-passkey-invite]');
            invite.hidden = true;
            try { sessionStorage.setItem('ctwpml_passkey_invite_dismissed', '1'); } catch (_) { /* Sem storage, a compra continua. */ }
        }
    });
    document.addEventListener('keydown', event => {
        const dialog = entry();
        if (!dialog || dialog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); closeEntry(); }
        if (event.key === 'Tab') {
            const controls = Array.from(dialog.querySelectorAll('button:not(:disabled)'));
            if (!controls.length) { event.preventDefault(); return; }
            const index = controls.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && (index === controls.length - 1 || index < 0)) { event.preventDefault(); controls[0].focus(); }
        }
    });
    async function invite() {
        const card = document.querySelector('[data-ctwpml-passkey-invite]');
        if (!card || !supported()) return;
        try {
            if (sessionStorage.getItem('ctwpml_passkey_invite_dismissed') === '1') return;
        } catch (_) { /* Verificação de sessão no servidor continua obrigatória. */ }
        try {
            const context = await post('ctwpml_passkey_context');
            card.hidden = !context.loggedIn || !context.canRegister || context.hasPasskeys;
        } catch (_) { card.hidden = true; }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', invite);
    else invite();
})();
