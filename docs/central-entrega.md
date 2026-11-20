# Central de Entrega — v3.3.9

## Fuso e previsões de envio — v3.4.5

O fuso é o de **WordPress → Configurações → Geral** (nesta loja, São Paulo / `America/Sao_Paulo`). Não há um segundo relógio no checkout. **Checkout ML → Horários** mostra fuso, hora local e próxima saída para conferência. Formatos de data/hora são apenas apresentação.

O instante de pagamento (ou criação se ausente) é convertido para o calendário local antes de selecionar a saída. `_ppwoo_dispatch_window` continua guardando o instante absoluto; o novo meta interno `_ppwoo_dispatch_context` registra versão, fuso, base e snapshot do calendário/tolerância. Uma previsão válida não muda com refresh, passagem do tempo ou edição posterior do calendário. Se atrasar, mostra atraso.

Se o fuso mudar antes da saída, o contexto permite recalcular a janela com a base e regras originais. Para registros anteriores sem contexto, a rotina compara a previsão salva com os resultados do calendário atual no fuso local e em UTC: mantém a correspondência local; corrige a correspondência UTC para o fuso atual; se nenhuma corresponder, não altera e sinaliza revisão na prévia administrativa. Uma mudança simultânea do calendário pode impedir reconhecer o legado; não se promete recuperação automática nesse caso. Sem calendário, aguarda configuração. A prévia administrativa simula a correção sem gravar.

A reparação é sob demanda na emissão do link ou consulta autenticada da preparação, sem varrer todos os pedidos nem disparar eventos externos. Uma página do cliente já aberta recebe o resultado pelo polling existente. Pedidos já despachados ou concluídos não participam, inclusive quando a emissão do link chama o helper sem rota explícita. O pagamento/status/link não é alterado. Log no debug do PackPanel: **Central: previsão corrigida por fuso**, com ID, motivo e fuso, sem dados de contato.

Exemplo validado em fixture: compra de 20/11/2026 às 16h45 em São Paulo; saídas 15h/18h. No UTC antigo, a previsão podia cair em 21/11 às 15h UTC (12h locais após mudar o fuso). A rotina reconhece esse valor e corrige para **20/11 às 18h de São Paulo**. Não subtrai três horas de todos os registros.

Validação: `php tests/dispatch-timezone.test.php`, regressões PHP e Node e sintaxe. Testes usam pedidos fictícios; o fuso/armazenamento real do gateway e WordPress precisam de confirmação na loja. Rollback: v3.4.4 (`cc378a4`); voltar o código não desfaz janelas já corrigidas. O meta de contexto preserva o valor anterior da última correção para auditoria e é omitido do webhook nativo de pedidos.

## Preparação e testes administrativos — 3.3.9

