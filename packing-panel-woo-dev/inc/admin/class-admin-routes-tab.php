<?php

if (!defined('ABSPATH')) exit;

final class PPWOO_Admin_Routes_Tab {
    public static function render(): void {
        if (!current_user_can('manage_options')) return;

        $notice = '';
        $error = '';
        if (isset($_POST['ppwoo_routes_save'])) {
            check_admin_referer('ppwoo_routes_settings', 'ppwoo_routes_nonce');
            try {
                self::save();
                $notice = 'Configurações de rotas salvas.';
            } catch (DomainException $exception) {
                $error = $exception->getMessage();
            } catch (Throwable $exception) {
                $error = 'Não foi possível preparar o armazenamento de rotas.';
            }
        }
        ?>
        <h2>Configurações de rotas</h2>
        <?php if ($notice): ?><div class="notice notice-success inline"><p><?php echo esc_html($notice); ?></p></div><?php endif; ?>
        <?php if ($error): ?><div class="notice notice-error inline"><p><?php echo esc_html($error); ?></p></div><?php endif; ?>

        <form method="post" action="<?php echo esc_url(admin_url('admin.php?page=' . PPWOO_Admin_Menu::PAGE_SLUG . '&tab=routes')); ?>">
            <?php wp_nonce_field('ppwoo_routes_settings', 'ppwoo_routes_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row">Gestão em lote</th>
                    <td><label><input type="checkbox" name="routes_enabled" <?php checked(PPWOO_Routes::enabled()); ?>> Habilitar as abas de rotas</label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ppwoo-routes-postcode">CEP de saída</label></th>
                    <td>
                        <input id="ppwoo-routes-postcode" type="text" class="regular-text" name="routes_postcode" inputmode="numeric"
                               maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000"
                               value="<?php echo esc_attr(PPWOO_Route_Calculation::origin_postcode()); ?>">
                        <p class="description">O fluxo no n8n resolve a origem a partir desse CEP.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ppwoo-routes-url">Webhook de cálculo (n8n)</label></th>
                    <td><input id="ppwoo-routes-url" type="url" class="large-text" name="routes_url"
                               placeholder="https://exemplo.com/webhook/calcular-rotas" value="<?php echo esc_attr(get_option('ppwoo_routes_url', '')); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ppwoo-routes-auth-key">Nome da chave de autenticação</label></th>
                    <td>
                        <input id="ppwoo-routes-auth-key" type="text" class="regular-text" name="routes_auth_key" maxlength="128"
                               value="<?php echo esc_attr(PPWOO_Route_Calculation::auth_key_name()); ?>" placeholder="authorization" autocomplete="off">
                        <p class="description">Informe o nome cadastrado no seu plugin de chaves. O valor é buscado no servidor e enviado no cabeçalho Authorization.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ppwoo-routes-maps-key">Nome da chave do mapa Google</label></th>
                    <td>
                        <input id="ppwoo-routes-maps-key" type="text" class="regular-text" name="routes_maps_key_name" maxlength="128" autocomplete="off" placeholder="google_maps"
                               value="<?php echo esc_attr(PPWOO_Route_Calculation::maps_key_name()); ?>">
                        <p class="description">Informe somente o nome cadastrado no seu plugin de chaves, por exemplo google_maps. O valor é buscado no servidor pelo mesmo gerenciador da autenticação. Não cole a chave Google aqui.</p>
                        <details><summary>Como obter e configurar a chave</summary>
                            <ol>
                                <li>Abra o <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud → Google Maps Platform → Chaves e credenciais</a> no projeto com faturamento ativo.</li>
                                <li>Na Biblioteca, habilite <strong>Maps JavaScript API</strong>. Ela exibe o mapa; a Routes API continua sendo usada pelo n8n.</li>
                                <li>Crie uma chave de API para o navegador. Em restrições de aplicativo, escolha Sites e autorize o domínio do painel (por exemplo, https://sualoja.com.br/*).</li>
                                <li>Restrinja a chave à Maps JavaScript API. Cadastre o valor no seu gerenciador de chaves com um nome, por exemplo google_maps. Neste campo do PackPanel, informe somente esse nome e salve.</li>
                                <li>Abra uma rota calculada no painel. O mapa deve mostrar ruas e aceitar zoom. Se aparecer apenas o esquema, confira as restrições, faturamento e o aviso mostrado junto ao mapa.</li>
                            </ol>
                            <p>O mapa precisa receber o valor da chave no navegador, mesmo com o armazenamento no gerenciador. As restrições de domínio e API são indispensáveis. Se o nome não existir no gerenciador, o painel mostrará o esquema do trajeto. O carregamento do mapa tem cobrança própria do Google: configure cotas e alertas no projeto.</p>
                        </details>
                    </td>
                </tr>
            </table>
            <?php submit_button('Salvar configurações', 'primary', 'ppwoo_routes_save'); ?>
        </form>
        <?php
    }

    private static function save(): void {
        $postcode_input = self::field('routes_postcode');
        $postcode = PPWOO_Route_Calculation::normalize_postcode($postcode_input);
        if ($postcode_input !== '' && $postcode === '') {
            throw new DomainException('Informe um CEP com oito dígitos.');
        }
        $url_input = self::field('routes_url');
        $url = esc_url_raw($url_input, ['https']);
        if ($url_input !== '' && (wp_parse_url($url, PHP_URL_SCHEME) !== 'https' || !wp_http_validate_url($url))) {
            throw new DomainException('Informe uma URL HTTPS válida e acessível para o webhook de cálculo.');
        }
        $key_name = self::field('routes_auth_key');
        if (strlen($key_name) > 128 || preg_match('/[\x00-\x1F\x7F]/', $key_name)) {
            throw new DomainException('Confira o nome da chave de autenticação.');
        }

        $enabled = isset($_POST['routes_enabled']);
        $maps_key_name = self::field('routes_maps_key_name');
        if (strlen($maps_key_name) > 128 || preg_match('/[\x00-\x1F\x7F]/', $maps_key_name)) throw new DomainException('Confira o nome da chave do mapa cadastrado no gerenciador.');
        if ($enabled) PPWOO_Routes_Store::install();
        update_option('ppwoo_routes_origin_postcode', $postcode, false);
        update_option('ppwoo_routes_url', $url, false);
        update_option('ppwoo_routes_auth_key_name', $key_name === '' ? PPWOO_Route_Calculation::DEFAULT_AUTH_KEY : $key_name, false);
        update_option('ppwoo_routes_enabled', $enabled ? 'yes' : 'no', false);
        update_option('ppwoo_routes_maps_key_name', $maps_key_name, false);
        delete_option('ppwoo_routes_maps_key');
    }

    private static function field(string $name): string {
        if (!isset($_POST[$name])) return '';
        if (!is_string($_POST[$name])) throw new DomainException('Confira os campos das configurações de rotas.');
        return trim(wp_unslash($_POST[$name]));
    }
}
