// Interface real do cofre renderizada pelo PHP; somente valores fictícios em servidor local.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const html=execFileSync(process.env.VAULT_PHP,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/key-vault.test.php','--html'],{encoding:'utf8'});
const calls=[];const server=createServer(async(req,res)=>{
 if(req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;const data=new URLSearchParams(body);calls.push(Object.fromEntries(data));
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:true,data:data.get('operation')==='read'?{value:'fixture-browser-key-not-real'}:{removed:true}}));return;
 }
 if(req.url.startsWith('/assets/')){
  const path=req.url.split('?')[0];if(!['/assets/css/key-vault.css','/assets/js/key-vault.js'].includes(path)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':(path.endsWith('.css')?'text/css':'application/javascript')+';charset=UTF-8'});res.end(readFileSync(join(process.cwd(),path)));return;
 }
 res.writeHead(200,{'Content-Type':'text/html;charset=UTF-8'});res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#f0f0f1;margin:20px;font:14px system-ui}p{line-height:1.5}button{font:inherit;cursor:pointer}.dashicons{display:none}</style><link rel="stylesheet" href="/assets/css/key-vault.css"></head><body>'+html+'<script src="/assets/js/key-vault.js"></script></body></html>');
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let browser;try{
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:1000}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/wp-admin/admin.php?page=ctwpml-vault');assert.equal(calls.length,0);
  const row=page.locator('[data-name="motoboy_conexao"]');
  await row.locator('[data-key-action="copy"]').click();await row.locator('.ctv-row-status').filter({hasText:'Chave copiada'}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'fixture-browser-key-not-real');
  await row.locator('[data-key-action="name"]').click();await row.locator('.ctv-row-status').filter({hasText:'Nome copiado'}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'motoboy_conexao');
  await row.locator('[data-key-action="show"]').click();await page.waitForFunction(()=>document.querySelector('[data-name="motoboy_conexao"] input').type==='text');
  await row.locator('[data-key-action="show"]').click();assert.equal(await row.locator('input').inputValue(),'');
  if(process.env.VAULT_QA_OUTPUT)await page.screenshot({path:join(process.env.VAULT_QA_OUTPUT,'key-vault-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.VAULT_QA_OUTPUT)await page.screenshot({path:join(process.env.VAULT_QA_OUTPUT,'key-vault-mobile.png'),fullPage:true});
  page.once('dialog',dialog=>dialog.dismiss());const before=calls.length;await row.locator('[data-key-action="delete"]').click();assert.equal(calls.length,before);
  page.once('dialog',dialog=>dialog.accept());await row.locator('[data-key-action="delete"]').click();await row.waitFor({state:'detached'});assert.equal(calls.at(-1).confirmed,'1');
  assert.deepEqual(errors,[]);await context.close();console.log('Edge: cofre desktop/mobile sem overflow, clipboard real, mostrar/ocultar e remover com confirmação passaram.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
