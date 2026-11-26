# Login antecipado por e-mail e fingerprint nos menus — v3.4.17

## Computador sem histórico local — v3.4.21

No PC, a conta pode ter uma chave salva somente no celular. Nesse caso, a consulta por e-mail sabe que a conta tem chave, mas não comprova que este navegador consegue usá-la. O acesso rápido entra com uma credencial existente; criar a credencial exige primeiro autenticar a conta correta.

A entrada antecipada agora prioriza **Entrar e recuperar meus dados**, por senha, no dispositivo com mouse/hover sem o indicador local de uso bem-sucedido `ctwpml_passkey_used`. A mensagem explica: primeiro entre com sua senha; depois, poderá ativar o acesso rápido neste aparelho. O e-mail continua resumido, sem botão Continuar competindo. Quem já tem acesso disponível pode escolher **Já tenho acesso rápido neste aparelho** e então usar a chave. Mobile mantém a apresentação inicial anterior. Conta nova segue preenchimento/cadastro já existente.

Não há detecção de guia anônima nem lista silenciosa das chaves do navegador. A ausência do indicador também pode significar armazenamento limpo/bloqueado ou outro navegador; sua presença pode estar desatualizada ou se referir a outra conta. É somente preferência visual, nunca prova, sessão ou dispensa de senha/WebAuthn. Não se afirma que é a primeira visita. Chaves sincronizadas ou em outro aparelho continuam utilizáveis pela escolha explícita do cliente; o site não determina onde o navegador salva a chave.

Se o acesso rápido for cancelado, indisponível ou de outra conta, a oferta antecipada passa para senha preservando e-mail e vínculo. Vínculo ausente/expirado exige nova consulta pelo caminho existente. Senha correta → mesma página com sessão confirmada → convite já existente para ativar a chave → consentimento no aparelho → continuar compra. Senha incorreta não libera cadastro. Recuperação de senha, reCAPTCHA, limite, nonce e proprietário permanecem nos endpoints anteriores; não há associação de chave a uma conta pelo e-mail sozinho.

A correção de rótulos únicos da 3.4.20 permanece: adicionar outra chave conserva os registros nativos e respeita o limite configurado. Neste teste, o usuário relatou que conseguiu salvar a chave no PC após entrar por senha; esse aceite valida esse percurso relatado, sem provar outras plataformas.

Diagnóstico: `CHK_EARLY_DESKTOP_PASSWORD_FIRST`, `CHK_EARLY_KEY_SELECTED`, `CHK_EARLY_PASSWORD_FALLBACK`, além dos eventos de senha/cadastro já existentes. Sem e-mails ou provas nos logs. Validação local: preferência com/sem histórico/bloqueio, conta com chave, caminho opcional da chave, falha/conta divergente → senha, alteração de e-mail/vínculo, desktop com/sem chave na conta → senha incorreta/correta → cadastro criptográfico e regressão de duas chaves. Testar PIN/Face ID e comportamento real do gerenciador no PC após atualizar.

Depois de merge/release, atualizar pelo Git Updater, develop. Teste: abrir checkout no PC sem histórico local → informar e-mail existente com chave no celular → Entrar e recuperar meus dados → senha → convite de ativação → criar acesso no PC. Confirmar que não abriu um seletor de chave antes do login por senha e que ambas as chaves continuam utilizáveis. Para escolher uma chave já acessível mesmo sem histórico local, usar a alternativa explícita. Rollback 3.4.20 restaura a apresentação anterior e preserva os cadastros nativos. A opção experimental continua podendo ser desativada nas Integrações; menu fingerprint e pagamentos não mudam.

## Cliente existente sem chave — v3.4.19

Decisão do usuário: não permitir associar uma chave a uma conta apenas por digitar seu e-mail. Ele aprovou **login normal primeiro → recuperação dos dados → convite para cadastrar chave**, mantendo o preenchimento atual para cliente novo. Implementação e publicação em develop explicitamente autorizadas em26/11/2026.

Com o experimento ligado, a consulta distingue três caminhos sem devolver nome/endereço/ID de usuário:

1. **Conta com chave ativa:** mantém Usar meus dados salvos e a prova nativa.
2. **Conta existente sem chave:** mostra Entrar e recuperar meus dados, e-mail resumido e Editar e-mail. O clique abre o mesmo formulário de senha, com o e-mail preenchido e recuperação de senha em outra aba. A pessoa também pode optar pelo preenchimento manual.
3. **E-mail novo:** continua ao preenchimento, cadastro e convite finais já existentes. Não pede senha de uma conta que ainda não existe.

O login antecipado por senha usa ctwpml_login, contexto checkout-early e vínculo temporário da conta/sessão. O servidor verifica e-mail correspondente, validade e sessão do vínculo antes de wp_signon; senha correta, nonce, limite e reCAPTCHA continuam obrigatórios conforme a configuração existente. E-mail e vínculo não são prova de identidade. Nenhum cadastro de chave é disparado pela consulta ou por senha inválida. O vínculo nunca é guardado em URL ou storage do navegador.

