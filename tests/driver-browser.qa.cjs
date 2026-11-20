// Smoke real no Edge: shell offline, gestos nativos e layout. Somente fixtures locais.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const assert=require('node:assert/strict');
const engine=require('../assets/driver/state.js');
const repo=resolve(__dirname,'..'), screenshots=process.env.DRIVER_QA_OUTPUT;
let state={version:0,current:0,status:'ready',stops:[{id:201,state:'ready'},{id:202,state:'ready'}],devices:[]};
state=engine.apply(state,{device:'operator',type:'start',stop_id:201,seq:1,version:0});
const receipts=new Set(), calls=[];
const dto=()=>({route_id:7,slot:2,pending_dispatch:false,driver:state,stops:[201,202].map((id,i)=>({id,number:String(id),position:i+1,name:i?'Marina · demonstração':'Lucas · demonstração',address:i?'Rua das Acácias, 52':'Avenida dos Jardins, 120',detail:'Endereço fictício · São Paulo · Apto 12',phone:'+33 6 12 34 56 78',whatsapp:'https://wa.me/33612345678',waze:'',confirmed:false})),map:{points:[]},maps_key:''});
let base;
const server=createServer(async(req,res)=>{
 if(req.url==='/ajax' && req.method==='POST'){
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(new URLSearchParams(text).get('payload'));calls.push(body);
  for(const event of body.events)if(!receipts.has(event.id)){state=engine.apply(state,event);receipts.add(event.id);}
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:true,data:dto()}));return;
 }
 if(req.url==='/entregas/?ctdrv_worker=1'){
  res.writeHead(200,{'Content-Type':'application/javascript','Service-Worker-Allowed':'/entregas/'});
  res.end('self.CTDriverWorker='+JSON.stringify({page:base+'/entregas/',version:'qa',assets:['state.js','app.js','driver.css'].map(x=>base+'/assets/driver/'+x+'?ver=qa')})+';importScripts("/assets/driver/worker.js");');return;
 }
 if(req.url.startsWith('/assets/driver/')){
  const name=req.url.split('?')[0].split('/').pop();if(!['state.js','app.js','driver.css','worker.js'].includes(name)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':(name.endsWith('.css')?'text/css':'application/javascript')+'; charset=UTF-8'});res.end(readFileSync(join(repo,'assets/driver',name)));return;
 }
 if(req.url.startsWith('/entregas/')){
  res.writeHead(200,{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="/assets/driver/driver.css?ver=qa"></head><body><main id="ctwpml-driver"></main><script defer src="/assets/driver/state.js?ver=qa"></script><script defer id="ctdrv-script" src="/assets/driver/app.js?ver=qa" data-scope="qa" data-endpoint="/ajax" data-worker="/entregas/?ctdrv_worker=1"></script></body></html>');return;
 }
 res.writeHead(404).end();
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/entregas/#rota=7&acesso='+'a'.repeat(64));await page.waitForFunction(()=>document.querySelector('[data-name]')?.textContent.includes('Lucas'));
  try { await page.waitForFunction(()=>document.querySelector('.connection-banner').textContent.includes('disponível offline'),null,{timeout:10000}); }
  catch(error) { console.log('Offline diagnostic:',await page.locator('.connection-banner').textContent(),await page.locator('[data-message]').textContent(),await page.evaluate(async()=>({regs:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state})),caches:await caches.keys()})));throw error; }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const slide=page.locator('#driver-slide'), box=await slide.boundingBox();
  assert.match(await page.locator('.swipe-area label').textContent(),/confirmar chegada/);
  await page.mouse.click(box.x+box.width-12,box.y+box.height/2);await page.waitForTimeout(80);assert.equal(state.version,1,'tap at end does not apply');
  if(screenshots)await page.screenshot({path:join(screenshots,'driver-production-start-mobile.png')});
  await context.setOffline(true);
  await page.mouse.move(box.x+22,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width-10,box.y+box.height/2,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-stage]').textContent==='Chegada registrada');
  assert.equal(state.version,1,'offline gesture does not pretend to notify server');
  await page.reload();await page.waitForFunction(()=>document.querySelector('[data-stage]')?.textContent==='Chegada registrada');
  assert.match(await page.locator('.connection-banner').textContent(),/Sem internet/);
  await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>document.querySelector('[data-sync]').textContent==='Tudo sincronizado');assert.equal(state.version,2);
  const nextbox=await slide.boundingBox();await page.mouse.move(nextbox.x+22,nextbox.y+nextbox.height/2);await page.mouse.down();await page.mouse.move(nextbox.x+nextbox.width-10,nextbox.y+nextbox.height/2,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-name]').textContent.includes('Marina'));
  assert.equal(await page.locator('.driver-app').evaluate(e=>e.style.getPropertyValue('--dm-state')),'#9a5700');
  if(screenshots)await page.screenshot({path:join(screenshots,'driver-production-arrived-mobile.png')});
  const cacheKeys=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async k=>(await(await caches.open(k)).keys()).map(r=>r.url)))).flat();});
  assert.ok(cacheKeys.every(url=>url.includes('/assets/driver/')||url===base+'/entregas/'),'SW caches only shell and own assets');
  assert.equal(cacheKeys.some(url=>url.includes('acesso=')||url.includes('/ajax')),false);
  await page.setViewportSize({width:1280,height:900});if(screenshots)await page.screenshot({path:join(screenshots,'driver-production-desktop.png')});
  assert.deepEqual(errors,[]);await context.close();console.log('Edge: mobile/desktop, gesto nativo, reabertura offline real, reconexão e cache restrito passaram.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
