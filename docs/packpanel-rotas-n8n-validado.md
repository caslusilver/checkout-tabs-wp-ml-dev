# Rota em lote no n8n · roteiro de teste do PackPanel 3.3.1

Este roteiro usa a Routes API v2. A matriz mede da origem a cada parada. O destino fica fixo na parada com maior **distância viária**. O Compute Routes escolhe a ordem das demais. Inspecione cada saída com dados fictícios ou num ambiente de teste autorizado.

## Configuração efetiva e aceite — 19/11/2026

O usuário confirmou que as consultas e a devolução foram bem-sucedidas e fez o primeiro teste no painel. Este aceite cobre o fluxo de cálculo. Não comprova despacho, notificações ou baixa das entregas.

### vrv.global e Preparar matriz

A configuração efetivamente usada de vrv.global filtra body.origin (Object) e body.stops (Array). O código Preparar matriz abaixo desembrulha body e busca schema_version, request_id, revision e destination_strategy na saída original do node chamado exatamente Webhook. Esses valores devem vir do mesmo evento. Não criar request_id ou revision fictícios nem fixar payload antigo em produção. A alternativa da tabela com seis campos na raiz também é aceita.

### Credencial e requisições

Nos dois HTTP Request: Authentication → Generic Credential Type → Header Auth → credencial salva com Name X-Goog-Api-Key e Value contendo a chave Google. Manter segredo nas credenciais. A autenticação de entrada WordPress → Webhook usa outra credencial com Authorization, conforme o gerenciador de chaves do plugin.

Importar cURL prepara URL, método e headers. O corpo {} precisa ser substituído em modo Expression: Google Matriz recebe {{ $json.matrix_body }} e Google Rota recebe {{ $json.route_body }}. A expressão {{ !!$json.route_body }} produz booleano e pertence somente ao IF Tem rota?.

Nos dois HTTP Request: Include Response Headers and Status ligado, Never Error ligado e Response Format JSON. Escolher destino espera statusCode numérico 200 e body como array. Formatar resposta espera statusCode e body.routes. Never Error permite tratar status HTTP de falha, não converte erro em sucesso e não garante recuperação de toda falha de transporte.

### Resultado observado

Cinco elementos com ROUTE_EXISTS, índices retornados em ordem variável, corretamente associados aos candidatos originais por destinationIndex. Maior distância viária: destinationIndex 3, mapeado a stop_4. Escolher destino produziu destination_ref stop_4, quatro intermediárias e issues vazio. A ordem dessas intermediárias ainda será otimizada na consulta Google Rota.

### Respond to Webhook

Webhook inicial: Respond = Using Respond to Webhook Node. Respond final: Respond With JSON. Substituir todo JSON de exemplo em Response Body, modo Expression, por {{ $json.response_body }}. Options → Response Code, modo Expression, {{ $json.response_code }}. Enviar o objeto na raiz, não o envelope de trabalho {response_code,response_body}, um array de itens ou booleano. Salvar/publicar o fluxo antes de uma nova chamada real. Execução isolada com dados antigos não responde retroativamente ao plugin.

### Limites mantidos

WordPress aguarda 25 segundos. HTTP Google com timeout de 9000 ms por chamada, sem repetição automática no roteiro. Até 26 candidatos nesta implementação, até 25 intermediárias Google. Reaproveitar localização confiável disponível. Sem segredos ou endereços pessoais nos exemplos duráveis.

### Próxima revisão

Rate limit, limitação de concorrência e autenticação dos endpoints do checkout continuam na fila de segurança. A melhoria imediata do botão de rotas será delimitada no blueprint da experiência. O mapa com ruas exige integração de navegador distinta do cálculo servidor → Google.

## 1. Webhook e vrv.global

No **Webhook**, mantenha o POST e sua credencial Header Auth de entrada com o cabeçalho `Authorization`. Em **Respond**, selecione **Using Respond to Webhook Node**. A credencial do Google é outra. Crie no n8n uma **Header Auth** de saída com **Name** `X-Goog-Api-Key` e o valor da chave do projeto que tem a Routes API habilitada.

Em **Edit Fields**, nome `vrv.global`, use **Manual Mapping** e preserve somente os campos definidos abaixo. Se for fixar dados para desenvolvimento, fixe uma amostra sanitizada aqui. Retire amostras antigas do Webhook que tenham cabeçalhos de autenticação.

