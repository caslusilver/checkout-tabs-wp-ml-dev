# Changelog

Este arquivo documenta mudanças do plugin **Checkout Tabs WP ML**.

## [v3.4.12] - 2026-11-26

- Integração de acesso aos dados salvos com Secure Passkeys 1.3.0 instalado separadamente: oferta antecipada no checkout, alternativa tradicional, login no diálogo final e convite opcional de cadastro na página de obrigado para sessão autenticada sem chaves cadastradas.
- Reutiliza challenges, verificação e armazenamento do motor existente; integração com evento wp_login para sessão WooCommerce, renovação de página/nonces após autenticação e mensagens de login/cadastro em português. Shortcode adicional [checkout_ml_acesso] para Minha Conta; o shortcode original permanece funcional e recebe tradução/ícone.
- Ícone fingerprint fornecido pelo usuário. Sem autenticação por reconhecimento de e-mail, migração de chaves ou alteração dos pagamentos.
- Tela verde com spinner e mensagem de processamento exibida antes da gravação dos dados de contato, protegido de atualizações de endereço concorrentes e com prioridade sobre menus fixos. Mensagem de confirmação continua somente após sucesso WooCommerce; erros liberam nova tentativa.
- Layout desktop em duas colunas documentado e apresentado em prévia separada; aplicação desse redesenho aguarda aceite visual. Rollback: v3.4.11. Validação de Face ID/PIN e sessão na loja permanece necessária após atualização.

## [v3.4.11] - 2026-11-25

- Acompanhamento Motoboy do cliente com composição compacta aprovada: mapa menor ampliável, parada/previsão na mesma linha, slide visível antes dos contatos, Uber e WhatsApp lado a lado e informações secundárias em detalhes expansíveis.
- Logo por URL PNG/SVG em PackPanel → Rotas → Central de Entrega do cliente; herda a imagem da página de obrigado quando vazio e mantém nome da loja como alternativa. Reutiliza o ícone WhatsApp já incluído no plugin.
- Mantém mapa real com origem/paradas aproximadas, cores e pulso por estado, links em outra aba, código somente no destino final, polling sem recriar o slide e confirmação a 75% com recuperação de erro. Sem migração ou alteração financeira.
- Rollback: v3.4.10. Instalação real no WordPress/PWA e carregamento Google precisam de validação após atualização.

## [v3.4.10] - 2026-11-25

- Página de obrigado com fontes auxiliares 30% maiores por padrão, seletor de aumento e percentual personalizado, padding lateral adicional de 10px ajustável, imagem de topo por URL PNG/SVG e ícones de escudo/link fornecidos pelo usuário.
- Diagnóstico opcional no console e logs WooCommerce (ctwpml-thankyou), limitado a eventos/estados técnicos, sem payloads, chaves ou dados pessoais.
- Novo shortcode `[checkout_ml_pedido_status]`: tarja compacta para comprador autenticado, priorizando pendente e depois pago mais recente em andamento. Cópia Pix integral, timer de sessão compartilhado com obrigado, confirmação verde transitória e preparação/rota azul, link em nova aba. Oculta em rastreio da Central e na página completa de obrigado; extensão para páginas futuras por filtro.
- Dados carregados por AJAX restrito ao próprio comprador com nonce, limite de consultas, pausa em aba oculta e ausência de sobreposição. Sem dados financeiros no HTML inicial e sem eventos de aprovação/cancelamento.
- Rollback: v3.4.9; retirar shortcode da tarja antes de reverter. Usuário validou a v3.4.9 e aprovou a prévia desta melhoria; validação real da nova versão permanece posterior à atualização.

## [v3.4.9] - 2026-11-25

- Página completa `[checkout_ml_obrigado]`, sem header/footer do tema, com ticket responsivo, Pix Copia e Cola preservado, QR desktop, itens/quantidades/totais e endereço. Configuração em Checkout Tabs ML → Página de obrigado: página, timer visual (6 minutos), textos e WhatsApp do suporte.
- Estado consultado no WooCommerce com autorização por proprietário/chave, nonce, cache privado e limite de leitura. Polling sem sobreposição, pausa em aba oculta e consulta imediata ao voltar; confirmação não depende de query string e não aprova pedido no navegador.
- Motoboy usa o acesso individual da Central após confirmação e tenta abrir outra aba após aviso, com botão quando pop-up é bloqueado. Correios permanece na confirmação. Timer/barra somem fora de pendente; contador visual não altera os 24h do Pix nem cancela pedido ao zerar.
- Copiar preserva o payload integral. Cancelar por slide usa URL/nonce e elegibilidade do WooCommerce; sem novo endpoint financeiro. Referências externas permanecem preservadas para rollback. Publicação em develop autorizada pelo usuário; instalar shortcode e selecionar página é passo administrativo posterior.
- Rollback: v3.4.8 e composição antiga da página. Desmarcar página personalizada antes de desativar o módulo. Teste real na loja após atualização continua necessário.

## [v3.4.8] - 2026-11-25

- Interface do checkout, shortcode, viewport, login e aviso de fechamento limitados ao checkout real: não montam na página personalizada de obrigado nem nos endpoints de pedido/pagamento.
- Editor e iframe de prévia do Elementor não carregam a experiência de compra, splash ou modal global de geolocalização. Hooks de pedidos, APIs, gateway, Pix e página de confirmação permanecem disponíveis no fluxo público.
- Registro contextual dos snippets externos de Pix e prioridade do blueprint da página de obrigado, sem incorporá-los ou alterá-los no site nesta versão.
- Rollback: v3.4.7. Publicação em develop autorizada expressamente pelo usuário.

## [v3.4.7] - 2026-11-21

- PackPanel com título compacto, divisória fina, engrenagem de horários e controle exclusivo dos envios por motoboy. Pop-up Hoje/Semana usa seletores de hora/minuto, calendário e tolerância existentes; somente administradores alteram, com nonce, revisão e proteção contra gravações simultâneas.
- Encerrar hoje mantém a compra disponível e informa a próxima saída útil; reabre automaticamente no próximo dia do calendário ou manualmente no mesmo dia. Pedidos criados antes continuam com o combinado, mesmo confirmados depois. Novos pedidos guardam contexto da previsão desde a criação; a referência por pagamento é uma escolha futura explícita. Previsões válidas e pedidos despachados permanecem preservados.
- Checkout motoboy pede ciência do fechamento, conserva o aceite da mesma condição durante a sessão e revalida no servidor. Correios, Pix e contratos n8n permanecem iguais.
- Recarregamento completo pelo gesto na faixa superior ou pela engrenagem, separado do refresh AJAX. Preserva aba, pedido do carrossel, campos, prévia/seleção de rotas e rascunho de configurações na sessão por até 30 minutos; aguarda salvamentos e bloqueia recarga em operação/conflito. Não repete despacho/cálculo ao restaurar.
- Novo shortcode `[ppwoo_aviso_envio]`, com mensagens, variáveis públicas de horários, cores por estado e pulso opcional. Configuração em engrenagem → Aviso no site. Leitura compartilhada/revalidada, sem sobreposição e pausada em aba oculta; respeita redução de movimento.
- Rollback do código: v3.4.6, `eafc764`. Antes de reverter, reabra os envios: a versão anterior não interpreta o fechamento temporário. Os horários salvos e previsões já associadas aos pedidos permanecem. Publicação direta em `develop` expressamente autorizada como exceção pelo usuário.

## [v3.4.6] - 2026-11-20

- Retirada confirmada pelo operador já inicia a primeira parada tanto no fluxo rápido quanto no despacho pela ficha completa. O motoboy abre endereço/Waze liberados e usa somente os slides de chegada e conclusão/avanço; não há aceite ou início adicional na página dele.
- Cópia antiga em preparação não é exibida como etapa acionável enquanto a primeira consulta online autoriza o acesso. Prévia antecipada permanece somente consulta; não despacha pedidos. Primeira abertura ainda depende de conexão, sem aguardar outro ciclo de polling após a resposta.
- Rotas antigas já despachadas e ainda sem início são preparadas na primeira leitura autorizada, mantendo a saída original. Compatibilidade aceita o início equivalente já salvo offline por uma versão antiga, sem duplicar o início nem descartar a fila; chegada/conclusão continuam sequenciais e idempotentes.
- Resposta compacta “sem mudanças” inclui ID da rota, atendendo ao contrato bilateral. O host remoto deixa de confundi-la com falha; respostas de outra rota são recusadas. Respostas de eventos informam a revisão persistida.
- Sem novos eventos n8n ou alteração da finalização da ficha/recebimento pelo cliente. Rollback: v3.4.5, `20af00b`. Sincronizar filas antes de atualizar os dois sites ou reverter; o código anterior pode voltar a mostrar o início em rotas ainda não preparadas.

## [v3.4.5] - 2026-11-20

- Previsão de envio passa a guardar fuso, instante-base do pagamento/criação e calendário/tolerância originais. O fuso do WordPress continua sendo a referência única; formato de exibição não altera o cálculo.
- Antes do despacho, uma mudança de fuso recalcula somente a janela afetada a partir da base e regras originais. Previsões válidas continuam fixas e indicam atraso, sem avançar no calendário por refresh.
- Pedidos antigos sem contexto são reconhecidos pelo cálculo local ou pelo cálculo anterior em UTC. O legado UTC reconhecido é corrigido na próxima consulta autenticada/emissão de link, mantendo o link e o pagamento; pedidos já despachados/concluídos não são reescritos. Casos sem correspondência ficam preservados e sinalizados na prévia administrativa.
- Checkout ML → Horários mostra hora atual da loja, próxima saída e acesso à configuração central de fuso. Auditoria registra correção sem dados pessoais; contexto interno não é incluído no webhook nativo.
- Testes reproduzem 16h45 → 18h de hoje, UTC → São Paulo, corte de cinco minutos, virada do dia, dias sem saída, repetição, histórico preservado e prévia sem gravação. Rollback do código: v3.4.4, `cc378a4`; previsões já corrigidas permanecem gravadas.

## [v3.4.4] - 2026-11-20

- Retirada rápida: contato e slide curto em 50/50 registram saída/início da primeira parada e preparam o link do entregador no WhatsApp em outra aba. Correção/reenvio preserva link e horário; sem revogação automática. Desfazer mantém dados e é limitado ao período anterior à chegada/baixa e à preparação do evento.
- Ficha posterior: rastreio, código e custos ficam abertos em “Completar depois”, com ícone à direita e recolhimento manual preservado. O evento atual ao n8n só entra na fila ao concluir a ficha; o horário original e a idempotência são mantidos. Fichas pendentes continuam acessíveis mesmo após recebimento pelo cliente.
- Plano operacional vinculado à composição/endereço, independente da expiração de 30 minutos da prévia. Geometria fica em cache temporário separado; perda desse cache não apaga a ordem nem obriga novo cálculo para despachar. Cálculos antigos cujo cache já foi apagado exigem um primeiro recálculo.
- Prévia retira pedidos despachados/encerrados. Atualizações e salvamento preservam campos em edição; mudanças de outros operadores geram conflito em vez de sobrescrita silenciosa.
- Slides deste fluxo concluem a partir de 75%, ao soltar e começando no puxador; pagamento/cancelamento não mudam. Recebimento do cliente sobe para logo após a mensagem de estado.
- Acompanhamento e entregador consultam a cada 5s enquanto visíveis, sem sobreposição, com recuo em erros e retorno compacto quando não há mudanças. Sem novas chamadas de cálculo por polling. Debug informa ação/tempo sem dados pessoais.
- Rollback: v3.4.3, `874af8ced51f2796a1318a98d73a42a78d39cbe4`. Antes de voltar, concluir fichas pendentes e sincronizar filas: a versão anterior não oferece edição da ficha após retirada rápida.

