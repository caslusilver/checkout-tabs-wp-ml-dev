# Página completa de obrigado — v3.4.9

## Ajustes e tarja — v3.4.10

Em Checkout Tabs ML → Página de obrigado: tamanho das informações por dropdown (Original, +15%, +30%, +50%, Personalizado), campo de percentual, espaçamento interno adicional por lado (padrão +10px), URL de logo PNG/SVG e diagnóstico. O WordPress pode não permitir upload SVG na mídia: use uma URL de SVG já hospedado; este módulo não habilita uploads inseguros. Vazio mantém nome do site. Diagnóstico registra eventos/estado/código HTTP no console e em WooCommerce → Status → Logs, fonte `ctwpml-thankyou`, sem valores de credenciais, links de pedidos, payloads ou dados pessoais.

Para colocar a tarja no menu inferior, insira `[checkout_ml_pedido_status]` no widget Shortcode da seção desejada. A tarja não fixa nem reposiciona seu menu. Aparece somente para comprador autenticado com pedido ativo; não mostra na página completa de obrigado nem no rastreio configurado da Central. Para páginas futuras de rastreio, o filtro `ctwpml_order_strip_tracking_pages` recebe a lista de IDs excluídos. Sem shortcode, não há consultas de pedidos feitas pelo componente.

Prioridade: primeiro os últimos pendentes/on-hold; se não houver, os pedidos processing mais recentes. A busca é limitada a cinco por grupo, verifica o proprietário e exclui paradas fechadas. Completed/cancelled/failed/refunded não são candidatos. Não é um seletor de histórico. Alterações no banco externo só aparecem depois que o gateway atualiza o pedido no WooCommerce.

Pendente mostra Pix se disponível e timer visual compartilhado com a página de obrigado na sessão da aba. Ao observar pago pela primeira vez, mostra verde por quatro segundos; depois preparação azul ou em rota azul. O botão muda para Ver pedido, usando Central quando disponível e obrigado como alternativa; abre outra aba. Não dispara aprovação financeira nem navegação automática pela tarja. Sem Pix disponível, o acesso à página do pedido permanece disponível.

Leitura AJAX autenticada a cada15s, com pausa quando a aba está oculta, reconsulta ao foco, backoff até60s, sem sobreposição e limite por usuário. O servidor determina o comprador pela sessão, não por parâmetro enviado pelo navegador. HTML inicial não contém dados de pedido. Mantenha o padrão WordPress de não servir cache público para usuários autenticados; sessões/nonce desatualizados ocultam a tarja em vez de exibir informações indevidas.

## Instalação

1. Atualize o Checkout Tabs ML para v3.4.9 pelo Git Updater em develop.
2. Crie uma página ou edite a página de obrigado escolhida. Remova Purchase Summary, blocos manuais e shortcode Pix antigo dessa página; mantenha somente `[checkout_ml_obrigado]` em um widget Shortcode. Não publique duas composições juntas.
3. Abra Checkout Tabs ML → Página de obrigado, selecione essa página publicada, ajuste os textos, timer visual (padrão 6 minutos) e WhatsApp do suporte com DDI e número. Salve. Sem seleção, o endereço de retorno do checkout continua inalterado.
4. Novas compras usam a página selecionada com `order_id` e `key`. Links antigos com `order-received/{id}/?key=...` continuam sendo lidos na página que contém o shortcode. A identidade da URL não é um sinal de pagamento.
5. O plugin usa uma casca completa sem header/footer do tema somente nessa página. No editor não executa a compra nem mostra dados reais. Assets, endpoints e lógica do gateway continuam ativos no site.
6. Desative os snippets externos Asaas Pix Widget e Thank-You Tweaks após conferir que não são usados em outras páginas. Este módulo não os modifica ou remove automaticamente. A página completa não executa o hook thankyou antigo para evitar blocos duplicados; extensões de terceiros que dependam dele precisam ser avaliadas antes da migração.
7. Exclua a página e suas variações com query string do cache/CDN/PWA. O servidor emite no-cache e DONOTCACHEPAGE; camadas que ignoram esses sinais precisam de exclusão explícita.

## Confirmação

O gateway continua recebendo `/asaas-webhook`, autenticando e validando `payment-status`, e atualiza o pedido WooCommerce. A página consulta apenas o estado do pedido autorizado a cada cinco segundos, sem sobrepor chamadas, pausa quando oculta e consulta ao recuperar foco/visibilidade/rede. Falhas têm espera progressiva de até 60 segundos; não se tornam sucesso. A página não consulta Supabase nem Inter no navegador e nunca chama payment_complete.

Pedidos processing/completed mostram confirmação; pending/on-hold continuam aguardando; failed/cancelled/refunded têm mensagem própria. É necessário o gateway concluir sua atualização no WooCommerce: uma alteração isolada em wc_invoices não muda a página.

Motoboy utiliza o gerador da Central existente somente para pedido pago. Após aviso de três segundos tenta abrir outra aba e mantém botão de acesso. Navegadores podem bloquear abertura automática; a página de obrigado nunca é substituída. Correios não recebe esse redirecionamento. Configure a página da Central e habilite Rotas para haver link.

## Timer e Pix

O contador visual inicia no primeiro acesso na aba, fica na sessão do navegador por pedido e não reinicia em reload. Não representa expiração bancária, não cancela pedido e não revoga Pix ao zerar. Alterar a duração nas configurações cria nova contagem visual na próxima abertura. Cobrança continua com validade definida no n8n (24 horas); o módulo não muda essa validade.

Payload e imagem vêm dos metadados JSON `__ASAAS_ORDER` do gateway. O texto é copiado integralmente, sem trocar maiúsculas/minúsculas. QR aceita apenas imagem Base64 raster válida, aparece ao lado no desktop e fica oculto no celular. Metadados ausentes mostram aviso, não criam cobrança nova.

Cancelar usa a URL e nonce nativos do WooCommerce, somente quando a plataforma considera o pedido pagável em pending/failed. O slide exige 75%; gesto incompleto retorna. O WooCommerce revalida no destino. Não é estorno nem cancelamento automático da cobrança bancária.

## Validação e rollback

Fixtures PHP: autorização por chave/proprietário, isolamento de pedidos e estados. Edge com respostas locais fictícias: mobile/desktop, cópia integral, confirmação sem reload, foco, ausência de sobreposição e bloqueio de pop-up. Não substituem pagamento real. Após instalação valide um pedido próprio, deixe a página aberta, pague, volte do banco e observe confirmação; teste Motoboy e Correios.

Rollback: desmarque a página em configurações, restaure a composição antiga e snippets preservados e retorne à v3.4.8. Não deixe links novos apontando para uma página sem shortcode. Nenhum dado financeiro é migrado ou apagado.