| Campo | Tipo | Expressão |
| --- | --- | --- |
| `schema_version` | Number | `{{ $json.body.schema_version }}` |
| `request_id` | String | `{{ $json.body.request_id }}` |
| `revision` | Number | `{{ $json.body.revision }}` |
| `origin` | Object | `{{ $json.body.origin }}` |
| `destination_strategy` | String | `{{ $json.body.destination_strategy }}` |
| `stops` | Array | `{{ $json.body.stops }}` |

Topo do fluxo

~~~text
Webhook → vrv.global → Preparar matriz → Tem pontos?
                                         sim → Google Matriz → Escolher destino → Tem rota?
                                         não → Respond to Webhook                  sim → Google Rota → Formatar resposta → Respond to Webhook
                                                                                    não → Respond to Webhook
~~~

Os três nodes **Code** usam **Run Once for All Items**. Mantenha os nomes indicados, que são usados nas referências. Nos IFs, compare a expressão indicada com **is true**.

## 2. Code · Preparar matriz

O Google recebe o CEP como endereço da origem, com o país para dar contexto. Para as paradas, o node respeita as três formas aceitas pelo plugin: `place_id`, coordenadas e endereço. Na primeira configuração, o fluxo inclui até 26 paradas no cálculo e sinaliza as excedentes com `provider_limit`. Para validar a seleção atual, os cinco pedidos cabem na mesma consulta.

~~~javascript
const input = $input.first().json;
const filtered = input.body && typeof input.body === 'object' && !Array.isArray(input.body)
  ? input.body : input;
let original = {};
try {
  const webhookOutput = $('Webhook').first().json;
  original = webhookOutput.body ?? webhookOutput;
} catch {
  original = {};
}
const body = {...original, ...filtered};
const reply = (response_code, response_body) => [{json: {response_code, response_body}}];
const text = value => typeof value === 'string' ? value.trim() : '';
const postcode = text(body.origin?.postcode);
const refs = Array.isArray(body.stops) ? body.stops.map(stop => stop?.ref) : [];

if (body.schema_version !== 1 || !text(body.request_id) ||
    !Number.isInteger(body.revision) || body.revision < 0 ||
    body.destination_strategy !== 'farthest_road_distance' ||
    !/^\d{8}$/.test(postcode) || body.origin?.country !== 'BR' ||
    !refs.length || refs.length > 100 || new Set(refs).size !== refs.length ||
    refs.some(ref => typeof ref !== 'string' || !/^stop_[1-9]\d*$/.test(ref))) {
  return reply(422, {code: 'invalid_packpanel_request'});
}

const envelope = {
  schema_version: body.schema_version,
  request_id: body.request_id,
  revision: body.revision,
};
const issues = [];
const candidates = [];
const originWaypoint = {address: postcode.replace(/^(\d{5})(\d{3})$/, '$1-$2') + ', Brasil'};

for (const stop of body.stops) {
  const {lat, lng} = stop.location ?? {};
  const a = stop.address ?? {};
  let waypoint;
  if (text(stop.place_id)) {
    waypoint = {placeId: text(stop.place_id)};
  } else if (Number.isFinite(lat) && Number.isFinite(lng) &&
             Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
    waypoint = {location: {latLng: {latitude: lat, longitude: lng}}};
  } else if (text(a.street) && (text(a.city) || text(a.postcode))) {
    waypoint = {address: [text(a.street), text(a.number), text(a.neighborhood), text(a.city),
      text(a.state), text(a.postcode), a.country === 'BR' ? 'Brasil' : text(a.country)]
      .filter(Boolean).join(', ')};
  }

  if (!waypoint) issues.push({ref: stop.ref, code: 'invalid_address'});
  else if (candidates.length >= 26) issues.push({ref: stop.ref, code: 'provider_limit'});
  else candidates.push({ref: stop.ref, waypoint});
}

if (!candidates.length) {
  return reply(200, {...envelope, origin: null, destination_ref: null, stops: [], path: [], issues});
}

return [{json: {
  envelope, issues, candidates,
  matrix_body: {
    origins: [{waypoint: originWaypoint}],
    destinations: candidates.map(({waypoint}) => ({waypoint})),
    travelMode: 'TWO_WHEELER',
    routingPreference: 'TRAFFIC_UNAWARE',
  },
}}];
~~~

