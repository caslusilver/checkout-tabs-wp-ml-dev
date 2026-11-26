(() => {
    'use strict';
    const config = window.ctwpmlPasskeyConfig;
    if (!config) return;
    let busy = false, skipEntry = false, continueCheckout = null, previousFocus = null;
    let inviteFinished = false, inviteOpening = false, afterInvite = null;
    const traceStart = performance.now();
    function trace(event, outcome) {
        const state = window.CCCheckoutTabsState;
        const data = { event, outcome: outcome || 'ok', elapsedMs: Math.round(performance.now() - traceStart) };
        if (state?.checkpoint) state.checkpoint('CHK_PASSKEY_' + event, outcome !== 'error', data);
        if (window.cc_params?.debug) console.info('[CTWPML][PASSKEY]', data);
    }
    function remembered() { try { return localStorage.getItem('ctwpml_passkey_used') === '1'; } catch (_) { return false; } }
    function remember() { try { localStorage.setItem('ctwpml_passkey_used','1'); } catch (_) {} }
    const entry = () => document.getElementById('ctwpml-passkey-entry');
    const supported = () => window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;
    const showMessage = (card, text) => { const message = card?.querySelector('.ctwpml-passkey-message'); if (message) message.textContent = text; };
    async function post(action, values = {}) {
        trace('REQUEST_START', action);
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const body = new URLSearchParams({ action });
            Object.entries(values).forEach(([key, value]) => {
                if (value && typeof value === 'object') Object.entries(value).forEach(([sub, text]) => body.set(key + '[' + sub + ']', text ?? ''));
                else body.set(key, value ?? '');
            });
            const response = await fetch(config.ajax, { method: 'POST', credentials: 'same-origin', cache: 'no-store', body, signal: controller.signal });
            const result = await response.json();
            trace('REQUEST_RESULT', action + ':' + response.status + ':' + !!result.success);
            if (!response.ok || !result.success) { trace('HTTP_REJECTED', String(response.status)); throw new Error('request_failed'); }
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
        beforeCheckout(next) {
            if (!config.checkout || !config.loggedIn || inviteFinished || !document.querySelector('#ctwpml-passkey-enroll')) return false;
            afterInvite = next; openInvite(); return true;
        },
        offer(next) {
            if (!config.checkout || config.loggedIn || skipEntry || !entry() || !supported() || !remembered()) return false;
            continueCheckout = next;
            previousFocus = document.activeElement;
            const message = entry().querySelector('.ctwpml-passkey-card > p');
            if (message) message.textContent = 'Você já utilizou acesso rápido neste navegador. Recupere seu nome, telefone e endereço salvos.';
            entry().hidden = false;
            entry().querySelector('[data-ctwpml-passkey-login]').focus();
            return true;
        }
    };
    async function authenticate(button, create) {
        if (busy) return;
        const card = button.closest('.ctwpml-passkey-card') || button.parentElement;
        if (!supported()) { showMessage(card, 'Este navegador não oferece acesso rápido. Entre de outra forma.'); return; }
        busy = true; trace(create ? 'REGISTER_START' : 'LOGIN_START');
        const buttons = Array.from(document.querySelectorAll('[data-ctwpml-passkey-login], [data-ctwpml-passkey-register], [data-ctwpml-passkey-skip], [data-ctwpml-passkey-dismiss]'));
        buttons.forEach(element => { element.disabled = true; });
        showMessage(card, 'Confirme no seu aparelho…');
        try {
            const context = await post('ctwpml_passkey_context');
            if (!create && context.loggedIn) { returnToPage(); return; }
            if (create && (!context.loggedIn || !context.canRegister)) throw new Error('session_changed');
            trace('CONTEXT_READY');
            const options = await post(create ? 'secure_passkeys_frontend_get_register_options' : 'secure_passkeys_frontend_get_login_options', { nonce: context.nonce });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Math.min(120000, Math.max(10000, Number(options.timeout) || 60000)));
            let credential;
            try { credential = await navigator.credentials[create ? 'create' : 'get']({ publicKey: optionsForBrowser(options, create), signal: controller.signal }); }
            finally { clearTimeout(timeout); }
            trace('BROWSER_RETURNED');
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
            remember(); trace(create ? 'REGISTER_SUCCESS' : 'LOGIN_SUCCESS');
            if (create) {
                card.replaceChildren();
                const title = document.createElement('h2'); title.textContent = '✓ Tudo pronto!'; title.style.color = '#147746';
                const message = document.createElement('p'); message.textContent = 'Na próxima compra, use o acesso rápido para recuperar seus dados.';
                const next = document.createElement('button'); next.type = 'button'; next.className = 'ctwpml-passkey-primary'; next.dataset.ctwpmlPasskeyDismiss = ''; next.textContent = 'Continuar minha compra';
                card.append(title,message,next);
            }
            else returnToPage();
        } catch (error) {
            trace(create ? 'REGISTER_ERROR' : 'LOGIN_ERROR', ['NotAllowedError','AbortError','SecurityError','InvalidStateError','NotSupportedError'].includes(error.name) ? error.name : 'request_failed');
            if (!create) button.closest('.ctwpml-login-popup')?.classList.remove('ctwpml-passkey-first');
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
            const enroll = document.getElementById('ctwpml-passkey-enroll'); if (enroll) enroll.hidden = true;
            previousFocus?.focus();
            inviteFinished = true; trace('ENROLL_CONTINUE');
            const next = afterInvite; afterInvite = null; if (next) next();
            try { sessionStorage.setItem('ctwpml_passkey_invite_dismissed', '1'); } catch (_) { /* Sem storage, a compra continua. */ }
        }
    });
    document.addEventListener('keydown', event => {
        const enrollment = document.getElementById('ctwpml-passkey-enroll');
        const dialog = enrollment && !enrollment.hidden ? enrollment : entry();
        if (!dialog || dialog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); if (dialog === entry()) closeEntry(); }
        if (event.key === 'Tab') {
            const controls = Array.from(dialog.querySelectorAll('button:not(:disabled)'));
            if (!controls.length) { event.preventDefault(); return; }
            const index = controls.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && (index === controls.length - 1 || index < 0)) { event.preventDefault(); controls[0].focus(); }
        }
    });
    async function openInvite() {
        if (inviteOpening || inviteFinished) return;
        const card = document.querySelector('#ctwpml-passkey-enroll [data-ctwpml-passkey-invite]');
        if (!card) return;
        inviteOpening = true;
        try {
            const context = await post('ctwpml_passkey_context');
            if (!supported() || !context.loggedIn || !context.canRegister || context.hasPasskeys) {
                inviteFinished = true; const next = afterInvite; afterInvite = null; if (next) next(); return;
            }
            card.hidden = false; document.getElementById('ctwpml-passkey-enroll').hidden = false;
            previousFocus = document.activeElement;
            trace('ENROLL_SHOWN'); card.querySelector('button')?.focus();
        } catch (_) {
            trace('ENROLL_CONTEXT_ERROR', 'error'); inviteFinished = true;
            const next = afterInvite; afterInvite = null; if (next) next();
        } finally { inviteOpening = false; }
    }
    function invite() {
        if (config.checkout && config.loggedIn && new URL(location.href).searchParams.has('ctwpml_session_refresh')) openInvite();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', invite);
    else invite();
})();
