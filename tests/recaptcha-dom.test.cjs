const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{JSDOM}=require('jsdom');
const script=readFileSync('assets/js/login-auth-v2.js','utf8');
const until=async fn=>{for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,5));assert.ok(fn());};
async function fixture(t,{enabled=true,hidden=false}={}){
 const dom=new JSDOM(`<div id="ctwpml-view-auth"><form id="ctwpml-auth-form" data-ctwpml-auth-mode="create" style="display:${hidden?'none':'block'}"><input id="ctwpml-create-email" value="new@example.test"><input id="ctwpml-login-email" value="old@example.test"><input id="ctwpml-login-password" value="fixture-password"><input id="billing_first_name" value="Cliente"><input id="billing_last_name" value="Fixture">${enabled?'<div id="ctwpml-recaptcha-container"><div id="g-recaptcha" data-sitekey="public-key"></div><button type="button" id="ctwpml-recaptcha-retry" hidden>Recarregar</button></div>':''}<button id="ctwpml-auth-submit">Continuar</button><div id="ctwpml-auth-msg"></div></form></div>`,{url:'https://shop.example.test/checkout/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window,$=require('jquery')(w),calls=[],renders=[],logs=[];w.$=w.jQuery=$;
 $.expr.pseudos.visible=el=>Array.from((function*(e){while(e){yield e;e=e.parentElement;}})(el)).every(e=>w.getComputedStyle(e).display!=='none');
 w.cc_params={ajax_url:'/ajax',auth_email_nonce:'create-nonce',login_nonce:'login-nonce',recaptcha_enabled:enabled?1:0};w.CCCheckoutTabsState={log:(event,data)=>logs.push({event,data})};
 let token='';w.grecaptcha={render:(node,opts)=>{renders.push(opts);return 0;},getResponse:()=>token,reset:()=>{token='';}};
 $.ajax=opts=>calls.push(opts);w.eval(script);await until(()=>typeof w.ctwpmlRenderRecaptchaIfNeeded==='function');
 return{w,$,calls,renders,logs,solve(){token='fixture-token';renders.at(-1).callback(token);},expire(){renders.at(-1)['expired-callback']();}};
}
test('disabled by server config submits new account without loading Google and prevents overlapping submissions',async t=>{
 const c=await fixture(t,{enabled:false});c.w.ctwpmlRenderRecaptchaIfNeeded();assert.equal(c.renders.length,0);assert.equal(c.w.document.querySelector('script[src*="recaptcha"]'),null);
 c.$('#ctwpml-auth-form').trigger('submit');c.$('#ctwpml-auth-form').trigger('submit');assert.equal(c.calls.length,1);assert.equal(c.calls[0].data.action,'ctwpml_auth_email');assert.equal(c.calls[0].data._ajax_nonce,'create-nonce');assert.equal(c.calls[0].data.name,'Cliente Fixture');
 c.calls[0].success({success:false,data:{message:'Tente novamente'}});c.calls[0].complete();assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),false);assert.equal(c.$('#ctwpml-create-email').val(),'new@example.test');
});
test('hidden password form consumes no loading budget, then renders once and gates submit on a fresh challenge',async t=>{
 const c=await fixture(t,{hidden:true});c.w.ctwpmlRenderRecaptchaIfNeeded();assert.equal(c.renders.length,0);assert.equal(c.logs.some(x=>x.event==='CTWPML_RECAPTCHA_START'),false);
 c.w.Date.now=()=>Date.now()+60000;c.$('#ctwpml-auth-form').show();c.w.ctwpmlRenderRecaptchaIfNeeded();c.w.ctwpmlRenderRecaptchaIfNeeded();assert.equal(c.renders.length,1);assert.equal(c.w.__ctwpmlRecaptchaId,0);
 c.$('#ctwpml-auth-form').trigger('submit');assert.equal(c.calls.length,0);c.solve();assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),false);
 c.expire();assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),true);c.solve();c.$('#ctwpml-auth-form').trigger('submit');assert.equal(c.calls.length,1);
 c.calls[0].success({success:false,data:{message:'Verificação rejeitada'}});c.calls[0].complete();assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),true);c.solve();assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),false);
});
test('challenge network error offers retry without duplicate widgets or loss of input',async t=>{
 const c=await fixture(t);c.w.ctwpmlRenderRecaptchaIfNeeded();c.renders[0]['error-callback']();assert.equal(c.$('#ctwpml-recaptcha-retry').prop('hidden'),false);assert.equal(c.$('#ctwpml-auth-submit').prop('disabled'),true);
 c.$('#ctwpml-recaptcha-retry').trigger('click');assert.equal(c.renders.length,1);c.solve();assert.equal(c.$('#ctwpml-recaptcha-retry').prop('hidden'),true);assert.equal(c.$('#ctwpml-create-email').val(),'new@example.test');
});
test('missing configuration reports a recoverable error and never sends authentication',async t=>{
 const c=await fixture(t);c.$('#g-recaptcha').attr('data-sitekey','');c.w.ctwpmlRenderRecaptchaIfNeeded();assert.equal(c.renders.length,0);assert.equal(c.$('#ctwpml-recaptcha-retry').prop('hidden'),false);assert.equal(c.calls.length,0);
});
