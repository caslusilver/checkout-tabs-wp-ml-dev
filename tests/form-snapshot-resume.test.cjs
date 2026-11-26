const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{readFileSync}=require('node:fs');
const source=readFileSync('assets/js/address-ml-modal.js','utf8');
const from=source.indexOf('    function ctwpmlFlushFormSnapshot(reason) {'),to=source.indexOf('    function ctwpmlPersistFormSnapshot',from);
test('leaving a cleared list/review/auth never overwrites the durable form draft',()=>{
 let saved=0;const c={currentView:'review',wasOrderCompletedRecently:()=>false,formSnapshotDebounce:null,ctwpmlCollectFormSnapshot:()=>({numero:'12',comp:'Apto 2'}),saveFormSnapshot:()=>saved++,state:{}};
 vm.createContext(c);vm.runInContext(source.slice(from,to),c);
 for(const view of ['list','review','auth','shipping']){c.currentView=view;assert.equal(c.ctwpmlFlushFormSnapshot('page_exit'),false);}
 assert.equal(saved,0);c.currentView='form';assert.equal(c.ctwpmlFlushFormSnapshot('page_exit'),true);assert.equal(saved,1);
});
