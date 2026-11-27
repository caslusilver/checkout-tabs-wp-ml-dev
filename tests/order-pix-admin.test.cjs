const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const markup=spawnSync(process.env.VAULT_PHP,['-d','extension_dir='+process.env.VAULT_PHP_EXT,'-d','extension=openssl','tests/recovery.test.php','--pix-markup'],{encoding:'utf8'});assert.equal(markup.status,0,markup.stderr+markup.stdout);
const source=readFileSync('assets/js/order-pix-admin.js','utf8');
test('Order Pix copy preserves gateway case and repeated clicks cannot duplicate an in-flight copy',async t=>{
 const dom=new JSDOM(markup.stdout,{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;let calls=0,finish,copied='';
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:code=>{calls++;copied=code;return new Promise(r=>{finish=r;});}}});w.eval(source);
 const button=w.document.querySelector('button');button.click();button.click();assert.equal(calls,1);assert.equal(copied,'000201BR.GOV.BCB.PIXabcABC6304FFFF');finish();await new Promise(r=>setTimeout(r,10));
 assert.equal(button.disabled,false);assert.equal(w.document.querySelector('[data-order-pix-notice]').textContent,'Pix copiado.');
});
test('Denied clipboard leaves the saved Pix selectable and restores copy control',async t=>{
 const dom=new JSDOM(markup.stdout,{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.eval(source);
 const button=w.document.querySelector('button');button.click();await new Promise(r=>setTimeout(r,10));
 assert.equal(button.disabled,false);const field=w.document.querySelector('textarea');assert.equal(field.selectionEnd,field.value.length);assert.equal(field.readOnly,true);assert.match(w.document.querySelector('[data-order-pix-notice]').textContent,/manualmente/);
});
