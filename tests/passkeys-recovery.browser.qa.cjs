// UI real + autenticador virtual; endpoints simulados, sem acessar a loja ou emitir pedido.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const read=p=>readFileSync(p,'utf8'),script=read('assets/js/passkeys.js'),modal=read('assets/js/address-ml-modal.js');
const backStart=modal.indexOf("      if (currentView === 'auth') {",modal.indexOf("$(document).on('click', '#ctwpml-modal-back'"));
const back=modal.slice(backStart,modal.indexOf("      if (currentView === 'payment') {",backStart));
const mismatch='Esta chave pertence a outra conta. Entre com o e-mail e a senha desta compra. Depois, você poderá salvar um acesso rápido para esta conta.';
let logged=false,actions=[],challenge=Buffer.from('recovery-browser-fixture-32-bytes!').toString('base64'),registrations=0;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await context.route('https://**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/ajax'){
    const body=new URLSearchParams(route.request().postData()),action=body.get('action');actions.push(action);let success=true,data;
    if(action==='ctwpml_passkey_context')data={nonce:'engine-nonce',loggedIn:logged,canRegister:logged,hasPasskeys:true,usedPasskey:false,enrollmentSeen:false};
    else if(action==='ctwpml_check_email'){assert.equal(body.get('email'),'checkout@example.test');assert.equal(body.get('_ajax_nonce'),'email-nonce');data={exists:1,auth_method:'passkey'};}
    else if(action==='secure_passkeys_frontend_get_register_options')data={challenge,rp:{id:'recovery.example.test',name:'Fixture'},user:{id:'AQID',name:'Fixture',displayName:'Fixture'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},timeout:10000};
    else if(action==='secure_passkeys_frontend_register_passkey'){assert.equal(logged,true);registrations++;data={};}
    else if(action==='secure_passkeys_frontend_get_login_options')data={challenge,rpId:'recovery.example.test',timeout:10000,userVerification:'required',allowCredentials:[]};
    else if(action==='secure_passkeys_frontend_login'){assert.equal(body.get('ctwpml_context'),'checkout-late');success=false;data=mismatch;}
    else throw new Error('Unexpected action '+action);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({success,data})});return;
   }
   const config={ajax:'/ajax',checkout:true,loggedIn:logged,checkEmailNonce:'email-nonce',loginErrors:{CHECKOUT_ACCOUNT_MISMATCH:mismatch}};
   await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${read('assets/css/passkeys.css')} #ctwpml-auth-form{padding:20px;background:white}input{display:block;margin:10px}</style>
    <div id="ctwpml-address-modal-overlay"><button id="ctwpml-modal-back">Voltar</button><div id="ctwpml-view-review"><input id="address-number" value="12"><input id="terms" type="checkbox" checked></div>
    <div id="ctwpml-view-auth"><div class="ctwpml-login-popup" data-ctwpml-expected-email="checkout@example.test"><section class="ctwpml-passkey-card ctwpml-passkey-card--late"><h2>Entre para concluir sua compra</h2><p>Seus dados desta compra estão preservados.</p><button class="ctwpml-passkey-primary" data-ctwpml-passkey-login>Entrar com acesso rápido</button><button class="ctwpml-passkey-other" data-ctwpml-passkey-back>Voltar para conferir meus dados</button><p class="ctwpml-passkey-message" role="status"></p></section><button data-ctwpml-passkey-password>Entrar com e-mail e senha</button><form id="ctwpml-auth-form"><input id="ctwpml-login-email" value="checkout@example.test"><input id="ctwpml-login-password" type="password"><button>Entrar</button></form></div></div></div>
    <div id="ctwpml-passkey-enroll" hidden><section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><h2>Na próxima, não digite tudo de novo</h2><button class="ctwpml-passkey-primary" data-ctwpml-passkey-register>Ativar</button><button data-ctwpml-passkey-dismiss>Continuar sem ativar</button><p class="ctwpml-passkey-message"></p></section></div>
    <script>${read(require.resolve('jquery/dist/jquery.js'))}</script><script>window.ctwpmlPasskeyConfig=${JSON.stringify(config)};var currentView='auth',state={__ctwpmlAuthReturnView:'review',checkpoint:function(){}};function showReviewConfirmScreen(){currentView='review';$('#ctwpml-view-review').show()};function fixtureBack(){${back}};$('#ctwpml-modal-back').on('click',fixtureBack);$('#ctwpml-view-review').hide();$('.ctwpml-login-popup').addClass('ctwpml-passkey-first').attr('aria-modal','true');</script><script>${script}</script>`});
  });
  // Cadastra uma chave de fixture para que o navegador consiga devolver uma prova na tentativa seguinte.
  logged=true;await page.goto('https://recovery.example.test/checkout/');await page.evaluate(()=>CTWPMLPasskeys.beforeCheckout(()=>{}));await page.locator('[data-ctwpml-passkey-register]').click();await page.getByText('✓ Tudo pronto!',{exact:true}).waitFor();assert.equal(registrations,1);
  logged=false;
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto('https://recovery.example.test/checkout/');
   await page.locator('[data-ctwpml-passkey-back]').click();assert.equal(await page.locator('#ctwpml-view-auth').isVisible(),false);assert.equal(await page.locator('#ctwpml-view-review').isVisible(),true);
   assert.equal(await page.locator('#address-number').inputValue(),'12');assert.equal(await page.locator('#terms').isChecked(),true);
   await page.goto('https://recovery.example.test/checkout/');await page.locator('[data-ctwpml-passkey-login]').click();
   await page.getByText(mismatch,{exact:true}).waitFor();assert.equal(await page.locator('#ctwpml-auth-form').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'ctwpml-login-password');assert.equal(registrations,1);
   assert.equal(await page.locator('[data-ctwpml-passkey-login]').textContent(),'Usar outra chave');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/passkey-recovery-'+width+'.png',fullPage:true});
  }
  // Depois de autenticar a conta pelo fluxo tradicional, o convite permite criar a chave neste aparelho.
  logged=true;await page.goto('https://recovery.example.test/checkout/');await page.evaluate(()=>{window.continued=0;CTWPMLPasskeys.beforeCheckout(()=>continued++)});await page.locator('[data-ctwpml-passkey-register]').click();await page.getByText('✓ Tudo pronto!',{exact:true}).waitFor();assert.equal(registrations,2);
  await page.locator('[data-ctwpml-passkey-dismiss]').click();await page.waitForFunction(()=>continued===1);assert.deepEqual(pageErrors,[]);
  console.log('Edge: Voltar acessível e sem sobreposição; chave de outra conta explica/foca senha; dados preservados em390/1280; nova chave somente após sessão autenticada e continuidade única. Endpoints simulados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