## [v3.4.3] - 2026-11-20

- Central do cliente: indicador pulsante e contorno de 3 px com cantos superiores arredondados acompanham as cores do painel do motoboy: azul aguardando, âmbar a caminho e verde na chegada/entrega registrada. A preparação preserva seu indicador verde. Texto continua identificando cada etapa; registrar entrega não confirma recebimento pelo cliente.
- Waze automático ao iniciar/avançar passa a abrir outra aba com `noopener,noreferrer`, sem redirecionar o painel em bloqueios ou cancelamento. Os links explícitos de Waze, WhatsApp e rastreio mantêm abertura em outra aba. A fila continua sendo salva antes de abrir a navegação.
- Sem mudança em autenticação, endpoints, polling, previsão ou dados enviados. Rollback: v3.4.2, commit `957346c1c763e2fa16058c0d9c16d0a83332a7a9`.

## [v3.4.2] - 2026-11-20

- Restaura a API PHP `sakm_get_key()` para consumidores externos, incluindo o gateway Pix Clone, sem exigir que eles conheçam a classe do novo cofre. A ponte é instalada após plugins/init, se o provedor anterior estiver ausente; a função existente do snippet não é sobrescrita. Layout e valores cadastrados permanecem iguais.
- Mantém os helpers SAKM de listar/salvar/criptografar/decriptar e o acesso administrativo compatível. Novas escritas usam envelopes GCM com IV aleatório; leitura do CTR antigo depende dos parâmetros reais do ambiente ou da importação anterior. Não copia chave/IV fixos do snippet e evita recursão no fallback.
- Checkout: escuta o evento nativo de sucesso diretamente no formulário, inclusive após substituição, preservando animação e redirecionamento do WooCommerce. Falhas não mostram sucesso e o listener não remove vetos de outros gateways.
- Mapa: diferencia recusa de autenticação, falha de rede e timeout. A mensagem de chave recusada passa a depender do sinal de autenticação do Google. Não altera chaves, restrições ou faturamento.
- Diagnóstico de instalação identifica o provedor de chaves sem imprimir segredos. Logs de conclusão registram apenas presença do redirecionamento, sem a URL com chave do pedido. Rollback: v3.4.1, `d99a600f2f50c5158b1c38b0bf3b370228dab067`.

## [v3.4.1] - 2026-11-20

- Cofre movido para **Checkout Tabs ML → Segurança das chaves**, disponível na loja e no modo remoto sem WooCommerce. A antiga aba do PackPanel aponta ao novo local.
- Interface organizada em cadastro, lista de chaves e importação recolhível; cada chave tem Mostrar/Ocultar, Copiar chave, Copiar nome e Remover com confirmação. Inclui as referências do gerenciador legado sem duplicar nomes.
- Valores obtidos somente sob ação de administrador autenticado, por POST com nonce e resposta sem cache. Não são inseridos no HTML inicial; valores revelados são ocultados após um minuto ou ao sair da aba. Cópia tem alternativa manual quando o navegador bloquear a área de transferência.
- Remoção confirmada apaga somente o nome escolhido no cofre e na opção legada, impedindo que o fallback restaure a chave. Demais chaves e configurações são preservadas; instalação/atualização não transfere chaves entre sites.
- Guia bilateral atualizado com o novo caminho. Rollback desta correção: v3.4.0, commit `08a7f5c21eb1296e8a09644b032640dcf0b9c65f`.

## [v3.4.0] - 2026-11-20

- Painel do motoboy por `[ppwoo_driver_panel]`: iniciar, registrar chegada e concluir/avançar por slide, com estados azul, âmbar e verde, marcadores e contorno acompanhando a etapa. Consulta de paradas, mapa da rota, expansão e navegação por Waze; zoom restrito ao mapa.
- Modo local ou host WordPress remoto no mesmo pacote, sem carregar checkout/WooCommerce no modo remoto. Comunicação servidor a servidor por HMAC, domínio permitido, nonce antirreplay, TLS e limite de requisições. Diagnóstico sem pedidos ou efeitos externos.
- Rota e ações persistidas no navegador: reabertura offline por cache restrito do shell, fila ordenada/idempotente e conciliação explícita de conflitos. Ações do entregador não confirmam recebimento pelo comprador nem alteram o status comercial do WooCommerce.
- Atualização automática da Central com início/chegada/entrega registrada e previsão pelo início real e pelos trechos restantes. Correções do entregador respeitam confirmações do cliente; revisão administrativa auditada revoga os acessos anteriores.
- Cofre interno de chaves em PackPanel, AES-256-GCM com IV aleatório, permissão administrativa e nonce. Importação explícita preserva o gerenciador legado e integra as referências de credencial já usadas em cálculo/despacho.
- Links do entregador acessíveis em “Links da rota”, inclusive na preparação. “Cálculo atualizado” em azul e destino final em preto, com apenas o rótulo em negrito.
- Referência de rollback: `v3.3.9`, commit `723a1ec705c561ee332bc50ceec9bb0c37c7c59c`. Configuração e migração de chaves não são ativadas automaticamente. Consulte `docs/painel-motoboy.md` antes de habilitar.

## [v3.3.9] - 2026-11-20

- Mensagem de dados para o motoboy passa a usar Waze com endereço codificado e navigate=yes. O mapa incorporado e o rastreio da viagem permanecem em seus serviços atuais.

- Central: tela de preparação no layout aprovado, indicador verde, janela de envio preservada pela data de aprovação (ou criação), aviso de atraso e atualização automática. Reutiliza calendário e tolerância existentes.
- Opção independente “Aguardar início pelo painel do motoboy”, desativada por padrão. Ativada, mostra retirada confirmada e espera de início com indicador azul; desativada, mantém acompanhamento normal após despacho. O painel do entregador permanece na etapa 2.
- Acesso ao acompanhamento e prévia administrativa somente leitura pelos pedidos Motoboy e cartões de rota, inclusive para pedidos encerrados sem reativar tokens. Links da viagem disponíveis em rascunho, despacho e histórico quando já cadastrados.

## [v3.3.8] - 2026-11-19

- Central: bloqueia o zoom do documento no celular e mantém gestos de navegação no mapa, sem ampliar o restante da página.
- Mapa público: utiliza os trechos do trajeto calculado, em vez de retas entre paradas. Remove no servidor os segmentos próximos da origem e de destinos de terceiros, inclusive cruzamentos sem vértice interno, sem reconectar as lacunas.
- Região de saída destacada por círculo e rótulo, sem pino exato; enquadramento considera a área do círculo. Reutiliza a origem já resolvida do CEP configurado, sem novas consultas externas.
- Recebimento: remove o botão alternativo por clique; exige arraste completo no slider, rejeitando toque no fim e gesto incompleto. Acesso por teclado permanece no próprio slider.

## [v3.3.7] - 2026-11-19

- Central de Entrega por shortcode: página sem header/footer, link individual já disponível no pedido aprovado, estado de preparação e atualização dos dados após despacho, sem exigir outro aviso ao cliente.
- Acesso limitado ao próprio pedido, sessão HttpOnly, expiração 24h após saída, baixa imediata por confirmação, agradecimento e código somente para a última parada. Mapa do cliente usa referências aproximadas de terceiros, sem trajetória administrativa nem origem exata.
- Viagem: Compartilhar e um único Copiar com seleção de destinatário; mensagem individual com parada, contato do motoboy, rastreio e Central, com código apenas no destino final. Link WhatsApp do motoboy acompanha a digitação na ficha.
- Mapa administrativo: controles isolados na camada do mapa para não ultrapassarem o header.
- Configuração da página na aba Rotas do PackPanel. Webhooks nativos de pedido recebem order_tracking_url; eventos PackPanel recebem event_data.tracking_data.order_tracking_url. Campos existentes preservados.

## [v3.3.6] - 2026-11-19

- Rotas: detalhes dos pedidos seguem a organização da aba Motoboy, com cliente, WhatsApp, endereço, CEP, complemento e ícones de cópia usando o mesmo helper e fallback existentes. Cartões recolhidos exibem endereço e identificação da rota.
- Rotas: cabeçalho fechado identifica nome e endereço do destino final calculado; composição alterada mostra destino a confirmar. Slider calculado tem cor discreta e retorna ao destaque quando o cálculo fica pendente.
- Viagem: recupera WhatsApp do motoboy, código e rastreio após despacho em visualização administrativa. Código destacado em azul/branco e cópia por ícone.
- Andamento: Parada X de N e entregas pendentes baseadas na baixa real. Saída/data e Selecionar todos em linhas separadas; status de envio amigável preserva falhas e diagnóstico técnico no debug.
- Mensagem para motoboy: separa informações por linha em branco e recupera complemento WooCommerce/legado do mesmo endereço histórico, sem misturar imóveis diferentes.

## [v3.3.5] - 2026-11-19

- Rotas: pedidos já atribuídos da prévia se consolidam em uma única lista recolhida, mantendo o mapa geral e os seletores por pedido.
- Rotas: grupos novos permanecem fechados, com slider azul compacto de calcular/recalcular no cabeçalho, sem ação por toque simples ou gesto incompleto.
- Rotas: adiciona Desmarcar em Paradas e pedidos para retirar o pedido do grupo e voltar a Sem rota, preservando os demais pedidos e exigindo recálculo do grupo afetado.

## [v3.3.4] - 2026-11-19

- Mapa de rotas: números das paradas e origem na camada de marcadores, acima da linha do trajeto.
- Mapa de rotas: controles Focar saída e Expandir/Recolher no canto superior direito. A visualização ampliada preserva o mapa e zoom, fecha também com Escape e não recalcula a rota.

## [v3.3.3] - 2026-11-19

- PackPanel → Rotas: o campo do mapa recebe somente o nome de referência da chave cadastrada no gerenciador e resolve seu valor por `sakm_get_key()`, seguindo a arquitetura da autenticação existente. Ao salvar, remove a antiga cópia direta das opções do plugin.
- A ajuda explica o cadastro no gerenciador e a necessidade de restrições de domínio/API, pois a chave do mapa continua sendo utilizada no navegador.

## [v3.3.2] - 2026-11-19

