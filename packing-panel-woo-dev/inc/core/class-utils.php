<?php
/**
 * Classe de utilitários
 * 
 * Funções auxiliares para formatação, sanitização e helpers
 */
if (!defined('ABSPATH')) exit;

class PPWOO_Utils {
    
    /**
     * Obtém o CPF do pedido sanitizado (apenas dígitos)
     * 
     * @param WC_Order $order Objeto do pedido
     * @return string CPF com apenas dígitos ou string vazia
     */
    public static function get_order_billing_cpf($order) {
        $cpf = $order->get_meta('billing_cpf');
        return preg_replace('/\D+/', '', (string) $cpf);
    }
    
    /**
     * Formata número de telefone/WhatsApp
     * 
     * @param string $phone Número bruto
     * @return string Número apenas com dígitos
     */
    public static function sanitize_phone($phone) {
        return preg_replace('/\D+/', '', $phone);
    }
    
    /**
     * Formata valor monetário para salvar no banco
     * 
     * @param string $value Valor com vírgula ou ponto
     * @return float|string Valor formatado ou string vazia
     */
    public static function format_shipping_cost($value) {
        $sanitized = str_replace(',', '.', sanitize_text_field($value));
        return is_numeric($sanitized) ? floatval($sanitized) : '';
    }
    
    /**
     * Obtém URL de imagem placeholder com fallback seguro
     * 
     * @return string URL da imagem placeholder
     */
    private static function get_placeholder_image_url() {
        if (function_exists('wc_placeholder_img_url')) {
            return wc_placeholder_img_url();
        }
        // Fallback para placeholder padrão do WordPress
        return includes_url('images/media/default.png');
    }
    
    /**
     * Prepara dados de rastreio para salvar no pedido
     * 
     * @param array $tracking_data Dados brutos do rastreio
     * @param WC_Order $order Objeto do pedido
     */
    public static function save_tracking_data($tracking_data, $order) {
        if (empty($tracking_data)) {
            return;
        }
        
        if (isset($tracking_data['link'])) {
            $order->update_meta_data('_packing_panel_tracking_link', sanitize_text_field($tracking_data['link']));
        }
        
        if (isset($tracking_data['deadline'])) {
            $order->update_meta_data('_packing_panel_delivery_deadline', sanitize_text_field($tracking_data['deadline']));
        }
        
        if (isset($tracking_data['cost'])) {
            $formatted_cost = self::format_shipping_cost($tracking_data['cost']);
            $order->update_meta_data('_packing_panel_shipping_paid_cost', $formatted_cost);
        }
        
        if (isset($tracking_data['finalization_code'])) {
            $order->update_meta_data('_packing_panel_finalization_code', absint($tracking_data['finalization_code']));
        }
        
        if (isset($tracking_data['motoboy_whatsapp'])) {
            $sanitized_whatsapp = self::sanitize_phone($tracking_data['motoboy_whatsapp']);
            $order->update_meta_data('_packing_panel_motoboy_whatsapp', $sanitized_whatsapp);
        }
    }
    
    /**
     * Prepara payload de itens do pedido para webhook
     * 
     * @param WC_Order $order Objeto do pedido
     * @return array Array de itens formatados
     */
    public static function prepare_order_items_payload($order) {
        return array_map(function($item) {
            $product = $item->get_product();
            return array(
                'product_id' => $item->get_product_id(),
                'variation_id' => $item->get_variation_id(),
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => wc_format_decimal($item->get_total(), 2),
                'sku' => $product ? $product->get_sku() : '',
                'image_url' => $product && $product->get_image_id() 
                    ? wp_get_attachment_image_url($product->get_image_id(), 'thumbnail') 
                    : self::get_placeholder_image_url(),
            );
        }, $order->get_items());
    }
    
