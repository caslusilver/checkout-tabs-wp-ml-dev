# Painel do motoboy — etapa 2, v3.4.0

Atualização do cofre na v3.4.1: o caminho em ambos os sites é **Checkout Tabs ML → Segurança das chaves**, endereço administrativo `/wp-admin/admin.php?page=ctwpml-vault`. As configurações do entregador continuam em PackPanel → Motoboy.

Origem: [blueprint e entrevista aprovados](https://app.notion.com/p/41e4347fa2c281839691dfaddf477a20), [transcrição de origem](https://app.notion.com/p/41e4347fa2c28107964feb99b1404975). A prévia aprovada define iniciar azul, chegar âmbar, concluir verde; marcadores e borda de 3px acompanham o estado. Sem GPS automático ou Chatwoot nesta etapa.

## Instalar no próprio site

1. Atualize o plugin e abra **PackPanel → Motoboy**. Na loja, é uma aba ao lado de Rotas e Conexão. O cofre fica no menu Checkout Tabs ML → Segurança das chaves.
2. Publique uma página dedicada, por exemplo `/entregas/`, com `[ppwoo_driver_panel]`. Não use a página inicial: o cache offline tem escopo apenas nessa página.
3. Selecione a página, escolha **Local — loja de origem**, habilite e salve. Campos de conexão entre sites podem ficar vazios no modo exclusivamente local. O mapa usa a referência Google já cadastrada em PackPanel → Rotas.
4. Se quiser mostrar ao cliente “O motoboy já está com seu pedido” até o motorista iniciar, ative **Aguardar início pelo painel do motoboy** na aba Rotas. Desativar o painel do motoboy restaura o acompanhamento normal; não obriga uso do novo fluxo.
5. No painel de pedidos, abra **Links da rota → Painel do motoboy**. O link existe em preparação, antes do despacho. O entregador pode consultar a rota, mas as ações aguardam a loja registrar a retirada pelo slide de despacho existente.
6. Antes de sair, o entregador abre o link com internet e espera **Rota disponível offline neste aparelho**. Guarde o link original para recuperar o acesso caso a sessão/cookie seja apagada.

## Instalar no outro WordPress

Use o mesmo pacote atualizado nos dois sites. O WordPress remoto não precisa de WooCommerce depois de selecionar o modo remoto; esse modo encerra o bootstrap antes dos módulos de checkout. Configure inicialmente sem habilitar, selecione remoto, salve e recarregue.

| Campo | Loja (Local) | Host do entregador (Remoto) |
| --- | --- | --- |
| Página deste site | Opcional se utilizar somente host remoto | Página publicada com o shortcode |
| URL da página no outro site | `https://painel.exemplo.com/entregas/` | Vazio |
| URL base da loja de origem | Vazio | `https://loja.exemplo.com` (inclua subdiretório, se existir) |
| Identificador da conexão | `loja-principal` | Mesmo identificador |
| Domínio autorizado do outro site | `painel.exemplo.com` | `loja.exemplo.com` |
| Nome local da chave compartilhada | Referência no cofre da loja | Referência no cofre remoto |
| Nome da chave Google para domínio remoto | Não usado; usa a configuração Rotas | Referência Google válida para o host remoto |

1. Em **Checkout Tabs ML → Segurança das chaves**, gere uma chave aleatória e salve o **mesmo valor**, com pelo menos 32 caracteres, nos dois cofres. Se já cadastrou na loja, use **Copiar chave** no cartão correspondente e cole o valor no outro site; **Copiar nome** recupera a referência. Os nomes podem diferir. Não use a chave Google como segredo de comunicação. Instalar o ZIP não copia os dados de outro WordPress; cada site criptografa seu próprio cadastro.
2. Preencha a tabela, habilite e salve nos dois sites.
3. No host remoto, execute **Testar conexão configurada**. O diagnóstico assinado não consulta pedidos nem registra entregas.
4. O endpoint é fixo: `/wp-json/ctwpml-driver/v1/route`. O plugin monta esse caminho a partir da loja configurada; não aceita URLs arbitrárias vindas do navegador.
5. Exclua a página do motoboy, `admin-ajax.php` e a rota REST de cache/CDN/otimizadores. O worker deste módulo guarda somente HTML genérico, JS e CSS próprios. Valide convivência com o PWA já instalado e evite outro worker com escopo conflitante.

O segredo compartilhado fica no PHP. HMAC assina corpo, timestamp, nonce, conexão e host. A loja recusa replay, divergência de host e solicitações fora da janela de cinco minutos. Os relógios dos servidores devem estar corretos. TLS obrigatório, redirecionamento HTTP desativado e validação de destino/SSRF. Limites por minuto: 90 por IP no acesso do navegador e 120 por IP/conexão entre servidores, serializados por mutex MySQL de nome inferior a 64 caracteres. Não substitui proteção de borda ou a futura auditoria geral de endpoints.

A chave Google de navegador **precisa chegar ao SDK**. Guardá-la pelo nome organiza e protege o armazenamento, mas não a torna secreta no navegador. Restrinja a API e os referenciadores HTTP no Google Cloud para os domínios permitidos; use outra chave para integrações privadas do servidor.

## Integrar o gerenciador de chaves anterior

O snippet Secure API Keys Manager v2.1 foi fornecido pelo usuário nesta conversa. Reaproveitamos os nomes e a leitura, sem copiar chave/IV fixos nem redeclarar funções `sakm_*`. As integrações de cálculo, despacho e mapa procuram primeiro o cofre interno e, na ausência do nome, consultam o legado.

1. Faça backup do banco, das chaves originais e dos salts/segredo de criptografia. Não publique esses backups no repositório.
2. Mantenha o snippet ativo e vá a **Checkout Tabs ML → Segurança das chaves → Importar do gerenciador anterior → Importar chaves legadas**.
3. A importação copia e recriptografa os valores legíveis usando AES-256-GCM, IV aleatório de 12 bytes, tag de 16 bytes e nome como dado autenticado. Não sobrescreve nomes internos já existentes nem apaga `sakm_encrypted_keys`.
4. Valide cálculo, mapa e envio com as mesmas referências de nome. Só depois desative o snippet manualmente, se desejar. O agente não altera snippets do site.
5. O cofre usa segredo derivado de `wp_salt('secure_auth')`, ou `CTWPML_VAULT_KEY` definido no ambiente antes de carregar o plugin. Trocar salts, essa constante ou mover apenas o banco pode tornar os valores ilegíveis: planeje exportação/reentrada antes. Não inclua essa constante nem valores reais em commits.

Na v3.4.1 a lista exibe nomes internos e legados, sem duplicar referências. O valor começa oculto e é recuperado somente ao clicar em Mostrar ou Copiar chave, com capacidade administrativa, nonce e POST sem cache. Mostrar permite ocultar novamente; o valor é apagado da visualização após um minuto ou ao sair da aba. Se a cópia automática for bloqueada, oferece seleção manual. Copiar nome não consulta o segredo. Não grava valores em localStorage/sessionStorage nem em logs.

Salvar/remover/importar exige `manage_options` e nonce. O gerador usa `crypto.getRandomValues`. **Remover** exige confirmação e apaga somente o nome escolhido tanto no cofre interno quanto na opção legada desse site, se houver, evitando que a chave reapareça pelo fallback; a confirmação avisa que integrações podem parar. A importação permanece sem apagar o legado. Nenhuma chave existente é transferida ou alterada automaticamente pela atualização.

## Etapas e dados

- **Iniciar**: começa a primeira parada e tenta abrir Waze. O link explícito permanece como alternativa ao bloqueio do navegador.
- **Cheguei**: registra chegada manual e atualiza a Central do próprio cliente.
- **Concluir e iniciar próxima**: registra a atuação do entregador e libera a próxima navegação. Na última, mostra agradecimento. Pode consultar todas as paradas; Waze fica habilitado somente para a atual já iniciada.
- **Corrigir esta parada**: preserva o histórico e volta à sequência escolhida, desde que nenhum cliente daquela sequência tenha confirmado. A conclusão operacional final ainda pode ser revista antes da baixa dos compradores. Não modifica confirmação do cliente.
- **Revisão administrativa**: em PackPanel → Motoboy, informe Saída # e ID do pedido finalizado, marque a confirmação e reabra. Reabre só esse recebimento, reinicia a sequência do entregador nessa posição e preserva outras confirmações. Guarda histórico com autor/data/origem, revoga o link do entregador e renova o desse cliente. Copie e entregue os novos links; não são enviados automaticamente.

O entregador recebe apenas destinatários, endereços, complementos, contatos, Waze e geometria da própria rota autorizada; não recebe produtos, custos, ficha completa ou código da corrida. A Central do cliente continua com DTO separado, sem dados exatos de terceiros. Horários de eventos são auditados como informado pelo aparelho, recebido pelo servidor e efetivo; o efetivo nunca retrocede na sequência, fica limitado ao recebimento e a até sete dias anteriores, sem preceder a retirada inicial. Não representa prova de localização.

A previsão usa início real da primeira parada + tempo acumulado calculado. Após avançar, usa início efetivo da parada atual + diferença entre a duração acumulada do destino e da parada anterior. Chegada registrada fixa a estimativa daquela parada. Mantém a geometria já calculada: não chama Google Matrix/Routes em cada visita. Despacho administrativo e início real continuam registrados separadamente.

O estado do motorista não altera status comercial WooCommerce, não dá baixa pelo cliente e não cria um novo contrato n8n. O cliente continua confirmando pelo próprio slide; o administrador mantém a baixa existente. A Central consulta automaticamente, sem sobreposição e pausada em aba oculta. Uma confirmação do comprador não elimina eventos legítimos já guardados offline; baixa administrativa bloqueia novos avanços, preservando repetição idempotente do que já foi aceito.

## Offline e conflitos

IndexedDB guarda rota e fila **antes** de liberar o avanço ou abrir outro aplicativo. Cada evento tem UUID, aparelho, sequência e versão operacional própria. A sincronização envia até 20 eventos por lote, em transação e sem chamadas sobrepostas. Repetir a mesma ação após perda de resposta não repete a transição. Conteúdo diferente com o mesmo ID, versão divergente ou sequência inválida é recusado.

Sem internet, pode consultar endereços e avançar os slides em ordem. O aviso diz que está salvo no aparelho, não que o cliente já recebeu atualização. Ao reconectar, aplica em ordem. Um conflito mantém a fila e os endereços para consulta, bloqueia novas ações e oferece **Conferir pendências**: consulta o estado da loja e só abandona a fila conflitante após confirmação, guardando suas referências para revisão. Não sobrescreve silenciosamente outro operador/cliente. Duas abas compartilham gravação transacional e notificam mudanças; um gesto iniciado sobre versão antiga é recusado.

O worker tem escopo apenas na página dedicada e cache estrito do shell sem tokens/dados. Tokens são retirados do fragmento e trocados por cookie Secure/HttpOnly/Strict; nunca vão ao IndexedDB/cache de rede. Dados da rota ficam no IndexedDB do aparelho: prefira dispositivo de trabalho, sem compartilhamento. Encerramento/revogação detectados online removem o snapshot. Na abertura da aplicação, snapshots sem atualização há sete dias são eliminados, preservando referências da fila. Um aparelho completamente offline não pode conhecer uma revogação feita no servidor.

O primeiro acesso exige conexão. Limpar dados do navegador, modo privado, bloqueio de armazenamento ou desinstalar PWA pode apagar a fila. Cache do módulo não garante mapas Google ou navegação Waze sem internet; os endereços e controles continuam. Ao ver aviso de que a reabertura offline não pôde ser preparada, mantenha a aba aberta e corrija a configuração antes de depender dela em campo.

## Verificação e limites do aceite

- `tests/driver-panel.test.php`: executa regressão PackPanel/Central e contratos de cofre, transições, idempotência, rollback de lote inválido, ETA, confirmação independente, revisão administrativa, token, HMAC/replay/host/TLS e limite básico.
- `tests/driver-panel-dom.test.cjs`: IndexedDB simulado, gestos, vários eventos offline/reabertura/reconexão, resposta perdida e mesmo UUID, conflito e revisão explícita, remoção de dados após revogação e isolamento de zoom.
- `tests/driver-browser.qa.cjs`: Edge real com servidor local e pedidos fictícios; celular/desktop, toque simples, slide nativo, worker instalado, recarregamento offline real, reconexão e cache limitado a shell/assets. Requer `playwright` temporário e Edge; `DRIVER_QA_OUTPUT` opcional salva capturas fora do plugin.
- Regressões Node de Central/rotas/telefones, sintaxe de todos os JS/PHP alterados e `git diff --check`.

O teste de navegador usa HTTP localhost (contexto seguro de desenvolvimento) e API simulada, sem chaves ou clientes reais. Não valida o ambiente WordPress/MySQL, HTTPS/cookies em dois domínios, Google Maps real, iOS/Safari, PWA/Elementor da loja nem abertura do app Waze. Esses pontos exigem instalação controlada e teste de ponta a ponta pelo usuário. Nenhum site, snippet, n8n ou pedido de produção foi modificado pelo agente.

## Rollback

Para reverter somente a reorganização do cofre (v3.4.1), use **v3.4.0**, commit `08a7f5c21eb1296e8a09644b032640dcf0b9c65f`. As chaves existentes usam a mesma opção/criptografia. Uma exclusão que o administrador confirmou não é desfeita pelo rollback; mantenha backup. O caminho antigo do cofre volta a ser PackPanel nessa versão.

Base anterior: **v3.3.9**, integração `723a1ec705c561ee332bc50ceec9bb0c37c7c59c`, já publicada. Primeiro sincronize as filas, desative o painel e preserve backups. O Git Updater pode retornar a essa tag; não apaga dados/eventos. Se já importou chaves e desativou o snippet, reative a leitura legada antes de voltar: v3.3.9 não conhece o cofre novo. No host remoto, não use a versão antiga como painel isolado (ela não tem modo remoto); desative o plugin ali. A página do motoboy não deve permanecer exposta ou prometida como operacional após rollback.

O merge em `develop` gera tag/release pela Action existente. Aprovação do layout/implementação não é prova de publicação nem validação em produção; registrar PR, commit e resultado da Action na entrega.
