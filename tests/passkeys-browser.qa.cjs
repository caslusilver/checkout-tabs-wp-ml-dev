// Autenticador virtual + verificação criptográfica pela biblioteca original. Nenhum site real é chamado.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),assert=require('node:assert/strict');
const php=process.env.VAULT_PHP,reference=process.env.PASSKEYS_REFERENCE;
if(!php||!reference)throw new Error('Defina VAULT_PHP, VAULT_PHP_EXT e PASSKEYS_REFERENCE.');
let logged=true,challenge,publicKey,counter,registered=false,verified=false;
const script=readFileSync('assets/js/passkeys.js','utf8'),css=readFileSync('assets/css/passkeys.css','utf8');
function verify(operation,body){
 const response={};for(const key of ['clientDataJSON','attestationObject','authenticatorData','signature'])if(body.get('response['+key+']'))response[key]=body.get('response['+key+']');
 assert.equal(body.get('challenge'),challenge);assert.equal(body.get('nonce'),'fixture-native-nonce');
 const result=spawnSync(php,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/passkeys-engine-fixture.php'],{input:JSON.stringify({operation,challenge,response,publicKey,counter}),encoding:'utf8',env:process.env});
 assert.equal(result.status,0,result.stderr+result.stdout);return JSON.parse(result.stdout);
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await context.route('https://**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/ajax'){
    const body=new URLSearchParams(route.request().postData()),action=body.get('action');let data;
    if(action==='ctwpml_passkey_context')data={nonce:'fixture-native-nonce',loggedIn:logged,canRegister:logged,hasPasskeys:registered};
    else if(action.endsWith('_options')){
     challenge=randomBytes(32).toString('base64');data={challenge,timeout:30000,userVerification:'required',rpId:'passkeys.example.test',allowCredentials:[]};
     if(action.includes('register'))data={challenge,timeout:30000,rp:{id:'passkeys.example.test',name:'Loja fictícia'},user:{id:Buffer.from('fixture-user-42').toString('base64'),name:'cliente@example.test',displayName:'Cliente fictício'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',excludeCredentials:[]};
    }else if(action==='secure_passkeys_frontend_register_passkey'){
     assert.equal(logged,true);const result=verify('create',body);publicKey=result.publicKey;counter=result.counter;registered=true;data={saved:true};
    }else if(action==='secure_passkeys_frontend_login'){
     const result=verify('get',body);verified=result.verified;logged=true;data={redirect_url:'https://evil.example.test/'};
    }else throw new Error('Ação inesperada: '+action);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});return;
   }
   const card='<section class="ctwpml-passkey-card"><img src="/fingerprint.svg" alt=""><h2>Não preencha tudo de novo</h2><p>Já comprou aqui? Recupere seu nome, telefone e endereço salvos.</p><div class="ctwpml-passkey-benefit"><strong>Você só confere e continua</strong><p>Confirme com rosto, digital ou PIN para usar seus dados.</p></div><button data-ctwpml-passkey-login class="ctwpml-passkey-primary">Usar meus dados salvos</button><p class="ctwpml-passkey-message"></p></section>';
   if(url.pathname==='/fingerprint.svg'){await route.fulfill({contentType:'image/svg+xml',body:readFileSync('assets/fingerprint.svg','utf8')});return;}
   const ui=logged?'<div id="ctwpml-passkey-enroll" hidden><section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><h2>Na próxima, não digite tudo de novo</h2><button data-ctwpml-passkey-register class="ctwpml-passkey-primary">Ativar para a próxima compra</button><button data-ctwpml-passkey-dismiss>Agora não</button><p class="ctwpml-passkey-message"></p></section></div>':'<div id="ctwpml-passkey-entry" hidden><div class="ctwpml-passkey-dialog" role="dialog">'+card+'<button class="ctwpml-passkey-other" data-ctwpml-passkey-skip>Continuar sem recuperar meus dados</button></div></div>';
   await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style>'+ui+'<script>window.ctwpmlPasskeyConfig={ajax:"/ajax",checkout:true,loggedIn:'+logged+'}</script><script>'+script+'</script>'});
  });
  await page.goto('https://passkeys.example.test/obrigado/');await page.evaluate(()=>window.CTWPMLPasskeys.beforeCheckout(()=>{}));await page.locator('[data-ctwpml-passkey-register]').click();
  await page.waitForFunction(()=>document.querySelector('.ctwpml-passkey-card h2')?.textContent.includes('Tudo pronto'));assert.equal(registered,true);
  logged=false;await page.goto('https://passkeys.example.test/checkout/');await page.evaluate(()=>window.CTWPMLPasskeys.offer(()=>{}));
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.setViewportSize({width:390,height:844});
  if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/passkeys-integration-mobile.png',fullPage:true});
  await page.locator('[data-ctwpml-passkey-login]').click();await page.waitForURL('**ctwpml_session_refresh=*');assert.equal(verified,true);assert.equal(new URL(page.url()).hostname,'passkeys.example.test');
  // Header concorrente como o HTML externo do Elementor/PWA, sem carregar o site real.
  await page.setContent('<meta charset="utf-8"><div id="fixture-header" style="position:fixed;inset:0;z-index:2147483000;background:magenta">Menu fixo</div>');
  await page.addStyleTag({content:readFileSync('assets/css/preparing-checkout.css','utf8')});
  await page.addScriptTag({content:readFileSync('assets/js/preparing-checkout.js','utf8')});
  await page.evaluate(()=>window.CTWPMLPrepare.showPreparingOverlay('Finalizando seu pedido…','checkout'));
  assert.equal(await page.locator('#ctwpml-preparing-overlay').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 166, 80)');
  assert.equal(await page.evaluate(()=>!!document.elementFromPoint(20,20).closest('#ctwpml-preparing-overlay')),true);
  assert.equal(await page.locator('.ctwpml-preparing-title').textContent(),'Finalizando seu pedido…');
  await page.evaluate(()=>window.CTWPMLPrepare.hidePreparingOverlay());assert.equal(await page.locator('#ctwpml-preparing-overlay').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('Edge + Secure Passkeys 1.3.0: cadastro e login com autenticador virtual validados pela biblioteca criptográfica original; redirect externo ignorado; mobile/desktop sem overflow.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
