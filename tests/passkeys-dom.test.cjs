const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const source=readFileSync('assets/js/passkeys.js','utf8');
const until=async check=>{for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());};
function setup(t,{register=false,logged=false,fail=false,hasKeys=false,usedKey=false,registrationFailure=null}={}){
 const html=register?'<div id="ctwpml-passkey-enroll" hidden><section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><button data-ctwpml-passkey-register>Ativar</button><button data-ctwpml-passkey-dismiss>Agora não</button><p class="ctwpml-passkey-message"></p></section></div>':'<div id="ctwpml-passkey-entry" hidden><section class="ctwpml-passkey-card"><button data-ctwpml-passkey-login>Usar meus dados salvos</button><p class="ctwpml-passkey-message"></p></section><button data-ctwpml-passkey-skip>Continuar</button></div>';
 const dom=new JSDOM(html,{url:'https://shop.example.test/checkout/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,d=w.document,calls=[],credentials=[];
 w.ctwpmlPasskeyConfig={ajax:'/ajax',checkout:true,loggedIn:logged,registerErrors:{REGISTER_DUPLICATE:'Este acesso já está cadastrado.',REGISTER_LIMIT:'Sua conta atingiu o limite de acessos rápidos.'}};w.PublicKeyCredential=function(){};Object.defineProperty(w,'isSecureContext',{value:true});
 const buffer=new Uint8Array([1,2,3]).buffer;
 Object.defineProperty(w.navigator,'credentials',{value:{get:async options=>{credentials.push(options);throw new w.DOMException('cancel','NotAllowedError');},create:async options=>{credentials.push(options);return {id:'fixture',rawId:buffer,type:'public-key',response:{clientDataJSON:buffer,attestationObject:buffer}};}}});
 w.fetch=async(url,opts)=>{const action=opts.body.get('action');calls.push({action,body:Object.fromEntries(opts.body),opts});let data;
 if(action==='ctwpml_passkey_context')data={nonce:'fresh-engine-nonce',loggedIn:register,canRegister:register,hasPasskeys:hasKeys,usedPasskey:usedKey};
 else if(action.endsWith('_options'))data={challenge:'AQID',timeout:10000,rpId:'shop.example.test',userVerification:'required',user:{id:'AQID'},excludeCredentials:[{type:'public-key',id:'AQID'}],allowCredentials:[]};
 else data={saved:true};const rejected=registrationFailure!==null&&action==='secure_passkeys_frontend_register_passkey';return {ok:!fail,json:async()=>({success:!fail&&!rejected,data:rejected?registrationFailure:data})};};
 w.eval(source);return{w,d,calls,credentials};
}
test('offer is optional, cancellation restores buttons and never submits or navigates a purchase',async t=>{
 const c=setup(t);c.w.localStorage.setItem('ctwpml_passkey_used','1');let continued=0;assert.equal(c.w.CTWPMLPasskeys.offer(()=>continued++),true);
 c.d.querySelector('[data-ctwpml-passkey-login]').click();c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('cancelado'));
 assert.equal(c.calls.length,2);assert.equal(c.credentials.length,1);assert.equal(c.calls[1].body.nonce,'fresh-engine-nonce');
 assert.equal(c.credentials[0].publicKey.userVerification,'required');
 assert.equal(c.d.querySelector('[data-ctwpml-passkey-login]').disabled,false);
 c.d.querySelector('[data-ctwpml-passkey-skip]').click();assert.equal(continued,1);assert.equal(c.w.CTWPMLPasskeys.offer(()=>{}),false);
 assert.equal(c.w.location.pathname,'/checkout/');
});
test('registration uses native engine actions and base64 attestation, with authenticated context',async t=>{
 const c=setup(t,{register:true,logged:true});let resumed=0;assert.equal(c.w.CTWPMLPasskeys.beforeCheckout(()=>resumed++),true);await until(()=>!c.d.querySelector('[data-ctwpml-passkey-invite]').hidden);
 c.d.querySelector('[data-ctwpml-passkey-register]').click();await until(()=>c.calls.some(x=>x.action==='secure_passkeys_frontend_register_passkey'));
 await until(()=>c.d.querySelector('.ctwpml-passkey-card h2')?.textContent.includes('Tudo pronto'));
 const body=c.calls.find(x=>x.action==='secure_passkeys_frontend_register_passkey').body;assert.equal(body.nonce,'fresh-engine-nonce');assert.equal(body.challenge,'AQID');assert.equal(body.rawId,'AQID');assert.equal(body['response[attestationObject]'],'AQID');assert.match(body.security_key_name,/^Acesso rapido [a-f0-9]{12}$/);assert.equal(body.ctwpml_registration_context,'checkout');
 assert.equal(c.d.querySelector('[data-ctwpml-passkey-register]'),null);c.d.querySelector('[data-ctwpml-passkey-dismiss]').click();await until(()=>resumed===1);assert.equal(resumed,1);assert.equal(c.w.CTWPMLPasskeys.beforeCheckout(()=>{}),false);
 assert.ok(c.calls.every(call=>call.opts.credentials==='same-origin'&&call.opts.cache==='no-store'));
 assert.equal(c.w.localStorage.getItem('ctwpml_passkey_used'),'1');
});
test('failed bootstrap releases the action and does not call a passkey endpoint',async t=>{
 const c=setup(t,{fail:true});c.w.CTWPMLPasskeys.offer(()=>{});c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('Não foi possível'));
 assert.equal(c.calls.length,1);assert.equal(c.d.querySelector('[data-ctwpml-passkey-login]').disabled,false);assert.equal(c.credentials.length,0);
});
test('unsupported browser preserves the existing checkout path',t=>{
 const c=setup(t);c.w.PublicKeyCredential=undefined;assert.equal(c.w.CTWPMLPasskeys.offer(()=>{}),false);assert.equal(c.d.querySelector('#ctwpml-passkey-entry').hidden,true);
});

