// Página e scripts reais do adaptador; autenticação virtual verificada pela biblioteca original.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),assert=require('node:assert/strict');
const php=process.env.VAULT_PHP,reference=process.env.PASSKEYS_REFERENCE;
if(!php||!reference)throw new Error('Defina VAULT_PHP, VAULT_PHP_EXT e PASSKEYS_REFERENCE.');
const markup=spawnSync(php,['tests/early-login.test.php','--markup'],{encoding:'utf8'});assert.equal(markup.status,0,markup.stdout+markup.stderr);
const loggedMarkup=spawnSync(php,['tests/early-login.test.php','--markup','--logged-markup'],{encoding:'utf8'});assert.equal(loggedMarkup.status,0,loggedMarkup.stdout+loggedMarkup.stderr);
const scripts=['passkeys','early-login'].map(name=>readFileSync('assets/js/'+name+'.js','utf8')).join('\n');
const css=['passkeys','early-login'].map(name=>readFileSync('assets/css/'+name+'.css','utf8')).join('\n');
let logged=false,challenge,publicKey,counter,verified=false,method='passkey',captchaEnabled=false,accountExists=true,usedPasskey=false,hasPasskeys=true,enrollmentSeen=false,registered=false;const calls=[];
function verify(operation,response){
 const result=spawnSync(php,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/passkeys-engine-fixture.php'],{input:JSON.stringify({operation,challenge,response,publicKey,counter}),encoding:'utf8',env:process.env});
 assert.equal(result.status,0,result.stderr+result.stdout);return JSON.parse(result.stdout);
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await context.route('https://**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/ajax'){
    const body=new URLSearchParams(route.request().postData()),action=body.get('action');calls.push({action,body});let data;
    if(action==='ctwpml_passkey_context'){
     if(body.get('enrollment_done')){assert.equal(logged,true);assert.equal(body.get('nonce'),'fixture-native-nonce');enrollmentSeen=true;}
     data={nonce:'fixture-native-nonce',loggedIn:logged,canRegister:logged,hasPasskeys,usedPasskey,enrollmentSeen,checkEmailNonce:'fixture-email-nonce',loginNonce:'fixture-password-nonce',recaptchaEnabled:captchaEnabled,recaptchaSiteKey:'fixture-public'};
    }
    else if(action==='ctwpml_check_email'){assert.equal(body.get('_ajax_nonce'),'fixture-email-nonce');data={exists:accountExists?1:0,auth_method:method,ticket:accountExists?'fixture-bound-route':''};}
    else if(action==='secure_passkeys_frontend_get_login_options'){challenge=randomBytes(32).toString('base64');data={challenge,timeout:30000,rpId:'passkeys.example.test',userVerification:'required',allowCredentials:[]};}
    else if(action==='secure_passkeys_frontend_get_register_options'){
     assert.equal(logged,true);challenge=randomBytes(32).toString('base64');data={challenge,timeout:30000,rp:{id:'passkeys.example.test',name:'Loja fictícia'},user:{id:Buffer.from('fixture-user-42').toString('base64'),name:'fixture@example.test',displayName:'Fixture'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',excludeCredentials:[]};
    }
    else if(action==='secure_passkeys_frontend_register_passkey'){
     assert.equal(logged,true);assert.equal(body.get('nonce'),'fixture-native-nonce');assert.equal(body.get('challenge'),challenge);
     const response={clientDataJSON:body.get('response[clientDataJSON]'),attestationObject:body.get('response[attestationObject]')};
     verify('create',response);registered=true;hasPasskeys=true;data={saved:true};
    }
    else if(action==='secure_passkeys_frontend_login'){
     const response={};for(const key of ['clientDataJSON','authenticatorData','signature'])response[key]=body.get('response['+key+']');
     assert.equal(body.get('nonce'),'fixture-native-nonce');assert.equal(body.get('challenge'),challenge);assert.equal(body.get('ctwpml_context'),'checkout-early');assert.equal(body.get('ctwpml_early_ticket'),'fixture-bound-route');
     verified=verify('get',response).verified;logged=true;usedPasskey=true;data={ok:true};
    }else if(action==='ctwpml_login'){
     assert.equal(body.get('_ajax_nonce'),'fixture-password-nonce');
     if(body.get('ctwpml_context')==='checkout-early'){assert.equal(body.get('ctwpml_early_ticket'),'fixture-bound-route');assert.equal(body.get('email'),'fixture@example.test');}else assert.equal(body.get('ctwpml_context'),'entry');
     if(captchaEnabled)assert.equal(body.get('recaptcha_response'),'fixture-captcha-proof');
     if(body.get('password')!=='fixture-proof')return route.fulfill({contentType:'application/json',body:JSON.stringify({success:false,data:{message:'Senha inválida'}})});
     logged=true;data={ok:true};
    }else throw new Error('Unexpected action: '+action);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});
   }
   if(url.pathname.endsWith('fingerprint.svg'))return route.fulfill({contentType:'image/svg+xml',body:readFileSync('assets/fingerprint.svg','utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div style="background:#182a37;padding:10px;display:flex;gap:80px">'+(logged?loggedMarkup.stdout:markup.stdout)+'</div><script>ctwpmlPasskeyConfig={ajax:"/ajax",checkout:true,loggedIn:'+logged+'};ctwpmlEarlyLoginConfig={enabled:true,checkout:true,account:"/account/"};</script><script>'+scripts+'</script>'});
  });
  await page.goto('https://passkeys.example.test/checkout/');
  // Cadastra uma credencial de fixture no autenticador virtual antes de testar seu uso.
  challenge=randomBytes(32).toString('base64');
  const response=await page.evaluate(async challenge=>{
   const credential=await navigator.credentials.create({publicKey:{challenge:Uint8Array.from(atob(challenge),c=>c.charCodeAt(0)),rp:{id:'passkeys.example.test',name:'Fixture'},user:{id:new Uint8Array([42]),name:'fixture@example.test',displayName:'Fixture'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none'}});
   const encode=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer)));return {clientDataJSON:encode(credential.response.clientDataJSON),attestationObject:encode(credential.response.attestationObject)};
  },challenge);
  const fixtureCredential=verify('create',response);publicKey=fixtureCredential.publicKey;counter=fixtureCredential.counter;
  assert.equal(await page.locator('#ctwpml-menu-access').count(),1);assert.equal(await page.locator('[data-ctwpml-menu-login]').count(),2);
  await page.evaluate(()=>CTWPML_EarlyLogin.offer(email=>window.fixtureManual=email));
  await page.locator('#ctwpml-early-email').fill('fixture@example.test');await page.locator('#ctwpml-early-email-form button').click();
  await page.locator('[data-ctwpml-early-offer]').waitFor({state:'visible'});
  assert.equal(await page.locator('#ctwpml-early-email-form').isVisible(),false);
  assert.equal(await page.locator('[data-ctwpml-early-title]').textContent(),'Encontramos seu acesso rápido.');
  await page.locator('[data-ctwpml-early-edit]').click();
  assert.equal(await page.locator('[data-ctwpml-early-offer]').isVisible(),false);
  assert.equal(await page.locator('#ctwpml-early-email-form button').textContent(),'Consultar');
  await page.locator('#ctwpml-early-email-form button').click();await page.locator('[data-ctwpml-early-offer]').waitFor({state:'visible'});
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('#ctwpml-early-access').evaluate(node=>getComputedStyle(node).position),'fixed');
  }
  if(process.env.TRACKING_QA_OUTPUT){await page.setViewportSize({width:390,height:844});await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/early-login-mobile.png',fullPage:true});}
  await page.locator('[data-ctwpml-early-offer] [data-ctwpml-passkey-login]').click();await page.waitForURL('**ctwpml_early_resume=1');assert.equal(verified,true);
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-ctwpml-menu-label]')].every(n=>n.textContent==='Logado'));
  assert.equal(await page.locator('.ctwpml-login-icon').first().evaluate(node=>getComputedStyle(node).color),'rgb(0, 117, 255)');
  // Sessão guest isolada, caminho sem chave e preservação do e-mail sem login implícito.
  logged=false;method='password';accountExists=false;await page.goto('https://passkeys.example.test/checkout/');await page.evaluate(()=>CTWPML_EarlyLogin.offer(email=>window.fixtureManual=email));
  await page.locator('#ctwpml-early-email').fill('new@example.test');await page.locator('#ctwpml-early-email-form button').click();await page.waitForFunction(()=>window.fixtureManual==='new@example.test');assert.equal(logged,false);
  // Os dois gatilhos abrem o mesmo diálogo acima de headers, alternativa e reset funcionais.
  for(const index of [0,1]){await page.locator('[data-ctwpml-menu-login]').nth(index).click();await page.locator('#ctwpml-menu-access').waitFor({state:'visible'});await page.locator('[data-ctwpml-access-close]').click();}
  await page.locator('[data-ctwpml-menu-login]').first().click();await page.locator('[data-ctwpml-menu-password]').click();await page.locator('#ctwpml-menu-password-form').waitFor({state:'visible'});
  assert.equal(await page.locator('#ctwpml-menu-access a').getAttribute('target'),'_blank');assert.match(await page.locator('#ctwpml-menu-access a').getAttribute('href'),/wp-login.php\?action=lostpassword$/);
  await page.locator('#ctwpml-menu-password-form [name="email"]').fill('fixture@example.test');await page.locator('#ctwpml-menu-password-form [name="password"]').fill('fixture-proof');await page.locator('#ctwpml-menu-password-form [type="submit"]').click();await page.waitForURL('**ctwpml_session_refresh=*');assert.equal(logged,true);
  logged=false;captchaEnabled=true;await page.goto('https://passkeys.example.test/checkout/');
  await page.evaluate(()=>{window.grecaptcha={render:(node,options)=>{window.fixtureCaptchaOptions=options;return 11},getResponse:()=>window.fixtureCaptchaToken||'',reset:()=>{window.fixtureCaptchaToken=''}}});
  await page.locator('[data-ctwpml-menu-login]').first().click();await page.locator('[data-ctwpml-menu-password]').click();
  await page.waitForFunction(()=>!!window.fixtureCaptchaOptions);assert.equal(await page.locator('#ctwpml-menu-password-form [type="submit"]').isDisabled(),true);
  await page.evaluate(()=>{fixtureCaptchaToken='fixture-captcha-proof';fixtureCaptchaOptions.callback()});assert.equal(await page.locator('#ctwpml-menu-password-form [type="submit"]').isDisabled(),false);
  await page.evaluate(()=>fixtureCaptchaOptions['expired-callback']());assert.equal(await page.locator('#ctwpml-menu-password-form [type="submit"]').isDisabled(),true);
  await page.evaluate(()=>fixtureCaptchaOptions['error-callback']());assert.equal(await page.locator('[data-ctwpml-menu-captcha-retry]').isVisible(),true);
  await page.locator('[data-ctwpml-menu-captcha-retry]').click();await page.evaluate(()=>{fixtureCaptchaToken='fixture-captcha-proof';fixtureCaptchaOptions.callback()});
  await page.locator('#ctwpml-menu-password-form [name="email"]').fill('fixture@example.test');await page.locator('#ctwpml-menu-password-form [name="password"]').fill('fixture-proof');await page.locator('#ctwpml-menu-password-form [type="submit"]').click();await page.waitForURL('**ctwpml_session_refresh=*');assert.equal(logged,true);
  // Cliente antigo sem chave: consulta não autentica; senha errada não libera convite ou cadastro.
  logged=false;accountExists=true;captchaEnabled=false;hasPasskeys=false;usedPasskey=false;enrollmentSeen=false;
  await page.goto('https://passkeys.example.test/checkout/');await page.evaluate(()=>CTWPML_EarlyLogin.offer(()=>window.fixtureManual=true));
  const beforeRegister=calls.filter(c=>c.action==='secure_passkeys_frontend_register_passkey').length;
  await page.locator('#ctwpml-early-email').fill('fixture@example.test');await page.locator('#ctwpml-early-email-form button').click();await page.locator('[data-ctwpml-early-existing]').waitFor({state:'visible'});
  assert.equal(logged,false);assert.equal(await page.locator('[data-ctwpml-passkey-register]').count(),0);assert.equal(registered,false);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  if(process.env.TRACKING_QA_OUTPUT)await page.screenshot({path:process.env.TRACKING_QA_OUTPUT+'/early-existing-no-key.png',fullPage:true});
  await page.locator('[data-ctwpml-early-existing-login]').click();await page.locator('#ctwpml-menu-password-form').waitFor({state:'visible'});
  assert.equal(await page.locator('#ctwpml-menu-password-form [name="email"]').inputValue(),'fixture@example.test');
  await page.locator('#ctwpml-menu-password-form [name="password"]').fill('wrong-fixture');await page.locator('#ctwpml-menu-password-form [type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-ctwpml-menu-message]').textContent.includes('Não foi possível entrar'));
  assert.equal(logged,false);assert.equal(await page.locator('[data-ctwpml-passkey-register]').count(),0);assert.equal(calls.filter(c=>c.action==='secure_passkeys_frontend_register_passkey').length,beforeRegister);
  await page.locator('#ctwpml-menu-password-form [name="password"]').fill('fixture-proof');await page.locator('#ctwpml-menu-password-form [type="submit"]').click();await page.waitForURL('**ctwpml_early_resume=1');
  await page.locator('[data-ctwpml-passkey-invite]').waitFor({state:'visible'});assert.equal(logged,true);
  await page.locator('[data-ctwpml-passkey-register]').click();await page.waitForFunction(()=>document.querySelector('#ctwpml-passkey-enroll h2').textContent.includes('Tudo pronto'));
  assert.equal(registered,true);await page.locator('[data-ctwpml-passkey-dismiss]').click();await page.locator('#ctwpml-passkey-enroll').waitFor({state:'hidden'});assert.equal(enrollmentSeen,true);
  assert.deepEqual(errors,[]);console.log('Edge: cliente com chave, novo/manual e cliente antigo sem chave; senha errada bloqueia, senha válida→convite→cadastro criptográfico nativo; menus/reset/captcha e320/390/768/1280 passaram.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
