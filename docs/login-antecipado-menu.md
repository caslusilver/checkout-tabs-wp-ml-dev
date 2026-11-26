# Login antecipado por e-mail e fingerprint nos menus — v3.4.17

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
