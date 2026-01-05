/**
 * Abas do Checkout - Versão 3.1.19
 *
 * Personalização do Checkout do WooCommerce com Abas + Barra de Progresso e
 * consulta de frete via webhook - INTEGRAÇÃO COMPLETA COM WC_SESSION.
 *
 * Adicionado:
 * - Toggle de DEBUG via constante CC_DEBUG (true/false) no PHP, passado para o JS.
 * - O painel de logs no front-end e os console.log são exibidos apenas quando CC_DEBUG é true.
 *
 * Atualizações na versão 3.1.16:
 * - **Correção de Fluxo de Falha do CEP:**
 *   - O listener `.one('updated_checkout', handleUpdatedCheckoutForCepAdvance)` agora é registrado *sempre* no clique do botão "Avançar" do CEP, antes da consulta AJAX.
 *   - `handleUpdatedCheckoutForCepAdvance` verifica internamente se `freteData` é válido antes de avançar a aba, caso contrário, apenas limpa os estados de loading e reabilita o botão.
 *   - O AJAX de `consultarCepEFrete` (webhook) inclui `timeout`, `crossDomain`, `xhrFields` e um tratamento robusto no callback `error`:
 *     - Exibe mensagem de erro amigável ao usuário.
 *     - Remove o estado de processamento (`btn-processing`, `setProcessingState(false)`).
 *     - Garante que `$('#tab-cep').removeClass('cep-loading')` e `consultaEmAndamento = false;` sejam chamados no `complete` da requisição AJAX, mesmo em caso de erro.
 *   - A flag `consultaEmAndamento` é resetada para `false` no início do handler de clique do botão "Avançar" do CEP, prevenindo bloqueios por estados presos.
 *   - Chamadas a `setProcessingState(false)` e remoção de `btn-processing` foram revisadas em todos os pontos de falha da cadeia de Promises.
 * - **Correção de UX do Overlay de Loading (CEP):**
 *   - Implementada uma flag `clickedAvancarCep` para diferenciar `update_checkout` automáticos (ao digitar CEP) de `update_checkout` acionados pelo clique no botão "Avançar".
 *   - O overlay de loading (`setProcessingState(true)`) agora só é ativado pelo listener genérico de `update_checkout` se a flag `clickedAvancarCep` estiver `true` ou se o evento não for na aba CEP.
 *   - A flag `clickedAvancarCep` é resetada adequadamente em todos os caminhos de sucesso e falha do fluxo do botão "Avançar" do CEP.
 * - **Correção de Recálculo de Frete e Valores Visíveis:**
 *   - Introduzida a flag `recalcViaFrete` para distinguir `update_checkout` vindos da seleção de método de frete.
 *   - O listener de `update_checkout` agora permite que o AJAX de recálculo do WooCommerce ocorra (mesmo quando o overlay é suprimido na digitação do CEP), ao apenas impedir o `setProcessingState(true)` sob certas condições.
 *   - O listener de `updated_checkout` foi aprimorado para sempre chamar `renderDuplicateTotal()` e para atualizar explicitamente o custo do frete no resumo da aba "Resumo e Frete" após um recálculo, garantindo que os valores sejam exibidos mesmo sem o overlay.
 *
 * Atualizações na versão 3.1.12:
 * - Melhoria no overlay de carregamento:
 *   - Overlay agora é full-screen (position: fixed, 100vw/100vh) cobrindo toda a viewport.
 *   - Blur aumentado para 4px.
 *   - Spinner centralizado perfeitamente via transform.
 *   - Exibição/ocultação do overlay no JS agora força display: flex/none.
 * - O nome completo do cliente é incluído no payload enviado para o webhook externo de consulta de frete.
 *
 * Atualizações na versão 3.1.11:
 * - Substituída a barra de progresso superior (`.frete-loading`) por um overlay escurecido com blur e spinner azul no centro do formulário de checkout.
 *
 * Atualizações na versão 3.1.10:
 * - Refatorada a lógica do clique no botão "Avançar" (CEP):
 *   - A consulta do CEP via webhook, o processamento frontend e o armazenamento backend (`store_webhook_shipping`) agora são encadeados via Promises.
 *   - O listener `.one('updated_checkout', ...)` para avançar a aba e limpar o estado de processamento é registrado SOMENTE após a conclusão BEM-SUCEDIDA da cadeia (webhook -> processamento frontend -> armazenamento backend).
 *   - O evento `$(document.body).trigger('update_checkout');` é disparado imediatamente após o registro do listener `.one()`, garantindo que este listener específico capture o `updated_checkout` resultante DO NOSSO fluxo.
 *   - Removido o registro antecipado do listener `.one()` do handler de clique inicial.
 *   - As funções `consultarCepEFrete` e `armazenarDadosNoServidor` foram ajustadas para retornar Promises que se encadeiam corretamente e reportam o sucesso/falha do fluxo.
 *   - A limpeza do estado de processamento e a re-habilitação do botão "Avançar" (CEP) são agora controladas pelo `.then()`/`.catch()` da cadeia principal no handler de clique, ou pelo listener `.one()` em caso de sucesso e avanço.
 *
 * Atualizações na versão 3.1.9:
 * - Hotfix: Corrige visibilidade das abas forçando display:block no container das abas e display:none apenas na aba não ativa via CSS, contornando conflitos com plugins ou temas.
 * - Adicionado painel de debug no front-end (visível com CC_DEBUG=true).
 * - Adicionado botão para copiar logs do painel de debug.
 * - Melhoria nos logs de performance e eventos.
 *
 * Atualizações na versão 3.1.8:
 * - Oculta automaticamente modalidades de frete cujo valor retornado pelo webhook seja vazio, nulo ou <= 0.
 * - Ajustado o margin-top do contêiner .place-order para 20 px em desktop, igualando a distância entre “Finalizar pedido” e “Voltar” às demais abas.
 *
 * Atualizações na versão 3.1.7:
 * - Bloco de cupom original (.woocommerce-info.woocommerce-coupon-message e .checkout_coupon) reposicionado para a aba Pagamento (sem duplicar HTML).
 * - Elementos nativos de cupom ocultados via CSS global para evitar duas versões.
 * - Bloco de total duplicado agora reinserido automaticamente após cada atualização de #payment, garantindo exibição acima do botão Finalizar Pedido.
 *
 * Atualizações na versão 3.1.6:
 * - Cupom original reposicionado para a aba Pagamento (sem duplicar HTML). (Re-refatorado em 3.1.7)
 * - Adicionado resumo de Total (label + valor) acima do botão Finalizar pedido, com divisor estético. (Refatorado em 3.1.7 para persistir após fragmentos)
 *
 * Atualizações na versão 3.1.5:
 * - Adicionada caixa de cupom custom (.e-coupon-box) na aba Pagamento, logo após order_comments_field. (Revertido em 3.1.6/3.1.7)
 * - Removido link padrão .showcoupon; interação passa a ser controlada por .e-show-coupon-form. (Revertido parcialmente em 3.1.6/3.1.7 para usar elementos padrão)
 * - Lógica aprimorada na função `processarDadosEnderecoFrete` para limpar individualmente apenas os campos de endereço vazios recebidos do webhook, preservando dados já preenchidos nos campos que não vieram na resposta.
 * - Correção: Ajustes no CSS e remoção de JS que movia o contêiner `.place-order` para garantir que o botão "Finalizar pedido" permaneça dentro da seção `#payment`, posicionado acima do botão "Voltar" em mobile via CSS, mantendo 100% de largura e estilo.
 *
 * Atualizações na versão 3.1.3:
 * - Melhoria: Lógica aprimorada na função `processarDadosEnderecoFrete` para limpar individualmente apenas os campos de endereço vazios recebidos do webhook, preservando dados já preenchidos nos campos que não vieram na resposta. (Implementação movida para 3.1.5)
 * - Correção: Ajustes no CSS e remoção de JS que movia o contêiner `.place_order` para garantir que o botão "Finalizar pedido" permaneça dentro da seção `#payment`, posicionado acima do botão "Voltar" em mobile via CSS, mantendo 100% de largura e estilo. (Implementação movida para 3.1.5)
 *
 * Atualizações na versão 3.1.2:
 * - Correção: Posicionamento do formulário de cupom (.checkout_coupon) e link (.showcoupon) na aba Pagamento, garantindo o anchor antes da seção #payment.
 * - Correção: Movimentação do bloco de notas do pedido (.woocommerce-additional-fields__field-wrapper) para a aba Pagamento, posicionado antes do cupom.
 * - Correção: Reposicionamento do contêiner do botão "Finalizar pedido" (.place_order) para dentro do contêiner de botões da aba Pagamento, acima do botão "Voltar" em mobile, mantendo estilo e largura.
 * - Correção: Lógica na consulta de CEP para limpar campos de endereço se a resposta do webhook vier incompleta (sem logradouro, bairro, cidade ou uf), evitando manter dados antigos.
 * - Melhoria: Robustez na aplicação de fragments após atualização de frete/totais, re-posicionando elementos na aba Pagamento se necessário.
 * - Melhoria: Logs de debug aprimorados para rastrear melhor o fluxo de atualização.
 *
 * Atualizações na versão 3.1.1:
 * - Correção: Corrigido uso incorreto de `.val().val()` na validação do campo de estado.
 * - Correção: Garantida a remoção da classe `cep-loading` após a consulta do CEP em todos os fluxos (sucesso, falha, complete da requisição).
 * - Correção: Lógica de leitura da flag `success` na resposta AJAX do backend store_webhook_shipping aprimorada para considerar `undefined` como `true`.
 * - Correção: O link "Clique aqui para inserir seu código" (.showcoupon) foi movido para a aba "Pagamento", posicionado antes da seção de métodos de pagamento (#payment), conforme solicitação (apesar da referência original a .e-checkout__order_review-2 ser ambígua e não implementada diretamente, pois esse elemento é geralmente parte do resumo na aba anterior).
 * - Adicionada quinta aba "Pagamento".
 * - O formulário de cupom e a seção de métodos de pagamento do WooCommerce
 *   são movidos para a nova aba "Pagamento".
 * - A navegação foi ajustada para 5 abas.
 * - A barra de progresso foi ajustada para 5 passos.
 * - O botão de navegação da aba Endereço foi alterado para "Avançar para o Resumo".
 * - O botão de navegação da aba Resumo/Frete foi alterado para "Avançar para o Pagamento".
 * - Adicionado botão "Voltar" na aba Pagamento.
 * - Ajustada a ordem dos botões de navegação nas abas para ter Avançar/Próximo em cima e Voltar embaixo.
 * - O botão padrão do WooCommerce `#place_order` agora é gerenciado para ser visível
 *   e habilitado apenas na última aba "Pagamento", quando um total válido existir E um método de pagamento estiver selecionado (comportamento padrão do WC).
 * - Removidas regras CSS conflitantes para cores dos preços de frete (já no template review-order.php).
 * - Mantidas otimizações de performance, logs e correções de versões anteriores.
 */

// Registra script para checkout com parâmetros localizados
function enqueue_checkout_scripts() {
    if (is_checkout() && !is_wc_endpoint_url()) {

        // Adicionar DEBUG toggle (v3.1.9)
        if ( ! defined( 'CC_DEBUG' ) ) {
            define( 'CC_DEBUG', false ); // ← mudo para true quando quiser ver logs
        }

        // WC-checkout já carrega jquery. Incluir wc-checkout para garantir eventos.
        wp_register_script('child-checkout', '', ['jquery', 'wc-checkout'], null, true);
        wp_localize_script('child-checkout', 'cc_params', [
            'debug'      => CC_DEBUG,      // <-- nova chave DEBUG
            'ajax_url'   => admin_url('admin-ajax.php'),
            'nonce'      => wp_create_nonce('store_webhook_shipping'),
            'webhook_url'=> 'https://webhook.cubensisstore.com.br/webhook/consulta-frete'
        ]);
        wp_enqueue_script('child-checkout');

        // Adicionar script de máscara, se não for carregado por outro plugin
        // Verifica se já existe script jquery-mask ou jquery.mask.min.js enfileirado
         if (!wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery-mask.min', 'enqueued') && !wp_script_is('jquery-maskmoney', 'enqueued')) {
             wp_enqueue_script('jquery-mask', '//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js', ['jquery'], '1.14.16', true);
         } else {
             // Se jquery-maskmoney está carregado, pode não ter máscara para telefone/CEP
             if (wp_script_is('jquery-maskmoney', 'enqueued') && !wp_script_is('jquery-mask', 'enqueued') && !wp_script_is('jquery.mask.min', 'enqueued')) {
                  wp_enqueue_script('jquery-mask', '//cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js', ['jquery'], '1.14.16', true);
             }
         }
    }
}
add_action('wp_enqueue_scripts', 'enqueue_checkout_scripts');

// Endpoint AJAX para salvar na sessão do WooCommerce e retornar fragments
add_action('wp_ajax_store_webhook_shipping', 'store_webhook_shipping');
add_action('wp_ajax_nopriv_store_webhook_shipping', 'store_webhook_shipping');
function store_webhook_shipping() {
    $t1 = microtime(true);
    $initial_memory = memory_get_peak_usage();

    // Verificar nonce para segurança
    check_ajax_referer('store_webhook_shipping', 'security');

    // Definir DEBUG no backend para logs
    $is_debug_enabled = defined('CC_DEBUG') && CC_DEBUG;
    if ($is_debug_enabled) {
         error_log('[SWHS DEBUG] DEBUG MODE IS ACTIVE.');
    }


    $fragments = [];
    $data_processed_successfully = false; // Indica se a data de entrada foi válida e processada (não se o recálculo aconteceu)
    $recalculated = false;

    if (!empty($_POST['shipping_data'])) {
        $data = json_decode(wp_unslash($_POST['shipping_data']), true);

        if (is_array($data)) {
            $data_processed_successfully = true; // Data de entrada é um array válido
            $existing_data = WC()->session->get('webhook_shipping');

            // Otimização A2: Comparar dados recebidos com os dados já na sessão.
            // Se forem idênticos, pular recálculo custoso, mas ainda gerar fragments.
            // Usar json_encode para comparação profunda confiável.
            if (json_encode($existing_data) !== json_encode($data)) {
                 if ($is_debug_enabled) error_log('[SWHS DEBUG] Nova data recebida, recalculando WC. Memória inicial: ' . size_format($initial_memory));
                 WC()->session->set('webhook_shipping', $data);

                 // Força WooCommerce a refazer as shipping rates (aciona o filtro)
                 WC()->cart->calculate_shipping();

                 // Agora recalcula tudo (subtotal+frete+impostos)
                 WC()->cart->calculate_totals();

                 // Persiste na sessão (o calculate_totals já deve fazer isso, mas garantir não custa)
                 if (method_exists(WC()->cart, 'set_session')) {
                     WC()->cart->set_session();
                 }
                 $recalculated = true;
                 if ($is_debug_enabled) error_log('[SWHS DEBUG] Recálculo WC concluído.');

             } else {
                 if ($is_debug_enabled) error_log('[SWHS DEBUG] Dados idênticos aos da sessão. Pulando recálculo.');
             }

            // A3: Retornar os fragments de revisão de pedido diretamente
            // WC_AJAX::get_refreshed_fragments() já retorna a estrutura { fragments: {...}, cart_hash: '...' }
            if ( class_exists( 'WC_AJAX' ) && method_exists( 'WC_AJAX', 'get_refreshed_fragments' ) ) {
                 if ($is_debug_enabled) error_log('[SWHS DEBUG] Gerando fragments.');
                 $fragments_data = WC_AJAX::get_refreshed_fragments();
                 // Ensure data is an array or object before accessing fragments
                 $fragments_data = is_array($fragments_data) || is_object($fragments_data) ? $fragments_data : [];
                 $fragments  = isset( $fragments_data['fragments'] ) ? $fragments_data['fragments'] : [];
                 $cart_hash = isset( $fragments_data['cart_hash'] ) ? $fragments_data['cart_hash'] : (WC()->cart ? WC()->cart->get_cart_hash() : '');
                 $wc_ajax_url = isset( $fragments_data['wc_ajax_url'] ) ? $fragments_data['wc_ajax_url'] : (class_exists('WC_AJAX') ? WC_AJAX::get_endpoint( "%%endpoint%%" ) : '');

                 // Retornar a estrutura esperada pelo JS e pelo WC_AJAX handler padrão (fallback)
                 $response_data = $fragments_data;

                 if ($is_debug_enabled) error_log('[SWHS DEBUG] Fragments gerados.');
            } else {
                 if ($is_debug_enabled) error_log('[SWHS DEBUG] WC_AJAX ou get_refreshed_fragments não disponível.');
                 // Retorna uma estrutura compatível mesmo sem fragments
                 $response_data = [
                     'fragments' => [],
                     'cart_hash' => WC()->cart ? WC()->cart->get_cart_hash() : '',
                     'wc_ajax_url' => class_exists('WC_AJAX') ? WC_AJAX::get_endpoint( "%%endpoint%%" ) : ''
                 ];
            }
        } else {
             if ($is_debug_enabled) error_log('[SWHS ERROR] Dados recebidos não são um array válido.');
             // Retorna error se os dados de entrada são inválidos
             wp_send_json_error(['message' => 'Dados de frete inválidos na entrada.']);
        }
    } else {
        if ($is_debug_enabled) error_log('[SWHS ERROR] shipping_data vazio na requisição AJAX.');
         // Retorna error se os dados de entrada estão vazios
        wp_send_json_error(['message' => 'Dados de frete vazios na entrada.']);
    }

    $t2 = microtime(true);
    $peak_memory = memory_get_peak_usage();
    $cart_item_count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
    $chosen_methods_raw = WC()->session->get('chosen_shipping_methods');
    $chosen_method_log = is_array($chosen_methods_raw) ? implode(',', $chosen_methods_raw) : 'none';


    // Log extra (Item 1 extra)
    if ($is_debug_enabled) error_log('[SWHS] chosen='. maybe_serialize($chosen_methods_raw) . ' Rates available: ' . count(WC()->cart->get_shipping_packages())); // Count packages instead of rates

    // Definir cabeçalhos de debug (Item B3, Item 5 Backend) - Sempre adicionar cabeçalhos se possível
    header('X-StoreWebhook: store_webhook_shipping');
    header('X-Exec-Time: ' . sprintf('%.3f', ($t2 - $t1)) . 's');
    header('X-Peak-Memory: ' . size_format($peak_memory));
    header('X-Cart-Items: ' . $cart_item_count);
    header('X-Recalculated: ' . ($recalculated ? 'yes' : 'no'));
    header('X-Chosen-Method: ' . $chosen_method_log);
    header('X-CC-Debug: ' . ($is_debug_enabled ? 'true' : 'false')); // Adicionar cabeçalho para debug state

    // Retornar sucesso com os dados de fragments (Item A3)
    // Apenas retornamos sucesso se os dados de entrada foram válidos e processados inicialmente.
    if ($data_processed_successfully) {
        wp_send_json_success( $response_data );
    } else {
        // Este caso já foi tratado acima com wp_send_json_error, mas como fallback:
         wp_send_json_error(['message' => 'Falha no processamento dos dados de frete no backend.']);
    }
}