Somente após o servidor confirmar o login, a página retoma o mesmo checkout e carrega os dados da conta autenticada. O convite nativo já existente aparece para cadastrar o primeiro acesso rápido, respeitando navegador, elegibilidade e convite já tratado na sessão. A criação depende de clique e confirmação no aparelho; se recusar/falhar, a compra pode continuar. O site não determina onde o navegador/aparelho armazena a chave.

Não muda os shortcodes, a opção experimental nem o caminho de primeira compra. Desativar Login antecipado em Integrações volta à entrada anterior. Reverter para3.4.18 remove somente esta oportunidade inicial para conta sem chave, preservando contas, credenciais e pedidos.

Referências: inc/ajax-check-email.php (vínculo por conta existente), assets/js/early-login.js e inc/frontend/early-login.php (três estados). Reutiliza inc/ajax-login.php e inc/frontend/passkeys.php / assets/js/passkeys.js. No Secure Passkeys1.3.0, src/ajax/secure-passkeys-frontend-ajax.php registra cadastro/opções apenas em wp_ajax autenticado e usa get_current_user_id; o motor permanece separado e inalterado.

QA: testes PHP de conta sem chave, senha errada, conta diferente, vínculo vencido/outra sessão e ausência de autenticação na consulta; DOM de oferta e alternativas; Edge com markup PHP real antes/depois do login, senha errada sem convite, senha válida, convite e criação verificada pela biblioteca WebAuthn original. Cadastro/login de conta nova, motor, recuperação, captcha e demais regressões mantidos. A instalação real WordPress/Elementor/PWA/iOS deve ser conferida pelo usuário após atualizar; fixtures não equivalem a uma compra real.

## Refinamento v3.4.18 — acesso rápido em evidência

Após teste real da3.4.17, o usuário confirmou que Usar meus dados funcionou e pediu eliminar a competição com Continuar. Ao encontrar chave ativa, a apresentação agora muda para **Encontramos seu acesso rápido. Agora é só confirmar para recuperar seus dados e continuar a compra.** O campo e Continuar ficam ocultos; o e-mail aparece como texto com **Editar e-mail**. Usar meus dados salvos é a única ação primária. Não significa acesso antecipado a nomes ou endereços: só a autenticação os libera.

Editar preserva o texto do e-mail, invalida o vínculo usado e reabre o campo com **Consultar**. Nesta edição a consulta é explícita, evitando mudar de estado enquanto a pessoa corrige. Confirmar consulta volta à oferta se houver acesso; ausência de chave segue pelo preenchimento normal. Vínculo expirado volta ao formulário para nova consulta. Alternativas por senha, recuperação e preenchimento continuam disponíveis. Não muda o motor, as permissões, a opção experimental ou o shortcode.

Prévia interativa preservada separadamente em `C:/Users/Dell/.codex/visualizations/2026/11/16/01a1e5cd-82e8-7220-8261-12709f4d4886/login-acesso-prioritario-previa.html`. A prévia simula a confirmação; o QA do código usa o autenticador virtual e a biblioteca nativa. Usuário pediu reunir este refinamento ao controle de padding do aviso de próximo envio na mesma versão.

Implementação aprovada em26/11/2026 após a prévia do Blueprint V2. Base anterior validada pelo usuário:3.4.16. O Secure Passkeys1.3.0 permanece instalado separadamente e é o responsável pelas credenciais e provas WebAuthn.

## Instalar nos dois menus do Elementor

1. Atualize Checkout Tabs WP ML para3.4.17 pela branch develop no Git Updater.
2. Em cada menu, substitua o ícone de conta por um widget **Shortcode** com:

```text
[checkout_ml_login]
```

3. Para definir o tamanho naquela instância:

```text
[checkout_ml_login size="32"]
```

4. Para cores diferentes:

```text
[checkout_ml_login size="28" color="#ffffff" logged_color="#0075ff"]
```

5. O tamanho padrão fica em **Checkout Tabs ML → Integrações → Tamanho do fingerprint** (slider18–48px, padrão28px). Salve e recarregue para conferir. `size` prevalece sobre o padrão.
6. Mantenha os IDs, efeitos glass e visibilidade por rolagem dos contêineres atuais. Não é necessário colocar outro HTML de login. O modal único é criado no corpo da página para ficar acima dos menus.

Visitante: branco e Login. Sessão confirmada no servidor: azul e Logado nas duas instâncias. Tocar em Logado abre Minha Conta em outra aba. Tocar em Login oferece acesso rápido e alternativa por senha, com retorno à mesma página após autenticar. Sem o motor ativo, o ícone é um link nativo para Minha Conta. Nunca realiza logout por um toque.

## Ativar e desativar o experimento

