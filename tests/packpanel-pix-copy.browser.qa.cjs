const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const fragment=empty=>{const r=spawnSync(process.env.VAULT_PHP,['tests/packpanel-pix-markup.php',...(empty?['--empty']:[])],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;};
const code='000201010212BR.GOV.BCB.PIXabcABC6304FFFF',filled=fragment(false),empty=fragment(true),css=readFileSync('packing-panel-woo-dev/assets/css/panel.css','utf8'),script=readFileSync('packing-panel-woo-dev/assets/js/panel.js','utf8'),jquery=readFileSync(require.resolve('jquery'),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://**/*',async r=>{assert.equal(new URL(r.request().url()).hostname,'shop.example.test');await r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><style>.elementor-kit-test .elementor-element :is(button,span,p,h4){color:white!important;-webkit-text-fill-color:white!important;background:white!important;opacity:.1!important}</style><body class="elementor-kit-test"><div class="elementor-element"><div class="painel-empacotamento"><nav class="painel-tabs"><button class="tab-button" data-tab="pagamentos">Pagamentos</button></nav><section id="tab-pagamentos" class="tab-content"><div class="pagamentos-carousel"><article class="pedido-container" data-order-id="99">'+filled+'</article></div></section></div></div><script>'+jquery+'</script><script>PPWOO={debug_enabled:false,copy_success:"Copiado!"};jQuery.ajax=()=>{};window.fixtureCopies=[];Object.defineProperty(navigator,"clipboard",{value:{writeText:async t=>fixtureCopies.push(t)},configurable:true});</script><script>'+script+'</script>'});});
  await page.goto('https://shop.example.test/pack');
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});
   const button=page.getByRole('button',{name:'Copiar Pix',exact:true});await button.waitFor({state:'visible'});
   assert.equal(await button.evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');assert.equal(await button.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(0, 102, 223)');
   assert.equal(await page.locator('.pix-to-copy').evaluate(n=>getComputedStyle(n).color),'rgb(27, 41, 58)');assert.equal(await button.evaluate(n=>getComputedStyle(n).opacity),'1');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.getByRole('button',{name:'Copiar Pix',exact:true}).click();await page.waitForFunction(()=>fixtureCopies.length===1);assert.equal(await page.evaluate(()=>fixtureCopies[0]),code);
  await page.waitForTimeout(1550);assert.equal(await page.locator('.ppwoo-copy-pix .dashicons-admin-page').count(),1);
  // Replace the card as a refresh does; the production delegated copy handler must still work.
  await page.locator('.pedido-container').evaluate((n,html)=>n.innerHTML=html,filled);await page.getByRole('button',{name:'Copiar Pix',exact:true}).click();await page.waitForFunction(()=>fixtureCopies.length===2);assert.equal(await page.evaluate(()=>fixtureCopies[1]),code);
  await page.locator('.pedido-container').evaluate((n,html)=>n.innerHTML=html,filled);
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}},configurable:true});document.execCommand=()=>{fixtureCopies.push(document.activeElement.value);return true;};});
  await page.getByRole('button',{name:'Copiar Pix',exact:true}).click();await page.waitForFunction(()=>fixtureCopies.length===3);assert.equal(await page.evaluate(()=>fixtureCopies[2]),code);
  await page.locator('.pedido-container').evaluate((n,html)=>n.innerHTML=html,empty);assert.equal(await page.getByRole('button',{name:'Copiar Pix',exact:true}).isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('Pending PackPanel Pix: real PHP fragment + delegated handler, exact copy, icon restored, AJAX replacement, absent code, Elementor colors and 320–1280 px passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