- Rotas: mantém pedidos em preparação na aba Motoboy e permite comparar seleções novas com pedidos já agrupados, sem zerar rotas ou fichas.
- Rotas: salva a ficha automaticamente, preserva edições em falha e durante respostas concorrentes, mostra pendências específicas do despacho e destaca o slider de envio apto em verde.
- Rotas: configura Google Maps em PackPanel → Rotas com instruções para gerar e restringir a chave, trajeto sobre ruas, zoom preservado e diagnóstico do esquema alternativo.
- Rotas: controles globais de privacidade, cores discretas por grupo, métricas em azul, duração em horas/minutos, última parada identificada e menos recolhimentos em rota com um pedido.
- Contato: copia telefone nacional separadamente do DDI e preserva o prefixo no WhatsApp internacional. Registra país telefônico nos pedidos novos para exibir nome e bandeira sem usar o endereço como referência.
- Proteção: reaproveita cálculo válido idêntico, serializa cálculos no servidor e limita atualizações repetidas do painel. Contratos de cálculo n8n e eventos individuais de despacho preservados.
- Documentação: consolida o fluxo n8n aceito pelo usuário, decisões, configuração, testes e rollback para v3.3.1.

## [v3.3.1] - 2026-11-18

- PackPanel: reúne as configurações em uma aba Rotas, usa apenas o CEP de saída e busca a credencial pelo nome no mesmo gerenciador de chaves da aba Conexão.
- PackPanel: exibe o trajeto e as paradas numeradas sem exigir uma chave de mapa no navegador e sinaliza os envios que precisam ser conferidos no n8n.

## [v3.3.0] - 2026-11-18

- Pack Panel: cartões de Motoboy recolhíveis, seleção em lote, prévia de rota pelo n8n, mapa com paradas numeradas e agrupamento por pedido.
- Pack Panel: ficha por rota, custo negociado e prazo por pedido, código somente na última parada, fila de disparos individuais, progresso e reenvio controlado.
- Pack Panel: aba Pedidos em rota, baixa por seleção e gesto, histórico e configuração que permite habilitar a V1 separadamente.
- Pack Panel: mantém a cópia manual dos dados de entrega no detalhe individual de cada pedido da rota.

## [v3.2.141] - 2026-11-18

- Checkout: preserva o telefone confirmado ao voltar do login e destaca os campos que precisam de correção quando faltam dados de faturamento.
- Telefone: salva o número nacional nos campos do WooCommerce antes da criação do pedido. Mantém `dial_code` separado no formato já usado pelos webhooks.
- Mobile: ancora o seletor de DDI ao telefone, posiciona o campo abaixo do cabeçalho ao abrir o menu e limita a lista ao espaço acima dos botões.

## [v3.2.140] - 2026-11-17

- Checkout mobile: mantém o campo em foco centralizado na área visível após a abertura do teclado e evita o zoom automático e por pinça.
- Login: adiciona controle acessível para mostrar ou ocultar a senha.
- Confirmação do telefone: separa o DDI do número e apresenta os dígitos agrupados para facilitar a leitura.

## [v3.2.139] - 2026-11-17

- Checkout: confirmação do telefone pode ser editada no próprio diálogo e fica lembrada durante o login, sem repetir para o mesmo número.
- Checkout: mantém um indicador de carregamento neutro durante o envio e só mostra a tela verde após a resposta de sucesso do WooCommerce.
- Interface: reforça contraste e prioridade visual dos botões de confirmação do telefone diante dos estilos do tema e do Elementor.

## [v3.2.138] - 2026-11-16

- Expedição: mostra a previsão com “hoje” quando aplicável e apenas com Motoboy selecionado. A tolerância é configurável em minutos, com padrão de 5.
- Endereço: permite ocultar Informações adicionais e Casa ou Trabalho sem apagar os dados existentes.
- Telefone: substitui o bloqueio remoto pela confirmação visual e leva o DDI em campo separado no pedido e nas integrações aplicáveis.
- PackPanel: mostra a modalidade de frete e o WhatsApp do cliente em Pagamentos Pendentes.

## [v3.2.137] - 2026-11-16

### Added
- Painel: confirmação manual de pagamento e cancelamento do pedido por gestos opostos, com opção para alternar entre atualização local do WooCommerce e webhook existente.
- Checkout: configuração de saídas por dia da semana e aviso destacado da próxima saída de Motoboy, separado do prazo de entrega retornado pelo frete.

### Changed
- Ações da aba Pagamentos Pendentes exigem deslizar até o fim, evitando toques acidentais. O modo externo continua sendo o padrão.
- Horários começam vazios e são definidos pelo operador na nova aba Horários; corte de cinco minutos após cada saída, usando o fuso do WordPress.

## [v3.2.136] - 2026-10-19

### Improved
- Formulário de endereço: mantém Salvar cinza e desabilitado até CEP, endereço, tipo e contato obrigatórios estarem válidos; Voltar permanece disponível durante a consulta de CEP.
- Checkout no iPhone: posiciona Salvar e Voltar junto à área visível assim que o teclado abre no primeiro campo, preservando o comportamento no Android.

## [v3.2.135] - 2026-10-19

### Improved
- Painel Motoboy: acrescenta ao final dos dados copiados um link de rota do Google Maps montado com o endereço e CEP do próprio pedido.

## [v3.2.134] - 2026-10-19

### Fixed
- Painel Motoboy: copia os dados consolidados de um campo multilinha do pedido, com tentativa alternativa quando a Clipboard API falha, e mantém contraste do botão mesmo sob estilos do Elementor.
- Checkout no Android: posiciona Salvar e Voltar acima do teclado usando a área visível da tela e restaura o rodapé quando o teclado fecha.

## [v3.2.133] - 2026-10-19

### Improved
- Checkout: explica quando o CPF está incompleto, incluindo a falta de um dígito, e permite avançar pelos campos de contato com Enter sem submeter o pedido.
- Painel Motoboy: cópia do endereço sem a abreviação `nº`, preservando o número da casa para busca e entrega.
- Painel de pedidos: números válidos viram links do WhatsApp e um botão copia nome, link, endereço completo, CEP e complemento em linhas separadas para o motoboy.
- Diagnóstico: a cópia no painel deixa de escrever dados pessoais no log de depuração.

## [v3.2.132] - 2026-09-27

### Fixed
- Checkout: separa o DDI do número nacional brasileiro nos campos do WooCommerce, metadados de contato e webhook de frete; preserva DDD 55 e números internacionais.
- Checkout: restaura números completos sem cortar os últimos dígitos, inclusive após recarregamento e login; bloqueia entradas brasileiras longas que não possam ser normalizadas sem perda.
- Diagnóstico: registra país, origem, comprimentos e conversões do telefone na entrada, sincronização, sessão e pedido, sem salvar os dígitos; compara o telefone do pedido com a referência do contato quando disponível.

#### Protocol: pending

## [v3.2.131] - 2026-09-22

### Fixed
- Checkout: separa a confirmação do frete da validação de faturamento/pagamento; com frete aplicado e totais prontos, o fluxo avança para pagamento sem exibir o falso erro de demora.
- Checkout: sincroniza e-mail, telefone e CPF entre o formulário ML, o snapshot de sessão e os campos reais do WooCommerce sem substituir valores já presentes; aceita telefone internacional entre 8 e 15 dígitos.
- Checkout: grava imediatamente o snapshot de contato ao digitar, ocultar/recarregar a página ou sair dela, e retorna ao formulário quando dados obrigatórios realmente faltam, retomando a revisão após salvar.
- Diagnóstico: adiciona checkpoints de modo do gate, bloqueios, sincronização e campos ausentes sem registrar conteúdo pessoal; remove também dados de contato do log padrão do PHP.

#### Protocol: pending

## [v3.2.130] - 2026-09-22

### Fixed
- Diagnóstico: permite salvar checkpoints anonimizados de visitantes e clientes no arquivo isolado quando o modo Debug está ativo; mantém a visualização, limpeza e download restritos ao painel administrativo.
- Diagnóstico: corrige a autorização inconsistente do endpoint de gravação e adiciona limite de taxa e tamanho para evitar excesso de escrita durante uma sessão pública.

#### Protocol: pending

## [v3.2.129] - 2026-09-22

### Fixed
- Checkout: impede a corrida entre `update_checkout` e o envio final, aguardando a confirmação de sincronização do WooCommerce antes de disparar o pedido; em caso de timeout, bloqueia o envio incompleto e libera a tentativa com mensagem clara.
- Diagnóstico: adiciona checkpoints de espera do submit e timeout monitorado do `wc-ajax=checkout`.
- Logs: cria arquivo isolado em `wp-content/uploads/checkout-tabs-wp-ml-logs/checkout-flow.log`, com proteção de acesso, visualização, cópia, download e limpeza pelo painel Debug; dados pessoais são mascarados antes do armazenamento.

#### Protocol: pending

## [v3.2.128] - 2026-09-08

### Fixed
- corrige a entrada de telefone com `55` adicional quando o país selecionado é Brasil, evitando que a máscara descarte os últimos dígitos; preserva o DDD `55` válido e mantém números internacionais fora dessa regra.

#### Protocol: pending

## [v3.2.127] - 2026-09-08

### Fixed
- remove a atualização automática de 15 segundos do PackPanel, mantendo a atualização sob demanda e preservando os campos manuais preenchidos quando o operador solicita uma atualização.

#### Protocol: pending

## [v3.2.126] - 2026-09-08

### Fixed
- reforça o contraste do ícone de atualização do PackPanel e transforma as ações de aceitar pedido e concluir envio em sliders de confirmação, evitando acionamento por toque acidental e preservando o AJAX existente.

#### Protocol: pending

## [v3.2.125] - 2026-09-08

### Fixed
- adiciona atualização automática leve do PackPanel a cada 15 segundos, com atualização manual e pausa quando a página fica oculta; a lista é trocada via AJAX sem reload completo e cada ciclo consulta o webhook externo uma única vez.

#### Protocol: pending

> Importante: **o repositório ainda não foi criado nem publicado no GitHub**.  
> Este changelog está sendo preparado **antes do primeiro push/publicação**.

## Notas de Publicação (ainda não executadas)
- Criar o repositório: `caslusilver/checkout-tabs-wp-ml-dev`
- Branch principal do fluxo: `develop`

## [v3.2.92] - 2026-01-27

### Changed
- retoma fluxo pós-login com snapshot do estado no Review (sem regressão de etapa) e auto-resumo da confirmação; bloqueia auto-abertura do modal após login; remove contorno interno no campo de número do WhatsApp; plano v3.2.92 em txt.

#### Protocol: 0d2ad29

## [v3.2.93] - 2026-01-27

### Changed
- criação automática de conta no checkout via flags do Woo (quando e-mail não existe); manutenção do fluxo pós-login sem reinício; ajuste do SVG do botão de CEP; layout mobile do botão de CEP em linha única.

#### Protocol: 20f9a96

## [v3.2.99] - 2026-01-27

### Changed
- relançamento estável baseado na v3.2.93 para restabelecer o fluxo mais confiável.

#### Protocol: 52ec438

## [v3.2.100] - 2026-01-27

### Changed
- corrige fluxo de criação de conta no checkout ML respeitando o Woo (createaccount e geração automática), evita conflito com guest checkout e reduz bloqueios no CTA.

#### Protocol: a7e70d5

## [v3.2.101] - 2026-01-27

### Changed
- evita fallback de frete com retry do radio sync, revalidação pós-updated_checkout e reforço de sessão do método escolhido.

#### Protocol: f8fe8b7

## [v3.2.102] - 2026-01-27

### Changed
- bloqueia fallback de frete com confirmação server-side do método aplicado e trava checkout quando há mismatch.

#### Protocol: 30fc110

## [v3.2.106] - 2026-01-30

