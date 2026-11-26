// Markup e funções de produção; sem chamada de CEP, autenticação ou emissão de pedidos reais.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const source=readFileSync('assets/js/address-ml-modal.js','utf8');
function section(from,to){return source.slice(source.indexOf('    function '+from),source.indexOf('    function '+to));}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="ctwpml-root" class="ctwpml-root"></div><input id="billing_city" value="São Paulo"><input id="billing_state" value="SP">');
  await page.addStyleTag({content:readFileSync('assets/css/address-ml-modal.css','utf8')});
  await page.addScriptTag({content:readFileSync(require.resolve('jquery/dist/jquery.js'),'utf8')});
  await page.addScriptTag({content:`var state={params:{show_address_label:'1'},checkpoint:function(){}};
   var currentView='form',currentFormStep=1,isSavingAddress=false,cepConsultInFlight=false,selectedAddressId=null,cepConsultedFor='',lastCepLookup=null,storedDraft=null;
   function cepDigits(v){return String(v||'').replace(/\\D/g,'')}
   function cpfDigitsOnly(v){return cepDigits(v)}
   function ctwpmlCheckoutPhoneDetails(){return {valid:true}}
   function ctwpmlParseFullName(v){return {hasSurname:String(v||'').trim().includes(' ')}}
   function ctwpmlIsValidEmail(v){return String(v||'').includes('@')}
   function setFieldError(selector){$(selector).addClass('is-error')}
   function showNotification(){window.fixtureError=true}
   function readFormSnapshot(){return storedDraft}
   function ctwpmlFlushFormSnapshot(){storedDraft={addressId:selectedAddressId,formStep:currentFormStep}}
   ${section('ensureModal()','ensureWooNeighborhoodInputs()')}
   ${section('ctwpmlGetFormStatus()','validateForm()')}
   ensureModal();$('#ctwpml-address-modal-overlay,#ctwpml-view-form').show();$('#ctwpml-view-list').hide();ctwpmlSetFormStep(1,false);
   $('#ctwpml-btn-primary').on('click',function(){if(currentFormStep===1)ctwpmlAdvanceFormStep()});
   $('#ctwpml-form-step-address,#ctwpml-btn-secondary').on('click',function(){ctwpmlSetFormStep(1,true)});
  `});
  assert.equal(await page.locator('#ctwpml-form-step-address').getAttribute('aria-current'),'step');
  assert.equal(await page.locator('#ctwpml-form-personal-fields').isVisible(),false);
  await page.locator('#ctwpml-btn-primary').click();assert.equal(await page.evaluate(()=>currentFormStep),1);assert.equal(await page.evaluate(()=>fixtureError),true);
  for(const [field,value] of [['cep','06400-000'],['rua','Rua de exemplo'],['numero','12'],['comp','Apto 2'],['bairro','Centro']])await page.locator('#ctwpml-input-'+field).fill(value);
  await page.evaluate(()=>{$('#ctwpml-type-home').addClass('is-active');window.originalNumber=document.querySelector('#ctwpml-input-numero');});
  await page.locator('#ctwpml-btn-primary').click();assert.equal(await page.evaluate(()=>currentFormStep),2);
  assert.equal(await page.locator('#ctwpml-form-address-fields').isVisible(),false);assert.equal(await page.locator('#ctwpml-input-nome').isVisible(),true);
  assert.equal(await page.locator('#ctwpml-form-step-address .ctwpml-step-number').textContent(),'✓');
  assert.equal(await page.locator('#ctwpml-form-step-personal .ctwpml-step-number').textContent(),'2');
  await page.locator('#ctwpml-input-nome').fill('Cliente de Teste');await page.locator('#ctwpml-btn-secondary').click();
  assert.equal(await page.locator('#ctwpml-input-numero').inputValue(),'12');assert.equal(await page.locator('#ctwpml-input-comp').inputValue(),'Apto 2');
  assert.equal(await page.evaluate(()=>originalNumber===document.querySelector('#ctwpml-input-numero')),true);
  await page.locator('#ctwpml-btn-primary').click();assert.equal(await page.locator('#ctwpml-input-nome').inputValue(),'Cliente de Teste');
  await page.evaluate(()=>{currentFormStep=1;ctwpmlRestoreFormStep()});assert.equal(await page.evaluate(()=>currentFormStep),2);
  await page.evaluate(()=>{storedDraft.addressId='different';ctwpmlRestoreFormStep()});assert.equal(await page.evaluate(()=>currentFormStep),1);
  await page.evaluate(()=>{cepConsultInFlight=true;ctwpmlUpdateFormSaveState()});assert.equal(await page.locator('#ctwpml-btn-primary').isDisabled(),true);
  await page.evaluate(()=>{cepConsultInFlight=false;ctwpmlUpdateFormSaveState()});assert.equal(await page.locator('#ctwpml-btn-primary').isDisabled(),false);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  if(process.env.TRACKING_QA_OUTPUT){await page.setViewportSize({width:390,height:900});await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/form-steps-real-mobile.png',fullPage:true});}
  assert.deepEqual(errors,[]);console.log('Timeline real: passos1/2, validação do endereço, check de conclusão, navegação sem recriar/perder campos, retomada do passo por endereço, erro/in-flight recuperáveis e320/390/768/1280 aprovados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
