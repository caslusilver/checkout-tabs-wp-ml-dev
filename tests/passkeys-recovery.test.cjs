const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const source=readFileSync('assets/js/passkeys.js','utf8');
const modal=readFileSync('assets/js/address-ml-modal.js','utf8');
const errors={CHECKOUT_ACCOUNT_MISMATCH:'Esta chave pertence a outra conta.',CHECKOUT_ACCOUNT_CONTEXT_MISSING:'Confira seus dados da compra.'};
const until=async check=>{for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());};
function fixture(t,{reason='CHECKOUT_ACCOUNT_MISMATCH',exists=1,privateMode=false}={}){
 const dom=new JSDOM(`<button id="ctwpml-modal-back">Voltar</button><div id="ctwpml-view-review"><input id="address" value="12"><input id="terms" type="checkbox" checked></div>
 <div id="ctwpml-view-auth"><div class="ctwpml-login-popup ctwpml-passkey-first" aria-modal="true" data-ctwpml-expected-email="checkout@example.test"><section class="ctwpml-passkey-card">
 <button data-ctwpml-passkey-login>Entrar</button><button data-ctwpml-passkey-back>Conferir meus dados</button><p class="ctwpml-passkey-message"></p></section>
 <form id="ctwpml-auth-form"><input id="ctwpml-login-email" value="checkout@example.test"><input id="ctwpml-login-password" value="typed-password"></form></div></div>`,{url:'https://shop.example.test/checkout/',runScripts:'outside-only'});
 t.after(()=>dom.window.close());const w=dom.window,d=w.document,calls=[],traces=[];
 const $=require('jquery')(w);w.$=w.jQuery=$;$('#ctwpml-view-review').hide();
 w.state={checkpoint:(event,ok,data)=>traces.push({event,ok,data}),__ctwpmlAuthReturnView:'review'};w.CCCheckoutTabsState=w.state;
 w.currentView='auth';w.showReviewConfirmScreen=()=>{w.currentView='review';$('#ctwpml-view-review').show();};
 w.eval('function fixtureBack(){'+modal.slice(modal.indexOf("      if (currentView === 'auth') {",modal.indexOf("$(document).on('click', '#ctwpml-modal-back'")),modal.indexOf("      if (currentView === 'payment') {",modal.indexOf("$(document).on('click', '#ctwpml-modal-back'")))+'}');
 d.querySelector('#ctwpml-modal-back').addEventListener('click',w.fixtureBack);
 w.ctwpmlPasskeyConfig={ajax:'/ajax',checkout:true,loggedIn:false,checkEmailNonce:'email-nonce',loginErrors:errors};
 Object.defineProperty(w,'isSecureContext',{value:true});w.PublicKeyCredential=function(){};
 if(privateMode)w.PublicKeyCredential.getClientCapabilities=async()=>({immediateGet:false});
 const buffer=new Uint8Array([1,2,3]).buffer;
 Object.defineProperty(w.navigator,'credentials',{value:{get:async()=>({id:'key',rawId:buffer,type:'public-key',response:{clientDataJSON:buffer,authenticatorData:buffer,signature:buffer}}),create:async()=>{throw new Error('Unauthenticated creation attempted');}}});
 w.fetch=async(url,opts)=>{const body=Object.fromEntries(opts.body);calls.push(body);const action=body.action;
  if(action==='secure_passkeys_frontend_login')return {ok:true,status:200,json:async()=>({success:false,data:errors[reason]||'<unsafe server error>'})};
  const data=action==='ctwpml_passkey_context'?{nonce:'engine-nonce',loggedIn:false,canRegister:false}:action==='ctwpml_check_email'?{exists,auth_method:'passkey'}:{challenge:'AQID',timeout:10000,allowCredentials:[]};
  return {ok:true,status:200,json:async()=>({success:true,data})};
 };
 w.eval(source);return {w,d,calls,traces,$};
}
for(const privateMode of [false,true])test(`wrong account falls back without registration or losing fields (private=${privateMode})`,async t=>{
 const c=fixture(t,{privateMode}),button=c.d.querySelector('[data-ctwpml-passkey-login]');button.click();button.click();
 await until(()=>button.textContent==='Usar outra chave'&&!button.disabled);
 assert.deepEqual(c.calls.map(x=>x.action),['ctwpml_passkey_context','ctwpml_check_email','secure_passkeys_frontend_get_login_options','secure_passkeys_frontend_login']);
 assert.equal(c.calls[1].email,'checkout@example.test');assert.equal(c.calls[1]._ajax_nonce,'email-nonce');assert.equal(c.calls[3].ctwpml_context,'checkout-late');
 assert.equal(c.d.querySelector('.ctwpml-login-popup').classList.contains('ctwpml-passkey-first'),false);
 assert.equal(c.d.activeElement.id,'ctwpml-login-password');assert.equal(c.d.querySelector('#ctwpml-login-password').value,'typed-password');
 assert.equal(c.d.querySelector('.ctwpml-passkey-message').textContent,errors.CHECKOUT_ACCOUNT_MISMATCH);
 assert.ok(c.traces.some(x=>x.event==='CHK_PASSKEY_LOGIN_ERROR'&&x.ok===false&&x.data.outcome==='CHECKOUT_ACCOUNT_MISMATCH'));
 assert.equal(c.w.localStorage.getItem('ctwpml_passkey_used'),null);
 c.d.querySelector('[data-ctwpml-passkey-back]').click();assert.equal(c.w.currentView,'review');assert.equal(c.d.querySelector('#ctwpml-view-auth').style.display,'none');
 assert.equal(c.d.querySelector('#terms').checked,true);assert.equal(c.d.querySelector('#address').value,'12');
});
test('missing account context stops before requesting proof and focuses return to data',async t=>{
 const c=fixture(t,{exists:0});c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent===errors.CHECKOUT_ACCOUNT_CONTEXT_MISSING);
 assert.equal(c.calls.length,2);assert.equal(c.d.activeElement.dataset.ctwpmlPasskeyBack,'');
});
test('arbitrary native failure is never echoed and never creates a key',async t=>{
 const c=fixture(t,{reason:'untrusted'});c.d.querySelector('[data-ctwpml-passkey-login]').click();
 await until(()=>c.d.querySelector('.ctwpml-passkey-message').textContent.includes('Não foi possível entrar'));
 assert.ok(!c.d.querySelector('.ctwpml-passkey-message').textContent.includes('unsafe'));
 assert.ok(c.calls.every(x=>!x.action.includes('register')));
});
test('navigation waits for an active proof and restores the previous view afterwards',async t=>{
 const c=fixture(t);let reject;
 c.w.navigator.credentials.get=()=>new Promise((_,no)=>{reject=no;});
 c.d.querySelector('[data-ctwpml-passkey-login]').click();await until(()=>!!reject);
 c.d.querySelector('#ctwpml-modal-back').click();assert.equal(c.w.currentView,'auth');
 reject(new c.w.DOMException('cancelled','NotAllowedError'));await until(()=>!c.w.CTWPMLPasskeys.isBusy());
 c.d.querySelector('#ctwpml-modal-back').click();assert.equal(c.w.currentView,'review');
 assert.equal(c.d.querySelector('.ctwpml-login-popup').hasAttribute('aria-modal'),false);
});
