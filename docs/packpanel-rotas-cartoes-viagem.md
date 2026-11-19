# PackPanel 3.3.6 — cartões e dados da viagem

Fonte: [Blueprint V1 aprovado](https://app.notion.com/p/41d4347fa2c2812b9d68f5eb3fd9768c), com a transcrição integral vinculada. O usuário aprovou posição da parada e contagem de entregas pendentes. Esta entrega requer aceite visual no site.

## Operação e aparência

- Na prévia, na lista de atribuídos e nos grupos de rota, o detalhe repete a organização da aba Motoboy: Cliente, nome com cópia à direita, WhatsApp clicável com cópia, endereço com cópia, CEP e complemento. O badge identifica Rota N ou Sem rota. Produtos continuam fora dos cartões de rota.
- Recolhido, o pedido mostra número/nome, endereço pequeno e Parada X de N. Em rota, informa também quantas entregas permanecem sem baixa. As posições originais não mudam após finalizar uma entrega.
- Cabeçalho do grupo identifica destino final por nome/endereço, mesmo fechado. O destino vem de `calculation.destination_order_id`, não da última posição arbitrária de um array. Cálculo pendente ou expirado não apresenta destino anterior como definitivo.
- O slider de cálculo continua exigindo gesto completo. Tem visual discreto quando o cálculo é válido e fica destacado quando precisa recalcular. O formulário e o salvamento automático são preservados.
- Após despacho, abaixo do mapa e métricas, aparecem WhatsApp do motoboy, código branco sobre azul e rastreio com ícones de cópia. A ficha despachada não volta ao modo editável.
- Data e horário da saída ficam numa linha própria, seguidos de **Selecionar todos** na linha abaixo. A seleção considera apenas entregas ainda não finalizadas.
- Sucesso individual aparece como **✓ Evento enviado com sucesso**. Erro e resultado incerto continuam distintos, com as ações de reenvio existentes. Tentativa e HTTP permanecem no debug de transição, fora da apresentação principal. Isso confirma aceite do evento pelo fluxo, não entrega de uma mensagem no WhatsApp.

## Reuso do código existente

`routes.js::orderInfo` usa os blocos `order-header`, `order-client-info` e `order-address` do template Motoboy como referência. O clipboard permanece em `panel.js::copyTextToClipboard`, incluindo feedback e fallback para seleção quando Clipboard API não está disponível. Botões de ícone levam valores explícitos em `data-copy-value`, para não incluir DDI/bandeira/rótulos na cópia do telefone nacional.

`class-routes.php::summary` mantém os campos anteriores e acrescenta `postcode`, `address_display` e `address_copy`. O campo `trip` é uma lista explícita de dados da viagem (`phone`, `whatsapp`, `link`, `code`) para leitura por operadores autorizados após despacho. Não expõe detalhes internos integrais e não altera as permissões do endpoint.

`get_billing_complemento` inclui fallback para `billing_address_2`. `get_delivery_complement` prioriza o complemento do endereço de entrega e só reutiliza faturamento quando rua/cidade/UF/CEP/país e número correspondem. Não consulta perfil atual do cliente. A mensagem completa usa uma linha em branco entre campos e inclui o complemento quando disponível.

## Validação

Testes DOM cobrem os novos cartões e ícones, cópia nacional sem DDI, fallback de clipboard, destino válido/pendente, slider discreto, dados da viagem após despacho, código copiável, seleção em linha separada, status sem HTTP/tentativas na superfície e pendências reduzidas após baixa sem renumerar paradas. Mantêm os casos de gesto, autosave, falha/conflito e preservação do mapa.

Testes PHP cobrem complemento padrão/legado, endereço diferente e número diferente, mensagens espaçadas e leitura de viagem após despacho sem reabrir a ficha editável. Casos de contrato, custos por pedido, eventos individuais, reenvio e baixa permanecem. Validar a aparência no Elementor, celular e PWA após atualizar. Dados e Google são simulados nos testes locais.

## Próxima fase

O shortcode e a página do cliente ainda seguem o blueprint da Central do Pedido. Esta versão não cria endpoint público ou token. Os dados administrativos não devem ser enviados diretamente ao cliente. A projeção pública futura deve respeitar o pedido autorizado, ocultar origem também na geometria e não expor outros destinatários. Código de finalização somente para a última parada. A previsão individual continua calculada a partir da saída real, preservando `departed_at + eta_seconds` do despacho atual.

O relato de mensagens que não chegaram aos clientes não teve causa confirmada nesta entrega. Diagnóstico do n8n/WhatsApp é uma etapa própria. Nenhum envio real foi feito pelo agente.

## Rollback

Versão anterior **v3.3.5**, integração **8c2a8c2394865e038531ec24f09ff7e13239494d**, disponível no Git Updater. Não há migração destrutiva. Reverter código não cancela eventos já enviados ou baixas já registradas.
