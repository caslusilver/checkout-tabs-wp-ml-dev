const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM,VirtualConsole} = require('jsdom');
const {IDBFactory} = require('fake-indexeddb');
const engine = require('../assets/driver/state.js');
const copy = value => JSON.parse(JSON.stringify(value));
const until = async predicate => { for(let i=0;i<150&&!predicate();i++) await new Promise(r=>setTimeout(r,5)); assert.ok(predicate(),'condition reached'); };
function fixture() { return {route_id:7,slot:2,pending_dispatch:false,driver:{version:0,current:0,status:'ready',stops:[{id:201,state:'ready'},{id:202,state:'ready'}],devices:[]},
 stops:[201,202].map((id,i)=>({id,number:String(id),position:i+1,name:'Pessoa '+id,address:'Rua fictícia '+id,detail:'Complemento fictício',phone:'123456789',whatsapp:'https://wa.me/33123456789',waze:'https://waze.com/ul?q=Rua%20'+id+'&navigate=yes',confirmed:false})),maps_key:'',map:{points:[]}}; }
function setup(t,{db=new IDBFactory(),online=true,server=fixture(),fetcher,worker}={}) {
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>{throw e;});
 const dom=new JSDOM('<main id="ctwpml-driver"></main><script id="ctdrv-script" data-scope="fixture-shop" data-endpoint="/ajax" data-worker="/entregas/?ctdrv_worker=1"></script>',{url:'https://driver.example.test/entregas/#rota=7&acesso='+'a'.repeat(64),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window,d=w.document,calls=[],opened=[];const close=()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();}; t.after(close); w.indexedDB=db;
 w.open=(...args)=>{opened.push(args);return null;}; // Bloqueio/cancelamento não deve navegar no painel.
 let connected=online; Object.defineProperty(w.navigator,'onLine',{get:()=>connected});
 const serverState=copy(server),receipts=new Set();
 w.fetch=async(url,opts)=>{
  const input=JSON.parse(opts.body.get('payload'));calls.push(input);
  if(fetcher) return fetcher(input,serverState);
  for(const event of input.events||[]) if(!receipts.has(event.id)){serverState.driver=engine.apply(serverState.driver,event,serverState.stops.filter(s=>s.confirmed).map(s=>s.id));receipts.add(event.id);}
  return {ok:true,json:async()=>({success:true,data:copy(serverState)})};
 };
 if(worker) Object.defineProperty(w.navigator,'serviceWorker',{value:worker});
 const evalApp=()=>{w.eval(readFileSync('assets/driver/state.js','utf8'));w.eval(readFileSync('assets/driver/app.js','utf8'));};
 evalApp();
 return {w,d,db,calls,opened,server:serverState,connected(value){connected=value;w.dispatchEvent(new w.Event(value?'online':'offline'));},close};
}
function gesture(ctx,start,end,value=100){const slider=ctx.d.querySelector('#driver-slide');slider.getBoundingClientRect=()=>({left:0,width:300});
 const point=(type,x)=>{const e=new ctx.w.Event(type);Object.defineProperties(e,{clientX:{value:x},pointerId:{value:1}});slider.dispatchEvent(e);};point('pointerdown',start);slider.value=value;point('pointerup',end);
}
async function record(db){const con=await new Promise((r,j)=>{const req=db.open('ctwpml-driver-v1',1);req.onsuccess=()=>r(req.result);req.onerror=j;});return new Promise((r,j)=>{const req=con.transaction('routes').objectStore('routes').get('fixture-shop:7');req.onsuccess=()=>{r(req.result);con.close();};req.onerror=j;});}

test('PHP empty device map supports multiple offline events and correction protection',()=>{
 let s=fixture().driver;const device='11111111-1111-4111-8111-111111111111';
 const ev=(type,stop_id,seq)=>({device,type,stop_id,seq,version:s.version});
 s=engine.apply(s,ev('start',201,1));s=engine.apply(s,ev('arrive',201,2));s=engine.apply(s,ev('complete',201,3));
 assert.equal(s.current,1);assert.equal(s.devices[device],3);
 assert.throws(()=>engine.apply(s,ev('correct',201,4),[201]));
 s=engine.apply(s,ev('correct',201,4));assert.deepEqual(s.stops.map(s=>s.state),['started','ready']);
});

