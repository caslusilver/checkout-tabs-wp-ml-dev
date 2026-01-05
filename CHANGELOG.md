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

## [Unreleased]

## Notas de Publicação (ainda não executadas)
- Criar o repositório: `caslusilver/checkout-tabs-wp-ml-dev`
- Branch principal do fluxo: `develop`


