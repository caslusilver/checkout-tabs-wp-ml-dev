# Contrato Operacional do Plugin

Este arquivo define o padrão de trabalho para qualquer agente que alterar este repositório. Ele é o contexto canônico da pasta e deve ser lido antes de modificar código.

## Escopo do projeto

- Repositório: `caslusilver/checkout-tabs-wp-ml-dev`.
- Branch de integração: `develop`.
- Plugin principal: `checkout-tabs-wp-ml.php`.
- Painel de pedidos integrado: `packing-panel-woo-dev/`.
- O usuário deve dar um comando claro antes de iniciar alterações de comportamento no plugin. Diagnóstico e leitura do código podem ser feitos antes disso.
- Não alterar produção, configurações do site ou snippets externos sem autorização explícita.

## Fluxo Git e Pull Request

O fluxo padrão para cada alteração do plugin é uma branch de trabalho com Pull Request para `develop`.

1. Conferir o estado antes de começar:

   ```powershell
   git status --short --branch
   git fetch origin develop
   git log -5 --oneline --decorate
   ```

2. Criar uma branch curta a partir de `develop`, usando o prefixo `codex/`:

   ```powershell
   git switch develop
   git pull --ff-only origin develop
   git switch -c codex/<descricao-curta>
   ```

3. Implementar somente o escopo solicitado. Alterações existentes do usuário devem ser preservadas; nunca usar `git reset --hard` ou `git checkout --` para limpar o diretório.

4. Validar, atualizar a versão quando houver mudança no plugin, criar um commit focado e publicar a branch:

   ```powershell
   git add <arquivos>
   git commit -m "tipo: descricao objetiva"
   git push -u origin codex/<descricao-curta>
   ```

5. Criar o Pull Request com:

   - `base`: `develop`.
   - `head`: a branch `codex/<descricao-curta>`.
   - título curto descrevendo o resultado.
   - corpo com resumo, arquivos/áreas afetadas, validações executadas, versão do plugin e limitações conhecidas.

6. Não fazer merge, publicar em produção ou fechar o PR sem comando explícito do usuário.

O usuário pode solicitar excepcionalmente um push direto para `develop`. Nesse caso, a instrução explícita prevalece, mas continuam obrigatórios o versionamento, a validação e o relato do commit publicado.

## Autenticação do GitHub

- Usar a variável global `GITHUB_TOKEN` quando ela estiver disponível.
- Nunca imprimir, copiar para o chat, gravar em arquivo ou incluir o token em URL, commit, log ou corpo do PR.
- Preferir manter o token somente em memória durante o comando Git/API.
- Confirmar o resultado do push/PR com hash, branch e URL, sem revelar credenciais.
- Não criar uma nova credencial nem alterar configurações globais do Git sem autorização.

## Versionamento e Git Updater

Toda mudança de comportamento, PHP, JavaScript, CSS, template, configuração ou integração do plugin deve gerar uma nova versão reconhecível pelo Git Updater.

- Atualizar o cabeçalho `Version` em `checkout-tabs-wp-ml.php`.
- Registrar a alteração no topo de `CHANGELOG.md` com a mesma versão.
- Usar incremento de patch para correções e pequenas melhorias, por exemplo `3.2.125` para `3.2.126`.
- Os assets devem continuar recebendo a versão do plugin para invalidar cache do WordPress, Elementor e PWA.
- O cabeçalho do módulo `packing-panel-woo-dev` é auxiliar; a versão oficial é a do plugin principal.
- Alterações apenas documentais, sem código do plugin, não exigem bump de versão.

## Regra de estilização e prioridade

O CSS do plugin deve vencer conflitos do WordPress, Elementor, tema e estilos inline do site quando a interface do plugin exigir aparência estável.

- Sempre escopar os seletores ao contêiner do plugin, como `.painel-empacotamento`, ou ao componente específico.
- Usar especificidade suficiente e `!important` nas propriedades que precisam de prioridade absoluta, principalmente `background-color`, `color`, `border`, `opacity`, `box-shadow` e regras de pseudo-elementos.
- Forçar também o estado `:hover`, `:focus`, `:active` e o ícone interno quando o componente puder ser sobrescrito.
- Não usar seletores globais para corrigir um conflito local e não espalhar `!important` sem necessidade.
- Depois da correção, garantir contraste permanente mesmo sem interação do usuário. O padrão aplicado ao ícone de atualização é:

  ```css
  .painel-empacotamento .ppwoo-refresh-button,
  .painel-empacotamento .ppwoo-refresh-button:hover,
  .painel-empacotamento .ppwoo-refresh-button:focus {
      background-color: #fff !important;
      border: 2px solid #1d2327 !important;
      color: #1d2327 !important;
      opacity: 1 !important;
  }

  .painel-empacotamento .ppwoo-refresh-button .dashicons,
  .painel-empacotamento .ppwoo-refresh-button .dashicons::before {
      color: #1d2327 !important;
      opacity: 1 !important;
  }
  ```

- Preservar as cores e dimensões definidas pelo produto; a prioridade visual não deve destruir responsividade, foco ou legibilidade.
- Verificar desktop, celular, atalho/PWA e páginas com Elementor. Se o CSS for alterado, o bump de versão deve forçar a atualização do asset.

## Padrão de implementação

- Ler o código e os fluxos relacionados antes de editar.
- Reutilizar endpoints, helpers, nonces, capacidades e padrões já existentes.
- Para ações críticas, exigir confirmação explícita do usuário. Um toque simples não deve executar operações irreversíveis; sliders devem voltar ao início quando o gesto for incompleto e disparar o endpoint apenas ao atingir o fim.
- Para polling, evitar chamadas agressivas, impedir requisições sobrepostas, pausar quando a página estiver oculta e preservar a aba/estado visível.
- Endpoints AJAX devem validar nonce e capacidade do usuário no servidor, mesmo quando a interface já bloqueia o acesso.
- Nunca registrar dados sensíveis, tokens, CPFs, e-mails completos ou payloads de pagamento em logs de debug.

## Validação mínima

Executar o que estiver disponível e relatar claramente o que não for possível:

```powershell
node --check <cada-arquivo-js-alterado>
git diff --check
php -l <cada-arquivo-php-alterado>
git status --short --branch
```

Quando houver interface:

- testar toque simples, gesto incompleto e gesto concluído em cada slider;
- confirmar que erros restauram o controle e não duplicam a requisição;
- conferir contraste sem hover/foco e depois de atualização AJAX;
- validar desktop, mobile e PWA;
- verificar que a atualização automática não perde a aba, o pedido atual ou campos em edição.

## Integrações futuras

Integrações com API de pagamento, webhooks ou serviços externos seguem o mesmo contrato: diagnóstico primeiro, implementação limitada ao escopo, nonce/capacidade no servidor, logs sem segredo, bump de versão, validação, branch de trabalho e PR para `develop`.

Este contrato é preferível a uma skill externa para este caso porque permanece junto do código e pode ser lido por qualquer agente em qualquer nova conversa aberta nesta pasta.

## Formato do encerramento

Ao concluir uma alteração, informar de forma objetiva:

- o que mudou;
- versão do plugin;
- commit e branch;
- URL do PR, quando houver;
- testes executados e testes impossíveis;
- passo exato para o usuário validar pelo Git Updater/site.