test('compact unchanged polling preserves the authorized snapshot in the browser',async t=>{
 const server=fixture();server.route_revision=9;
 const c=setup(t,{server,fetcher:input=>({ok:true,json:async()=>({success:true,data:input.known_revision===9?{unchanged:true}:copy(server)})})});
 await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 await new Promise(resolve=>setTimeout(resolve,15));
 c.d.dispatchEvent(new c.w.Event('visibilitychange'));await until(()=>c.calls.length===2);
 assert.equal(c.calls[1].known_revision,9);await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal((await record(c.db)).snapshot.route_revision,9);
 assert.match(c.d.querySelector('[data-name]').textContent,/201/);
});

test('driver sliders ignore taps/incomplete drags, persist each step and sync once',async t=>{
 const c=setup(t);await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 assert.equal(c.w.location.hash,'#rota=7');assert.ok(c.calls[0].token);assert.equal(c.d.querySelector('[data-waze]').hasAttribute('href'),false);
 gesture(c,290,290);gesture(c,10,70);await new Promise(r=>setTimeout(r,15));assert.equal(c.calls.filter(c=>c.events.length).length,0);
 gesture(c,10,198,74);assert.equal(c.calls.filter(c=>c.events.length).length,0);
 gesture(c,10,199,75);await until(()=>c.server.driver.version===1);await until(()=>!c.d.querySelector('#driver-slide').disabled);
 assert.equal(c.d.querySelector('.driver-app').style.getPropertyValue('--dm-state'),'#9a5700');
 assert.equal(c.d.querySelector('[data-waze]').href,c.server.stops[0].waze);assert.equal(c.calls.at(-1).token,undefined);
 assert.deepEqual(c.opened,[[c.server.stops[0].waze,'_blank','noopener,noreferrer']]);
 assert.equal(c.w.location.pathname,'/entregas/');
 for(const link of c.d.querySelectorAll('a[href]')){assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.match(link.rel,/noreferrer/);}
 gesture(c,10,280);await until(()=>c.server.driver.version===2);await until(()=>!c.d.querySelector('#driver-slide').disabled);
 assert.equal(c.d.querySelector('.driver-app').style.getPropertyValue('--dm-state'),'#168343');
 gesture(c,10,280);await until(()=>c.server.driver.version===3);await until(()=>c.d.querySelector('[data-name]').textContent.includes('202'));
 assert.equal(c.server.stops[0].confirmed,false);assert.equal((await record(c.db)).queue.length,0);
 assert.equal(c.opened.length,2);assert.equal(c.opened[1][0],c.server.stops[1].waze);
 assert.equal(JSON.stringify(await record(c.db)).includes('aaaaaaaaaaaaaaaa'),false,'access token is not stored in IDB');
});

test('blocked Waze opening preserves the committed step, panel and navigation link',async t=>{
 const c=setup(t);await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 c.w.open=()=>{throw new Error('Blocked by browser');};
 gesture(c,10,280);await until(()=>c.server.driver.version===1);await until(()=>!c.d.querySelector('#driver-slide').disabled);
 assert.equal(c.w.location.href,'https://driver.example.test/entregas/#rota=7');
 assert.equal(c.d.querySelector('[data-waze]').href,c.server.stops[0].waze);
 assert.equal(c.calls.filter(call=>call.events.length).length,1);
 assert.equal((await record(c.db)).queue.length,0);
});

