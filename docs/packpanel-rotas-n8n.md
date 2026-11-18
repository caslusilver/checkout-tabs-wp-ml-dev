# Pack Panel — Contrato da gestão de rotas V1

O fluxo de cálculo é independente do webhook de despacho. Em **WordPress → PackPanel → Rotas**, habilite as abas de rotas e preencha o CEP de saída, a URL HTTPS de cálculo e o nome cadastrado no gerenciador de chaves. O nome sugerido é `authorization`. Também é possível escolher um nome exclusivo para o cálculo, como `authorization_rotas`. Ao trocar da v3.3.0, o webhook salvo é reaproveitado. Se o endereço anterior incluir um CEP reconhecível, o campo aproveita esse CEP.

O Google é configurado nas credenciais do n8n para resolver endereços e calcular trajetos. O painel desenha o percurso e as paradas numeradas com os dados do retorno. Se já houver uma chave pública de mapa cadastrada na v3.3.0, o painel pode exibir também o mapa com ruas. O segredo do webhook é consultado apenas no WordPress.

Habilite primeiro em sandbox. Para pausar a V1, desative a chave no painel. Isso preserva os registros e pausa a fila de eventos. Ao reativar, use **Retomar pedidos na fila** para continuar os envios que ficaram pendentes.

## 1. Cálculo, WordPress → n8n

`POST` com JSON. No Webhook do n8n, use autenticação por cabeçalho `Authorization` com o valor cadastrado no gerenciador do WordPress. O plugin busca esse valor com `sakm_get_key(nome_da_chave)` e o envia exatamente como salvo, inclusive o prefixo `Bearer ` se fizer parte do valor. Para a origem, resolva `body.origin.postcode` no n8n. O CEP tem oito dígitos em texto e preserva zeros à esquerda. O retorno é síncrono, HTTP 200 e JSON em até 25 segundos. [Webhook do n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)

~~~json
{
  "schema_version": 1,
  "request_id": "11111111-1111-4111-8111-111111111111",
  "revision": 0,
  "origin": { "postcode": "01234567", "country": "BR" },
  "destination_strategy": "farthest_road_distance",
  "stops": [
    { "ref": "stop_1", "location": { "lat": -23.551, "lng": -46.631 } },
    { "ref": "stop_2", "place_id": "PLACE_ID_VALIDO" },
    { "ref": "stop_3", "address": {
      "street": "Rua Exemplo", "number": "13", "neighborhood": "Bairro",
      "city": "São Paulo", "state": "SP", "postcode": "00000-000", "country": "BR"
    } }
  ]
}
~~~

Cada parada tem uma referência usada apenas dentro desta chamada e uma fonte de localização. O endereço usa os dados de entrega do próprio pedido. O plugin envia um Place ID ou ponto confiável quando o metadado `_ppwoo_route_location` ou o filtro `ppwoo_route_order_location` informar `verified: true` e `address_fingerprint` igual ao hash recebido como terceiro argumento do filtro. Coordenadas precisam de validade em `expires_at` (Unix, segundos) ou fonte `merchant_verified`. Ausência, divergência ou expiração usam o endereço. Reveja as fontes de coordenadas do ambiente antes de ligá-las ao filtro. GPS do celular durante a compra pode representar um lugar diferente da entrega.

### Resposta

- Ecoar `schema_version`, `request_id` e `revision` exatamente.
- `origin` recebe coordenadas. `stops` contém as paradas atendidas na ordem da rota, com `ref`, `location` e `eta_seconds` inteiro e acumulado desde a saída.
- Cada parada também pode incluir `distance_meters`, inteiro com a distância acumulada desde a saída.
- `destination_ref` é a referência da última parada. `path` é o trajeto decodificado, uma lista de pontos `{lat,lng}`, até 8.000. `distance_meters` e `duration_seconds` são números inteiros.
- Cada referência da entrada aparece exatamente uma vez em `stops` ou `issues`. Para uma parada incompleta, use `{"ref":"stop_3","code":"not_found"}`. Códigos aceitos: `not_found`, `no_route`, `provider_limit`, `quota`, `invalid_address`.
- Se nenhuma parada puder ser calculada, retorne `stops: []`, `path: []` e todos os problemas em `issues`. Uma prévia parcial pode ser reorganizada. O envio exige um cálculo completo para os membros atuais do grupo.
- O limite de transporte do painel é de 100 pedidos por consulta. Um único Compute Routes do Google admite 25 intermediárias além do destino. Quando o fluxo de cálculo atingir o limite real do provedor, devolva `provider_limit` para as paradas que precisem ir para outro grupo. O painel pede novo cálculo para o grupo ajustado.

