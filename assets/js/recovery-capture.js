/* Write-only checkout diagnostics. No screen/keystroke recording, secrets or contact data in logs. */
(() => {
    'use strict';
    const cfg=window.ctwpmlRecoveryCapture;if(!cfg||!window.fetch||!window.crypto?.getRandomValues)return;
    const key='ctwpml_recovery_v1',uuid=()=>crypto.randomUUID?crypto.randomUUID():[4,2,2,2,6].map(n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('')).join('-');
    const nativeFetch=window.fetch.bind(window);
    const started=performance.now(),page=uuid();
    let saved={},events=[],busy=false,begun=false,stopped=false,timer=null,contextTimer=null,stage='initial',sequence=0,failures=0;
    try{saved=JSON.parse(sessionStorage.getItem(key)||'{}');}catch(_){}
    const technical=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:/-]{1,100}$/.test(v)?v:undefined;
    function detail(input={}){
        const out={stage,version:cfg.version,sequence:++sequence,elapsed:Math.round(performance.now()-started)};
        for(const k of ['stage','action','route','result','reason','field','navigation','request','source'])if(technical(input[k]))out[k]=input[k];
        for(const k of ['status','duration','line','column','width','height'])if(Number.isFinite(input[k]))out[k]=input[k];
        for(const k of ['hasRedirect','hidden','online','persisted','checked','pending','billingReady','paymentReady','appliedMatch','totalsReady','pendingWooUpdate','pendingShipping','hasEmail','hasPhone','hasAddressId','hasBillingSnapshot','hasFormSnapshot','autoSubmit','resumeAfterAuth','isLoggedIn'])if(typeof input[k]==='boolean')out[k]=input[k];
        return out;
    }
    function routeKind(url){
        try{const u=new URL(url,location.href);if(u.origin!==location.origin)return 'external';if(u.pathname==='/')return 'home';if(/order-received|obrigado/.test(u.pathname))return 'thankyou';if(/checkout|finalizar|pagamento/.test(u.pathname))return 'checkout';return 'other';}catch(_){return 'unknown';}
    }
    function checkpoint(name,ok=true,data={}){
        if(stopped)return;
        const code=String(name||'').toUpperCase().replace(/[^A-Z0-9_.-]/g,'').slice(0,80);if(!code)return;
        if(/AUTH_|PASSKEY_LOGIN/.test(code))stage='authentication';
        if(technical(data.view))stage=data.view;
        if(!data.reason&&technical(data.outcome))data={...data,reason:data.outcome};
        if(!data.reason&&['login','create'].includes(data.mode||data.authMode))data={...data,reason:'auth_'+(data.mode||data.authMode)};
        // Readiness/espera/termos desmarcados são estados normais, não erros comprovados.
        const failed=ok===false&&/ERROR|REJECT|TIMEOUT|FAILED|NO_FORM|CTA_SUBMIT|AUTH_RESUME|CONTACT_META_PERSIST/.test(code);
        events.push({key:uuid(),name:code,ok:!failed,detail:detail(data)});
        if(events.length>250)events.shift(); // Memória limitada; a compra nunca espera a coleta.
        clearTimeout(timer);timer=setTimeout(()=>flush(),failed?50:1500);
        // Readiness polling must not postpone a confirmed address/shipping snapshot indefinitely.
        if(/^(CHK_SHIPPING_SET_APPLIED|CHK_REVIEW_GATE_READY|CHK_BILLING_REHYDRATE|CHECKOUT_CONTEXT_UPDATED)$/.test(code)&&!contextTimer)
            contextTimer=setTimeout(()=>{contextTimer=null;flush();},300);
    }
    window.CTWPMLRecovery={checkpoint};
    function device(){
        const ua=navigator.userAgent||'';
        let os=/Android/i.test(ua)?'Android':/iPhone|iPad|iPod/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'unknown';
        if(os==='macOS'&&navigator.maxTouchPoints>1)os='iPadOS';
        const match=ua.match(/(Edg|Firefox|Chrome|Version)\/([\d.]+)/);
        let browser=match?({Edg:'Edge',Version:'Safari'}[match[1]]||match[1])+' '+match[2]:'unknown';
        if(/CriOS\//.test(ua))browser='Chrome iOS';if(/FxiOS\//.test(ua))browser='Firefox iOS';
        return {os,browser,type:/Android|iOS|iPadOS/.test(os)?'mobile':'desktop',width:innerWidth,height:innerHeight,touch:navigator.maxTouchPoints>0};
    }
    const values=selectors=>{for(const s of selectors){const el=document.querySelector(s);if(el&&String(el.value||'').trim())return String(el.value).trim();}return '';};
    function snapshot(){try{return window.CCCheckoutTabsState?.desktopSnapshot?.()||{};}catch(_){return {};}}
    function contact(snap=snapshot()){const address=snap.address||{};return {
        name:values(['#ctwpml-input-nome','#billing_first_name','[name="billing_first_name"]']),
        email:values(['#ctwpml-early-email','#ctwpml-input-email','#billing_email','[name="billing_email"]']),
        phone:values(['#ctwpml-phone-full','#billing_cellphone','#billing_phone','[name="billing_phone"]']),
        city:address.city||values(['#billing_city','[name="billing_city"]']),
        region:address.state||values(['#billing_state','[name="billing_state"]']),
        neighborhood:address.neighborhood||values(['#ctwpml-input-bairro','#billing_neighborhood','[name="billing_neighborhood"]']),
        postcode:address.cep||address.postcode||values(['#ctwpml-input-cep','#billing_postcode','[name="billing_postcode"]'])
    };}
    function remember(){
        try{sessionStorage.setItem(key,JSON.stringify({trace:saved.trace,proof:saved.proof,page,at:Date.now()}));}catch(_){}
        bindForm();
    }
    function bindForm(){
        if(!saved.trace||!saved.proof||!document?.documentElement)return;
        document.querySelectorAll('form.checkout,form.woocommerce-checkout').forEach(form=>{
            for(const [name,value]of Object.entries({ctwpml_recovery_trace:saved.trace,ctwpml_recovery_proof:saved.proof})){
                let field=form.querySelector('input[name="'+name+'"]');
                if(!field){field=document.createElement('input');field.type='hidden';field.name=name;form.appendChild(field);}
                if(field.value!==value)field.value=value;
            }
        });
    }
    function payload(batch){const snap=snapshot();return {operation:begun?'append':'begin',trace:saved.trace||'',proof:saved.proof||'',page,device:device(),contact:contact(snap),checkout:{address_id:String(snap.address?.id||''),method_id:String(snap.shipping?.methodId||'')},events:batch};}
    function form(body){const f=new FormData();f.set('action','ctwpml_recovery_capture');f.set('nonce',cfg.nonce);f.set('batch',JSON.stringify(body));return f;}
    async function flush(){
        if(busy||stopped||(!events.length&&begun)||!navigator.onLine)return;
        busy=true;const batch=events.splice(0,20);
        while(batch.length>1&&JSON.stringify(payload(batch)).length>18000)events.unshift(batch.pop());
        try{
            const response=await nativeFetch(cfg.url,{method:'POST',credentials:'same-origin',cache:'no-store',body:form(payload(batch)),keepalive:true});
            const result=await response.json();
            if(!response.ok||!result.success){
                const code=result.data?.code;
                if(['identity_changed','trace_expired'].includes(code)){saved={};begun=false;try{sessionStorage.removeItem(key);}catch(_){}}
                if(['disabled','invalid_request','no_cart'].includes(code)){stopped=true;}
                throw new Error('capture_failed');
            }
            saved=result.data;begun=true;failures=0;remember();
        }catch(_){failures++;events=batch.concat(events).slice(-250);}
        finally{busy=false;if(events.length&&!stopped){clearTimeout(timer);timer=setTimeout(flush,Math.min(60000,3000*Math.pow(2,Math.min(failures,5))));}}
    }
    function beacon(name,data){
        if(!saved.trace||stopped)return;
        checkpoint(name,true,data);clearTimeout(timer);
        const batch=events.slice(0,20),body=payload(batch);body.operation='append';
        // Um lote pode ser reenviado: event_key é único e o servidor ignora duplicatas.
        if(navigator.sendBeacon)navigator.sendBeacon(cfg.url,form(body));
    }
    if(!cfg.checkout){
        // Somente retorno de uma tentativa anterior, sem começar rastreio de visitantes da home.
        if(saved.trace&&saved.proof&&Date.now()-Number(saved.at||0)<7200000){
            const body={operation:'append',trace:saved.trace,proof:saved.proof,page:saved.page||page,events:[{key:uuid(),name:'PAGE_LANDED',ok:true,detail:{navigation:routeKind(location.href),version:cfg.version}}]};
            nativeFetch(cfg.url,{method:'POST',credentials:'same-origin',cache:'no-store',body:form(body),keepalive:true}).catch(()=>{});
        }
        return;
    }
    function requestInfo(input,options){
        try{
            const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin)return null;
            const body=options?.body;let action='';
            if(body instanceof URLSearchParams||body instanceof FormData)action=body.get('action')||'';
            else if(typeof body==='string')action=new URLSearchParams(body).get('action')||'';
            else if(body&&typeof body==='object')action=body.action||'';
            if(/recovery|save_log|get_logs|passkey_context/.test(action))return null;
            const woo=url.searchParams.get('wc-ajax');
            if(!woo&&!/^ctwpml_|^secure_passkeys_frontend_(login|register|get_)/.test(action))return null;
            return {action:technical(woo?'woo_'+woo:action)||'unknown',route:woo?'woo_ajax':'admin_ajax',request:uuid()};
        }catch(_){return null;}
    }
    function responseInfo(info,data,status,duration){
        const failed=status>=400||data?.success===false||data?.result==='failure';
        checkpoint(failed?'REQUEST_REJECTED':'REQUEST_COMPLETE',!failed,{...info,status,duration,result:data?.result==='success'?'success':failed?'failure':'response',hasRedirect:!!data?.redirect});
        if(data?.redirect)checkpoint('NAVIGATION_EXPECTED',true,{...info,navigation:routeKind(data.redirect)});
    }
    window.fetch=function(input,options){
        const info=requestInfo(input,options),at=performance.now();
        if(info)checkpoint('REQUEST_START',true,info);
        return nativeFetch(input,options).then(response=>{
            try{if(info){
                const duration=Math.round(performance.now()-at);
                if((response.headers.get('content-type')||'').includes('json'))response.clone().json().then(data=>responseInfo(info,data,response.status,duration)).catch(()=>checkpoint('RESPONSE_PARSE_ERROR',false,{...info,status:response.status}));
                else responseInfo(info,null,response.status,duration);
            }}catch(_){}
            return response;
        },error=>{try{if(info)checkpoint(error.name==='AbortError'?'REQUEST_CANCELLED':'REQUEST_NETWORK_ERROR',error.name==='AbortError',{...info,duration:Math.round(performance.now()-at)});}catch(_){}throw error;});
    };
    const $=window.jQuery;
    if($){
        $(document).on('ajaxSend.ctwpmlRecovery',(event,xhr,options)=>{const info=requestInfo(options.url,{body:options.data});if(info){xhr.__ctwpmlRecovery={...info,at:performance.now()};checkpoint('REQUEST_START',true,info);}});
        $(document).on('ajaxComplete.ctwpmlRecovery',(event,xhr)=>{const info=xhr.__ctwpmlRecovery;if(info)responseInfo(info,xhr.responseJSON,xhr.status,Math.round(performance.now()-info.at));});
        $(document).on('ajaxError.ctwpmlRecovery',(event,xhr)=>{const info=xhr.__ctwpmlRecovery;if(info)checkpoint(xhr.statusText==='abort'?'REQUEST_CANCELLED':'REQUEST_NETWORK_ERROR',xhr.statusText==='abort',{...info,status:xhr.status,duration:Math.round(performance.now()-info.at),reason:xhr.status===200?'parse_error':'http_or_network'});});
        $(document.body).on('checkout_error.ctwpmlRecovery',()=>checkpoint('WOO_CHECKOUT_ERROR',false));
        $(document.body).on('updated_checkout.ctwpmlRecovery',()=>{checkpoint('CHECKOUT_CONTEXT_UPDATED');clearTimeout(timer);timer=setTimeout(flush,500);});
    }
    window.addEventListener('error',event=>{
        const source=(event.filename||'').split('/').pop().split('?')[0];
        checkpoint('JAVASCRIPT_ERROR',false,{source:technical(source)||'unknown',reason:/not a function/.test(event.message||'')?'not_a_function':/Cannot read|Cannot set/.test(event.message||'')?'null_reference':'runtime_error',line:event.lineno||0,column:event.colno||0});
    });
    window.addEventListener('unhandledrejection',()=>checkpoint('PROMISE_ERROR',false,{reason:'unhandled_rejection'}));
    document.addEventListener('click',event=>{
        const el=event.target.closest('button,a,input[type="radio"],input[type="checkbox"]');if(!el)return;
        const id=technical(el.id)||'control';
        if(/review-confirm|place_order/.test(id))stage='confirm';
        else if(/payment|pix/.test(id))stage='payment';
        else if(/shipping/.test(id))stage='shipping';
        checkpoint('CONTROL_CLICK',true,{field:id,stage});
        if(el.tagName==='A'&&el.href)checkpoint('NAVIGATION_CLICK',true,{navigation:routeKind(el.href),field:id});
    },true);
    document.addEventListener('focusout',event=>{
        if(event.target.matches?.('#ctwpml-early-email,#ctwpml-input-nome,#ctwpml-input-email,#ctwpml-input-fone,#billing_email,#billing_phone,#billing_first_name')){
            checkpoint('CONTACT_UPDATED');clearTimeout(timer);timer=setTimeout(flush,500);
        }
    },true);
    document.addEventListener('submit',event=>{if(event.target.matches('form.checkout,form.woocommerce-checkout')){stage='submit';bindForm();checkpoint('WOO_FORM_SUBMIT');}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)beacon('PAGE_HIDDEN',{hidden:true,online:navigator.onLine});else checkpoint('PAGE_VISIBLE',true,{hidden:false,online:navigator.onLine});});
    window.addEventListener('pagehide',event=>beacon('PAGE_EXIT',{persisted:event.persisted,stage,online:navigator.onLine}));
    window.addEventListener('online',()=>{checkpoint('NETWORK_ONLINE');flush();});
    window.addEventListener('offline',()=>checkpoint('NETWORK_ERROR',false,{online:false}));
    window.addEventListener('popstate',()=>checkpoint('NAVIGATION_BACK',true,{navigation:routeKind(location.href)}));
    function ready(){
        checkpoint('PAGE_STARTED',true,{navigation:routeKind(location.href),width:innerWidth,height:innerHeight});
        new MutationObserver(bindForm).observe(document.documentElement,{childList:true,subtree:true});
        flush();
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