No IF **Tem pontos?**, use `{{ !!$json.matrix_body }}`.

## 3. HTTP Request · Google Matriz

Em **Import cURL**, cole:

~~~bash
curl --request POST 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix' \
  --header 'Content-Type: application/json' \
  --header 'X-Goog-FieldMask: originIndex,destinationIndex,status,condition,distanceMeters' \
  --data-raw '{}'
~~~

Selecione a credencial **Header Auth** do Google. Em **Send Body → JSON → Using JSON**, troque o corpo importado pela expressão `{{ $json.matrix_body }}`. Em **Options → Response**, habilite **Include Response Headers and Status**, **Never Error** e selecione **Response Format → JSON**. O próximo node lê a lista em `$json.body` e o status em `$json.statusCode`. Aplique essas mesmas opções no segundo HTTP Request. Use timeout de **9.000 ms** por chamada no primeiro teste e deixe retries automáticos desativados. O WordPress tem **25 segundos no total** para receber a resposta. [HTTP Request do n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) · [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix)

## 4. Code · Escolher destino

O índice da matriz aponta para o array enviado em `destinations`. O código guarda essa associação, mesmo se o Google responder em ordem diferente. Empates ficam com a primeira parada no lote.

~~~javascript
const prepared = $('Preparar matriz').first().json;
const response = $input.first().json;
const reply = (response_code, response_body) => [{json: {response_code, response_body}}];
if (response.statusCode !== 200 || !Array.isArray(response.body)) {
  const code = response.statusCode === 429 ? 429 : 502;
  return reply(code, {code: 'google_matrix_failed'});
}

const issues = [...prepared.issues];
const accepted = new Map();
const seen = new Set();
const {candidates, envelope, matrix_body} = prepared;

for (const row of response.body) {
  const index = row?.destinationIndex ?? 0;
  const code = row?.status?.code ?? 0;
  const candidate = candidates[index];
  if (!row || (row.originIndex ?? 0) !== 0 || !Number.isInteger(index) || !candidate || seen.has(index)) {
    return reply(502, {code: 'google_matrix_invalid'});
  }
  seen.add(index);
  const distance = row.distanceMeters ?? 0;
  if (code === 0 && row.condition === 'ROUTE_EXISTS' && Number.isInteger(distance) && distance >= 0) {
    accepted.set(index, distance);
  } else if (code === 8) {
    issues.push({ref: candidate.ref, code: 'quota'});
  } else if (code === 5) {
    issues.push({ref: candidate.ref, code: 'not_found'});
  } else if (code === 0 && row.condition === 'ROUTE_NOT_FOUND') {
    issues.push({ref: candidate.ref, code: 'no_route'});
  } else {
    return reply(502, {code: 'google_matrix_invalid'});
  }
}
if (seen.size !== candidates.length) return reply(502, {code: 'google_matrix_incomplete'});
if (!accepted.size) {
  return reply(200, {...envelope, origin: null, destination_ref: null, stops: [], path: [], issues});
}

const [lastIndex] = [...accepted.keys()].sort((a, b) => accepted.get(b) - accepted.get(a) || a - b);
const destination = candidates[lastIndex];
const intermediates = candidates.filter((_, index) => index !== lastIndex && accepted.has(index));

return [{json: {
  envelope, issues, destination_ref: destination.ref,
  intermediate_refs: intermediates.map(({ref}) => ref),
  route_body: {
    origin: matrix_body.origins[0].waypoint,
    destination: destination.waypoint,
    intermediates: intermediates.map(({waypoint}) => waypoint),
    travelMode: matrix_body.travelMode,
    routingPreference: matrix_body.routingPreference,
    optimizeWaypointOrder: intermediates.length > 1,
    polylineQuality: 'OVERVIEW',
    polylineEncoding: 'GEO_JSON_LINESTRING',
  },
}}];
~~~

No IF **Tem rota?**, use `{{ !!$json.route_body }}`.

## 5. HTTP Request · Google Rota