### Changed
- validação de nome completo com sobrenome e aviso inline; máscara de telefone BR no formato (XX) X XXXX-XXXX; persistência de dados do formulário no sessionStorage; máscara de CEP no shortcode com botão habilitado apenas em CEP válido; spinner e bloqueio durante consulta de CEP no modal; prazo do shortcode usa frete*.prazo com unidades consistentes.

#### Protocol: 6f5ea0e

## [v3.2.106] - 2026-02-03

### Changed
- publicação da v3.2.106 na main (release sem alterações adicionais de código).

#### Protocol: d4f7e81

## [v3.2.107] - 2026-02-03

### Changed
- integração do packing-panel-woo-dev no plugin principal (bootstrap unificado, filtros de webhook/debug e assets do painel condicionais ao shortcode).

#### Protocol: 4421a5d

## [v3.2.108] - 2026-02-03

### Changed
- debug detalhado do painel de empacotamento (logs JS/PHP e metadados no HTML para rastreamento de execução).

#### Protocol: f4d8912

## [v3.2.109] - 2026-02-03

### Changed
- restaura detecção de shortcode com fallback para Elementor/Gutenberg; assets do painel carregam quando shortcode está em dados do Elementor.

#### Protocol: 26c8050

## [v3.2.110] - 2026-02-03

### Changed
- registra shortcode do painel após o carregamento do WooCommerce para evitar renderização crua no Elementor.

#### Protocol: a6949a1

## [v3.2.111] - 2026-02-03

### Changed
- atualiza a pasta integrada do packing-panel-woo-dev para base 0.3.3 com classes/admin/integ externas e assets sincronizados; reforça init pos-WooCommerce e detecao de shortcode (Elementor/Gutenberg); adiciona guia TXT de integracao com erros comuns e boas praticas.

#### Protocol: 0531c5c

## [v3.2.111] - 2026-02-03

### Changed
- publicação da v3.2.111 na main (release sem alterações adicionais de código).

#### Protocol: 25b4183

## [v3.2.112] - 2026-02-09

### Changed
- adiciona aba Pagamentos Pendentes no PackPanel com listagem de pedidos pending e ações de confirmar/negar via webhook com Authorization; inclui novos campos de conexão para URL/Auth key name; atualiza versão do PackPanel para 0.3.4.

#### Protocol: ee78e51

## [v3.2.124] - 2026-09-08

### Fixed
- preserva o nome de faturamento no retorno pós-criação de conta/autenticação e faz o botão Voltar da etapa de autenticação retornar para a etapa anterior do checkout em vez do carrinho.

#### Protocol: pending

## [v3.2.123] - 2026-09-08

### Changed
- adiciona toggle administrativo para exibir/ocultar o login com Google/Nextend no checkout ML, desligado por padrão enquanto o OAuth está instável.
- simplifica a autenticação na finalização: e-mail existente abre somente login com e-mail preenchido; e-mail novo abre somente criação automática com e-mail preenchido.

#### Protocol: pending

## [v3.2.122] - 2026-09-07

### Fixed
- corrige reload na etapa final do checkout ML: preserva o endereço selecionado durante falha temporária de recuperação, salva/restaura cidade e UF no snapshot, restaura review/payment somente com pré-requisitos mínimos e renderiza a revisão recuperável quando o gate expira, evitando loading infinito.

#### Protocol: pending

## [v3.2.121] - 2026-09-07

### Changed
- reforça persistência e prontidão do checkout ML antes da revisão/finalização: bloqueia avanço rápido no pagamento enquanto Woo blocks carregam; reidrata faturamento a partir de snapshot, endereço selecionado e sessão; inclui faturamento/pagamento no gate do Review; garante cookie de sessão Woo para visitantes.

#### Protocol: pending

## [v3.2.120] - 2026-02-11

### Changed
- atualiza webhook default de pagamentos para payment-confirmed e corrige salvamento da aba Conexao.

#### Protocol: pending

## [v3.2.119] - 2026-02-11

### Changed
- remove dependencia de payment_id no webhook de pagamentos e envia dados exibidos no painel.

#### Protocol: pending

## [v3.2.118] - 2026-02-11

### Changed
- corrige busca do payment_id no PackPanel priorizando o meta _asaas_id antes do __ASAAS_ORDER.

#### Protocol: pending

## [v3.2.117] - 2026-02-11

### Changed
- ajusta layout da aba Pagamentos para estilo Correios (carrossel), adiciona overflow no titulo da aba, cores com !important e atualiza webhook para invoices com evento distinto.

#### Protocol: pending

## [v3.2.116] - 2026-02-11

### Changed
- aplica PackPanel com aba Pagamentos Pendentes, ações de confirmar/negar via webhook e novos campos de conexão.

#### Protocol: pending

## [v3.2.115] - 2026-02-11

### Changed
- remove vinculo do PackPanel embutido ao repo original (headers Git Updater) e bump de versão para teste de atualização via plugin principal.

#### Protocol: 28652dc

## [v3.2.114] - 2026-02-11

### Changed
- bump de versão para forçar atualização via Git Updater e garantir entrega do painel atualizado.

#### Protocol: 0ac1690

## [v3.2.113] - 2026-02-10

### Changed
- ajusta workflow de release para usar arquivo principal fixo; adiciona diagnóstico de instalação/ativação no console do admin com informações do PackPanel e dependências.

#### Protocol: 5ef24e6

## [Unreleased]

### Changed
- **Versão atual**: v3.2.124
  **Versão sugerida após a mudança**: vX.Y.Z  
  **Descrição**: texto objetivo do que mudou e impacto (pode listar itens separados por ponto e vírgula).

## [v3.2.105] - 2026-01-30

### Changed
- gate com single-flight e limpeza de pendingWooUpdate em qualquer updated_checkout; debounce de eventos woo_updating; preferência por estado aplicado para evitar timeouts.

#### Protocol: efaaa93

## [v3.2.104] - 2026-01-30

### Changed
- redução de flood de logs remotos com throttle e envio restrito a admin; evita 429 em `admin-ajax.php` durante polling do gate.

#### Protocol: 67a5fb5

## [v3.2.103] - 2026-01-30

### Changed
- gate forte com spinner e timeout na sincronização de frete/totais antes de avançar e confirmar; revisão bloqueada até Woo confirmar frete aplicado e totais prontos; eventos de update_checkout sinalizados no ML-only e parâmetros de gate configuráveis via `cc_params`.

#### Protocol: c83f385

## [v3.2.91] - 2026-01-28

### Changed
- corrige assinatura do hook woocommerce_checkout_customer_id para evitar fatal no wc-ajax=checkout; adiciona logs de debug quando checkout não é passado ou e-mail inválido.
- publicação estável de segurança na main; rollback completo da v3.2.92.

#### Protocol: ef8a6f4

## [v3.2.90] - 2026-01-27

### Changed
- cart_thumbs liberado para guest com carga do carrinho em AJAX; confirmação de e-mail movida para salvar endereço (guest) e removida do CTA de confirmação; validação reforçada no save de endereço.

#### Protocol: 1920a08

## [v3.2.89] - 2026-01-27

### Changed
- persistência de e-mail/contato para guest antes do place_order; confirmação obrigatória de e-mail e bloqueio de avanço sem validação; restauração de contato/e-mail após checkout_error com checkpoints adicionais.

#### Protocol: 3ab51ad

## [v3.2.88] - 2026-01-27

### Changed
- correções pós-implementação: botão do shortcode CEP resistente a override do Elementor; modal de geolocalização fecha ao negar permissão; e-mail obrigatório no formulário ML e bloqueio de avanço sem e-mail válido; overlay verde com barra de progresso e bloqueio total em erro crítico.

#### Protocol: 642b99b

## [v3.2.87] - 2026-01-27

### Changed
- checkout com login tardio: sessão guest para endereços/contato/frete, validação de e-mail no CTA e migração após login/criação; shortcode CEP com proxy dedicado, tabela de resultados e botão “Calcular”; toggle admin para geolocalização e endpoint REST de CEP; documentos de intenção técnica da etapa 1 e 2 adicionados na raiz.

#### Protocol: 7ccaf4b

## [v3.2.86] - 2026-01-21

### Changed
- geolocalização (toggle OFF): bloqueia qualquer popup (inclusive abertura manual) e só reaplica cache existente; shortcode `[ctwpml_cep]`: remove link de fallback quando popup estiver OFF e melhora a exibição dos métodos (nome/preço/prazo, incluindo ranges quando disponíveis).

#### Protocol: 989b4be

## [v3.2.85] - 2026-01-21

### Changed
- bump de versão para destravar atualizações via GitUpdater (tag v3.2.84 já existente); mantém shortcode `[ctwpml_cep]` com enqueues locais (CSS/JS) e renderização por método; consumer global reaplica `freteData` (cache/localStorage) e preenche spans dinâmicos; pop-up do plugin nunca abre automaticamente quando o toggle de geolocalização estiver desativado.

#### Protocol: be2d925

## [v3.2.84] - 2026-01-21

### Changed
- pop-up de geolocalização passa a não existir quando desativado no admin (nenhum gatilho automático); consulta de frete via CEP fica 100% user-driven por shortcode; consumer aplica `freteData` (cache/localStorage) e preenche spans dinâmicos; renderização dos métodos de frete abaixo do formulário.

#### Protocol: 2a70469

## [v3.2.82] - 2026-01-19

### Changed
- Checkout (ML): valida “Nome completo” exigindo sobrenome (tudo após o 1º espaço) e preenche corretamente `billing_first_name`/`billing_last_name` para evitar erro de “Sobrenome obrigatório”; Mobile: aumenta `font-size` dos inputs do modal para 16px para evitar zoom ao focar (iOS/Safari).

#### Protocol: 6ea13c2

## [v3.2.81] - 2026-01-19

### Changed
- Endereço (modal ML): adiciona campo “Bairro” no formulário (abaixo de Complemento) e torna obrigatório quando a API não retornar; preenche automaticamente a partir da consulta de CEP quando disponível e injeta inputs hidden no checkout Woo (`billing_neighborhood` e variações) quando ausentes para garantir validação/submit; Scroll: ajusta health check e trava do scroll no root mode para evitar falhas de rolagem e reduzir falso-negativo do `CHK_SCROLL_ENABLED`.

#### Protocol: db36978

## [v3.2.80] - 2026-01-19

### Changed
- Debug/Telemetria: painéis visuais no checkout passam a ser exibidos apenas para administradores (sem expor “Ver Logs”/📊 ao usuário final), mantendo captura/envio de logs; Checkout (ML): reforça hardening do “Bairro” com eventos nativos (`input/change`), detecção de variações de campo (billing_neighbourhood/bairro/shipping_*) e snapshots mais completos quando bloquear no pré-submit ou em `checkout_error`.

#### Protocol: e07dddc

## [v3.2.79] - 2026-01-19

### Changed
- Checkout (ML): hardening do campo “Bairro” obrigatório — preenche bairro com fallback (endereço salvo → lastCepLookup → freteData → campos Woo), suporta instalações que validam bairro via `billing_address_2`, e aplica re-sync leve após `update_checkout`/pré-submit para evitar limpeza por tema/plugins e reduzir `checkout_error`.

#### Protocol: 2e5f627

## [v3.2.78] - 2026-01-19

