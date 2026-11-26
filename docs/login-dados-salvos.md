# Login com dados salvos — v3.4.12

## Dependência e instalação

Manter **Secure Passkeys 1.3.0** instalado e ativo separadamente no mesmo WordPress da loja. Esta integração não instala, substitui, copia o motor para o checkout nem migra credenciais. Referência oficial: https://github.com/endisha/secure-passkeys, commit `cf2b3c11705b18d5f183ba053dc943ca68a75c30`. Cópia local de referência em `C:/Users/Dell/Desktop/plugins VIBE CODER/secure-passkeys-reference`. Novas versões do motor precisam de teste de compatibilidade.

1. Depois do merge e da release, atualizar Checkout Tabs WP ML para3.4.12 pelo Git Updater na branch develop.
2. Manter HTTPS e o domínio/RP ID do Secure Passkeys. Trocar esse domínio pode invalidar a utilização das chaves anteriores; esta versão não altera essa configuração.
3. Abrir checkout sem login: oferta “Não preencha tudo de novo”, botão “Usar meus dados salvos”. Continuar sem recuperar dados preserva o checkout normal. Cancelar biometria não impede usar outra forma de acesso.
4. Na autenticação tardia, o diálogo prioriza a mesma oferta; “Entrar com e-mail e senha” revela o formulário existente. Criação de conta continua com suas regras atuais.
5. O shortcode original `[secure_passkeys_login_form]` usado no PackPanel continua funcionando, agora com rótulo traduzido e fingerprint. O adaptador também oferece `[checkout_ml_acesso]` para um bloco completo de entrada com o estilo do checkout. Não colocar ambos no mesmo local.
6. Em Minha Conta do WooCommerce, quando o motor já mostra seu botão, preservamos esse ponto traduzido; caso contrário adicionamos o bloco. O ícone Minha Conta customizado do header deve continuar apontando para a página de conta. Não alteramos HTML externo do Elementor nem descobrimos automaticamente o seletor de cada menu.
7. Na página de obrigado, sessão autenticada elegível sem chaves recebe convite opcional “Na próxima, não digite tudo de novo”. Pix permanece acima e pode ser pago sem cadastrar chave. Pedido/key de URL sozinho não autoriza cadastro; visitante sem sessão autenticada não recebe convite. Se a loja permitir compra totalmente visitante, primeiro precisa autenticar/criar conta pelo fluxo atual.

## Contratos reaproveitados

`inc/frontend/passkeys.php` adapta a interface. `assets/js/passkeys.js` pede o contexto atual e chama os endpoints originais `secure_passkeys_frontend_get_login_options`, `secure_passkeys_frontend_login`, `secure_passkeys_frontend_get_register_options` e `secure_passkeys_frontend_register_passkey`. O servidor original verifica challenge, origem, assinatura, usuário e permissões e mantém suas tabelas. O transporte Base64 segue os scripts da1.3.0; não há verificação criptográfica própria no checkout.

O contexto AJAX público retorna apenas nonce do motor, sessão reconhecida e flags de cadastro/chaves do usuário atual. Sem endereços, IDs de chaves, credenciais ou consulta por email; POST, sem cache e limite30/minuto por sessão/origem. O cookie do WordPress é a autenticação. Nonce não substitui prova WebAuthn. A flag hasPasskeys só é consultada para a própria sessão.

O filtro `secure_passkeys_web_authn_validate_user_sign_in_enable_wp_login` ativa o evento padrão wp_login na autenticação bem-sucedida do motor para os hooks WooCommerce. Após login, navegação para a mesma página com `ctwpml_session_refresh` recebe sessão/nonces novos. Nunca usa redirect retornado para outro domínio. Na autenticação tardia, o hook secure_passkeys_web_authn_sign_in reaproveita ctwpml_migrate_guest_data_to_user após verificar o usuário da sessão, como o login tradicional. A entrada antecipada não grava rascunhos visitantes sobre o perfil. O fluxo de retomada tardia já existente conserva rascunho/endereço/frete/termos; entrada antecipada carrega perfil pelo caminho autenticado existente. Não marca pedido pago, não cria cobrança nem envia compra por reconhecer email.

Reaproveitados gettext e filtros de localização frontend do motor. Tradução cobre login, cadastro/gestão frontend e mensagens do adaptador; o painel administrativo completo do terceiro não é reescrito. O fingerprint fornecido pelo usuário está em `assets/fingerprint.svg`.

## Carregamento e confirmação

A tela verde integral com mensagem “Finalizando seu pedido…” e spinner aparece antes da gravação dos contatos e bloqueia nova finalização enquanto grava, conforme solicitação de cor do usuário. Verde nesse momento é aparência de processamento, não confirmação; ainda não mostra sucesso ou pagamento aprovado. Preparação de endereço em paralelo não pode ocultar esse indicador. Prioridade CSS fica acima dos headers/menus fixos. Um erro libera a ação. A mensagem de sucesso “Pedido recebido!” só aparece depois do sucesso WooCommerce, antes do redirecionamento nativo à página de obrigado; não anuncia pagamento recebido e não adiciona espera artificial.

O login tradicional também mostra “Acesso confirmado. Carregando seus dados…” antes de recarregar. Não mostrar texto de pedido concluído enquanto uma solicitação ainda pode falhar.

## Testes e limites

- `tests/passkeys.test.php`: contexto mínimo, sessão/proprietário, roles, método, rate limit e tradução.
- `tests/passkeys-dom.test.cjs`: oferta, cancelamento, ausência de suporte, erros, não duplicar clique e contrato de cadastro nativo.
- `tests/passkeys-browser.qa.cjs` com `VAULT_PHP`, `VAULT_PHP_EXT` e `PASSKEYS_REFERENCE`: Edge com autenticador virtual; cadastro e login verificados pela biblioteca WebAuthn original do Secure Passkeys, sem chamar a loja. `tests/passkeys-engine-fixture.php` é exclusivamente CLI.
- Suítes existentes PHP/Node de checkout, obrigado e expedição. Teste de sucesso mantém redirecionamento nativo Woo sem veto; atualização em background não muda mensagem do envio final.

Validar depois no site: chave já cadastrada, Face ID/PIN, primeiro comprador, ausência de chave, cancelamento, email/senha, nonce expirado, carrinho antes/depois e endereços do usuário certo. Fixtures não reproduzem todos os plugins, cache/CDN, restrições do dispositivo ou hooks da instalação real. Não há garantia universal para todos os aparelhos. Logs novos não registram provas, chaves, email ou dados de entrega.

## Desktop e rollback

O redesenho desktop ainda é prévia separada, sem mudar o layout mobile aprovado. Especificação: `docs/checkout-desktop-blueprint.md`.

Rollback para3.4.11 remove a apresentação/adaptador; mantém Secure Passkeys e suas chaves. Se usar `[checkout_ml_acesso]`, restaurar o shortcode original antes de reverter. Remover ou desativar o Secure Passkeys faz a entrada antecipada desaparecer e mantém o checkout tradicional; não apagar suas tabelas.
