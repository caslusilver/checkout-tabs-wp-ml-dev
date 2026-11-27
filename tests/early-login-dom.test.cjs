const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const source=readFileSync('assets/js/early-login.js','utf8');
const php=process.env.VAULT_PHP;
const result=spawnSync(php,['tests/early-login.test.php','--markup'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr+result.stdout);
const until=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,5));assert.ok(predicate());};
function setup(t,{enabled=true,method='passkey',exists=true,ticket='fixture-route',defer=false,preferPassword=false,loginError=false}={}){
 const dom=new JSDOM(result.stdout,{url:'https://shop.example.test/checkout/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,calls=[];let logged=false,resolver;
 w.ctwpmlEarlyLoginConfig={enabled,checkout:true,account:'/account/'};w.ctwpmlPasskeyConfig={loggedIn:false};
 w.CTWPMLPasskeys={isBusy:()=>false,supported:()=>true,preferPassword:()=>preferPassword,request:async(action,data)=>{
  calls.push({action,data});if(action==='ctwpml_passkey_context')return {loggedIn:logged,checkEmailNonce:'fresh-email',loginNonce:'fresh-login',recaptchaEnabled:false};
  if(action==='ctwpml_check_email'){if(defer)return new Promise(resolve=>{resolver=resolve});return {exists:exists?1:0,auth_method:method,ticket};}
  if(action==='ctwpml_login'){if(loginError)throw new Error('login_rejected');logged=true;return {ok:true};}throw new Error('unexpected action');
 }};w.eval(source);
 return {w,d,calls,logged:value=>{logged=value},resolve:value=>resolver(value)};
}
test('two menus share one dialog and never show logged-in based on remembered browser data',async t=>{
 const c=setup(t);await until(()=>c.calls.length>0);
 assert.equal(c.d.querySelectorAll('[data-ctwpml-menu-login]').length,2);assert.equal(c.d.querySelectorAll('#ctwpml-menu-access').length,1);
 assert.ok([...c.d.querySelectorAll('[data-ctwpml-menu-label]')].every(n=>n.textContent==='Login'));
 c.d.querySelector('[data-ctwpml-menu-login]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-access').hidden);
 c.d.querySelector('[data-ctwpml-menu-password]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-password-form').hidden);
 const link=c.d.querySelector('#ctwpml-menu-access a');assert.equal(link.href,'https://shop.example.test/wp-login.php?action=lostpassword');assert.equal(link.target,'_blank');
 assert.equal(c.d.querySelectorAll('#ctwpml-login-email').length,0); // Existing checkout form is not cloned/moved.
 await new Promise(r=>setTimeout(r,0));c.d.querySelector('[data-ctwpml-access-close]').click();assert.equal(c.d.body.style.overflow,'');
 c.logged(true);c.w.Date.now=()=>Date.now()+10000;c.w.dispatchEvent(new c.w.Event('focus'));
 await until(()=>[...c.d.querySelectorAll('[data-ctwpml-menu-label]')].every(n=>n.textContent==='Logado'));
});
test('first-purchase guidance keeps login options, reinforces failures and closes checkout dialog without clearing purchase fields',async t=>{
 const c=setup(t,{loginError:true});await until(()=>c.calls.length>0);c.d.querySelector('[data-ctwpml-menu-login]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-access').hidden);
 assert.equal(c.d.querySelectorAll('[data-ctwpml-first-purchase]').length,1);assert.equal(c.d.querySelector('[data-ctwpml-first-purchase]').hidden,false);
 assert.ok(c.d.querySelector('[data-ctwpml-passkey-login]'));assert.ok(c.d.querySelector('a[href*="lostpassword"]'));
 c.w.document.dispatchEvent(new c.w.CustomEvent('ctwpml:passkey-error',{detail:{early:false,code:'request_failed'}}));assert.equal(c.d.querySelector('[data-ctwpml-first-purchase-help]').hidden,false);
 c.d.querySelector('[data-ctwpml-menu-password]').click();const form=c.d.querySelector('#ctwpml-menu-password-form');await until(()=>!form.hidden);
 form.elements.email.value='fixture@example.test';form.elements.password.value='fixture-proof';form.dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>c.d.querySelector('[data-ctwpml-menu-message]').textContent.includes('Não foi possível entrar'));
 assert.equal(form.elements.email.value,'fixture@example.test');assert.equal(form.querySelector('[type=submit]').disabled,false);assert.equal(c.d.querySelector('[data-ctwpml-first-purchase-help]').hidden,false);
 assert.equal(c.calls.some(x=>x.action==='ctwpml_check_email'),false);assert.match(c.d.querySelector('[data-ctwpml-first-purchase-help]').textContent,/Se você ainda não tem conta/);
 const field=c.d.createElement('input');field.value='purchase-preserved';c.d.body.append(field);c.d.querySelector('[data-ctwpml-menu-shop]').click();
 assert.equal(c.d.querySelector('#ctwpml-menu-access').hidden,true);assert.equal(field.value,'purchase-preserved');assert.equal(form.elements.password.value,'');
});
test('authenticated early recovery isolates drafts from guest and other accounts, including reload',t=>{
 const source=readFileSync('assets/js/address-ml-modal.js','utf8');
 const block=source.slice(source.indexOf("    var CTWPML_MODAL_STATE_KEY ="),source.indexOf('    var CTWPML_ORDER_COMPLETED_TTL_MS'));
 const dom=new JSDOM('',{url:'https://shop.example.test/checkout/?ctwpml_early_resume=1',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 w.sessionStorage.setItem('ctwpml_ml_form_state_v1','guest-draft');w.state={params:{early_login_enabled:1,early_login_scope:'account-a'}};w.eval(block);
 assert.equal(w.CTWPML_FORM_STATE_KEY,'ctwpml_ml_form_state_v1_early_account-a');assert.equal(w.sessionStorage.getItem('ctwpml_ml_form_state_v1'),'guest-draft');
 w.history.replaceState({},'','/checkout/');w.eval(block);assert.equal(w.CTWPML_FORM_STATE_KEY,'ctwpml_ml_form_state_v1_early_account-a');
 w.state.params.early_login_scope='account-b';w.eval(block);assert.equal(w.CTWPML_FORM_STATE_KEY,'ctwpml_ml_form_state_v1');
 w.sessionStorage.setItem('ctwpml_early_profile_pending','1');w.eval(block);assert.equal(w.CTWPML_FORM_STATE_KEY,'ctwpml_ml_form_state_v1_early_account-b');
 w.state.params.early_login_enabled=0;w.eval(block);assert.equal(w.CTWPML_FORM_STATE_KEY,'ctwpml_ml_form_state_v1');
});
test('early resume requires address choice for multiple, edits incomplete and applies only a complete single address',()=>{
 const source=readFileSync('assets/js/address-ml-modal.js','utf8');
 const start=source.search(/if \(earlyResume\) \{\s+state.selectedShipping/),end=source.indexOf('        if (!items.length)',start);
 const run=new Function('items',`var earlyResume=true,state={selectedShipping:{methodId:'old'}},selectedAddressId=null,calls=[];
  function cepDigits(v){return String(v||'').replace(/\\D/g,'')}
  function showList(){calls.push('list')}function renderAddressList(){}function showFormForNewAddress(){calls.push('new')}
  function showFormForEditAddress(id){calls.push('edit:'+id)}function applySelectedAddressToWooFields(id){calls.push('apply:'+id)}function showShippingPlaceholder(){calls.push('shipping')}
  function route(){${source.slice(start,end)}}route();return {calls,shipping:state.selectedShipping,selected:selectedAddressId};`);
 assert.deepEqual(run([]).calls,['new']);assert.deepEqual(run([{id:'a'},{id:'b'}]).calls,['list']);assert.equal(run([{id:'a'},{id:'b'}]).selected,null);
 assert.deepEqual(run([{id:'a'}]).calls,['edit:a']);
 const full={id:'a',address_1:'Rua Fixture',number:'12',city:'São Paulo',state:'SP',cep:'06400-000'};
 assert.deepEqual(run([full]),{calls:['apply:a','shipping'],shipping:null,selected:'a'});
});
test('email lookup offers a bound key without loading an address or starting authentication',async t=>{
 const c=setup(t);let continued='none';assert.equal(c.w.CTWPML_EarlyLogin.offer(email=>continued=email),true);
 c.d.querySelector('#ctwpml-early-email').value='fixture@example.test';c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>!c.d.querySelector('[data-ctwpml-early-offer]').hidden);
 assert.equal(c.d.querySelector('#ctwpml-early-email-form').hidden,true);
 assert.equal(c.d.querySelector('#ctwpml-early-email').readOnly,true);
 assert.equal(c.d.querySelector('[data-ctwpml-early-email-value]').textContent,'fixture@example.test');
 assert.match(c.d.querySelector('[data-ctwpml-early-title]').textContent,/Encontramos seu acesso rápido/);
 const call=c.calls.find(v=>v.action==='ctwpml_check_email');assert.equal(call.data._ajax_nonce,'fresh-email');assert.equal(call.data.early,1);
 assert.equal(c.d.querySelector('[data-ctwpml-early-offer] [data-ctwpml-passkey-login]').dataset.ctwpmlEarlyTicket,'fixture-route');
 assert.equal(continued,'none');assert.equal(c.calls.some(v=>v.action.includes('address')||v.action==='ctwpml_login'),false);
 c.d.querySelector('[data-ctwpml-early-password]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-password-form').hidden);
 assert.equal(c.d.querySelector('#ctwpml-menu-password-form [name="email"]').value,'fixture@example.test');
 c.d.querySelector('[data-ctwpml-access-close]').click();assert.equal(c.d.querySelector('#ctwpml-early-access').hidden,false);
 c.d.querySelector('[data-ctwpml-early-manual]').click();assert.equal(continued,'fixture@example.test');
});
test('editing email removes the previous route and requires explicit Consultar before restoring priority',async t=>{
 const c=setup(t);c.w.CTWPML_EarlyLogin.offer(()=>{});
 const input=c.d.querySelector('#ctwpml-early-email'),form=c.d.querySelector('#ctwpml-early-email-form');
 input.value='first@example.test';form.dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>form.hidden);c.d.querySelector('[data-ctwpml-early-edit]').click();
 assert.equal(form.hidden,false);assert.equal(input.readOnly,false);assert.equal(form.querySelector('button').textContent,'Consultar');assert.equal(c.d.activeElement,input);
 assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,true);
 assert.equal(c.d.querySelector('[data-ctwpml-early-offer] button').hasAttribute('data-ctwpml-early-ticket'),false);
 input.value='second@example.test';input.dispatchEvent(new c.w.Event('input',{bubbles:true}));
 const before=c.calls.filter(v=>v.action==='ctwpml_check_email').length;await new Promise(r=>setTimeout(r,650));
 assert.equal(c.calls.filter(v=>v.action==='ctwpml_check_email').length,before);
 form.dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>form.hidden);
 assert.equal(c.calls.filter(v=>v.action==='ctwpml_check_email').at(-1).data.email,'second@example.test');
 assert.equal(c.d.querySelector('[data-ctwpml-early-email-value]').textContent,'second@example.test');
});
test('no key, unavailable ticket and disabled option keep the normal purchase path',async t=>{
 for(const options of [{method:'password',exists:false,ticket:''},{method:'passkey',ticket:''}]){
  const c=setup(t,options);let continued=false;c.w.CTWPML_EarlyLogin.offer(()=>continued=true);c.d.querySelector('#ctwpml-early-email').value='new@example.test';
  c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>continued);
  assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,true);
 }
 const c=setup(t,{enabled:false});assert.equal(c.w.CTWPML_EarlyLogin.offer(()=>assert.fail()),false);
});
test('existing account without a key offers bound password login; lookup never authenticates or registers',async t=>{
 const c=setup(t,{method:'password'});let continued=false;c.w.CTWPML_EarlyLogin.offer(()=>continued=true);
 const input=c.d.querySelector('#ctwpml-early-email');input.value='fixture@example.test';
 c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>!c.d.querySelector('[data-ctwpml-early-existing]').hidden);
 assert.equal(continued,false);assert.equal(c.d.querySelector('#ctwpml-early-email-form').hidden,true);assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,true);
 assert.ok(c.calls.every(v=>['ctwpml_passkey_context','ctwpml_check_email'].includes(v.action)));
 c.d.querySelector('[data-ctwpml-early-existing-login]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-password-form').hidden);
 assert.equal(c.d.querySelector('#ctwpml-menu-password-form [name="email"]').value,'fixture@example.test');
 assert.equal(c.d.querySelector('#ctwpml-menu-access .ctwpml-passkey-card').hidden,true);
 assert.equal(c.d.activeElement,c.d.querySelector('#ctwpml-menu-password-form [name="password"]'));
 assert.equal(c.calls.some(v=>v.action.includes('register')||v.action==='ctwpml_login'),false);
 c.d.querySelector('[data-ctwpml-access-close]').click();assert.equal(c.d.querySelector('[data-ctwpml-early-existing]').hidden,false);
 c.d.querySelector('[data-ctwpml-early-edit]').click();assert.equal(c.d.querySelector('[data-ctwpml-early-existing]').hidden,true);
 assert.equal(input.value,'fixture@example.test');
 c.d.querySelector('[data-ctwpml-early-manual]').click();assert.equal(continued,true);
});
test('changing email or continuing manually invalidates pending lookup; expired route requires renewal',async t=>{
 const c=setup(t,{defer:true});let continued='';c.w.CTWPML_EarlyLogin.offer(email=>continued=email);
 c.d.querySelector('#ctwpml-early-email').value='first@example.test';c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>c.calls.some(v=>v.action==='ctwpml_check_email'));
 c.d.querySelector('#ctwpml-early-email').value='second@example.test';c.d.querySelector('#ctwpml-early-email').dispatchEvent(new c.w.Event('input',{bubbles:true}));
 c.d.querySelector('[data-ctwpml-early-manual]').click();c.resolve({exists:1,auth_method:'passkey',ticket:'stale-route'});await new Promise(r=>setTimeout(r,20));
 assert.equal(continued,'second@example.test');assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,true);
 const another=setup(t);another.w.CTWPML_EarlyLogin.offer(()=>{});another.d.querySelector('#ctwpml-early-email').value='fixture@example.test';another.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new another.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>!another.d.querySelector('[data-ctwpml-early-offer]').hidden);
 another.d.dispatchEvent(new another.w.CustomEvent('ctwpml:passkey-error',{detail:{early:true,code:'CHECKOUT_ACCOUNT_CONTEXT_MISSING'}}));
 assert.equal(another.d.querySelector('[data-ctwpml-early-offer]').hidden,true);assert.match(another.d.querySelector('[data-ctwpml-early-message]').textContent,/novamente/);
});

