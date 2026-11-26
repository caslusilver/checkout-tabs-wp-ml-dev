# reCAPTCHA no checkout — v3.4.16

## Desativar para continuar os testes

1. Atualize Checkout Tabs WP ML para3.4.16 pelo Git Updater, branch develop.
2. No WordPress, abra **Checkout Tabs ML → Integrações**.
3. Localize **Verificação reCAPTCHA** e desmarque **Exigir reCAPTCHA no login e na criação de conta do checkout**.
4. Clique em **Salvar alterações**. Recarregue o checkout que já estava aberto, inclusive em PWA, para receber a configuração nova.
5. Faça o cadastro de uma conta nova ou entre com e-mail/senha de uma conta existente. O plugin não deve exibir desafio, carregar api.js nem exigir token nesses endpoints quando desligado.
6. Depois de autenticar, o convite de acesso rápido continua no mesmo fluxo aprovado. Nenhuma chave é criada apenas por conhecer um e-mail ou por desativar o captcha.

O padrão da opção é **ativado**, preservando instalações existentes. A atualização não desmarca a opção automaticamente. O controle vale para o formulário/rotas deste plugin; não altera WP Login, configurações de outro plugin, Google, Secure Passkeys ou proteções externas do site. Se outro plugin exigir captcha independentemente, sua regra permanece.

## Reativar e configurar

1. Use um par de chaves **reCAPTCHA v2**, do mesmo cadastro, com o domínio da loja autorizado no Google.
2. Preencha Site Key e Secret Key na mesma aba. Nunca publique a Secret Key em logs ou chat.
3. Se quiser reutilizar Login No Captcha reCAPTCHA, deixe **as duas** chaves deste plugin vazias. Ele reutiliza o par completo; não mistura Site Key de uma integração e Secret Key de outra.
4. Marque a exigência, salve e recarregue o checkout.
5. Abra a criação de conta ou a alternativa de senha, conclua o desafio e continue. Expiração/rejeição exige resolver novamente. Em falha de carregamento use **Tentar carregar a verificação**; campos permanecem preenchidos.

O site não consegue reparar chave errada, domínio não autorizado ou bloqueio de rede do Google por uma alteração de CSS. Quando ativado e não verificável, a proteção permanece bloqueante; o administrador pode corrigir a configuração ou desligar explicitamente a opção para testes. Não há desativação automática por erro.

## O que foi corrigido

Relato do usuário: excluiu sua conta de teste para comprar como novo cliente e parou na exigência do reCAPTCHA. Autorizou corrigir, adicionar controle de desligamento e mesclar em develop durante os testes. Sem logs da resposta do Google, não foi atribuída uma causa única à instalação.

Código anterior obrigava token nos endpoints e no submit independentemente da configuração visual; a criação por diálogo ainda dependia de Site Key. O carregador contava tempo enquanto a view de senha podia estar escondida pelo popup de passkey, o callback vinha do template no footer e não havia ação clara de recuperação. O servidor tinha verificação duplicada, incluindo uma rota legada que podia continuar se o Google falhasse. Corrigidos esses contratos juntos.

Implementação: inc/security/recaptcha.php centraliza flag, par de chaves, guard de POST/nonce/limite e validação server-side. inc/settings.php e inc/admin/menu.php mantêm a opção no painel existente. inc/enqueue.php envia somente flag/chave pública e só carrega Google quando ativo, com dependência do script que declara o callback. Template e login-auth-v2.js seguem a mesma flag; passkeys.js solicita render quando revela senha. address-ml-modal.js preserva o diálogo de conta nova com ou sem captcha.

Servidor exige POST e nonce por ação e limita10 tentativas de login/minuto e5 por endpoint de cadastro/minuto por origem. Desligamento só consulta wp_options; um campo enviado pelo visitante não libera nada. Quando ligado, exige par completo, token, HTTP200, JSON com success true e hostname igual ao home/site da loja. Erro de rede/JSON/domínio/rejeição não cria conta. Logs ctwpml-auth guardam somente eventos técnicos, sem resposta do Google, token, chave secreta ou e-mail. O limite não substitui autenticação.

Também corrigida a conversão em inteiro antes de testar WP_Error em criação de usuário: falha de cadastro não pode virar ID e autenticar uma conta errada. Conta existente continua pelo fluxo de senha/passkey; dados informados não são prova de identidade. Cupons, migração de rascunho e retorno à mesma página continuam no caminho existente.

Referências oficiais: [render explícito, callback, expiração e erro](https://developers.google.com/recaptcha/docs/display), [validação server-side e token de uso único](https://developers.google.com/recaptcha/docs/verify). A resposta do desafio expira em dois minutos e é de uso único; o adaptador reseta após erro em vez de reutilizá-la.

## Verificação e limites

- tests/recaptcha-auth.test.php: padrão ativo, desligamento só pelo servidor, par coerente/fallback, erro de rede/HTTP/JSON/domínio, POST/nonce/limites, conta nova, conta existente, senha inválida e WP_Error sem autenticação.
- tests/recaptcha-dom.test.cjs: desligado sem API, submit único, formulário oculto sem gastar prazo, callback de widget0, expiração e reset, erro/retry sem duplicar widget ou apagar e-mail e falta de configuração.
- tests/recaptcha.browser.qa.cjs: template PHP e JS reais em390/1280px; ativo/inativo, Google carregando antes do DOM ready, expiração/novo desafio, conta nova, login por senha, nonce e retorno à mesma URL. Endpoints e Google simulados; não cria contas/pedidos na loja.
- Regressão de acesso rápido/Voltar e desktop/mobile;51 testes Node e17 arquivos de testes PHP aprovados, além de sintaxe/diff. Não comprova chaves reais, domínio autorizado no Google ou compra real no Safari/PWA. Validar esses pontos na instalação após atualizar.

Rollback para3.4.15 preserva contas, passkeys, opções e pedidos. A versão anterior ignora a opção de desligamento e volta à exigência anterior; não apaga chaves para reverter.
