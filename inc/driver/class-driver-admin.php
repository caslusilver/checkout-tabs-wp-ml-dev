<?php
if (!defined('ABSPATH')) exit;

final class CTWPML_Driver_Admin {
    public static function render(): void {
        if (!current_user_can('manage_options')) return;
        $notice = '';
        if (isset($_POST['ctdrv_reopen'])) {
            check_admin_referer('ctdrv_reopen');
            try {
                if (($_POST['confirm_reopen'] ?? '') !== '1') throw new DomainException('Confirme a revisão antes de prosseguir.');
                CTWPML_Driver_Panel::admin_reopen(absint($_POST['route_id'] ?? 0), absint($_POST['order_id'] ?? 0));
                $notice = 'Entrega reaberta. Copie os novos links no PackPanel; os anteriores foram revogados.';
            } catch (Throwable $e) { $notice = $e instanceof DomainException ? $e->getMessage() : 'Não foi possível reabrir. Confira o estado da rota.'; }
        }
        if (isset($_POST['ctdrv_save'])) {
            check_admin_referer('ctdrv_settings');
            try { self::save(); $notice = 'Configurações salvas.'; }
            catch (DomainException $e) { $notice = $e->getMessage(); }
        }
        $cfg = CTWPML_Driver_Panel::config();
        echo '<div class="wrap"><h1>Painel do motoboy</h1>';
        if ($notice) echo '<div class="notice notice-info"><p>' . esc_html($notice) . '</p></div>';
        echo '<p>Mesmo plugin, dois modos. Local: esta loja fornece pedidos e eventos. Remoto: este site exibe o painel e conversa com a loja pelo servidor, sem carregar o checkout.</p><form method="post">';
        wp_nonce_field('ctdrv_settings');
        echo '<p><label><input type="checkbox" name="enabled" value="1" ' . checked(!empty($cfg['enabled']), true, false) . '> Habilitar painel do motoboy</label></p>';
        echo '<p><label>Modo <select name="mode"><option value="local" ' . selected($cfg['mode'] ?? 'local', 'local', false) . '>Local — loja de origem</option><option value="remote" ' . selected($cfg['mode'] ?? 'local', 'remote', false) . '>Remoto — somente painel neste site</option></select></label></p>';
        echo '<h2>Página deste site</h2><p>Publique uma página com <code>[ppwoo_driver_panel]</code> e selecione abaixo. A página fica sem header/footer. Links por rota são copiados no painel administrativo da loja.</p>';
        wp_dropdown_pages(['name' => 'driver_page', 'selected' => (int) ($cfg['page'] ?? 0), 'show_option_none' => 'Selecione uma página', 'option_none_value' => '0']);
        echo '<table class="form-table">';
        $fields = [
            'remote_page' => ['URL da página do motoboy no outro site (na loja)', 'https://painel.exemplo.com/entregas/'],
            'origin' => ['URL base da loja de origem (no site remoto)', 'https://loja.exemplo.com'],
            'connection' => ['Identificador da conexão — igual nos dois sites', 'loja-principal'],
            'peer_host' => ['Domínio autorizado do outro site, sem https ou caminho', 'painel.exemplo.com'],
            'key_name' => ['Nome local da chave compartilhada — valor igual nos dois cofres', 'motoboy_conexao'],
            'maps_key_name' => ['Nome da chave Google para o domínio remoto', 'google_maps'],
        ];
        foreach ($fields as $name => [$label, $placeholder]) echo '<tr><th><label for="ctdrv-' . esc_attr($name) . '">' . esc_html($label) . '</label></th><td><input class="regular-text" id="ctdrv-' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr($cfg[$name] ?? '') . '" placeholder="' . esc_attr($placeholder) . '" maxlength="2048" autocomplete="off"></td></tr>';
        echo '</table><p>Configure uma chave aleatória de pelo menos 32 caracteres no cofre dos dois sites. O nome pode ser diferente; o valor deve coincidir. A conexão usa assinatura HMAC e domínio permitido. Não cole segredos nesses campos. A chave de navegador Google continua exigindo restrições de domínio/API.</p><p>Endpoint da loja: <code>/wp-json/ctwpml-driver/v1/route</code>. O site remoto monta esse caminho na URL base configurada.</p>';
        submit_button('Salvar configurações', 'primary', 'ctdrv_save'); echo '</form>';
        echo '<h2>Teste de conexão</h2><p>Consulta autenticada de diagnóstico, sem pedidos, dados pessoais ou eventos de entrega.</p><form method="post">'; wp_nonce_field('ctdrv_diagnostic');
        echo '<button class="button" name="ctdrv_diagnostic" value="1">Testar conexão configurada</button></form>';
        if (isset($_POST['ctdrv_diagnostic'])) {
            check_admin_referer('ctdrv_diagnostic');
            try {
                if (!CTWPML_Driver_Panel::remote()) throw new DomainException('Execute este teste no site remoto.', 422);
                CTWPML_Driver_Panel::remote_request(['diagnostic' => true]);
                echo '<p>Conexão autenticada confirmada.</p>';
            } catch (Throwable $e) { echo '<p>Não foi possível confirmar. Confira URL, modo, identificador, domínio e chave nos dois sites.</p>'; }
        }
        if (!CTWPML_Driver_Panel::remote()) {
            echo '<h2>Revisar uma entrega finalizada</h2><p>Somente o administrador pode reabrir após a confirmação do cliente. A sequência do entregador volta a esta parada; confirmações de outros clientes permanecem. O histórico é preservado e novos links serão necessários para o entregador e este cliente.</p><form method="post">';
            wp_nonce_field('ctdrv_reopen');
            echo '<p><label>Saída # (identificador da rota) <input type="number" min="1" name="route_id" required></label></p><p><label>ID do pedido <input type="number" min="1" name="order_id" required></label></p><p><label><input type="checkbox" name="confirm_reopen" value="1" required> Confirmo a reabertura e a revogação dos links anteriores.</label></p><button name="ctdrv_reopen" value="1" class="button">Reabrir esta entrega</button></form>';
        }
        echo '</div>';
    }

