const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {readFileSync}=require('node:fs');
test('Central keeps one approved link, fills dispatched data and confirms only a full gesture',async t=>{
 const dom=new JSDOM('<main id="ppwoo-tracking"><p class="tracking-status"></p></main><script id="ppwoo-tracking-script" data-endpoint="/ajax"></script>',{url:'https://shop.example.test/entrega/#pedido=201&acesso='+ 'a'.repeat(64),runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,d=w.document;const calls=[];let dispatched=false;
 const data={number:'201',route:2,position:1,total:2,last:false,code:'',departed_at:new Date().toISOString(),eta_at:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),address:'Rua fictícia',final_area:'Bairro final',driver_whatsapp:'https://wa.me/5511999998888',tracking_link:'https://uber.example.test/ride',map:{points:[]},maps_key:''};
 w.fetch=async (url,options)=>{const command=options.body.get('command');calls.push(command);return {ok:true,json:async()=>({success:true,data:command==='confirm'?{confirmed:true}:dispatched?data:{preparing:true,number:'201'}})};};
 w.eval(readFileSync('packing-panel-woo-dev/assets/js/order-tracking.js','utf8'));
 const wait=async predicate=>{for(let i=0;i<60&&!predicate();i++)await new Promise(r=>setTimeout(r,5));assert.ok(predicate());};
 await wait(()=>d.body.textContent.includes('preparando'));
 assert.equal(w.location.hash,'#pedido=201');assert.deepEqual(calls,['exchange']);assert.equal(d.querySelector('#tracking-slide'),null);
 dispatched=true;d.dispatchEvent(new w.Event('visibilitychange'));await wait(()=>d.querySelector('#tracking-slide'));
 assert.equal(calls[1],'read');assert.equal(d.querySelector('.tracking-code').hidden,true);assert.equal(d.querySelector('.tracking-link').target,'_blank');
 const slide=d.querySelector('#tracking-slide');slide.value=40;slide.dispatchEvent(new w.Event('change'));assert.equal(slide.value,'0');assert.equal(calls.includes('confirm'),false);
 slide.value=100;slide.dispatchEvent(new w.Event('change'));await wait(()=>d.body.textContent.includes('Recebimento confirmado'));
 assert.equal(calls.filter(c=>c==='confirm').length,1);
});
