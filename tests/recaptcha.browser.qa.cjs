// Formulário PHP e JS reais. Google e endpoints simulados; não acessa contas/pedidos reais.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const php=process.env.VAULT_PHP;if(!php)throw new Error('Defina VAULT_PHP');
const read=p=>readFileSync(p,'utf8'),modal=read('assets/js/address-ml-modal.js');
const start=modal.indexOf('    function showAuthView(opts)'),authView=modal.slice(start,modal.indexOf('    function ',start+10));
let enabled=false,mode='create',requests=[],apiRequests=0;
const google=`window.grecaptcha={token:'',render:function(el,opts){window.fixtureCaptchaOptions=opts;var button=document.createElement('button');button.type='button';button.textContent='Confirmar verificação';button.onclick=function(){grecaptcha.token='fixture-token';opts.callback(grecaptcha.token)};el.appendChild(button);return 0},getResponse:function(){return this.token},reset:function(){this.token=''}};ctwpmlRecaptchaOnload();`;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.google.com'){apiRequests++;await route.fulfill({contentType:'application/javascript',body:google});return;}
   if(url.pathname==='/ajax'){
    const body=new URLSearchParams(route.request().postData());requests.push(Object.fromEntries(body));
    assert.equal(body.get('action'),mode==='create'?'ctwpml_auth_email':'ctwpml_login');assert.equal(body.get('recaptcha_response'),enabled?'fixture-token':'');
    await new Promise(resolve=>setTimeout(resolve,80));await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:{}})});return;
   }
   const markup=execFileSync(php,['tests/recaptcha-auth.test.php','--markup',...(enabled?[]:['--disabled'])],{encoding:'utf8'});
   const params={ajax_url:'/ajax',auth_email_nonce:'create-nonce',login_nonce:'login-nonce',recaptcha_enabled:enabled?1:0,recaptcha_site_key:enabled?'fixture-public':''};
   const config=`window.cc_params=${JSON.stringify(params)};var state={params:cc_params,checkpoint:function(){}},currentView='review';function persistModalState(){}function setFooterVisible(){};`;
   await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${read('assets/css/login-popup.css')} #ctwpml-view-auth{max-width:720px;margin:20px auto} #g-recaptcha{max-width:100%}</style><div id="ctwpml-view-auth"></div>${markup}<input id="billing_first_name" value="Cliente"><input id="billing_last_name" value="Fixture"><script>${read(require.resolve('jquery/dist/jquery.js'))}</script><script>${config}</script><script>${read('assets/js/login-auth-v2.js')}</script>${enabled?'<script src="https://www.google.com/recaptcha/api.js?onload=ctwpmlRecaptchaOnload&render=explicit"></script>':''}<script>${authView};$(function(){showAuthView({mode:'${mode}',email:'fixture@example.test',preserveView:true,returnView:'review'})})</script>`});
  });
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});
   for(const on of [false,true]){
    enabled=on;mode='create';requests=[];const apiBefore=apiRequests;await page.goto('https://auth.example.test/checkout/');
    await page.locator('#ctwpml-auth-form').waitFor();
    if(on){await page.getByText('Confirmar verificação',{exact:true}).waitFor();assert.equal(await page.locator('#ctwpml-auth-submit').isDisabled(),true);
     await page.getByText('Confirmar verificação',{exact:true}).click();assert.equal(await page.locator('#ctwpml-auth-submit').isEnabled(),true);
     await page.evaluate(()=>{grecaptcha.token='';fixtureCaptchaOptions['expired-callback']()});assert.equal(await page.locator('#ctwpml-auth-submit').isDisabled(),true);
     await page.getByText('Confirmar verificação',{exact:true}).click();
    }else{assert.equal(await page.locator('#g-recaptcha').count(),0);assert.equal(apiRequests,apiBefore);assert.equal(await page.locator('#ctwpml-auth-submit').isEnabled(),true);}
    assert.equal(await page.locator('#ctwpml-create-email').inputValue(),'fixture@example.test');
    await page.locator('#ctwpml-auth-submit').click();await page.waitForURL('**ctwpml_session_refresh=*');assert.equal(requests.length,1);assert.equal(requests[0].name,'Cliente Fixture');
    assert.equal(new URL(page.url()).pathname,'/checkout/');
   }
  }
  // Login por senha mantém o mesmo endpoint e nonce, inclusive sem captcha.
  enabled=false;mode='login';requests=[];await page.goto('https://auth.example.test/checkout/');await page.locator('#ctwpml-login-password').fill('fixture-password');await page.locator('#ctwpml-auth-submit').click();await page.waitForURL('**ctwpml_session_refresh=*');assert.equal(requests.length,1);assert.equal(requests[0]._ajax_nonce,'login-nonce');
  assert.deepEqual(errors,[]);console.log('Edge390/1280: template PHP real, reCAPTCHA ativo/inativo, API callback antes do DOM ready, expiração/novo desafio, cadastro/login por endpoints originais, nonce e retorno à mesma página aprovados. Sem Google/loja reais.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
