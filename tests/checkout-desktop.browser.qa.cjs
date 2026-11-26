// DOM/CSS e renderizador reais; transporte Woo simulado, sem pedidos ou site de produção.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const read=path=>readFileSync(path,'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:read('assets/shield-lock.svg')}));
  await page.setContent('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="ctwpml-ml-open ctwpml-ml-open--root"><form class="checkout"><input id="terms" type="checkbox"></form><div id="ctwpml-root" class="ctwpml-root" style="width:350px"><div id="ctwpml-address-modal-overlay" class="ctwpml-modal-overlay ctwpml-modal-overlay--root" style="display:block"><div class="ctwpml-modal" role="dialog"><div class="ctwpml-modal-header"><button type="button" class="ctwpml-modal-back">Voltar</button><div class="ctwpml-modal-title">Confira sua compra</div></div><div class="ctwpml-modal-body"><div id="view"></div><input id="fixture-draft" value="Complemento em edição"></div><div class="ctwpml-footer"><button type="button" class="ctwpml-btn-primary">Continuar</button></div></div></div></div>');
  for(const file of ['address-ml-modal.css','checkout-ml-root.css','login-popup.css','checkout-desktop.css','passkeys.css'])await page.addStyleTag({content:read('assets/css/'+file)});
  await page.addScriptTag({content:read(require.resolve('jquery/dist/jquery.js'))});
  await page.evaluate(()=>{
   window.cc_params={privacy_policy_url:'https://fixture.test/privacidade/',plugin_url:'https://fixture.test/'};
   window.ctwpmlDesktopConfig={name:'Loja de teste'};
   window.fixtureState={view:'review',shipping:{id:'motoboy'},address:{address_1:'Rua de teste',number:'12',city:'São Paulo'}};
   window.fixtureTotals={subtotalText:'R$ 100,00',shippingText:'R$ 10,00',totalText:'R$ 110,00'};
   window.fixtureCoupons=[];window.fixtureCalls=0;window.fixtureActive=0;window.fixtureMax=0;
   window.CCCheckoutTabsState={desktopSnapshot:()=>window.fixtureState};
   window.CCCheckoutTabs={WooHost:{readTotals:()=>window.fixtureTotals,readCoupons:()=>window.fixtureCoupons,getCartThumbs:async()=>{
    window.fixtureCalls++;window.fixtureMax=Math.max(window.fixtureMax,++window.fixtureActive);
    await new Promise(resolve=>setTimeout(resolve,30));window.fixtureActive--;
    return {items:[{name:'Produto de teste',quantity:2,price:'R$ 100,00'}],subtotal:'R$ 100,00',total:'R$ 110,00'};
   }}};
  });
  await page.addScriptTag({content:read('assets/js/address-ml-screens.js')});
  await page.evaluate(()=>{
   document.querySelector('#view').innerHTML=CCCheckoutTabs.AddressMlScreens.renderReviewConfirmScreen({productCount:2,subtotalText:'R$ 100,00',shippingText:'R$ 10,00',totalText:'R$ 110,00',paymentLabel:'Pix',billingName:'Cliente fictício',addressSubtitle:'Rua de teste, 12'});
   window.originalTerms=document.querySelector('#ctwpml-review-terms');window.originalDraft=document.querySelector('#fixture-draft');
   window.nativeClicks=0;document.querySelector('#ctwpml-review-change-payment').addEventListener('click',e=>{e.preventDefault();window.nativeClicks++;});
  });
  await page.addScriptTag({content:read('assets/js/checkout-desktop.js')});
  await page.waitForSelector('.ctwpml-desktop-item');
  const shape=()=>page.evaluate(()=>{const o=document.querySelector('#ctwpml-address-modal-overlay').getBoundingClientRect(),a=document.querySelector('.ctwpml-desktop-summary').getBoundingClientRect(),b=document.querySelector('.ctwpml-modal-body').getBoundingClientRect();return {x:o.x,width:o.width,asideRight:a.right,bodyX:b.x,overflow:document.documentElement.scrollWidth>innerWidth};});
  for(const width of [1024,1280,1440]){await page.setViewportSize({width,height:900});const r=await shape();assert.equal(r.x,0);assert.equal(r.width,width);assert.ok(r.asideRight<r.bodyX);assert.equal(r.overflow,false);}
  const policy=page.locator('.ctwpml-review-summary-top .ctwpml-privacy-link');assert.equal(await policy.getAttribute('href'),'https://fixture.test/privacidade/');assert.equal(await policy.getAttribute('target'),'_blank');
  await page.locator('#ctwpml-review-terms').check();await page.locator('#fixture-draft').focus();
  await page.evaluate(()=>{jQuery(document.body).trigger('update_checkout');fixtureTotals.totalText='R$ 105,00';fixtureCoupons=[{code:'TESTE',amountText:'R$ 5,00'}];jQuery(document.body).trigger('updated_checkout');jQuery(document.body).trigger('ctwpml_woo_updated');});
  await page.waitForFunction(()=>document.querySelector('[data-desktop-value=total] strong').textContent==='R$ 105,00');
  assert.equal(await page.locator('[data-desktop-value=discount]').isVisible(),true);
  assert.equal(await page.evaluate(()=>originalTerms===document.querySelector('#ctwpml-review-terms')&&originalTerms.checked&&originalDraft===document.querySelector('#fixture-draft')&&document.activeElement===originalDraft),true);
  assert.equal(await page.locator('#fixture-draft').inputValue(),'Complemento em edição');
  await page.locator('[data-desktop-step=payment]').click();assert.equal(await page.evaluate(()=>nativeClicks),1);
  // Nav não permite pular validações de uma etapa anterior.
  await page.evaluate(()=>{fixtureState.view='form';document.querySelector('#view').style.padding='1px';});
  await page.waitForFunction(()=>document.querySelector('[data-desktop-step=payment]').disabled);
  for(const width of [390,768,1023]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.ctwpml-desktop-summary').isVisible(),false);assert.equal(await page.evaluate(()=>originalTerms===document.querySelector('#ctwpml-review-terms')&&originalTerms.checked),true);}
  await page.setViewportSize({width:1280,height:900});
  if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/checkout-desktop-real-review.png',fullPage:true});
  for(const stage of ['initial','shipping','payment']){
   await page.evaluate(stage=>{
    fixtureState.view=stage;const screens=CCCheckoutTabs.AddressMlScreens;
    const html=stage==='initial'?screens.renderInitial(fixtureState.address):stage==='shipping'?screens.renderShippingOptions(fixtureState.address,[{id:'flat_rate:3',label:'Motoboy',cost:'10.00',price:'R$ 10,00'}],{}):screens.renderPaymentScreen({totalText:'R$ 105,00',subtotalText:'R$ 100,00'});
    document.querySelector('#view').innerHTML=html;
   },stage);
   await page.waitForTimeout(40);const r=await shape();assert.ok(r.asideRight<r.bodyX);assert.equal(r.overflow,false);
   const footer=page.locator('.ctwpml-payment-footer');if(await footer.count())assert.equal(await footer.evaluate(el=>getComputedStyle(el).position),'static');
  }
  // Oferta antecipada usa os mesmos nós, sem duplicar CTA ou interferir com o handler nativo.
  await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div id="ctwpml-passkey-entry"><div class="ctwpml-passkey-dialog"><section class="ctwpml-passkey-card"><h2>Não preencha tudo de novo</h2><p>Já comprou aqui? Recupere seu nome, telefone e endereço salvos.</p><button class="ctwpml-passkey-primary" id="fixture-login">Usar meus dados salvos</button></section><button class="ctwpml-passkey-other">Continuar sem recuperar meus dados</button></div></div>');window.originalLogin=document.querySelector('#fixture-login');});
  await page.waitForSelector('.ctwpml-desktop-entry-actions');assert.equal(await page.evaluate(()=>originalLogin===document.querySelector('#fixture-login')&&document.querySelectorAll('#fixture-login').length===1),true);
  if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/checkout-desktop-real-entry.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.ctwpml-desktop-entry-actions').evaluate(el=>getComputedStyle(el).display),'contents');
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>fixtureMax),1);assert.ok(await page.evaluate(()=>fixtureCalls)<6,'Sem loop de requisições');assert.deepEqual(errors,[]);
  console.log('Edge: 1024/1280/1440 em duas colunas, mobile 390/768/1023 preservado, link real de privacidade, identidade de termos/rascunho/foco preservada em AJAX, valores/cupom sincronizados, navegação nativa, oferta sem duplicar controles e sem requisições sobrepostas.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
