// CSS/controlador reais, transporte simulado; sem configurações ou pedidos da loja.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const css=readFileSync('assets/css/dispatch-controls.css','utf8'),jquery=readFileSync(require.resolve('jquery/dist/jquery.js'),'utf8');
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><form>'+['top','right','bottom','left'].map(side=>'<label>'+side+'<input type="number" data-dispatch-padding-side="'+side+'" name="checkout_tabs_wp_ml_dispatch_banner_padding['+side+']" value="'+(['top','bottom'].includes(side)?12:16)+'"></label>').join('')+'</form><div class="elementor-widget-container" style="padding:17px"><div class="ctwpml-dispatch-banner" data-ctwpml-dispatch-preview><span class="dispatch-dot"></span><span>Próximo envio: hoje, às18:00.</span></div></div><style>.elementor-widget-container .ctwpml-dispatch-banner{padding:80px;min-height:300px}</style>');
  await page.addStyleTag({content:css});await page.addScriptTag({content:jquery});await page.addScriptTag({content:readFileSync('assets/js/admin-tabs.js','utf8')});
  const padding=()=>page.locator('.ctwpml-dispatch-banner').evaluate(node=>{const c=getComputedStyle(node);return [c.paddingTop,c.paddingRight,c.paddingBottom,c.paddingLeft]});
  await page.waitForFunction(()=>document.querySelector('[data-ctwpml-dispatch-preview]').style.getPropertyValue('--dispatch-padding-top')==='12px');
  assert.deepEqual(await padding(),['12px','16px','12px','16px']);
  for(const [side,value]of Object.entries({top:0,right:9,bottom:3,left:7}))await page.locator('[data-dispatch-padding-side="'+side+'"]').fill(String(value));
  assert.deepEqual(await padding(),['0px','9px','3px','7px']);assert.equal(await page.locator('.elementor-widget-container').evaluate(n=>getComputedStyle(n).paddingTop),'17px');
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('.ctwpml-dispatch-banner').evaluate(n=>getComputedStyle(n).minHeight),'0px');
  }
  // Página pública em cache com padding antigo recebe os valores atuais sem trocar o DOM.
  await page.goto('about:blank');await page.setContent('<div class="ctwpml-dispatch-banner" style="--dispatch-padding-top:12px"><span class="dispatch-dot"></span><span data-dispatch-message>cache</span></div>');
  await page.addStyleTag({content:css});await page.addScriptTag({content:jquery});
  await page.evaluate(()=>{
   window.CTWPML_DISPATCH={url:'/ajax'};window.originalMessage=document.querySelector('[data-dispatch-message]');
   window.fetch=async()=>({ok:true,json:async()=>({success:true,data:{message:'Próximo envio: hoje, às18:00.',padding:{top:0,right:5,bottom:2,left:6},color:'#16a34a',pulse:true}})});
  });
  await page.addScriptTag({content:readFileSync('assets/js/dispatch-controls.js','utf8')});
  await page.waitForFunction(()=>document.querySelector('[data-dispatch-message]').textContent!=='cache');
  assert.deepEqual(await padding(),['0px','5px','2px','6px']);assert.equal(await page.evaluate(()=>originalMessage===document.querySelector('[data-dispatch-message]')),true);
  assert.deepEqual(errors,[]);console.log('Padding: quatro lados/zero, prévia administrativa, prioridade sobre CSS externo, parent Elementor preservado, cache/AJAX sem recriar DOM, 320/390/1280 aprovados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