A mensagem copiada em “Dados para o motoboy” usa `https://waze.com/ul?q=ENDERECO_CODIFICADO&navigate=yes`, montada pelo helper existente. A busca ainda depende da resolução do endereço pelo Waze; não é a otimização multiparada do painel. Não altera o Google Maps incorporado nem o rastreio Uber. Formato conferido na [documentação oficial](https://developers.google.com/waze/deeplinks). Não foi testada a abertura em aplicativo real.

A preparação usa o layout aprovado, indicador verde de espera, janela de ENVIO em azul e atraso sem deslocar o horário. Reutiliza `ctwpml_next_dispatch` e a tolerância. A janela é gravada no pedido como `_ppwoo_dispatch_window` na primeira resolução, tomando a data de pagamento (ou criação se ausente) como referência; não substitui a janela pelo relógio atual a cada visita. Pedidos antigos usam essa mesma regra, sem precisar de um novo pedido. Sem horários configurados, mostra “A confirmar”. O texto de busca por motoboy dá lugar a espera de saída quando já existe contato na ficha.

Em PackPanel → Rotas há a opção **Aguardar início pelo painel do motoboy (etapa 2)**, desativada por padrão. Desativada, o despacho mostra imediatamente o acompanhamento atual, com mapa/rastreio/previsão. Ativada, retirada confirmada mostra “O motoboy já está com o seu pedido”, espera de início e indicador azul. Só preencher contato ou montar rota não comprova retirada. O futuro evento `driver_started_at` encerrará a espera; ele ainda não é produzido nesta entrega. Enquanto a etapa 2 não existe, desligue a opção para continuar a operação normal. Não há reset de rotas, tokens, confirmações ou data de saída ao alternar. A validade pública continua contando da saída efetiva registrada.

Cada pedido local na aba Motoboy e nas listas de rota tem **Acompanhamento do cliente**. O diálogo apresenta link público quando ativo e uma **prévia administrativa, somente leitura**. Pedidos encerrados/expirados não ganham acesso público novo para teste; a prévia exige sessão com permissão do painel e nonce específico do pedido, não mostra o slider e não altera a baixa. Não compartilhe essa prévia como se fosse link do comprador. Recarregamento mantém o modo da prévia até o nonce vencer.

**Links da rota** permite abrir/copiar o rastreio de viagem já preenchido em rascunhos, rotas despachadas e no histórico, sem depender de uma nova emissão. Dados ainda não preenchidos são identificados como indisponíveis. O futuro painel exclusivo do entregador está sinalizado como etapa 2, sem URL falsa ou endpoint novo. Gerenciador integrado, site remoto, eventos do entregador e offline não foram implementados nesta etapa.

Polling mantém atualização sem reload e preserva a tela se o conteúdo não mudou. Os componentes e o clipboard reutilizam os padrões existentes. Cobertura adicional: janela fixa após mudança de calendário, atraso, opção ligada/desligada, prévia de pedido encerrado, estado azul, transição de preparação para mapa e modo administrativo somente leitura. A aparência real em WordPress/Elementor, celular/PWA e a configuração da página ainda precisam de validação no site.

Rollback desta etapa: v3.3.8, merge `b072cc5b1dcf2e45ab565ad4b762603f3988bbca`. Sem migração de schema; os novos metadados/opções podem permanecer no rollback sem desfazer operações.

Blueprint canônico: https://app.notion.com/p/4174347fa2c281039406ffda42320b4d

## Instalar e testar

1. Publique uma página WordPress com `[ppwoo_order_tracking]`.
2. Em PackPanel → Configurações → Rotas, selecione essa página e salve. HTTPS é obrigatório para a sessão segura.
3. Use a referência da chave Google já configurada no PackPanel, restringindo a Maps JavaScript API ao domínio da loja. A página pública gera carregamentos de mapa; configure cotas no Google.
4. No webhook nativo de pedido WooCommerce, o novo campo de topo `order_tracking_url` aparece quando um pedido Motoboy aprovado (`processing`) é serializado. Nos eventos PackPanel, é `event_data.tracking_data.order_tracking_url`. **Use esse link no aviso de aprovação que já funciona**. O campo `link` continua contendo o rastreio externo. O código não envia um novo aviso por conta própria.
5. Abra o link sem login antes do despacho: a página mostra preparação. Despache pelo painel, mantendo a mesma aba/link: mapa, previsão, contato e rastreio aparecem na atualização seguinte (até 30 segundos).
6. Confira um destinatário intermediário e o último. Apenas o último recebe o código. Confirme pelo slide: baixa individual, contador atualizado e agradecimento. Não há botão alternativo de toque. O arraste deve começar na área inicial, percorrer pelo menos 60% do controle e alcançar o fim; toque isolado, cancelamento e arraste incompleto voltam ao início. Por teclado, ajuste o slider e pressione Enter no fim.

A emissão é estável por pedido, protegida por lock MySQL durante a criação. Guardamos nonce e verificador no meta interno `_ppwoo_tracking_access`, nunca o token bruto no banco. O segredo da instalação assina o acesso. Trocar salts invalida links. O verificador é retirado dos metadados dos webhooks nativos. O link em si é privado e o canal autorizado que o distribui deve protegê-lo.

## Validade e encerramento

Antes da saída, o link autoriza somente o estado de preparação enquanto o pedido estiver aprovado; não há contagem de 24h antes do despacho. Após a saída, vale até `departed_at + 24h`, encerrando antes pela baixa administrativa ou confirmação do cliente. Expirar não confirma entrega.

Na seleção Compartilhar/Copiar, um link vencido pode ser renovado explicitamente para mais 24h, invalidando o anterior. Pedidos encerrados não podem receber novo acesso. A confirmação é transacional e repetível sem duplicar a baixa; depois de confirmada, o acesso normal aos dados é negado, mas a repetição da mesma confirmação pode obter apenas o recibo de sucesso até a expiração.

Não alteramos o status comercial WooCommerce pela confirmação do cliente. Auditoria registra `closed_source=customer`, preservando a baixa administrativa e as posições originais. Os eventos internos de despacho continuam para os contratos existentes; o fluxo n8n decide quais deles geram avisos ao cliente. Não foi alterado o n8n de produção.

## Mapa público

A resposta administrativa nunca é reutilizada diretamente. O próprio destino mantém precisão; demais destinos são generalizados em grade de aproximadamente 2km e a origem em grade de aproximadamente 5km, sem pino. A região de saída ganha círculo visível de 10km e rótulo, com enquadramento pela área do círculo. É uma região aproximada, não o limite municipal. Reutiliza o ponto resolvido a partir do CEP completo já configurado no PackPanel; não tenta deduzir cidade pelos quatro primeiros dígitos.

Desde 3.3.8, a linha usa a geometria viária do cálculo fixado no despacho, com lacunas nas áreas privadas. No servidor são retirados segmentos que passam perto das regiões públicas da origem (10km) e de terceiros (2,5km), com margem conservadora de 150m, inclusive segmentos com os dois extremos fora mas que atravessam a região. Esses tamanhos cobrem a diferença entre o endereço privado e o centro generalizado. Os trechos não são reconectados por retas. Em rotas curtas, toda a geometria pode ficar oculta pela proteção; permanecem as referências públicas e o próprio destino. Não enviamos a trajetória completa para escondê-la por CSS. Não representa GPS ao vivo. Endereços, nomes e telefones de terceiros, produtos, valores e código das paradas intermediárias não fazem parte do DTO público.

Somente dados do cálculo fixado no despacho são utilizados. Não há nova Matrix/Routes/Geocoding por visita. A estimativa usa `eta_at`, calculada pela saída mais duração acumulada; prazo ultrapassado gera aviso em vez de nova estimativa inventada.

## Segurança e limites

Token no fragmento da URL, removido antes de carregar Google. Troca por cookie Secure/HttpOnly/SameSite=Strict, validação em toda ação, cabeçalho próprio e checagem de origem para AJAX. Páginas/respostas sem cache e sem indexação, sem scripts de analytics do tema no template. Cache/CDN/PWA da instalação deve respeitar a exclusão da página e admin-ajax. O endpoint é exposto para acesso por link e exige esse acesso para dados/baixa; nonce público não é autorização.

Limite básico por minuto de IP e acesso, sem chamadas de cálculo no polling, com pausa em aba oculta e sem sobreposição. Limites por transientes não são proteção de borda contra DDoS, nem garantem contadores atômicos em concorrência; uma auditoria ampla de endpoints/infraestrutura continua separada.

Sem migração de schema. O template da página selecionada é independente do tema e não executa header/footer, Elementor ou scripts de terceiros. Não afeta as outras páginas. O shortcode fora da página selecionada não carrega a aplicação; selecione a página nas configurações para usá-lo.

## Validação

### Fluxo após teste real — v3.4.4

A retirada rápida pelo operador inicia a primeira parada e atualiza o acompanhamento sem depender da ficha completa/n8n. Rastreio e código aparecem quando forem preenchidos; campos ausentes não geram dados fictícios. Corrigir contato não reinicia o horário. O recebimento foi movido para depois da mensagem de estado, antes do endereço/previsão/links, preservando sua validação no servidor.

Gesto inicia no puxador, atinge 75% e confirma ao soltar. Abaixo disso, cancelado ou só toque não executa a ação. Polling passa a 5s na aba visível com recuo em erros; resposta `unchanged` só após autorização/validade confirmadas evita repetir geometria/dados. A interface reaproveita seu estado sem reconstruir o slide nem o mapa. Não altera aprovação comercial de pagamento.

Blueprint e decisões: https://app.notion.com/p/41e4347fa2c281fa8d46ea80bb51fc80. Rollback v3.4.3 requer completar as fichas de retirada rápida antes, pois a versão antiga não oferece esse fluxo. Conferência no celular/iOS, PWA/Elementor reais, cookies entre os dois sites e Waze nativo continua sendo validação no ambiente do usuário.

### Ajuste visual v3.4.3 — prévia aprovada em 20/11/2026

O cliente passa a ver o indicador pulsante antes da mensagem operacional e um contorno superior de 3 px com cantos arredondados de 22 px na divisão do mapa. Ambos usam o mesmo estado e as mesmas cores do painel do entregador: aguardando `#1765d8`, a caminho `#9a5700`, chegada/entrega registrada `#168343`. Preparação mantém o verde. O texto distingue chegada de entrega registrada; somente o slide do comprador confirma recebimento. Redução de movimento desativa o pulso sem esconder o indicador.

Polling muda estado/texto sem recriar mapa ou controle de confirmação. WhatsApp e rastreio continuam com `target="_blank"` e `rel="noopener noreferrer"`. A referência visual aprovada usa dados fictícios; o trajeto real, suas restrições de privacidade e os dados da previsão permanecem no fluxo existente.

Aceite informado pelo usuário: primeiro teste de sincronização bilateral funcionou. Esse relato valida o teste feito por ele; não equivale a teste de produção executado pelo agente. Rollback do ajuste visual: **v3.4.2**, `957346c1c763e2fa16058c0d9c16d0a83332a7a9`.

Validação desta correção: 23 testes Node de regressão; suíte PHP de rotas/Central/motoboy; dois testes de navegador Edge com fixtures locais. `tests/tracking-browser.qa.cjs` confere estados, prioridade contra CSS conflitante, cantos/espessura, atualização sem recriar o slide, novas abas sem `opener`, redução de movimento, toque/gesto incompleto, erro/restauração e recebimento por gesto completo. `tests/driver-browser.qa.cjs` mantém cobertura de retomada offline. Não valida iOS/Safari, diálogos nativos do Waze, PWA/Elementor reais ou Google Maps de produção.

14 testes Node: fluxo público preparação→despacho→confirmação, rejeição de toque/gesto incompleto, mapa com geometria calculada e círculo de saída, bloqueio de gesto de zoom do documento, compartilhamento/cópia por destinatário sem código intermediário, preservação de edição e telefones. Suíte PHP: emissão estável antes/depois da saída, webhook nativo, expiração, vínculo de rota, token incorreto, DTO sanitizado, última parada, baixa e corte de cruzamentos privados. Sintaxe dos PHP/JS alterados e diff limpo. No celular, viewport e handlers de gesto bloqueiam zoom do documento, enquanto Google Maps recebe os gestos dentro de seu contêiner. Desktop preserva os controles normais de mapa.

Não foram executados WordPress/MySQL/Google Maps reais, cache/CDN/PWA, cookies de navegador real ou envio do fluxo n8n. A prévia visual foi aprovada pelo usuário, não equivale a aceite da integração em produção. API oficial do filtro usado: https://woocommerce.github.io/code-reference/files/woocommerce-includes-class-wc-webhook.html

## Rollback

Versão anterior desta correção: v3.3.7, merge `9d7bfe2c2256e67968909aeda3d94b0f53ba15ec`. Base anterior à Central: v3.3.6, merge `68bbcfa7b8e6e308bc978bb60b54ba2508bd1cb5`. Para desativar a Central, desmarque a página em Rotas antes de reverter. Rollback não apaga metadados nem desfaz recebimentos e eventos já gravados. Sem Chatwoot nesta entrega.
