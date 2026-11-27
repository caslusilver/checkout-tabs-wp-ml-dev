<?php if(!defined('ABSPATH'))exit; ?>
<section class="ctwpml-recovery" id="ctwpml-recovery" aria-label="Central de recuperação">
    <header><div class="cr-brand">PACK PANEL <span>│</span> RECUPERAÇÃO</div><h1>Recuperação</h1><p>Quem precisa de ajuda para concluir.</p></header>
    <div class="cr-metrics" aria-live="polite">
        <div><span>Pessoas identificadas</span><strong data-metric="people">—</strong></div>
        <div><span>Pessoas com erro</span><strong data-metric="errors">—</strong><small data-metric="rate"></small></div>
        <div><span>Recuperadas manualmente</span><strong data-metric="recovered">—</strong><small data-metric="linked"></small></div>
        <div><span>Compras detectadas</span><strong data-metric="bought">—</strong></div>
    </div>
    <p class="cr-muted" data-device-summary></p>
    <div class="cr-toolbar">
        <label>Período <select data-period><option value="1">Últimas 24 horas</option><option value="7" selected>Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
        <label>Visualização <select data-view><option value="list">Lista</option><option value="kanban">Kanban</option></select></label>
        <button type="button" data-refresh><span class="dashicons dashicons-update" aria-hidden="true"></span> Atualizar</button>
        <button type="button" data-settings-toggle aria-expanded="false"><span class="dashicons dashicons-admin-generic" aria-hidden="true"></span> Configurar</button>
    </div>
    <form class="cr-settings" data-settings hidden>
        <h2>Coleta de recuperação</h2>
        <label><input type="checkbox" name="enabled"> Ativar coleta no checkout</label>
        <label>Inatividade antes de entrar em Atenção <input name="idle" type="number" min="1" max="120" value="15"> minutos</label>
        <p>Erros entram em Atenção imediatamente. O prazo inicial de 15 minutos é ajustável; dados e histórico são removidos após 90 dias da criação do atendimento.</p>
        <p>Ative somente após adequar a informação de privacidade da loja. Contatos ficam protegidos e separados dos eventos técnicos. A coleta começa após ativar; não recupera contatos de logs antigos.</p>
        <button type="submit">Salvar configuração</button>
    </form>
    <p class="cr-muted" data-capture-status></p>
    <form class="cr-toolbar" data-search-form>
        <label>Buscar <input type="search" data-search placeholder="E-mail, telefone ou pedido" aria-label="E-mail, telefone ou número do pedido"></label><button type="submit">Buscar</button>
        <label>Envio <select data-shipping><option value="">Todos</option><option>Motoboy</option><option>SEDEX</option><option>PAC</option></select></label>
        <label>Aparelho <select data-device><option value="">Todos</option><option value="mobile">Celular</option><option value="desktop">Computador</option></select></label>
    </form>
    <div class="cr-tabs" aria-label="Filas">
        <button type="button" data-queue="attention" aria-pressed="true">Atenção</button>
        <button type="button" data-queue="active" aria-pressed="false">Em andamento</button>
        <button type="button" data-queue="contact" aria-pressed="false">Em contato</button>
        <button type="button" data-queue="closed" aria-pressed="false">Encerrados</button>
        <button type="button" data-queue="all" aria-pressed="false">Todos</button>
    </div>
    <div class="cr-bulk">
        <label><input type="checkbox" data-select-all> Selecionar esta página</label><span data-selected>0 selecionados</span>
        <select data-bulk-action aria-label="Ação nos selecionados"><option value="">Ação em lote…</option><option value="contact">Em contato</option><option value="recovered">Recuperado</option><option value="lost">Não recuperado</option><option value="delete">Excluir</option></select>
        <button type="button" data-apply>Aplicar</button>
        <button type="button" data-copy><span class="dashicons dashicons-admin-page" aria-hidden="true"></span> Copiar logs</button>
        <button type="button" data-download><span class="dashicons dashicons-download" aria-hidden="true"></span> Baixar logs</button>
    </div>
    <p class="cr-muted">Erros primeiro; depois, mais execuções e atividade recente. A mesma pessoa pode ter mais de um atendimento. Contagens não devem ser somadas entre resultados.</p>
    <div data-records></div>
    <div class="cr-pagination"><button type="button" data-prev>Anterior</button><span data-page></span><button type="button" data-next>Próxima</button></div>
    <p role="status" aria-live="polite" data-notice></p>
    <dialog data-dialog><form method="dialog"><h2 data-dialog-title></h2><p data-dialog-description></p><div data-dialog-fields></div><div class="cr-dialog-actions"><button value="cancel" formnovalidate>Voltar</button><button value="confirm">Confirmar</button></div></form></dialog>
</section>