// Filtro para injetar as taxas no front-end do WooCommerce - prioridade alta (999)
add_filter('woocommerce_package_rates', 'override_shipping_rates_with_webhook', 999, 2);
function override_shipping_rates_with_webhook($rates, $package) {
    $is_debug_enabled = defined('CC_DEBUG') && CC_DEBUG;
    // if ($is_debug_enabled) error_log('[DEBUG] Aplicando override_shipping_rates_with_webhook.'); // Log em cada aplicação
    $web = WC()->session->get('webhook_shipping');
    if (is_array($web)) {
        // if ($is_debug_enabled) error_log('[DEBUG] Dados do webhook_shipping encontrados na sessão.');

        // Não é necessário clonar, o array $rates já é uma cópia que podemos modificar

        foreach ($rates as $rate_id => $rate) {
            $rate_identifier = $rate->get_method_id() . ':' . $rate->get_instance_id();

            switch ($rate_identifier) {
                case 'flat_rate:1': // Assumindo flat_rate:1 é o PAC MINI
                    $valor = $web['fretePACMini']['valor'] ?? '';
                    // TAREFA 1 (v3.1.8): Ocultar se valor for vazio, nulo, não numérico ou <= 0
                    if ( empty( $valor ) || ! is_numeric( $valor ) || floatval( $valor ) <= 0 ) {
                        if ($is_debug_enabled) error_log('[DEBUG] Removendo flat_rate:1 (PAC Mini) devido a valor inválido: ' . ($valor === '' ? 'empty' : ($valor === null ? 'null' : $valor)));
                       // unset( $rates[ $rate_id ] ); //
                    } else {
                        $rate->set_cost( floatval( $valor ) );
                        // if ($is_debug_enabled) error_log('[DEBUG] Atualizado flat_rate:1 (PAC Mini) para ' . $valor);
                    }
                    break;

                case 'flat_rate:5': // SEDEX
                    $valor = $web['freteSedex']['valor'] ?? '';
                     // TAREFA 1 (v3.1.8): Ocultar se valor for vazio, nulo, não numérico ou <= 0
                    if ( empty( $valor ) || ! is_numeric( $valor ) || floatval( $valor ) <= 0 ) {
                         if ($is_debug_enabled) error_log('[DEBUG] Removendo flat_rate:5 (SEDEX) devido a valor inválido: ' . ($valor === '' ? 'empty' : ($valor === null ? 'null' : $valor)));
                        unset( $rates[ $rate_id ] );
                    } else {
                        $rate->set_cost( floatval( $valor ) );
                         // if ($is_debug_enabled) error_log('[DEBUG] Atualizado flat_rate:5 (SEDEX) para ' . $valor);
                    }
                    break;

                case 'flat_rate:3': // Motoboy
                    $valor = $web['freteMotoboy']['valor'] ?? '';
                     // TAREFA 1 (v3.1.8): Ocultar se valor for vazio, nulo, não numérico ou <= 0
                    if ( empty( $valor ) || ! is_numeric( $valor ) || floatval( $valor ) <= 0 ) {
                         if ($is_debug_enabled) error_log('[DEBUG] Removendo flat_rate:3 (Motoboy) devido a valor inválido: ' . ($valor === '' ? 'empty' : ($valor === null ? 'null' : $valor)));
                        unset( $rates[ $rate_id ] );
                    } else {
                         $rate->set_cost( floatval( $valor ) );
                         // if ($is_debug_enabled) error_log('[DEBUG] Atualizado flat_rate:3 (Motoboy) para ' . $valor);
                    }
                    break;
                // Adicione outros cases conforme necessário para outros métodos
            }
        }
         // if ($is_debug_enabled) error_log('[DEBUG] Finalizado override_shipping_rates_with_webhook.');
         return $rates;

    } else {
         // if ($is_debug_enabled) error_log('[DEBUG] webhook_shipping não encontrado na sessão, retornando taxas originais.');
         return $rates; // Retorna as taxas originais se não houver dados do webhook na sessão
    }
}

function custom_checkout_assets() {
    if (is_checkout() && !is_wc_endpoint_url()) :
    ?>
    <style>
        /* =============================
           Estilização das Opções de Frete
           (Mantido o estilo do contêiner e itens, mas cores do preço são do template)
        ============================== */
        #shipping_method li,
        .woocommerce-shipping-methods li,
        .e-checkout__shipping-methods li {
            background: #F9FAFA;
            border-radius: 4px;
            margin-bottom: 10px;
            padding: 10px;
            cursor: pointer;
            transition: background 0.3s;
        }
        #shipping_method li.active,
        #shipping_method li.selected, /* Adicionado selected para compatibilidade */
        .woocommerce-shipping-methods li.active,
        .woocommerce-shipping-methods li.selected,
        .e-checkout__shipping-methods li.active,
        .e-checkout__shipping-methods li.selected {
            color: #000;
            /* Opcional: borda ou fundo diferente para destacar o selecionado */
            border: 1px solid #0075FF;
            background-color: #E2EDFB;
        }


        /* =============================
           Estilização das Abas do Checkout
        ============================== */
        .checkout-tab {
            display: none;
        }
        .checkout-tab.active {
            display: block;
        }

        /* Esconde o formulário de checkout original e a seção de revisão do pedido, pagamentos, cupons */
        /* O conteúdo será movido para as abas pelo JavaScript */
        /* form.checkout:not(.processed) > .col2-set,
        form.checkout:not(.processed) > #order_review_heading,
        form.checkout:not(.processed) > #order_review,
        form.checkout:not(.processed) > .checkout_coupon, /* Esconde container de cupom */
        form.checkout:not(.processed) > #payment, /* Esconde seção de pagamento */
         form.checkout:not(.processed) > #payment_heading, /* Esconde título de pagamento */
         form.checkout:not(.processed) > .woocommerce-additional-fields /* Esconde order notes */ {
             display: none !important;
        } */


        /* Botão de Finalizar Pedido do WooCommerce */
         /* TAREFA 2 (v3.1.3): Oculta o contêiner .place-order nas abas que NÃO são a de pagamento */
         .checkout-tab:not(#tab-pagamento) .place-order{
            display:none!important;
         }

         /* TAREFA 2 (v3.1.3) / TAREFA 2 (v3.1.8): Estilo específico para o contêiner PLACE ORDER dentro da seção #payment */
         /* NOTA: Agora que ele fica DENTRO do #payment, o JS não move mais. */
         /* A visibilidade é controlada pela regra acima e pelo display:block padrão do #payment */
         #tab-pagamento #payment .place-order {
             display: block !important; /* Ensure it's visible when #payment is visible */
             width: 100%; /* Make the container 100% width */
             /* TAREFA 2 (v3.1.8): Espaço entre o botão Finalizar e o botão Voltar */
             margin-top: 20px;
             margin-bottom: 0; /* Margin controlled by parent (.tab-buttons) in mobile */
        }
         /* TAREFA 2 (v3.1.8): Ajuste de margem em mobile */
         @media (max-width:768px){
             #tab-pagamento #payment .place-order{
                 margin-top:0;
                 margin-bottom:0;
             }
         }


        /* TAREFA 2 (v3.1.3): Estilo específico para o botão #place_order dentro do contêiner .place-order */
        /* Mantendo estilos do checkout-next-btn */
        #tab-pagamento #payment .place-order #place_order {
             padding: 10px 20px;
             background: #0075FF;
             color: #fff;
             border: none;
             cursor: pointer;
             font-weight: 500;
             border-radius: 3px !important;
             width: 100%; /* Button inside 100% container */
             text-align: center;
        }
         #tab-pagamento #payment .place-order #place_order:hover:not(:disabled) {
             background: #005BC7;
         }
          #tab-pagamento #payment .place-order #place_order:disabled {
             background-color: #cccccc !important; /* Cor mais clara quando desabilitado */
             cursor: not-allowed !important;
             opacity: 0.7;
         }
         /* Garantir que a cor do texto do PLACE ORDER disabled não seja afetada por outras regras */
         #tab-pagamento #payment .place-order #place_order:disabled span {
              color: #fff !important; /* Mantém o texto branco no botão desabilitado */
         }

        /* Forçar arredondamento em todos os botões de navegação das abas */
        .checkout-next-btn, .checkout-back-btn {
            border-radius: 3px !important;
        }

        /* Botão Avançar */
        .checkout-next-btn {
            margin-top: 20px;
            padding: 10px 20px;
            background: #0075FF;
            color: #fff;
            border: none;
            cursor: pointer;
            font-weight: 500;
        }
        .checkout-next-btn:hover:not(:disabled) {
            background: #005BC7;
        }
        /* Botão desabilitado */
         .checkout-next-btn:disabled {
             background-color: #cccccc !important; /* Cor mais clara quando desabilitado */
             cursor: not-allowed !important;
             opacity: 0.7;
         }
         /* Garantir que a cor do texto do NEXT disabled não seja afetada por outras regras */
         .checkout-next-btn:disabled span {
              color: #fff !important; /* Mantém o texto branco no botão desabilitado */
         }


        /* Botão Voltar - com cor de texto #005BC7 e background #E2EDFB */
        .checkout-back-btn {
            background: #E2EDFB;
            color: #005BC7 !important; /* Define a COR DO TEXTO para #005BC7 */
            font-weight: 500;
            margin-right: 10px;
            padding: 10px 20px;
            border: none;
            cursor: pointer;
             /* Remover margin-top para ser controlado pelo .tab-buttons */
            margin-top: 0;
        }
        .checkout-back-btn:hover:not(:disabled) {
            background: #9DCAFF;
        }

        /* Responsividade dos botões de navegação das abas - AJUSTADO PARA TAREFA 2 v3.1.3 */
        @media (max-width: 768px) {
             /* Buttons get full width */
             .checkout-next-btn, .checkout-back-btn {
                 width: 100%;
                 margin-right: 0;
             }
             /* The .place-order container within #payment also gets full width via the rule above */


             /* Stack buttons in vertical column on mobile */
             .tab-buttons {
                  display: flex; /* Ensure flex is applied */
                  flex-direction: column;
                  align-items: flex-start; /* Align buttons to the left when stacked */
                  padding: 0; /* Remove extra side padding on mobile */
                  width: 100%; /* Ensure container is full width */
                  margin-top: 20px; /* Space above the back button */
             }


             /* Apply flexbox to the main tab content area for mobile stacking */
             /* This allows controlling the order of major blocks like #payment and .tab-buttons */
             #tab-dados-pessoais, #tab-cep, #tab-dados-entrega, #tab-resumo-frete, #tab-pagamento {
                 display: flex;
                 flex-direction: column;
                 /* Default order is source order unless specified */
             }

             /* Visual ordering in mobile for tabs (buttons/elements stacked) */
             /* Keep default source order for elements within tabs, EXCEPT for the final tab where we want Place Order above Back */

             /* In Pagamento tab, explicitly order main blocks */
             #tab-pagamento .woocommerce-additional-fields__field-wrapper, /* Order Notes */
             #tab-pagamento .woocommerce-info.woocommerce-coupon-message, /* Coupon Message Link Container */
             #tab-pagamento .checkout_coupon, /* Coupon Form */
             #tab-pagamento #payment /* TAREFA 2 (v3.1.6/3.1.7) #payment now includes total dup and place order */ {
                 order: 0; /* Ensure these come before the custom tab buttons */
             }

             #tab-pagamento .tab-buttons {
                  order: 1; /* Place the back button container second */
                  margin-top: 0; /* Space handled by elements above */
             }

             /* Order within the #payment block itself (Payment Methods vs Total Dup vs Place Order) */
             /* The .payment-total-dup and .place-order are now injected/kept inside #payment */
             #tab-pagamento #payment {
                  display: flex;
                  flex-direction: column;
             }
             #tab-pagamento #payment .payment_methods { /* Payment methods list */
                  order: 0; /* Show payment methods first */
                  margin-bottom: 20px; /* Space before total/button */
             }
             #tab-pagamento #payment .payment-total-dup { /* TAREFA 2 (v3.1.6/3.1.7) Duplicate Total */
                 order: 1; /* Show total before place order */
                 margin-bottom: 10px; /* Space before button */
                 margin-top: 0; /* Reset default margin */
             }
             #tab-pagamento #payment .place-order { /* Place Order container */
                  order: 2; /* Show place order button second (above back button) */
                  margin-bottom: 0; /* Space handled by tab-buttons margin-top */
                  margin-top: 0; /* Reset default margin */
             }


              /* Other direct children of #tab-pagamento (h3, progress) */
              /* They will default to order: 0 and appear before other blocks */
             #tab-pagamento h3,
             #tab-pagamento .progress-container {
                 order: 0; /* Ensure they appear before other blocks */
             }

        } /* End of media query */


        /* =============================
           Ocultar campos específicos (mantido)
        ============================== */
        #billing_persontype_field,
        .person-type-field.thwcfd-optional.thwcfd-field-wrapper.thwcfd-field-select.is-active {
            display: none !important;
        }
        #billing_country_field,
        .thwcfd-field-country {
            display: none !important;
        }
         /* Esconder títulos originais (mantido) */
        #order_review_heading,
         #payment_heading {
             display: none !important;
        }


        /* =============================
           Barra de Progresso (verde #33E480) - Ajustado para 5 passos
           (MANTIDA POR COMPATIBILIDADE, MAS OCULTADA PELO OVERLAY CSS)
        ============================== */
        .progress-container {
            position: relative;
            width: 100%;
            height: 3px;
            background-color: #e0e0e0;
            border-radius: 4px;
            margin-top: 5px;
             margin-bottom: 20px; /* Espaço abaixo da barra */
        }
        .progress-bar {
            height: 100%;
            background-color: #33E480;
            border-radius: 4px;
            width: 0%;
            transition: width 0.3s ease-in-out; /* Animação da barra */
        }
        .progress-indicator {
            position: absolute;
            top: -4px;
            width: 11px;
            height: 11px;
            background-color: #33E480;
            border-radius: 50%;
            transform: translateX(-50%);
             transition: left 0.3s ease-in-out; /* Animação do indicador */
        }

        /* =============================
           Notificação de WhatsApp inválido (mantido)
        ============================== */
        .whatsapp-invalido {
            color: #e63946;
            font-size: 14px;
            margin-top: 10px;
            margin-bottom: 10px;
            display: none;
            padding: 8px;
            background-color: #fff8f8;
            border-left: 3px solid #e63946;
            border-radius: 3px;
        }

        /* Prazo de entrega (mantido) */
        .prazo-entrega {
            display: block;
            color: #005BC7;
            font-size: 13px;
            margin-top: 5px;
            font-weight: normal;
        }

        /* Estilo para destacar as atualizações de frete (mantido) */
        .frete-atualizado {
            animation: highlight 1.5s ease-in-out;
        }

        @keyframes highlight {
            0% { background-color: #fdf2b3; }
            100% { background-color: transparent; }
        }

        /* =============================
           Painel de carregamento de frete original (mantido, mas ocultado pelo overlay CSS)
        ============================== */
        .frete-loading {
             /* display: none !important; */ /* <-- Já declarado no CSS do Overlay abaixo */
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: #f5f5f5;
            z-index: 9999; /* Z-index alto */
            overflow: hidden;
             display: none; /* Inicialmente oculto */
        }

        .frete-loading::after {
            content: "";
            position: absolute;
            left: -50%;
            width: 50%;
            height: 100%;
            background-color: #0075FF;
            animation: loading 1.5s infinite ease-in-out;
        }

        @keyframes loading {
            0% { left: -50%; }
            100% { left: 150%; }
        }


        /* =============================
           overlay com blur + spinner (NOVO - v3.1.11) (AJUSTADO v3.1.12)
        ============================== */
        /* Remove position relative do form para o overlay cobrir a viewport */
        form.checkout {
           position: static; /* Ou remove a regra de position se não for necessária para outros motivos */
        }

        .checkout-loading-overlay {
          position: fixed !important; /* Cobre toda a viewport */
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important; /* Garante largura total da viewport */
          height: 100vh !important; /* Garante altura total da viewport */
          background: rgba(0,0,0,0.2) !important; /* Fundo semi-transparente */
          backdrop-filter: blur(4px) !important; /* Blur aumentado para 4px */
          -webkit-backdrop-filter: blur(4px) !important; /* Compatibilidade Safari */
          display: none; /* Inicialmente oculto (JS mudará para flex) */
          align-items: center; /* Centraliza verticalmente (flex) */
          justify-content: center; /* Centraliza horizontalmente (flex) */
          z-index: 10000; /* Fica acima da maioria dos elementos */
           /* Ocultar a barrinha original quando o overlay estiver ativo */
           &.active + .frete-loading { /* NÃO USE 'active', o display é controlado direto */
              display: none !important;
           }
        }

        .checkout-loading-overlay .spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  /* removemos o translate daqui, pois já vamos controlar dentro do keyframe */
  border: 4px solid rgba(255,255,255,0.6);
  border-top: 4px solid #0075FF;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  transform-origin: center center;
  animation: spin 1s linear infinite;
}