~~~bash
curl --request POST 'https://routes.googleapis.com/directions/v2:computeRoutes' \
  --header 'Content-Type: application/json' \
  --header 'X-Goog-FieldMask: routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation.latLng,routes.legs.endLocation.latLng,routes.polyline.geoJsonLinestring' \
  --data-raw '{}'
~~~

Depois de importar, selecione a mesma credencial **Header Auth** do Google. Use **Send Body → JSON → Using JSON** com `{{ $json.route_body }}` e as mesmas opções de resposta do node Google Matriz. A resposta esperada tem `body.routes[0]`. O campo `optimizedIntermediateWaypointIndex` reordena só as intermediárias. O último destino foi definido pela matriz. [Otimização de paradas](https://developers.google.com/maps/documentation/routes/opt-way) · [Compute Routes REST](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)

## 6. Code · Formatar resposta

~~~javascript
const chosen = $('Escolher destino').first().json;
const response = $input.first().json;
const reply = (response_code, response_body) => [{json: {response_code, response_body}}];
if (response.statusCode !== 200) {
  return reply(response.statusCode === 429 ? 429 : 502, {code: 'google_route_failed'});
}

const google = response.body;
if (!google || typeof google !== 'object' || Array.isArray(google) || google.error ||
    (google.routes !== undefined && !Array.isArray(google.routes))) {
  return reply(502, {code: 'google_route_response_invalid'});
}
const route = google.routes?.[0];
if (!route) {
  const issues = [...chosen.issues, ...[...chosen.intermediate_refs, chosen.destination_ref]
    .map(ref => ({ref, code: 'no_route'}))];
  return reply(200, {...chosen.envelope, origin: null, destination_ref: null, stops: [], path: [], issues});
}

const point = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 || (lat === 0 && lng === 0)) throw new Error('point');
  return {lat, lng};
};
const latLng = ({latitude, longitude}) => point(latitude, longitude);
const seconds = value => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,9})?s$/.test(value)) throw new Error('duration');
  return Number(value.slice(0, -1));
};
const meters = value => {
  const number = value ?? 0;
  if (!Number.isInteger(number) || number < 0) throw new Error('distance');
  return number;
};

try {
  const requested = chosen.intermediate_refs;
  const indices = chosen.route_body.optimizeWaypointOrder
    ? route.optimizedIntermediateWaypointIndex
    : requested.map((_, index) => index);
  if (!Array.isArray(indices) || indices.length !== requested.length ||
      new Set(indices).size !== requested.length ||
      indices.some(index => !Number.isInteger(index) || index < 0 || index >= requested.length)) {
    throw new Error('order');
  }
  const refs = [...indices.map(index => requested[index]), chosen.destination_ref];
  if (!Array.isArray(route.legs) || route.legs.length !== refs.length) throw new Error('legs');

  let elapsed = 0;
  let distance = 0;
  const stops = route.legs.map((leg, index) => {
    elapsed += seconds(leg.duration);
    distance += meters(leg.distanceMeters);
    return {
      ref: refs[index],
      location: latLng(leg.endLocation.latLng),
      eta_seconds: Math.round(elapsed),
      distance_meters: distance,
    };
  });
  const coordinates = route.polyline?.geoJsonLinestring?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 8000) {
    throw new Error('path');
  }
  const duration = Math.max(Math.round(seconds(route.duration)), Math.round(elapsed));
  if (duration > 172800) throw new Error('duration_limit');

  return reply(200, {
    ...chosen.envelope,
    origin: latLng(route.legs[0].startLocation.latLng),
    destination_ref: chosen.destination_ref,
    stops,
    path: coordinates.map(([lng, lat]) => point(lat, lng)),
    issues: chosen.issues,
    distance_meters: meters(route.distanceMeters),
    duration_seconds: duration,
  });
} catch {
  return reply(502, {code: 'google_route_response_invalid'});
}
~~~

O GeoJSON usa `[longitude, latitude]`. O plugin recebe `{lat, lng}`. Usei o final de cada trecho do Google para posicionar a parada, que pode estar ajustado à via. O ETA soma os tempos de viagem desde a origem, em segundos. [Trechos, duração e geometria na resposta do Google](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)

## 7. Respond to Webhook

- **Respond With** → **JSON**.
- **Response Body** → expressão `{{ $json.response_body }}`.
- **Options → Response Code** → expressão `{{ $json.response_code }}`.
- Se quiser declarar explicitamente o tipo, em **Response Headers** use `Content-Type` com `application/json`.