test('anonymous browser without prior successful access goes directly to checkout without a passkey prompt', t=>{const c=setup(t);assert.equal(c.w.CTWPMLPasskeys.offer(()=>{}),false);assert.equal(c.d.querySelector('#ctwpml-passkey-entry').hidden,true);assert.equal(c.calls.length,0);});
test('declining enrollment continues the pending checkout once and never registers a key',async t=>{
 const c=setup(t,{register:true,logged:true});let continued=0;
 assert.equal(c.w.CTWPMLPasskeys.beforeCheckout(()=>continued++),true);
 await until(()=>!c.d.querySelector('#ctwpml-passkey-enroll').hidden);
 c.d.querySelector('[data-ctwpml-passkey-dismiss]').click();
 await until(()=>continued===1);assert.equal(continued,1);assert.equal(c.w.CTWPMLPasskeys.beforeCheckout(()=>continued++),false);
 assert.equal(c.calls.length,2);assert.equal(c.credentials.length,0);
});

test('existing key on account does not suppress registration on another or reset device',async t=>{
 const c=setup(t,{register:true,logged:true,hasKeys:true});let continued=0;c.w.CTWPMLPasskeys.beforeCheckout(()=>continued++);
 await until(()=>!c.d.querySelector('#ctwpml-passkey-enroll').hidden);assert.equal(continued,0);
 c.d.querySelector('[data-ctwpml-passkey-dismiss]').click();await until(()=>continued===1);
});
test('a server-confirmed passkey login skips redundant enrollment and continues once',async t=>{
 const c=setup(t,{register:true,logged:true,hasKeys:true,usedKey:true});let continued=0;c.w.CTWPMLPasskeys.beforeCheckout(()=>continued++);
 await until(()=>continued===1);assert.equal(c.d.querySelector('#ctwpml-passkey-enroll').hidden,true);assert.equal(c.credentials.length,0);
});

test('registrations on two devices use different names and retain native exclusion options',async t=>{
 const names=[];
 for(let i=0;i<2;i++){
  const c=setup(t,{register:true,logged:true,hasKeys:true});c.w.CTWPMLPasskeys.beforeCheckout(()=>{});
  await until(()=>!c.d.querySelector('[data-ctwpml-passkey-invite]').hidden);c.d.querySelector('[data-ctwpml-passkey-register]').click();
  await until(()=>c.d.querySelector('.ctwpml-passkey-card h2'));
  names.push(c.calls.find(x=>x.action==='secure_passkeys_frontend_register_passkey').body.security_key_name);
  assert.equal(c.credentials[0].publicKey.excludeCredentials.length,1);
 }
 assert.notEqual(names[0],names[1]);
});
for(const [reason,text]of [['REGISTER_DUPLICATE','Este acesso já está cadastrado.'],['REGISTER_LIMIT','Sua conta atingiu o limite de acessos rápidos.'],['request_failed','private fixture response']]){
 test('registration rejection '+reason+' releases controls and permits checkout without retry',async t=>{
  const c=setup(t,{register:true,logged:true,registrationFailure:text});let continued=0;c.w.CTWPMLPasskeys.beforeCheckout(()=>continued++);
  await until(()=>!c.d.querySelector('[data-ctwpml-passkey-invite]').hidden);c.d.querySelector('[data-ctwpml-passkey-register]').click();
  await until(()=>c.calls.some(x=>x.action==='secure_passkeys_frontend_register_passkey')&&!c.d.querySelector('[data-ctwpml-passkey-register]').disabled);
  const message=c.d.querySelector('.ctwpml-passkey-message').textContent;
  assert.equal(message,reason==='request_failed'?'Não foi possível salvar o acesso. Sua compra pode continuar normalmente.':text);
  assert.equal(c.calls.filter(x=>x.action==='secure_passkeys_frontend_register_passkey').length,1);assert.equal(continued,0);
  c.d.querySelector('[data-ctwpml-passkey-dismiss]').click();await until(()=>continued===1);
 });
}
