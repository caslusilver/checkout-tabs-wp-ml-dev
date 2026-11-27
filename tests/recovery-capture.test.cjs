const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{JSDOM}=require('jsdom');
const source=readFileSync('assets/js/recovery-capture.js','utf8');
const until=async check=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());};
function setup(t,{checkout=true,saved=null,offline=false,defer=false,snapshot=null}={}){
 const dom=new JSDOM('<form class="checkout"><input id="ctwpml-input-nome" value="Fixture"><input id="ctwpml-input-email" value="fixture@example.test"><input id="ctwpml-phone-full" value="+5511999990000"><input type="password" value="private-password"><input id="billing_cpf" value="private-cpf"><button id="ctwpml-review-confirm" type="button">Confirmar</button></form>',{url:'https://shop.example.test/'+(checkout?'checkout/':''),runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,calls=[],pending=[];const nativeTimer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...a)=>nativeTimer(fn,Math.min(ms,15),...a);
 Object.defineProperty(w.navigator,'onLine',{value:!offline,configurable:true});
 w.ctwpmlRecoveryCapture={url:'/ajax',nonce:'fixture-public',version:'3.4.22',checkout};
 if(snapshot)w.CCCheckoutTabsState={desktopSnapshot:()=>snapshot};
 if(saved)w.sessionStorage.setItem('ctwpml_recovery_v1',JSON.stringify(saved));
 w.fetch=async(url,opts)=>{
  if(opts.body?.get?.('action')==='ctwpml_recovery_capture'){
   const batch=JSON.parse(opts.body.get('batch'));calls.push(batch);
   const result={ok:true,json:async()=>({success:true,data:{trace:'12345678-1234-1234-1234-123456789abc',proof:'fixture-write-only'}})};
   if(defer)return new Promise(resolve=>pending.push(()=>resolve(result)));
   return result;
  }
  return {ok:false,status:500,headers:{get:()=> 'application/json'},clone:()=>({json:async()=>({success:false,message:'private-message',token:'secret-token'})})};
 };
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return {w,calls,pending};
}
test('capture isolates contact from events and never captures typed password/CPF/payment data',async t=>{
 const c=setup(t);await until(()=>c.calls.length&&c.w.document.querySelector('[name="ctwpml_recovery_trace"]'));
 c.w.CTWPMLRecovery.checkpoint('CHK_RUNTIME_ERROR',false,{email:'private-log-email',password:'private-password',payload_pix:'private-pix',request:'bad',nonce:'secret',status:500});
 await until(()=>c.calls.some(b=>b.events.some(e=>e.name==='CHK_RUNTIME_ERROR')));
 const batch=c.calls.find(b=>b.events.some(e=>e.name==='CHK_RUNTIME_ERROR'));assert.equal(batch.contact.email,'fixture@example.test');
 const events=JSON.stringify(batch.events);for(const secret of ['private-log-email','private-password','private-pix','private-cpf','secret'])assert.equal(events.includes(secret),false);
 assert.ok(batch.events.every(e=>e.key));assert.ok(c.calls[0].device.width>0);assert.equal(c.w.document.querySelector('input[type=password]').value,'private-password');
});
test('slow observation does not stop checkout or overwrite fields; replaced Woo form retains correlation',async t=>{
 const c=setup(t,{defer:true});await until(()=>c.pending.length>0);let clicked=0;c.w.document.querySelector('button').addEventListener('click',()=>clicked++);
 c.w.document.querySelector('button').click();assert.equal(clicked,1);assert.equal(c.w.document.querySelector('input[type=password]').value,'private-password');
 c.pending.shift()();await until(()=>c.w.document.querySelector('[name="ctwpml_recovery_trace"]'));
 c.w.document.querySelector('form').outerHTML='<form class="checkout"><input id="fixture-kept" value="edited"></form>';
 await until(()=>c.w.document.querySelector('[name="ctwpml_recovery_proof"]'));assert.equal(c.w.document.querySelector('#fixture-kept').value,'edited');
});
test('home observes only a prior attempt landing, and never starts visitor tracking or sends contact',async t=>{
 const a=setup(t,{checkout:false});await new Promise(r=>setTimeout(r,25));assert.equal(a.calls.length,0);
 const b=setup(t,{checkout:false,saved:{trace:'prior',proof:'scoped',page:'prior-page',at:Date.now()}});await until(()=>b.calls.length===1);
 assert.equal(b.calls[0].operation,'append');assert.equal(b.calls[0].events[0].detail.navigation,'home');assert.equal(b.calls[0].contact,undefined);
});
test('readiness is not an error; network failure is correlated without raw response content',async t=>{
 const c=setup(t);await until(()=>c.calls.length);
 c.w.CTWPMLRecovery.checkpoint('CHK_REVIEW_GATE_BILLING_READY',false,{billingReady:false});
 const req=new c.w.URLSearchParams({action:'ctwpml_login',password:'private-password'});
 const response=await c.w.fetch('/ajax',{method:'POST',body:req});assert.equal(response.status,500);
 await until(()=>c.calls.some(b=>b.events.some(e=>e.name==='REQUEST_REJECTED')));
 const all=c.calls.flatMap(b=>b.events);assert.equal(all.find(e=>e.name==='CHK_REVIEW_GATE_BILLING_READY').ok,true);
 const rejected=all.find(e=>e.name==='REQUEST_REJECTED');assert.equal(rejected.ok,false);assert.equal(rejected.detail.action,'ctwpml_login');assert.ok(rejected.detail.request);
 assert.equal(JSON.stringify(all).includes('private-message'),false);assert.equal(JSON.stringify(all).includes('secret-token'),false);
});
test('offline capture leaves the form usable and resumes when connection returns',async t=>{
 const c=setup(t,{offline:true});await new Promise(r=>setTimeout(r,25));assert.equal(c.calls.length,0);
 c.w.document.querySelector('button').click();assert.equal(c.w.document.querySelector('button').disabled,false);
 Object.defineProperty(c.w.navigator,'onLine',{value:true});c.w.dispatchEvent(new c.w.Event('online'));await until(()=>c.calls.length>0);
});
test('origin comes from the checkout snapshot with empty Woo fields; selected IDs carry no client-side price',async t=>{
 const snap={address:{id:'address-a',city:'Cidade exemplo',state:'SP',neighborhood:'Bairro exemplo',cep:'01000-000'},shipping:{methodId:'flat_rate:3',label:'Motoboy',priceText:'R$ 0,01'}};
 const c=setup(t,{snapshot:snap});await until(()=>c.calls.length>0);
 const first=c.calls[0];assert.equal(first.contact.city,'Cidade exemplo');assert.equal(first.contact.region,'SP');assert.equal(first.contact.neighborhood,'Bairro exemplo');assert.equal(first.contact.postcode,'01000-000');
 assert.deepEqual(first.checkout,{address_id:'address-a',method_id:'flat_rate:3'});assert.equal(JSON.stringify(first.events).includes('Cidade exemplo'),false);assert.equal(JSON.stringify(first).includes('0,01'),false);
 snap.address={id:'address-b',city:'Outra cidade',state:'RJ',cep:'02000-000'};snap.shipping={methodId:'correios:9'};
 c.w.CTWPMLRecovery.checkpoint('CHK_SHIPPING_SET_APPLIED');await until(()=>c.calls.some(b=>b.checkout.address_id==='address-b'));
 const next=c.calls.find(b=>b.checkout.address_id==='address-b');assert.equal(next.contact.city,'Outra cidade');assert.equal(next.checkout.method_id,'correios:9');
});
