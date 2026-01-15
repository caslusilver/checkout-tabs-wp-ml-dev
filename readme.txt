=== Checkout Tabs WP ML ===
Contributors: cubensisstore
Tags: woocommerce, checkout, shipping, tabs
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 3.2.65
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==

Abas no checkout do WooCommerce (checkout clássico) com consulta de frete via webhook e integração em WC_Session.

== Versionamento (Git) e branches ==

Este repositório começou com tags internas `v3.2.x` antes de adotarmos SemVer como “versão de publicação”.

- **main**: branch estável para uso/instalação (ponto de partida recomendado).
- **develop**: branch de desenvolvimento contínuo.

### Tags

- **Tags SemVer (publicação)**: a partir de agora, usamos tags como `v1.1.0`, `v1.1.1`, etc.
- **Tags históricas (`v3.2.x`)**: mantidas como referência técnica (histórico pré-SemVer) e para rollback pontual.
- **Observação importante**: o campo `Version:` do plugin (cabeçalho do WordPress) pode continuar em `3.2.x` por compatibilidade (cache de assets/Git Updater), mesmo quando a publicação no Git estiver em `v1.x.y`.

### Baselines (tags recomendadas)

- `v1.1.0`: release estável atual (equivalente ao estado do `develop` em `v3.2.65`).
- `v3.2.65`: marco técnico do Review (entrega com ícone Correios/Motoboy, prazo e quantidade corretos; faturamento abre lista; back inicial volta ao carrinho).
- `v3.2.64`: Review com resumo do carrinho + lista de itens; limpeza de estado após checkout concluído.
- `v3.2.63`: Cupom v4.7 (estado único e render imediato em Payment/Review/Sticky).

== Installation ==

1. Faça upload da pasta `checkout-tabs-wp-ml` para `/wp-content/plugins/`.
2. Ative o plugin em “Plugins”.
3. Configure em “WooCommerce > Checkout Tabs ML”.