    private static function save(): void {
        $cfg = [];
        foreach (['mode','remote_page','origin','connection','peer_host','key_name','maps_key_name'] as $name) {
            if (!is_string($_POST[$name] ?? '')) throw new DomainException('Confira os campos.');
            $cfg[$name] = trim(wp_unslash($_POST[$name] ?? ''));
        }
        if (!in_array($cfg['mode'], ['local','remote'], true)) throw new DomainException('Modo inválido.');
        foreach (['remote_page','origin'] as $name) if ($cfg[$name] && (wp_parse_url($cfg[$name], PHP_URL_SCHEME) !== 'https' ||
            wp_parse_url($cfg[$name], PHP_URL_USER) || wp_parse_url($cfg[$name], PHP_URL_QUERY) || wp_parse_url($cfg[$name], PHP_URL_FRAGMENT) ||
            (wp_parse_url($cfg[$name], PHP_URL_PORT) && wp_parse_url($cfg[$name], PHP_URL_PORT) !== 443) || !wp_http_validate_url($cfg[$name]))) throw new DomainException('Use URL HTTPS pública, sem parâmetros ou credenciais.');
        foreach (['key_name','maps_key_name','connection'] as $name) if ($cfg[$name] && !preg_match('/^[a-zA-Z0-9_.-]{1,128}$/D', $cfg[$name])) throw new DomainException('Confira nomes de chave e identificador.');
        if ($cfg['key_name'] && $cfg['key_name'] === $cfg['maps_key_name']) throw new DomainException('Use outra referência para o mapa. A chave compartilhada nunca deve chegar ao navegador.');
        if ($cfg['peer_host'] && (!preg_match('/^[a-z0-9.-]+$/iD', $cfg['peer_host']) || filter_var($cfg['peer_host'], FILTER_VALIDATE_IP))) throw new DomainException('Informe um domínio público válido, sem caminho.');
        $cfg['peer_host'] = strtolower($cfg['peer_host']);
        $cfg['page'] = absint($_POST['driver_page'] ?? 0); $cfg['enabled'] = !empty($_POST['enabled']);
        if ($cfg['page'] && (get_post_type($cfg['page']) !== 'page' || get_post_status($cfg['page']) !== 'publish')) throw new DomainException('Escolha uma página publicada.');
        if ($cfg['page'] && in_array(wp_parse_url(get_permalink($cfg['page']), PHP_URL_PATH), ['', '/', false, null], true)) throw new DomainException('Use uma página dedicada, como /entregas/, para limitar o cache offline.');
        if ($cfg['enabled'] && $cfg['mode'] === 'remote' && (!$cfg['origin'] || !$cfg['page'] || !$cfg['key_name'] || !$cfg['connection'] ||
            strtolower((string) wp_parse_url($cfg['origin'], PHP_URL_HOST)) !== $cfg['peer_host'])) throw new DomainException('Preencha página, origem, domínio autorizado, conexão e nome da chave.');
        if ($cfg['mode'] === 'local' && $cfg['remote_page'] && strtolower((string) wp_parse_url($cfg['remote_page'], PHP_URL_HOST)) !== $cfg['peer_host']) throw new DomainException('A página remota deve pertencer ao domínio autorizado.');
        update_option(CTWPML_Driver_Panel::CONFIG, $cfg, false);
    }
}
