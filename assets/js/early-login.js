(() => {
    'use strict';
    const config=window.ctwpmlEarlyLoginConfig, api=window.CTWPMLPasskeys;
    if(!config||!api)return;
    const early=()=>document.getElementById('ctwpml-early-access'), menu=()=>document.getElementById('ctwpml-menu-access');
    let skip=false,next=null,previousFocus=null,previousOverflow='',active=null;
    let cached=null,cachedAt=0,contextPending=null,passwordBusy=false;
    let emailTimer=null,lookupBusy=false,lookupVersion=0,route=null,advanceRequested=false,editingEmail=false;
    let menuContext='entry',menuTicket='',menuWidget=null,menuCaptchaValid=false,apiLoading=null;
    const trace=(name,ok=true)=>window.CCCheckoutTabsState?.checkpoint?.('CHK_EARLY_'+name,ok,{});
    const isBusy=()=>passwordBusy||api.isBusy();
    async function context(force=false){
        if(contextPending)return contextPending;
        if(!force&&cached&&Date.now()-cachedAt<5000)return cached;
        contextPending=api.request('ctwpml_passkey_context').then(value=>{
            cached=value;cachedAt=Date.now();
            document.querySelectorAll('[data-ctwpml-menu-login]').forEach(node=>{
                node.classList.toggle('is-logged-in',!!value.loggedIn);
                node.setAttribute('aria-label',value.loggedIn?'Logado. Abrir minha conta':'Login. Abrir acesso rápido');
                const label=node.querySelector('[data-ctwpml-menu-label]');if(label)label.textContent=value.loggedIn?'Logado':'Login';
            });return value;
        }).finally(()=>{contextPending=null;});
        return contextPending;
    }
    function show(node){if(!node)return;previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;node.hidden=false;active=node;document.body.style.overflow='hidden';Array.from(node.querySelectorAll('input,button,a')).find(control=>!control.disabled&&!control.closest('[hidden]'))?.focus();}
    function hide(node){if(!node||isBusy())return false;node.hidden=true;document.body.style.overflow=previousOverflow;active=null;previousFocus?.focus();return true;}
    function earlyMessage(text){const node=early()?.querySelector('[data-ctwpml-early-message]');if(node)node.textContent=text;}
    function earlyEmail(){return (document.getElementById('ctwpml-early-email')?.value||'').trim().toLowerCase();}
    function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;}
    function routeMode(){return route?.exists&&route.ticket?route.method:'identify';}
    function identityView(mode){
        const node=early();if(!node)return;
        const found=mode==='passkey'||mode==='password',withKey=mode==='passkey';
        node.querySelector('#ctwpml-early-email-form').hidden=found;
        node.querySelector('#ctwpml-early-email').readOnly=found;
        node.querySelector('[data-ctwpml-early-email-summary]').hidden=!found;
        node.querySelector('[data-ctwpml-early-email-value]').textContent=found?earlyEmail():'';
        node.querySelector('[data-ctwpml-early-title]').textContent=withKey?'Encontramos seu acesso rápido.':found?'Recupere seus dados salvos.':'Vamos começar pelo seu e-mail.';
        node.querySelector('[data-ctwpml-early-description]').textContent=withKey?'Agora é só confirmar para recuperar seus dados e continuar a compra.':found?'Entre na sua conta para continuar sem preencher tudo de novo.':'Se já comprou aqui, você pode recuperar seus dados sem preencher tudo de novo.';
        node.querySelector('[data-ctwpml-early-offer]').hidden=!withKey;
        node.querySelector('[data-ctwpml-early-existing]').hidden=mode!=='password';
        node.querySelector('#ctwpml-early-email-form [type="submit"]').textContent=editingEmail?'Consultar':'Continuar';
    }
    function editEmail(){
        if(isBusy())return;
        lookupVersion++;route=null;advanceRequested=false;editingEmail=true;clearTimeout(emailTimer);
        early().querySelector('[data-ctwpml-early-offer] [data-ctwpml-passkey-login]').removeAttribute('data-ctwpml-early-ticket');
        identityView('identify');earlyMessage('');document.getElementById('ctwpml-early-email').focus();trace('EMAIL_EDIT');
    }
    function manual(){
        if(isBusy())return;
        const email=earlyEmail();if(email&&!validEmail(email)){document.getElementById('ctwpml-early-email').reportValidity();return;}
        lookupVersion++;route=null;clearTimeout(emailTimer);skip=true;
        if(!hide(early()))return;
        const proceed=next;next=null;trace('MANUAL');if(proceed)proceed(validEmail(email)?email:'');
    }
    async function lookup(advance=false){
        advanceRequested=advanceRequested||advance;
        const value=earlyEmail();if(!validEmail(value))return;
        if(lookupBusy)return;
        if(route?.email===value){const mode=routeMode();if(mode!=='identify')identityView(mode);else if(advanceRequested)manual();advanceRequested=false;return;}
        const version=lookupVersion;lookupBusy=true;earlyMessage('Conferindo as opções de acesso…');trace('LOOKUP_START');
        const submit=early()?.querySelector('[type="submit"]');if(submit)submit.disabled=true;
        try{
            const state=await context();
            if(state.loggedIn){reload(true);return;}
            const result=await api.request('ctwpml_check_email',{_ajax_nonce:state.checkEmailNonce,email:value,early:1});
            if(version!==lookupVersion||value!==earlyEmail()||early()?.hidden)return;
            route={email:value,exists:Number(result.exists)===1,method:result.auth_method==='passkey'?'passkey':'password',ticket:result.ticket||''};
            const offer=early().querySelector('[data-ctwpml-early-offer]');
            const mode=routeMode(),found=mode!=='identify';
            identityView(mode);
            const button=offer.querySelector('[data-ctwpml-passkey-login]');button.dataset.ctwpmlEarlyTicket=route.ticket;
            button.disabled=!api.supported();
            earlyMessage(found?'':'Continue para preencher seus dados.');
            trace('LOOKUP_READY');
            if(found)(mode==='passkey'?button:early().querySelector('[data-ctwpml-early-existing-login]')).focus();
            if(advanceRequested&&!found)manual();
        }catch(_){if(version===lookupVersion){earlyMessage('Não foi possível consultar agora. Você pode continuar preenchendo seus dados.');trace('LOOKUP_ERROR',false);}}
        finally{
            lookupBusy=false;advanceRequested=false;if(submit)submit.disabled=false;
            if(!editingEmail&&!early()?.hidden&&value!==earlyEmail()&&validEmail(earlyEmail()))emailTimer=setTimeout(()=>lookup(),450);
        }
    }
    function reload(earlyResume){const url=new URL(location.href);url.searchParams.set('ctwpml_session_refresh',String(Date.now()));if(config.enabled&&earlyResume){try{sessionStorage.setItem('ctwpml_early_profile_pending','1');}catch(_){}if(config.checkout)url.searchParams.set('ctwpml_early_resume','1');}location.assign(url.href);}
    function passwordMessage(text){const node=menu()?.querySelector('[data-ctwpml-menu-message]');if(node)node.textContent=text;}
    function passwordButton(){const node=menu()?.querySelector('#ctwpml-menu-password-form [type="submit"]');if(node)node.disabled=passwordBusy||!!(cached?.recaptchaEnabled&&!menuCaptchaValid);}
    async function googleApi(){
        if(window.grecaptcha?.render)return;
        if(apiLoading)return apiLoading;
        apiLoading=new Promise((resolve,reject)=>{
            const started=Date.now();
            if(!document.querySelector('script[src*="recaptcha/api.js"]')){const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?render=explicit';script.async=true;document.head.appendChild(script);}
            const check=()=>{if(window.grecaptcha?.render)resolve();else if(Date.now()-started>12000)reject(new Error('captcha_unavailable'));else setTimeout(check,250);};check();
        }).finally(()=>{apiLoading=null;});return apiLoading;
    }
    async function captcha(){
        const container=document.getElementById('ctwpml-menu-captcha'),retry=menu()?.querySelector('[data-ctwpml-menu-captcha-retry]');
        if(!cached?.recaptchaEnabled){if(container)container.hidden=true;passwordButton();return;}
        if(container)container.hidden=false;
        try{
            if(!cached.recaptchaSiteKey)throw new Error('captcha_configuration');
            await googleApi();if(menu()?.hidden||menu().querySelector('#ctwpml-menu-password-form').hidden)return;
            if(menuWidget===null)menuWidget=grecaptcha.render(container,{sitekey:cached.recaptchaSiteKey,size:container.clientWidth<304?'compact':'normal',callback:()=>{menuCaptchaValid=true;passwordButton();if(retry)retry.hidden=true;},'expired-callback':()=>{menuCaptchaValid=false;passwordButton();passwordMessage('A verificação expirou. Confirme novamente.');},'error-callback':()=>{menuCaptchaValid=false;passwordButton();if(retry)retry.hidden=false;passwordMessage('Não foi possível verificar agora. Tente novamente.');}});
            if(retry)retry.hidden=true;
        }catch(_){passwordMessage('Não foi possível carregar a verificação. Tente novamente ou use a recuperação de senha.');if(retry)retry.hidden=false;}
        passwordButton();
    }
    async function revealPassword(){
        if(isBusy())return;
        const form=document.getElementById('ctwpml-menu-password-form');if(!form)return;
        form.hidden=false;menu().querySelector('.ctwpml-passkey-card').hidden=true;
        menu().querySelector('[data-ctwpml-menu-password]').hidden=true;
        const email=form.querySelector('[name="email"]');
        (menuContext==='checkout-early'&&validEmail(email.value)?form.querySelector('[name="password"]'):email).focus();await captcha();
    }
    async function openMenu(options={}){
        if(isBusy())return;
        const node=menu();if(!node)return;
        // Fechar a tela antecipada só muda apresentação; a continuação manual permanece guardada.
        if(active===early())hide(early());
        show(node);menuContext=options.ticket?'checkout-early':'entry';menuTicket=options.ticket||'';
        node.querySelector('.ctwpml-passkey-card').hidden=false;
        node.querySelector('[data-ctwpml-menu-password]').hidden=false;
        const form=node.querySelector('#ctwpml-menu-password-form');form.hidden=true;
        form.querySelector('[name="email"]').value=options.email||'';form.querySelector('[name="password"]').value='';
        node.querySelector('[data-ctwpml-passkey-login]').dataset.ctwpmlEarlyTicket=menuTicket;
        node.querySelector('.ctwpml-passkey-message').textContent='';passwordMessage('');
        try{await context(true);if(cached.loggedIn){reload(config.checkout);return;}node.querySelector('[data-ctwpml-passkey-login]').disabled=!api.supported();if(options.password)await revealPassword();}
        catch(_){node.querySelector('.ctwpml-passkey-message').textContent='Não foi possível iniciar agora. Use a recuperação de senha ou tente novamente.';}
    }
    async function passwordLogin(form){
        if(isBusy()||!form.reportValidity())return;
        passwordBusy=true;passwordButton();passwordMessage('Conferindo seu acesso…');
        try{
            const state=await context(true);let response='';
            if(state.loggedIn){reload(config.checkout);return;}
            if(state.recaptchaEnabled){response=menuCaptchaValid&&menuWidget!==null?grecaptcha.getResponse(menuWidget):'';if(!response)throw new Error('captcha_required');}
            await api.request('ctwpml_login',{_ajax_nonce:state.loginNonce,email:form.elements.email.value.trim(),password:form.elements.password.value,recaptcha_response:response,ctwpml_context:menuContext,ctwpml_early_ticket:menuTicket});
            if(!(await context(true)).loggedIn)throw new Error('session_not_authenticated');
            form.elements.password.value='';trace('PASSWORD_SUCCESS');reload(true);
        }catch(error){
            passwordMessage(error.message==='captcha_required'?'Complete a verificação de segurança.':'Não foi possível entrar. Confira o e-mail e a senha ou use “Perdeu sua senha?”.');trace('PASSWORD_ERROR',false);
            menuCaptchaValid=false;if(menuWidget!==null)try{grecaptcha.reset(menuWidget);}catch(_){}
        }finally{passwordBusy=false;passwordButton();}
    }
    window.CTWPML_EarlyLogin={enabled:!!config.enabled,offer(proceed){
        if(!config.enabled||!config.checkout||skip||!early()||window.ctwpmlPasskeyConfig?.loggedIn)return false;
        next=proceed;show(early());trace('SHOWN');return true;
    }};
    document.addEventListener('input',event=>{
        if(event.target.id!=='ctwpml-early-email')return;
        lookupVersion++;route=null;clearTimeout(emailTimer);identityView('identify');earlyMessage('');
        if(!editingEmail)emailTimer=setTimeout(()=>lookup(),550);
    });
    document.addEventListener('submit',event=>{
        if(event.target.id==='ctwpml-early-email-form'){event.preventDefault();if(event.target.reportValidity())lookup(true);}
        if(event.target.id==='ctwpml-menu-password-form'){event.preventDefault();passwordLogin(event.target);}
    });
    document.addEventListener('ctwpml:passkey-error',event=>{
        if(!event.detail?.early||event.detail.code!=='CHECKOUT_ACCOUNT_CONTEXT_MISSING')return;
        route=null;editingEmail=true;identityView('identify');
        earlyMessage('Confirme seu e-mail novamente para renovar a tentativa de acesso.');
    });
    document.addEventListener('click',event=>{
        const trigger=event.target.closest('[data-ctwpml-menu-login]');
        if(trigger&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();if(cached?.loggedIn)window.open(config.account,'_blank','noopener,noreferrer');else openMenu();}
        if(event.target.closest('[data-ctwpml-menu-password]'))revealPassword();
        if(event.target.closest('[data-ctwpml-early-manual]'))manual();
        if(event.target.closest('[data-ctwpml-early-edit]'))editEmail();
        if(event.target.closest('[data-ctwpml-early-password]'))openMenu({email:earlyEmail(),ticket:route?.ticket,password:true});
        if(event.target.closest('[data-ctwpml-early-existing-login]')&&routeMode()==='password')openMenu({email:route.email,ticket:route.ticket,password:true});
        if(event.target.closest('[data-ctwpml-menu-captcha-retry]')){if(menuWidget!==null)try{grecaptcha.reset(menuWidget);}catch(_){}menuCaptchaValid=false;captcha();}
        if(event.target.closest('[data-ctwpml-access-close]')&&!isBusy()){
            if(hide(menu())){menu().querySelector('[name="password"]').value='';if(next&&!skip)show(early());}
        }
    });
    document.addEventListener('keydown',event=>{
        if(!active||active.hidden||!['Tab','Escape'].includes(event.key))return;
        event.stopImmediatePropagation();
        if(event.key==='Escape'){event.preventDefault();if(isBusy())return;if(active===menu()){hide(menu());if(next&&!skip)show(early());}else manual();return;}
        const controls=Array.from(active.querySelectorAll('input,button,a[href]')).filter(node=>!node.disabled&&node.getClientRects().length);
        if(!controls.length)return;
        const index=controls.indexOf(document.activeElement);
        if(event.shiftKey&&index<=0){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0].focus();}
    },true);
    function refreshMenus(){if(document.hidden||isBusy()||!document.querySelector('[data-ctwpml-menu-login]'))return;context().catch(()=>trace('CONTEXT_ERROR',false));}
    window.addEventListener('focus',refreshMenus);document.addEventListener('visibilitychange',refreshMenus);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshMenus);else refreshMenus();
})();