test('offline route reopens with durable ordered queue; reconnect acknowledges without duplicating',async t=>{
 const db=new IDBFactory(),c=setup(t,{db});await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 c.connected(false);gesture(c,10,280);await until(()=>c.d.querySelector('[data-stage]').textContent==='A caminho');
 gesture(c,10,280);await until(()=>c.d.querySelector('[data-stage]').textContent==='Chegada registrada');
 gesture(c,10,280);await until(()=>c.d.querySelector('[data-name]').textContent.includes('202'));
 let saved=await record(db);assert.equal(saved.queue.length,3);assert.deepEqual(saved.queue.map(e=>e.seq),[1,2,3]);
 assert.equal(c.calls.length,1);c.close();
 const reopened=setup(t,{db,online:false});await until(()=>reopened.d.querySelector('[data-name]')?.textContent.includes('202'));
 assert.match(reopened.d.querySelector('.connection-banner').textContent,/Sem internet/);assert.equal(reopened.calls.length,0);
 assert.ok(reopened.d.querySelector('[data-waze]').href.includes('202'));
 reopened.connected(true);await until(()=>reopened.server.driver.version===3);await until(()=>reopened.d.querySelector('[data-sync]').textContent==='Tudo sincronizado');
 assert.equal((await record(db)).queue.length,0);assert.equal(reopened.calls[0].events.length,3);
});

test('lost response retries same event IDs and conflict keeps local actions for explicit reconciliation',async t=>{
 let fail=false,conflict=false,seen=new Set();const c=setup(t,{fetcher:async(input,state)=>{
  if(input.events.length && conflict) return {ok:false,status:409,json:async()=>({success:false,data:{message:'A rota mudou'}})};
  for(const e of input.events) if(!seen.has(e.id)){state.driver=engine.apply(state.driver,e);seen.add(e.id);}
  if(input.events.length && !fail){fail=true;throw new Error('Resposta perdida');}
  return {ok:true,json:async()=>({success:true,data:copy(state)})};
 }});await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 gesture(c,10,280);await until(()=>fail);await until(()=>!c.d.querySelector('#driver-slide').disabled);
 assert.equal((await record(c.db)).queue.length,1);c.d.dispatchEvent(new c.w.Event('visibilitychange'));
 await until(()=>c.d.querySelector('[data-sync]').textContent==='Tudo sincronizado');assert.equal(c.server.driver.version,1);
 const sent=c.calls.filter(c=>c.events.length);assert.equal(sent[0].events[0].id,sent[1].events[0].id);
 conflict=true;gesture(c,10,280);await until(()=>!c.d.querySelector('[data-reconcile]').hidden);
 assert.equal((await record(c.db)).queue.length,1);assert.equal(c.d.querySelector('#driver-slide').disabled,true);assert.match(c.d.body.textContent,/conferir/);
 conflict=false;c.w.confirm=()=>true;c.d.querySelector('[data-reconcile]').click();await until(()=>c.d.querySelector('[data-reconcile]').hidden);
 const saved=await record(c.db);assert.equal(saved.queue.length,0);assert.equal(saved.discarded.length,1);
});

test('revoked link removes cached customer data and stops polling; map gestures stay isolated',async t=>{
 let revoked=false;const c=setup(t,{fetcher:async()=>revoked?{ok:false,status:403,json:async()=>({success:false,data:{message:'revogado'}})}:{ok:true,json:async()=>({success:true,data:fixture()})}});
 await until(()=>c.d.querySelector('[data-name]')?.textContent.includes('201'));
 const pinch=target=>{const e=new c.w.Event('gesturechange',{cancelable:true,bubbles:true});target.dispatchEvent(e);return e.defaultPrevented;};
 assert.equal(pinch(c.d.querySelector('.driver-sheet')),true);assert.equal(pinch(c.d.querySelector('.driver-map')),false);
 revoked=true;c.d.dispatchEvent(new c.w.Event('visibilitychange'));await until(()=>c.d.body.textContent.includes('revogado'));
 assert.equal((await record(c.db)).snapshot,null);const count=c.calls.length;c.w.dispatchEvent(new c.w.Event('online'));await new Promise(r=>setTimeout(r,30));assert.equal(c.calls.length,count);
});