### Changed
- Geolocalização (modal): corrige hierarquia/posicionamento visual para replicar o padrão original (CTA secundário separado e centralizado; letras miúdas em bloco próprio abaixo de todos os botões com estilo neutro); reforça centralização do popup (inset completo + `box-sizing: border-box` + margens auto) para evitar deslocamento lateral.

#### Protocol: 60cd458

## [v3.2.77] - 2026-01-19

### Changed
- Geolocalização: atualiza o texto do modal para confirmar maioridade (18+) e esclarecer que a localização em tempo real é usada para exibir preços e prazos de entrega mais precisos conforme a região.

#### Protocol: e8fa8d1

## [v3.2.76] - 2026-01-18

### Changed
- Auth (modal ML): link “Perdeu a senha?” passa a apontar diretamente para `wp-login.php?action=lostpassword` via `site_url(..., 'login')`; Review (“Revise e confirme”): nome dos produtos na lista vira link para o carrinho (URL dinâmica via `wc_get_cart_url`) para permitir alterar quantidades.

#### Protocol: 02f2f84

## [v3.2.75] - 2026-01-16

### Changed
- Auth no modal ML: layout desktop em 2 colunas (esquerda Google+login; direita criar conta+reCAPTCHA+Entrar); remove “Entrar” duplicado dentro da view; CSS reforçado para contraste/persistência (labels e botão com `!important`) e wrapper preservado para evitar override de tema/Elementor.

#### Protocol: 8ba7e53

## [v3.2.71] - 2026-01-16

### Changed
- reCAPTCHA v2: remove Site Key hardcoded (que causava “domínio inválido” ao instalar em outro site) e passa a usar chave configurável no admin com fallback para “Login No Captcha reCAPTCHA”; JS passa a consumir `cc_params.recaptcha_site_key`/`data-sitekey` e só carrega a API do Google quando houver chave.

#### Protocol: 78d824e

## [v3.2.72] - 2026-01-16

### Changed
- popup de login reestruturado para página única com e-mail + reCAPTCHA e confirmação antes de prosseguir; novo endpoint `ctwpml_auth_email` cria/loga conta com reCAPTCHA e recarrega sessão; fechamento por overlay/ESC bloqueado e botão X redireciona ao carrinho; reCAPTCHA renderizado uma única vez; back do formulário sem endereços volta ao carrinho; sanitização do erro de senha no login.

#### Protocol: f02f57b

## [v3.2.73] - 2026-01-16

### Changed
- pop-up de autenticação reestruturado para hierarquia correta (Google primeiro, login e-mail+senha e criação de conta separada); endpoint `ctwpml_auth_email` passa a criar conta apenas quando o e-mail não existe (sem login inseguro); reCAPTCHA com controlador anti-loop (timeout, limite de tentativas e cancelamento), render único quando modal está visível e reset controlado; remove render no `document.ready` para evitar loop com popup oculto.

#### Protocol: fd5edab

## [v3.2.74] - 2026-01-16

### Changed
- autenticação migrada do Fancybox para uma view dentro do modal ML (sem popup/fechamento ao clicar fora); reCAPTCHA com loader anti-loop (timeout, limite de tentativas, cancelamento) e fallback de injeção do `api.js` quando necessário; cache-busting do JS (novo arquivo/handle) para evitar mistura de versões antigas e logs em loop.

#### Protocol: 898003f

## [v3.2.70] - 2026-01-16

### Changed
- Splash screen: prioriza exibição na primeira visita (markup via `wp_body_open` + flag em `html`), carrega JS no head para evitar “flash” do site no iOS e inicia timer após início de load do asset (fallback), mantendo branding enquanto a página carrega por baixo.

#### Protocol: d5f0faf

## [v3.2.69] - 2026-01-16

### Changed
- Pagamento: substitui chevron textual por SVG local mais nítido; Form de endereço: aplica borda/stroke 2px #bbbbbb em todos os campos (inclui wrapper do telefone); Review: exibe o prazo selecionado com `ctwpml-shipping-option-label` em verde (#00A66C) abaixo do título do frete.

#### Protocol: c0d135a

## [v3.2.68] - 2026-01-16

### Changed
- Corrige erro de JS no `address-ml-screens.js` que impedia `AddressMlScreens` de ser criado (quebrando `showInitial()` e a navegação/abas no checkout); termos do Review agora usam HTML montado fora da string principal, evitando SyntaxError.

#### Protocol: 3a68af9

## [v3.2.67] - 2026-01-16

### Changed
- Ajustes finais de UI/UX (desktop footer do pagamento contido no layout; prazo do Motoboy exibido a partir do label; divisória inferior após quantidade; ícone de frete -20% e alinhamento); link de política de privacidade configurável no admin; cores configuráveis do header do modal (fundo/título/ícone); splash screen opcional configurável (sem CLS, corte seco).

#### Protocol: 03b3ed4

## [v3.2.66] - 2026-01-16

### Changed
- Adiciona shortcode oficial `[checkout_ml]` para tornar o checkout ML a interface principal sem depender do widget do Elementor, mantendo o checkout Woo real offscreen para compatibilidade com gateways/eventos; ajusta JS/CSS para montar o ML inline no root quando presente.

#### Protocol: adfb3a0

## [v3.2.65] - 2026-01-15

### Changed
- Review: remove thumbs do bloco de entrega e exibe ícone dinâmico por modalidade (Correios/Motoboy) + prazo; corrige quantidade do bloco de entrega para usar total real do carrinho; link “Modificar dados de faturamento” passa a abrir a listagem; seta voltar da primeira tela retorna ao carrinho.

#### Protocol: 0c6d354

## [v1.0.0] - 2026-01-09

### Stable Release
- Primeira versão estável do plugin **Checkout Tabs WP ML**.
- Baseada em `v3.2.37` (branch `develop`).
- Inclui as funcionalidades desenvolvidas até então: modal ML fullscreen no checkout, integração com webhook de frete, popup de login/cadastro, geolocalização, painel admin com abas (Integrações/Debug/Styles), reCAPTCHA v2, persistência de endereços/WhatsApp/CPF, telas de frete e pagamento estilo Mercado Livre, e sistema de checkpoints de debug.

## [v3.2.64] - 2026-01-13

### Changed
- Review: resumo passa a consumir dados do carrinho (quantidade real, subtotal/total e itens); exibição de lista de produtos com fotos/quantidade/preço no Review; correção do frete quebrado após remover cupom com leitura monetária do Woo; limpa estado do modal após checkout concluído para evitar retorno indevido à tela de review.

#### Protocol: 4a6f461

## [v3.2.63] - 2026-01-15

### Changed
- Cupom v4.7: centraliza estado de totais/cupom (`__ctwpmlTotalsState`) e aplica render único imediato (Payment + Review topo + sticky) no mesmo ciclo de `apply_coupon`/`remove_coupon`, eliminando dependência de reload/navegação para exibir valor original riscado e total em verde; resync explícito do frete no Review após aplicar/remover.

#### Protocol: 0b19e2a

## [v3.2.62] - 2026-01-15

### Changed
- Cupom: corrige valores monetários exibidos com entidades HTML (ex.: `&#82;&#36;&nbsp;88,00`) decodificando `wc_price` no backend; corrige ordem estrutural do bloco “Cupom aplicado” para ícone → nome → remover (Payment+Review), sem depender de CSS para ordenação.

#### Protocol: 5959bde

## [v3.2.61] - 2026-01-15

### Changed
- Cupom v4.5: ordem do cupom ajustada para ícone → remover → nome (Payment+Review); alinhamento do botão remover com `top:-7px`; drawer não fecha por timeout — agora fecha apenas quando o cupom aparece no DOM do Woo ou quando o total bate; debug reforçado com snapshots (CHK_COUPON_APPLY_WAIT_SNAPSHOT, CHK_COUPON_APPLY_WOO_COUPON_FOUND, CHK_COUPON_APPLY_WAIT_TIMEOUT_KEEP_OPEN); sticky total do Review corrigido para aplicar cor/estilos com wrapper.

#### Protocol: 9210c08

## [v3.2.60] - 2026-01-15

### Changed
- Cupom v4.4: backend AJAX passa a retornar valores formatados como texto puro (evita HTML aparecer na UI); desconto (valor riscado + valor final em verde) passa a persistir após reload derivando total original a partir dos cupons do Woo; drawer de cupom só fecha após `updated_checkout`/totais estabilizarem; Review topo e sticky total passam a refletir desconto; ajuste de alinhamento do botão remover cupom.

#### Protocol: 58be68d

## [v3.2.58] - 2026-01-13

### Changed
- Layout cupom v4.3: botão remover movido para esquerda (antes do nome); ícone coupom-icon.svg adicionado; emoji 🎫 substituído por SVG no drawer; linha "Você pagará" sempre em 1 linha (flex-row, nunca coluna) com valor original ~30% menor e riscado ao lado do atual; mesma lógica aplicada na tela Review; drawer só fecha após 800ms (evita quebra visual durante recálculo do Woo); CSS limpo de discount-tag não utilizada.

#### Protocol: 13ea35f

## [v3.2.57] - 2026-01-13

### Changed
- Hardening v4.2 do cupom: funções de UI (showCouponSuccessIcon, resetCouponUi, toggleCouponDrawer) extraídas para escopo do módulo, corrigindo ReferenceError; state machine de cupom (couponBusy) para evitar conflitos entre AJAX do modal e eventos do WooCommerce; guard no listener updated_checkout/applied_coupon/removed_coupon que ignora eventos quando cupom está busy; checkpoints de debug reforçados (CHK_COUPON_BUSY_STATE, CHK_COUPON_UI_RESET, CHK_COUPON_SUCCESS_ICON_SHOWN, CHK_WOO_EVENT_SKIPPED_COUPON_BUSY, CHK_WOO_EVENT_PROCESSED, CHK_COUPON_APPLY_UPDATE_UI_START, CHK_COUPON_APPLY_SHOW_SUCCESS_START/DONE, CHK_COUPON_APPLY_TRIGGER_WOO_EVENTS).

#### Protocol: 4f3efe0

## [v3.2.56] - 2026-01-13

### Changed
- Cupom aplicar/remover via AJAX controlado (sem reload da página); novos endpoints `ctwpml_apply_coupon` e `ctwpml_remove_coupon` usando APIs nativas do WooCommerce; ícones de frete (correio/motoboy) em wrapper próprio com espaçamento de 5px; ícone pin-drop.svg no form de endereço substituindo emoji; layout do botão remover cupom compactado (20x20px, alinhamento melhorado); documento de planejamento para integração futura com Elementor widget.

#### Protocol: 5d4d16c

## [v3.2.55] - 2026-01-13

### Changed
- Migração completa de ícones PNG para SVG (melhor performance e escalabilidade); novos ícones SVG locais para Pix, Cartão, Boleto (bar-code), Correios, Motoboy, Casa, Trabalho, confirm-cupom e remover-cupom; ícones de tipo de endereço (casa/trabalho) substituindo emojis; ícones de frete (correio.svg/motoboy.svg) exibidos nas opções de frete baseado no label (Sedex/PAC/Mini → Correios, Motoboy/Expresso → Motoboy); UI de cupom com animação de sucesso e botão de remover com ícone SVG; remoção dos PNGs antigos.

