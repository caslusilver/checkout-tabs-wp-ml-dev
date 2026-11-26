(() => {
    'use strict';
    const config = window.ctwpmlPasskeyConfig;
    if (!config) return;
    let busy = false, skipEntry = false, continueCheckout = null, previousFocus = null;
    let inviteFinished = false, inviteOpening = false, afterInvite = null, enrollmentNonce = null;
    let immediatePrepared = null, preparingImmediate = false;
    const traceStart = performance.now();
    function trace(event, outcome) {
        const state = window.CCCheckoutTabsState;
        const data = { event, outcome: outcome || 'ok', elapsedMs: Math.round(performance.now() - traceStart) };
        if (state?.checkpoint) state.checkpoint('CHK_PASSKEY_' + event, !event.endsWith('_ERROR') && event !== 'HTTP_REJECTED' && outcome !== 'error', data);
        if (config.debug || window.cc_params?.debug) console.info('[CTWPML][PASSKEY]', data);
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
            if (!response.ok || !result.success) {
                trace('HTTP_REJECTED', String(response.status));
                // Só os motivos fixos emitidos pelo adaptador são apresentados; nunca ecoar erros arbitrários.
                const errors = action === 'secure_passkeys_frontend_login' ? config.loginErrors :
                    action === 'secure_passkeys_frontend_register_passkey' ? config.registerErrors : null;
                const code = Object.keys(errors || {}).find(key => result.data === errors[key]);
                throw new Error(code || 'request_failed');
            }
            return result.data;
        } finally { clearTimeout(timeout); }
    }
    const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const encode = value => {
        let text = '';
        for (const byte of new Uint8Array(value)) text += String.fromCharCode(byte);
        return btoa(text);
    };
    function registrationName() {
        // Nome descritivo único; não identifica o cliente nem decide qual chave pode entrar.
        const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('');
        return 'Acesso rapido ' + suffix;
    }
    function optionsForBrowser(options, create) {
        const result = { ...options, challenge: decode(options.challenge) };
        if (create) result.user = { ...options.user, id: decode(options.user.id) };
        const list = create ? 'excludeCredentials' : 'allowCredentials';
        if (options[list]) result[list] = options[list].map(item => ({ ...item, id: decode(item.id) }));
        return result;
    }
    function returnToPage(early) {
        const url = new URL(window.location.href);
        url.searchParams.set('ctwpml_session_refresh', String(Date.now()));
        if (early) {
            url.searchParams.set('ctwpml_early_resume','1');
            try { sessionStorage.setItem('ctwpml_early_profile_pending','1'); } catch (_) {}
        }
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
        supported,
        request: post,
        login: button => authenticate(button, false),
        isBusy: () => busy,
        beforeCheckout(next) {
            if (!config.checkout || !config.loggedIn || inviteFinished || !document.querySelector('#ctwpml-passkey-enroll')) return false;
            afterInvite = next; openInvite(); return true;
        },
        offer(next) {
            if (new URL(location.href).searchParams.get('ctwpml_pk_entry_skip') === '1') return false;
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
        const buttons = Array.from(document.querySelectorAll('[data-ctwpml-passkey-login], [data-ctwpml-passkey-register], [data-ctwpml-passkey-skip], [data-ctwpml-passkey-dismiss], [data-ctwpml-passkey-password], [data-ctwpml-passkey-back]'));
        buttons.forEach(element => { element.disabled = true; });
        showMessage(card, 'Confirme no seu aparelho…');
        let recoveryFocus = null;
        try {
            const context = await post('ctwpml_passkey_context');
            if (context.checkEmailNonce) config.checkEmailNonce = context.checkEmailNonce;
            if (!create && context.loggedIn) { returnToPage(); return; }
            if (create && (!context.loggedIn || !context.canRegister)) throw new Error('session_changed');
            if (!create && config.checkout && button.closest('#ctwpml-view-auth')) {
                const email = button.closest('.ctwpml-login-popup')?.dataset.ctwpmlExpectedEmail;
                if (!email || !config.checkEmailNonce) throw new Error('CHECKOUT_ACCOUNT_CONTEXT_MISSING');
                // Renova a identificação pelo e-mail do checkout antes de pedir a prova, sem autenticar por e-mail.
                const route = await post('ctwpml_check_email', { _ajax_nonce: config.checkEmailNonce, email });
                if (!route.exists) throw new Error('CHECKOUT_ACCOUNT_CONTEXT_MISSING');
                trace('ACCOUNT_CONTEXT_READY');
            }
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
            const earlyTicket = !create && button.dataset.ctwpmlEarlyTicket || '';
            await post(create ? 'secure_passkeys_frontend_register_passkey' : 'secure_passkeys_frontend_login', {
                nonce: context.nonce, challenge: options.challenge, id: credential.id, rawId: encode(credential.rawId), type: credential.type, response,
                ...(create ? { security_key_name: registrationName(), ctwpml_registration_context: 'checkout' } :
                    { ctwpml_context: earlyTicket ? 'checkout-early' : config.checkout && button.closest('#ctwpml-view-auth') ? 'checkout-late' : 'entry', ctwpml_early_ticket: earlyTicket })
            });
            if (!create && !(await post('ctwpml_passkey_context')).loggedIn) throw new Error('session_not_authenticated');
            showMessage(card, create ? 'Acesso ativado. Na próxima compra, use seus dados salvos.' : 'Acesso confirmado. Carregando seus dados…');
            remember(); trace(create ? 'REGISTER_SUCCESS' : 'LOGIN_SUCCESS');
            if (create) {
                await post('ctwpml_passkey_context').catch(() => trace('REGISTER_INDICATOR_SYNC', 'pending')); // A prova já foi aceita pelo motor.
                card.replaceChildren();
                const title = document.createElement('h2'); title.textContent = '✓ Tudo pronto!'; title.style.color = '#147746';
                const message = document.createElement('p'); message.textContent = 'Na próxima compra, use o acesso rápido para recuperar seus dados.';
                const next = document.createElement('button'); next.type = 'button'; next.className = 'ctwpml-passkey-primary'; next.dataset.ctwpmlPasskeyDismiss = ''; next.textContent = 'Continuar minha compra';
                card.append(title,message,next);
            }
            else returnToPage(!!earlyTicket || (!button.closest('#ctwpml-view-auth') && window.CTWPML_EarlyLogin?.enabled));
        } catch (error) {
            const accountError = !create && config.loginErrors?.[error.message];
            const registrationError = create && config.registerErrors?.[error.message];
            if (!create) document.dispatchEvent(new CustomEvent('ctwpml:passkey-error', {detail:{early:!!button.dataset.ctwpmlEarlyTicket,code:accountError?error.message:'request_failed'}}));
            trace(create ? 'REGISTER_ERROR' : 'LOGIN_ERROR', accountError || registrationError ? error.message : ['NotAllowedError','AbortError','SecurityError','InvalidStateError','NotSupportedError'].includes(error.name) ? error.name : 'request_failed');
            if (!create) { const popup = button.closest('.ctwpml-login-popup'); popup?.classList.remove('ctwpml-passkey-first'); popup?.removeAttribute('aria-modal'); }
            if (!create) window.ctwpmlRenderRecaptchaIfNeeded?.();
            const cancelled = ['NotAllowedError', 'AbortError'].includes(error.name) || error.message === 'cancelled';
            showMessage(card, accountError || registrationError || (cancelled ? 'Acesso cancelado ou chave indisponível. Você pode tentar novamente ou continuar de outra forma.' :
                create ? 'Não foi possível salvar o acesso. Sua compra pode continuar normalmente.' : 'Não foi possível entrar. Tente novamente ou entre de outra forma.'));
            if (accountError) {
                button.textContent = 'Usar outra chave';
                const popup = button.closest('.ctwpml-login-popup');
                recoveryFocus = error.message === 'CHECKOUT_ACCOUNT_CONTEXT_MISSING' ? popup?.querySelector('[data-ctwpml-passkey-back]') : popup?.querySelector('#ctwpml-login-password');
            }
        } finally { busy = false; buttons.forEach(element => { element.disabled = false; }); recoveryFocus?.focus(); }
    }
    document.addEventListener('click', event => {
        const login = event.target.closest('[data-ctwpml-passkey-login]');
        const register = event.target.closest('[data-ctwpml-passkey-register]');
        if (login || register) { event.preventDefault(); authenticate(login || register, !!register); }
        const password = event.target.closest('[data-ctwpml-passkey-password]');
        if (password) {
            event.preventDefault();
            const popup = password.closest('.ctwpml-login-popup');
            popup.classList.remove('ctwpml-passkey-first'); popup.removeAttribute('aria-modal');
            window.ctwpmlRenderRecaptchaIfNeeded?.();
            popup.querySelector('#ctwpml-login-email')?.focus();
        }
        if (event.target.closest('[data-ctwpml-passkey-skip]')) { event.preventDefault(); closeEntry(); }
        const dismiss = event.target.closest('[data-ctwpml-passkey-dismiss]');
        if (dismiss && !busy) finishInvite(dismiss);
        if (event.target.closest('[data-ctwpml-passkey-back]')) {
            event.preventDefault();
            if (!busy) document.getElementById('ctwpml-modal-back')?.click();
        }
    });
    document.addEventListener('keydown', event => {
        const enrollment = document.getElementById('ctwpml-passkey-enroll');
        const late = document.querySelector('.ctwpml-login-popup.ctwpml-passkey-first');
        const dialog = enrollment && !enrollment.hidden ? enrollment : late && late.getClientRects().length ? late : entry();
        if (!dialog || dialog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); if (dialog === entry()) closeEntry(); else if (dialog === late && !busy) late.querySelector('[data-ctwpml-passkey-password]')?.click(); }
        if (event.key === 'Tab') {
            const controls = Array.from(dialog.querySelectorAll('button:not(:disabled)')).filter(el => el.getClientRects().length);
            if (!controls.length) { event.preventDefault(); return; }
            const index = controls.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && (index === controls.length - 1 || index < 0)) { event.preventDefault(); controls[0].focus(); }
        }
    });
    async function finishInvite(button) {
        busy = true; button.disabled = true;
        try { await post('ctwpml_passkey_context', { enrollment_done: 1, nonce: enrollmentNonce || '', order_id: config.afterOrderId || 0 }); }
        catch (_) { trace('ENROLL_ACK_ERROR', 'error'); }
        finally {
            busy = false;
            const enroll = document.getElementById('ctwpml-passkey-enroll'); if (enroll) enroll.hidden = true;
            previousFocus?.focus(); inviteFinished = true; trace('ENROLL_CONTINUE');
            const next = afterInvite; afterInvite = null; if (next) next();
        }
    }
    async function openInvite() {
        if (inviteOpening || inviteFinished) return;
        const card = document.querySelector('#ctwpml-passkey-enroll [data-ctwpml-passkey-invite]');
        if (!card) return;
        inviteOpening = true;
        try {
            const context = await post('ctwpml_passkey_context'); enrollmentNonce = context.nonce;
            if (!supported() || !context.loggedIn || !context.canRegister || context.usedPasskey || context.enrollmentSeen) {
                inviteFinished = true; const next = afterInvite; afterInvite = null; if (next) next(); return;
            }
            // Ter chaves na conta não prova que este aparelho ainda disponha delas.
            card.hidden = false; document.getElementById('ctwpml-passkey-enroll').hidden = false;
            previousFocus = document.activeElement;
            trace('ENROLL_SHOWN', context.hasPasskeys ? 'another_device_allowed' : 'first_key'); card.querySelector('button')?.focus();
        } catch (_) {
            trace('ENROLL_CONTEXT_ERROR', 'error'); inviteFinished = true;
            const next = afterInvite; afterInvite = null; if (next) next();
        } finally { inviteOpening = false; }
    }
    async function prepareImmediate() {
        if (!config.cart || config.loggedIn || !supported() || preparingImmediate || !PublicKeyCredential.getClientCapabilities) return;
        preparingImmediate = true;
        try {
            const capabilities = await PublicKeyCredential.getClientCapabilities();
            if (!capabilities.immediateGet || busy) return;
            const context = await post('ctwpml_passkey_context'); if (context.loggedIn || busy) return;
            const options = await post('secure_passkeys_frontend_get_login_options', { nonce: context.nonce });
            if (options.allowCredentials?.length) return;
            immediatePrepared = {context, options, at: Date.now()};
        } catch (_) { immediatePrepared = null; trace('EARLY_PREPARE', 'unavailable'); }
        finally { preparingImmediate = false; }
    }
    function checkoutTarget(event) {
        if (!config.cart || config.loggedIn || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
        const link = event.target.closest('a.checkout-button,a.wc-block-cart__submit-button');
        if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return null;
        try {
            const url = new URL(link.href, location.href), expected = new URL(config.checkoutUrl);
            return url.origin === location.origin && url.origin === expected.origin && url.pathname.replace(/\/$/,'') === expected.pathname.replace(/\/$/,'') ? url : null;
        } catch (_) { return null; }
    }
    document.addEventListener('click', async event => {
        const target = checkoutTarget(event); if (!target) return;
        if (busy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (!immediatePrepared || Date.now() - immediatePrepared.at > 60000) return;
        const prepared = immediatePrepared; immediatePrepared = null;
        event.preventDefault(); event.stopImmediatePropagation(); busy = true; let authenticated = false;
        try {
            // Chamada direta no gesto do carrinho, sem await anterior nem AbortSignal neste modo.
            const credential = await navigator.credentials.get({publicKey: optionsForBrowser(prepared.options, false), uiMode: 'immediate'});
            if (!credential) throw new Error('cancelled');
            const response = {clientDataJSON:encode(credential.response.clientDataJSON), authenticatorData:encode(credential.response.authenticatorData), signature:encode(credential.response.signature), userHandle:credential.response.userHandle ? encode(credential.response.userHandle) : ''};
            await post('secure_passkeys_frontend_login', {nonce:prepared.context.nonce,challenge:prepared.options.challenge,id:credential.id,rawId:encode(credential.rawId),type:credential.type,response,ctwpml_context:'entry'});
            if (!(await post('ctwpml_passkey_context')).loggedIn) throw new Error('session_not_authenticated');
            authenticated = true; remember(); trace('EARLY_LOGIN_SUCCESS');
        } catch (_) { trace('EARLY_LOGIN_FALLBACK', 'unavailable_or_declined'); }
        finally {
            // Sem credencial, modo privado, cancelamento ou rejeição: o checkout continua normalmente.
            const url = new URL(target.href); url.searchParams.set('ctwpml_session_refresh',String(Date.now()));
            if (!authenticated) url.searchParams.set('ctwpml_pk_entry_skip','1');
            location.assign(url.href);
        }
    }, true);
    function invite() {
        prepareImmediate();
        if (config.afterOrder) {
            const url = new URL(config.afterOrder, location.href);
            if (url.origin !== location.origin) return;
            afterInvite = () => location.assign(url.href); openInvite();
        } else if (config.checkout && config.loggedIn && new URL(location.href).searchParams.has('ctwpml_session_refresh')) openInvite();
    }
    window.addEventListener('focus', () => { if (!immediatePrepared || Date.now() - immediatePrepared.at > 60000) prepareImmediate(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', invite);
    else invite();
})();
