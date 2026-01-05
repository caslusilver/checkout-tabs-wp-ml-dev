# Changelog

Este arquivo documenta mudanças do plugin **Checkout Tabs WP ML**.

> Importante: **o repositório ainda não foi criado nem publicado no GitHub**.  
> Este changelog está sendo preparado **antes do primeiro push/publicação**.

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

## [Unreleased]

## Notas de Publicação (ainda não executadas)
- Criar o repositório: `caslusilver/checkout-tabs-wp-ml-dev`
- Branch principal do fluxo: `develop`


