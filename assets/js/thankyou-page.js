(() => {
 'use strict';
 const root=document.querySelector('.ctwpml-thankyou'),data=document.getElementById('ctwpml-ty-data');
 if(!root||!data)return;
 const c=JSON.parse(data.textContent),q=s=>root.querySelector(s),stage=q('.product-stage');
 const seconds=Math.max(60,Number(c.minutes)*60),storeKey='ctwpml-ty-clock-'+c.id;
 let deadline=Date.now()+seconds*1000,busy=false,timer,pollTimer,failures=0,autoTimer,lastTracking='',stopped=false;
 try {const old=JSON.parse(sessionStorage.getItem(storeKey)||'null');if(old&&old.seconds===seconds&&Number.isFinite(old.deadline))deadline=old.deadline;else sessionStorage.setItem(storeKey,JSON.stringify({seconds,deadline}));}catch(e){}
 function clock(){
  const pending=c.state==='pending';q('#ty-mark').hidden=!pending;q('.ticket-timebar').hidden=!pending;
  if(!pending)return;
  const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));
  q('#ty-clock').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const fill=q('.ticket-timebar>span');fill.style.width=Math.min(100,left/seconds*100)+'%';fill.style.backgroundColor=left<=60?'#d63e3e':left<=seconds/2?'#e5b32a':'#0075ff';
  q('#ty-time-note').textContent=left?'Conclua o pagamento no tempo indicado acima.':'Tempo encerrado. Aguardando a confirmação do pagamento.';
 }
 function tracking(url){
  let target;try{target=new URL(url,location.href);if(!['https:','http:'].includes(target.protocol))return;}catch(e){return;}
  q('#ty-track').href=target.href;q('#ty-tracking-choice').hidden=false;
  if(lastTracking===target.href)return;lastTracking=target.href;
  const once='ctwpml-ty-open-'+c.id;
  try{if(sessionStorage.getItem(once))return;}catch(e){}
  q('#ty-track-note').textContent='Em instantes, tentaremos abrir o acompanhamento em outra aba. Você também pode usar o botão acima.';
  clearTimeout(autoTimer);autoTimer=setTimeout(()=>{
   if(document.hidden||c.state!=='paid')return;
   let opened=null;try{opened=window.open(target.href,'_blank');if(opened)opened.opener=null;sessionStorage.setItem(once,'1');}catch(e){}
   q('#ty-track-note').textContent=opened?'Acompanhamento aberto em outra aba. Esta página permanece disponível.':'Toque em “Acompanhar meu pedido” para abrir em outra aba.';
  },3000);
 }
 function render(){
  const pending=c.state==='pending',paid=c.state==='paid';stage.dataset.state=paid?'paid':pending?'pending':'cancelled';
  q('#ty-title').textContent=paid?c.paidTitle:pending?c.pendingTitle:({failed:'Não foi possível confirmar o pagamento',refunded:'Pagamento reembolsado',cancelled:'Pedido cancelado'}[c.state]||'Pedido atualizado');
  q('#ty-kicker').textContent=paid?'PAGAMENTO CONFIRMADO':pending?'SÓ FALTA O PAGAMENTO':'STATUS DO PEDIDO';
  q('#ty-subtitle').textContent=paid?c.thanks:pending?'Pague com Pix para confirmar sua compra.':'Se precisar, nosso suporte está por aqui.';
  q('#ty-small-status').textContent=paid?'Pagamento confirmado':pending?'Aguardando pagamento':'';
  q('#ty-payment').hidden=!pending;q('#ty-confirmed').hidden=!paid;q('#ty-cancelled').hidden=pending||paid;
  if(q('#ty-cancel-panel'))q('#ty-cancel-panel').hidden=!pending;
  q('#ty-ended-title').textContent=c.state==='refunded'?'Pagamento reembolsado':c.state==='failed'?'Pagamento não confirmado':'Pedido cancelado';
  q('#ty-tracking-choice').hidden=!paid||!c.tracking;
  if(paid&&c.tracking)tracking(c.tracking);
  clock();
 }
 async function poll(){
  clearTimeout(pollTimer);if(document.hidden||busy||stopped)return;
  busy=true;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);
  try{
   const body=new URLSearchParams({action:'ctwpml_thankyou_status',order_id:String(c.id),key:c.key,nonce:c.nonce});
   const response=await fetch(c.ajax,{method:'POST',body,credentials:'same-origin',cache:'no-store',signal:abort.signal});
   if(response.status===403){stopped=true;throw new Error('Reabra o link do pedido para continuar acompanhando.');}
   if(!response.ok)throw new Error('Não foi possível atualizar agora. Tentaremos novamente.');
   const result=await response.json();if(!result.success||!['pending','paid','failed','cancelled','refunded'].includes(result.data?.state))throw new Error('Aguardando atualização.');
   c.state=result.data.state;c.tracking=result.data.tracking_url||'';failures=0;q('#ty-connection').textContent='';render();
  }catch(e){failures++;q('#ty-connection').textContent=e.name==='AbortError'?'Conexão lenta. Tentaremos novamente.':e.message;}
  finally{clearTimeout(timeout);busy=false;if(!document.hidden&&!stopped)pollTimer=setTimeout(poll,Math.min(60000,(c.state==='pending'?5000:15000)*2**Math.min(failures,4)));}
 }
 function resume(){if(document.hidden){clearTimeout(pollTimer);clearTimeout(autoTimer);lastTracking='';return;}clock();render();poll();}
 document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume);window.addEventListener('online',resume);window.addEventListener('focus',()=>{if(!document.hidden)poll();});
 const resize=()=>{stage.dataset.device=innerWidth>=620?'desktop':'mobile';};window.addEventListener('resize',resize);resize();
 const copy=q('#ty-copy');if(copy)copy.addEventListener('click',async()=>{
  const payload=q('.woocommerce-order-details__asaas-pix-code').value;
  try{await navigator.clipboard.writeText(payload);copy.classList.add('copied');copy.textContent='Copiado!';q('#ty-feedback').textContent='Código Pix copiado.';setTimeout(()=>{copy.classList.remove('copied');copy.textContent='Copiar código Pix';q('#ty-feedback').textContent='';},1800);}catch(e){q('#ty-feedback').textContent='Não foi possível copiar. Selecione o código acima e copie manualmente.';}
 });
 const cancel=q('#ty-cancel');if(cancel){const finish=()=>{if(Number(cancel.value)>=75&&c.state==='pending'){location.assign(cancel.dataset.url);}else cancel.value=0;};cancel.addEventListener('pointerup',finish);cancel.addEventListener('change',()=>{if(Number(cancel.value)>=75)finish();});cancel.addEventListener('pointercancel',()=>{cancel.value=0;});}
 window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(pollTimer);clearTimeout(autoTimer);});
 window.addEventListener('pageshow',()=>{clearInterval(timer);timer=setInterval(clock,1000);});
 render();timer=setInterval(clock,1000);poll();
})();
