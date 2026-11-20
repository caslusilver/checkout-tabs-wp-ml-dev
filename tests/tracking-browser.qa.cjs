// Interface real com respostas fictícias, sem Google/Waze/WhatsApp ou pedidos reais.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
let stage='ready',confirmations=0,failConfirm=true;
const data=()=>({number:'201',route:2,position:2,total:4,last:false,code:'',driver_stage:stage,
 departed_at:new Date().toISOString(),eta_at:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),
 address:'Rua Exemplo, 120 · Seu endereço',final_area:'Vila Exemplo',driver_whatsapp:'https://contact.example.test/driver',tracking_link:'https://tracking.example.test/ride',maps_key:'',map:{points:[]}});
const server=createServer(async(req,res)=>{
 if(req.url==='/ajax'){
  let text='';for await(const chunk of req)text+=chunk;
  const command=new URLSearchParams(text).get('command');
  if(command==='confirm'){confirmations++;res.writeHead(failConfirm?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:!failConfirm,data:failConfirm?{message:'Falha simulada'}:{confirmed:true}}));return;}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data:data()}));return;
 }
 if(req.url==='/app.js'||req.url==='/style.css'){
  res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/css'});
  res.end(readFileSync(join(__dirname,'..','packing-panel-woo-dev/assets',req.url.endsWith('.js')?'js/order-tracking.js':'css/order-tracking.css')));return;
 }
 if(req.url==='/entrega/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=UTF-8'});
  res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="/style.css"><style>.tracking-live{background-color:magenta}.tracking-map+.tracking-content{background-color:magenta;border-top:12px solid magenta;border-radius:0}</style></head><body><main id="ppwoo-tracking"><p class="tracking-status"></p></main><script id="ppwoo-tracking-script" src="/app.js" data-endpoint="/ajax"></script></body></html>');return;
 }
 res.writeHead(404).end();
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
  // Todas as saídas são interceptadas: não há requisições a serviços reais.
  await context.route('https://**/*',route=>route.fulfill({status:200,contentType:'text/html',body:'Destino fictício'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/entrega/#pedido=201');await page.waitForSelector('#tracking-slide');
  const slider=await page.locator('#tracking-slide').elementHandle();
  for(const [state,color] of [['ready','rgb(23, 101, 216)'],['started','rgb(154, 87, 0)'],['arrived','rgb(22, 131, 67)'],['delivered','rgb(22, 131, 67)']]){
   stage=state;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   await page.waitForFunction(value=>document.querySelector('#ppwoo-tracking').dataset.trackingState===value,state);
   const styles=await page.evaluate(()=>{const content=getComputedStyle(document.querySelector('.tracking-content')),dot=getComputedStyle(document.querySelector('.tracking-live'));return [content.borderTopColor,dot.backgroundColor,content.borderTopWidth,content.borderTopLeftRadius,content.backgroundColor];});
   assert.deepEqual(styles,[color,color,'3px','22px','rgb(255, 255, 255)']);
   assert.equal(await slider.evaluate(el=>el===document.querySelector('#tracking-slide')),true);
  }
  for(const selector of ['.tracking-link','.tracking-whatsapp']){
   const original=page.url(),popupPromise=context.waitForEvent('page');await page.click(selector);const popup=await popupPromise;
   await popup.waitForLoadState();assert.equal(page.url(),original);assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();await page.bringToFront();
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.tracking-live').evaluate(el=>getComputedStyle(el,'::after').display),'none');
  const swipe=async fraction=>{const b=await page.locator('#tracking-slide').boundingBox();await page.mouse.move(b.x+20,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*fraction,b.y+b.height/2,{steps:12});await page.mouse.up();};
  const box=await page.locator('#tracking-slide').boundingBox();await page.mouse.click(box.x+box.width-10,box.y+box.height/2);await swipe(.25);assert.equal(confirmations,0);
  await swipe(.76);await page.waitForFunction(()=>document.querySelector('.tracking-status').textContent.includes('Não conseguimos'));
  assert.equal(await page.locator('#tracking-slide').isEnabled(),true);assert.equal(await page.locator('#tracking-slide').inputValue(),'0');assert.equal(confirmations,1);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:join(process.env.TRACKING_QA_OUTPUT,'tracking-state-production.png'),fullPage:true});
  failConfirm=false;await swipe(.76);await page.waitForSelector('.tracking-thanks');assert.equal(confirmations,2);
  assert.deepEqual(errors,[]);await context.close();
  console.log('Edge: cores/curva, prioridade CSS, polling, abas isoladas, movimento reduzido, gestos, recuperação de erro e mobile/desktop passaram.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
