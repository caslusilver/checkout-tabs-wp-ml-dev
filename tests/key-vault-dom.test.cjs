const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const php=process.env.VAULT_PHP;
if(!php)throw new Error('Defina VAULT_PHP e VAULT_PHP_EXT para renderizar a fixture PHP real.');
const html=execFileSync(php,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/key-vault.test.php','--html'],{encoding:'utf8'});
const script=readFileSync('assets/js/key-vault.js','utf8');
const until=async check=>{for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,5));assert.ok(check());};
function setup(t,fetcher){
 const dom=new JSDOM(html,{url:'https://shop.example.test/wp-admin/admin.php?page=ctwpml-vault',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();});const w=dom.window,d=w.document,calls=[],copied=[];
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copied.push(text)}});
 w.confirm=()=>true;
 w.fetch=async(url,options)=>{calls.push(Object.fromEntries(options.body));assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');
  return fetcher?fetcher(options):{ok:true,json:async()=>({success:true,data:options.body.get('operation')==='read'?{value:'fixture-value-to-copy'}:{removed:true}})};};
 w.eval(script);return{w,d,calls,copied,row:d.querySelector('[data-name="motoboy_conexao"]')};
}
test('values are loaded only on demand; copy name, copy value, show/hide and tab hiding work',async t=>{
 const c=setup(t),field=c.row.querySelector('input');
 assert.equal(field.value,'');assert.equal(c.calls.length,0);assert.equal(c.d.body.innerHTML.includes('fixture-value-to-copy'),false);
 c.row.querySelector('[data-key-action="name"]').click();await until(()=>c.copied.length===1);assert.equal(c.copied[0],'motoboy_conexao');assert.equal(c.calls.length,0);
 await until(()=>!c.row.querySelector('button').disabled);
 c.row.querySelector('[data-key-action="copy"]').click();await until(()=>c.copied.length===2);assert.equal(c.copied[1],'fixture-value-to-copy');assert.equal(field.value,'');
 await until(()=>!c.row.querySelector('button').disabled);
 c.row.querySelector('[data-key-action="show"]').click();await until(()=>field.type==='text');assert.equal(field.value,'fixture-value-to-copy');
 c.row.querySelector('[data-key-action="show"]').click();assert.equal(field.value,'');assert.equal(field.type,'password');
 c.row.querySelector('[data-key-action="show"]').click();await until(()=>field.type==='text');Object.defineProperty(c.d,'hidden',{value:true,configurable:true});c.d.dispatchEvent(new c.w.Event('visibilitychange'));assert.equal(field.value,'');
 assert.equal(c.w.localStorage.length,0);assert.equal(c.w.sessionStorage.length,0);
});
test('cancelled delete is inert; explicit deletion updates only that row',async t=>{
 const c=setup(t),remove=c.row.querySelector('[data-key-action="delete"]');c.w.confirm=()=>false;remove.click();assert.equal(c.calls.length,0);assert.equal(c.row.isConnected,true);
 c.w.confirm=()=>true;remove.click();await until(()=>!c.row.isConnected);assert.equal(c.calls[0].confirmed,'1');assert.equal(c.calls[0].name,'motoboy_conexao');assert.equal(c.d.querySelector('[data-count]').textContent,'2');assert.ok(c.d.querySelector('[data-name="authorization"]'));
});
test('failed/slow read restores buttons, does not reveal a value in background and preserves draft',async t=>{
 let finish;const c=setup(t,()=>new Promise(resolve=>finish=resolve));const draft=c.d.querySelector('#ctwpml-new-key');draft.value='fixture-unsaved-input';
 const show=c.row.querySelector('[data-key-action="show"]');show.click();show.click();assert.equal(c.calls.length,1);
 Object.defineProperty(c.d,'hidden',{value:true,configurable:true});finish({ok:true,json:async()=>({success:true,data:{value:'fixture-private-value'}})});
 await until(()=>!show.disabled);assert.equal(c.row.querySelector('input').value,'');assert.equal(draft.value,'fixture-unsaved-input');
});
test('clipboard denial offers selected value without silently reporting success',async t=>{
 const c=setup(t);c.w.navigator.clipboard.writeText=async()=>{throw new Error('denied');};c.d.execCommand=()=>false;
 c.row.querySelector('[data-key-action="copy"]').click();await until(()=>c.row.querySelector('.ctv-row-status').classList.contains('is-error'));
 assert.equal(c.row.querySelector('input').value,'fixture-value-to-copy');assert.equal(c.row.querySelector('input').type,'text');assert.equal(c.d.querySelector('textarea'),null);
});
