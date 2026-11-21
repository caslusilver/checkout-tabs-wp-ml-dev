'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const jquery=require('jquery');
const source=readFileSync(require('node:path').join(__dirname,'../assets/js/dispatch-controls.js'),'utf8');
const wait=async(predicate)=>{for(let i=0;i<80&&!predicate();i++)await new Promise(r=>setTimeout(r,10));assert.ok(predicate(),'Expected UI state');};
function setup(t,html,handler,storage){
    const dom=new JSDOM(html,{url:'https://fixture.test/painel/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;t.after(()=>w.close());w.jQuery=jquery(w);w.structuredClone=structuredClone;
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
    w.CTWPML_DISPATCH={url:'/ajax'};w.CTWPML_DISPATCH_PANEL={nonce:'fixture',scope:'session-hash'};
    w.fetch=async(url,options)=>({ok:true,json:async()=>({success:true,data:await handler(Object.fromEntries(options.body))})});
    if(storage)Object.entries(storage).forEach(([key,value])=>w.sessionStorage.setItem(key,value));
    w.eval(source);return w;
}
const state={closed:true,signature:'closed-window',next_label:'amanhã, 22/11, às 15:00',message:'Envio amanhã',warning:'Sem envios hoje. Próxima saída amanhã.',color:'#c57b12',pulse:true,day:'2026-11-21',timezone:'America/Sao_Paulo'};
const settings=()=>({public:{...state},revision:'one',schedule:{sat:['15:00','18:00']},basis:'created',grace:5,banner_open:'Saída {proxima_saida}',banner_closed:'Fechado {proxima_saida}',color_open:'#16a34a',color_closed:'#c57b12',pulse:true});
test('Checkout closed notice: decline never loops, acknowledgement survives login and only motoboy is checked',async t=>{
    let calls=0;const w=setup(t,'<form class="checkout"><input type="radio" name="shipping_method[0]" value="flat_rate:3" checked></form>',async()=>{calls++;return {...state};});
    await wait(()=>w.CTWPMLDispatch);
    let result=w.CTWPMLDispatch.ensureAccepted();await wait(()=>w.document.querySelector('dialog'));
    [...w.document.querySelectorAll('dialog button')].find(b=>b.textContent==='Voltar').click();
    assert.equal(await result,false);w.jQuery(w.document.body).trigger('checkout_error');await new Promise(r=>setTimeout(r,20));
    assert.equal(w.document.querySelector('dialog'),null,'No confirmation loop on decline');
    result=w.CTWPMLDispatch.prepareSubmit();await wait(()=>w.document.querySelector('dialog'));
    [...w.document.querySelectorAll('dialog button')].find(b=>b.textContent==='Entendi, continuar').click();
    assert.equal(await result,true);assert.equal(w.document.querySelector('[name=ctwpml_dispatch_ack]').value,state.signature);
    const next=setup(t,'<form class="checkout"><input type="radio" name="shipping_method[0]" value="flat_rate:3" checked></form>',async()=>({...state}),{'ctwpml-dispatch-accepted':state.signature});
    assert.equal(await next.CTWPMLDispatch.ensureAccepted(),true);assert.equal(next.document.querySelector('dialog'),null);
    w.document.querySelector('input[type=radio]').value='flat_rate:2';const before=calls;
    assert.equal(await w.CTWPMLDispatch.ensureAccepted(),true);assert.equal(calls,before,'Correios does not ask for motoboy consent');
});
test('Panel config protects pending time edit, revision conflicts and unsafe reload; pull cancelled is inert',async t=>{
    const writes=[];let preparing=0;const w=setup(t,`<div class="painel-empacotamento"><span class="ppwoo-refresh-status"></span><button data-dispatch-settings>Configurações</button><button data-dispatch-toggle><small></small></button><div data-panel-pull><span data-pull-label></span><progress></progress></div><div id="tab-motoboy" class="tab-content active"><div class="motoboy-order" data-order-id="7"><input value="rascunho"></div></div></div>`,async p=>{
        if(p.action==='ctwpml_dispatch_public')return {...state};
        const input=JSON.parse(p.payload);if(input.command!=='read'){writes.push(input);if(input.command==='save')throw new Error('Os horários mudaram em outra aba.');}return settings();
    });
    w.PPWOOReloadRoutes={prepare:async()=>{preparing++;throw new Error('Ficha não salva.');}};
    await wait(()=>w.document.querySelector('[data-dispatch-toggle]').getAttribute('aria-checked')==='false');
    w.document.querySelector('[data-dispatch-settings]').click();await wait(()=>w.document.querySelector('dialog'));
    const button=text=>[...w.document.querySelectorAll('dialog button')].find(b=>b.textContent===text);
    button('+ Saída').click();w.document.querySelector('[aria-label=Hora]').value='12';w.document.querySelector('[aria-label=Minuto]').value='30';
    button('Salvar alterações').click();assert.equal(writes.length,0,'Unapplied editor blocks save instead of losing changes');
    button('Recarregar página').click();await wait(()=>w.document.querySelector('.dispatch-status').textContent.includes('Aplique'));assert.equal(preparing,0);
    button('Adicionar').click();button('Salvar alterações').click();await wait(()=>writes.length===1);
    assert.deepEqual(writes[0].schedule.sat,['12:30','15:00','18:00']);
    await wait(()=>w.document.querySelector('.dispatch-status').textContent.includes('outra aba'));
    assert.ok(button('12:30'),'Conflict keeps edited schedule');
    button('Recarregar página').click();await wait(()=>preparing===1);assert.ok(w.document.querySelector('dialog'),'Failed route save does not reload');
    const strip=w.document.querySelector('[data-panel-pull]');
    const pointer=(name,y)=>{const e=new w.Event(name);Object.assign(e,{pointerId:1,clientY:y,button:0});strip.dispatchEvent(e);};
    pointer('pointerdown',0);pointer('pointermove',100);pointer('pointercancel',100);pointer('pointerup',100);await new Promise(r=>setTimeout(r,20));
    assert.equal(preparing,1,'Cancelled pull never reloads');
    assert.equal(w.document.querySelector('.motoboy-order input').value,'rascunho');
});
test('Public banner shares one request, uses text only and revalidates cached HTML',async t=>{
    let calls=0;const w=setup(t,'<div class="ctwpml-dispatch-banner"><span data-dispatch-message>cache antigo</span></div><div class="ctwpml-dispatch-banner"><span data-dispatch-message></span></div>',async()=>{calls++;return {...state,message:'<img src=x onerror=alert(1)> Próximo envio amanhã'};});
    await wait(()=>calls===1&&w.document.querySelector('[data-dispatch-message]').textContent.includes('amanhã'));
    assert.equal(calls,1);assert.equal(w.document.querySelector('img'),null);assert.equal(w.document.querySelectorAll('.is-pulsing').length,2);
});
