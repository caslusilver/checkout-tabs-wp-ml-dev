// Two isolated authenticators, real native actions including name/count checks, no live website.
const {chromium}=require('playwright'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),assert=require('node:assert/strict');
const source=readFileSync('assets/js/passkeys.js','utf8');
let rows=[];
function native(input){
 const result=spawnSync(process.env.VAULT_PHP,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/passkeys-multiple-fixture.php'],{input:JSON.stringify({...input,rows:input.rows??rows}),encoding:'utf8',env:process.env});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const devices=[];
  for(const label of ['PC','Celular']){
   const context=await browser.newContext(),page=await context.newPage();let logged=true,challenge;
   const state={context,page,label,errors:[],lastCreate:null,lastLogin:null};devices.push(state);
   page.on('pageerror',error=>state.errors.push(error.message));
   const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');
   await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
   await context.route('https://**/*',async route=>{
    assert.equal(new URL(route.request().url()).hostname,'passkeys.example.test');
    if(new URL(route.request().url()).pathname==='/ajax'){
     const body=new URLSearchParams(route.request().postData()),action=body.get('action');let data;
     if(action==='ctwpml_passkey_context')data={nonce:'fixture-native',loggedIn:logged,canRegister:logged,hasPasskeys:rows.length>0};
     else if(action.endsWith('_options')){
      challenge=randomBytes(32).toString('base64');
      data=action.includes('register')?{challenge,timeout:30000,rp:{id:'passkeys.example.test',name:'Fixture'},user:{id:Buffer.from('fixture-account-42').toString('base64'),name:'fixture@example.test',displayName:'Fixture'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',excludeCredentials:rows.map(row=>({type:'public-key',id:row.credential_id}))}:{challenge,timeout:30000,rpId:'passkeys.example.test',userVerification:'required',allowCredentials:[]};
     }else{
      assert.equal(body.get('nonce'),'fixture-native');assert.equal(body.get('challenge'),challenge);
      const credential={rawId:body.get('rawId'),response:{}};
      for(const key of ['clientDataJSON','attestationObject','authenticatorData','signature'])if(body.has('response['+key+']'))credential.response[key]=body.get('response['+key+']');
      const creating=action==='secure_passkeys_frontend_register_passkey';
      assert.ok(creating||action==='secure_passkeys_frontend_login');if(creating)assert.equal(logged,true);
      const input={operation:creating?'create':'get',challenge,credential,name:body.get('security_key_name')};
      const result=native(input);assert.equal(result.error,undefined,JSON.stringify({error:result.error}));
      if(creating){assert.equal(body.get('ctwpml_registration_context'),'checkout');assert.match(input.name,/^Acesso rapido [a-f0-9]{12}$/);state.lastCreate=input;}
      else{assert.equal(result.user_id,42);state.lastLogin=input;logged=true;}
      rows=result.rows;data=[];
     }
     await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});return;
    }
    const ui=logged?'<div id="ctwpml-passkey-enroll" hidden><section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><button data-ctwpml-passkey-register>Ativar</button><button data-ctwpml-passkey-dismiss>Continuar</button><p class="ctwpml-passkey-message"></p></section></div>':'<section class="ctwpml-passkey-card"><button data-ctwpml-passkey-login>Entrar</button><p class="ctwpml-passkey-message"></p></section>';
    await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+ui+'<script>window.ctwpmlPasskeyConfig={ajax:"/ajax",checkout:true,loggedIn:'+logged+'}</script><script>'+source+'</script>'});
   });
   await page.goto('https://passkeys.example.test/checkout/');await page.evaluate(()=>window.CTWPMLPasskeys.beforeCheckout(()=>{}));
   await page.locator('[data-ctwpml-passkey-register]').click();await page.waitForFunction(()=>document.querySelector('.ctwpml-passkey-card h2')?.textContent.includes('Tudo pronto'));
   state.logout=()=>{logged=false;};
  }
  assert.equal(rows.length,2);assert.notEqual(rows[0].credential_id,rows[1].credential_id);assert.notEqual(rows[0].security_key_name,rows[1].security_key_name);
  const originalRows=structuredClone(rows);
  // Reproduce the old defect using the real name check, with a different valid device credential.
  const oldRows=[{...rows[0],security_key_name:'Acesso rapido'}];
  const duplicate=native({...devices[1].lastCreate,name:'Acesso rapido',rows:oldRows});
  assert.match(duplicate.error,/Already_Registered_Exception$/);assert.deepEqual(duplicate.rows,oldRows);
  const sameCredential=native(devices[0].lastCreate);assert.match(sameCredential.error,/Already_Registered_Exception$/);assert.deepEqual(sameCredential.rows,rows);
  const limit=native({...devices[1].lastCreate,options:{registration_maximum_passkeys_per_user:2}});assert.match(limit.error,/Reach_Maximum_Credentials_Exception$/);assert.deepEqual(limit.rows,rows);
  for(const state of devices){
   state.logout();await state.page.goto('https://passkeys.example.test/checkout/');await state.page.locator('[data-ctwpml-passkey-login]').click();
   await state.page.waitForURL('**ctwpml_session_refresh=*');assert.ok(state.lastLogin);assert.deepEqual(state.errors,[]);
  }
  assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.credential_id),originalRows.map(row=>row.credential_id));
  assert.ok(rows.every(row=>row.sign_count>0));
  const invalid=structuredClone(devices[0].lastLogin);const signature=Buffer.from(invalid.credential.response.signature,'base64');signature[signature.length-1]^=1;invalid.credential.response.signature=signature.toString('base64');
  assert.ok(native(invalid).error,'Invalid proof must not authenticate');
  console.log('Edge + native Secure Passkeys actions: two separate device registrations retained; both logins verified. Old name collision reproduced; duplicate credential, limit and invalid proof rejected without deleting records.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
