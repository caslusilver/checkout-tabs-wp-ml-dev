(()=>{
    'use strict';
    const root=document.getElementById('ctwpml-recovery'),cfg=window.ctwpmlRecoveryAdmin;if(!root||!cfg)return;
    const q=s=>root.querySelector(s),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
    let rows=[],selected=new Set(),expanded=new Set(),page=1,total=0,queue='attention',busy=false,settingsLoaded=false,view='list',dragged=null,boardCounts={};
    const lanes={active:'Em andamento',attention:'Atenção',contact:'Em contato',closed:'Encerrados'};
    const labels={active:'Em andamento',attention:'Não comprou',contact:'Em contato',bought:'Compra detectada',recovered:'Recuperado · manual',lost:'Não recuperado'};
    const closed=r=>['bought','recovered','lost'].includes(r.state),money=n=>n===null||n===undefined?'Não definido':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const date=s=>{if(!s)return '—';const d=new Date(s.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');};
    function notice(s){q('[data-notice]').textContent=s;}
    function controls(value){
        busy=value;
        root.querySelectorAll('button,select').forEach(n=>{
            if(n.closest('dialog'))return;
            if(value){n.dataset.crDisabled=String(n.disabled);n.disabled=true;}
            else if(n.dataset.crDisabled!==undefined){n.disabled=n.dataset.crDisabled==='true';delete n.dataset.crDisabled;}
        });
        if(!value){q('[data-prev]').disabled=page<=1;q('[data-next]').disabled=page*25>=total;}
    }
    function button(text,action,cls){const b=el('button',text,cls);b.type='button';b.onclick=action;return b;}
    async function request(operation,extra={}){
        const f=new FormData();f.set('action','ctwpml_recovery_admin');f.set('nonce',cfg.nonce);f.set('operation',operation);
        for(const [k,v]of Object.entries(extra)){
            if(Array.isArray(v))v.forEach(value=>f.append(k+'[]',String(value)));
            else if(v&&typeof v==='object')Object.entries(v).forEach(([id,value])=>f.append(k+'['+id+']',String(value)));
            else f.set(k,String(v));
        }
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
        try{
            const res=await fetch(cfg.url,{method:'POST',credentials:'same-origin',cache:'no-store',body:f,signal:controller.signal});
            const data=await res.json();
            if(!res.ok||!data.success)throw new Error('server_rejected');
            return data.data;
        }finally{clearTimeout(timeout);}
    }
    function dialog(title,description,field=null){
        const d=q('[data-dialog]');q('[data-dialog-title]').textContent=title;q('[data-dialog-description]').textContent=description;
        q('[data-dialog-fields]').replaceChildren();if(field)q('[data-dialog-fields]').append(field);
        return new Promise(resolve=>{
            d.returnValue='cancel';d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();
        });
    }
    function stats(data){
        for(const key of ['people','errors','recovered','bought'])q('[data-metric="'+key+'"]').textContent=String(Number(data[key]||0));
        const p=Number(data.people||0),errors=Number(data.errors||0);
        q('[data-metric="rate"]').textContent=p?Math.round(errors/p*100)+'% das pessoas identificadas':'Sem pessoas identificadas no período';
        q('[data-metric="linked"]').textContent=Number(data.linked||0)+' com pedido associado';
        q('[data-device-summary]').textContent=(data.devices||[]).map(d=>(d.device_type==='mobile'?'Celular':d.device_type==='desktop'?'Computador':'Dispositivo desconhecido')+': '+d.people+' perfis, '+d.errors+' com erro nesta plataforma').join(' · ')+(data.anonymous?' · '+data.anonymous+' atendimentos ainda sem identidade informada':'');
    }
    async function load(){
        if(busy)return;controls(true);notice('Carregando recuperação…');
        try{
            const board=view==='kanban'&&!matchMedia('(max-width:800px)').matches;
            const data=await request(board?'board':'list',{state:board?'all':queue,page,days:q('[data-period]').value,search:q('[data-search]')?.value||'',shipping:q('[data-shipping]')?.value||'',device:q('[data-device]')?.value||''});
            rows=data.rows||[];total=Number(data.count||0);boardCounts=data.board_counts||{};stats(data.stats||{});
            if(!settingsLoaded){const f=q('[data-settings]');f.elements.enabled.checked=!!data.settings.enabled;f.elements.idle.value=data.settings.idle;settingsLoaded=true;}
            q('[data-capture-status]').textContent=data.settings.enabled?'Coleta ativa · atendimento após '+data.settings.idle+' min de inatividade · erros entram imediatamente.':'Coleta desativada. Abra Configurar para ativar e iniciar os registros.';
            selected=new Set([...selected].filter(id=>rows.some(r=>r.id===id)));render();notice('');
        }catch(_){notice('Não foi possível carregar. Confira sua sessão administrativa e tente Atualizar.');}
        finally{controls(false);}
    }
    function check(row){
        const input=el('input');input.type='checkbox';input.checked=selected.has(row.id);input.setAttribute('aria-label','Selecionar '+(row.contact.name||'atendimento '+row.id));
        input.onchange=()=>{if(input.checked&&selected.size>=50){input.checked=false;notice('Selecione até 50 atendimentos por ação.');return;}input.checked?selected.add(row.id):selected.delete(row.id);selection();};
        return input;
    }
    function selection(){
        q('[data-selected]').textContent=selected.size+' selecionados';q('[data-select-all]').checked=rows.length>0&&rows.every(r=>selected.has(r.id));
    }
    function badge(row){
        return el('span',(row.has_error?'Erro registrado · ':'')+(labels[row.state]||row.state)+(row.order_id?' #'+row.order_id:''),'cr-badge'+(closed(row)?' cr-done':''));
    }
    function card(row,board){
        const card=el('article',undefined,'cr-case');card.dataset.caseId=String(row.id);
        const line=el('div',undefined,'cr-row');line.append(check(row));
        const who=el('div');who.append(el('strong',row.contact.name||'Pessoa não identificada','cr-name'),el('p',[row.contact.city,row.contact.region].filter(Boolean).join(' · ')||'Localização não informada','cr-muted'),el('p',date(row.updated_at),'cr-muted'));
        const shipping=el('div');shipping.append(el('strong',row.context.shipping||'Frete não escolhido'),el('p','Frete: '+money(row.context.freight),'cr-muted'));
        const state=el('div');state.append(el('strong',row.attempts+' execuções'),badge(row));
        line.append(who,shipping,state,button(expanded.has(row.id)?'Recolher':'Detalhes',()=>{
            expanded.has(row.id)?expanded.delete(row.id):expanded.add(row.id);render();
        }));
        card.append(line);
        if(board&&!row.order_id){
            card.draggable=true;card.addEventListener('dragstart',event=>{if(busy){event.preventDefault();return;}dragged=row.id;event.dataTransfer.setData('text/plain',String(row.id));event.dataTransfer.effectAllowed='move';});
            card.addEventListener('dragend',()=>{dragged=null;});
        }
        if(expanded.has(row.id))card.append(detail(row));
        return card;
    }
    function detail(row){
        const out=el('div',undefined,'cr-detail'),cart=el('section');cart.append(el('h2','Atendimento #'+row.id+' · carrinho'));
        for(const item of row.context.items||[]){
            const line=el('div',undefined,'cr-item');line.append(el('strong',item.name),el('p',item.quantity+' un. · unitário: '+money(item.quantity?item.subtotal/item.quantity:0)+' · produtos: '+money(item.total)));
            cart.append(line);
        }
        if(!(row.context.items||[]).length)cart.append(el('p','Carrinho ainda não registrado.'));
        cart.append(el('p','Frete: '+money(row.context.freight)),el('strong','Total do carrinho: '+money(row.context.total)));
        cart.append(el('h2','Contato informado'),el('p',row.contact.email||'E-mail não informado'),el('p',row.contact.phone||'Telefone não informado'));
        const digits=String(row.contact.phone||'').replace(/\D/g,'');
        if(digits.length>=8&&digits.length<=15){
            const a=el('a','Falar pelo WhatsApp','cr-button cr-primary');a.href='https://wa.me/'+digits;a.target='_blank';a.rel='noopener noreferrer';cart.append(a);
        }
        const history=el('section');history.append(el('h2','Execuções deste atendimento'));
        const attempts=el('div','Carregando…');history.append(attempts);
        request('detail',{id:row.id}).then(data=>{
            if(!attempts.isConnected)return;attempts.replaceChildren();
            for(const a of data.attempts||[]){
                const block=el('div',undefined,'cr-attempt');
                block.append(el('strong','Execução #'+a.id),el('p',date(a.created_at),'cr-muted'),el('p',[a.device.type==='mobile'?'Celular':'Computador',a.device.os,a.device.browser].join(' · '),'cr-muted'),el('small',a.trace_id));
                attempts.append(block);
            }
            if(!data.attempts?.length)attempts.textContent='Sem execuções.';
            if(data.attempts?.length===100)attempts.append(el('p','Exibindo até 100 execuções. Os logs exportados incluem as demais.'));
        }).catch(()=>{attempts.textContent='Não foi possível obter as execuções. Recolha e abra novamente.';});
        const actions=el('div',undefined,'cr-detail-actions');
        const select=el('select');select.setAttribute('aria-label','Situação do atendimento');
        for(const key of ['active','attention','contact','recovered','lost']){const o=el('option',labels[key]);o.value=key;o.selected=row.state===key;select.append(o);}
        if(row.order_id){const o=el('option','Compra detectada');o.value='bought';o.selected=true;select.append(o);select.disabled=true;}
        select.onchange=()=>change([row.id],select.value);
        actions.append(select,button('Associar pedido',()=>link(row)),el('span','Pedido: '+(row.manual_order_id||row.order_id||'nenhum'),'cr-muted'),button('Copiar logs',()=>exportLogs([row.id],true)),button('Baixar logs',()=>exportLogs([row.id],false)));
        out.append(cart,history,actions);return out;
    }
    function render(){
        const host=q('[data-records]');host.replaceChildren();
        const board=view==='kanban'&&!matchMedia('(max-width:800px)').matches;host.className=board?'cr-board':'cr-list';
        q('.cr-tabs').hidden=board;q('.cr-pagination').hidden=board;
        if(board){
            for(const lane of ['attention','contact','closed','active']){
                const column=el('section',undefined,'cr-lane');column.append(el('h2',lanes[lane]+' · '+(boardCounts[lane]||0)));
                const pool=rows.filter(r=>lane==='closed'?closed(r):r.state===lane);
                for(const r of pool)column.append(card(r,true));
                if(!pool.length)column.append(el('p','Sem atendimentos','cr-muted'));
                if((boardCounts[lane]||0)>25)column.append(el('p','25 prioritários exibidos. Use a lista para paginar todos.','cr-muted'));
                column.addEventListener('dragover',e=>{if(dragged&&!busy)e.preventDefault();});
                column.addEventListener('drop',async e=>{
                    e.preventDefault();const id=dragged;dragged=null;if(!id||busy)return;
                    if(lane==='closed'){
                        const label=el('label','Resultado '),select=el('select');
                        for(const [value,text]of [['recovered','Recuperado'],['lost','Não recuperado']]){const o=el('option',text);o.value=value;select.append(o);}label.append(select);
                        if(await dialog('Encerrar atendimento','Selecione o resultado. Nenhum pedido será alterado.',label))change([id],select.value);
                    }else change([id],lane);
                });
                host.append(column);
            }
        }else{
            rows.forEach(r=>host.append(card(r,false)));
            if(!rows.length)host.append(el('p','Nenhum atendimento nesta fila.','cr-empty'));
            q('[data-page]').textContent='Página '+page+' · '+total+' atendimentos';q('[data-prev]').disabled=page<=1;q('[data-next]').disabled=page*25>=total;
        }
        selection();
    }
    async function change(ids,state,order){
        if(busy||!ids.length)return;
        if(!['active','attention','contact','recovered','lost','delete','link'].includes(state)){notice('Escolha uma ação.');return;}
        if(state==='delete'&&!await dialog('Excluir '+ids.length+' atendimentos?','Os contatos e logs selecionados serão removidos desta central. Pedidos não serão excluídos.')){render();return;}
        controls(true);
        try{
            const revisions={};for(const r of rows)if(ids.includes(r.id))revisions[r.id]=r.revision;
            const data=await request('update',{ids,state,revisions,...(order?{order}:{})});
            selected.clear();controls(false);await load();
            notice(data.updated.length+' atualizado(s).'+(data.conflicts.length?' '+data.conflicts.length+' registro(s) mudaram durante a ação. Confira antes de tentar novamente.':''));
        }catch(_){notice('Não foi possível alterar. Recarregue os dados e tente novamente. Nenhuma mudança visual foi confirmada.');render();}
        finally{controls(false);}
    }
    async function link(row){
        if(busy)return;
        const label=el('label','Número do pedido '),input=el('input');input.type='number';input.min='1';input.required=true;label.append(input);
        if(!await dialog('Associar um pedido','O pedido deve ter o mesmo e-mail informado no atendimento. O vínculo é administrativo e não muda seu pagamento.',label))return;
        if(!Number.isSafeInteger(Number(input.value))||Number(input.value)<1){notice('Informe um número de pedido válido.');return;}
        await change([row.id],'link',Number(input.value));
    }
    async function exportLogs(ids,copy){
        if(busy||!ids.length){notice('Selecione atendimentos para copiar ou baixar.');return;}
        controls(true);notice('Preparando relatório…');
        try{
            const report={format:'ctwpml-recovery-1',exported_at:new Date().toISOString(),cases:ids,events:[]};let cursor=0,upper=0,more=true;
            while(more){
                const data=await request('logs',{ids,cursor,upper});report.events.push(...data.rows);cursor=data.cursor;upper=data.upper;more=data.more;
                if(report.events.length>20000)throw new Error('export_too_large');
            }
            const text=JSON.stringify(report,null,2);
            if(copy){
                try{await navigator.clipboard.writeText(text);notice('Logs copiados. Contatos e segredos não fazem parte do relatório técnico.');}
                catch(_){const field=el('textarea');field.value=text;field.readOnly=true;field.rows=12;await dialog('Copiar relatório','Selecione o texto e copie manualmente.',field);notice('Relatório disponível para cópia manual.');}
            }else{
                const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download='recuperacao-'+(ids.length===1?ids[0]+'-':'')+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Relatório baixado, agrupável por case_id e trace_id.');
            }
        }catch(_){notice('Não foi possível exportar. Confira sua sessão ou selecione menos atendimentos e tente novamente.');}
        finally{controls(false);}
    }
    root.querySelectorAll('[data-queue]').forEach(b=>{b.onclick=()=>{if(busy)return;queue=b.dataset.queue;page=1;selected.clear();root.querySelectorAll('[data-queue]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load();};});
    q('[data-refresh]').onclick=load;
    q('[data-period]').onchange=()=>{page=1;selected.clear();load();};
    q('[data-view]').onchange=()=>{view=q('[data-view]').value;page=1;selected.clear();load();};
    q('[data-select-all]').onchange=e=>{selected=e.target.checked?new Set(rows.slice(0,50).map(r=>r.id)):new Set();render();if(rows.length>50)notice('Selecionados os primeiros 50.');};
    q('[data-apply]').onclick=()=>change([...selected],q('[data-bulk-action]').value);
    q('[data-copy]').onclick=()=>exportLogs([...selected],true);q('[data-download]').onclick=()=>exportLogs([...selected],false);
    q('[data-prev]').onclick=()=>{if(page>1){page--;selected.clear();load();}};q('[data-next]').onclick=()=>{if(page*25<total){page++;selected.clear();load();}};
    q('[data-settings-toggle]').onclick=()=>{const f=q('[data-settings]');f.hidden=!f.hidden;q('[data-settings-toggle]').setAttribute('aria-expanded',String(!f.hidden));};
    q('[data-settings]').onsubmit=async event=>{
        event.preventDefault();if(busy)return;controls(true);
        const f=event.target;
        try{await request('settings',{enabled:f.elements.enabled.checked?1:0,idle:f.elements.idle.value});controls(false);await load();notice('Configuração salva. Atualize o checkout para aplicar a coleta.');}catch(_){notice('Não foi possível salvar. Confira sua sessão e o suporte OpenSSL.');}finally{controls(false);}
    };
    q('[data-search-form]')?.addEventListener('submit',e=>{e.preventDefault();page=1;selected.clear();load();});
    for(const s of ['[data-shipping]','[data-device]'])if(q(s))q(s).onchange=()=>{page=1;selected.clear();load();};
    let small=matchMedia('(max-width:800px)').matches,resizeTimer;
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
        const next=matchMedia('(max-width:800px)').matches;
        if(next!==small&&!busy&&!selected.size&&!q('[data-dialog]').open){small=next;load();}
    },300);});
    load(); // Atualização sob demanda evita perder seleção/rascunhos ou mover cartões durante operação.
})();