/* Animação de rotação do spinner, mantendo o translate fixo */
@keyframes spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

        /* opcional: esconda a barrinha original */
        /* JÁ DEFINIDO NO CSS DO OVERLAY */
        .frete-loading { display: none !important; }


        /* Debug Panel (v3.1.9) - Adicionado */
        #debug-panel-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999; /* Abaixo do overlay de loading principal */
            background: #ff5722;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 14px;
            font-family: sans-serif; /* Use a fonte padrão do sistema */
        }

        #debug-panel {
            position: fixed;
            bottom: 70px;
            right: 20px;
            width: 80%;
            max-width: 600px;
            height: 400px;
            background: white;
            z-index: 9999; /* Abaixo do overlay de loading principal */
            display: none;
            overflow: auto;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            border: 1px solid #ddd;
            font-family: sans-serif; /* Use a fonte padrão do sistema */
        }

        #debug-log-content {
            background: #f5f5f5;
            padding: 10px;
            border: 1px solid #ddd;
            height: 300px;
            overflow: auto;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.4;
             white-space: pre-wrap; /* Wrap text in log content */
            word-wrap: break-word;
        }

        /* Botão de fechar painel de debug (v3.1.9) - Adicionado */
        #debug-panel-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            font-size: 18px;
            color: #000;
            cursor: pointer;
        }


        /* Aba CEP estilização (mantido) */
        #tab-cep {
            padding: 15px 0;
        }

        /* CEP digitado carregando (mantido) */
        .cep-loading {
            opacity: 0.6;
            pointer-events: none;
        }

        /* Mensagem de erro de CEP (mantido) */
        .cep-erro {
            color: #e63946;
            font-size: 14px;
            margin-top: 5px;
            display: none;
        }

        /* Desabilitar botão durante processamento (mantido) */
        .btn-processing {
            opacity: 0.7;
            cursor: not-allowed !important;
            pointer-events: none;
        }

        /* Field CEP destaque - 100% de largura (mantido) */
        #tab-cep #billing_postcode_field {
            width: 100%;
            max-width: none;
            margin: 15px auto;
        }

        #tab-cep #billing_postcode,
        #tab-cep #billing_postcode_field .woocommerce-input-wrapper {
            width: 100% !important;
        }

        /* Título do CEP (mantido) */
        .cep-title {
            text-align: center;
            margin-bottom: 20px;
        }

        /* Descrição do CEP (mantido) */
        .cep-description {
            text-align: center;
            font-size: 14px;
            margin-bottom: 20px;
            color: #555;
        }

        /* Cursor de progresso para corpo (mantido) */
        body.processing {
            cursor: progress;
        }

        /* Ajustes para a tabela de revisão do pedido dentro da aba (mantido) */
         #tab-resumo-frete #order_review {
             margin-top: 20px; /* Espaço entre o título da aba e a tabela */
         }
          #tab-resumo-frete #order_review_heading {
               /* O título original já está escondido globalmente */
               display: none;
          }

         /* TAREFA 3 (v3.1.7): Ocultar elementos nativos de cupom fora da aba Pagamento */
         .woocommerce-info.woocommerce-coupon-message,
         .checkout_coupon{
             display: none !important;
         }
         /* TAREFA 1 (v3.1.7): Garantir que o .e-coupon-box custom esteja visível na aba Pagamento */
         #tab-pagamento .e-coupon-box {
            display: block !important; /* Override global hidden */
         }


        /* TAREFA 1 (v3.1.6): REMOVIDAS regras de Caixa de cupom custom */
        /* TAREFA 2 (v3.1.6): Resumo de Total duplicado */
        .payment-total-dup{
             margin-top: 20px ; /* Espaço antes do bloco total */
             margin-bottom: 20px; /* Espaço após o bloco total */
        }
        .payment-total-divider{
            border:0;
            height:2px;
            background:#979797 !important;
            margin:10px 0;
			
        }
        .payment-total-row{
            display:flex;
            justify-content:space-between;
            font-weight:600;
            font-size:16px;
            margin-bottom:10px;
        }

         /* --- HOTFIX (v3.1.9): faz as abas reaparecerem ------------------- */
         /* Isso contorna o display:none !important no form.checkout > div gerado por alguns plugins/temas */
         body.woocommerce-checkout form.checkout .checkout-tab{
             display:block;          /* garante que fiquem visíveis               */
         }

         body.woocommerce-checkout form.checkout .checkout-tab:not(.active){
             display:none;           /* mas só a aba corrente permanece exibida   */
         }
         /* -------------------------------------------------------- */

         /* ==============================
   CORREÇÃO POSICIONAMENTO BOTÕES
   ============================== */
/* Forçar os botões a ficarem sempre abaixo do campo e com 30px de distância */
.tab-buttons {
  display: block !important;
  width: 100% !important;
  margin-top: 30px !important;
}

/* ======= Desktop ======= */
@media (min-width: 769px) {
  /* Empilha os botões, 100% largura e 10px de gap */
  .tab-buttons {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }
  .tab-buttons .checkout-next-btn,
  .tab-buttons .checkout-back-btn {
    width: 100% !important;
  }
  /* Ordem: Avançar em cima, Voltar embaixo (pela ordem no HTML) */
}

/* ======= Mobile (cupom) ======= */
@media (max-width: 768px) {
  /* Mantém input e botão do cupom na mesma linha, sem wrap, com 10px de gap */
  #tab-pagamento .checkout_coupon {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 10px !important;
    align-items: center !important;
  }
  #tab-pagamento .checkout_coupon input#coupon_code {
    flex: 1 1 auto !important;
    width: auto !important;
  }
  #tab-pagamento .checkout_coupon .button {
    flex: 0 0 auto !important;
    width: auto !important;
  }
}

/* ==============================
   AJUSTES ADICIONAIS
   ============================== */