#### Protocol: c593f4b

## [v3.2.54] - 2026-01-13

### Changed
- Cupom: exibe cupons aplicados (lista, um por linha) com valor negativo em verde e botão “x remover cupom” na tela “Escolha como pagar” (abaixo do subtotal) e na tela “Revise e confirme” (abaixo do frete); leitura dos cupons é feita do DOM do Woo (`tr.cart-discount` + `woocommerce-remove-coupon`) e remoção dispara o link nativo do Woo; debug reforçado com checkpoints de render/remoção e captura de cupons antes/depois ao aplicar.

#### Protocol: a30797f

## [v3.2.53] - 2026-01-13

### Changed
- Cupom: corrigido fluxo de aplicação para não disparar submit do checkout (evita `wc-ajax=checkout` ao aplicar cupom); botão “Adicionar cupom” passa a ser `type="button"` e aplicação usa clique no `apply_coupon` do form oficial do Woo, com checkpoints de diagnóstico quando o alvo não é encontrado.

#### Protocol: f287b56

## [v3.2.52] - 2026-01-13

### Changed
- WhatsApp: auto-scroll reposicionado para ~20% do topo (80% de espaço abaixo) e dropdown do DDI volta a abrir para baixo; salvar endereço: spinner persiste até confirmação + retorno para lista (evita janela de interação); endereços: complemento passa a aparecer também na lista e no “Detalhe da entrega” (review); pagamento: UI de cupom/desconto com preço original riscado + valor final e feedback visual (sucesso/erro).

#### Protocol: f2e5560

## [v3.2.51] - 2026-01-13

### Changed
- Telefone internacional: impede DDI aparecer no input (DDI fica só no seletor) e melhora restauração no editar endereço; dropdown do DDI abre para cima e auto-scroll dispara também ao tocar no DDI; formulário: espaçamento do footer e link “Excluir endereço” fica visível acima dos botões (safe-area iOS); salvar endereço: remove toast duplicado e volta imediatamente para lista; frete/telas: inclui complemento no resumo do endereço e evita quebra de linha nos preços.

#### Protocol: 2c222bc

## [v3.2.48] - 2026-01-13

### Changed
- Correção do link clicável do reCAPTCHA (setMsg agora aceita HTML quando necessário); melhoria no fluxo de frete para aguardar aplicação automática ao invés de exibir "tente novamente" (UX significativamente melhorada); correção no cálculo de métricas da telemetria (successRate agora usa apenas operações concluídas no denominador, durations agora são registradas corretamente).

#### Protocol: 7659edf

## [v3.2.47] - 2026-01-12

### Changed
- Melhorias no popup de inicialização (login/signup) e geolocalização: reCAPTCHA na aba de signup com mensagem de erro melhorada e link para voltar à aba de login; animação de carregamento com pontos ("•••") ao aceitar localização; reforço de debug de geolocalização para Desktop com logs detalhados e script de diagnóstico; persistência de sessão após login/signup com redirecionamento forçado; ocultação de variáveis/códigos HTML quebrados enquanto localização não é aceita usando classes CSS e marcação de elementos como resolvidos. Sistema de telemetria implementado para rastrear eficiência de cada funcionalidade (tempo de execução, taxa de sucesso, eventos) com painel visual e exportação de relatórios JSON.

#### Protocol: 4c21dcd

## [v3.2.44] - 2026-01-09

### Changed
- Checkout (ML): correção para executar a animação apenas no CTA que foi clicado (topo ou sticky), mantendo sequência loading 6s → sucesso → expand e exibindo o overlay fullscreen somente após `expand_done`; mantém debugs/checkpoints para validar a ordem e latência do `wc-ajax=checkout`.

#### Protocol: f6e5463

## [v3.2.38] - 2026-01-09

### Changed
- Checkout (ML): animação visual no CTA “Confirmar a compra” no Review (botão normal + sticky) com estados `loading/success/expand`, ícone local (`check.svg`) e reset automático em `checkout_error`; mudança apenas de UI (não altera o submit nem o fluxo de frete).

#### Protocol: 4576789

## [v3.1.20] - 2026-01-05

### Added
- Estrutura completa de plugin WordPress (arquivo principal + `inc/` + `assets/`).
- Tela de configurações em **WooCommerce > Checkout Tabs ML**:
  - URL do webhook
  - toggle de debug (logs no console + painel no front).
- Integração com Git Updater: link **"Atualizar Cache"** na tela de Plugins (AJAX).
- Workflow do GitHub Actions (`.github/workflows/release.yml`) copiado do plugin de referência para auto tag/release na branch `develop`.

### Changed
- Migração do snippet inline para plugin:
  - CSS extraído para `assets/css/`.
  - JS extraído e dividido em módulos pequenos em `assets/js/`.
  - PHP separado por responsabilidade em `inc/` (settings/enqueue/ajax/filtro).
- Correção de compatibilidade: abas e botões **Avançar/Voltar** agora são inseridos com fallback de "anchor" para suportar templates de checkout com markup diferente (ex.: Elementor).
- Robustez: adicionada tentativa de inicialização (retry curto) quando o checkout é renderizado tardiamente.
- Correção: handlers de navegação/CEP migrados para eventos delegados (funciona mesmo se os botões forem criados após o load ou após fragments do WooCommerce).
- Debug: logs adicionais (quando Debug está ativo) indicando qual anchor foi escolhido e diagnóstico quando nenhum anchor é encontrado.

### Security
- Para automação/publicação via scripts locais (PowerShell), a variável de ambiente esperada é **`GITHUB_TOKEN`** (não inserir token em arquivos, commits ou changelog).

## [v3.1.21] - 2026-01-05

### Changed
- Admin: adicionado menu principal **Checkout Tabs ML** com abas **Integrações** (Webhook URL) e **Debug** (toggle) para facilitar habilitar logs e gerenciar integrações.
- Admin: "Atualizar Cache" (Git Updater) ajustado para ficar igual ao `packing-panel-woo-dev` (link em `plugin_row_meta` com ícone/spinner + notices no WP admin).

## [v3.1.22] - 2026-01-05

### Changed
- Admin: abas do painel (Integrações/Debug) agora alternam sem reload da página (UX via JS, mantendo URL com `?tab=`).
- Front: hardening de CSS dos botões **Avançar/Voltar** para impedir que temas/Elementor deixem invisível sem hover (corrige mobile).

## [v3.1.23] - 2026-01-05

### Changed
- Git Updater: mitigação para rate limit — o botão "Atualizar Cache" não dispara `wp_cron()` automaticamente (reduz checagens imediatas pós-limpeza de cache). Pode ser reativado via filtro `checkout_tabs_wp_ml_gu_refresh_cache_run_cron`.
- Docs: adicionado arquivo `REFERENCIA-ESTADO-ATUAL-E-ROLLBACK-GIT-UPDATER.md` para registrar o estado que funcionou, evidências e próximos passos de depuração do CEP.
- Debug (front): correção para o painel "Ver Logs" aparecer corretamente quando o toggle de Debug estiver ativo (normalização do `cc_params.debug` e detecção robusta no JS).

## [v3.1.24] - 2026-01-05

### Changed
- Preparação para destravar o fluxo do CEP (não avança após consulta) com instrumentação/diagnóstico adicional; manter compatibilidade e UX atuais (painel admin, abas sem reload e botões Avançar/Voltar visíveis em mobile/desktop).

## [v3.1.25] - 2026-01-05

### Changed
- Correção do avanço do CEP (não depende mais de `updated_checkout` para trocar de aba após salvar frete) e adição do modal "Meus endereços" estilo Mercado Livre (telas 1–2) sobre o checkout para usuários logados, preenchendo `billing_*` e reutilizando o fluxo atual do webhook/checkout. Também melhora o botão "Atualizar Cache" para disparar checagem de atualizações na tela de Plugins após limpar cache.

## [v3.1.26] - 2026-01-05

### Changed
- Debug visual no front agora é resiliente (UI inline com z-index alto + captura de erros JS). Fluxo ML inicia ao entrar no /checkout: se deslogado abre popup Fancybox de login (HTML injetado apenas no checkout), se logado abre modal "Meus endereços". CEP: logs melhorados quando `store_webhook_shipping` retorna `success=false` (mostra mensagem real e registra no debug).

## [v3.1.27] - 2026-01-05

### Changed
- Ajustes nas telas ML: correção de contraste (textos escuros como no layout original), adição do link "Editar endereço" na tela 1, e auto-preenchimento do formulário ao digitar CEP (consulta webhook e aplica campos no modal + `billing_*`).
- Debug visual: adicionada opção de override para exibir painel via `?ctwpml_debug=1` ou `localStorage.ctwpml_debug=1`, mesmo quando `cc_params` não for injetado (ajuda a diagnosticar conflitos de scripts/cache).

## [v3.1.28] - 2026-01-05

### Changed
- Próximo release para consolidar o novo fluxo ML no checkout (login obrigatório + endereços), e continuar a depuração do CEP com base nos logs do painel (sem regressão do painel admin, debug visual e “Atualizar Cache”).

#### Protocol: e7bf9b7

## [v3.1.29] - 2026-01-05

### Changed
- Modal ML: contraste e estados de seleção (rádio cinza/azul + borda azul só no selecionado), ao alterar CEP limpa campos do endereço, máscara de celular `XX - X XXXX-XXXX`, e persistência do payload completo do webhook em `user_meta` (`ctwpml_address_payload`) com logs no painel de debug.

#### Protocol: 197cae6

## [v3.1.30] - 2026-01-05

### Changed
- Modal ML: lista sem “Endereço do checkout”, card mostra endereço completo + nome de quem recebe, formulário com seleção Casa/Trabalho e seção “Dados de contato”, botão “Excluir endereço”, e deduplicação/idempotência (bloqueio de multi-clique + dedup no back-end).

#### Protocol: 2df16d5

## [v3.1.31] - 2026-01-05

### Changed
- Modal ML: consulta de CEP também no `blur` (OK/Next no mobile), prevenção de reconsulta repetida por CEP, validação com campos em vermelho + aviso quando Rua/Avenida não vier da API, e `border-radius: 3px` nos inputs.
- Popup (deslogado): nova aba “Criar conta” (nome/e-mail/CPF) com opção configurável “Gerar CPF fictício” (CPF matematicamente válido + aviso de definitividade) e cadastro via AJAX.
- CPF: agora é definitivo no perfil (`billing_cpf`) com bloqueio de alteração (front + server-side), exceto administradores.

#### Protocol: 9dc7a72

## [v3.1.32] - 2026-01-05

### Changed
- Admin (Plugins): botão “Atualizar Cache” agora faz reload automático após limpar cache, preservando o scroll, para refletir atualizações sem F5 manual.
- Popup (deslogado): normalização do e-mail no cadastro (evita “e-mail inválido” indevido) + melhora na mensagem de erro do AJAX.
- Modal ML: adiciona banner “logado como {email}” na tela de endereço, inclui campo CPF após WhatsApp (com máscara e opção “Gerar CPF fictício” quando habilitado), e aplica `border-radius: 3px` também nos inputs do modal/popup.

#### Protocol: b5474b2

## [v3.1.33] - 2026-01-05

