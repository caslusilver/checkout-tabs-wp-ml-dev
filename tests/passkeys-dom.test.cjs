const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const source=readFileSync('assets/js/passkeys.js','utf8');
const until=async check=>{for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());};
function setup(t,{register=false,logged=false,fail=false}={}){
 const html=register?'<section class="ctwpml-passkey-card" data-ctwpml-passkey-invite hidden><button data-ctwpml-passkey-register>Ativar</button><button data-ctwpml-passkey-dismiss>Agora não</button><p class="ctwpml-passkey-message"></p></section>':'<div id="ctwpml-passkey-entry" hidden><section class="ctwpml-passkey-card"><button data-ctwpml-passkey-login>Usar meus dados salvos</button><p class="ctwpml-passkey-message"></p></section><button data-ctwpml-passkey-skip>Continuar</button></div>';
 const dom=new JSDOM(html,{url:'https://shop.example.test/checkout/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,d=w.document,calls=[],credentials=[];
 w.ctwpmlPasskeyConfig={ajax:'/ajax',checkout:!register,loggedIn:logged};w.PublicKeyCredential=function(){};Object.defineProperty(w,'isSecureContext',{value:true});
 const buffer=new Uint8Array([1,2,3]).buffer;
 Object.defineProperty(w.navigator,'credentials',{value:{get:async options=>{credentials.push(options);throw new w.DOMException('cancel','NotAllowedError');},create:async options=>{credentials.push(options);return {id:'fixture',rawId:buffer,type:'public-key',response:{clientDataJSON:buffer,attestationObject:buffer}};}}});
 w.fetch=async(url,opts)=>{const action=opts.body.get('action');calls.push({action,body:Object.fromEntries(opts.body),opts});let data;
 if(action==='ctwpml_passkey_context')data={nonce:'fresh-engine-nonce',loggedIn:register,canRegister:register,hasPasskeys:false};
 else if(action.endsWith('_options'))data={challenge:'AQID',timeout:10000,rpId:'shop.example.test',userVerification:'required',user:{id:'AQID'},excludeCredentials:[{type:'public-key',id:'AQID'}],allowCredentials:[]};
 else data={saved:true};return {ok:!fail,json:async()=>({success:!fail,data})};};
 w.eval(source);return{w,d,calls,credentials};
}
test('offer is optional, cancellation restores buttons and never submits or navigates a purchase',async t=>{
 const c=setup(t);let continued=0;assert.equal(c.w.CTWPMLPasskeys.offer(()=>continued++),true);
 c.d.querySelector('[data-ctwpml-passkey-login]').click();c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('cancelado'));
 assert.equal(c.calls.length,2);assert.equal(c.credentials.length,1);assert.equal(c.calls[1].body.nonce,'fresh-engine-nonce');
 assert.equal(c.credentials[0].publicKey.userVerification,'required');
 assert.equal(c.d.querySelector('[data-ctwpml-passkey-login]').disabled,false);
 c.d.querySelector('[data-ctwpml-passkey-skip]').click();assert.equal(continued,1);assert.equal(c.w.CTWPMLPasskeys.offer(()=>{}),false);
 assert.equal(c.w.location.pathname,'/checkout/');
});
test('registration uses native engine actions and base64 attestation, with authenticated context',async t=>{
 const c=setup(t,{register:true,logged:true});await until(()=>!c.d.querySelector('[data-ctwpml-passkey-invite]').hidden);
 c.d.querySelector('[data-ctwpml-passkey-register]').click();await until(()=>c.calls.some(x=>x.action==='secure_passkeys_frontend_register_passkey'));
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('Acesso ativado'));
 const body=c.calls.at(-1).body;assert.equal(body.nonce,'fresh-engine-nonce');assert.equal(body.challenge,'AQID');assert.equal(body.rawId,'AQID');assert.equal(body['response[attestationObject]'],'AQID');assert.equal(body.security_key_name,'Acesso rapido');
 assert.equal(c.d.querySelector('[data-ctwpml-passkey-register]').hidden,true);
 assert.ok(c.calls.every(call=>call.opts.credentials==='same-origin'&&call.opts.cache==='no-store'));
 assert.equal(c.w.localStorage.length,0);assert.equal(c.w.sessionStorage.length,0);
});
test('failed bootstrap releases the action and does not call a passkey endpoint',async t=>{
 const c=setup(t,{fail:true});c.w.CTWPMLPasskeys.offer(()=>{});c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('Não foi possível'));
 assert.equal(c.calls.length,1);assert.equal(c.d.querySelector('[data-ctwpml-passkey-login]').disabled,false);assert.equal(c.credentials.length,0);
});
test('unsupported browser preserves the existing checkout path',t=>{
 const c=setup(t);c.w.PublicKeyCredential=undefined;assert.equal(c.w.CTWPMLPasskeys.offer(()=>{}),false);assert.equal(c.d.querySelector('#ctwpml-passkey-entry').hidden,true);
});
