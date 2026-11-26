const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{readFileSync}=require('node:fs'),{JSDOM}=require('jsdom');
const source=readFileSync('assets/js/passkeys.js','utf8');
async function until(check){for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());}
function setup(t,{capable=true,reject=false,deny=false}={}){
 const dom=new JSDOM('<a class="checkout-button" href="https://shop.example.test/checkout/?coupon=kept">Comprar</a>',{url:'https://shop.example.test/cart/'});t.after(()=>dom.window.close());
 let authenticated=false;const w=dom.window,calls=[],requests=[],nav=[];w.ctwpmlPasskeyConfig={cart:true,checkout:false,loggedIn:false,checkoutUrl:'https://shop.example.test/checkout/',ajax:'/ajax'};
 w.PublicKeyCredential={getClientCapabilities:async()=>({immediateGet:capable})};Object.defineProperty(w,'isSecureContext',{value:true});
 const buffer=new Uint8Array([1,2,3]).buffer;const navigator={credentials:{get:async options=>{requests.push(options);if(reject)throw new w.DOMException('private, absent or declined','NotAllowedError');return {id:'fixture',rawId:buffer,type:'public-key',response:{clientDataJSON:buffer,authenticatorData:buffer,signature:buffer}};}}};Object.defineProperty(w.navigator,'credentials',{value:navigator.credentials});
 const context={window:w,document:w.document,navigator,PublicKeyCredential:w.PublicKeyCredential,location:{origin:'https://shop.example.test',href:'https://shop.example.test/cart/',assign:url=>nav.push(url)},URL,URLSearchParams,AbortController,Uint8Array,performance,setTimeout,clearTimeout,atob,btoa,console,fetch:async(url,options)=>{
  const action=options.body.get('action');calls.push(action);if(action==='secure_passkeys_frontend_login'&&!deny)authenticated=true;
  let data=action==='ctwpml_passkey_context'?{nonce:'fresh',loggedIn:authenticated}:action.endsWith('_options')?{challenge:'AQID',rpId:'shop.example.test',allowCredentials:[],userVerification:'required'}:{};
  return {ok:true,status:200,json:async()=>({success:!(deny&&action==='secure_passkeys_frontend_login'),data})};
 }};vm.createContext(context);vm.runInContext(source,context);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return {w,calls,requests,nav};
}
test('cart prepares ahead of gesture, authenticates local key and preserves checkout target',async t=>{
 const c=setup(t);await until(()=>c.calls.includes('secure_passkeys_frontend_get_login_options'));await new Promise(r=>setTimeout(r,5));
 c.w.document.querySelector('a').click();await until(()=>c.nav.length===1);
 assert.equal(c.requests.length,1);assert.equal(c.requests[0].uiMode,'immediate');assert.equal(c.requests[0].signal,undefined);assert.equal(c.requests[0].publicKey.allowCredentials.length,0);
 assert.ok(c.calls.includes('secure_passkeys_frontend_login'));assert.equal(new URL(c.nav[0]).searchParams.get('coupon'),'kept');assert.equal(new URL(c.nav[0]).pathname,'/checkout/');
});
test('private/absent/cancelled credential falls through without posting login or inventing authentication',async t=>{
 const c=setup(t,{reject:true});await until(()=>c.calls.includes('secure_passkeys_frontend_get_login_options'));await new Promise(r=>setTimeout(r,5));c.w.document.querySelector('a').click();await until(()=>c.nav.length===1);
 assert.equal(c.calls.includes('secure_passkeys_frontend_login'),false);assert.equal(c.w.localStorage.getItem('ctwpml_passkey_used'),null);
});
test('unsupported capability leaves native navigation untouched and makes no authentication request',async t=>{
 const c=setup(t,{capable:false});await new Promise(r=>setTimeout(r,20));assert.deepEqual(c.calls,[]);assert.deepEqual(c.requests,[]);assert.deepEqual(c.nav,[]);
});
test('server rejection never marks remembered access and still preserves checkout continuation',async t=>{
 const c=setup(t,{deny:true});await until(()=>c.calls.includes('secure_passkeys_frontend_get_login_options'));await new Promise(r=>setTimeout(r,5));c.w.document.querySelector('a').click();await until(()=>c.nav.length===1);assert.equal(c.w.localStorage.getItem('ctwpml_passkey_used'),null);
});
