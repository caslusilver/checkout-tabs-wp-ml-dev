/* Configurações administrativas e aviso público. Nenhuma chamada a serviços externos. */
(() => {
    'use strict';
    const cfg = window.CTWPML_DISPATCH;
    if (!cfg) return;
    const $ = window.jQuery;
    const node = (tag, text, attrs = {}) => { const el = document.createElement(tag); if (text != null) el.textContent = text; Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el; };
    let publicData = null, publicAt = 0, publicRequest = null;
    async function request(action, data = {}) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(cfg.url, {method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
                body:new URLSearchParams({action,...data})});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.data?.message || 'Não foi possível atualizar. Tente novamente.');
            return result.data;
        } finally { clearTimeout(timer); }
    }
    async function publicState(force = false) {
        if (!force && publicData && Date.now()-publicAt < 15000) return publicData;
        if (publicRequest) return publicRequest;
        publicRequest = request('ctwpml_dispatch_public').then(data => { publicData=data;publicAt=Date.now();renderBanners();return data; }).finally(()=>{publicRequest=null;});
        return publicRequest;
    }
    function renderBanners() {
        if (!publicData) return;
        document.querySelectorAll('.ctwpml-dispatch-banner').forEach(banner => {
            banner.querySelector('[data-dispatch-message]').textContent=publicData.message;
            banner.style.setProperty('--dispatch-dot',publicData.color);banner.classList.toggle('is-pulsing',publicData.pulse);
        });
        document.querySelector('.painel-empacotamento')?.dispatchEvent(new CustomEvent('ctwpml:dispatch-state',{detail:publicData}));
    }
    function dialog(title) {
        const box=node('dialog',null,{class:'ctwpml-dispatch-dialog','aria-label':title});
        const head=node('header'),close=node('button','×',{type:'button','aria-label':'Fechar'}),body=node('div',null,{class:'dispatch-body'}),status=node('p','',{class:'dispatch-status',role:'status'});
        head.append(node('h2',title),close);box.append(head,body,status);document.body.append(box);
        const previous=document.activeElement;
        const dismiss=()=>{box.close();box.remove();previous?.focus();};close.onclick=dismiss;
        box.addEventListener('cancel',e=>{e.preventDefault();dismiss();});box.showModal();
        return {box,body,status,dismiss,close};
    }
    function notice(data) {
        return new Promise(resolve=>{
            const ui=dialog('Envio por motoboy');ui.body.append(node('p',data.warning));
            const footer=node('footer'),back=node('button','Voltar',{type:'button'}),ok=node('button','Entendi, continuar',{type:'button',class:'primary'});
            let done=false;const finish=value=>{if(done)return;done=true;ui.dismiss();resolve(value);};
            ui.close.onclick=()=>finish(false);ui.box.addEventListener('cancel',()=>{if(!done){done=true;resolve(false);}});
            back.onclick=()=>finish(false);ok.onclick=()=>finish(true);footer.append(back,ok);ui.box.append(footer);
        });
    }
    let acceptance = '', accepting = null, passOnce = false;
    try { acceptance=sessionStorage.getItem('ctwpml-dispatch-accepted')||''; } catch (_) {}
    const chosenMotoboy=()=>{
        const selected=document.querySelector('.ctwpml-shipping-option.is-selected');
        const method=selected?.dataset.methodId || document.querySelector('input[name^="shipping_method"]:checked, input[type=hidden][name^="shipping_method"]')?.value || '';
        return method==='flat_rate:3'||/motoboy/i.test(method);
    };
    async function ensureAccepted(force=true) {
        if (!chosenMotoboy()) return true;
        if (accepting) return accepting;
        accepting=(async()=>{
            const data=await publicState(force);
            if (!data.closed) {acceptance='';syncAck();return true;}
            if (acceptance!==data.signature) {if (!await notice(data)) return false;acceptance=data.signature;syncAck();}
            else syncAck();
            return true;
        })().finally(()=>{accepting=null;});return accepting;
    }
    function syncAck(){try{sessionStorage.setItem('ctwpml-dispatch-accepted',acceptance);}catch(_){}document.querySelectorAll('form.checkout, form.woocommerce-checkout').forEach(form=>{
        let input=form.querySelector('[name=ctwpml_dispatch_ack]');if(!input){input=node('input',null,{type:'hidden',name:'ctwpml_dispatch_ack'});form.append(input);}input.value=acceptance;
    });}
    window.CTWPMLDispatch={ensureAccepted,prepareSubmit:async()=>{const ok=await ensureAccepted(true);if(ok)passOnce=true;return ok;}};
    function bindCheckout(){
        if (!$) return;
        $('form.checkout, form.woocommerce-checkout').off('checkout_place_order.ctDispatch').on('checkout_place_order.ctDispatch',function(){
            if (!chosenMotoboy()) return;
            if(passOnce){passOnce=false;return;}
            const form=this;
            ensureAccepted(true).then(ok=>{if(ok){passOnce=true;$(form).trigger('submit');}else $(document.body).trigger('checkout_error');}).catch(()=>{ $(document.body).trigger('checkout_error');window.alert('Não foi possível conferir o horário de envio. Confira a conexão e tente novamente.');});
            return false;
        });syncAck();
    }
    function panel() {
        const root=document.querySelector('.painel-empacotamento');if(!root)return;
        const privateCfg=window.CTWPML_DISPATCH_PANEL;
        let admin=null,draft=null,view='today',modal=null,mutating=false,closing=false;
        const sessionKey='ctwpml-panel-reload:'+ (privateCfg?.scope||'')+':'+location.pathname;
        let resume=null;try{const data=JSON.parse(sessionStorage.getItem(sessionKey));if(data&&Date.now()-data.at<30*60000)resume=data;sessionStorage.removeItem(sessionKey);}catch(_){}
        const status=message=>{const el=root.querySelector('.ppwoo-refresh-status');if(el)el.textContent=message;};
        const command=async(payload)=>request('ctwpml_dispatch_settings',{nonce:privateCfg.nonce,payload:JSON.stringify(payload)});
        const paint=()=>{const state=admin?.public;if(!state)return;root.querySelectorAll('[data-dispatch-toggle]').forEach(b=>{b.setAttribute('aria-checked',String(!state.closed));b.querySelector('small').textContent=state.closed?'Fechado hoje':'Programado';b.disabled=mutating;});};
        async function toggle(){if(mutating||!privateCfg)return;mutating=true;paint();try{if(!admin)admin=await command({command:'read'});admin=await command({command:'toggle',revision:admin.revision,open:admin.public.closed});if(draft)draft.revision=admin.revision;publicData=admin.public;publicAt=Date.now();renderBanners();paint();status(admin.public.closed?'Novos envios encerrados hoje. Pedidos anteriores mantidos.':'Envios reabertos.');}catch(e){status(e.message);}finally{mutating=false;paint();}}
        function button(label,fn,primary=false){const b=node('button',label,{type:'button',...(primary?{class:'primary'}:{})});b.onclick=fn;return b;}
        function renderSettings(){
            if(!modal)return;const {body,status:msg}=modal;body.replaceChildren();
            const nav=node('nav',null,{class:'dispatch-nav'});[['today','Hoje'],['week','Semana'],['banner','Aviso no site']].forEach(([id,label])=>nav.append(button(label,()=>{view=id;renderSettings();})));Array.from(nav.children).forEach((b,i)=>b.setAttribute('aria-selected',String(['today','week','banner'][i]===view)));body.append(nav);
            const days={mon:'Segunda',tue:'Terça',wed:'Quarta',thu:'Quinta',fri:'Sexta',sat:'Sábado',sun:'Domingo'};
            const today=['sun','mon','tue','wed','thu','fri','sat'][new Date(admin.public.day+'T12:00:00').getDay()];
            function editTime(day,old=null){
                const editor=node('section'),row=node('div',null,{class:'dispatch-row'}),hour=node('select',null,{'aria-label':'Hora'}),minute=node('select',null,{'aria-label':'Minuto'});
                for(let i=0;i<24;i++)hour.add(new Option(String(i).padStart(2,'0'),String(i).padStart(2,'0')));for(let i=0;i<60;i++)minute.add(new Option(String(i).padStart(2,'0'),String(i).padStart(2,'0')));
                [hour.value,minute.value]=(old||'15:00').split(':');row.append(hour,minute,button(old?'Aplicar':'Adicionar',()=>{draft.schedule[day]=[...new Set((draft.schedule[day]||[]).filter(t=>t!==old).concat(hour.value+':'+minute.value))].sort();renderSettings();},true));
                if(old)row.append(button('Remover',()=>{draft.schedule[day]=draft.schedule[day].filter(t=>t!==old);renderSettings();}));row.append(button('Cancelar',()=>editor.remove()));editor.append(row);body.append(editor);hour.focus();
            }
            if(view==='banner'){
                let active='banner_open';
                [['banner_open','Mensagem com envios ativos'],['banner_closed','Mensagem ao fechar hoje']].forEach(([key,label])=>{const wrap=node('label',label),input=node('textarea',draft[key],{rows:'3',maxlength:'500'});input.onfocus=()=>{active=key;};input.oninput=()=>{draft[key]=input.value;};input.dataset.bannerField=key;wrap.append(input);body.append(wrap);});
                const tokens=node('div',null,{class:'dispatch-chips'});['proxima_saida','proximo_horario','proxima_data','horarios_hoje','status_motoboy'].forEach(key=>tokens.append(button('{'+key+'}',()=>{const input=body.querySelector('[data-banner-field='+active+']');input.setRangeText('{'+key+'}',input.selectionStart,input.selectionEnd,'end');draft[active]=input.value;input.focus();})));body.append(tokens);
                const row=node('div',null,{class:'dispatch-row'});[['color_open','Cor com envios'],['color_closed','Cor ao fechar']].forEach(([key,label])=>{const wrap=node('label',label),input=node('input',null,{type:'color',value:draft[key]});input.oninput=()=>{draft[key]=input.value;};wrap.append(input);row.append(wrap);});body.append(row);
                const pulse=node('label','Bolinha pulsando'),check=node('input',null,{type:'checkbox'});check.checked=draft.pulse;check.onchange=()=>{draft.pulse=check.checked;};pulse.prepend(check);body.append(pulse,node('code','[ppwoo_aviso_envio]'),button('Copiar shortcode',async()=>{try{await navigator.clipboard.writeText('[ppwoo_aviso_envio]');msg.textContent='Shortcode copiado.';}catch(_){msg.textContent='Selecione e copie: [ppwoo_aviso_envio]';}}));
            }else{
                body.append(node('p','Fuso: '+admin.public.timezone+' · próxima saída '+admin.public.next_label));
                Object.entries(days).filter(([key])=>view==='week'||key===today).forEach(([day,label])=>{const row=node('div',null,{class:'dispatch-day'}),wrap=node('label',label),check=node('input',null,{type:'checkbox'});check.checked=!!draft.schedule[day]?.length;check.onchange=()=>{draft.schedule[day]=check.checked?['15:00']:[];renderSettings();};wrap.prepend(check);const chips=node('div',null,{class:'dispatch-chips'});(draft.schedule[day]||[]).forEach(time=>chips.append(button(time,()=>editTime(day,time))));chips.append(button('+ Saída',()=>editTime(day)));row.append(wrap,chips);body.append(row);});
                if(view==='today')body.append(button(admin.public.closed?'Reabrir hoje':'Encerrar envios de hoje',async()=>{await toggle();if(!mutating)renderSettings();}));
                const basis=node('label','Referência para envio'),select=node('select');select.add(new Option('Quando o pedido foi criado','created'));select.add(new Option('Quando o pagamento foi confirmado','paid'));select.value=draft.basis;select.onchange=()=>{draft.basis=select.value;};basis.append(select);
                const grace=node('label','Tolerância após saída (minutos)'),input=node('input',null,{type:'number',min:'0',max:'1440',step:'1',value:draft.grace});input.oninput=()=>{draft.grace=Number(input.value);};grace.append(input);body.append(basis,grace);
            }
        }
        async function settings(){if(modal||!privateCfg)return;try{const current=await command({command:'read'});admin=current;draft=resume?.settings?.draft||structuredClone(current);view=resume?.settings?.view||'today';resume=null;modal=dialog('Configurações de envio');
            const oldDismiss=modal.dismiss;modal.dismiss=()=>{oldDismiss();modal=null;};modal.box.addEventListener('close',event=>{if(modal?.box===event.target)modal=null;});modal.close.onclick=()=>modal?.dismiss();const footer=node('footer');footer.append(button('Recarregar página',reload),button('Salvar alterações',async()=>{if(mutating)return;const ui=modal;if(ui.body.querySelector('select[aria-label=Hora]')){ui.status.textContent='Aplique ou cancele o horário em edição antes de salvar.';return;}mutating=true;ui.status.textContent='Salvando…';try{admin=await command({...draft,command:'save',revision:draft.revision});publicData=admin.public;publicAt=Date.now();renderBanners();paint();ui.dismiss();status('Configurações salvas.');}catch(e){ui.status.textContent=e.message;}finally{mutating=false;paint();}},true));modal.box.append(footer);renderSettings();paint();}catch(e){status(e.message);}}
        function captureFields(){const result={};root.querySelectorAll('#tab-motoboy .motoboy-order').forEach(card=>{const fields=[];card.querySelectorAll('input,textarea,select').forEach((f,i)=>{if(f.type==='hidden'||f.type==='password'||f.readOnly||f.type==='range')return;fields.push({i,value:f.value,checked:f.checked});});result[card.dataset.orderId]=fields;});return result;}
        function restoreFields(data){Object.entries(data||{}).forEach(([id,fields])=>{const card=Array.from(root.querySelectorAll('.motoboy-order')).find(n=>n.dataset.orderId===id);if(!card)return;const inputs=card.querySelectorAll('input,textarea,select');fields.forEach(f=>{const input=inputs[f.i];if(input&&input.type!=='hidden'&&input.type!=='password'&&input.type!=='range'){input.value=f.value;input.checked=f.checked;}});});}
        async function reload(){
            if(closing||mutating)return;closing=true;
            try{
                if(root.querySelector('.is-refreshing,.is-dragging')||root.classList.contains('ppwoo-routes-busy'))throw new Error('Aguarde a operação em andamento antes de recarregar.');
                if(window.PPWOOReloadPanel&&!window.PPWOOReloadPanel.canReload())throw new Error('Aguarde a operação em andamento antes de recarregar.');
                if(modal?.body.querySelector('select[aria-label=Hora]'))throw new Error('Aplique ou cancele o horário em edição antes de recarregar.');
                const routes=window.PPWOOReloadRoutes ? await window.PPWOOReloadRoutes.prepare():null;
                const payload={at:Date.now(),fields:captureFields(),panel:window.PPWOOReloadPanel?.capture(),tab:root.querySelector('.tab-content.active')?.id,routes,
                    settings:modal?{draft,view}:null};sessionStorage.setItem(sessionKey,JSON.stringify(payload));
                status('Recarregando a página…');window.PPWOOReloadApproved=true;location.reload();
            }catch(e){closing=false;status(e.message||'Não foi possível preservar os campos. A página não foi recarregada.');if(modal)modal.status.textContent=e.message;}
        }
        root.querySelector('[data-dispatch-settings]')?.addEventListener('click',settings);root.querySelector('[data-dispatch-toggle]')?.addEventListener('click',toggle);
        root.addEventListener('ctwpml:dispatch-state',event=>{if(admin){admin.public=event.detail;paint();}});
        const pull=root.querySelector('[data-panel-pull]');let start=null,amount=0;
        if(pull){pull.addEventListener('pointerdown',e=>{if(window.scrollY>4||e.button>0)return;start={id:e.pointerId,y:e.clientY};amount=0;pull.setPointerCapture?.(e.pointerId);});pull.addEventListener('pointermove',e=>{if(!start||start.id!==e.pointerId)return;amount=Math.max(0,Math.min(100,(e.clientY-start.y)/1.05));pull.querySelector('progress').value=amount;pull.querySelector('[data-pull-label]').textContent=amount>=80?'Solte para recarregar':'Puxe para recarregar a página';});const reset=()=>{start=null;amount=0;pull.querySelector('progress').value=0;pull.querySelector('[data-pull-label]').textContent='Puxe para recarregar a página';};pull.addEventListener('pointerup',()=>{const ready=!!start&&amount>=80;reset();if(ready)reload();});pull.addEventListener('pointercancel',reset);}
        if(privateCfg&&root.querySelector('[data-dispatch-settings]'))command({command:'read'}).then(data=>{admin=data;paint();}).catch(e=>status(e.message));
        if(resume){const old=resume;restoreFields(old.fields);if(old.tab)$?.(root).find('.tab-button[data-tab="'+old.tab.replace('tab-','')+'"]').trigger('click');if(old.panel){if(window.PPWOOReloadPanel)window.PPWOOReloadPanel.restore(old.panel);else root.addEventListener('ppwoo:panel-reload-ready',()=>window.PPWOOReloadPanel.restore(old.panel),{once:true});}const data=old.routes;if(data){if(window.PPWOOReloadRoutes)window.PPWOOReloadRoutes.restore(data);else root.addEventListener('ppwoo:reload-ready',()=>window.PPWOOReloadRoutes.restore(data),{once:true});}if(old.settings)settings();}
    }
    function init(){
        panel();bindCheckout();
        if($){$(document.body).on('updated_checkout',bindCheckout).on('ctwpml_shipping_selected',()=>{if(chosenMotoboy())ensureAccepted().catch(()=>{});});}
        if(document.querySelector('.ctwpml-dispatch-banner,.painel-empacotamento')){publicState().catch(()=>{});setInterval(()=>{if(!document.hidden)publicState().catch(()=>{});},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)publicState(true).catch(()=>{});});}
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
