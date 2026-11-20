const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');const {JSDOM}=require('jsdom'),jquery=require('jquery');
const clone=value=>JSON.parse(JSON.stringify(value));
test('quick handoff cleans preview, preserves later edits, resends and finalizes once',async t=>{
 const orders=[801,802].map((id,i)=>({id,number:String(id),position:i+1,name:'Pessoa fictícia '+id,address:'Rua fictícia',address_display:'Rua fictícia',phone:'123456789',dial_code:'+33',whatsapp:'https://wa.me/33123456789',shipping_paid:50,currency:'BRL',cost:'',event_state:'waiting',delivery_state:'draft'}));
 const calculation={token:'fixture',expires_at:0,origin:{lat:-23.5,lng:-46.5},path:[{lat:-23.5,lng:-46.5},{lat:-23.6,lng:-46.6}],issues:[],stops:orders.map(o=>({order_id:o.id,eta_seconds:300,distance_meters:3000,location:{lat:-23.6,lng:-46.6}})),destination_order_id:802,distance_meters:3000,duration_seconds:600};
 const state={quick_enabled:true,routes:[{id:7,slot:2,revision:1,state:'draft',sheet:{phone:'',link:'',code:''},calculation,stops:orders}]};
 const dom=new JSDOM('<div class="painel-empacotamento"><nav class="painel-tabs"><button class="tab-button" data-tab="motoboy">Motoboy</button><button class="tab-button" data-tab="rotas">Rotas</button><button class="tab-button" data-tab="em-rota">Em rota</button></nav><div id="tab-motoboy" class="tab-content"><input data-select-motoboy-all type="checkbox"><button data-fold-all></button><button data-calculate-selected></button>'+orders.map(o=>'<article class="motoboy-order" data-order-id="'+o.id+'"><div class="ppwoo-fold-head"><input type="checkbox" class="ppwoo-route-pick"></div></article>').join('')+'</div><div id="tab-rotas" class="tab-content active"><p data-route-feedback></p><div data-routes-preview></div><div data-routes-drafts></div></div><div id="tab-em-rota" class="tab-content"><p data-route-feedback></p><div data-routes-active></div><div data-routes-history-list></div></div></div>',{url:'https://fixture.example.test/painel/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,d=w.document,$=w.$=w.jQuery=jquery(w);const calls=[],opened=[],polls=[];
 w.setInterval=fn=>{polls.push(fn);return polls.length;};w.open=(...args)=>{opened.push(args);return null;};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.PPWOO={ajax_url:'/ajax',nonce:'fixture',debug_enabled:false};w.PPWOO_ROUTES={maps_key:''};
 $.ajax=async options=>{const payload=JSON.parse(options.data.payload),command=payload.command;calls.push(payload);const r=state.routes[0];
  if(command==='save'){assert.equal(payload.revision,r.revision);r.sheet=payload.sheet;r.revision++;for(const o of r.stops)o.cost=payload.sheet.costs[o.id];}
  if(command==='handoff'){assert.equal(payload.revision,r.revision);if(r.state==='draft'){r.state='dispatched';r.departed_at='2026-11-20T18:00:00Z';r.quick_handoff=true;r.sheet_pending=true;r.can_undo_handoff=true;r.stops.forEach(o=>o.delivery_state='on_route');}r.sheet.phone=payload.phone;r.shared_phone=payload.phone.replace(/\D/g,'');r.trip={phone:payload.phone,whatsapp:'https://wa.me/55'+r.shared_phone};r.revision++;}
  if(command==='undo_handoff'){r.state='draft';delete r.departed_at;r.can_undo_handoff=false;r.stops.forEach(o=>o.delivery_state='draft');r.revision++;}
  if(command==='dispatch'){r.sheet_pending=false;r.sheet={};r.revision++;r.stops.forEach(o=>o.event_state='queued');}
  return {success:true,data:{...clone(state),...(command==='plan'?{calculation:clone(calculation),orders:clone(orders)}:{}),...(command==='handoff'?{driver_url:'https://driver.example.test/rota/#rota=7&acesso=fixture'}:{})}};
 };
 for(const script of ['panel.js','routes.js'])w.eval(readFileSync('packing-panel-woo-dev/assets/js/'+script,'utf8'));
 const until=async check=>{for(let i=0;i<150&&!check();i++)await new Promise(r=>setTimeout(r,10));assert.ok(check(),JSON.stringify({commands:calls.map(c=>c.command),feedback:Array.from(d.querySelectorAll('[data-route-feedback]')).map(n=>n.textContent),state:state.routes[0].state}));};
 const gesture=(selector,fraction,start=20)=>{const element=d.querySelector(selector);assert.ok(element);element.getBoundingClientRect=()=>({left:0,width:170});const event=(target,type,x)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{clientX:{value:x},pointerId:{value:1},button:{value:0}});target.dispatchEvent(e);};event(element,'pointerdown',start);event(d,'pointermove',start+112*fraction);event(d,'pointerup',start+112*fraction);};
 await until(()=>d.querySelector('[data-handoff-route]'));const first=d.querySelector('.ppwoo-sheet-later');assert.equal(first.open,true);assert.ok(first.querySelector('summary .dashicons:last-child'));
 $('.ppwoo-route-pick').prop('checked',true).trigger('change');$('[data-calculate-selected]').trigger('click');await until(()=>d.querySelector('[data-routes-preview]').textContent.includes('Prévia'));
 const phone=d.querySelector('[data-routes-drafts] [data-sheet-field="phone"]');phone.value='11999990101';$(phone).trigger('input');
 gesture('[data-handoff-route]',.74);assert.equal(calls.filter(c=>c.command==='handoff').length,0);
 gesture('[data-handoff-route]',.75);await until(()=>d.querySelector('[data-routes-active] [data-undo-handoff]'));
 assert.equal(opened.length,1);assert.equal(opened[0][1],'_blank');assert.match(decodeURIComponent(opened[0][0]),/rota=7/);
 assert.equal(d.querySelector('[data-routes-preview]').textContent.trim(),'');assert.equal(d.querySelector('[data-routes-drafts] [data-route-id]'),null);
 assert.equal(d.querySelector('[data-routes-active] [data-undo-handoff]').hidden,false);
 d.querySelector('dialog button').click();
 const active=d.querySelector('[data-routes-active] [data-sheet-field="phone"]');active.value='11999990102';$(active).trigger('input');
 await new Promise(r=>setTimeout(r,1150));
 assert.equal(state.routes[0].sheet.phone.replace(/\D/g,''),'11999990101','autosave does not replace the confirmed phone with an unshared correction');
 assert.equal(d.querySelector('[data-routes-active] [data-sheet-field="phone"]').value.replace(/\D/g,''),'11999990102');
 gesture('[data-routes-active] [data-handoff-route]',.75);await until(()=>opened.length===2);
 assert.equal(state.routes[0].departed_at,'2026-11-20T18:00:00Z');d.querySelector('dialog button').click();
 await until(()=>!d.querySelector('.painel-empacotamento').classList.contains('ppwoo-routes-busy'));
 const later=d.querySelector('[data-routes-active] .ppwoo-sheet-later');later.open=false;await new Promise(r=>setTimeout(r,10));
 const code=d.querySelector('[data-routes-active] [data-sheet-field="code"]');code.value='4321';code.focus();$(code).trigger('input');
 state.routes[0].revision++;polls.at(-1)();await new Promise(r=>setTimeout(r,25));assert.equal(d.activeElement,code);assert.equal(code.value,'4321');assert.equal(later.open,false);
 code.blur();for(const [key,value]of [['link','https://uber.example.test/ride'],['code','4321']]){const el=d.querySelector('[data-routes-active] [data-sheet-field="'+key+'"]');el.value=value;$(el).trigger('input');}
 $('[data-routes-active] [data-sheet-cost]').val('25').trigger('input');
 $('[data-routes-active] [data-dispatch-route]').trigger('ppwoo:slide-complete');await until(()=>calls.some(c=>c.command==='dispatch'));
 await until(()=>!d.querySelector('.painel-empacotamento').classList.contains('ppwoo-routes-busy'));
 assert.equal(calls.filter(c=>c.command==='dispatch').length,1);assert.equal(state.routes[0].sheet_pending,false);
 state.routes=[];polls.at(-1)();await new Promise(r=>setTimeout(r,25));
 assert.equal(d.querySelector('[data-routes-preview]').textContent.trim(),'','closed routes do not reappear in the old selection preview');
});
