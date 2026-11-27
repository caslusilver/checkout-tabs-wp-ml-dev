(()=>{
    'use strict';
    document.addEventListener('click',async event=>{
        const button=event.target.closest('[data-order-pix-copy]');if(!button||button.disabled)return;
        const box=button.closest('.ctwpml-admin-order-pix'),field=box.querySelector('textarea'),notice=box.querySelector('[data-order-pix-notice]');
        button.disabled=true;
        try{await navigator.clipboard.writeText(field.value);notice.textContent='Pix copiado.';}
        catch(_){field.focus();field.select();notice.textContent='Selecione o código acima e copie manualmente.';}
        finally{button.disabled=false;}
    });
})();