Na resposta HTTP 200, o WordPress espera o objeto na raiz do JSON. `schema_version` é o número `1` e `request_id` e `revision` são ecoados da própria chamada. Cada `ref` de entrada aparece uma única vez, em `stops` ou em `issues`. Quando houver rota, `destination_ref` é o último `stops[].ref`, o caminho tem ao menos dois pontos, e `duration_seconds` é igual ou maior que o ETA final. Uma falha geral pode usar HTTP 429 ou 502. O plugin mantém a seleção e mostra um erro. O valor em `response_code` é uma propriedade de trabalho do n8n e fica fora do JSON enviado ao WordPress. [Respond to Webhook do n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)

## Exemplo de resposta para cinco paradas

Exemplo fictício com a quarta parada como destino. O node **Respond to Webhook** envia o objeto abaixo. Na chamada real, os dados vêm de **Formatar resposta**, incluindo o ID e a revisão recebidos.

~~~json
{
  "schema_version": 1,
  "request_id": "11111111-1111-4111-8111-111111111111",
  "revision": 7,
  "origin": {"lat": -23.5, "lng": -46.61},
  "destination_ref": "stop_4",
  "stops": [
    {"ref": "stop_3", "location": {"lat": -23.53, "lng": -46.64}, "eta_seconds": 121, "distance_meters": 1500},
    {"ref": "stop_1", "location": {"lat": -23.51, "lng": -46.62}, "eta_seconds": 242, "distance_meters": 3100},
    {"ref": "stop_5", "location": {"lat": -23.55, "lng": -46.66}, "eta_seconds": 362, "distance_meters": 4800},
    {"ref": "stop_2", "location": {"lat": -23.52, "lng": -46.63}, "eta_seconds": 483, "distance_meters": 6600},
    {"ref": "stop_4", "location": {"lat": -23.54, "lng": -46.65}, "eta_seconds": 604, "distance_meters": 8500}
  ],
  "path": [
    {"lat": -23.5, "lng": -46.61}, {"lat": -23.53, "lng": -46.64},
    {"lat": -23.51, "lng": -46.62}, {"lat": -23.55, "lng": -46.66},
    {"lat": -23.52, "lng": -46.63}, {"lat": -23.54, "lng": -46.65}
  ],
  "issues": [],
  "distance_meters": 8500,
  "duration_seconds": 605
}
~~~

## O que conferir no primeiro teste

1. Em `vrv.global`, o CEP preserva o zero inicial, `revision` é um número e as cinco referências chegam. Os cabeçalhos ficam fora da saída.
2. Em **Google Matriz**, confirme `statusCode: 200` e cinco itens em `body`. Em **Escolher destino**, compare o `destination_ref` com o maior `distanceMeters` dos itens `ROUTE_EXISTS`.
3. Em **Google Rota**, confira se o Google devolveu o índice otimizado, os trechos e a geometria. Para cinco paradas válidas, espere quatro índices e cinco trechos.
4. Em **Respond to Webhook**, compare o ID e a revisão com os de entrada. Cada parada aparece uma vez e o tempo total fica abaixo do limite do WordPress. Use **Calcular rotas** para verificar a prévia no painel.
5. Se o Google responder 403, confira a credencial Google, a autorização para a Routes API e o faturamento do projeto. Se for o Webhook inicial que responde 401/403, confira a credencial do PackPanel. Primeiro confirme de qual chamada veio o status.
6. O modo `TWO_WHEELER` atende ao caso do motoboy e está disponível no Brasil. Confira cobrança e cotas no projeto do Google. As chamadas da matriz geram um elemento por parada nesta consulta. [Cobertura por país](https://developers.google.com/maps/documentation/routes/coverage-two-wheeled?hl=pt-BR) · [Modo moto e cobrança](https://developers.google.com/maps/documentation/routes/route_two_wheel?hl=pt-BR) · [Uso e faturamento](https://developers.google.com/maps/documentation/routes/usage-and-billing)

Depois de confirmar o fluxo com a sua credencial, registre a versão validada no guia do plugin. A próxima tarefa é mapear os endpoints do checkout, a autenticação de cada entrada e o rate limit no aplicativo e no gateway.
