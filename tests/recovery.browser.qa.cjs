// Real markup/scripts/styles, isolated browser and fake HTTP transport; no shop or real contacts.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const markup=spawnSync(process.env.VAULT_PHP,['tests/recovery.test.php','--markup'],{encoding:'utf8'});assert.equal(markup.status,0,markup.stderr+markup.stdout);
const admin=readFileSync('assets/js/recovery-admin.js','utf8'),capture=readFileSync('assets/js/recovery-capture.js','utf8'),css=readFileSync('assets/css/recovery.css','utf8');
const jquery=readFileSync(require.resolve('jquery'),'utf8');
function form(text){const out={};for(const m of (text||'').matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)(?=\r\n--)/g)){if(m[1].endsWith('[]'))(out[m[1]]??=[]).push(m[2]);else out[m[1]]=m[2];}return out;}
const records=[
{id:1,revision:1,state:'attention',has_error:1,attempts:3,order_id:0,manual_order_id:0,updated_at:'2026-11-27 13:00:00',contact:{name:'Cliente A',email:'fixture@example.test',phone:'+16500000000',city:'Cidade exemplo',region:'SP'},context:{items:[{name:'Produto exemplo',quantity:2,subtotal:20,total:18}],shipping:'Motoboy',freight:5,total:23}},
{id:2,revision:1,state:'bought',has_error:0,attempts:1,order_id:1052,manual_order_id:0,updated_at:'2026-11-27 13:01:00',contact:{name:'Cliente B'},context:{}}
];
let events=[],mutations=0;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.hostname,'shop.example.test');
   if(url.pathname==='/ajax'){
    const body=form(route.request().postData());let data;
    if(body.action==='ctwpml_recovery_capture'){
     const batch=JSON.parse(body.batch);events.push(...batch.events);assert.equal(JSON.stringify(batch.events).includes('fixture-password'),false);
     data={trace:'12345678-1234-1234-1234-123456789abc',proof:'fixture-write-only'};
    }else if(body.action==='ctwpml_recovery_admin'){
     assert.equal(body.nonce,'fixture-admin');
     const op=body.operation;
     if(op==='list'||op==='board'){
      let rows=records.filter(r=>body.state==='all'||body.state==='closed'&&['bought','lost','recovered'].includes(r.state)||r.state===body.state);
      data={rows,count:rows.length,page:1,stats:{people:2,errors:1,recovered:records.filter(r=>r.state==='recovered').length,linked:records.filter(r=>r.manual_order_id).length,bought:1,devices:[]},settings:{enabled:true,idle:15},board_counts:{attention:records.filter(r=>r.state==='attention').length,contact:records.filter(r=>r.state==='contact').length,closed:records.filter(r=>['bought','lost','recovered'].includes(r.state)).length,active:0}};
     }else if(op==='detail')data={attempts:[{id:8,trace_id:'trace-example',created_at:'2026-11-27 13:00:00',device:{type:'desktop',os:'Windows',browser:'Edge'}}]};
     else if(op==='update'){
      mutations++;const ids=body['ids[]'].map(Number);
      for(const r of records)if(ids.includes(r.id)&&!r.order_id){assert.equal(body['revisions['+r.id+']'],String(r.revision));if(body.state==='link')r.manual_order_id=Number(body.order);else r.state=body.state;r.revision++;}
      data={updated:ids,conflicts:[]};
     }else if(op==='pix')data={available:true,payload:'000201BR.GOV.BCB.PIXabcABC6304FFFF',pending:true,order_id:1054,message:'Saved gateway code'};
     else if(op==='logs')data={rows:[{id:1,case_id:1,trace_id:'trace-example',name:'REQUEST_NETWORK_ERROR',detail:{status:500}}],cursor:1,upper:1,more:false};
     else data={};
    }else data={ok:true};
    await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});return;
   }
   if(url.pathname==='/recuperacao/'){
    await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>button{background:transparent!important;color:pink!important;opacity:.1!important}'+css+'</style>'+markup.stdout+'<script>ctwpmlRecoveryAdmin={url:"/ajax",nonce:"fixture-admin"}</script><script>'+admin+'</script>'});return;
   }
   await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script>'+jquery+'</script><script>ctwpmlRecoveryCapture={url:"/ajax",nonce:"fixture-public",version:"3.4.22",checkout:'+String(url.pathname==='/checkout/')+'}</script><script>'+capture+'</script><form class="checkout"><input id="ctwpml-input-email" value="fixture@example.test"><input type="password" value="fixture-password"><button type="button" id="ctwpml-review-confirm">Confirmar</button></form>'});
  });
  await page.goto('https://shop.example.test/recuperacao/');await page.locator('[data-case-id="1"]').waitFor();
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('[data-refresh]').evaluate(n=>getComputedStyle(n).opacity),'1');
  }
  await page.locator('[data-view]').selectOption('kanban');await page.locator('.cr-board').waitFor();
  if(process.env.RECOVERY_SCREENSHOT)await page.screenshot({path:process.env.RECOVERY_SCREENSHOT,fullPage:true});
  await page.locator('[data-case-id="1"]').dragTo(page.locator('.cr-lane').nth(1));await page.locator('.cr-lane').nth(1).locator('[data-case-id="1"]').waitFor();
  assert.equal(records[0].state,'contact');
  await page.locator('[data-case-id="1"]').dragTo(page.locator('.cr-lane').nth(2));await page.locator('dialog[open]').waitFor();await page.locator('dialog button[value="confirm"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-metric="recovered"]').textContent==='1');
  assert.equal(records[0].state,'recovered');assert.equal(await page.locator('[data-case-id="2"]').evaluate(n=>n.draggable),false);
  await page.locator('[data-case-id="1"] button').click();await page.locator('[data-case-id="1"] .cr-detail').waitFor();
  await page.locator('[data-case-id="1"]').getByRole('button',{name:'Associar pedido',exact:true}).click();await page.locator('dialog input').fill('1054');await page.locator('dialog button[value="confirm"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-metric="linked"]').textContent==='1 com pedido associado');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.fixtureCopied=text;}}}));
  await page.locator('[data-case-id="1"]').getByRole('button',{name:'Copiar logs',exact:true}).click();await page.waitForFunction(()=>!!window.fixtureCopied);
  assert.equal((await page.evaluate(()=>fixtureCopied)).includes('fixture@example.test'),false);
  await page.locator('[data-case-id="1"]').getByRole('button',{name:'Pix copia e cola',exact:true}).click();await page.locator('dialog[open]').waitFor();
  await page.locator('dialog').getByRole('button',{name:'Copiar Pix',exact:true}).click();assert.equal(await page.evaluate(()=>fixtureCopied),'000201BR.GOV.BCB.PIXabcABC6304FFFF');
  await page.locator('dialog button[value="confirm"]').click();
  const downloading=page.waitForEvent('download');await page.locator('[data-case-id="1"]').getByRole('button',{name:'Baixar logs',exact:true}).click();assert.ok((await downloading).suggestedFilename().includes('recuperacao-1-'));
  await page.goto('https://shop.example.test/checkout/');await page.waitForFunction(()=>document.querySelector('[name="ctwpml_recovery_trace"]'));
  await page.locator('#ctwpml-review-confirm').click();
  await page.evaluate(()=>CTWPMLRecovery.checkpoint('CHK_EXAMPLE_ERROR',false,{email:'private@example.test',status:500}));
  await page.waitForTimeout(1700);assert.ok(events.some(e=>e.name==='CHK_EXAMPLE_ERROR'));
  await page.goto('https://shop.example.test/');await page.waitForTimeout(250);assert.ok(events.some(e=>e.name==='PAGE_LANDED'&&e.detail.navigation==='home'));
  assert.deepEqual(errors,[]);assert.ok(mutations>=3);
  console.log('Recovery Edge: responsive 320–1280, contrast over theme CSS, real drag/drop, manual result, optional order, copy/download, signed field binding, correlated error and home return passed; HTTP/WordPress storage simulated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