Em **Checkout Tabs ML → Integrações → Login antecipado (experimental)** marque **Começar pelo e-mail e oferecer recuperação dos dados salvos**, salve e recarregue o checkout. A opção começa desligada; o shortcode funciona independentemente dela.

Ligado: e-mail primeiro → consulta com nonce/limite → oferta de recuperar dados se houver chave ativa na conta → clique explícito → prova no aparelho → mesma página com sessão autenticada. Um endereço completo é aplicado antes da escolha/revalidação do frete; vários exigem escolha; endereço incompleto abre edição; nenhum permite cadastrar. A revisão final, confirmação de contato e termos continuam obrigatórios conforme as regras existentes. Não há confirmação de compra ou cobrança automática pelo simples login.

Cliente novo, conta sem chave ou opção Prefiro preencher meus dados: continua preenchendo, com e-mail reaproveitado; etapas numeradas Dados pessoais → Endereço. Login/cadastro e convite de acesso rápido no fim permanecem disponíveis. Estrangeiros mantêm a função atual de CPF gerado no formulário manual; CPF não é usado na consulta antecipada.

Desligado: volta à ordem Endereço → Dados pessoais e ao acesso final anterior. Não apaga contas, passkeys ou pedidos. Para voltar imediatamente ao fluxo já validado, desmarque a opção e recarregue. Se reverter o pacote para3.4.16, remova/substitua `[checkout_ml_login]` nos menus, pois o shortcode só existe a partir de3.4.17.

## Recuperar a senha

O snippet de referência em `C:/Users/Dell/Downloads/PAGINA DE OBRIGADO WC/pop up login` usa:

```text
https://cogulifestore.com.br/wp-login.php?action=lostpassword
```

O plugin gera essa URL com `site_url('wp-login.php?action=lostpassword','login')`, sem fixar o domínio. “Perdeu sua senha? Clique aqui” abre em outra aba para preservar a compra. O WordPress envia o e-mail de redefinição; seu envio depende da configuração de e-mail do site. O mesmo link aparece no login final e no novo modal.

## Segurança e manutenção

- E-mail somente orienta. Não libera endereço, pagamento ou sessão. A consulta usa o endpoint existente `ctwpml_check_email`, POST, nonce, limite20/min por IP; retorna método e um vínculo opaco temporário, sem nome/endereço/ID de conta.
- Vínculo antecipado:40 caracteres aleatórios, transient de10min, hash do token na chave e associação com a sessão WooCommerce. A prova da chave deve ser da conta vinculada. Expiração exige nova consulta do e-mail. O vínculo não substitui challenge, assinatura ou sessão.
- O registro original do Secure Passkeys continua sendo a fonte de chave ativa. Não há inventário silencioso universal de chaves locais. Guia normal e anônima usam o mesmo acesso explícito oferecido pelo aparelho; cancelamento/chave indisponível permitem continuar ou usar senha. O site não escolhe onde o aparelho salva a chave.
- Contexto dos dois menus compartilhado, sem cache da resposta e sem polling contínuo. Atualiza ao abrir/retornar à aba; cor azul depende da sessão real, não de localStorage.
- Rascunho visitante fica preservado. Login antecipado usa chaves de modal/formulário/telefone com sufixo da conta autenticada; não grava o rascunho visitante sobre o perfil. Login tardio mantém o fluxo existente. URL de retomada só escolhe apresentação; nunca concede acesso.
- Senha usa `ctwpml_login` com nonce, limite e decisão de reCAPTCHA do servidor. O novo formulário tem IDs próprios e não move o formulário final do checkout. Não registra e-mail, documento, senha, ticket ou provas em logs novos. Checkpoints `CHK_EARLY_*` mostram somente etapa/resultado; `CHK_EARLY_ADDRESSES_READY` mostra contagem.
- Arquivos: `inc/frontend/early-login.php`, `assets/js/early-login.js`, `assets/css/early-login.css`; adaptadores existentes `passkeys.php/js`, `ajax-check-email.php`, `ajax-login.php`, `address-ml-modal.js` e configurações. Sem alteração do motor, banco nativo, snippets, site ou fluxo de pagamento.

## Verificação

QA local: testes PHP de vínculo/sessão/conta correta e expiração; DOM de duas instâncias, opção desligada, consulta atrasada, manual, reset e isolamento de rascunhos; Edge com autenticador virtual e prova validada pela biblioteca original. Diálogo e passos conferidos em320/390/768/1280px. Regressões existentes de cadastro/login, desktop e reCAPTCHA mantidas.

Na loja, conferir após atualizar: dois menus, recuperação de senha recebida por e-mail, conta com/sem chave, conta nova, cancelamento, chave de outra conta, um/vários endereços com número/complemento, cupom, frete, termos e confirmação final. Repetir em PC/celular normal/anônimo e PWA. A suíte isolada não comprova cache/CDN, Elementor real ou Face ID de cada aparelho. Nenhum pedido real foi emitido no QA do agente.
