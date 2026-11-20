// Browser real + código/CSS reais. Somente fixtures em memória; nenhum pedido ou contato real.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{join}=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:1100},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0;padding:8px;font-family:system-ui}button,input{font:inherit}.tab-content:not(.active){display:none}</style><div class="painel-empacotamento"><nav class="painel-tabs"><button class="tab-button" data-tab="motoboy">Motoboy</button><button class="tab-button" data-tab="rotas">Rotas</button><button class="tab-button" data-tab="em-rota">Em rota</button></nav><div id="tab-motoboy" class="tab-content"><button data-fold-all></button><input type="checkbox" data-select-motoboy-all><button data-calculate-selected></button></div><div id="tab-rotas" class="tab-content"><p data-route-feedback></p><div data-routes-preview></div><div data-routes-drafts></div></div><div id="tab-em-rota" class="tab-content"><p data-route-feedback></p><div data-routes-active></div><div data-routes-history-list></div></div><button class="ppwoo-swipe-action" id="payment-fixture" style="width:200px"><span class="ppwoo-swipe-label">Teste de pagamento</span><span class="ppwoo-swipe-thumb"></span></button></div>');
  for(const name of ['panel.css','routes.css'])await page.addStyleTag({content:readFileSync('packing-panel-woo-dev/assets/css/'+name,'utf8')});
  await page.addScriptTag({content:readFileSync(require.resolve('jquery'),'utf8')});
  await page.evaluate(()=>{
   const orders=[801,802].map((id,i)=>({id,number:String(id),position:i+1,name:'Cliente de demonstração',address:'Rua Exemplo, 120',address_display:'Rua Exemplo, 120',phone:'123456789',whatsapp:'https://wa.me/33123456789',currency:'BRL',shipping_paid:50,cost:'',delivery_state:'draft',event_state:'waiting'}));
   const calc={token:'fixture',expires_at:0,origin:{lat:-23.5,lng:-46.5},path:[{lat:-23.5,lng:-46.5},{lat:-23.6,lng:-46.6}],stops:orders.map(o=>({order_id:o.id,location:{lat:-23.6,lng:-46.6},eta_seconds:600})),issues:[],destination_order_id:802,duration_seconds:600,distance_meters:3000};
   window.fixtureState={quick_enabled:true,routes:[{id:7,slot:2,revision:1,state:'draft',calculation:calc,stops:orders,sheet:{phone:'11999990101',link:'',code:''}}]};window.fixtureCalls=[];window.opened=[];window.paymentEvents=0;
   window.open=(...args)=>{window.opened.push(args);return null;};window.PPWOO={ajax_url:'/ajax',nonce:'fixture',debug_enabled:false};window.PPWOO_ROUTES={maps_key:''};
   jQuery.ajax=async options=>{const p=JSON.parse(options.data.payload),r=window.fixtureState.routes[0];window.fixtureCalls.push(p.command);
    if(p.command==='save'){r.sheet=p.sheet;r.revision++;r.stops.forEach(o=>o.cost=p.sheet.costs[o.id]);}
    if(p.command==='handoff'){if(r.state==='draft'){r.state='dispatched';r.quick_handoff=true;r.sheet_pending=true;r.can_undo_handoff=true;r.departed_at='2026-11-20T18:00:00Z';r.stops.forEach(o=>o.delivery_state='on_route');}r.sheet.phone=p.phone;r.shared_phone=p.phone.replace(/\D/g,'');r.trip={phone:p.phone};r.revision++;}
    if(p.command==='undo_handoff'){r.state='draft';r.can_undo_handoff=false;delete r.departed_at;r.stops.forEach(o=>o.delivery_state='draft');r.revision++;}
    return {success:true,data:{...JSON.parse(JSON.stringify(window.fixtureState)),...(p.command==='handoff'?{driver_url:'https://driver.example.test/rota/#rota=7&acesso=fixture'}:{})}};
   };
   jQuery('#payment-fixture').on('ppwoo:slide-complete',()=>window.paymentEvents++);
  });
  for(const name of ['panel.js','routes.js'])await page.addScriptTag({content:readFileSync('packing-panel-woo-dev/assets/js/'+name,'utf8')});
  await page.waitForSelector('[data-handoff-route]',{state:'attached'});await page.click('[data-tab="rotas"]');
  await page.locator('[data-routes-drafts] details[data-route-id]').evaluate(el=>el.open=true);
  await page.waitForSelector('[data-handoff-route]');
  const slide=async(selector,fraction)=>{const control=page.locator(selector);await control.scrollIntoViewIfNeeded();const b=await control.boundingBox(),thumb=await control.locator('.ppwoo-swipe-thumb').boundingBox();const travel=b.width-thumb.width-8;await page.mouse.move(b.x+20,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+20+travel*fraction,b.y+b.height/2,{steps:14});await page.mouse.up();};
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:1100});const sizes=await page.locator('.ppwoo-handoff-grid').evaluate(el=>Array.from(el.children).map(c=>c.getBoundingClientRect().width));assert.ok(Math.abs(sizes[0]-sizes[1])<1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.setViewportSize({width:390,height:1100});assert.equal(await page.locator('.ppwoo-sheet-later').evaluate(el=>el.open),true);
  assert.equal(await page.locator('[data-dispatch-route]').isVisible(),false);
  await slide('[data-handoff-route]',.74);assert.equal(await page.evaluate(()=>fixtureCalls.includes('handoff')),false);
  await slide('[data-handoff-route]',.76);await page.waitForFunction(()=>window.opened.length===1);
  await page.click('dialog button');await page.waitForSelector('[data-routes-active] [data-undo-handoff]');
  assert.equal(await page.locator('[data-routes-active] [data-handoff-route]').isVisible(),false);
  assert.equal(await page.locator('[data-routes-active] [data-undo-handoff]').isVisible(),true);
  const dotColor=await page.locator('[data-routes-active] [data-undo-handoff]').evaluate(el=>getComputedStyle(el).color);assert.equal(dotColor,'rgb(20, 117, 60)');
  await page.fill('[data-routes-active] [data-sheet-field="phone"]','11999990102');await slide('[data-routes-active] [data-handoff-route]',.76);await page.waitForFunction(()=>window.opened.length===2);
  assert.equal(await page.evaluate(()=>fixtureState.routes[0].departed_at),'2026-11-20T18:00:00Z');await page.click('dialog button');
  assert.equal(await page.locator('[data-routes-active] [data-handoff-route]').isVisible(),false);
  assert.equal(await page.locator('[data-routes-active] [data-undo-handoff]').isVisible(),true);
  await page.locator('[data-routes-active] .ppwoo-sheet-later summary').click();assert.equal(await page.locator('[data-routes-active] .ppwoo-sheet-later').evaluate(el=>el.open),false);
  if(process.env.HANDOFF_QA_OUTPUT)await page.screenshot({path:join(process.env.HANDOFF_QA_OUTPUT,'quick-handoff-production-mobile.png'),fullPage:true});
  await page.click('[data-routes-active] [data-undo-handoff]');await page.waitForFunction(()=>fixtureState.routes[0].state==='draft');await page.waitForSelector('[data-routes-drafts] [data-handoff-route]');
  assert.equal(await page.locator('[data-routes-active] [data-route-id]').count(),0);assert.equal(await page.locator('[data-routes-drafts] .ppwoo-sheet-later').evaluate(el=>el.open),false);
  await slide('#payment-fixture',.8);assert.equal(await page.evaluate(()=>paymentEvents),0);await slide('#payment-fixture',.97);assert.equal(await page.evaluate(()=>paymentEvents),1);
  assert.deepEqual(errors,[]);console.log('Edge: retirada 50/50, estados, gesto curto, reenvio, desfazer, dados/recolhimento preservados e pagamento inalterado passaram.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
