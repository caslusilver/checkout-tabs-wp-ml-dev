# Recuperação — versão 3.4.22

## Instalar a página

1. Atualize o plugin para a versão 3.4.22, após integrar o PR em `develop`.
2. Crie uma página WordPress chamada Recuperação. No Elementor, use um widget Shortcode, preferencialmente em uma página Canvas sem o menu da loja.
3. Insira somente `[checkout_ml_recuperacao]`.
4. Exclua essa página do cache de página, CDN e cache offline/PWA. O módulo envia cabeçalhos de não armazenamento e define `DONOTCACHEPAGE`, mas serviços externos precisam respeitar essa restrição. Não compartilhar uma cópia HTML autenticada.
5. Abra deslogado: a página incorpora automaticamente `[secure_passkeys_login_form]`, do Secure Passkeys já instalado, e oferece entrada por e-mail/senha. Não é necessário adicionar outro shortcode. O retorno nativo de acesso rápido é vinculado à própria página por cookie assinado, por 15 minutos.
6. Entre com administrador. Clientes autenticados não veem contatos nem a central. Todos os endpoints de gestão exigem `manage_options` e nonce, inclusive copiar/exportar. Não há promoção de usuário pelo shortcode.
7. Acesse **Configurar**, ative a coleta e salve. Também pode abrir **Checkout Tabs ML → Recuperação** no painel WordPress. A coleta começa desativada.

As tabelas são preparadas no primeiro acesso administrativo. Não há alteração de Supabase, gateway, pedidos existentes ou snippets externos. Os logs antigos não são importados: sua falta de correlação não pode ser corrigida retroativamente.

## Como operar

- **Em andamento:** tentativa em atividade. **Atenção:** erro registrado ou inatividade. **Em contato:** atendimento iniciado pelo operador. **Encerrados:** comprado, recuperado manualmente ou não recuperado. **Todos:** visão geral.
- O intervalo inicial de inatividade é **15 minutos**, uma hipótese operacional ajustável entre 1 e 120 minutos em Configurar. Não representa confirmação de abandono. Erros entram imediatamente como prioridade; depois vêm quantidade de execuções e recência.
- Lista em qualquer dispositivo; Kanban no desktop. Arrastar entre filas atualiza o atendimento. Ao arrastar para Encerrados, escolha Recuperado ou Não recuperado. No celular, use o seletor de situação do registro expandido.
- Expandir exibe contato, origem, produtos, quantidades, valores, frete e dispositivos/execuções. O link WhatsApp apenas abre a conversa quando o operador clicar; não envia mensagem automaticamente. Número sem DDI precisa ser conferido pelo operador.
- **Copiar registros** e **Baixar registros** funcionam por atendimento ou seleção. Os relatórios incluem eventos técnicos e os identificadores das execuções; contatos permanecem na interface administrativa e não são incluídos no relatório técnico.
- **Recuperado** fecha o atendimento sem exigir pedido. Associar pedido é opcional, exige um pedido real com o mesmo e-mail e não altera seu pagamento. Compra detectada automaticamente é um resultado diferente.
- Exclusão exige confirmação; apaga somente os dados de recuperação selecionados, não pedidos WooCommerce. Atualizações usam revisão do registro: se houve alteração simultânea, atualize a lista e tente novamente. Não existe polling de gestão que substitua campos durante edição.

Busca exata por e-mail/telefone ou número de pedido, filtros por período, modalidade e dispositivo. Telefones normalizados e e-mails são dados informados, não provas de identidade. Nomes não são uma busca parcial nesta primeira versão.

## Indicadores e deduplicação

O período considera a última atividade do caso, em UTC no banco e exibida no horário do navegador. Os indicadores gerais usam o período; busca/modalidade/dispositivo filtram a fila, não redefinem o total geral.

- Perfis identificados: identidade de contato distinta entre os registros do período, priorizando e-mail normalizado e usando telefone válido como alternativa. Não é contagem de visitantes únicos do site.
- Pessoas com erro: perfis com pelo menos um evento técnico marcado como erro; taxa = perfis com erro / perfis identificados no período. Não é taxa de falha de pagamento nem conversão de visitantes.
- Recuperados: perfis marcados manualmente; vinculados: subconjunto recuperado com pedido associado opcionalmente.
- Compras detectadas: perfis com pedido vinculado que chegou a `processing`. Não equivale a toda venda da loja nem reconciliação histórica.
- Anônimos ficam separados. Uma pessoa pode aparecer em mais de um dispositivo e mais de um resultado histórico; não somar esses grupos como pessoas exclusivas.

Tentativas são execuções da página, incluindo recarga/retorno de autenticação. Reutiliza o caso aberto nos últimos sete dias quando há correspondência de contato; conflitos entre telefones não são unidos automaticamente. Casos fechados permitem nova intenção de compra. Contatos compartilhados ou alterados podem gerar ambiguidade: a ferramenta não comprova identidade por e-mail digitado e nunca usa essa informação para autenticar.

## Diagnóstico e associação ao pedido

O coletor cria identificador aleatório e prova de escrita assinada com duração de duas horas. Os campos ocultos do formulário WooCommerce transportam esse vínculo ao pedido. Ao chegar a `processing`, o servidor encerra o caso, preserva as tentativas e registra o evento de forma idempotente. Não chama `payment_complete`, não altera status financeiro e não usa e-mail/horário para adivinhar o pedido.