/* ======= Desktop ======= */
@media (min-width: 769px) {
  /* 1) Campos nome, celular e sobrenome 100% de largura */
  #billing_first_name_field,
  #billing_cellphone_field,
  #billing_last_name_field {
    width: 100% !important;
    max-width: none !important;
  }

  /* 2) Na aba Endereço, reordena: logradouro ANTES do número */
  /* Primeiro garante que o wrapper seja flex container */
  #tab-dados-entrega .woocommerce-billing-fields__field-wrapper {
    display: flex !important;
    flex-wrap: wrap !important;
  }
  /* Então define a ordem e largura 100% para cada field */
  #tab-dados-entrega #billing_address_1_field {
    order: 1 !important;
    flex: 0 0 100% !important;
  }
  #tab-dados-entrega #billing_number_field {
    order: 2 !important;
    flex: 0 0 100% !important;
  }
}




    </style>

    <script>
    jQuery(document).ready(function($) {
        // Abas do Checkout - Versão 3.1.16
        // Configurações e variáveis globais
        var webhookUrl = cc_params.webhook_url;
        var ajaxUrl = cc_params.ajax_url;
        var nonce = cc_params.nonce;

        // DEBUG toggle (v3.1.9) - Lê a flag do PHP
        var debugMode = !!cc_params.debug; // !! converte para boolean

        // Configuração centralizada dos IDs de frete (mantida)
        var freteConfigs = {
            pacMini: {
                method_id: 'flat_rate',
                instance_id: '1',
                nome: 'PAC MINI'
            },
            sedex: {
                method_id: 'flat_rate',
                instance_id: '5',
                nome: 'SEDEX'
            },
            motoboy: {
                method_id: 'flat_rate',
                instance_id: '3',
                nome: 'Motoboy (SP)'
            }
        };

        // Flags e variáveis de estado
        var freteData = null; // Armazenar os dados retornados pelo webhook
        var consultaEmAndamento = false; // Flag para prevenir chamadas duplicadas de consulta principal (CEP)
        var clickedAvancarCep = false; // TAREFA 1 (v3.1.16): Flag para controlar overlay no clique do botão "Avançar" do CEP
        var recalcViaFrete = false; // TAREFA 4 (v3.1.16): Nova flag para diferenciar recalculos de frete

        // Variáveis de timing para logs de performance (B1)
        var actionStartTime = 0; // Tempo inicial da ação do usuário (clique no botão ou clique no frete)
        var ajaxWebhookStartTime = 0;
        var ajaxWebhookEndTime = 0;
        var ajaxStoreStartTime = 0;
        var ajaxStoreEndTime = 0;
        var ajaxWCStartTime = 0; // Para o AJAX padrão do WC update_order_review
        var ajaxWCEndTime = 0;
        var fragmentsAppliedTime = 0;
        var currentPhase = ''; // Para logs estruturados
        var cursorTimer = null; // Timer para o cursor de progress

        // Adicionar elementos de interface (mantido)
         // Ocultamos a barrinha original via CSS, mas mantemos a div no DOM por segurança,
         // caso a lógica de toggle precise dela ou para remover a regra !important no futuro.
        $('body').append('<div class="frete-loading"></div>');

         // NOVO (v3.1.11): Adiciona o overlay de loading ao formulário de checkout
         // O CSS agora o torna full-screen independente de onde está no DOM,
         // mas colocá-lo no form.checkout pode ser semanticamente útil.
         $('form.checkout').append(`
            <div class="checkout-loading-overlay">
              <div class="spinner"></div>
            </div>
         `);

        // Adicionar mensagem de error para o CEP (mantido)
        if ($('#billing_postcode_field .cep-erro').length === 0) {
            $('#billing_postcode_field').append('<div class="cep-erro">CEP não encontrado. Por favor, verifique e tente novamente.</div>');
        }

        // Melhorar a experiência mobile para o campo CEP e aplicar máscara (mantido)
        // Verificar se a máscara já foi aplicada ou se o script está disponível
        if (typeof $.fn.mask !== 'undefined') {
             $('#billing_postcode').attr({
                 'type': 'tel',
                 'inputmode': 'numeric',
                 'pattern': '[0-9]*'
             }).mask('00000-000'); // Aplicar máscara de CEP
              // Aplicar máscara de telefone/WhatsApp
             $('#billing_cellphone').mask('(00) 00000-0000'); // Exemplo para SP, ajuste conforme necessário
        } else {
            if (debugMode) log('AVISO     Plugin jQuery Mask não disponível. Máscaras não aplicadas.');
        }

        // Adicionar painel de debug se habilitado (v3.1.9)
        if (debugMode) { // <-- Wrap the debug panel creation and listeners
            $('body').append(`
                <div id="debug-panel-button">Ver Logs</div>
                <div id="debug-panel">
                    <button id="debug-panel-close">×</button>
                    <h3>Logs de Debug</h3>
                    <button id="copy-logs" style="margin-bottom: 10px;">Copiar Logs</button>
                    <button id="clear-logs" style="margin-bottom: 10px; margin-left: 10px;">Limpar</button>
                    <pre id="debug-log-content"></pre>
                </div>
            `);

            // Botão para mostrar/esconder logs
            $('#debug-panel-button').on('click', function() {
                $('#debug-panel').toggle();
            });

            // Botão para fechar o painel
            $('#debug-panel-close').on('click', function() {
                $('#debug-panel').hide();
            });

            // Botão para copiar logs
            $('#copy-logs').on('click', function() {
                const logContent = $('#debug-log-content').text();
                navigator.clipboard.writeText(logContent).then(function() {
                    alert('Logs copiados para a área de transferência!');
                });
            });

            // Botão para limpar logs
            $('#clear-logs').on('click', function() {
                $('#debug-log-content').empty();
                console.clear(); // Limpa o console do navegador também
            });
        }


        // Função para registrar logs no console e na área de debug (B1, D) (v3.1.9)
        function log(message, data = null, phase = null) {
            if (!debugMode) return; // <-- Add the debug check here

            const now = performance.now();
            const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false, second: 'numeric', fractionalSecondDigits: 3 });

            let timing_info = '';
            if (phase) {
                 currentPhase = phase; // Atualiza a fase atual para logs subsequentes sem fase
            } else {
                 phase = currentPhase; // Usa a fase atual se não especificado
            }

             // Ajusta a fase para ser mais consistente no log
             if (phase === 'AJAX_OUT_WEBHOOK') phase = 'WEBHOOK_OUT';
             if (phase === 'AJAX_IN_WEBHOOK') phase = 'WEBHOOK_IN';
             if (phase === 'AJAX_OUT_STORE') phase = 'STORE_OUT';
             if (phase === 'AJAX_IN_STORE') phase = 'STORE_IN';
             if (phase === 'AJAX_OUT_WC') phase = 'WC_OUT';
             if (phase === 'AJAX_IN_WC') phase = 'WC_IN';
             if (phase === 'FRAG_APP') phase = 'APPLY_FRAG';
             if (phase === 'FRAG_DONE') phase = 'UPDATE_DONE'; // Renomeado para clareza

            if (phase === 'WEBHOOK_IN') {
                 const deltaAjax = (ajaxWebhookEndTime > ajaxWebhookStartTime ? ajaxWebhookEndTime - ajaxWebhookStartTime : 0).toFixed(0);
                 timing_info = ` Δajax=${deltaAjax}ms`;
            } else if (phase === 'STORE_IN') {
                 const deltaAjax = (ajaxStoreEndTime > ajaxStoreStartTime ? ajaxStoreEndTime - ajaxStoreStartTime : 0).toFixed(0);
                 timing_info = ` Δajax=${deltaAjax}ms`;
            } else if (phase === 'WC_IN') {
                 const deltaAjax = (ajaxWCEndTime > ajaxWCStartTime ? ajaxWCEndTime - ajaxWCStartTime : 0).toFixed(0);
                 timing_info = ` Δajax=${deltaAjax}ms`;
            }

            if (phase === 'UPDATE_DONE' || phase === 'UI') { // Log total time when relevant UI updates happen
                 const totalTime = (performance.now() > actionStartTime ? performance.now() - actionStartTime : 0).toFixed(0);
                 timing_info = ` Total time = ${totalTime}ms`;
            }


            const logPrefix = `[${timestamp}] ${phase.padEnd(10)}`;
            const logMessage = `${logPrefix} ${message}${timing_info}`;

            console.log(logMessage);
            if (data) console.log(data);

            if ($('#debug-log-content').length) { // Only append to panel if it exists (debugMode is true)
                var logItem = document.createElement('div');
                logItem.textContent = logMessage;

                if (data) {
                    const dataText = document.createElement('pre');
                    // Usar JSON.stringify para formatar objetos/arrays, exceto strings simples
                    dataText.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                    dataText.style.marginLeft = '20px';
                    dataText.style.color = '#0066cc'; // Cor azul para dados
                    logItem.appendChild(dataText);
                }

                $('#debug-log-content').append(logItem);
                // Rolagem automática
                $('#debug-log-content').scrollTop($('#debug-log-content')[0].scrollHeight);
            }
        }

         // Helper para mostrar/esconder loading UI (C1, C2) (AJUSTADO v3.1.11 -> v3.1.12)
         function setProcessingState(isProcessing, source = 'generic') {
              log(`UI        Setando estado de processamento: ${isProcessing ? 'true' : 'false'} (Source: ${source})`);
              if (isProcessing) {
                  // Usa a função toggleLoading, que agora controla o overlay
                  toggleLoading(true);
                  $('body').addClass('processing');
                   // Limpa timer anterior antes de setar um novo
                   if(cursorTimer) clearTimeout(cursorTimer);
                   // Definir um timer para mudar o cursor para "progress" se levar > 1s
                   cursorTimer = setTimeout(function() {
                       $('body').css('cursor', 'progress');
                        log('UI         Processamento demorando > 1s, mudando cursor para progress.');
                    }, 1000);
              } else {
                   // Usa a função toggleLoading, que agora controla o overlay
                  toggleLoading(false);
                  $('body').removeClass('processing').css('cursor', ''); // Reseta o cursor
                  if(cursorTimer) {
                      clearTimeout(cursorTimer);
                      cursorTimer = null;
                  }
              }
         }

        // Função para encontrar o container de fretes (verifica múltiplos seletores) (mantido)
        // NOTA: Esta função ainda é útil para encontrar a lista UL de métodos de frete dentro do #order_review
        function getFreteContainer() {
            // Agora o container UL#shipping_method estará dentro do #order_review
            var $container = $('#tab-resumo-frete #order_review #shipping_method, #tab-resumo-frete #order_review .woocommerce-shipping-methods, #tab-resumo-frete #order_review .e-checkout__shipping-methods, #tab-resumo-frete #order_review ul.shipping_method, #tab-resumo-frete #order_review ul[data-shipping-methods]');

             if (!$container.length) {
                 log('DEBUG     Container de frete UL não encontrado dentro de #tab-resumo-frete #order_review!');
             } else {
                  log('DEBUG     Container de frete UL encontrado dentro de #tab-resumo-frete #order_review.');
             }

            return $container.first(); // Retorna o primeiro encontrado
        }

        // Função para verificar se o container de fretes está disponível (mantido)
        function isFreteContainerAvailable() {
             // Agora verificamos se o #order_review foi movido e se ele contém a lista de fretes
            var $container = $('#tab-resumo-frete #order_review');
            return $container.length > 0 && $container.find('input[name^="shipping_method"]').length > 0;
        }

        // Função para atualizar o estado do botão "Finalizar Pedido" (mantido, com ajuste para 5 abas)
        function updatePlaceOrderButtonState() {
             const $placeOrderBtn = $('#place_order');
             // Localiza o total do pedido dentro do #order_review (agora na aba 4)
             const $orderTotal = $('#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount');
             let total = $orderTotal.text().trim();
             const isLastTab = $('#tab-pagamento').hasClass('active'); // Verifica se está na última aba (Pagamento)

             log(`READY-CHECK updatePlaceOrderButtonState: Total encontrado: "${total}", Na última aba: ${isLastTab}`, null, 'READY-CHECK');

             // Verifica se o total parece válido E se está na última aba para habilitar
             const totalIsValid = total !== '' && total !== 'R$ 0,00' && total !== 'R$0,00' && !total.includes('Calcular');

             if (isLastTab && totalIsValid) {
                  // Além do total e da aba, o WC padrão verifica se um método de pagamento foi selecionado.
                  // Vamos confiar no próprio WooCommerce para habilitar/desabilitar o `#place_order`
                  // com base na seleção do método de pagamento. Nós apenas garantimos a visibilidade
                  // e desabilitamos se o total for inválido ou não estiver na aba de pagamento.
                  $placeOrderBtn.prop('disabled', false); // Habilita temporariamente para o WC gerenciar
                   log('READY-CHECK Botão "Finalizar Pedido": Permitindo gerenciamento do WC. Total válido na aba Pagamento.', null, 'READY-CHECK');
             } else {
                  $placeOrderBtn.prop('disabled', true);
                   log('READY-CHECK Botão "Finalizar Pedido" DESABILITADO (Não está na aba Pagamento ou total inválido).', null, 'READY-CHECK');
             }
             // NOTA: A lógica final de HABILITAR/DESABILITAR com base no método de pagamento
             // é feita automaticamente pelo script padrão do WooCommerce (`checkout.js`)
             // quando os fragments são atualizados e o formulário de pagamento é renderizado.
             // Nossa função aqui garante que he NÃO seja habilitado nas abas anteriores.
        }

        // Função para mostrar/esconder o indicador de carregamento (C1) (AJUSTADO v3.1.11 -> v3.1.12)
        // Esta é a função que agora controla a visibilidade do overlay principal
        function toggleLoading(show) {
            log(`UI        Chamado toggleLoading(${show ? 'true' : 'false'}).`, null, 'UI');
            // exibe/esconde a barrinha (se ainda quiser manter - CSS já a esconde)
            // Utilizamos .css('display', ...) com '!important' no CSS para garantir a ocultação.
            $('.frete-loading').toggle(show); // Mantido por compatibilidade JS, mas ineficaz devido ao CSS !important

            // exibe/esconde agora o overlay com blur e spinner, forçando display: flex/none
            if (show) {
                 $('.checkout-loading-overlay').css('display', 'flex');
                 log('UI        Overlay de loading exibido (display: flex).', null, 'UI');
            } else {
                 $('.checkout-loading-overlay').css('display', 'none');
                 log('UI        Overlay de loading ocultado (display: none).', null, 'UI');
            }
        }


        /*** 1. ORGANIZAÇÃO EM ABAS ***/

        // NOTA: A criação das divs das abas (tab-dados-pessoais, tab-cep, etc.) e
        // a movimentação dos campos de faturamento para as abas está correta na versão anterior.
        // Apenas adicionaremos a aba de Pagamento e ajustaremos a movimentação do cupom e pagamento.

        var dadosPessoaisFields = [
            '#billing_cellphone_field',
            '#billing_first_name_field',
            '#billing_last_name_field',
            '#billing_cpf_field',
            '#billing_email_field'
        ];

        var dadosEntregaFields = [
            '#billing_address_1_field',
            '#billing_number_field',
            '#billing_neighborhood_field',
            '#billing_city_field',
            '#billing_state_field',
            '#billing_complemento_field'
        ];

        // Criação das divs das abas (Mantido, apenas adicionado #tab-pagamento)
        if ( $('#tab-dados-pessoais').length === 0 ) {
            $(
                '<div id="tab-dados-pessoais" class="checkout-tab active">' +
                    '<h3>Dados Pessoais</h3>' +
                    '<div class="progress-container">' +
                        '<div class="progress-bar" id="progressBar"></div>' +
                        '<div class="progress-indicator" id="progressIndicator"></div>' +
                    '</div>' +
                    '<p class="frete-info" style="margin-top:6px;">Preencha seus dados corretamente e garanta que seu WhatsApp esteja correto para facilitar nosso contato.</p>' +
                '</div>'
            ).insertBefore('#customer_details .col-1 .woocommerce-billing-fields__field-wrapper');
        }

        if ( $('#tab-cep').length === 0 ) {
            $(
                '<div id="tab-cep" class="checkout-tab">' +
                    '<h3 class="cep-title">Informe seu CEP</h3>' +
                    '<div class="progress-container">' +
                        '<div class="progress-bar" id="progressBarCep"></div>' +
                        '<div class="progress-indicator" id="progressIndicatorCep"></div>' +
                    '</div>' +
                    '<p class="cep-description">Precisamos do seu CEP para calcular o frete e preencher seu endereço automaticamente.</p>' +
                '</div>'
            ).insertAfter('#tab-dados-pessoais');
        }

        if ( $('#tab-dados-entrega').length === 0 ) {
            $(
                '<div id="tab-dados-entrega" class="checkout-tab">' +
                    '<h3>Endereço</h3>' +
                    '<div class="progress-container">' +
                        '<div class="progress-bar" id="progressBarEndereco"></div>' +
                        '<div class="progress-indicator" id="progressIndicatorEndereco"></div>' +
                    '</div>' +
                    '<p class="frete-info" style="margin-top:8px;">Falta pouco para finalizar seu pedido...</p>' +
                '</div>'
            ).insertAfter('#tab-cep');
        }

         // Cria o contêiner da QUARTA aba com título "Resumo e Frete" (Mantido)
         if ( $('#tab-resumo-frete').length === 0 ) {
            $(
                 '<div id="tab-resumo-frete" class="checkout-tab">' +
                     '<h3>Resumo do Pedido e Frete</h3>' +
                     '<div class="progress-container">' +
                         '<div class="progress-bar" id="progressBarResumo"></div>' +
                         '<div class="progress-indicator" id="progressIndicatorResumo"></div>' +
                     '</div>' +
                     // O conteúdo de #order_review será movido para cá pelo JS
                 '</div>'
            ).insertAfter('#tab-dados-entrega'); // Insere após a aba de endereço
         }

        // Cria o contêiner da QUINTA aba com título "Pagamento" (Adicionado)
         if ( $('#tab-pagamento').length === 0 ) {
             $(
                 '<div id="tab-pagamento" class="checkout-tab">' +
                     '<h3>Pagamento</h3>' +
                     '<div class="progress-container">' +
                         '<div class="progress-bar" id="progressBarPagamento"></div>' +
                         '<div class="progress-indicator" id="progressIndicatorPagamento"></div>' +
                     '</div>' +
                     // O conteúdo do cupom e #payment será movido para cá pelo JS
                 '</div>'
             ).insertAfter('#tab-resumo-frete'); // Insere após a aba de resumo/frete
         }


        // Move os campos para as abas correspondentes (Mantido)
        $.each(dadosPessoaisFields, function(i, selector) {
            $(selector).appendTo('#tab-dados-pessoais');
        });
        $('#billing_postcode_field').appendTo('#tab-cep');
        $.each(dadosEntregaFields, function(i, selector) {
            $(selector).appendTo('#tab-dados-entrega');
        });


         // *** MOVIMENTAÇÃO CHAVE: Mover as seções para suas abas (AJUSTADO TAREFA 1 v3.1.6/3.1.7) ***
         // Isto deve ser feito no DOM Ready para garantir que os elementos existam.
         // O conteúdo de #order_review, .checkout_coupon e #payment são gerados pelo WooCommerce/templates
         // NÓS NÃO injetamos o HTML novo para cupom/total, apenas movemos os containers originais e injetamos o HTML do total duplicado.

         // Mover a seção de revisão do pedido (produtos, subtotais, frete, total) para a QUARTA aba (Mantido)
         var $orderReview = $('#order_review');
         if ($orderReview.length && $('#tab-resumo-frete').length) {
             log('DEBUG     Movendo #order_review para dentro de #tab-resumo-frete', null, 'INIT');
             $orderReview.appendTo('#tab-resumo-frete');
         } else {
              log('AVISO     #order_review ou #tab-resumo-frete não encontrados para mover #order_review!', null, 'INIT');
         }

         // TAREFA 2 (v3.1.2): Mover notas do pedido para a aba Pagamento
         var $orderNotesWrapper = $('.woocommerce-additional-fields__field-wrapper');
         if ($orderNotesWrapper.length && $('#tab-pagamento').length) {
             log('DEBUG     Movendo .woocommerce-additional-fields__field-wrapper para dentro de #tab-pagamento', null, 'INIT');
             $orderNotesWrapper.appendTo('#tab-pagamento'); // Move para a aba Pagamento
         } else {
             log('AVISO     .woocommerce-additional-fields__field-wrapper ou #tab-pagamento não encontrados para mover notas do pedido!', null, 'INIT');
         }

         // TAREFA 1 (v3.1.7): Mover o bloco .e-coupon-box customizado (se existir)
         var $customCouponBox = $('.e-coupon-box').first(); // Pega o primeiro se houver duplicatas (v3.1.5 remnants)
         var $targetTab = $('#tab-pagamento');

         // TAREFA 1 (v3.1.7): Remove duplicatas dos elementos de cupom padrão se existirem fora da aba
         // TAREFA 1 (v3.1.7): Ocultar elementos nativos via CSS global - JS não precisa movê-los explicitamente
         // Manter apenas a movimentação do .e-coupon-box se ele existe no DOM
         if ($customCouponBox.length && $targetTab.length) {
             log('DEBUG     Movendo bloco de cupom customizado (.e-coupon-box) para dentro de #tab-pagamento (após order notes)', null, 'INIT');
             $customCouponBox.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
             // Remove quaisquer outros .e-coupon-box se existirem
             $('.e-coupon-box:not(:first)').remove();
         } else {
              log('AVISO     Bloco .e-coupon-box customizado não encontrado para mover.', null, 'INIT');
              // TAREFA 1 (v3.1.6): Se o custom box não existe, garantir que o cupom padrão esteja na aba
              // Isso foi feito na v3.1.6, mas como a v3.1.7 foca no .e-coupon-box,
              // e o CSS global esconde os nativos, precisamos garantir que eles estejam no DOM
              // para que o WC possa interagir com eles. A movimentação para a aba acontece implicitamente
              // porque eles *não* estão sendo removidos, apenas escondidos por CSS.
              // No entanto, explicitamente anexá-los pode ser mais seguro para garantir que estão DENTRO da aba.
               var $couponAnchorContainer = $('.woocommerce-info.woocommerce-coupon-message').first();
               var $checkoutCoupon = $('.checkout_coupon').first();

               if ($couponAnchorContainer.length && $targetTab.length) {
                    log('DEBUG     Movendo contêiner link cupom padrão para dentro de #tab-pagamento (e-coupon-box não encontrado)', null, 'INIT');
                    $couponAnchorContainer.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
               }
               if ($checkoutCoupon.length && $targetTab.length) {
                    log('DEBUG     Movendo formulário cupom padrão para dentro de #tab-pagamento (e-coupon-box não encontrado)', null, 'INIT');
                    var $anchorOrNotes = $('#tab-pagamento .woocommerce-info.woocommerce-coupon-message');
                    if ($anchorOrNotes.length) {
                        $checkoutCoupon.insertAfter($anchorOrNotes);
                    } else {
                        $checkoutCoupon.insertAfter('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
                    }
               }
         }


         // TAREFA 1 (v3.1.2): Mover a seção de pagamento para a QUINTA aba (Mantido)
         var $payment = $('#payment');
         if ($payment.length && $('#tab-pagamento').length) {
             log('DEBUG     Movendo #payment para dentro de #tab-pagamento', null, 'INIT');
             // Move para a aba Pagamento. Posição será após custom coupon box se ele foi encontrado, ou order notes se não.
             var $couponOrNotes = $('#tab-pagamento .e-coupon-box').length ? $('#tab-pagamento .e-coupon-box') : $('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
              if ($couponOrNotes.length) {
                 $payment.insertAfter($couponOrNotes);
              } else {
                 $payment.appendTo('#tab-pagamento'); // Fallback
              }
         } else {
             log('AVISO     #payment ou #tab-pagamento não encontrados para mover pagamento!', null, 'INIT');
         }

         // TAREFA 1 (v3.1.5): Adicionar o handler de toggle para o cupom customizado (uma única vez) (Mantido)
         $(document).on('click', '.e-show-coupon-form', function (e) {
             e.preventDefault();
             log('ACTION    Toggle custom coupon form', null, 'ACTION');
             $(this).closest('.e-coupon-box').find('.e-coupon-anchor').slideToggle(300, function() {
                 if($(this).is(':visible')) {
                     $(this).find('input#coupon_code').focus();
                 }
             });
         });


        // Garantir que as abas não-ativas estejam inicialmente escondidas (Mantido)
        $('#tab-cep, #tab-dados-entrega, #tab-resumo-frete, #tab-pagamento').removeClass('active').hide();
        $('#tab-dados-pessoais').addClass('active').show();

        // Oculta campos indesejados (mantido)
        $('#billing_persontype_field, .person-type-field').hide();
        $('#billing_country_field, .thwcfd-field-country').hide();
         // Esconder títulos originais (mantido)
         $('#order_review_heading, #payment_heading').hide();


        // Botões de navegação - Adicionar contêiner flex para botões (AJUSTADO PARA TAREFA 2 v3.1.3)
        // A ordem de adição aqui define a ordem em desktop (flex-direction: row por padrão)
        // A ordem em mobile será definida pelo CSS (order: 1/2)

        // Botões na aba Dados Pessoais (Só Avançar) (Mantido)
         if ( $('#tab-dados-pessoais .tab-buttons').length === 0 ) {
            $('#tab-dados-pessoais').append('<div class="tab-buttons"></div>');
            $('#tab-dados-pessoais .tab-buttons').append('<button type="button" id="btn-avancar-para-cep" class="checkout-next-btn">Avançar</button>');
         }

        // Botões na aba CEP (Voltar e Avançar) (Mantido)
        if ( $('#tab-cep .tab-buttons').length === 0 ) {
            $('#tab-cep').append('<div class="tab-buttons"></div>');
             // Adicionar Avançar primeiro na estrutura HTML
             $('#tab-cep .tab-buttons').append('<button type="button" id="btn-avancar-para-endereco" class="checkout-next-btn">Avançar</button>');
             // Adicionar Voltar segundo na estrutura HTML
             $('#tab-cep .tab-buttons').append('<button type="button" id="btn-voltar-dados" class="checkout-back-btn">Voltar</button>');
        }

        // Botões na aba Endereço (Voltar e Avançar) (Mantido, texto do Avançar alterado)
        if ( $('#tab-dados-entrega .tab-buttons').length === 0 ) {
            $('#tab-dados-entrega').append('<div class="tab-buttons"></div>');
             // Adicionar Avançar primeiro
             $('#tab-dados-entrega .tab-buttons').append('<button type="button" id="btn-avancar-para-resumo" class="checkout-next-btn">Avançar para o Resumo</button>');
             // Adicionar Voltar segundo
             $('#tab-dados-entrega .tab-buttons').append('<button type="button" id="btn-voltar-cep" class="checkout-back-btn">Voltar</button>');
        }

        // Botões na aba Resumo e Frete (Voltar e Avançar) (Mantido, texto do Avançar alterado)
         if ( $('#tab-resumo-frete .tab-buttons').length === 0 ) {
            $('#tab-resumo-frete').append('<div class="tab-buttons"></div>');
             // Adicionar Avançar primeiro
             $('#tab-resumo-frete .tab-buttons').append('<button type="button" id="btn-avancar-para-pagamento" class="checkout-next-btn">Avançar para Pagamento</button>');
             // Adicionar Voltar segundo
             $('#tab-resumo-frete .tab-buttons').append('<button type="button" id="btn-voltar-endereco" class="checkout-back-btn">Voltar</button>');
         }

         // Botões na aba Pagamento (Só Voltar) (AJUSTADO - TAREFA 2 v3.1.3: NÃO MOVE .place-order AQUI)
         if ( $('#tab-pagamento .tab-buttons').length === 0 ) {
            $('#tab-pagamento').append('<div class="tab-buttons"></div>');
             // O .place-order (botão Finalizar pedido) JÁ EXISTE dentro de #payment.
             // Não o movemos mais aqui. Apenas adicionamos o botão Voltar.
             // O CSS gerencia a visibilidade e order em mobile.
             $('#tab-pagamento .tab-buttons').append('<button type="button" id="btn-voltar-resumo" class="checkout-back-btn">Voltar</button>');
         }


        // Adiciona mensagem de error do WhatsApp abaixo do botão "Voltar" na aba Endereço (Mantido)
        // (Nota: Agora ela fica dentro do container flex .tab-buttons antes do botão Voltar,
        // o que funciona bem com a ordenação flexbox em mobile/desktop)
        if ($('#tab-dados-entrega .tab-buttons .whatsapp-invalido').length === 0) {
             // Inserir dentro do container de botões da aba endereço, antes do botão voltar
             $('<div class="whatsapp-invalido">Número de WhatsApp inválido. Por favor, verifique e corrija.</div>')
                 .insertBefore('#tab-dados-entrega .tab-buttons .checkout-back-btn');
         }


        // BARRA DE PROGresso: Inicializa as barras (5 passos)
        // 0% -> 25% -> 50% -> 75% -> 100%
        var step_percentage = 100 / 4; // Para 5 abas, são 4 transições (0 a 4)


        // Função auxiliar para atualizar a barra de progresso para uma aba específica (Mantido, com 5 abas)
        function updateProgressBar(tabId) {
             let step_index = 0; // 0 para a primeira aba

             switch (tabId) {
                 case 'tab-dados-pessoais':
                     step_index = 0;
                     break;
                 case 'tab-cep':
                     step_index = 1;
                     break;
                 case 'tab-dados-entrega':
                     step_index = 2;
                     break;
                 case 'tab-resumo-frete':
                     step_index = 3;
                     break;
                 case 'tab-pagamento': // Nova aba
                     step_index = 4;
                     break;
             }

             let progressWidth = step_index * step_percentage;

             $('#progressBar').css('width', progressWidth + '%');
             $('#progressIndicator').css('left', progressWidth + '%'); // Indicador sempre acompanha a barra
             $('#progressBarCep').css('width', progressWidth + '%'); // Todas as barras progridem juntas
             $('#progressIndicatorCep').css('left', progressWidth + '%');
             $('#progressBarEndereco').css('width', progressWidth + '%');
             $('#progressIndicatorEndereco').css('left', progressWidth + '%');
             $('#progressBarResumo').css('width', progressWidth + '%');
             $('#progressIndicatorResumo').css('left', progressWidth + '%');
             $('#progressBarPagamento').css('width', progressWidth + '%'); // Nova barra
             $('#progressIndicatorPagamento').css('left', progressWidth + '%'); // Novo indicador


             log(`UI        Progresso atualizado para a aba ${tabId}. Width: ${progressWidth.toFixed(2)}%`, null, 'UI');
        }


        // Navegação entre abas (Mantido, com adição da 5ª aba)
        // De Dados Pessoais para CEP
        $('#btn-avancar-para-cep').on('click', function(e) {
            e.preventDefault();
            actionStartTime = performance.now(); // Log B1: Início da ação do usuário
            log('ACTION    Clique em "Avançar" (Dados Pessoais -> CEP)', null, 'ACTION');

            // Validação simples dos campos pessoais antes de avançar
            const nomeValido = $('#billing_first_name').val().trim().length > 1;
            const emailValido = $('#billing_email').val().trim().length > 5 && $('#billing_email').val().includes('@'); // Validação básica de email
            // TODO: Adicionar validação para CPF/CNPJ e WhatsApp se necessário

            if (!nomeValido || !emailValido) { // Adicione outras validações aqui
                alert('Por favor, preencha todos os campos obrigatórios de Dados Pessoais.');
                return;
            }

            $('#tab-dados-pessoais').removeClass('active').hide();
            $('#tab-cep').addClass('active').show();
            updateProgressBar('tab-cep'); // Atualiza barra para a próxima aba
            updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
        });

        // De CEP para Dados Pessoais (voltar)
        $('#btn-voltar-dados').on('click', function(e) {
            e.preventDefault();
            log('ACTION    Clique em "Voltar" (CEP -> Dados Pessoais)', null, 'ACTION');

            $('#tab-cep').removeClass('active').hide();
            $('#tab-dados-pessoais').addClass('active').show();
            updateProgressBar('tab-dados-pessoais'); // Atualiza barra para a aba anterior
            updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
        });


        // TAREFA 3.1.10: Listener para avançar a aba DEPOIS que updated_checkout finalizar
        // Usamos `.one()` para garantir que ele só seja disparado uma vez por clique no botão "Avançar" do CEP
        // e verificamos se a aba CEP ainda está ativa, para não avançar se o usuário já mudou de aba manualmente
        function handleUpdatedCheckoutForCepAdvance() {
            log('DEBUG     handleUpdatedCheckoutForCepAdvance chamado (triggered by updated_checkout). Verificando aba ativa...', null, 'DEBUG');

            // TAREFA 4 (v3.1.16): Resetar a flag imediatamente, pois este listener é chamado após o fluxo do botão
            clickedAvancarCep = false;

            // Se freteData for nulo, significa que a consulta do webhook falhou.
            // Neste caso, NÃO avançamos a aba, apenas limpamos o estado de loading.
            if (!freteData) {
                log('DEBUG     updated_checkout listener acionado, mas freteData é nulo (consulta falhou). Não avançando a aba, apenas limpando o estado.', null, 'DEBUG');
                $('#btn-avancar-para-endereco').removeClass('btn-processing');
                setProcessingState(false, 'updated_checkout_frete_data_null');
                updatePlaceOrderButtonState();
                renderDuplicateTotal();
                return;
            }

            // Verifica se a aba CEP ainda está ativa. Se não, significa que updated_checkout
            // foi disparado por outro motivo ou o usuário já navegou manualmente.
            if (!$('#tab-cep').hasClass('active')) {
                 log('DEBUG     updated_checkout listener acionado, mas aba CEP não está ativa. Pulando transição de aba.', null, 'DEBUG');
                 // Garante que o botão seja re-habilitado e o loading global removido (se não foi pelo listener geral)
                 $('#btn-avancar-para-endereco').removeClass('btn-processing');
                 setProcessingState(false, 'updated_checkout_cep_listener_skip');
                 updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
                 renderDuplicateTotal(); // Atualiza total duplicado
                 return; // Sai da função se a aba CEP não está ativa
            }

            log('ACTION    updated_checkout concluído após clique em "Avançar" no CEP. Avançando para a aba Endereço...', null, 'ACTION');

            // Executa a transição para a aba "Endereço"
            $('#tab-cep').removeClass('active').hide();
            $('#tab-dados-entrega').addClass('active').show();
            updateProgressBar('tab-dados-entrega'); // Atualiza barra de progresso

            // Remove o estado de processing e re-habilita o botão
            $('#btn-avancar-para-endereco').removeClass('btn-processing');
            setProcessingState(false, 'updated_checkout_cep_success');
            updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
             renderDuplicateTotal(); // Atualiza total duplicado
        }


        // De CEP para Endereço (consulta o CEP e frete, AGUARDA updated_checkout para avançar) (AJUSTADO v3.1.10)
        $('#btn-avancar-para-endereco').on('click', function(e) {
            e.preventDefault();
            actionStartTime = performance.now(); // Log B1: Início da ação do usuário
            log('ACTION    Clique em "Avançar" (CEP -> Endereço) para consultar CEP/Frete', null, 'ACTION');

            // TAREFA 3 (v3.1.16): Resetar consultaEmAndamento no início de cada clique
            consultaEmAndamento = false; // Garante que a flag seja reinicializada a cada clique

            // TAREFA 1 (v3.1.16): Setar a flag clickedAvancarCep ANTES de qualquer validação/saída
            clickedAvancarCep = true; // Sinaliza que o clique no botão Avançar do CEP ocorreu.

            // Impedir múltiplos cliques
            var $this = $(this);
            if ($this.hasClass('btn-processing')) {
                log('ACTION    Botão CEP: Já processando, ignorando clique', null, 'ACTION');
                return;
            }

            // Hard Guard (Item 3) - Verifica se CEP está preenchido minimamente
            const cepValue = $('#billing_postcode').val().replace(/\D/g,'');

            if (!cepValue || cepValue.length !== 8) {
                log('VALIDAÇÃO CEP inválido ou vazio.', null, 'VALIDAÇÃO');
                $('.cep-erro').show().text('CEP inválido. Informe os 8 dígitos do CEP.');
                 // Remover processamento se falhar na validação inicial
                 $this.removeClass('btn-processing');
                 setProcessingState(false, 'cep_validation_fail');
                 updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
                 clickedAvancarCep = false; // TAREFA 4 (v3.1.16): Resetar flag se falha na validação inicial
                return; // Não avança se CEP inválido
            } else {
                $('.cep-erro').hide(); // Esconde o error de CEP se a validação passou
            }


            // Adicionar estado de processamento ANTES da consulta
            $this.addClass('btn-processing');
            setProcessingState(true, 'cep_button_click');
            $('#tab-cep').addClass('cep-loading'); // Adiciona indicador específico do CEP

            // TAREFA 2 (v3.1.16): Registrar listener imediatamente, antes de chamar a cadeia de promises.
            // O listener verificará `freteData` internamente para decidir se avança.
            $(document.body).one('updated_checkout', handleUpdatedCheckoutForCepAdvance);
            log('DEBUG     Listener .one("updated_checkout", handleUpdatedCheckoutForCepAdvance) registrado no clique (independente do sucesso).', null, 'DEBUG');


            // TAREFA 3.1.10: Chamar a cadeia de promises (webhook -> processamento frontend -> armazenamento backend)
            consultarCepEFrete().then(function(success_chain) {
                // Esta promise resolve com TRUE se toda a cadeia (webhook call -> processarDadosEnderecoFrete -> armazenarDadosNoServidor) foi bem-sucedida.
                // Resolve com FALSE se qualquer passo da cadeia (incluindo erros de requisição ou falha no processamento/armazenamento) falhou.
                log(`DEBUG     Promise chain (webhook->process->store) resolvida. Success: ${success_chain}`, null, 'DEBUG');

                if (success_chain) {
                    // Se o fluxo customizado foi um sucesso, o `updated_checkout` será disparado pela função `armazenarDadosNoServidor`.
                    // O `handleUpdatedCheckoutForCepAdvance` já está registrado (agora unconditional) e cuidará da transição da aba e limpeza.
                    log('DEBUG     Fluxo customizado sucesso. updated_checkout será disparado por store_webhook_shipping (ou já foi).', null, 'DEBUG');
                    // Não precisamos limpar o estado aqui, o `handleUpdatedCheckoutForCepAdvance` fará isso.
                    // clickedAvancarCep será resetado por handleUpdatedCheckoutForCepAdvance
                } else {
                    // O fluxo customizado falhou em algum ponto (webhook erro, frontend process falhou, backend store falhou).
                    log('DEBUG     Fluxo customizado (webhook->process->store) falhou. Removendo estado de processamento.', null, 'DEBUG');
                    // Limpa estado de processamento diretamente, pois `updated_checkout` pode não ser disparado por este fluxo de falha
                    // (ou se for, o `handleUpdatedCheckoutForCepAdvance` já tratará o `freteData` nulo).
                    $this.removeClass('btn-processing');
                    setProcessingState(false, 'cep_chain_fail');
                    updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar (provavelmente desabilitado)
                    // A classe cep-loading é removida no complete da requisição AJAX dentro de consultarCepEFrete().
                    clickedAvancarCep = false; // TAREFA 4 (v3.1.16): Resetar flag no caso de falha da cadeia
                }
            }).catch(function(error_chain) {
                 // Catch-all for unexpected errors in the promise chain itself (e.g., JS error)
                log('ERROR     Erro inesperado na promise chain (webhook->process->store).', error_chain, 'ERROR');
                 // Limpa estado de processamento
                 $this.removeClass('btn-processing');
                 setProcessingState(false, 'cep_chain_error');
                  updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
                 // cep-loading removido no complete do AJAX do webhook
                 clickedAvancarCep = false; // TAREFA 4 (v3.1.16): Resetar flag no caso de erro inesperado na cadeia
            });

            // The `complete` logic in `consultarCepEFrete` still correctly handles `consultaEmAndamento` and `cep-loading` visual cleanup.

        });

        // De Endereço para CEP (voltar) (Mantido)
        $('#btn-voltar-cep').on('click', function(e) {
            e.preventDefault();
            log('ACTION    Clique em "Voltar" (Endereço -> CEP)', null, 'ACTION');

            $('#tab-dados-entrega').removeClass('active').hide();
            $('#tab-cep').addClass('active').show();
            updateProgressBar('tab-cep'); // Atualiza barra para a aba anterior
            updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
        });

        // De Endereço para Resumo e Frete (Avançar para o Resumo) (Mantido, validação aprimorada)
         $('#btn-avancar-para-resumo').on('click', function(e) {
             e.preventDefault();
             actionStartTime = performance.now(); // Log B1: Início da ação do usuário
             log('ACTION    Clique em "Avançar para o Resumo" (Endereço -> Resumo/Frete)', null, 'ACTION');

             // Validação simples dos campos de endereço antes de avançar
             const endereco1Valido = $('#billing_address_1').val().trim().length > 2;
             const bairroValido = $('#billing_neighborhood').val().trim().length > 1;
             const cidadeValida = $('#billing_city').val().trim().length > 1;
             // CORREÇÃO: Use .val() apenas uma vez
             const estadoValido = $('#billing_state').val() !== ''; // Verifica se o estado foi selecionado
             const numeroValido = $('#billing_number').val().trim().length > 0; // Verifica se o número foi preenchido

             if (!endereco1Valido || !bairroValido || !cidadeValida || !estadoValido || !numeroValido) {
                 alert('Por favor, preencha todos os campos obrigatórios de Endereço.');
                 return;
             }

             $('#tab-dados-entrega').removeClass('active').hide();
             $('#tab-resumo-frete').addClass('active').show();
             updateProgressBar('tab-resumo-frete'); // Atualiza barra para a próxima aba
             updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
         });

         // De Resumo e Frete para Endereço (Voltar) (Mantido)
         $('#btn-voltar-endereco').on('click', function(e) {
             e.preventDefault();
             log('ACTION    Clique em "Voltar" (Resumo/Frete -> Endereço)', null, 'ACTION');

             $('#tab-resumo-frete').removeClass('active').hide();
             $('#tab-dados-entrega').addClass('active').show();
             updateProgressBar('tab-dados-entrega'); // Atualiza barra para a aba anterior
             updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
         });

         // De Resumo e Frete para Pagamento (Avançar para Pagamento) (Mantido)
         $('#btn-avancar-para-pagamento').on('click', function(e) {
             e.preventDefault();
             actionStartTime = performance.now(); // Log B1: Início da ação do usuário
             log('ACTION    Clique em "Avançar para Pagamento" (Resumo/Frete -> Pagamento)', null, 'ACTION');

             // TODO: Opcional: Adicionar validação para selecionar método de frete aqui se for obrigatório.
             // Por enquanto, o WC já vai lidar com a seleção de frete na aba final.

             $('#tab-resumo-frete').removeClass('active').hide();
             $('#tab-pagamento').addClass('active').show();
             updateProgressBar('tab-pagamento'); // Atualiza barra para a última aba
             updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
         });

         // De Pagamento para Resumo e Frete (Voltar) (Adicionado)
         $('#btn-voltar-resumo').on('click', function(e) {
             e.preventDefault();
             log('ACTION    Clique em "Voltar" (Pagamento -> Resumo/Frete)', null, 'ACTION');

             $('#tab-pagamento').removeClass('active').hide();
             $('#tab-resumo-frete').addClass('active').show();
             updateProgressBar('tab-resumo-frete'); // Atualiza barra para a aba anterior
             updatePlaceOrderButtonState(); // Atualiza estado do botão finalizar
         });


        /*** 4. FUNÇÕES PARA CONSULTA E ARMAZENAMENTO DE FRETE (AJUSTADO TAREFA 1 v3.1.3 / 3.1.5 / 3.1.6) ***/

        // Função para armazenar dados no servidor via AJAX usando WC()->session (A3, Item 2.1) (Mantido, ajustado para resolver Promise)
        function armazenarDadosNoServidor(data_to_save) {
            currentPhase = 'STORE_OUT';
            log('STORE_OUT Chamando store_webhook_shipping para armazenar dados...', null, 'STORE_OUT');
            ajaxStoreStartTime = performance.now(); // Log B1

            // Retorna uma promise que resolve com true ou false
            return new Promise(function(resolve) {
                 $.ajax({
                    url: ajaxUrl, // Usar admin-ajax.php
                    type: 'POST',
                    dataType: 'json', // Espera JSON como resposta
                    data: {
                        action: 'store_webhook_shipping',
                        security: nonce,
                        shipping_data: JSON.stringify(data_to_save)
                    },
                    success: function(response) {
                         ajaxStoreEndTime = performance.now(); // Log B1
                         const deltaAjax = (ajaxStoreEndTime - ajaxStoreStartTime).toFixed(0);
                         currentPhase = 'STORE_IN';
                         log(`STORE_IN  store_webhook_shipping success (HTTP 200). Δajax=${deltaAjax}ms.`, response, 'STORE_IN');

                         // Item 2: Tratar a resposta robustamente
                         // Assumir success=true se a chave não vier na resposta ou se a resposta for vazia (caso onde WC não retorna fragments)
                         const successFlag = (typeof response.success === 'undefined') ? true : response.success;
                         // Ensure response.data is an array or object if success and no data is present
                         const responseData = response.data || {};
                         const fragments = responseData.fragments || responseData; // Handles both potential formats
                         const hasFragments = fragments && typeof fragments === 'object' && Object.keys(fragments).length > 0;

                        if (successFlag) { // Consider backend storage successful if successFlag is true
                            log('APPLY_FRAG store_webhook_shipping reportou sucesso. Aplicando fragments (se houver)...', null, 'APPLY_FRAG');

                            if (hasFragments) {
                                // Log do total antes (Item 5 Front-end) - Buscar total dentro de #order_review (agora na aba 4)
                                const beforeTotal = $('#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount').text().trim();
                                log(`DELTA     Total antes: ${beforeTotal}`, null,'TOTAL');

                                 // Aplicar fragments diretamente (A3)
                                $.each(fragments, function(key, value) {
                                    // Modificado para garantir que os elementos corretos nas abas sejam atualizados
                                    if (key === '#order_review') {
                                         $('#tab-resumo-frete #order_review').replaceWith(value);
                                         log('APPLY_FRAG #order_review fragment aplicado dentro da aba 4.');
                                    } else if (key === '#payment') { // Fragmento de pagamento
                                         $('#tab-pagamento #payment').replaceWith(value);
                                          log('APPLY_FRAG #payment fragment aplicado dentro da aba 5.');
                                    } else if (key === '.checkout_coupon') { // Fragmento do cupom
                                         // Não substituímos o .checkout_coupon, apenas garantimos que ele está lá e o CSS o esconde
                                          log('APPLY_FRAG Ignorando fragmento .checkout_coupon (gerenciado por CSS/movimentação).');
                                    } else if (key === '.woocommerce-info.woocommerce-coupon-message') { // Fragmento da mensagem/link do cupom
                                        // Não substituímos, apenas garantimos que está lá e o CSS o esconde
                                         log('APPLY_FRAG Ignorando fragmento .woocommerce-info.woocommerce-coupon-message (gerenciado por CSS/movimentação).');
                                    } else if (key === '#order_review_heading' || key === '#payment_heading') {
                                         // Ignora os títulos originais que estão escondidos
                                         log(`APPLY_FRAG Ignorando fragmento de título: "${key}".`);
                                    }
                                     // Fragmento potencial para campos adicionais/notas (pode vir aqui ou não, dependendo do tema/plugin)
                                     // Se vier, re-posicionaremos após o loop de fragments
                                    else if (key === '.woocommerce-additional-fields' || key === '.woocommerce-additional-fields__field-wrapper') {
                                        // Substitui o wrapper se ele vier no fragment
                                         $('#tab-pagamento .woocommerce-additional-fields__field-wrapper').replaceWith(value);
                                         log(`APPLY_FRAG Fragment "${key}" (Order Notes) aplicado dentro da aba 5. Re-posicionando...`);
                                         // O re-posicionamento final será feito após o loop
                                    }
                                    else {
                                         // Aplica outros fragments no corpo do documento (ex: mensagens, exceções)
                                         // Exclui fragmentos que são movidos explicitamente para as abas
                                         // Nota: .woocommerce-checkout-review-order-table é a tabela #order_review, .woocommerce-checkout-payment é #payment, .woocommerce-form-coupon é .checkout_coupon
                                         if (key !== '.woocommerce-checkout-review-order-table' && key !== '.woocommerce-checkout-payment' && key !== '.woocommerce-form-coupon' && key !== '.woocommerce-additional-fields' && key !== '.woocommerce-additional-fields__field-wrapper') {
                                            $(key).replaceWith(value);
                                            log(`APPLY_FRAG Fragment "${key}" aplicado.`, null, 'APPLY_FRAG');
                                         } else {
                                              log(`APPLY_FRAG Ignorando fragmento que já está na aba: "${key}".`);
                                         }
                                    }
                                });

                                 // TAREFA 1 (v3.1.6/3.1.7): Re-posicionar elementos após fragments
                                // Re-seleciona os elementos após a aplicação dos fragments, pois eles podem ter sido substituídos
                                // Garante a ordem: Order Notes -> e-coupon-box -> Payment -> Standard Coupon Form
                                 var $paymentSectionAfterFrag = $('#tab-pagamento #payment');
                                 var $couponFormAfterFrag = $('#tab-pagamento .checkout_coupon'); // Standard form (kept hidden)
                                 var $orderNotesAfterFrag = $('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
                                 var $customCouponBoxAfterFrag = $('#tab-pagamento .e-coupon-box'); // Custom coupon box

                                 // Ensure elements are in the DOM after update (fragments might replace them)
                                 // And remove duplicates if any somehow reappeared
                                 if ($orderNotesAfterFrag.length === 0) $orderNotesAfterFrag = $('.woocommerce-additional-fields__field-wrapper').first().appendTo('#tab-pagamento');
                                 if ($couponFormAfterFrag.length === 0) $couponFormAfterFrag = $('.checkout_coupon').first().appendTo('#tab-pagamento');
                                 if ($paymentSectionAfterFrag.length === 0) $paymentSectionAfterFrag = $('#payment').first().appendTo('#tab-pagamento');
                                 if ($customCouponBoxAfterFrag.length === 0) {
                                     // TAREFA 1 (v3.1.7): If custom box is missing after fragments, try to find it elsewhere and move it
                                     $customCouponBoxAfterFrag = $('.e-coupon-box').first();
                                     if ($customCouponBoxAfterFrag.length && $('#tab-pagamento').length) {
                                         $customCouponBoxAfterFrag.appendTo('#tab-pagamento');
                                          log('DEBUG     Custom coupon box found outside and moved into tab after fragment update.');
                                     } else {
                                          log('DEBUG     Custom coupon box not found anywhere after fragment update.');
                                     }
                                 }

                                 // Remove any duplicate custom coupon boxes if they somehow appeared
                                 $('.e-coupon-box:not(:first)').remove();


                                 // Ensure order: Order Notes -> e-coupon-box -> Payment -> Standard Coupon Form
                                 if ($orderNotesAfterFrag.length && $customCouponBoxAfterFrag.length) {
                                     $customCouponBoxAfterFrag.insertAfter($orderNotesAfterFrag);
                                      log('DEBUG     Ensured order of custom coupon box after order notes after fragment update.');
                                 } else if ($orderNotesAfterFrag.length) {
                                       // Fallback: if custom box is missing, ensure order notes is before payment
                                      $orderNotesAfterFrag.insertBefore($paymentSectionAfterFrag); // Position before payment
                                       log('DEBUG     Ensured order of order notes before #payment (custom box missing) after fragment update.');
                                 }

                                  if ($customCouponBoxAfterFrag.length && $paymentSectionAfterFrag.length) {
                                     $paymentSectionAfterFrag.insertAfter($customCouponBoxAfterFrag);
                                      log('DEBUG     Ensured order of #payment after custom coupon box after fragment update.');
                                 } else if ($orderNotesAfterFrag.length && $paymentSectionAfterFrag.length) { // Corrected from $orderNotesAfterUpdate
                                      // Fallback if custom box is missing
                                     $paymentSectionAfterFrag.insertAfter($orderNotesAfterFrag);
                                      log('DEBUG     Ensured order of #payment after order notes (custom box missing) after updated_checkout.');
                                 }


                                // Ensure standard coupon form is after payment (it's hidden anyway)
                                if ($couponFormAfterFrag.length && $paymentSectionAfterFrag.length) {
                                    $couponFormAfterFrag.insertAfter($paymentSectionAfterFrag);
                                    log('DEBUG     Ensured order of standard coupon form after #payment after fragment update.');
                                }


                                 // TAREFA 2 (v3.1.6/3.1.7): Render and Update Duplicate Total
                                renderDuplicateTotal();


                                 fragmentsAppliedTime = performance.now(); // Log B1
                                 log(`UPDATE_DONE Fragments aplicados (via SWHS).`, null, 'UPDATE_DONE');

                                 // Log do total depois (Item 5 Front-end) - Buscar total dentro de #order_review (agora na aba 4)
                                 const afterTotal = $('#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount').text().trim();
                                 log(`DELTA     Total depois: ${afterTotal}`, null,'TOTAL');

                             } else {
                                 log('DEBUG     store_webhook_shipping success, but no fragments returned.');
                             }

                             // Disparar updated_checkout para compatibilidade com outros scripts (passarelas, etc.)
                             // e para sinalizar a conclusão da atualização do DOM após aplicação dos fragments.
                             // Nota: Este trigger DEVERIA ser suficiente para o listener .one() capturar.
                             // Mas mantemos o trigger('update_checkout') no handler do botão como garantia
                             // de que o ciclo completo do WC é re-executado.
                             log('DEBUG     Disparando updated_checkout após aplicar fragments (via SWHS).');
                             $(document.body).trigger('updated_checkout');


                            resolve(true); // Reporta sucesso na comunicação com o backend (mesmo que sem fragments)

                        } else { // successFlag === false or invalid response structure from backend
                             log('STORE_IN  Resposta de store_webhook_shipping com success=false ou estrutura inválida. Mensagem:', responseData?.message || 'Sem mensagem.', 'STORE_IN');
                             // Exibir mensagem de error específica se fornecida pelo backend
                            if (responseData?.message) {
                                $('.cep-erro').show().text('Erro ao salvar dados do frete: ' + responseData.message);
                            } else {
                                $('.cep-erro').show().text('Erro desconhecido ao salvar dados do frete. Tente novamente.');
                            }
                            resolve(false);  // Reporta falha na comunicação com o backend
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                         ajaxStoreEndTime = performance.now(); // Log B1
                         const deltaAjax = (ajaxStoreEndTime - ajaxStoreStartTime).toFixed(0);
                         currentPhase = 'STORE_IN';
                         log(`STORE_IN  store_webhook_shipping error (HTTP ${jqXHR.status}). Δajax=${deltaAjax}ms.`, {
                            status: jqXHR.status,
                            textStatus: textStatus,
                            error: errorThrown,
                            responseText: jqXHR.responseText
                        }, 'STORE_IN');

                        $('.cep-erro').show().text('Erro ao salvar dados do frete. Tente novamente.');
                        resolve(false); // Reporta falha na comunicação com o backend
                    },
                    complete: function() {
                         currentPhase = 'STORE_DONE';
                        log('STORE_DONE store_webhook_shipping request complete.');
                    }
                 });
            });
        }

        // Função para remover máscara do número de WhatsApp (Mantido)
        function removerMascaraWhatsApp(numero) {
            return (numero || '').replace(/\D/g, '');
        }

        // Funções formatarPreco, normalizarRespostaAPI, formatarPrazo (Mantido) - Não estão no código JS original, assumindo que existem ou não são usadas/necessárias aqui.

        // Funções formatarPreco, normalizarRespostaAPI, formatarPrazo (Mantido) - Não estão no código JS original, assumindo que existem ou não são usadas/necessárias aqui.

        // Função para normalizar a resposta da API (Mantido)
        function normalizarRespostaAPI(data) {
            log('DEBUG     Normalizando resposta da API bruta', data, 'DEBUG');

            // Se a resposta for um array, pegamos o primeiro elemento (ou null se vazio)
            if (Array.isArray(data)) {
                log('DEBUG     Resposta é um array, usando primeiro elemento');
                return data.length > 0 ? data[0] : null;
            }

             // Se a resposta for um objeto, retornamos como está
            if (typeof data === 'object' && data !== null) {
                 return data;
            }

            // Caso contrário, retorna null
            log('DEBUG     Resposta da API não é array nem objeto válido', null, 'DEBUG');
            return null;
        }

        // Função para formatar o prazo de entrega (Mantido) - Não está no código JS original, assumindo que existe ou não é usada/necessária aqui.
        // function formatarPrazo(prazo) { /* ... */ }


        // Função para processar dados de endereço e frete recebidos do webhook (AJUSTADO - TAREFA 1 v3.1.3 / 3.1.5)
        function processarDadosEnderecoFrete(dados) {
            log('DEBUG     Processando dados de endereço e frete recebidos do webhook...', null, 'DEBUG');

            // Se a resposta for completamente vazia ou nula, limpamos todos os campos de endereço.
            if (!dados) {
                log('DEBUG     Dados vazios ou inválidos para processamento. Limpando todos os campos de endereço.', null, 'DEBUG');
                 $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento').val('').trigger('change');
                $('.cep-erro').show().text('Resposta do CEP inválida ou vazia. Verifique se o CEP existe.');
                freteData = null; // Garante que freteData esteja nulo
                return false; // Processamento falhou (sem dados)
            }

            // Normalizar a resposta para um formato padronizado
            dados = normalizarRespostaAPI(dados);

             if (!dados) {
                 log('DEBUG     Dados normalizados resultaram em vazio ou inválido. Limpando todos os campos de endereço.', null, 'DEBUG');
                  // Se a normalização falhou, limpamos todos os campos de endereço
                 $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento').val('').trigger('change');
                 $('.cep-erro').show().text('Resposta do CEP inválida após normalização. Verifique se o CEP existe.');
                 freteData = null; // Garante que freteData esteja nulo
                 return false; // Processamento falhou (normalização)
             }

            // Debug do objeto de dados normalizado
            log("DEBUG     Dados normalizados do webhook para processamento:", dados, 'DEBUG');

            // Armazenar os dados normalizados para uso posterior (store_webhook_shipping e updated_checkout)
            freteData = dados; // Armazena os dados para serem enviados ao backend

            try {
                let anyAddressFieldFilledByWebhook = false;
                // TAREFA 1 (v3.1.3 / 3.1.5): Iterar sobre os campos de endereço e preencher/limpar individualmente
                 const addressFieldsMapping = {
                     'logradouro': '#billing_address_1',
                     'numero': '#billing_number',
                     'bairro': '#billing_neighborhood',
                     'localidade': '#billing_city',
                     'uf': '#billing_state',
                     'complemento': '#billing_complemento'
                 };

                log('DEBUG     Preenchendo/Limpando campos de endereço individualmente...', null, 'DEBUG');

                 Object.keys(addressFieldsMapping).forEach(function(apiField) {
                     const formFieldSelector = addressFieldsMapping[apiField];
                     const $formField = $(formFieldSelector);

                     if ($formField.length) { // Check if the field exists in the DOM
                         // Verifica se o campo existe na resposta e não é uma string vazia ou null
                         const fieldValue = dados[apiField];

                         if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                             // Preenche o campo se o valor for válido e diferente do atual (otimização)
                             if ($formField.val() !== fieldValue) {
                                 $formField.val(fieldValue).trigger('change');
                                 log(`DEBUG     Campo ${formFieldSelector} preenchido/atualizado com "${fieldValue}"`);
                             } else {
                                  log(`DEBUG     Campo ${formFieldSelector} já preenchido corretamente ("${fieldValue}")`);
                                  // Se o campo já estava preenchido e a resposta o confirma, ainda consideramos preenchido pelo webhook (indirectly)
                                   if (apiField === 'logradouro') anyAddressFieldFilledByWebhook = true;
                             }
                             if (apiField === 'logradouro' && fieldValue.trim() !== '') anyAddressFieldFilledByWebhook = true; // Marca que pelo menos o logradouro foi preenchido
                         } else {
                             // TAREFA 1 (v3.1.5): Limpa o campo APENAS se o valor for vazio, nulo, ou não existir na resposta
                             // Preserva valores preenchidos manualmente se o campo não veio na resposta
                             if (fieldValue === '' || fieldValue === null || fieldValue === undefined) {
                                  if ($formField.val() !== '') {
                                      $formField.val('').trigger('change');
                                       log(`DEBUG     Campo ${formFieldSelector} vazio/ausente na resposta, limpando campo existente.`);
                                  } else {
                                       log(`DEBUG     Campo ${formFieldSelector} já vazio e ausente na resposta.`);
                                  }
                             } else {
                                  // Should not happen based on check above, but for safety
                                  log(`DEBUG     Campo ${formFieldSelector} tem valor "${fieldValue}" na resposta, mas não foi preenchido (check logic).`);
                             }
                         }
                     } else {
                         log(`DEBUG     Campo ${formFieldSelector} não encontrado no DOM.`);
                     }
                 });


                // Atualizar a cidade exibida na seção de frete, se aplicável (varia conforme tema)
                // Procura por elementos com as classes dentro do #order_review (onde a tabela foi movida para aba 4)
                // Usa os valores preenchidos ou limpos nos campos do formulário como fallback, caso a resposta da API seja parcial ou ausente
                 const currentCity = $('#billing_city').val() || '';
                 const currentState = $('#billing_state').val() || '';
                 // Only update if the values are present
                 if (currentCity || currentState) {
                     $('#tab-resumo-frete #order_review .location-city.billing_city_field, #tab-resumo-frete #order_review .woocommerce-shipping-destination .location').text(`${currentCity}, ${currentState}`);
                     log('DEBUG     Atualizado display de cidade/estado no resumo.');
                 } else {
                     // Clear display if both are empty
                      $('#tab-resumo-frete #order_review .location-city.billing_city_field, #tab-resumo-frete #order_review .woocommerce-shipping-destination .location').text('');
                      log('DEBUG     Limpado display de cidade/estado no resumo.');
                 }


                // Foco no próximo campo (número) se o logradouro foi preenchido automaticamente E o número está vazio
                if (anyAddressFieldFilledByWebhook && $('#billing_number').val().trim() === '') {
                     $('#billing_number').focus();
                     log('DEBUG     Logradouro preenchido, focando no campo número.');
                } else if (anyAddressFieldFilledByWebhook) {
                     log('DEBUG     Logradouro e/ou número já preenchidos.');
                     // Maybe focus on neighborhood or next empty field? Sticking to number for now.
                }


                // Exibir error de CEP se o logradouro NÃO foi encontrado na resposta E os campos estão vazios
                 // Ajuste na lógica de error: Mostrar error se a consulta retornou algo, mas não conseguimos preencher o logradouro E o logradouro continua vazio no formulário.
                 if (!anyAddressFieldFilledByWebhook && $('#billing_address_1').val().trim() === '') {
                     log('DEBUG     Logradouro NÃO encontrado na resposta do webhook E campo no formulário vazio. Mostrando error e solicitando preenchimento manual.', null, 'DEBUG');
                     $('.cep-erro').show().text('CEP encontrado, mas dados de endereço incompletos. Por favor, preencha o endereço manualmente.');
                 } else if (!anyAddressFieldFilledByWebhook && $('#billing_address_1').val().trim() !== '') {
                     // Caso a resposta não preencha o logradouro, mas o usuário já preencheu manualmente
                     log('DEBUG     Logradouro NÃO encontrado na resposta do webhook, mas campo no formulário já preenchido. Ok para avançar (se houver frete).', null, 'DEBUG');
                     $('.cep-erro').hide(); // Não mostramos error se o usuário já preencheu
                 }
                 else {
                     $('.cep-erro').hide(); // Esconder error se o logradouro foi preenchido
                 }


                // 2. Verificar a validade do WhatsApp
                if (dados.whatsappValido === false) {
                    $('.whatsapp-invalido').show();
                    log('DEBUG     WhatsApp inválido detectado na resposta do webhook', null, 'DEBUG');
                } else {
                    $('.whatsapp-invalido').hide();
                    log('DEBUG     WhatsApp válido ou não informado na resposta do webhook', null, 'DEBUG');
                }

                // 3. Verificar se há dados de frete disponíveis (somente valores válidos > 0)
                var temDadosFreteValidos = (dados.fretePACMini && typeof dados.fretePACMini.valor !== 'undefined' && parseFloat(dados.fretePACMini.valor) > 0) ||
                                    (dados.freteSedex && typeof dados.freteSedex.valor !== 'undefined' && parseFloat(dados.freteSedex.valor) > 0) ||
                                    (dados.freteMotoboy && typeof dados.freteMotoboy.valor !== 'undefined' && parseFloat(dados.freteMotoboy.valor) > 0);


                // O processamento frontend é considerado "bem-sucedido" se conseguimos preencher *algum* campo de endereço
                // OU se há *algum* dado de frete válido retornado.
                var processadoComSucessoNoFrontend = anyAddressFieldFilledByWebhook || temDadosFreteValidos;

                // Retornamos esta flag. A chamada a armazenarDadosNoServidor será feita SE esta flag for TRUE
                // (e se houver freteData para enviar), e o resultado de store_webhook_shipping
                // determinará o sucesso final da cadeia.
                return processadoComSucessoNoFrontend;


            } catch (e) {
                log('ERROR     Erro fatal ao processar dados do webhook no frontend:', e.message, 'ERROR');
                console.error(e);
                 // Em caso de error fatal, limpamos todos os campos de endereço
                 $('#billing_address_1, #billing_number, #billing_neighborhood, #billing_city, #billing_state, #billing_complemento').val('').trigger('change');
                $('.cep-erro').show().text('Ocorreu um error ao processar os dados do CEP. Tente novamente.');
                 freteData = null; // Garante que freteData esteja nulo
                return false; // Processamento falhou (error)
            }
        }

        // Função para consultar o CEP e o frete, processar frontend e armazenar backend.
        // Esta função agora retorna uma Promise que resolve quando TODO O FLUXO (webhook + process + store) termina.
        // AJUSTADO (v3.1.12): Incluindo nome no payload para o webhook
        function consultarCepEFrete() {
            return new Promise(function(resolve, reject) { // consultarCepEFrete returns a promise

                // TAREFA 3 (v3.1.16): Resetar consultaEmAndamento no início do clique para garantir reinicialização.
                // Mas a verificação e setting para `true` aqui dentro previne chamadas concorrentes.
                 if (consultaEmAndamento) {
                     log('DEBUG     Consulta já em andamento (interno consultarCepEFrete), ignorando.', null, 'DEBUG');
                     resolve(false); // Resolve immediately as false if already running
                     return;
                 }
                 consultaEmAndamento = true; // Set flag here before AJAX chain starts

                freteData = null; // Limpa dados antigos

                var cep = $('#billing_postcode').val().replace(/\D/g, '');
                var whatsapp = removerMascaraWhatsApp($('#billing_cellphone').val());
                // NOVO (v3.1.12): Captura o nome completo
                var firstName = $('#billing_first_name').val().trim();
                var lastName = $('#billing_last_name').val().trim();
                var nomeCompleto = (firstName + ' ' + lastName).trim();
                // NOVO: captura o CPF sem formatação
                var cpf = $('#billing_cpf').val().replace(/\D/g,'');



                currentPhase = 'WEBHOOK_OUT';
                log('WEBHOOK_OUT Iniciando consulta de endereço e frete via webhook...', { cep: cep, whatsapp: whatsapp, nome: nomeCompleto }, 'WEBHOOK_OUT');

                ajaxWebhookStartTime = performance.now();

                // NOVO (v3.1.12): Inclui o nome no payload JSON para o webhook
                var payload = {
                   cep: cep,
                   evento: 'consultaEnderecoFrete',
                   whatsapp: whatsapp,
                   cpf: cpf,                   // NOVO campo CPF
                   nome: nomeCompleto // Inclui o nome no payload
                };

                $.ajax({
                    url: webhookUrl,
                    type: 'POST', // Usar POST para enviar dados no corpo
                    contentType: 'application/json', // Especifica o tipo de conteúdo JSON
                    dataType: 'json', // Espera JSON como resposta
                    timeout: 15000,              // TAREFA 1 (v3.1.16): Timeout de 15s
                    crossDomain: true,           // TAREFA 1 (v3.1.16): Caso seja domínio externo
                    xhrFields: { withCredentials: false }, // TAREFA 1 (v3.1.16): Para CORS
                    data: JSON.stringify(payload), // Envia o payload como string JSON
                    success: function(data) {
                        ajaxWebhookEndTime = performance.now();
                        const deltaAjaxWebhook = (ajaxWebhookEndTime - ajaxWebhookStartTime).toFixed(0);
                        currentPhase = 'WEBHOOK_IN';
                        log(`WEBHOOK_IN  Resposta do webhook recebida (HTTP 200). Δajax=${deltaAjaxWebhook}ms.`, data, 'WEBHOOK_IN');

                        var processadoComSucessoNoFrontend = processarDadosEnderecoFrete(data); // Sets freteData if successful

                        if (processadoComSucessoNoFrontend && freteData) {
                             log('DEBUG     Processamento frontend obteve dados úteis. Chamando store_webhook_shipping.', null, 'DEBUG');
                             // TAREFA 3.1.10: Chain the store promise. Resolve the main promise *based on the store promise*.
                             armazenarDadosNoServidor(freteData)
                                .then(function(success_storing) {
                                     log('DEBUG     store_webhook_shipping promise resolvida. Success:', success_storing, 'DEBUG');
                                    resolve(success_storing); // Resolve the main promise chain (true/false from store)
                                })
                                .catch(function(error_storing){
                                     log('ERROR     store_webhook_shipping promise rejeitada. Error:', error_storing, 'ERROR');
                                     // Error message already set by armazenarDadosNoServidor
                                    resolve(false); // Resolve main promise as failure if store failed
                                });

                        } else {
                             // If processarDadosEnderecoFrete failed (no useful data)
                             log('DEBUG     Falha no processamento inicial dos dados do webhook (frontend).', null, 'DEBUG');
                             // Error message already set by processarDadosEnderecoFrete
                             resolve(false); // Resolve a promise principal como false
                        }

                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        ajaxWebhookEndTime = performance.now();
                        const deltaAjaxWebhook = (ajaxWebhookEndTime - ajaxWebhookStartTime).toFixed(0);
                        currentPhase = 'WEBHOOK_IN';
                        log(`WEBHOOK_IN  Erro na requisição AJAX para o webhook (${textStatus}). Δajax=${deltaAjaxWebhook}ms.`, {
                            status: jqXHR.status, textStatus: textStatus, error: errorThrown, responseText: jqXHR.responseText
                        }, 'WEBHOOK_IN');

                        // TAREFA 1 (v3.1.16): Em caso de status 0 ou timeout, exibir mensagem amigável e desbloquear botão
                        $('.cep-erro').show().text('Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.');
                        // TAREFA 1 (v3.1.16): Remover o estado de processamento para que o usuário tente de novo
                        $('#btn-avancar-para-endereco').removeClass('btn-processing');
                        setProcessingState(false, 'cep_chain_fail');
                        resolve(false); // Resolve main promise as false in case of webhook AJAX error
                    },
                    complete: function() {
                         currentPhase = 'WEBHOOK_DONE';
                         log('WEBHOOK_DONE Webhook AJAX request complete (callback complete)');
                         $('#tab-cep').removeClass('cep-loading'); // Remove a classe de loading visual do CEP
                         consultaEmAndamento = false; // TAREFA 3 (v3.1.16): Reset da flag no complete do AJAX
                    }
                });
            }); // End Promise constructor
        }

        // Opcional: Lidar com a entrada de CEP para disparar consulta automática (Pode adicionar debounce aqui se quiser consultar no input/blur)
        // Atualmente, a consulta é disparada apenas no clique do botão "Avançar". (Mantido)
        $('#billing_postcode').on('change', function() {
             var cep = $(this).val().replace(/\D/g, '');
             if (cep.length === 8) {
                 log('DEBUG     CEP completo digitado/alterado:', cep, 'DEBUG');
                 // Não consulta automaticamente aqui no change, mantemos o fluxo do botão "Avançar".
                 // $('#btn-avancar-para-endereco').click(); // Descomente se quiser consultar no change/blur
                 $('.cep-erro').hide(); // Esconde o error de CEP se o CEP for alterado
             } else {
                  $('.cep-erro').hide(); // Esconde o error if the CEP is incomplete
             }
        });

        // TAREFA 2 (v3.1.6/3.1.7): Função para renderizar/atualizar o valor do total duplicado na aba Pagamento
        function renderDuplicateTotal() {
             const $paymentSection = $('#tab-pagamento #payment');
             const $placeOrderContainer = $paymentSection.find('.place-order');
             let $duplicateTotalContainer = $paymentSection.find('.payment-total-dup');

             // TAREFA 2 (v3.1.7): Injete o bloco se ele não existir DENTRO de #payment, antes de .place-order
             if ($paymentSection.length && $placeOrderContainer.length) {
                 if ($duplicateTotalContainer.length === 0) {
                     log('DEBUG     Bloco de total duplicado (.payment-total-dup) não encontrado dentro de #payment, injetando.', null, 'UI');
                      $placeOrderContainer.before(`
                        <div class="payment-total-dup">
                          <hr class="payment-total-divider">
                          <div class="payment-total-row">
                             <span class="payment-total-label">Total</span>
                             <span class="payment-total-value">R$ 0,00</span>
                          </div>
                        </div>
                      `);
                     // Update the reference after injection
                      $duplicateTotalContainer = $paymentSection.find('.payment-total-dup');
                 } else {
                      log('DEBUG     Bloco de total duplicado (.payment-total-dup) encontrado dentro de #payment.', null, 'UI');
                 }
             } else {
                  log('AVISO     Não foi possível renderizar o bloco de total duplicado. #tab-pagamento #payment ou .place-order não encontrados.', null, 'UI');
             }


             // TAREFA 2 (v3.1.6/3.1.7): Atualizar o valor
             const $orderTotal = $('#tab-resumo-frete #order_review .order-total .amount, #tab-resumo-frete #order_review .order_details .amount');
             const $duplicateTotalValue = $duplicateTotalContainer.find('.payment-total-value'); // Find within the container

             if ($orderTotal.length && $duplicateTotalValue.length) {
                 const totalText = $orderTotal.text().trim();
                 if ($duplicateTotalValue.text().trim() !== totalText) {
                      $duplicateTotalValue.text(totalText);
                      log(`DEBUG     Total duplicado atualizado para: ${totalText}`, null, 'UI');
                 } else {
                      log(`DEBUG     Total duplicado já está correto: ${totalText}`, null, 'UI');
                 }
             } else {
                 log('AVISO     Não foi possível encontrar os elementos do total para atualizar o total duplicado.', null, 'UI');
             }
        }


        // === Eventos padrão do WooCommerce para controlar loading e atualizar UI ===

        // TAREFA 4 (v3.1.16): Quando o usuário muda o método de frete na aba 4:
        $(document).on('change', '#tab-resumo-frete #order_review input[name^="shipping_method"]', function() {
            recalcViaFrete = true;
            log('ACTION    Seleção de frete – recalcViaFrete=true e disparando update_checkout.', null, 'ACTION');
            $(document.body).trigger('update_checkout');
        });

        // TAREFA 4 (v3.1.16): Interceptar update_checkout do WooCommerce
        $(document.body).on('update_checkout', function() {
            // Se estivermos na aba CEP E NÃO for clique em Avançar E NÃO for recálculo de frete:
            if ($('#tab-cep').hasClass('active') && !clickedAvancarCep && !recalcViaFrete) {
                log('WC_OUT    update_checkout na aba CEP por digitação (sem Avançar/sem recálculo via frete). Ocultando overlay.', null, 'WC_OUT');
                // NÃO chamamos setProcessingState(true); mas NÃO bloqueamos o recálculo de frete pelo WooCommerce
                return;
            }
            // Caso contrário (ou seja: é clique em "Avançar" ou recálculo de frete), mostramos o overlay:
            currentPhase = 'WC_OUT';
            log('WC_OUT    update_checkout válido (Avançar do CEP ou recálculo de frete). Mostrando overlay...', null, 'WC_OUT');
            ajaxWCStartTime = performance.now();
            setProcessingState(true, 'update_checkout');
        });


        // Listener para quando o WooCommerce termina uma atualização de checkout via AJAX padrão (AJUSTADO TAREFA 1 e 2 v3.1.6/3.1.7 + TAREFA 4 v3.1.16)
        // IMPORTANTE: Este listener AGORA NÃO DEVE GERENCIAR A TRANSIÇÃO DE ABA DO CEP.
        // Essa tarefa específica é delegada ao listener .one() registrado no clique do botão CEP.
        $(document.body).on('updated_checkout', function() {
            // Disparado DEPOIS da requisição AJAX padrão do WC para atualizar o checkout
            // ou DEPOIS que fragments são aplicados via custom AJAX que chama este evento.

             ajaxWCEndTime = performance.now(); // Capture WC AJAX end time if applicable

            log('UI        Evento updated_checkout detectado. Finalizando UI loading geral (se não foi pelo .one() listener)...', null, 'UI');

             // Determine qual AJAX terminou por último para calcular o tempo total relevante
             // (Isso é mais para logging e pode ser refinado, mas por enquanto mantém a lógica anterior)
             let lastAjaxEndTime = Math.max(ajaxStoreEndTime, ajaxWCEndTime, ajaxWebhookEndTime);
             if (lastAjaxEndTime < actionStartTime) lastAjaxEndTime = performance.now(); // Fallback if no AJAX recorded

             fragmentsAppliedTime = performance.now(); // Log B1: Assume fragments estão visíveis AGORA
             const totalTime = (fragmentsAppliedTime > actionStartTime ? fragmentsAppliedTime - actionStartTime : 0).toFixed(0);

             // Log timing information based on the last relevant event
             if (ajaxStoreEndTime > ajaxStoreStartTime && ajaxStoreEndTime >= ajaxWCEndTime && ajaxStoreEndTime >= ajaxWebhookEndTime) {
                  // SWHS terminou por último ou em paralelo com WC, e foi iniciado APÓS o webhook
                 log(`UPDATE_DONE Updated via SWHS/FRAGMENTS. Total time = ${totalTime}ms since action start.`, null, 'UPDATE_DONE');
             } else if (ajaxWCEndTime > ajaxWCStartTime && ajaxWCEndTime > ajaxStoreEndTime && ajaxWCEndTime > ajaxWebhookEndTime) {
                 // WC padrão terminou por último
                  const deltaAjax = (ajaxWCEndTime > ajaxWCStartTime ? ajaxWCEndTime - ajaxWCStartTime : 0).toFixed(0);
                  log(`WC_IN     WC update_order_review success. Δajax=${deltaAjax}ms.`, null, 'WC_IN'); // Log do AJAX padrão do WC
                  log(`UPDATE_DONE Updated via WC standard. Total time = ${totalTime}ms since action start.`, null, 'UPDATE_DONE');
             } else if (ajaxWebhookEndTime > ajaxWebhookStartTime && ajaxWebhookEndTime > ajaxStoreEndTime && ajaxWebhookEndTime > ajaxWCStartTime) {
                  // Webhook terminou por último (raro, mas possível em error)
                  log(`WEBHOOK_IN  Webhook completed last.`, null, 'WEBHOOK_IN'); // Log do AJAX padrão do WC
                  log(`UPDATE_DONE Update complete. Total time = ${totalTime}ms since action start.`, null, 'UPDATE_DONE');
             } else {
                  // Caso Updated_checkout seja disparado por outro motivo não medido ainda ou no init
                  log(`DEBUG     updated_checkout disparado. Total time = ${totalTime}ms since action start.`, null, 'DEBUG');
                   log(`UPDATE_DONE Update complete.`, null, 'UPDATE_DONE');
             }


            // TAREFA 3.1.10: Remover estado de processamento GERAL AQUI SOMENTE SE o listener específico
            // para o avanço do CEP NÃO foi quem removeu o estado.
            // A lógica em handleUpdatedCheckoutForCepAdvance já remove se a aba CEP estava ativa.
            // Se updated_checkout disparou e a aba CEP NÃO estava ativa, removemos aqui.
            // Isso evita remover o loading duas vezes ou não remover se a atualização veio de outro lugar.
             if ($('#tab-cep').hasClass('active') && $('#btn-avancar-para-endereco').hasClass('btn-processing')) {
                 // Se a aba CEP está ativa E o botão está em processamento, o listener .one() é quem vai limpar.
                 log('DEBUG     Aba CEP ativa com botão processando. Limpeza de estado será feita pelo listener .one() handleUpdatedCheckoutForCepAdvance.');
             } else {
                  // Se a aba CEP NÃO está ativa, ou o botão não estava processando (atualização veio de outro lugar),
                  // limpamos o estado geral aqui.
                  log('DEBUG     Limpando estado general de processamento (updated_checkout listener geral).');
                 setProcessingState(false, 'updated_checkout_general');
             }


             currentPhase = 'UI'; // Volta para fase UI após atualização

             // Após a atualização, re-garante que o método selecionado visualmente bate com o input checked
             // Procura a lista UL dentro do #order_review (agora na aba 4)
             var $shippingContainer = $('#tab-resumo-frete #order_review ul.shipping_method, #tab-resumo-frete #order_review ul[data-shipping-methods]').first();
             if ($shippingContainer.length) {
                  var checkedMethodValue = $shippingContainer.find('input[name^="shipping_method"]:checked').val();
                  log('DEBUG     updated_checkout: Capturando método selecionado após WC update: ' + checkedMethodValue, null, 'DEBUG');
                  // Aplica a classe 'active'/'selected' no LI correto usando o método checked
                  $shippingContainer.find('li').removeClass('active selected'); // Also remove 'selected'
                  $shippingContainer.find('input[value="' + checkedMethodValue + '"]').closest('li').addClass('active selected'); // Also add 'selected'

                  // TAREFA 4 (v3.1.16): Atualiza o valor do frete no resumo usando o preço ATUAL do método selecionado
                   var selectedMethod = $shippingContainer.find('li.active, li.selected');
                   if (selectedMethod.length) {
                        // Pega o texto do span com a classe .amount dentro do item selecionado
                        // Use .amount which is standard WC
                        var priceElement = selectedMethod.find('.amount').first();
                        if (priceElement.length) {
                           var priceText = priceElement.text();
                            // Atualiza o span dentro do resumo que TAMBÉM foi movido para a aba 4
                            $('#tab-resumo-frete #order_review .shipping-totals .amount').text(priceText);
                            log('DEBUG     Atualizado o custo do frete no resumo (#order_review .shipping-totals .amount) com preço do método selecionado.');
                        } else {
                             log('DEBUG     Não encontrei .amount no método de frete selecionado para atualizar custo no resumo.');
                        }
                   } else {
                        log('DEBUG     Nenhum método de frete selecionado encontrado dentro de #order_review após updated_checkout.');
                   }

             } else {
                  log('DEBUG     updated_checkout: Container de frete UL não encontrado dentro de #order_review (aba 4) para atualizar seleção visual.', null, 'DEBUG');
             }

             // Item 4: Atualizar estado do botão "Finalizar Pedido" (agora na aba 5)
             updatePlaceOrderButtonState();

             // TAREFA 2 (v3.1.6/3.1.7): Atualizar Total duplicado após a atualização do checkout
             renderDuplicateTotal();


             // TAREFA 1 (v3.1.6/3.1.7): Ensure order of elements within #tab-pagamento after updated_checkout
             // This is important because fragments might re-insert elements in the wrong order
             // Order Notes -> e-coupon-box -> Payment -> Standard Coupon Form
              var $paymentAfterUpdate = $('#tab-pagamento #payment');
              var $couponFormAfterUpdate = $('#tab-pagamento .checkout_coupon'); // Standard form (kept hidden)
              var $orderNotesAfterUpdate = $('#tab-pagamento .woocommerce-additional-fields__field-wrapper');
              var $customCouponBoxAfterUpdate = $('#tab-pagamento .e-coupon-box'); // Custom coupon box

             // Ensure elements are in the DOM after update (fragments might replace them)
             // And remove duplicates if any somehow reappeared
             if ($orderNotesAfterUpdate.length === 0) $orderNotesAfterUpdate = $('.woocommerce-additional-fields__field-wrapper').first().appendTo('#tab-pagamento');
             if ($couponFormAfterUpdate.length === 0) $couponFormAfterUpdate = $('.checkout_coupon').first().appendTo('#tab-pagamento');
             if ($paymentAfterUpdate.length === 0) $paymentAfterUpdate = $('#payment').first().appendTo('#tab-pagamento');
             if ($customCouponBoxAfterUpdate.length === 0) {
                 // TAREFA 1 (v3.1.7): If custom box is missing after fragments, try to find it elsewhere and move it
                 $customCouponBoxAfterUpdate = $('.e-coupon-box').first();
                 if ($customCouponBoxAfterUpdate.length && $('#tab-pagamento').length) {
                     $customCouponBoxAfterUpdate.appendTo('#tab-pagamento');
                      log('DEBUG     Custom coupon box found outside and moved into tab after updated_checkout.', null, 'UI');
                 } else {
                      log('DEBUG     Custom coupon box not found anywhere after updated_checkout.', null, 'UI');
                 }
             }

             // Remove any duplicate custom coupon boxes if they somehow appeared
             $('.e-coupon-box:not(:first)').remove();


             // Ensure order: Order Notes -> e-coupon-box -> Payment -> Standard Coupon Form
             if ($orderNotesAfterUpdate.length && $customCouponBoxAfterUpdate.length) {
                 $customCouponBoxAfterUpdate.insertAfter($orderNotesAfterUpdate);
                  log('DEBUG     Ensured order of custom coupon box after order notes after updated_checkout.', null, 'UI');
             } else if ($orderNotesAfterUpdate.length) {
                   // Fallback: if custom box is missing, ensure order notes is before payment
                   $orderNotesAfterUpdate.insertBefore($paymentAfterUpdate); // Position before payment
                   log('DEBUG     Ensured order of order notes before #payment (custom box missing) after updated_checkout.', null, 'UI');
             }

              if ($customCouponBoxAfterUpdate.length && $paymentAfterUpdate.length) {
                 $paymentAfterUpdate.insertAfter($customCouponBoxAfterUpdate);
                  log('DEBUG     Ensured order of #payment after custom coupon box after updated_checkout.', null, 'UI');
             } else if ($orderNotesAfterUpdate.length && $paymentAfterUpdate.length) {
                  // Fallback if custom box is missing
                 $paymentAfterUpdate.insertAfter($orderNotesAfterUpdate);
                  log('DEBUG     Ensured order of #payment after order notes (custom box missing) after updated_checkout.', null, 'UI');
             }


            // Ensure standard coupon form is after payment (it's hidden anyway)
            if ($couponFormAfterUpdate.length && $paymentAfterUpdate.length) {
                $couponFormAfterUpdate.insertAfter($paymentAfterUpdate);
                log('DEBUG     Ensured order of standard coupon form after #payment after updated_checkout.', null, 'UI');
            }

            // TAREFA 4 (v3.1.16): Resetar a flag de recálculo de frete para não bloquear o próximo update_checkout na aba 4
            recalcViaFrete = false;


        });

        // Listener para o evento 'frag_loaded' disparado pelo WooCommerce (para compatibilidade)
        // Isso acontece quando o WC carrega fragmentos, como ao aplicar um cupom ou mudar frete/pagamento
        // TAREFA 2 (v3.1.7): Chamar renderDuplicateTotal aqui também
        $(document.body).on('wc_fragment_refresh', function() {
             log('DEBUG     Evento wc_fragment_refresh detectado. Atualizando total duplicado.', null, 'UI');
             // Call the rendering function directly, it handles presence check and updates value
             renderDuplicateTotal();
        });


        // Listen for changes in shipping method selection (Mantido)
        // IMPORTANT: Search for the shipping method UL inside the moved #order_review
        // TAREFA 4 (v3.1.16): Este listener agora marca recalcViaFrete = true
        $(document).on('change', '#tab-resumo-frete #order_review input[name^="shipping_method"]', function() {
             actionStartTime = performance.now(); // Log B1: Início da ação do usuário (seleção de frete)
             log('ACTION    Método de frete selecionado alterado.', null, 'ACTION');

             var $this = $(this);
             var selectedValue = $this.val();

             // Add 'active' class to the selected list item and remove from others
              var $shippingContainer = $this.closest('ul.shipping_method, ul[data-shipping-methods]');
              if ($shippingContainer.length) {
                  $shippingContainer.find('li').removeClass('active selected'); // Also remove 'selected'
                  $this.closest('li').addClass('active selected'); // Also add 'selected'
                  log('DEBUG     Classe visual "active/selected" aplicada ao método selecionado.', null, 'UI');

                  // Atualiza o valor do frete no resumo usando o preço do item selecionado
                  // Procura dentro do container que foi movido para a aba 4
                  var selectedMethod = $shippingContainer.find('li.active, li.selected');
                   if (selectedMethod.length) {
                        // Pega o texto do span com a classe .amount dentro do item selecionado
                        // Use .amount which is standard WC
                        var priceElement = selectedMethod.find('.amount').first();
                        if (priceElement.length) {
                           var priceText = priceElement.text();
                            // Atualiza o span dentro do resumo que TAMBÉM foi movido para a aba 4
                            $('#tab-resumo-frete #order_review .shipping-totals .amount').text(priceText);
                            log('DEBUG     Atualizado o custo do frete no resumo (#order_review .shipping-totals .amount) com preço do método selecionado.', null, 'UI');
                        } else {
                             log('DEBUG     Não encontrei .amount no método de frete selecionado para atualizar custo no resumo.');
                        }
                   } else {
                        log('DEBUG     Nenhum método de frete selecionado encontrado dentro de #order_review após selection change.');
                   }


              } else {
                   log('AVISO     Container de frete UL não encontrado para aplicar classes visuais.');
              }

             // Trigger WC's standard checkout update
             // This will trigger updated_checkout after WC finishes its own AJAX update.
             log('DEBUG     Disparando trigger("update_checkout") após seleção de frete.');
             $(document.body).trigger('update_checkout');

             // The updated_checkout listener will handle removing processing state and updating place order button state

        });



        // === Inicialização ===
        // Ao carregar a página, capturar o método de frete padrão selecionado pelo WC (Mantido)
         $(window).on('load', function() {
              currentPhase = 'INIT';
              log('DEBUG     Página carregada. Iniciando script de abas.', null, 'DEBUG');

               // No load, #order_review JÁ DEVE TER SIDO MOVIDO para #tab-resumo-frete
               // E #payment, .checkout_coupon e o anchor de cupom JÁ DEVEM TER SIDO MOVIDOS para #tab-pagamento
              var $shippingContainer = $('#tab-resumo-frete #order_review ul.shipping_method, #tab-resumo-frete #order_review ul[data-shipping-methods]').first();
              if ($shippingContainer.length) {
                   var checkedMethodValue = $shippingContainer.find('input[name^="shipping_method"]:checked').val();
                   log('DEBUG     Método de frete selecionado na carga da página:', checkedMethodValue, 'DEBUG');
                   // Ensure visual class is set on load
                    $shippingContainer.find('li').removeClass('active selected');
                    $shippingContainer.find('input[value="' + checkedMethodValue + '"]').closest('li').addClass('active selected');

                    // Atualiza o valor do frete no resumo usando o preço ATUAL do método selecionado
                    // Procura dentro do container que foi movido para a aba 4
                    var selectedMethod = $shippingContainer.find('li.active, li.selected');
                    if (selectedMethod.length) {
                         var priceElement = selectedMethod.find('.amount').first();
                         if (priceElement.length) {
                            var priceText = priceElement.text();
                             $('#tab-resumo-frete #order_review .shipping-totals .amount').text(priceText);
                             log('DEBUG     Atualizado o custo do frete no resumo na carga da página.');
                         } else {
                              log('DEBUG     Não encontrei .amount no método selecionado na carga.');
                         }
                    } else {
                         log('DEBUG     Nenhum método de frete selecionado encontrado na carga.');
                    }

              } else {
                   log('DEBUG     Container de frete UL não encontrado dentro de #order_review (aba 4) na carga da página.', null, 'DEBUG');
              }
              currentPhase = 'UI'; // Volta para fase UI após inicialização

              // Na carga, atualiza o estado do botão finalizar
              updatePlaceOrderButtonState();

              // TAREFA 2 (v3.1.6/3.1.7): Renderizar e Atualizar Total duplicado na carga da página
              renderDuplicateTotal();

              // TAREFA 2 (v3.1.3): Remover chamada hide() no botão PLACE ORDER.
              // Ocultar o botão PLACE ORDER padrão na carga é agora tratado SOMENTE pelo CSS.
              // $('#place_order').hide(); // REMOVIDO

         });


    });
    </script>
    <?php
    endif;
}
add_action('wp_head', 'custom_checkout_assets');