<?php
if (!defined('ABSPATH')) exit;

/** Apresentação apenas: nunca emite cobrança ou confirma pagamento. */
final class CTWPML_Thankyou {
    public static function debug(string $event, string $state = ''): void {
        if (!(int)get_option('ctwpml_thankyou_debug',0) || !function_exists('wc_get_logger')) return;
        if (!in_array($event,['state_changed','tracking_unavailable'],true)) return;
        $safe_state=in_array($state,['pending','paid','cancelled','failed','refunded'],true)?$state:'';
        wc_get_logger()->info($event . ($safe_state?': '.$safe_state:''),['source'=>'ctwpml-thankyou']);
    }
    public static function init(): void {
        add_shortcode('checkout_ml_obrigado', [__CLASS__, 'render']);
        add_action('template_redirect', [__CLASS__, 'privacy'], 0);
        add_filter('template_include', [__CLASS__, 'template'], 100);
        add_filter('woocommerce_get_checkout_order_received_url', [__CLASS__, 'received_url'], 20, 2);
        add_action('wp_enqueue_scripts', [__CLASS__, 'assets']);
        add_action('wp_ajax_ctwpml_thankyou_status', [__CLASS__, 'status']);
        add_action('wp_ajax_nopriv_ctwpml_thankyou_status', [__CLASS__, 'status']);
        add_action('admin_init', [__CLASS__, 'settings']);
    }
    public static function page(): bool {
        if (ctwpml_is_visual_editor() || !function_exists('is_page') || !is_page()) return false;
        $post = get_queried_object();
        return $post instanceof WP_Post && ((int) get_option('ctwpml_thankyou_page', 0) === $post->ID || has_shortcode($post->post_content, 'checkout_ml_obrigado'));
    }
    public static function privacy(): void {
        if (!self::page()) return;
        if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
        nocache_headers();
        header('Referrer-Policy: no-referrer');
        header('X-Robots-Tag: noindex, nofollow', true);
    }
    public static function template($template) {
        return self::page() ? CHECKOUT_TABS_WP_ML_DIR . 'templates/thankyou-shell.php' : $template;
    }
    public static function received_url($url, $order) {
        $page = (int) get_option('ctwpml_thankyou_page', 0);
        if (!$page || get_post_status($page) !== 'publish') return $url;
        $post = get_post($page);
        if (!$post || !has_shortcode($post->post_content, 'checkout_ml_obrigado')) return $url;
        return add_query_arg(['order_id' => $order->get_id(), 'key' => $order->get_order_key()], get_permalink($page));
    }
    public static function authorize(int $id, string $key) {
        $order = wc_get_order($id);
        if (!$order instanceof WC_Order) return null;
        $owner = is_user_logged_in() && (int) $order->get_user_id() > 0 && (int) $order->get_user_id() === get_current_user_id();
        $valid_key = $key !== '' && hash_equals((string) $order->get_order_key(), $key);
        return ($owner || $valid_key) ? $order : null;
    }
    public static function state($order): string {
        if ($order->has_status(['cancelled', 'refunded', 'failed'])) return $order->get_status();
        return $order->is_paid() ? 'paid' : 'pending';
    }
    public static function tracking($order): string {
        if (! $order->is_paid() || !class_exists('PPWOO_Order_Tracking') || !class_exists('PPWOO_Utils') || !PPWOO_Utils::is_motoboy_shipping($order)) return '';
        try {
            $stop = PPWOO_Routes_Store::ready() ? PPWOO_Routes_Store::stop($order->get_id()) : null;
            $route = $stop ? PPWOO_Routes_Store::route($stop['route_id']) : null;
            return $route && $route['state'] !== 'draft' ? PPWOO_Order_Tracking::link($route, $stop) : PPWOO_Order_Tracking::order_link($order);
        } catch (Throwable $e) { self::debug('tracking_unavailable'); return ''; }
    }
    public static function status(): void {
        nocache_headers();
        $id = absint($_POST['order_id'] ?? 0);
        if (!check_ajax_referer('ctwpml_ty_' . $id, 'nonce', false)) wp_send_json_error(['message'=>'Reabra a página do seu pedido.'], 403);
        $order = self::authorize($id, sanitize_text_field(wp_unslash($_POST['key'] ?? '')));
        if (!$order) wp_send_json_error(['message'=>'Não foi possível acessar este pedido.'], 403);
        // Limite de leitura por pedido e origem; nunca usa cabeçalhos de proxy como prova de identidade.
        $bucket = 'ctwpml_ty_' . hash('sha256', $id . '|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . floor(time()/60));
        $count = (int) get_transient($bucket);
        if ($count >= 40) wp_send_json_error(['message'=>'Aguarde alguns instantes.'], 429);
        set_transient($bucket, $count + 1, 60);
        $state=self::state($order);
        if ((int)get_option('ctwpml_thankyou_debug',0)) {
            $state_key='ctwpml_ty_state_'.$id;
            if (get_transient($state_key)!==$state) { self::debug('state_changed',$state);set_transient($state_key,$state,3600); }
        }
        wp_send_json_success(['state'=>$state, 'tracking_url'=>self::tracking($order)]);
    }
    public static function assets(): void {
        if (!self::page()) return;
        $version = checkout_tabs_wp_ml_get_version();
        wp_enqueue_style('ctwpml-thankyou', CHECKOUT_TABS_WP_ML_URL . 'assets/css/thankyou-page.css', [], $version);
        wp_enqueue_script('ctwpml-thankyou', CHECKOUT_TABS_WP_ML_URL . 'assets/js/thankyou-page.js', [], $version, true);
    }
    public static function settings(): void {
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_font_scale', ['type'=>'integer','sanitize_callback'=>static fn($v)=>max(0,min(100,(int)$v)),'default'=>30]);
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_padding', ['type'=>'integer','sanitize_callback'=>static fn($v)=>max(0,min(40,(int)$v)),'default'=>10]);
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_logo', ['type'=>'string','sanitize_callback'=>'esc_url_raw']);
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_debug', ['type'=>'integer','sanitize_callback'=>static fn($v)=>empty($v)?0:1,'default'=>0]);
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_page', ['type'=>'integer','sanitize_callback'=>'absint']);
        register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_minutes', ['type'=>'integer','sanitize_callback'=>static fn($v)=>max(1,min(1440,(int)$v)), 'default'=>6]);
        foreach (['pending_title'=>'Seu pedido está reservado','paid_title'=>'Compra confirmada. Tudo certo!','thanks'=>'Obrigado! Estamos cuidando do seu pedido.','support'=>''] as $field=>$default) {
            register_setting(CHECKOUT_TABS_WP_ML_SETTINGS_GROUP, 'ctwpml_thankyou_' . $field, ['type'=>'string','sanitize_callback'=>'sanitize_text_field','default'=>$default]);
        }
    }
    public static function admin(string $tab): void {
        echo '<div class="ctwpml-admin-tab-panel" data-tab="obrigado"' . ($tab === 'obrigado' ? '' : ' style="display:none"') . '><h2>Página de obrigado</h2><p>Insira <code>[checkout_ml_obrigado]</code> sozinho em uma página. Ela será exibida sem header/footer do tema. Selecione-a abaixo para direcionar novas compras.</p><table class="form-table">';
        echo '<tr><th>Página completa</th><td>';
        wp_dropdown_pages(['name'=>'ctwpml_thankyou_page','selected'=>(int)get_option('ctwpml_thankyou_page',0),'show_option_none'=>'Manter endereço atual','option_none_value'=>0]);
        echo '</td></tr><tr><th>Timer visual (minutos)</th><td><input type="number" name="ctwpml_thankyou_minutes" min="1" max="1440" value="' . esc_attr(get_option('ctwpml_thankyou_minutes',6)) . '"><p class="description">Padrão: 6 minutos. Não altera a validade bancária nem cancela o pedido ao terminar.</p></td></tr>';
        foreach (['pending_title'=>'Título pendente','paid_title'=>'Título confirmado','thanks'=>'Mensagem de agradecimento','support'=>'WhatsApp do suporte (DDI + número)'] as $key=>$label) {
            $defaults=['pending_title'=>'Seu pedido está reservado','paid_title'=>'Compra confirmada. Tudo certo!','thanks'=>'Obrigado! Estamos cuidando do seu pedido.'];
            echo '<tr><th>' . esc_html($label) . '</th><td><input class="regular-text" name="ctwpml_thankyou_' . esc_attr($key) . '" value="' . esc_attr(get_option('ctwpml_thankyou_'.$key,$defaults[$key]??'')) . '"></td></tr>';
        }
        $scale=max(0,min(100,(int)get_option('ctwpml_thankyou_font_scale',30)));
        echo '<tr><th>Tamanho das informações</th><td><select onchange="document.getElementById(\'ctwpml-ty-font\').value=this.value===\'custom\'?document.getElementById(\'ctwpml-ty-font\').value:this.value">';
        foreach(['0'=>'Original','15'=>'+15%','30'=>'+30% (padrão)','50'=>'+50%','custom'=>'Personalizado'] as $value=>$label){$selected=($value==='custom'&&!in_array($scale,[0,15,30,50],true))||($value!=='custom'&&(int)$value===$scale);echo '<option value="'.esc_attr($value).'"'.($selected?' selected':'').'>'.esc_html($label).'</option>';}
        echo '</select> <input id="ctwpml-ty-font" name="ctwpml_thankyou_font_scale" type="number" min="0" max="100" value="'.esc_attr($scale).'" style="width:80px"> % de aumento<p class="description">Aplica-se a data, itens, quantidade, valores e informações auxiliares.</p></td></tr>';
        echo '<tr><th>Espaçamento interno adicional</th><td><input name="ctwpml_thankyou_padding" type="number" min="0" max="40" value="'.esc_attr(get_option('ctwpml_thankyou_padding',10)).'"> px por lado (padrão +10 px)</td></tr>';
        echo '<tr><th>Imagem do topo</th><td><input class="regular-text" type="url" name="ctwpml_thankyou_logo" value="'.esc_attr(get_option('ctwpml_thankyou_logo','')).'"><p class="description">URL da imagem PNG ou SVG. Vazio mantém o nome do site. SVG pode exigir envio pelo gerenciador de arquivos da hospedagem.</p></td></tr>';
        echo '<tr><th>Diagnóstico</th><td><input type="hidden" name="ctwpml_thankyou_debug" value="0"><label><input type="checkbox" name="ctwpml_thankyou_debug" value="1" '.checked(1,(int)get_option('ctwpml_thankyou_debug',0),false).'> Ativar diagnóstico técnico</label><p class="description">Console do navegador e WooCommerce → Status → Logs, fonte ctwpml-thankyou. Não registra payload Pix, tokens ou dados pessoais.</p></td></tr>';
        echo '</table><p>A confirmação vem do estado real do pedido, atualizado pelo gateway. Nenhum parâmetro no link confirma pagamento.</p></div>';
    }
    public static function render(): string {
        if (ctwpml_is_visual_editor()) return '<p>Página de obrigado — a prévia com dados do pedido aparece somente no acesso autorizado do comprador.</p>';
        if (!function_exists('wc_get_order')) return '<p>WooCommerce indisponível.</p>';
        $id = absint(get_query_var('order-received', 0) ?: ($_GET['order_id'] ?? 0));
        $key = sanitize_text_field(wp_unslash($_GET['key'] ?? ''));
        $order = self::authorize($id, $key);
        if (!$order) return '<main class="ctwpml-thankyou-unavailable"><h1>Acesse pelo link do seu pedido</h1><p>Para proteger seus dados, abra o endereço recebido após a compra.</p></main>';
        // Equivalente à chegada ao order-received: só limpa o carrinho da
        // própria sessão que acabou de criar este pedido, uma única vez.
        if (function_exists('WC') && WC()->session && WC()->cart && (int) WC()->session->get('order_awaiting_payment') === $id) {
            WC()->session->set('order_awaiting_payment', null);
            WC()->cart->empty_cart();
        }
        $raw = $order->get_meta('__ASAAS_ORDER', true);
        $pix = is_string($raw) ? json_decode($raw, true) : (array) $raw;
        $pix = is_array($pix) ? $pix : [];
        $payload = is_string($pix['payload'] ?? null) ? $pix['payload'] : '';
        $image = is_string($pix['encodedImage'] ?? null) ? $pix['encodedImage'] : '';
        $image_data = base64_decode($image, true);
        $image_info = $image_data && function_exists('getimagesizefromstring') ? @getimagesizefromstring($image_data) : false;
        $mime = $image_info['mime'] ?? '';
        $qr = in_array($mime, ['image/png','image/jpeg','image/gif','image/webp'], true) ? 'data:' . $mime . ';base64,' . $image : '';
        $state = self::state($order);
        $minutes = max(1,min(1440,(int)get_option('ctwpml_thankyou_minutes',6)));
        $support = preg_replace('/\D/', '', (string)get_option('ctwpml_thankyou_support',''));
        $support_url = strlen($support)>=8 && strlen($support)<=15 ? 'https://wa.me/'.$support : '';
        $tracking = self::tracking($order);
        $font_scale=1+max(0,min(100,(int)get_option('ctwpml_thankyou_font_scale',30)))/100;
        $extra_padding=max(0,min(40,(int)get_option('ctwpml_thankyou_padding',10)));
        $logo=esc_url_raw((string)get_option('ctwpml_thankyou_logo',''));
        $config = ['ajax'=>admin_url('admin-ajax.php'),'id'=>$id,'key'=>$key,'nonce'=>wp_create_nonce('ctwpml_ty_'.$id),'state'=>$state,'minutes'=>$minutes,'tracking'=>$tracking,'pendingTitle'=>get_option('ctwpml_thankyou_pending_title','Seu pedido está reservado'),'paidTitle'=>get_option('ctwpml_thankyou_paid_title','Compra confirmada. Tudo certo!'),'thanks'=>get_option('ctwpml_thankyou_thanks','Obrigado! Estamos cuidando do seu pedido.')];
        $config['debug']=(bool)get_option('ctwpml_thankyou_debug',0);
        ob_start();
        require CHECKOUT_TABS_WP_ML_DIR . 'templates/thankyou-page.php';
        return ob_get_clean();
    }
}
CTWPML_Thankyou::init();
