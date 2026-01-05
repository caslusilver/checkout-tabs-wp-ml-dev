# Referência — Estado atual + Git Updater + CEP (2026-01-05)

## O que está funcionando (preservar)
- **Botões Avançar/Voltar** voltaram a aparecer e funcionar no checkout (incluindo mobile).
- **Painel admin** do plugin (menu principal “Checkout Tabs ML”) com abas.
- **Abas do painel** alternam sem reload (JS).

## O que está travado
- **Fluxo do CEP**: preenche, envia requisição, mas **não avança** em algum ponto (precisa logs do frontend para fechar diagnóstico).
- **Git Updater**: deixou de “enxergar” novas versões após `v3.1.22`.

## Evidência do problema do Git Updater (log do servidor)
Arquivo: `C:\\Users\\Dell\\Downloads\\debug (5).log`

Trechos relevantes (rate limit da API do GitHub):
- `Git Updater Error: Checkout Tabs WP ML (checkout-tabs-wp-ml-dev:develop) - API rate limit exceeded ...`

Isso indica que o Git Updater **está sem autenticação** para a API do GitHub ou está fazendo chamadas demais para o mesmo IP.
Sem token, o GitHub aplica limites baixos e o Git Updater não consegue consultar releases/tags.

## Ação aplicada (mitigação sem rollback destrutivo)
Para reduzir chamadas imediatas ao GitHub ao clicar em “Atualizar Cache”, o plugin foi ajustado para **não rodar `wp_cron()` automaticamente** após limpar o cache.

Arquivo: `inc/admin-refresh-cache.php`
- `wp_cron()` agora só roda se o filtro `checkout_tabs_wp_ml_gu_refresh_cache_run_cron` retornar `true` (default: `false`).

Motivo: rodar cron logo após limpar cache pode disparar checagens imediatas do Git Updater e agravar rate limit.

## O que fazer para o Git Updater voltar a atualizar (recomendado)
1) Configurar **token** no Git Updater (GitHub API) para aumentar o rate limit (recomendado).
2) Evitar clicar repetidamente em “Atualizar Cache” enquanto a API está rate-limited.

## Próximo passo para destravar o CEP (precisa log do FRONTEND)
O log do servidor não mostra erro do CEP neste trecho; precisamos do log do painel de debug no checkout:
1) Ative Debug no painel “Checkout Tabs ML”.
2) No checkout, clique em **Ver Logs** → **Copiar Logs**.
3) Cole o texto no chat, e descreva em 1 linha o passo exato: “preenchi CEP, cliquei Avançar, aconteceu X”.