A [resposta de exemplo](../tests/fixtures/packpanel-route-calculation.json) usa quatro pontos fictícios. Para responder a uma consulta de teste, substitua o ID e a revisão pelos valores recebidos e preserve as referências da solicitação. O arquivo de exemplo tem uma ordem conhecida e não requer serviços externos para testar a validação local.

### Primeiro fluxo no n8n

1. Validar o cabeçalho de autenticação e a versão do corpo. Resolver o CEP de partida e as paradas sem coordenada ou Place ID confiável.
2. Medir a distância viária da origem aos destinos com uma matriz de uma origem por N destinos. Sugerir o destino mais distante. Conferir no Google Cloud a cobertura do modo moto, o SKU e o limite utilizados.
3. Calcular a rota com o destino sugerido e as intermediárias. Nas etapas de cálculo n8n, remapear o índice retornado pelo Google à referência original de cada parada e somar a duração dos trechos até cada uma. Informar distância e duração totais.
4. Devolver o trajeto e qualquer parada que não pôde entrar. Cotas, rejeições e endereços inválidos ficam visíveis por pedido. Testar os quatro pontos, reagrupamento e retorno parcial antes de usar pedidos reais.

Referências: [Routes API](https://developers.google.com/maps/documentation/routes/quick-reference), [matriz de rotas](https://developers.google.com/maps/documentation/routes/compute_route_matrix), [otimizar paradas](https://developers.google.com/maps/documentation/routes/opt-way) e [preços](https://developers.google.com/maps/billing-and-pricing/pricing).

## 2. Despacho individual, WordPress → webhook já configurado

Ao deslizar **Concluir Envio**, o painel registra a saída, congela os dados de despacho e agenda a fila do WooCommerce. A fila emite um `mtb_packing_panel_shipped` por pedido. O corpo mantém o contrato legado. O custo é o valor negociado para aquele pedido. O prazo é a hora da saída mais a previsão daquela parada, em texto no fuso do WordPress. Link e WhatsApp são comuns. O código só é gravado no pedido final. Nos demais, o campo recebe zero, a representação que o formulário atual grava ao deixar o código vazio.

Cada tentativa envia também o cabeçalho `Idempotency-Key`. O valor é estável para o mesmo pedido e despacho. Um HTTP 2xx indica recebimento pelo webhook, conforme o contrato atual. Para informar uma rejeição segura para reenvio, retorne `{"accepted":false}` somente quando o evento não produziu efeitos. Conexão interrompida e outros status fora da faixa 2xx ficam **Envio sem confirmação**.

Se o envio ficou sem confirmação, confira se o n8n recebeu o evento. O painel permite reenviar falhas confirmadas. Um reenvio seguro de respostas incertas depende de o n8n deduplicar pela mesma chave antes de gravar custos e enviar mensagens. Instalações que já tinham ativado essa validação na v3.3.0 preservam a configuração.

### Roteiro de aceite em sandbox

Nos detalhes de cada pedido em **Rotas** e **Pedidos em rota**, use **Copiar dados para o motoboy** e cole o resultado em um rascunho. Confirme que cada botão copia o destinatário correto com o mesmo formato da aba Motoboy. O texto inclui apenas dados de entrega. O controle de privacidade do destinatário também oculta esse botão enquanto o painel estiver sendo compartilhado visualmente.

1. Recolher os cartões de Motoboy, selecionar quatro pedidos e calcular. Conferir ordem, mapa, prazo e um retorno parcial. Alternar visibilidade do destinatário e dos valores com a ficha aberta.
2. Dividir em dois grupos, tirar um pedido e conferir o retorno a Motoboy. Salvar a ficha e recarregar a página.
3. Preparar três pedidos com custos diferentes. Deslizar para despachar. Acompanhar os três eventos até o webhook e conferir código vazio nos primeiros e preenchido no último.
4. Simular rejeição, timeout e uma resposta repetida com a mesma chave. Conferir os estados, o reenvio e a escrita no banco de cotação.
5. Dar baixa em um pedido e depois nos restantes. Conferir a fila, o histórico, os eventos de debug do Pack Panel e o fluxo individual de Motoboy.
