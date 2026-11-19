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
 assert.equal(d.querySelector('.tracking-accessible-confirm'),null);
 const slide=d.querySelector('#tracking-slide');slide.getBoundingClientRect=()=>({left:0,width:300});
 const pointer=(type,x)=>{const e=new w.Event(type);Object.defineProperties(e,{clientX:{value:x},pointerId:{value:1}});slide.dispatchEvent(e);};
 // Um toque no fim do controle não pode confirmar, nem change programático isolado.
 pointer('pointerdown',290);slide.value=100;pointer('pointerup',290);assert.equal(slide.value,'0');assert.equal(calls.includes('confirm'),false);
 pointer('pointerdown',10);slide.value=100;pointer('pointerup',70);assert.equal(slide.value,'0');assert.equal(calls.includes('confirm'),false);
 pointer('pointerdown',10);slide.value=100;pointer('pointerup',280);await wait(()=>d.body.textContent.includes('Recebimento confirmado'));
 assert.equal(calls.filter(c=>c==='confirm').length,1);
});

test('mobile isolates page zoom, draws calculated paths and frames the origin region',async t=>{
 const dom=new JSDOM('<main id="ppwoo-tracking"><p class="tracking-status"></p></main><script id="ppwoo-tracking-script" data-endpoint="/ajax"></script>',{url:'https://shop.example.test/entrega/#pedido=201',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,d=w.document;w.matchMedia=()=>({matches:true});
 const lines=[],circles=[],markers=[];let options,unions=0;
 w.google={maps:{Map:class{constructor(element,opts){options=opts;}fitBounds(){}getZoom(){return 13;}},
  LatLngBounds:class{extend(){}union(){unions++;}},Circle:class{constructor(opts){circles.push(opts);}getBounds(){return {};}},
  Marker:class{constructor(opts){markers.push(opts);}},Polyline:class{constructor(opts){lines.push(opts);}},SymbolPath:{CIRCLE:0},event:{addListenerOnce(map,event,fn){fn();}}}};
 const path=[{lat:-23.6,lng:-46.5},{lat:-23.62,lng:-46.51},{lat:-23.63,lng:-46.49}];
 const data={number:'201',route:1,position:1,total:2,last:false,code:'',departed_at:new Date().toISOString(),eta_at:new Date().toISOString(),expires_at:new Date().toISOString(),address:'Rua fictícia',tracking_link:'',driver_whatsapp:'',maps_key:'fixture',map:{points:[{position:1,own:true,lat:-23.63,lng:-46.49}],paths:[path],origin:{lat:-23.5,lng:-46.8}}};
 w.fetch=async()=>({ok:true,json:async()=>({success:true,data})});
 w.eval(readFileSync('packing-panel-woo-dev/assets/js/order-tracking.js','utf8'));
 for(let i=0;i<60&&!lines.length;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(options.gestureHandling,'greedy');assert.deepEqual(JSON.parse(JSON.stringify(lines[0].path)),path);
 assert.equal(lines[0].strokeOpacity,.85);assert.equal(unions,1);assert.equal(circles[0].radius,10000);
 assert.ok(markers.some(m=>m.label.text==='Região de saída'&&m.icon.scale===0),'origin is a named region without a pin');
 const pinch=new w.Event('gesturechange',{cancelable:true});d.dispatchEvent(pinch);assert.equal(pinch.defaultPrevented,true);
 const touch=new w.Event('touchmove',{cancelable:true,bubbles:true});Object.defineProperty(touch,'touches',{value:[{},{}]});d.querySelector('.tracking-content').dispatchEvent(touch);assert.equal(touch.defaultPrevented,true);
 assert.equal(d.querySelector('.tracking-accessible-confirm'),null);
});
