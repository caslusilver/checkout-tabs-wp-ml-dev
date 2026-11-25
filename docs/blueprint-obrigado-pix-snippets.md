# Página de obrigado e componentes externos de Pix

Registro contextual de 25/11/2026. Plano futuro; não é uma integração implementada.

## Prioridade e ordem

1. Desbloquear a edição da página de obrigado no Elementor, sem montar a interface do checkout no editor ou na página de confirmação. Correção publicada separadamente na v3.4.8; validação na loja pendente.
2. Concluir o reflexo da aprovação automática do pagamento na página de obrigado: feedback/animação somente após confirmação validada no servidor. Este é o próximo objetivo prioritário.
3. Reunir no mesmo blueprint a revisão visual da página e a incorporação dos snippets externos, aproveitando as arquiteturas do gateway e do checkout; não duplicar responsabilidades.

## Componentes externos a recuperar

- **Asaas Pix Widget** (`[asaas_pix_widget]`): mostra Pix Copia e Cola, dois controles de cópia, feedback e contador visual. A versão original 0.0.11 modificava o payload em `normalizePix`, convertendo `BR.GOV.BCB.PIX` e URL Asaas para minúsculas. Isso alterava conteúdo sem recalcular CRC. Payload deve ser preservado integralmente.
- Revisão 0.0.12 foi fornecida no chat para remover conversões. Revisão 0.0.13 foi fornecida para título “Pague com Pix Copia e Cola”, rejeitar placeholder `SEU-PAYLOAD-PIX` e manter cópia sem alterar o texto. **0.0.13 ainda não foi instalada/validada**, segundo o usuário. Recuperar o código efetivamente instalado antes da migração.
- O usuário confirmou que `SEU-PAYLOAD-PIX` estava no atributo `code` do shortcode. Texto de instrução não deve ocupar esse atributo, que representa o payload pagável. Uso dinâmico proposto: `[asaas_pix_widget mins="6"]`, lendo o campo real do gateway `.woocommerce-order-details__asaas-pix-code`.
- **Asaas Pix Thank-You Tweaks**: CSS de quebra de linha/largura do payload e botão, cores e debug opcional no hook `woocommerce_thankyou`. Não modifica payload. Original 1.1.3; revisão 1.1.4 fornecida com `text-transform: none` e preservação do feedback verde. Instalação desta revisão não comprovada.
- Esses snippets estão fora dos repositórios físicos dos plugins. Este documento preserva responsabilidades e decisões, não afirma que estejam incorporados. Não desativar snippets no site antes de equivalência validada e plano para evitar shortcodes/funções duplicados.

## Página de obrigado e pagamento

- Padrão existente: `/pagina-de-obrigado-compras-woocommerce/order-received/{order_id}/?key={order_key}`. Não registrar links reais de clientes ou chaves de acesso na documentação.
- O gateway `own-gateway-clone` recebe `/asaas-webhook` autenticado por segredo próprio, consulta a API de validação e atualiza o pedido. O token OAuth do Inter não autentica esse endpoint da loja.
- Pedido motoboy: confirmação visual e possível transição para acompanhamento do próprio pedido. Correios: confirmação/animação; não redirecionar ao painel do entregador. A página do cliente é diferente do painel privado do motoboy.
- `payment_signal=confirmed` foi somente uma proposta de parâmetro visual no chat. Não está implementado nem representa prova de pagamento. Link com parâmetro não pode aprovar pedido. Construir URL no n8n não redireciona navegador já aberto.
- Investigar primeiro os mecanismos de status/polling e thank-you existentes no gateway e checkout. Evitar consulta agressiva, sobreposição e sucesso visual antecipado. Autorização por pedido deve permanecer no servidor.
- Separar contador visual (seis minutos) e validade real da cobrança (24 horas, `calendario.expiracao=86400` segundos); a cópia atual “o tempo para pagar acaba” precisa ser revista ao integrar, para não informar uma expiração bancária incorreta.

## Pendências antes de implementar o blueprint

Recuperar snippets efetivamente instalados e estrutura Elementor, revisar onde cada plugin controla o status/renderização, validar contrato `payment-status`, correspondência txid/pedido/valor e reenvio idempotente ao gateway. Fechar sucesso de pagamento no navegador antes das demais melhorias. Nenhuma mudança nessa página ou nos snippets foi implantada no site por esta correção.
