(()=>{
 'use strict';
 const roots=Array.from(document.querySelectorAll('.ctwpml-order-strip'));if(!roots.length)return;
 let data=null,busy=false,stopped=false,pollTimer,flashTimer,deadline=0,duration=360,failures=0,paidUntil=0;
 const memory={};
 const read=k=>{try{return sessionStorage.getItem(k);}catch(e){return memory[k];}};
 const save=(k,v)=>{memory[k]=v;try{sessionStorage.setItem(k,v);}catch(e){}};
 function safeURL(url){try{const u=new URL(url,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch(e){return '';}}
 function render(flash=false){
  for(const root of roots){root.hidden=!data?.active;if(root.hidden)continue;
   const q=s=>root.querySelector(s),pending=data.state==='pending',url=safeURL(data.url);
   root.dataset.state=flash?'paid':data.state;
   q('.strip-label').textContent=flash?'Pagamento confirmado':({pending:'Pagamento pendente',preparing:'Preparando seu envio',route:'Seu pedido está em rota'}[data.state]||'Seu pedido');
   q('.strip-copy').hidden=!pending||!data.payload;q('.strip-link').hidden=(pending&&!!data.payload)||!url;q('.strip-link').href=url;
   q('.strip-progress').hidden=!pending;q('.strip-detail').textContent='Pedido #'+data.number;
  }clock();
 }
 function clock(){if(!data?.active||data.state!=='pending')return;
  const left=Math.max(0,Math.ceil((deadline-Date.now())/1000)),text=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  for(const root of roots){root.querySelector('.strip-detail').textContent='Pedido #'+data.number+' · '+text;const fill=root.querySelector('.strip-progress span');fill.style.width=Math.min(100,left/duration*100)+'%';fill.style.backgroundColor=left<=60?'#d63e3e':left<=duration/2?'#e5b32a':'#0075ff';}
 }
 function apply(next){
  const changed=data?.id!==next.id || data?.state!==next.state;data=next;
  if(!data.active){clearTimeout(flashTimer);render();return;}
  if(data.state==='pending'){
   duration=data.minutes*60;const k='ctwpml-ty-clock-'+data.id;let prior;try{prior=JSON.parse(read(k)||'null');}catch(e){}
   deadline=prior&&prior.seconds===duration&&Number.isFinite(prior.deadline)?prior.deadline:Date.now()+duration*1000;save(k,JSON.stringify({seconds:duration,deadline}));
  }
  if(changed){clearTimeout(flashTimer);paidUntil=0;}
  const key='ctwpml-strip-paid-'+data.id,flash=data.state!=='pending'&&!read(key);
  if(flash){save(key,'1');paidUntil=Date.now()+4000;render(true);flashTimer=setTimeout(()=>render(false),4000);}else render(Date.now()<paidUntil);
 }
 async function poll(){
  clearTimeout(pollTimer);if(document.hidden||busy||stopped)return;busy=true;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{const response=await fetch(roots[0].dataset.ajax,{method:'POST',credentials:'same-origin',cache:'no-store',signal:abort.signal,body:new URLSearchParams({action:'ctwpml_order_strip',nonce:roots[0].dataset.nonce})});
   if(response.status===403||response.status===400){stopped=true;roots.forEach(r=>r.hidden=true);return;}
   if(!response.ok)throw new Error('request_failed');
   const result=await response.json();if(!result.success)throw new Error('invalid_response');
   if(result.data.active && (!Number.isInteger(result.data.id)||!['pending','preparing','route'].includes(result.data.state)||!Number.isFinite(Number(result.data.minutes))))throw new Error('invalid_order');
   failures=0;apply(result.data);
  }catch(e){failures++;}finally{clearTimeout(timeout);busy=false;if(!document.hidden&&!stopped)pollTimer=setTimeout(poll,Math.min(60000,15000*2**Math.min(failures,2)));}
 }
 for(const root of roots)root.querySelector('.strip-copy').addEventListener('click',async()=>{
  if(!data?.payload||data.state!=='pending')return;
  const feedback=root.querySelector('.strip-feedback');
  try{await navigator.clipboard.writeText(data.payload);root.querySelector('.strip-copy-text').textContent='Copiado!';feedback.textContent='Código Pix copiado.';setTimeout(()=>{root.querySelector('.strip-copy-text').textContent='Copiar Pix';feedback.textContent='';},1800);}catch(e){feedback.textContent='Não foi possível copiar. Abra a página do pedido.';root.querySelector('.strip-link').hidden=false;}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(pollTimer);else{clock();poll();}});window.addEventListener('focus',poll);window.addEventListener('online',poll);window.addEventListener('pageshow',poll);
 const clockTimer=setInterval(clock,1000);window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);clearTimeout(flashTimer);});
 poll();
})();
