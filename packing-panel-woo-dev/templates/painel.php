<?php
/**
 * Template do Painel de Empacotamento
 * 
 * Exibe o painel completo com abas Motoboy e Correios
 */
if (!defined('ABSPATH')) exit;

// Verifica permissões
if (!PPWOO_Security::can_manage_panel()) {
    echo '<p>' . esc_html__('Você não tem permissão para visualizar este painel.', 'painel-empacotamento') . '</p>';
    return;
}

// Busca pedidos
$motoboy_orders = PPWOO_Orders::get_motoboy_orders();
$correios_orders = PPWOO_Orders::get_correios_orders();
$pending_payment_orders = PPWOO_Orders::get_pending_payment_orders();
$total_pending_orders = PPWOO_Orders::get_total_pending_orders();

// Painel de debug se ativo
if (PPWOO_Config::is_debug()) {
    ?>
    <div id="pp-debug-panel">
        <button id="pp-debug-close">×</button>
        <textarea id="pp-debug-log" readonly placeholder="<?php esc_attr_e('Debug Log', 'painel-empacotamento'); ?>"></textarea>
        <button id="pp-debug-copy"><?php esc_html_e('Copiar Log', 'painel-empacotamento'); ?></button>
    </div>
    <?php
}
?>

<div class="painel-empacotamento">
    <header class="painel-header">
        <h1><?php esc_html_e('PackPanel', 'painel-empacotamento'); ?></h1>
        <div class="status-info">
            <span class="pendentes"><?php printf(esc_html__('%d pedidos pendentes', 'painel-empacotamento'), $total_pending_orders); ?></span>
        </div>
    </header>

    <div class="painel-tabs">
        <button class="tab-button" data-tab="motoboy"><?php esc_html_e('Motoboy', 'painel-empacotamento'); ?> (<?php echo count($motoboy_orders); ?>)</button>
        <button class="tab-button" data-tab="correios"><?php esc_html_e('Correios', 'painel-empacotamento'); ?> (<?php echo count($correios_orders); ?>)</button>
        <button class="tab-button" data-tab="pagamentos"><?php esc_html_e('Pagamentos Pendentes', 'painel-empacotamento'); ?> (<?php echo count($pending_payment_orders); ?>)</button>
    </div>

    <!-- Aba Motoboy -->
    <div id="tab-motoboy" class="tab-content">
        <?php if (!empty($motoboy_orders)) : ?>
            <div class="motoboy-orders">
                <?php
                foreach ($motoboy_orders as $order) :
                    $is_external = PPWOO_Utils::is_external_order($order);
                    $order_id = PPWOO_Utils::get_order_id($order);
                    $workflow_step = PPWOO_Utils::get_workflow_step($order);
                    if ('step1' === $workflow_step || !$workflow_step) {
                        $workflow_style = 'transform: translateX(0);';
                    } elseif ('step2' === $workflow_step) {
                        $workflow_style = 'transform: translateX(-50%);';
                    } else {
                        $workflow_style = 'transform: translateX(0);';
                    }

                    // Meta campos do workflow (apenas para pedidos WooCommerce)
                    $tracking_link = $is_external ? (isset($order['tracking_link']) ? $order['tracking_link'] : '') : ($order instanceof WC_Order ? $order->get_meta('_packing_panel_tracking_link') : '');
                    $delivery_deadline = $is_external ? (isset($order['delivery_deadline']) ? $order['delivery_deadline'] : '') : ($order instanceof WC_Order ? $order->get_meta('_packing_panel_delivery_deadline') : '');
                    $shipping_paid_cost = $is_external ? (isset($order['shipping_paid_cost']) ? $order['shipping_paid_cost'] : '') : ($order instanceof WC_Order ? $order->get_meta('_packing_panel_shipping_paid_cost') : '');
                    $motoboy_whatsapp = $is_external ? (isset($order['motoboy_whatsapp']) ? $order['motoboy_whatsapp'] : '') : ($order instanceof WC_Order ? $order->get_meta('_packing_panel_motoboy_whatsapp') : '');
                    $used_coupons = PPWOO_Utils::get_coupon_codes($order);
                    ?>
                    <div class="motoboy-order" data-order-id="<?php echo esc_attr($order_id); ?>" data-workflow-step="<?php echo esc_attr($workflow_step ? $workflow_step : 'step1'); ?>">
                        <div class="order-header">
                            <h3>Pedido #<?php echo esc_html($order_id); ?></h3>
                            <span class="metodo-envio motoboy"><?php esc_html_e('Motoboy', 'painel-empacotamento'); ?></span>
                        </div>

                        <div class="order-client-info">
                            <h4><?php esc_html_e('Cliente', 'painel-empacotamento'); ?>:</h4>
                            <p class="client-name-to-copy">
                                <?php echo esc_html(PPWOO_Utils::get_billing_first_name($order) . ' ' . PPWOO_Utils::get_billing_last_name($order)); ?>
                                <button class="copy-button copy-name" title="<?php esc_attr_e('Copiar Nome', 'painel-empacotamento'); ?>">
                                    <span class="dashicons dashicons-admin-page"></span>
                                </button>
                            </p>
                            <h4><?php esc_html_e('WhatsApp', 'painel-empacotamento'); ?>:</h4>
                            <p class="whatsapp-to-copy">
                                <?php echo esc_html(PPWOO_Utils::get_billing_cellphone($order)); ?>
                                <button class="copy-button copy-whatsapp" title="<?php esc_attr_e('Copiar WhatsApp', 'painel-empacotamento'); ?>">
                                    <span class="dashicons dashicons-admin-page"></span>
                                </button>
                            </p>
                        </div>

                        <div class="order-address">
                            <h4><?php esc_html_e('Endereço', 'painel-empacotamento'); ?>:</h4>
                            <p class="address-to-copy">
                                <?php
                                $address = PPWOO_Utils::get_billing_address_1($order);
                                $number = PPWOO_Utils::get_billing_number($order);
                                $neighborhood = PPWOO_Utils::get_billing_neighborhood($order);
                                $city = PPWOO_Utils::get_billing_city($order);
                                echo esc_html(
                                    $address
                                    . ($number ? ' nº ' . $number : '')
                                    . ($neighborhood ? ', ' . $neighborhood : '')
                                    . ($city ? ', ' . $city : '')
                                );
                                ?>
                                <button class="copy-button copy-address" title="<?php esc_attr_e('Copiar Endereço', 'painel-empacotamento'); ?>">
                                    <span class="dashicons dashicons-admin-page"></span>
                                </button>
                            </p>
                            <p class="cep">CEP: <?php echo esc_html(PPWOO_Utils::get_billing_postcode($order)); ?></p>
                            <p class="billing-complemento"><?php echo esc_html(PPWOO_Utils::get_billing_complemento($order)); ?></p>
                            <?php if (PPWOO_Utils::get_customer_note($order)) : ?>
                                <p class="woocommerce-additional-fields__field-wrapper">
                                    <strong><?php esc_html_e('Nota do Cliente:', 'painel-empacotamento'); ?></strong><br>
                                    <?php echo esc_html(PPWOO_Utils::get_customer_note($order)); ?>
                                </p>
                            <?php endif; ?>
                        </div>

                        <div class="order-products">
                            <h4><?php esc_html_e('Produtos', 'painel-empacotamento'); ?>:</h4>
                            <ul class="product-list">
                                <?php
                                $items = PPWOO_Utils::get_order_items($order);
                                foreach ($items as $item) :
                                    $image_url = isset($item['image_url']) ? $item['image_url'] : wc_placeholder_img_url();
                                    ?>
                                    <li>
                                        <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($item['name']); ?>" width="48" height="48">
                                        <span><?php echo esc_html($item['name']); ?> (x<?php echo esc_html($item['quantity']); ?>)</span>
                                    </li>
                                    <?php
                                endforeach;
                                ?>
                            </ul>
                        </div>

                        <?php if (!empty($used_coupons)) : ?>
                            <div class="order-coupons">
                                <h4><?php esc_html_e('Cupom(ns) Usado(s)', 'painel-empacotamento'); ?>:</h4>
                                <p><?php echo esc_html(implode(', ', $used_coupons)); ?></p>
                            </div>
                        <?php endif; ?>

                        <div class="order-values">
                            <p><strong><?php esc_html_e('Total Pedido', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price(PPWOO_Utils::get_order_total($order)); ?></p>
                            <p><strong><?php esc_html_e('Total Frete', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price(PPWOO_Utils::get_shipping_total($order)); ?></p>
                        </div>

                        <div class="workflow-area">
                            <?php if ($is_external) : ?>
                                <p class="description" style="padding: 15px; background: #f0f0f0; border-radius: 4px;">
                                    <?php esc_html_e('Pedido externo (somente leitura). Ações de workflow não disponíveis.', 'painel-empacotamento'); ?>
                                </p>
                            <?php else : ?>
                            <div class="workflow-slides" style="<?php echo esc_attr($workflow_style); ?>">
                                <div class="workflow-step step-1">
                                    <button class="slide-button btn-accept-order">
                                        <?php esc_html_e('Aceitar Pedido', 'painel-empacotamento'); ?>
                                        <span class="dashicons dashicons-arrow-right-alt2"></span>
                                    </button>
                                </div>
                                <div class="workflow-step step-2">
                                    <h4><?php esc_html_e('Detalhes do Envio', 'painel-empacotamento'); ?>:</h4>

                                    <label><?php esc_html_e('Link Rastreio:', 'painel-empacotamento'); ?></label>
                                    <input type="text" class="tracking-link" value="<?php echo esc_attr($tracking_link); ?>">

                                    <label><?php esc_html_e('Prazo:', 'painel-empacotamento'); ?></label>
                                    <input
                                        type="text"
                                        class="delivery-deadline"
                                        value="<?php echo esc_attr($delivery_deadline); ?>"
                                        placeholder="Ex: Hoje até 18h"
                                    >

                                    <label><?php esc_html_e('Custo Frete Pago (R$):', 'painel-empacotamento'); ?></label>
                                    <input
                                        type="number"
                                        class="shipping-cost"
                                        value="<?php echo esc_attr(str_replace('.', ',', $shipping_paid_cost)); ?>"
                                        placeholder="Ex: 15,50"
                                        step="0.01"
                                        inputmode="decimal"
                                    >

                                    <label><?php esc_html_e('Código de Finalização:', 'painel-empacotamento'); ?></label>
                                    <input
                                        type="number"
                                        class="finalization-code"
                                        inputmode="numeric"
                                    >

                                    <label><?php esc_html_e('WhatsApp Motoboy:', 'painel-empacotamento'); ?></label>
                                    <input
                                        type="tel"
                                        class="motoboy-whatsapp"
                                        placeholder="(99) 99999-9999"
                                        value="<?php echo esc_attr($motoboy_whatsapp); ?>"
                                    >

                                    <button class="slide-button btn-conclude-shipment">
                                        <?php esc_html_e('Concluir Envio', 'painel-empacotamento'); ?>
                                        <span class="dashicons dashicons-yes"></span>
                                    </button>
                                </div>
                            </div>
                            <div class="loading-indicator" style="display: none;">
                                <span class="dashicons dashicons-update spin"></span>
                                <?php esc_html_e('Processando...', 'painel-empacotamento'); ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php
                endforeach;
                ?>
            </div>
        <?php else : ?>
            <p class="sem-pedidos"><?php esc_html_e('Nenhum pedido de Motoboy pendente para empacotamento.', 'painel-empacotamento'); ?></p>
        <?php endif; ?>
    </div>

    <!-- Aba Correios -->
    <div id="tab-correios" class="tab-content">
        <?php if (!empty($correios_orders)) : ?>
            <div class="pedidos-carousel-wrapper">
                <div class="pedidos-carousel">
                    <?php
                    foreach ($correios_orders as $index => $order) :
                        $order_id = PPWOO_Utils::get_order_id($order);
                        $shipping_methods = PPWOO_Utils::get_shipping_methods($order);
                        ?>
                        <div class="pedido-container carousel-item" data-order-id="<?php echo esc_attr($order_id); ?>">
                            <div class="order-header">
                                <h3>Pedido #<?php echo esc_html($order_id); ?></h3>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <span class="metodo-envio correios">
                                        <?php
                                        if (!empty($shipping_methods)) {
                                            $first_method = reset($shipping_methods);
                                            echo esc_html($first_method['method_title']);
                                        } else {
                                            esc_html_e('Frete não especificado', 'painel-empacotamento');
                                        }
                                        ?>
                                    </span>
                                    <?php if (PPWOO_Utils::is_whatsapp_order($order)) : ?>
                                        <span class="ppwoo-whatsapp-badge"><?php esc_html_e('WhatsApp', 'painel-empacotamento'); ?></span>
                                    <?php endif; ?>
                                </div>
                            </div>

                            <div class="order-client-info">
                                <h4><?php esc_html_e('Cliente', 'painel-empacotamento'); ?>:</h4>
                                <p><?php echo esc_html(PPWOO_Utils::get_billing_first_name($order) . ' ' . PPWOO_Utils::get_billing_last_name($order)); ?></p>
                                <h4><?php esc_html_e('WhatsApp', 'painel-empacotamento'); ?>:</h4>
                                <p><?php echo esc_html(PPWOO_Utils::get_billing_cellphone($order)); ?></p>
                            </div>

                            <div class="order-address">
                                <h4><?php esc_html_e('Endereço', 'painel-empacotamento'); ?>:</h4>
                                <p>
                                    <?php
                                    $address = PPWOO_Utils::get_billing_address_1($order);
                                    $number = PPWOO_Utils::get_billing_number($order);
                                    $bairro = PPWOO_Utils::get_billing_neighborhood($order);
                                    $city = PPWOO_Utils::get_billing_city($order);
                                    $state = PPWOO_Utils::get_billing_state($order);

                                    $full_address = trim($address . ($number ? ' nº ' . $number : ''));
                                    if (!empty($bairro)) {
                                        $full_address .= ', ' . esc_html($bairro);
                                    }
                                    if (!empty($city)) {
                                        $full_address .= ', ' . esc_html($city);
                                    }
                                    if (!empty($state)) {
                                        $full_address .= ' - ' . esc_html($state);
                                    }
                                    echo esc_html($full_address);
                                    ?>
                                </p>
                                <p class="cep">CEP: <?php echo esc_html(PPWOO_Utils::get_billing_postcode($order)); ?></p>
                                <p class="billing-complemento"><?php echo esc_html(PPWOO_Utils::get_billing_complemento($order)); ?></p>
                                <?php if (PPWOO_Utils::get_customer_note($order)) : ?>
                                    <p class="woocommerce-additional-fields__field-wrapper">
                                        <strong><?php esc_html_e('Nota do Cliente:', 'painel-empacotamento'); ?></strong><br>
                                        <?php echo esc_html(PPWOO_Utils::get_customer_note($order)); ?>
                                    </p>
                                <?php endif; ?>
                            </div>

                            <div class="order-products">
                                <h4><?php esc_html_e('Produtos', 'painel-empacotamento'); ?>:</h4>
                                <ul class="product-list">
                                    <?php
                                    $items = PPWOO_Utils::get_order_items($order);
                                    foreach ($items as $item) :
                                        $image_url = isset($item['image_url']) ? $item['image_url'] : wc_placeholder_img_url();
                                        ?>
                                        <li>
                                            <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($item['name']); ?>" width="48" height="48">
                                            <span><?php echo esc_html($item['name']); ?> (x<?php echo esc_html($item['quantity']); ?>)</span>
                                        </li>
                                        <?php
                                    endforeach;
                                    ?>
                                </ul>
                            </div>

                            <?php
                            $used_coupons = PPWOO_Utils::get_coupon_codes($order);
                            if (!empty($used_coupons)) :
                                ?>
                                <div class="order-coupons">
                                    <h4><?php esc_html_e('Cupom(ns) Usado(s)', 'painel-empacotamento'); ?>:</h4>
                                    <p><?php echo esc_html(implode(', ', $used_coupons)); ?></p>
                                </div>
                            <?php endif; ?>

                            <div class="order-values">
                                <p><strong><?php esc_html_e('Total Pedido', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price(PPWOO_Utils::get_order_total($order)); ?></p>
                                <p><strong><?php esc_html_e('Total Frete', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price(PPWOO_Utils::get_shipping_total($order)); ?></p>
                            </div>

                            <div class="order-actions">
                                <?php if (PPWOO_Utils::is_external_order($order)) : ?>
                                    <p class="description" style="padding: 15px; background: #f0f0f0; border-radius: 4px;">
                                        <?php esc_html_e('Pedido externo (somente leitura). Ações de workflow não disponíveis.', 'painel-empacotamento'); ?>
                                    </p>
                                <?php else : ?>
                                <button class="slide-button btn-conclude-shipment-correios">
                                    <?php esc_html_e('Concluir Envio', 'painel-empacotamento'); ?>
                                    <span class="dashicons dashicons-yes"></span>
                                </button>
                                <div class="loading-indicator" style="display: none;">
                                    <span class="dashicons dashicons-update spin"></span>
                                    <?php esc_html_e('Processando...', 'painel-empacotamento'); ?>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php
                    endforeach;
                    ?>
                </div>
                <?php if (count($correios_orders) > 1) : ?>
                    <div class="carousel-navigation">
                        <button class="nav-prev"><?php esc_html_e('Anterior', 'painel-empacotamento'); ?></button>
                        <button class="nav-next"><?php esc_html_e('Próximo', 'painel-empacotamento'); ?></button>
                    </div>
                <?php endif; ?>
            </div>
        <?php else : ?>
            <p class="sem-pedidos"><?php esc_html_e('Nenhum pedido de Correios pendente para empacotamento.', 'painel-empacotamento'); ?></p>
        <?php endif; ?>
    </div>

    <!-- Aba Pagamentos Pendentes -->
    <div id="tab-pagamentos" class="tab-content">
        <?php if (!empty($pending_payment_orders)) : ?>
            <div class="pagamentos-carousel-wrapper">
                <div class="pagamentos-carousel">
                    <?php foreach ($pending_payment_orders as $order) : ?>
                        <?php
                        $order_id = $order->get_id();
                        $created = $order->get_date_created();
                        $created_display = $created ? $created->date_i18n('d/m/Y H:i') : '';
                        $client_name = trim(PPWOO_Utils::get_billing_first_name($order) . ' ' . PPWOO_Utils::get_billing_last_name($order));
                        $pix_identifier = PPWOO_Utils::get_pix_identifier($order);
                        ?>
                        <div class="pedido-container carousel-item" data-order-id="<?php echo esc_attr($order_id); ?>">
                            <div class="order-header">
                                <h3>Pedido #<?php echo esc_html($order_id); ?></h3>
                                <span class="metodo-envio pagamentos"><?php esc_html_e('Pagamento Pendente', 'painel-empacotamento'); ?></span>
                            </div>

                            <div class="order-client-info">
                                <h4><?php esc_html_e('Cliente', 'painel-empacotamento'); ?>:</h4>
                                <p><?php echo esc_html($client_name); ?></p>
                                <h4><?php esc_html_e('Data/Hora', 'painel-empacotamento'); ?>:</h4>
                                <p><?php echo esc_html($created_display); ?></p>
                            </div>

                            <div class="order-values">
                                <p><strong><?php esc_html_e('Total Pedido', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price($order->get_total()); ?></p>
                                <p><strong><?php esc_html_e('Total Frete', 'painel-empacotamento'); ?>:</strong> <?php echo wc_price($order->get_shipping_total()); ?></p>
                            </div>

                            <div class="order-address">
                                <h4><?php esc_html_e('Pix (identificador)', 'painel-empacotamento'); ?>:</h4>
                                <p class="pix-to-copy"><?php echo esc_html($pix_identifier); ?></p>
                            </div>

                            <div class="order-actions">
                                <button class="slide-button ppwoo-btn-confirm-payment"><?php esc_html_e('Confirmar pagamento', 'painel-empacotamento'); ?></button>
                                <button class="slide-button ppwoo-btn-deny-payment"><?php esc_html_e('Negar pagamento', 'painel-empacotamento'); ?></button>
                                <div class="loading-indicator" style="display: none;">
                                    <span class="dashicons dashicons-update spin"></span>
                                    <?php esc_html_e('Processando...', 'painel-empacotamento'); ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <?php if (count($pending_payment_orders) > 1) : ?>
                    <div class="carousel-navigation">
                        <button class="nav-prev"><?php esc_html_e('Anterior', 'painel-empacotamento'); ?></button>
                        <button class="nav-next"><?php esc_html_e('Próximo', 'painel-empacotamento'); ?></button>
                    </div>
                <?php endif; ?>
            </div>
        <?php else : ?>
            <p class="sem-pedidos"><?php esc_html_e('Nenhum pagamento pendente encontrado.', 'painel-empacotamento'); ?></p>
        <?php endif; ?>
    </div>

    <div class="sem-pedidos-global" style="display: none;">
        <!-- Exibido quando ambas as abas não têm pedidos pendentes -->
    </div>
</div>