    /**
     * Verifica se um pedido é do WhatsApp
     * 
     * @param WC_Order|array $order Objeto do pedido WooCommerce ou array de pedido externo
     * @return bool
     */
    public static function is_whatsapp_order($order) {
        // Filtro para permitir customização da detecção
        $is_whatsapp = apply_filters('ppwoo_is_whatsapp_order', null, $order);
        
        if ($is_whatsapp !== null) {
            return (bool) $is_whatsapp;
        }
        
        // Para pedidos WooCommerce
        if ($order instanceof WC_Order) {
            $channel = $order->get_meta('_ppwoo_channel');
            return $channel === 'whatsapp';
        }
        
        // Para pedidos externos (array)
        if (is_array($order)) {
            if (isset($order['channel']) && $order['channel'] === 'whatsapp') {
                return true;
            }
            if (isset($order['source']) && $order['source'] === 'whatsapp') {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Verifica se um pedido é externo (array normalizado)
     * 
     * @param WC_Order|array $order
     * @return bool
     */
    public static function is_external_order($order) {
        return is_array($order) && isset($order['_is_external']) && $order['_is_external'] === true;
    }
    
    /**
     * Obtém o ID do pedido (WooCommerce ou externo)
     * 
     * @param WC_Order|array $order
     * @return int
     */
    public static function get_order_id($order) {
        if ($order instanceof WC_Order) {
            return $order->get_id();
        }
        if (is_array($order) && isset($order['id'])) {
            return intval($order['id']);
        }
        return 0;
    }

    /**
     * Obtém o identificador Pix (payload copia/cola) do pedido
     *
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_pix_identifier($order) {
        $meta = null;

        if ($order instanceof WC_Order) {
            $meta = $order->get_meta('__ASAAS_ORDER');
        } elseif (is_array($order) && isset($order['__ASAAS_ORDER'])) {
            $meta = $order['__ASAAS_ORDER'];
        }

        if (is_object($meta)) {
            $meta = (array) $meta;
        }

        if (is_array($meta)) {
            if (!empty($meta['payload'])) {
                return (string) $meta['payload'];
            }
            if (!empty($meta['pix_payload'])) {
                return (string) $meta['pix_payload'];
            }
            if (!empty($meta['pixCopyPaste'])) {
                return (string) $meta['pixCopyPaste'];
            }
            if (!empty($meta['pix_copy_paste'])) {
                return (string) $meta['pix_copy_paste'];
            }
            if (!empty($meta['pix']) && is_array($meta['pix'])) {
                if (!empty($meta['pix']['payload'])) {
                    return (string) $meta['pix']['payload'];
                }
                if (!empty($meta['pix']['copyPaste'])) {
                    return (string) $meta['pix']['copyPaste'];
                }
            }
        }

        if ($order instanceof WC_Order) {
            $fallback = $order->get_meta('_pix_payload');
            if (!empty($fallback)) {
                return (string) $fallback;
            }
        }

        return '';
    }

    /**
     * Obtém o payment_id do pedido
     *
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_payment_id_from_order($order) {
        $meta = null;

        if ($order instanceof WC_Order) {
            $meta = $order->get_meta('__ASAAS_ORDER');
        } elseif (is_array($order) && isset($order['__ASAAS_ORDER'])) {
            $meta = $order['__ASAAS_ORDER'];
        }

        if (is_object($meta)) {
            $meta = (array) $meta;
        }

        if (is_array($meta)) {
            if (!empty($meta['id'])) {
                return (string) $meta['id'];
            }
            if (!empty($meta['payment_id'])) {
                return (string) $meta['payment_id'];
            }
            if (!empty($meta['paymentId'])) {
                return (string) $meta['paymentId'];
            }
        }

        return '';
    }
    
    /**
     * Obtém o primeiro nome do billing
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_first_name($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_first_name();
        }
        if (is_array($order) && isset($order['billing']['first_name'])) {
            return $order['billing']['first_name'];
        }
        return '';
    }
    
    /**
     * Obtém o sobrenome do billing
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_last_name($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_last_name();
        }
        if (is_array($order) && isset($order['billing']['last_name'])) {
            return $order['billing']['last_name'];
        }
        return '';
    }
    
    /**
     * Obtém o celular/WhatsApp do billing
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_cellphone($order) {
        if ($order instanceof WC_Order) {
            return $order->get_meta('_billing_cellphone');
        }
        if (is_array($order) && isset($order['billing']['cellphone'])) {
            return $order['billing']['cellphone'];
        }
        return '';
    }
    
    /**
     * Obtém o endereço 1 do billing
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_address_1($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_address_1();
        }
        if (is_array($order) && isset($order['billing']['address_1'])) {
            return $order['billing']['address_1'];
        }
        return '';
    }
    
    /**
     * Obtém o número do endereço
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_number($order) {
        if ($order instanceof WC_Order) {
            return $order->get_meta('_billing_number');
        }
        if (is_array($order) && isset($order['billing']['number'])) {
            return $order['billing']['number'];
        }
        return '';
    }
    
    /**
     * Obtém o bairro
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_neighborhood($order) {
        if ($order instanceof WC_Order) {
            return $order->get_meta('_billing_neighborhood');
        }
        if (is_array($order) && isset($order['billing']['neighborhood'])) {
            return $order['billing']['neighborhood'];
        }
        return '';
    }
    
    /**
     * Obtém a cidade
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_city($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_city();
        }
        if (is_array($order) && isset($order['billing']['city'])) {
            return $order['billing']['city'];
        }
        return '';
    }
    
    /**
     * Obtém o estado
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_state($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_state();
        }
        if (is_array($order) && isset($order['billing']['state'])) {
            return $order['billing']['state'];
        }
        return '';
    }
    
    /**
     * Obtém o CEP
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_postcode($order) {
        if ($order instanceof WC_Order) {
            return $order->get_billing_postcode();
        }
        if (is_array($order) && isset($order['billing']['postcode'])) {
            return $order['billing']['postcode'];
        }
        return '';
    }
    
    /**
     * Obtém o complemento
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_billing_complemento($order) {
        if ($order instanceof WC_Order) {
            return $order->get_meta('_billing_complemento');
        }
        if (is_array($order) && isset($order['billing']['complement'])) {
            return $order['billing']['complement'];
        }
        return '';
    }
    
    /**
     * Obtém a nota do cliente
     * 
     * @param WC_Order|array $order
     * @return string
     */
    public static function get_customer_note($order) {
        if ($order instanceof WC_Order) {
            return $order->get_customer_note();
        }
        if (is_array($order) && isset($order['customer_note'])) {
            return $order['customer_note'];
        }
        return '';
    }
    
    /**
     * Obtém o total do pedido
     * 
     * @param WC_Order|array $order
     * @return float
     */
    public static function get_order_total($order) {
        if ($order instanceof WC_Order) {
            return $order->get_total();
        }
        if (is_array($order) && isset($order['total'])) {
            return floatval($order['total']);
        }
        return 0.0;
    }
    
    /**
     * Obtém o total do frete
     * 
     * @param WC_Order|array $order
     * @return float
     */
    public static function get_shipping_total($order) {
        if ($order instanceof WC_Order) {
            return $order->get_shipping_total();
        }
        if (is_array($order) && isset($order['shipping_total'])) {
            return floatval($order['shipping_total']);
        }
        return 0.0;
    }
    
    /**
     * Obtém os cupons usados
     * 
     * @param WC_Order|array $order
     * @return array
     */
    public static function get_coupon_codes($order) {
        if ($order instanceof WC_Order) {
            return $order->get_coupon_codes();
        }
        if (is_array($order) && isset($order['coupons']) && is_array($order['coupons'])) {
            return $order['coupons'];
        }
        return array();
    }
    
    /**
     * Obtém os métodos de envio
     * 
     * @param WC_Order|array $order
     * @return array Array de arrays com method_id, method_title, total
     */
    public static function get_shipping_methods($order) {
        if ($order instanceof WC_Order) {
            $methods = array();
            foreach ($order->get_shipping_methods() as $method) {
                $methods[] = array(
                    'method_id' => $method->get_method_id(),
                    'method_title' => $method->get_method_title(),
                    'total' => floatval($method->get_total()),
                );
            }
            return $methods;
        }
        if (is_array($order) && isset($order['shipping_methods']) && is_array($order['shipping_methods'])) {
            return $order['shipping_methods'];
        }
        return array();
    }
    
    /**
     * Obtém os itens do pedido
     * 
     * @param WC_Order|array $order
     * @return array Array de arrays com product_id, name, quantity, image_url, etc.
     */
    public static function get_order_items($order) {
        if ($order instanceof WC_Order) {
            $items = array();
            foreach ($order->get_items() as $item_id => $item) {
                $product = $item->get_product();
                $image_id = $product ? $product->get_image_id() : 0;
                $items[] = array(
                    'item_id' => $item_id,
                    'product_id' => $item->get_product_id(),
                    'variation_id' => $item->get_variation_id(),
                    'name' => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'total' => floatval($item->get_total()),
                    'image_url' => $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : self::get_placeholder_image_url(),
                );
            }
            return $items;
        }
        if (is_array($order) && isset($order['items']) && is_array($order['items'])) {
            return $order['items'];
        }
        return array();
    }
    
    /**
     * Obtém o workflow step
     * 
     * @param WC_Order|array $order
     * @return string|null
     */
    public static function get_workflow_step($order) {
        if ($order instanceof WC_Order) {
            return $order->get_meta('_packing_panel_workflow_step');
        }
        if (is_array($order) && isset($order['workflow_step'])) {
            return $order['workflow_step'];
        }
        return null;
    }
}
