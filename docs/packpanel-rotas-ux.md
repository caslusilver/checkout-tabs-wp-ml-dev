# PackPanel — experiência de rotas 3.3.6

A revisão **3.3.6** aproxima os cartões da aba Motoboy, exibe destino final no cabeçalho e dados da viagem após despacho, acrescenta contadores de entregas e organiza a cópia com complemento e espaçamento. Veja [cartões e dados da viagem](packpanel-rotas-cartoes-viagem.md) para operação, evidências e rollback. A página do cliente por shortcode segue como próxima fase.

Origem e decisões: [Blueprint V1 da entrevista](https://app.notion.com/p/41d4347fa2c281ddac19efb9e3cf4a7e). A transcrição integral está vinculada no Notion. O usuário confirmou o cálculo n8n no painel antes desta revisão. Esta versão ainda depende de aceite da interface real após atualização.

## Operação

Desde 3.3.5, pedidos atribuídos na prévia saem da lista aberta e entram em **Pedidos atribuídos (N)**, um único grupo recolhido que pode ser reaberto para revisar todos. O mapa geral permanece. Os grupos por rota continuam abaixo e não se abrem automaticamente ao receber pedidos. O cabeçalho tem um slider azul compacto para calcular/recalcular sem abrir o cartão: somente deslizar até o fim solicita o cálculo; toque ou gesto incompleto não executam. A indicação Cálculo pendente/atualizado ajuda a conferir o resultado com o grupo fechado.

Dentro de **Paradas e pedidos**, **Desmarcar** retira o pedido da rota e volta a **Sem rota**. Os demais pedidos e ficha do grupo são mantidos, e o cálculo do grupo fica pendente. O botão anterior **Desmarcar** da prévia continua retirando só da visualização, sem desfazer o agrupamento, conforme seu título de ajuda. Pedidos em rota já despachados não recebem a nova ação de retirada.

Rollback desta micro melhoria: **v3.3.4**, commit de integração `840c2035ef78d9ff00ad4668cb75509463fb1237`.

1. Pedidos sem rota e em rotas em preparação continuam na aba Motoboy. Os agrupados são recolhidos e identificados pela rota/parada. Pedidos já despachados seguem na aba Pedidos em rota.
2. Selecione todos ou alguns e use **Visualizar rota da seleção**. A prévia compara também pedidos novos, mantendo a atribuição existente. Altere o seletor apenas dos pedidos que deseja mover.
3. Ao mudar a composição, recalcule os grupos afetados. A consulta da seleção não altera automaticamente a ordem salva dos grupos. **Atualizar painel** apenas relê os dados e mostra retorno da atualização.
4. Preencha rastreio, WhatsApp do motoboy, código e custos por pedido. A ficha é salva após pausa de aproximadamente um segundo. Aguarde **Rascunho salvo**. Se falhar, os campos permanecem preenchidos e há uma tentativa manual. Dados incompletos podem ser guardados como rascunho.
5. A mensagem acima do slider informa a pendência específica. Cálculo válido e campos completos habilitam o envio verde. Somente um gesto completo envia. O envio mantém eventos por pedido e código exclusivo da última parada.
6. Os controles **Destinatário** e **Valores** no topo afetam todos os grupos e a prévia. O mapa permanece visível. Os dados continuam sendo acessíveis ao operador autorizado: ocultar é apresentação, não anonimização das posições geográficas.
7. Abra o detalhe da última parada para pedir o Uber. Há cópia de nome, telefone nacional e endereço, além do botão anterior **Copiar dados para o motoboy**. DDI fica separado. WhatsApp usa o número internacional.

## Google Maps com ruas

Em **WordPress → PackPanel → Rotas**, no campo **Nome da chave do mapa Google**, abra **Como obter e configurar a chave**.

1. No [Google Cloud](https://console.cloud.google.com/google/maps-apis/credentials), selecione o projeto com faturamento ativo.
2. Habilite **Maps JavaScript API**. O cálculo do n8n permanece na Routes API.
3. Crie uma chave de API para navegador. Em restrições de aplicativo, selecione Sites e cadastre o domínio do painel, por exemplo `https://sualoja.com.br/*`. Autorize também o domínio com www somente se usado pelo painel.
4. Restrinja essa chave à **Maps JavaScript API**. Guarde o valor no seu gerenciador de chaves e dê um nome, por exemplo `mapa_rotas`. No campo **Nome da chave do mapa Google** do PackPanel, informe somente `mapa_rotas` e salve. O plugin resolve o valor por `sakm_get_key('mapa_rotas')`. Ao salvar, a antiga opção de chave direta do PackPanel é removida.
5. Abra uma rota calculada. Confira ruas, numeração, trajeto e zoom. Um aviso acompanhado de esquema indica ausência da chave ou falha do Google. Confira API habilitada, domínio permitido e faturamento. Restrições podem demorar alguns minutos a propagar.

A chave é criada pelo Google, não inventada. O nome de referência é definido por você no gerenciador. Centralizar o valor no gerenciador evita uma cópia direta nas opções do plugin e facilita rotação, mas a chave do mapa ainda é disponibilizada ao navegador por definição dessa integração. Restrinja-a por domínio e API. Não use o segredo Authorization do webhook nem exponha a chave de servidor do n8n. O carregamento de mapas tem cobrança própria: confira cotas e alertas no projeto Google.

Referência: [configuração oficial da Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key).

### Controles do mapa — 3.3.4

No canto superior direito, **Focar saída** centraliza a origem e aproxima para o nível de ruas (zoom 16). **Expandir** abre o mesmo mapa numa janela ampliada, mantendo o zoom e o centro. O mesmo botão vira **Recolher**, que devolve o mapa ao cartão. Escape também fecha, o foco retorna ao botão e a rolagem da página é restaurada. Os controles não fazem chamadas de cálculo ou despacho. Focar saída fica indisponível quando há somente o esquema alternativo, sem mapa Google.

Números e origem usam `MapPanes.markerLayer` (camada 2), acima do trajeto em `overlayLayer` (camada 1). A ampliação não depende do fullscreen nativo do navegador e mantém a biblioteca Google carregada uma única vez. Testes DOM simulam camadas, foco, zoom, expansão/recolhimento, Escape e ausência de novas chamadas. Validar o comportamento real em celular/PWA após atualizar.

Rollback desta correção: **v3.3.3**, commit de integração `eaf8ecbd2c2e6be62a782885cc6a621cf9da025a`. Não muda o cadastro da chave no gerenciador.

## Proteção e persistência

- Cliente impede ação sobreposta. Atualização manual tem intervalo de cinco segundos. O servidor reaproveita a leitura por até três segundos por operador.
- Cálculo idêntico válido reaproveita cache de até trinta minutos, associado ao operador, origem, endereços e endpoint. Alteração de endereço/composição/origem ou expiração exige cálculo novo. Respostas com pendências não entram no índice de reutilização automática.
- Um lock de conexão MySQL permite um cálculo externo por vez no site, liberado em finally. O intervalo por operador continua ativo para consultas novas. Falha informa espera/erro sem apagar seleção. Isso reduz abuso acidental; não é garantia de disponibilidade nem substitui a futura auditoria dos demais endpoints.
- Autosaves são serializados, usam revisão otimista e não reconstroem o formulário durante a digitação. Resposta antiga não apaga edição nova. Polling não se sobrepõe ao salvamento. Conflitos permanecem visíveis e não sobrescrevem silenciosamente mudanças de outra sessão.
- A ficha deve reconciliar o salvamento antes de agrupar/despachar. Reagrupar preserva custo do pedido e dados de cada rota. Somente os cálculos dos grupos afetados são invalidados.
- O país telefônico é capturado do checkout e gravado no pedido, nunca deduzido do endereço. Em pedidos antigos sem país inequívoco, apenas o DDI disponível é exibido. O contrato `dial_code` e o número nacional nos payloads permanece.

## Continuidade e validação

Código em `packing-panel-woo-dev/assets/js/routes.js`, `assets/css/routes.css`, `inc/core/class-routes*.php`, `inc/core/class-route-calculation.php`, `inc/core/class-utils.php`, `inc/admin/class-admin-routes-tab.php` e template do painel. País telefônico é persistido em `inc/frontend/guest-checkout.php`, na raiz.

Testes com dados fictícios e provedores simulados: `tests/packpanel-routes.test.php`, `tests/packpanel-routes-dom.qa.cjs` e `tests/phone-normalization.test.js`. Conferir interface real em desktop, celular, PWA e Elementor após atualizar. O teste de mapa simula a biblioteca Google; não faz chamada cobrada nem comprova chave real.

O [roteiro n8n efetivo](packpanel-rotas-n8n-validado.md) guarda os nodes, expressões, códigos e opções aceitos na sessão. Nenhuma mudança no fluxo externo é necessária para usar esta revisão.

## Rollback

Versão anterior a esta correção do campo **v3.3.2**, commit de integração `f63404e4c044edad61b79a45be48aa13d277d329`. Ao voltar a 3.3.2, será necessário preencher novamente o campo de chave direta do mapa dessa versão. O valor criptografado no gerenciador é preservado. Para voltar à experiência anterior à revisão visual, a tag **v3.3.1** também continua disponível. Reverter código não cancela despachos/eventos já enviados.
