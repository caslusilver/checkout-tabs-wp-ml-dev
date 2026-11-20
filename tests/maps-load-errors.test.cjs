const{test}=require('node:test');const assert=require('node:assert/strict');const{JSDOM}=require('jsdom');const jquery=require('jquery');const{readFileSync}=require('node:fs');
for(const reason of ['auth','network','timeout'])test('Maps '+reason+' is reported without conflating it with a payment/key failure',async t=>{
 const{window:w}=new JSDOM('<div class="painel-empacotamento"><div id="tab-rotas" class="tab-content active"><div data-routes-preview></div><div data-routes-drafts></div></div><div id="tab-em-rota"><div data-routes-active></div><div data-routes-history-list></div></div></div>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://shop.example.test/painel/'});t.after(()=>w.close());
 const $=w.jQuery=jquery(w);$.expr.pseudos.visible=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>null;
 let timeout;const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(callback,ms,...args)=>{if(ms===12000)timeout=callback;return nativeTimeout(callback,ms,...args);};
 const origin={lat:-23.5,lng:-46.6};const calc={token:'fixture',origin,path:[origin,{lat:-23.6,lng:-46.7}],distance_meters:1000,duration_seconds:120,issues:[],destination_order_id:1,stops:[{order_id:1,location:{lat:-23.6,lng:-46.7},eta_seconds:120}]};
 const route={id:7,slot:1,state:'dispatched',revision:1,stops:[{id:1,number:'1',name:'Fixture',phone:'',position:1,delivery_state:'on_route',event_state:'accepted'}],calculation:calc,trip:{}};
 w.PPWOO={ajax_url:'/ajax',nonce:'fixture'};w.PPWOO_ROUTES={maps_key:'fixture-browser-key',max_batch:100};$.ajax=async()=>({success:true,data:{routes:[route]}});
 w.eval(readFileSync('packing-panel-woo-dev/assets/js/routes.js','utf8'));
 for(let i=0;i<100&&!w.gm_authFailure;i++)await new Promise(r=>setTimeout(r,5));assert.equal(typeof w.gm_authFailure,'function');
 if(reason==='auth')w.gm_authFailure();else if(reason==='network')w.document.querySelector('script[src*="maps.googleapis.com"]').onerror();else timeout();
 for(let i=0;i<100&&!w.document.querySelector('.ppwoo-map-notice');i++)await new Promise(r=>setTimeout(r,5));
 const text=w.document.querySelector('.ppwoo-map-notice').textContent;
 assert.match(text,reason==='auth'?/Google recusou a chave/:reason==='timeout'?/demorou para carregar/:/conexão ou bloqueios/);
 if(reason!=='auth')assert.doesNotMatch(text,/recusou a chave/);
});