Iniciar uma execução nova exige nonce WordPress. Se esse nonce mudar após autenticação sem recarregar a página, a prova de escrita válida permite continuar somente a execução assinada existente. Ela não permite consultar contatos nem executar gestão. Prova inválida e nonce inválido são rejeitados; acesso administrativo continua exigindo nonce e capacidade em todas as operações.

Checkpoints existentes do logger alimentam a coleta mesmo sem debug habilitado. O módulo observa etapas, cliques semânticos, validação de telefone, autenticação, submissão, status/duração de requisições, categorias de erro JavaScript com arquivo/linha/coluna e navegação sanitizada. Não grava stack livre, texto completo de resposta, URLs com parâmetros, todos os cliques do navegador ou digitação.

Navegador/SO/tipo são inferidos, podendo ser desconhecidos; não prometemos modelo exato do aparelho. Fora do checkout, apenas uma chegada de página de uma execução recente já existente é observada, para investigar retorno à home. Não se inicia rastreamento de todos os visitantes da loja.

A coleta é independente do envio do pedido. Falha de rede ou observação não deve bloquear o checkout. Fila local limitada, envio em lotes, retomada após voltar à rede. Fechamento de aba, armazenamento bloqueado, expiração, bloqueadores ou encerramento abrupto podem deixar lacunas. Uma compra enviada antes de obter o vínculo assinado pode não entrar na contagem automática. Checkout clássico é o contrato implementado; WooCommerce Blocks/Store API não está coberto.

## Dados, retenção e limites

Tabelas WordPress com prefixo da instalação: `ctwpml_recovery_cases`, `ctwpml_recovery_attempts` e `ctwpml_recovery_events`, em InnoDB. Contato separado do diagnóstico e criptografado pelo `CTWPML_Key_Vault` existente. Preservar a configuração de chaves/salts usada pelo cofre junto ao backup seguro da instalação; perder essas chaves pode tornar contatos antigos ilegíveis. Não guardar chaves em relatórios ou no repositório.

Sem CPF, senha, certificados, prova WebAuthn ou payload Pix na nova coleta. Produtos e valores vêm do carrinho do servidor; informação do visitante não altera estado financeiro.

Retenção: **90 dias contados da criação do caso**, com exclusão dos dependentes por WP-Cron diário em lotes de 50. Manter plugin e WP-Cron ativos; em site sem tráfego, usar acionamento de cron da hospedagem. Desativar o plugin interrompe essa tarefa. Desativar apenas a coleta preserva gestão e limpeza. Não há exclusão de pedido WooCommerce pela retenção.

Lista: 25 por página; Kanban: até 25 por coluna, com total e orientação de usar a lista para os demais. Ações até 50 casos por lote; resumo de até 100 execuções no detalhe; relatório paginado de 500 eventos por requisição, limitado a 20 mil por exportação (se exceder, selecionar menos casos). Até 5 mil eventos por execução e limite de requisições de coleta. Não é gravação ilimitada de sessão.

## Verificação executada e aceite no site

Testes locais usam o PHP/JS/CSS/markup reais e transporte/banco WordPress simulados. Cobrem autorização/nonce, criptografia real AES-GCM, isolamento do contato, prova assinada, deduplicação, revisão, associação manual, fechamento `processing`, rede lenta/offline, retorno à home, DOM seguro, copiar/baixar e arraste nativo no Edge em larguras de 320 a 1280 px.

Ainda é necessário verificar instalação das tabelas, transações/locks e cron no MySQL real, regras do cache/CDN/PWA, login Secure Passkeys real e Safari/iOS. Nenhum pedido/configuração de produção foi alterado pelo agente para testar este módulo.

Roteiro inicial: abrir deslogado e como cliente; confirmar bloqueio; entrar como admin; ativar coleta; fazer uma tentativa própria no desktop e outra no celular; verificar frete/valor e cronologia; repetir após login/recarga; provocar uma falha controlada; concluir um pedido próprio; conferir fechamento ao chegar a `processing`; mover outro caso em Kanban, copiar/baixar, marcar Recuperado sem pedido e associar um pedido opcional. Conferir que nenhuma ação de recuperação altera o pedido e que o login volta à central.

## Reversão

Desative a coleta em Configurar para interromper novos registros mantendo checkout e consulta. Para reverter código, retorne à versão anterior pelo processo Git Updater, preservando as tabelas; a página deixará de renderizar a central se o shortcode não existir. Não excluir dados automaticamente no rollback. Exporte os registros necessários antes de descarte deliberado. Se o módulo estiver desativado/removido, sua limpeza agendada não será executada.

Referências oficiais usadas: [tabelas de plugins/dbDelta](https://developer.wordpress.org/plugins/creating-tables-with-plugins/), [WP-Cron](https://developer.wordpress.org/reference/functions/wp_schedule_event/) e [contrato do checkout WooCommerce](https://woocommerce.github.io/code-reference/files/woocommerce-includes-class-wc-checkout.html). Blueprint e decisões: https://app.notion.com/p/4254347fa2c2812c8a1bdd79cbfcfa8a.
