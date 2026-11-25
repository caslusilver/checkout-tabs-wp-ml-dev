const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const fragment=fs.readFileSync('tests/fixtures/thankyou-markup.html','utf8').replace(/<script>[\s\S]*?<\/script>/g,'').replace('id="obrigado-v1"','id="obrigado-v1" class="ctwpml-thankyou"').replace('<span class="status-mark" id="ty-mark">01</span>','<span id="ty-mark"><span id="ty-clock"></span></span>').replace('<main class="ticket">','<main class="ticket"><div class="ticket-timebar"><span></span></div>').replace('<span>Este Pix é válido por 24 horas.</span>','<span id="ty-time-note"></span>').replace('<h3>Pedido cancelado</h3>','<h3 id="ty-ended-title">Pedido cancelado</h3>');
 const payload='000201BR.GOV.BCB.PIX-Copy-EXACT';
 const config={ajax:'https://fixture.test/admin-ajax.php',id:9,key:'fixture-only',nonce:'fixture-only',state:'pending',minutes:6,tracking:'',pendingTitle:'Seu pedido está reservado',paidTitle:'Compra confirmada',thanks:'Obrigado!'};
 const html='<html><head><meta charset="utf-8"><style>'+fs.readFileSync('assets/css/thankyou-page.css','utf8')+'</style></head><body>'+fragment.replace('<div class="payload-box">','<input class="woocommerce-order-details__asaas-pix-code" type="hidden" value="'+payload+'"><div class="payload-box">').replace('<div class="page-actions">','<p id="ty-connection"></p><div class="page-actions">')+'<script id="ctwpml-ty-data" type="application/json">'+JSON.stringify(config)+'</script><script>'+fs.readFileSync('assets/js/thankyou-page.js','utf8')+'</script></body></html>';
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:850}}),errors=[];let state='pending',calls=0,active=0,maxActive=0,tracking='';
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.opened=[];window.open=(url)=>{window.opened.push(url);return null;};Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}});});
 await page.route('https://fixture.test/**',async route=>{
  if(route.request().url().includes('admin-ajax')){calls++;active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setTimeout(r,80));active--;await route.fulfill({json:{success:true,data:{state,tracking_url:tracking}}});}
  else await route.fulfill({contentType:'text/html',body:html});
 });
 await page.goto('https://fixture.test/obrigado/');await page.waitForFunction(()=>document.querySelector('#ty-clock').textContent.includes(':'));
 assert.equal(await page.locator('#ty-clock').textContent(),'06:00');
 await page.click('#ty-copy');assert.equal(await page.evaluate(()=>window.copied),payload);
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});
 await page.waitForTimeout(160);assert.equal(maxActive,1);
 state='paid';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('.product-stage').dataset.state==='paid');
 assert.equal(await page.locator('#ty-mark').isVisible(),false);assert.equal(await page.locator('#ty-tracking-choice').isVisible(),false,'Sem link motoboy, Correios só confirma');
 tracking='https://fixture.test/acompanhar/#pedido=9';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('#ty-track').href?.includes('acompanhar'));
 await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>window.opened.length),1);assert.equal(page.url(),'https://fixture.test/obrigado/');
 assert.equal(await page.locator('#ty-track-note').textContent(),'Toque em “Acompanhar meu pedido” para abrir em outra aba.');
 assert.deepEqual(errors,[]);console.log('Obrigado browser: 320/390/1024px, cópia integral, status sem reload, foco, sem sobreposição e fallback de nova aba passaram.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