### Changed
- Popup (Fancybox): bloqueia fechar ao clicar fora (fecha via X; ESC mantém).
- Tabs “Login” / “Criar uma conta”: sem moldura, contraste melhor e cores configuráveis no admin (CSS vars).
- CPF fictício (modal): melhora sincronização com `billing_cpf` (fallback selector) e adiciona logs no console/logger para diagnosticar quando o debug visual não aparece.

#### Protocol: 022aa1a

## [v3.1.34] - 2026-01-05

### Changed
- Popup: cores agora não vazam para o site (CSS vars escopadas em `.ctwpml-login-popup`), e HTML foi reestruturado com headings para facilitar estilização via Elementor (H3 título preto, H5 azul, H6). Mantém cores configuráveis no admin sem impactar outras áreas.

#### Protocol: 9fc3da8

## [v3.2.0] - 2026-01-05

### Changed
- Cria aba "Styles" no admin com editor completo de estilos por hierarquia (H1/H2/H3: cor, fundo, fonte, peso, tamanho, padding, margin, alinhamento - 24 campos total).
- Reverte headings do popup para classes CSS neutras (`.ctwpml-popup-h1/h2/h3`).
- Garante prioridade CSS com `!important` e alta especificidade para sobrescrever cores globais do site (Primary, Secondary, Text, Accent).
- Integra logs frontend em tempo real na aba Debug com textarea, auto-refresh a cada 5s, botões copiar/limpar, e filtragem automática (apenas eventos do checkout com prefixo `[CTWPML]`).
- Logs são armazenados em transient (expira em 1h, limite de 200 entradas FIFO).

#### Protocol: 9dd199c

## [v3.2.1] - 2026-01-06

### Changed
- Adiciona opção "Transparente" (checkbox) para cores de texto/fundo na aba Styles.
- Implementa persistência de WhatsApp, CPF e Label (Casa/Trabalho) no modal de endereço via `user_meta` (endpoints AJAX `ctwpml_get_contact_meta` e `ctwpml_save_contact_meta`), com CPF imutável após primeira criação (apenas admin pode editar).
- Remove campo CPF do popup de cadastro e substitui por reCAPTCHA v2 (checkbox "Não sou um robô"), com validação backend via Google siteverify.
- Suporta reutilização automática de chaves do plugin "Login No Captcha reCAPTCHA" ou configuração própria na aba Integrações.

#### Protocol: 7c0e1d1

## [v3.2.2] - 2026-01-06

### Changed
- Aumenta especificidade CSS do popup (duplica classes + !important) para sobrescrever cores globais do Elementor.
- Implementa reCAPTCHA v2 com callbacks (submitEnable/Disable) e desabilita botão até validação.
- Adiciona spinner azul + blur backdrop durante salvamento de endereço/contato.
- Corrige erro JS `'.' is not a valid selector` e função inexistente `logMessage` (substitui por `state.log`).
- Implementa bloqueio real de geração múltipla de CPF (verifica antes de gerar, salva imediatamente, esconde botão após travamento).

#### Protocol: a088a7d

## [v3.2.3] - 2026-01-06

### Changed
- Implementa 11 correções críticas e melhorias de UX conforme PLANO_DE_ACAO_CORRECOES.txt (safeSelector, logs detalhados, toasts, cache 60s, spinner/blur, reCAPTCHA no login, “Perdeu a senha?”, correções de layout para Elementor, debounce/update_checkout).

#### Protocol: 24f278b

## [v3.2.4] - 2026-01-06

### Changed
- Implementação completa baseada no `GUIA_COMPLETO_CORRECOES.txt` (safeSelector/safeClass/safeId, validações + logs no store_webhook_shipping, novo Toast centro-topo, persistência correta do WhatsApp, renderização explícita do reCAPTCHA v2 no Fancybox, debounce/intervalo mínimo do update_checkout).

#### Protocol: d03c235

## [v3.2.5] - 2026-01-06

### Changed
- reCAPTCHA v2 no popup com render explícito (Fancybox `afterShow`) igual ao plugin de referência.
- Login via AJAX (`ctwpml_login`) com validação server-side do reCAPTCHA.
- Correção do “clique morto” ao salvar/operar no modal (spinner não bloqueia o body inteiro) e logs completos no Debug.
- Ajustes de persistência do WhatsApp (envio apenas dígitos + salvamento consistente em user_meta/Woo).

#### Protocol: b84861e

## [v3.2.6] - 2026-01-06

### Changed
- Implementação definitiva do reCAPTCHA v2 (render explícito no afterShow com Site Key fixa).
- Correção do clique no botão Salvar (ajuste no spinner e pointer-events).
- Rastreamento de logs críticos no Debug.
- Correção da persistência do WhatsApp.

#### Protocol: 0872e3a

## [v3.2.7] - 2026-01-06

### Changed
- Correção da edição de endereços existentes (endereços antigos agora podem ser editados).
- Sincronização automática dos campos `billing_*` do WooCommerce ao abrir endereço para edição.
- Valor padrão 'Casa' para label de endereços antigos.
- Carregamento automático de WhatsApp/CPF do perfil (`user_meta`) quando campos estiverem vazios.

#### Protocol: c44aa3b

## [v3.2.8] - 2026-01-06

### Changed
- Correção do reCAPTCHA na aba "Criar uma conta" do popup de login (renderização adiada para quando a aba ficar visível, pois `grecaptcha.render` não funciona em elementos com `display:none`).

#### Protocol: d674c75

## [v3.2.9] - 2026-01-06

### Changed
- Integração de geolocalização ao plugin (proxy REST `/wp-json/geolocation/v1/send` com webhook configurável no admin; modal de permissão antes do prompt nativo no 1º acesso; cache por sessão para evitar chamadas repetidas), mantendo o contrato `window.freteData` + `localStorage('freteData')` + evento `freteDataReady`.

#### Protocol: 572d707

## [v3.2.10] - 2026-01-06

### Changed
- Correção definitiva do reCAPTCHA na aba "Criar uma conta" (renderização robusta com retry e logging detalhado).
- Substituição do caractere de seta ← por imagem PNG customizada (`assets/img/arrow-back.png`).

#### Protocol: 11e46a6

## [v3.2.11] - 2026-01-07

### Changed
- Novo fluxo no modal: tela inicial com endereço selecionado + tela “Escolha quando sua compra chegará” (placeholder).
- Persistência do endereço selecionado no perfil.
- Instrumentação de debug detalhada para diagnóstico de renderização/carregamento.

#### Protocol: 43a4f71

## [v3.2.12] - 2026-01-07

### Changed
- Correções rápidas no fluxo ML: botão "Continuar" azul e fullwidth na tela de prazo; navegação do back corrigida (list→initial, form→list); fluxo ML convertido de modal para fullscreen inline no checkout.

#### Protocol: 8922ebe

## [v3.2.13] - 2026-01-07

### Changed
- Novos eventos de webhook separados (`consultaCep` rápido para preencher endereço, `consultaEnderecoFrete` completo ao salvar).
- Validação de `whatsappValido` ao salvar (bloqueia se inválido e exibe erro).
- Correção de `validateForm()` para funcionar sem campos `billing_*` no DOM (fallback para cache da consulta CEP).
- Cursor move para campo número após preencher rua via API.
- Teclado numérico no campo WhatsApp.
- CPF do perfil carregado automaticamente ao adicionar novo endereço.
- Remoção de contornos/outlines de todos os botões e seta voltar.

#### Protocol: a03ac22

## [v3.2.14] - 2026-01-07

### Changed
- Tela "Escolha quando sua compra chegará" agora carrega opções de frete dinamicamente do payload salvo em user_meta (ctwpml_address_payload).
- Novos endpoints AJAX ctwpml_get_shipping_options e ctwpml_set_shipping_method com logs de DEBUG.
- Correção: payload do webhook pode vir como array (`[{...}]`) e agora é normalizado (usa o primeiro item).
- Persistência de payload de frete por endereço (associado ao `address_id`) via user_meta `ctwpml_address_payload_by_address` (com fallback/migração do payload antigo).
- Fluxo de salvamento: payload do webhook é persistido somente após obter `address_id` no `ctwpml_save_address`.
- UX: overlay full-screen “Preparando tudo para sua compra” (Produto/Carrinho → Checkout) roda uma vez por entrada no checkout, prepara o primeiro endereço automaticamente e re-roda ao trocar endereço.
- Função renderShippingOptions em address-ml-screens.js para renderização dinâmica.
- Integração com WC session para seleção de frete reconhecida pelo WooCommerce.
- Evento ctwpml_shipping_selected disparado ao confirmar seleção.
- Campo Complemento limitado a 13 caracteres (maxlength no input + truncamento no backend).

#### Protocol: 189d08d

## [v3.2.15] - 2026-01-07

### Changed
- Correção: payload do webhook pode vir como array (`[{...}]`) e agora é normalizado (usa o primeiro item).
- Persistência de payload de frete por endereço (associado ao `address_id`) via user_meta `ctwpml_address_payload_by_address` (com fallback/migração do payload antigo).
- Fluxo de salvamento: payload do webhook é persistido somente após obter `address_id` no `ctwpml_save_address`.
- UX: overlay full-screen “Preparando tudo para sua compra” (Produto/Carrinho → Checkout) roda uma vez por entrada no checkout, prepara o primeiro endereço automaticamente e re-roda ao trocar endereço.

#### Protocol: ce83d46

## [v3.2.18] - 2026-01-07

### Added
- Nova tela "Escolha como pagar" (payment screen) com métodos de pagamento:
  - Seção "Recomendados": Pix (aprovação imediata) e Boleto (1-2 dias úteis)
  - Seção "Cartões": Novo cartão de crédito (título em azul)
  - Footer fixo (sticky) com link para cupom e totalizador
- Função `renderPaymentScreen()` em `address-ml-screens.js` para renderização da tela.
- Função `showPaymentScreen()` no modal para exibir a tela de pagamento.
- Handlers para cliques nas opções de pagamento (por enquanto apenas notificações, lógica será implementada depois).
- CSS completo para a tela de pagamento (header laranja, grupos de opções, footer sticky).
- Drawer de cupom na tela "Escolha como pagar":
  - Overlay escuro semi-transparente
  - Modal drawer que sobe de baixo da tela com animação suave
  - Handle visual para arrastar
  - Header com botão de fechar (✕) e título "Cupons"
  - Campo de input para código do cupom com ícone de ticket (🎫)
  - Botão "Adicionar cupom" que habilita apenas quando há texto no input
  - Bloqueio de scroll do fundo quando drawer está aberto
- Botão de voltar (←) no header laranja da tela de pagamento

### Changed
- Campos de frete corrigidos: labels usam `*_ch` (motoboy_ch, sedex_ch, pacmini_ch) e preços usam `preco_*` (preco_motoboy, preco_sedex, preco_pac). Modalidade ocultada se label estiver vazio.
- Botão "Continuar" na lista "Meus endereços" agora vai direto para a tela "Escolha quando sua compra chegará" (não fecha o modal).
- Overlay "Preparando tudo para sua compra" aparece apenas se o usuário estiver logado; se deslogado, o popup de login é exibido pelo modal.
- Ao trocar de endereço na lista, o plugin SEMPRE chama o webhook para atualizar os dados de frete (como se estivesse salvando o endereço).
- Botão "Continuar" da tela de frete agora leva para a tela "Escolha como pagar" (não fecha o modal).
- Navegação de voltar: payment → shipping → initial → fecha modal.
- Header da tela de pagamento agora inclui botão de voltar funcional
- Link "Inserir código do cupom" agora abre o drawer ao invés de notificação
- CSS reorganizado com estilos completos do drawer (overlay, animações, input, botão)
- Estrutura HTML da tela de pagamento atualizada conforme v2 do manual

