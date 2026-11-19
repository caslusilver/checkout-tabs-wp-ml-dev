# Central de Entrega — v3.3.7

Blueprint canônico: https://app.notion.com/p/4174347fa2c281039406ffda42320b4d

## Instalar e testar

1. Publique uma página WordPress com `[ppwoo_order_tracking]`.
2. Em PackPanel → Configurações → Rotas, selecione essa página e salve. HTTPS é obrigatório para a sessão segura.
3. Use a referência da chave Google já configurada no PackPanel, restringindo a Maps JavaScript API ao domínio da loja. A página pública gera carregamentos de mapa; configure cotas no Google.
4. No webhook nativo de pedido WooCommerce, o novo campo de topo `order_tracking_url` aparece quando um pedido Motoboy aprovado (`processing`) é serializado. Nos eventos PackPanel, é `event_data.tracking_data.order_tracking_url`. **Use esse link no aviso de aprovação que já funciona**. O campo `link` continua contendo o rastreio externo. O código não envia um novo aviso por conta própria.
5. Abra o link sem login antes do despacho: a página mostra preparação. Despache pelo painel, mantendo a mesma aba/link: mapa, previsão, contato e rastreio aparecem na atualização seguinte (até 30 segundos).
6. Confira um destinatário intermediário e o último. Apenas o último recebe o código. Confirme pelo slide: baixa individual, contador atualizado e agradecimento. O botão alternativo acessível exige confirmação explícita.

A emissão é estável por pedido, protegida por lock MySQL durante a criação. Guardamos nonce e verificador no meta interno `_ppwoo_tracking_access`, nunca o token bruto no banco. O segredo da instalação assina o acesso. Trocar salts invalida links. O verificador é retirado dos metadados dos webhooks nativos. O link em si é privado e o canal autorizado que o distribui deve protegê-lo.

## Validade e encerramento

Antes da saída, o link autoriza somente o estado de preparação enquanto o pedido estiver aprovado; não há contagem de 24h antes do despacho. Após a saída, vale até `departed_at + 24h`, encerrando antes pela baixa administrativa ou confirmação do cliente. Expirar não confirma entrega.

Na seleção Compartilhar/Copiar, um link vencido pode ser renovado explicitamente para mais 24h, invalidando o anterior. Pedidos encerrados não podem receber novo acesso. A confirmação é transacional e repetível sem duplicar a baixa; depois de confirmada, o acesso normal aos dados é negado, mas a repetição da mesma confirmação pode obter apenas o recibo de sucesso até a expiração.

Não alteramos o status comercial WooCommerce pela confirmação do cliente. Auditoria registra `closed_source=customer`, preservando a baixa administrativa e as posições originais. Os eventos internos de despacho continuam para os contratos existentes; o fluxo n8n decide quais deles geram avisos ao cliente. Não foi alterado o n8n de produção.

## Mapa público

A resposta administrativa nunca é reutilizada diretamente. O próprio destino mantém precisão; demais destinos são generalizados em grade de aproximadamente 2km e a origem em região de aproximadamente 5km, sem pino. A linha pontilhada conecta referências aproximadas: **não é navegação exata nem localização ao vivo**. Endereços, nomes e telefones de terceiros, produtos, valores, trajetória privada e código das paradas intermediárias não fazem parte do DTO público.

Somente dados do cálculo fixado no despacho são utilizados. Não há nova Matrix/Routes/Geocoding por visita. A estimativa usa `eta_at`, calculada pela saída mais duração acumulada; prazo ultrapassado gera aviso em vez de nova estimativa inventada.

## Segurança e limites

Token no fragmento da URL, removido antes de carregar Google. Troca por cookie Secure/HttpOnly/SameSite=Strict, validação em toda ação, cabeçalho próprio e checagem de origem para AJAX. Páginas/respostas sem cache e sem indexação, sem scripts de analytics do tema no template. Cache/CDN/PWA da instalação deve respeitar a exclusão da página e admin-ajax. O endpoint é exposto para acesso por link e exige esse acesso para dados/baixa; nonce público não é autorização.

Limite básico por minuto de IP e acesso, sem chamadas de cálculo no polling, com pausa em aba oculta e sem sobreposição. Limites por transientes não são proteção de borda contra DDoS, nem garantem contadores atômicos em concorrência; uma auditoria ampla de endpoints/infraestrutura continua separada.

Sem migração de schema. O template da página selecionada é independente do tema e não executa header/footer, Elementor ou scripts de terceiros. Não afeta as outras páginas. O shortcode fora da página selecionada não carrega a aplicação; selecione a página nas configurações para usá-lo.

## Validação

13 testes Node: fluxo público preparação→despacho→confirmação, compartilhamento/cópia por destinatário sem código intermediário, gestos, preservação de edição e telefones. Suíte PHP: emissão estável antes/depois da saída, webhook nativo, expiração, vínculo de rota, token incorreto, DTO sanitizado, última parada e baixa. Sintaxe dos PHP/JS alterados e diff limpo.

Não foram executados WordPress/MySQL/Google Maps reais, cache/CDN/PWA, cookies de navegador real ou envio do fluxo n8n. A prévia visual foi aprovada pelo usuário, não equivale a aceite da integração em produção. API oficial do filtro usado: https://woocommerce.github.io/code-reference/files/woocommerce-includes-class-wc-webhook.html

## Rollback

Versão anterior: v3.3.6, merge `68bbcfa7b8e6e308bc978bb60b54ba2508bd1cb5`. Para desativar a Central, desmarque a página em Rotas antes de reverter. Rollback não apaga metadados nem desfaz recebimentos e eventos já gravados. Sem Chatwoot nesta entrega.
