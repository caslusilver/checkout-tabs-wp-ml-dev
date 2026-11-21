# PackPanel — horários, fechamento de hoje e aviso no site

Implementado na v3.4.7. Blueprint: https://app.notion.com/p/41f4347fa2c2812badb4f3481e8584b6

## Como usar

1. Atualize o plugin na loja pelo Git Updater e reabra o PackPanel/PWA.
2. A engrenagem ao lado do refresh abre **Hoje**, **Semana** e **Aviso no site**. Requer administrador.
3. Toque em um horário para editar/remover. **+ Saída** abre os seletores de hora/minuto. Aplique o horário e depois **Salvar alterações**. Mantém o calendário já configurado; instalações novas não recebem horários de loja inventados.
4. O controle **Motoboy** encerra só os envios restantes de hoje para compras novas. A compra continua disponível após ciência da próxima saída. A reabertura no dia seguinte segue o calendário sem depender de cron/página aberta. Pode reabrir manualmente hoje. Correios não muda.
5. Compras anteriores mantêm as condições de criação, mesmo com confirmação Pix manual posterior. A referência padrão é criação; selecionar pagamento é uma escolha explícita para o fluxo futuro. Não altera promessa já salva.
6. Puxe e solte a faixa **Puxe para recarregar a página** no topo. O gesto incompleto/cancelado não recarrega. Também há **Recarregar página** na engrenagem. O ícone antigo continua atualizando somente pedidos via AJAX.
7. Em **Aviso no site**, escolha mensagens, cores e pulso. Insira `[ppwoo_aviso_envio]` no widget Shortcode do Elementor ou bloco Shortcode do WordPress, no lugar desejado abaixo do header. Não é inserido automaticamente.

Variáveis: `{proxima_saida}` (dia/data/hora), `{proximo_horario}`, `{proxima_data}`, `{horarios_hoje}` e `{status_motoboy}`. Os botões inserem no cursor do último texto editado. Sem calendário: “horário a confirmar”. Mensagens são texto, sem HTML executável.

## Arquitetura e cuidados

- Reutiliza `inc/dispatch-schedule.php`, as opções canônicas de calendário/tolerância, fuso do WordPress, helpers de preparação de pedidos e captura/restauração do PackPanel. `inc/dispatch-controls.php` adiciona exceções temporárias, validação, snapshots e shortcode.
- Exceções em `ctwpml_dispatch_controls` guardam períodos para resolver aprovações tardias, inclusive após reabertura. `_ppwoo_dispatch_window`/`_ppwoo_dispatch_context` congelam o combinado por pedido. Nenhum evento externo novo.
- Gravação administrativa exige POST, nonce, capacidade, revisão e mutex. Outra aba não sobrescreve silenciosamente o calendário. Debug registra ação administrativa, sem cliente/segredo.
- Recarregamento aguarda autosave de fichas; falha/conflito impede reload. Estado temporário fica em sessionStorage por até 30 minutos, vinculado à sessão do operador e removido após leitura. Não persiste nonces, tokens de acesso ou gestos; não reexecuta mutações. Não limpa cache de CDN/service worker nem dispensa conexão para baixar a página.
- Aviso público consulta uma vez por página, compartilhando instâncias. Cache em memória 15s, atualização visível 30s, sem requisições sobrepostas. Endpoint só retorna informações públicas e limita consultas por IP. Checkout revalida ao concluir, independentemente de HTML em cache.
- Voltar para v3.4.6: reabra os envios antes. O código antigo não reconhece a pausa de hoje. Previsões já gravadas e calendário continuam salvos; não há downgrade destrutivo de dados.

## Verificação

Fixtures PHP: `tests/dispatch-controls.test.php` (inclui suíte de rotas/motoboy). JS: `tests/dispatch-controls.test.cjs`, `tests/packpanel-routes-dom.qa.cjs`. Edge local: `tests/dispatch-controls-browser.qa.cjs`. Verificam fechamento/criação anterior/aprovação tardia, reabertura, validação, texto seguro, rejeição de conflitos, rascunhos e reload real. Validação no iPhone/PWA/Elementor da loja continua sendo feita pelo usuário após atualizar.