#### Protocol: e940075
## [v3.2.20] - 2026-01-07

### Changed
- Tela "Escolha quando sua compra chegará": resumo de frete dinâmico no rodapé (mostra "Grátis" ou valor monetário e atualiza ao trocar opção) e imagem real do 1º produto no bloco "Envio 1" (com fallback).
- Adicionado `data-price-text` para suportar atualização do resumo de frete.
- Tela "Escolha como pagar": correção de arquitetura (sem header interno duplicado), navegação de voltar via `#ctwpml-modal-back`, remoção de notificações/ações de lógica em cliques (mantém UI/eventos) e CSS ajustado.

#### Protocol: 63b625a

## [v3.2.21] - 2026-01-07

### Fixed
- Correção de bug de "empilhamento" de telas: ao clicar em "Voltar" da tela de pagamento, a view anterior era exibida **sem esconder** a tela de pagamento, causando sobreposição visual.
- Todas as funções de transição de tela (`showInitial`, `showList`, `showForm`, `showFormForNewAddress`, `showFormForEditAddress`, `showShippingPlaceholder`) agora escondem `#ctwpml-view-payment` antes de exibir a view alvo.

#### Protocol: 163f06f
## [v3.2.22] - 2026-01-08

### Changed
- Tela "Escolha quando sua compra chegará" agora exibe até 3 miniaturas do carrinho via endpoint AJAX (WooCommerce), removendo dependência do DOM do tema; UI/CSS atualizados para exibir stack de miniaturas no layout atual.

#### Protocol: 163f06f

## [v3.2.23] - 2026-01-08

### Changed
- Checkout modal: integração com lógica padrão do WooCommerce via blocos AJAX (payment/review/coupon) com nonce; seleção de gateways por compatibilidade (Pix/Boleto/Cartão) e ocultação automática de meios indisponíveis; cupom aplicado via form padrão do Woo e sincronização após `updated_checkout`; footer da tela “Escolha como pagar” agora exibe Subtotal dinâmico (fonte `tr.cart-subtotal`) + total; adicionada nova etapa “Revise e confirme” no modal (sem injetar página inteira) com botão “Confirmar a compra” disparando `#place_order`; removida redundância do título “Escolha como pagar” (mantém apenas no header do modal).

#### Protocol: c3ef808

## [v3.2.24] - 2026-01-08

### Changed
- Modo ML definitivo no checkout do Elementor: desativa lógica antiga de abas/CEP para não conflitar com o modal; modal ML agora é full-screen (injetado no body, z-index máximo e scroll lock); widget do checkout fica invisível/offscreen sem quebrar gateways/cálculo do Woo; layout desktop da tela “Escolha como pagar” em duas colunas (conteúdo à esquerda e resumo à direita).

#### Protocol: a895bcf

## [v3.2.25] - 2026-01-08

### Changed
- Remoção do enqueue condicional de scripts legados (tabs.js, store.js, webhook.js) quando ML-only; ui.js e woocommerce-events.js agora são no-op para rotinas de abas no ML-only; overlay global do checkout suprimido via CSS no ML-only; scroll interno do modal corrigido para iOS; sistema de checkpoints de debug implementado (state.checkpoint) com validação SUCCESS/FAIL para: CHK_HOST_WOO, CHK_OVERLAY_SUPPRESS, CHK_ML_ONLY, CHK_MODAL_VISIBLE, CHK_SCROLL_ENABLED, CHK_ELEMENTOR_HIDDEN, CHK_GATEWAYS, CHK_BLOCKS, CHK_PAYMENT_RENDERED, CHK_REVIEW_RENDERED, CHK_SHIPPING_OPTIONS.

## [v3.2.27] - 2026-01-08

### Changed
- Modal ML (Elementor): fidelidade visual e UX (remove “duplo background” em pagamento/review; CTAs em largura total e cor padrão; títulos de pagamento garantidos via CSS); Review/Confirm com rodapé sticky (slide) e CTA funcionando com submit nativo do Woo + reabilita em `checkout_error`; frete persistente (não reseta para a 1ª opção) e exibição do método/valor no Review; cupom com fallback para UI do Elementor quando `form.checkout_coupon` não existir; **estado do modal persistente após reload via `sessionStorage` (restaura view/endereço/frete/pagamento)** e checkpoint **CHK_VIEW_RESTORE**; **Review: ícones via `<img>` (modelo oficial) + card “Detalhe da entrega” com endereço selecionado no subtítulo**; debug/checkpoints adicionais: CHK_COUPON_BLOCK_FETCHED, CHK_COUPON_FORM_FOUND, CHK_PAYMENT_TITLES_VISIBLE, CHK_PLACE_ORDER_NATIVE, CHK_FORM_SUBMIT_NATIVE, CHK_CHECKOUT_ERROR, CHK_SHIPPING_PERSISTENCE, CHK_OVERLAY_SOURCES.

#### Protocol: d74719a

## [v3.2.28] - 2026-01-09

### Changed
- Review (“Revise e confirme”): adiciona checkbox de termos (topo e rodapé sticky) e bloqueia/libera os CTAs “Confirmar a compra” com feedback; sincroniza com checkboxes nativos do Woo (`#terms` e `#cs_terms_policy_accepted`) e re-sincroniza após `updated_checkout` para evitar divergência; assets do modal: adiciona `assets/img/icones/` (gps/cartão/excluir/editar/recibo) para uso local.

#### Protocol: c1b1347

## [v3.2.29] - 2026-01-09

### Changed
- Checkout modal (ML): endereço selecionado passa a sincronizar com campos reais do Woo (`billing_*`) em todos os fluxos (clique no card, avançar pelo “initial”, restore), com proteção contra limpeza automática ao setar CEP via código; debug robusto (checkpoints/snapshots) para billing sync e para origem/persistência do valor de frete no Review; Review: melhora contraste do texto de termos (`#666666 !important`) e ajusta espaçamento (4px) do checkbox no rodapé sticky.

#### Protocol: ecad936

## [v3.2.30] - 2026-01-09

### Changed
- Frete (ML): reforço definitivo de diagnóstico para evitar fallback silencioso (ex.: cair em `flat_rate:1`): `setShippingMethodInWC` registra snapshots do DOM do Woo antes/depois do `updated_checkout` e checkpoints CHK_SHIPPING_SET_REQUEST/CHK_SHIPPING_SET_RESPONSE/CHK_SHIPPING_SET_APPLIED (requested vs applied); backend `ctwpml_set_shipping_method` valida se o `method_id` existe nos rates disponíveis e, se não existir, retorna erro com `available_rate_ids` (e snapshot detalhado em debug).

#### Protocol: a6abb89

## [v3.2.31] - 2026-01-09

### Changed
- Frete (ML): correção para evitar finalizar com frete errado por fallback — backend `ctwpml_set_shipping_method` força cálculo de shipping/totals e lê rates também via sessão (`shipping_for_package_*`) para evitar falso-negativo de “rate não existe”; validação só bloqueia quando há lista confiável (`validation_skipped=false`) e retorna flags `requested_exists`/`validation_skipped`; frontend bloqueia o botão Continuar quando o Woo não aplicou o método selecionado (requested≠checked), com checkpoints CHK_SHIPPING_CONTINUE_BLOCKED/CHK_SHIPPING_CONTINUE_ALLOWED e snapshot do último set em `state.__ctwpmlLastShippingSet`.

#### Protocol: bec1672

## [v3.2.32] - 2026-01-09

### Changed
- Frete (ML): correção para impedir o Woo de reverter para PAC (`flat_rate:1`) após `update_checkout` — backend `ctwpml_set_shipping_method` sincroniza `WC()->session->webhook_shipping` a partir do payload do endereço (`address_id`) antes do recálculo, garantindo que o filtro `woocommerce_package_rates` não remova SEDEX/Motoboy; frontend envia `address_id` no set e registra checkpoint `CHK_WEBHOOK_SHIPPING_SESSION_SYNC` para confirmar o sync.

#### Protocol: 7abb823

## [v3.2.33] - 2026-01-09

### Changed
- Frete (ML): sincroniza o radio real do Woo (`input[name^="shipping_method"]`) antes do `update_checkout` (checkpoint CHK_SHIPPING_RADIO_SYNC), evitando que o Woo reverta para o método previamente marcado (ex.: PAC `flat_rate:1`) mesmo após `chosen_shipping_methods` ter sido setado via AJAX.

#### Protocol: 911ace3

## [v3.2.34] - 2026-01-09

### Changed
- Frete (ML): corrigir `cart_shipping_total` zerado em `admin-ajax` — `ctwpml_set_shipping_method` força inicialização de sessão/carrinho (wc_load_cart + initialize_session/cart), persiste o carrinho via `WC()->cart->set_session()` após `calculate_totals()`, e reforça debug retornando `wc_boot`, `chosen_shipping_methods`, `webhook_shipping_session`, `cart_set_session_called` e flags `has_wc_session/has_wc_cart` para diagnóstico.

#### Protocol: 16e04d5

## [v3.2.35] - 2026-01-09

### Changed
- Frete (ML): correção definitiva para `webhook_shipping` não persistir em AJAX — `ctwpml_sync_webhook_shipping_session_from_address_payload` tenta inicializar sessão/carrinho do Woo (wc_load_cart + initialize_session/cart + cookie) antes de retornar `no_wc_session`; `ctwpml_set_shipping_method` adiciona retry do sync quando a sessão só fica disponível após o recálculo e executa um segundo `calculate_totals()` para aplicar o custo do override; debug reforçado com `did_retry_webhook_sync`, `webhook_sync_attempts` e `set_customer_cookie_called` no `wc_boot`.

#### Protocol: 2de42bf

## [v3.2.36] - 2026-01-09

### Changed
- Frete (ML): corrigir detecção do WooCommerce (bug crítico) — substitui checagens inválidas `class_exists('WC')` por `function_exists('WC') && WC()` em `ctwpml_sync_webhook_shipping_session_from_address_payload`, `woocommerce_package_rates` override, Checkout Blocks API e `store_webhook_shipping`, permitindo que `webhook_shipping` seja setado e o custo do frete seja aplicado (não ficar `cart_shipping_total=0`).

#### Protocol: 90b6792

## [v3.2.37] - 2026-01-09

### Changed
- Frete (ML): corrigir `cart_shipping_total=0` mesmo com `webhook_shipping` sincronizado — limpa cache de shipping do Woo (`shipping_for_package_*` + `WC()->shipping->reset_shipping()`) sempre que `webhook_shipping` é setado e antes de recalcular totals, forçando recálculo das rates com os valores do webhook; reforça debug com checkpoint `CHK_CART_SHIPPING_TOTAL_NONZERO`.

#### Protocol: 30aafef