test('desktop without local history prioritizes password even when the account has a passkey',async t=>{
 const c=setup(t,{preferPassword:true});c.w.CTWPML_EarlyLogin.offer(()=>{});
 c.d.querySelector('#ctwpml-early-email').value='fixture@example.test';c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>!c.d.querySelector('[data-ctwpml-early-existing]').hidden);
 assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,true);assert.equal(c.d.querySelector('#ctwpml-early-email-form').hidden,true);
 assert.equal(c.d.querySelector('[data-ctwpml-early-use-key]').hidden,false);
 assert.equal(c.calls.some(v=>v.action.includes('login')||v.action.includes('register')),false);
 c.d.querySelector('[data-ctwpml-early-existing-login]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-password-form').hidden);
 assert.equal(c.d.querySelector('[data-ctwpml-password-intro]').hidden,false);
 assert.match(c.d.querySelector('[data-ctwpml-password-intro]').textContent,/Depois.*ativar.*neste aparelho/);
 assert.equal(c.d.activeElement,c.d.querySelector('#ctwpml-menu-password-form [name="password"]'));
 c.d.querySelector('[data-ctwpml-access-close]').click();
 c.d.querySelector('[data-ctwpml-early-use-key]').click();assert.equal(c.d.querySelector('[data-ctwpml-early-offer]').hidden,false);
 assert.equal(c.calls.some(v=>v.action.includes('register')),false);
 c.d.dispatchEvent(new c.w.CustomEvent('ctwpml:passkey-error',{detail:{early:true,code:'request_failed'}}));
 assert.equal(c.d.querySelector('[data-ctwpml-early-existing]').hidden,false);assert.match(c.d.querySelector('[data-ctwpml-early-message]').textContent,/Entre com sua senha/);
});

test('a key failure in the early offer preserves the email and exposes the safe password path',async t=>{
 const c=setup(t);c.w.CTWPML_EarlyLogin.offer(()=>{});c.d.querySelector('#ctwpml-early-email').value='fixture@example.test';
 c.d.querySelector('#ctwpml-early-email-form').dispatchEvent(new c.w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!c.d.querySelector('[data-ctwpml-early-offer]').hidden);
 c.d.dispatchEvent(new c.w.CustomEvent('ctwpml:passkey-error',{detail:{early:true,code:'CHECKOUT_ACCOUNT_MISMATCH'}}));
 assert.equal(c.d.querySelector('[data-ctwpml-early-existing]').hidden,false);
 assert.equal(c.d.querySelector('[data-ctwpml-early-email-value]').textContent,'fixture@example.test');
 c.d.querySelector('[data-ctwpml-early-existing-login]').click();await until(()=>!c.d.querySelector('#ctwpml-menu-password-form').hidden);
 assert.equal(c.d.querySelector('#ctwpml-menu-password-form [name="email"]').value,'fixture@example.test');
 assert.equal(c.calls.some(v=>v.action.includes('register')),false);
});
