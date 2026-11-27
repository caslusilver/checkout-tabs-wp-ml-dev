const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const markup=spawnSync(process.env.VAULT_PHP,['tests/recovery.test.php','--markup'],{encoding:'utf8'});assert.equal(markup.status,0,markup.stderr+markup.stdout);
const source=readFileSync('assets/js/recovery-admin.js','utf8');
const until=async f=>{for(let i=0;i<200&&!f();i++)await new Promise(r=>setTimeout(r,5));assert.ok(f());};
function setup(t,{reject=false}={}){
 const dom=new JSDOM(markup.stdout,{url:'https://shop.example.test/recuperacao/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,calls=[],state={recovered:0};w.matchMedia=()=>({matches:false});w.ctwpmlRecoveryAdmin={url:'/ajax',nonce:'admin-fixture'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(value){this.returnValue=value;this.open=false;this.dispatchEvent(new w.Event('close'));};
 const row={id:1,contact:{name:'<img src=x onerror=alert(1)>',email:'fixture@example.test',phone:'+5511999990000'},context:{items:[{name:'Fixture',quantity:2,subtotal:20,total:20}],total:25,freight:5,shipping:'Motoboy'},state:'attention',revision:3,attempts:2,has_error:1,order_id:0,manual_order_id:0,updated_at:'2026-11-27 14:00:00'};
 const purchased={...row,id:2,contact:{name:'Customer B'},state:'bought',order_id:1052};
 w.fetch=async(url,opts)=>{
  const operation=opts.body.get('operation');calls.push({operation,body:opts.body});let data;
  if(operation==='list'||operation==='board')data={rows:[row,purchased],count:2,stats:{people:2,errors:1,recovered:state.recovered,linked:0,bought:1,devices:[]},settings:{enabled:false,idle:15},board_counts:{attention:1,closed:1}};
  else if(operation==='detail')data={attempts:[{id:8,trace_id:'fixture',created_at:'2026-11-27 14:00:00',device:{type:'desktop',os:'Windows',browser:'Chrome'}}]};
  else if(operation==='update'){if(reject)return{ok:false,json:async()=>({success:false})};state.recovered++;data={updated:[1],conflicts:[]};row.state='recovered';}
  else if(operation==='logs')data={rows:[{id:1,case_id:1,name:'RUNTIME_ERROR',detail:{status:500}}],upper:1,cursor:1,more:false};
  else data={};
  return {ok:true,json:async()=>({success:true,data})};
 };
 w.eval(source);return {w,d,calls,state};
}
test('CRM renders untrusted text safely and keeps purchase detection protected after loading',async t=>{
 const c=setup(t);await until(()=>c.d.querySelectorAll('.cr-case').length===2);
 assert.equal(c.d.querySelectorAll('article img').length,0);assert.equal(c.d.querySelector('.cr-name').textContent,'<img src=x onerror=alert(1)>');
 assert.equal(c.d.querySelector('[data-prev]').disabled,true);assert.equal(c.d.querySelector('[data-next]').disabled,true);
 c.d.querySelector('[data-case-id="2"] button').click();await until(()=>c.d.querySelector('[data-case-id="2"] .cr-detail'));
 assert.equal(c.d.querySelector('[data-case-id="2"] select').disabled,true);assert.equal(c.calls[0].body.get('nonce'),'admin-fixture');
});
test('reversible bulk state includes optimistic revision; manual recovery requires no order',async t=>{
 const c=setup(t);await until(()=>c.d.querySelector('article'));
 c.d.querySelector('article input').click();c.d.querySelector('[data-bulk-action]').value='recovered';c.d.querySelector('[data-apply]').click();
 await until(()=>c.calls.some(x=>x.operation==='update'));assert.equal(c.d.querySelector('dialog').open,false);
 const call=c.calls.find(x=>x.operation==='update');assert.equal(call.body.get('revisions[1]'),'3');assert.equal(call.body.get('ids[]'),'1');assert.equal(call.body.has('order'),false);
});
test('cancelled drag/bulk does not mutate; server error preserves a usable interface',async t=>{
 const c=setup(t,{reject:true});await until(()=>c.d.querySelector('article'));
 c.d.querySelector('article input').click();c.d.querySelector('[data-bulk-action]').value='delete';c.d.querySelector('[data-apply]').click();
 await until(()=>c.d.querySelector('dialog').open);c.d.querySelector('dialog').close('cancel');await new Promise(r=>setTimeout(r,20));assert.equal(c.calls.some(x=>x.operation==='update'),false);
 c.d.querySelector('[data-apply]').click();await until(()=>c.d.querySelector('dialog').open);c.d.querySelector('dialog').close('confirm');
 await until(()=>c.d.querySelector('[data-notice]').textContent.includes('Não foi possível alterar'));assert.equal(c.d.querySelector('[data-refresh]').disabled,false);
});
test('copy exports technical data only and offers manual copy when clipboard is unavailable',async t=>{
 const c=setup(t);await until(()=>c.d.querySelector('article'));c.d.querySelector('article input').click();c.d.querySelector('[data-copy]').click();
 await until(()=>c.d.querySelector('dialog').open);const text=c.d.querySelector('textarea').value;
 assert.equal(text.includes('fixture@example.test'),false);assert.equal(text.includes('RUNTIME_ERROR'),true);assert.equal(c.calls.find(x=>x.operation==='logs').body.get('ids[]'),'1');
 c.d.querySelector('dialog').close('cancel');
});
test('kanban shows lanes, keeps bought cards non-draggable and requests bounded board data',async t=>{
 const c=setup(t);await until(()=>c.d.querySelector('article'));const select=c.d.querySelector('[data-view]');select.value='kanban';select.dispatchEvent(new c.w.Event('change'));
 await until(()=>c.d.querySelector('.cr-board'));assert.equal(c.d.querySelectorAll('.cr-lane').length,4);
 assert.equal(c.d.querySelector('[data-case-id="1"]').draggable,true);assert.equal(c.d.querySelector('[data-case-id="2"]').draggable,false);assert.ok(c.calls.some(x=>x.operation==='board'));
});
