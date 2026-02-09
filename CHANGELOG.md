# Changelog

Este arquivo documenta mudanças do plugin **Checkout Tabs WP ML**.

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

## [Unreleased]

### Changed
- **Versão atual**: v3.2.111  
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
