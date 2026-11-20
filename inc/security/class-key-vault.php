<?php
if (!defined('ABSPATH')) exit;

/** Cofre interno; não declara funções sakm_* para não colidir com o snippet legado. */
final class CTWPML_Key_Vault {
    public const OPTION = 'ctwpml_key_vault_v1';

    public static function init(): void {
        add_action('admin_menu', [__CLASS__, 'menu'], 30);
        add_action('wp_ajax_ctwpml_vault', [__CLASS__, 'ajax']);
    }

    public static function menu(): void {
        $parent = 'checkout-tabs-wp-ml';
        if (CTWPML_Driver_Panel::remote()) {
            add_menu_page('Checkout Tabs ML', 'Checkout Tabs ML', 'manage_options', $parent, [__CLASS__, 'render'], 'dashicons-admin-generic', 30);
        }
        add_submenu_page($parent, 'Segurança das chaves de API', 'Segurança das chaves', 'manage_options', 'ctwpml-vault', [__CLASS__, 'render']);
        if (CTWPML_Driver_Panel::remote()) remove_submenu_page($parent, $parent);
    }

    public static function url(): string { return admin_url('admin.php?page=ctwpml-vault'); }

    private static function key(): string {
        return hash('sha256', (defined('CTWPML_VAULT_KEY') ? CTWPML_VAULT_KEY : wp_salt('secure_auth')) . '|ctwpml-vault-v1', true);
    }

    public static function encrypt(string $name, string $value): array {
        if (!function_exists('openssl_encrypt')) throw new RuntimeException('OpenSSL precisa estar habilitado no servidor.');
        if (!preg_match('/^[a-zA-Z0-9_.-]{1,128}$/D', $name) || $value === '' || strlen($value) > 8192) throw new DomainException('Confira o nome e o valor da chave.');
        $iv = random_bytes(12); $tag = '';
        $cipher = openssl_encrypt($value, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, $name, 16);
        if ($cipher === false) throw new RuntimeException('Não foi possível proteger a chave.');
        return ['v' => 1, 'iv' => base64_encode($iv), 'tag' => base64_encode($tag), 'cipher' => base64_encode($cipher)];
    }

    public static function decrypt(string $name, array $row): ?string {
        if (!function_exists('openssl_decrypt')) return null;
        if (($row['v'] ?? 0) !== 1) return null;
        foreach (['iv','tag','cipher'] as $field) if (!is_string($row[$field] ?? null)) return null;
        $iv = base64_decode($row['iv'] ?? '', true); $tag = base64_decode($row['tag'] ?? '', true); $cipher = base64_decode($row['cipher'] ?? '', true);
        if ($iv === false || strlen($iv) !== 12 || $tag === false || strlen($tag) !== 16 || $cipher === false) return null;
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, $name);
        return is_string($plain) ? $plain : null;
    }

    public static function get(string $name): ?string {
        $rows = (array) get_option(self::OPTION, []);
        if (isset($rows[$name])) return is_array($rows[$name]) ? self::decrypt($name, $rows[$name]) : null;
        return self::legacy($name);
    }

    private static function legacy(string $name): ?string {
        if (function_exists('sakm_get_key')) {
            $value = sakm_get_key($name);
            return is_string($value) ? $value : null;
        }
        // Só lê sem o snippet se os parâmetros reais já existirem no ambiente.
        if (!defined('SAKM_KEY') || !defined('SAKM_IV') || !defined('SAKM_CIPHER')) return null;
        $rows = get_option('sakm_encrypted_keys', []);
        if (!isset($rows[$name]) || !is_string($rows[$name])) return null;
        $encoded = base64_decode($rows[$name], true);
        if ($encoded === false) return null;
        $value = openssl_decrypt($encoded, SAKM_CIPHER, SAKM_KEY, 0, SAKM_IV);
        return is_string($value) ? $value : null;
    }

    public static function migrate(): array {
        $rows = (array) get_option(self::OPTION, []); $done = 0; $failed = 0;
        foreach ((array) get_option('sakm_encrypted_keys', []) as $name => $_) {
            if (isset($rows[$name])) continue;
            $value = self::legacy((string) $name);
            try {
                if (!$value) { $failed++; continue; }
                $rows[$name] = self::encrypt((string) $name, $value); $done++;
            } catch (DomainException $error) { $failed++; }
        }
        update_option(self::OPTION, $rows, false);
        return ['imported' => $done, 'failed' => $failed];
    }

    /** Só o administrador autenticado pode obter o valor ou confirmar a remoção. */
    public static function operate(string $action, string $name, bool $confirmed = false): array {
        if (!current_user_can('manage_options')) throw new DomainException('Acesso restrito ao administrador.', 403);
        if ($name === '' || strlen($name) > 128 || preg_match('/[\x00-\x1F\x7F]/', $name)) throw new DomainException('Nome de chave inválido.', 422);
        $internal = (array) get_option(self::OPTION, []); $legacy = (array) get_option('sakm_encrypted_keys', []);
        if (!array_key_exists($name, $internal) && !array_key_exists($name, $legacy)) throw new DomainException('Chave não encontrada. Atualize a página.', 404);
        if ($action === 'read') {
            $value = self::get($name);
            if ($value === null || $value === '') throw new DomainException('Não foi possível ler a chave. Mantenha o gerenciador anterior ativo ou confira o segredo de criptografia.', 422);
            return ['value' => $value];
        }
        if ($action !== 'delete' || !$confirmed) throw new DomainException('Confirme a remoção desta chave.', 422);
        // Exclusão deliberada de ambas as cópias impede o fallback de reativar a chave.
        unset($internal[$name], $legacy[$name]);
        update_option('sakm_encrypted_keys', $legacy, false);
        update_option(self::OPTION, $internal, false);
        return ['removed' => true];
    }

    public static function ajax(): void {
        nocache_headers(); header('Cache-Control: private, no-store, max-age=0'); header('Referrer-Policy: no-referrer');
        try {
            if (!current_user_can('manage_options') || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !check_ajax_referer('ctwpml_vault_access', 'nonce', false)) throw new DomainException('Acesso não autorizado. Atualize a página e tente novamente.', 403);
            $action = $_POST['operation'] ?? ''; $name = $_POST['name'] ?? '';
            if (!is_string($action) || !is_string($name) || !in_array($action, ['read','delete'], true)) throw new DomainException('Solicitação inválida.', 422);
            wp_send_json_success(self::operate($action, wp_unslash($name), ($_POST['confirmed'] ?? '') === '1'));
        } catch (DomainException $e) { wp_send_json_error(['message' => $e->getMessage()], $e->getCode() ?: 422); }
        catch (Throwable $e) { wp_send_json_error(['message' => 'Não foi possível concluir. Tente novamente.'], 500); }
    }

    public static function render(): void {
        if (!current_user_can('manage_options')) return;
        nocache_headers();
        $notice = '';
        try {
            if (isset($_POST['ctwpml_vault_action'])) {
                check_admin_referer('ctwpml_vault');
                $action = is_string($_POST['ctwpml_vault_action']) ? sanitize_text_field(wp_unslash($_POST['ctwpml_vault_action'])) : '';
                $rows = (array) get_option(self::OPTION, []);
                if ($action === 'migrate') {
                    $result = self::migrate(); $notice = $result['imported'] . ' chaves importadas; ' . $result['failed'] . ' não puderam ser lidas. O legado foi preservado.';
                } elseif ($action === 'save') {
                    $name = is_string($_POST['key_name'] ?? null) ? trim(wp_unslash($_POST['key_name'])) : '';
                    $value = is_string($_POST['key_value'] ?? null) ? wp_unslash($_POST['key_value']) : '';
                    $rows[$name] = self::encrypt($name, $value); update_option(self::OPTION, $rows, false); $notice = 'Chave salva.';
                }
            }
        } catch (Throwable $error) { $notice = 'Não foi possível concluir. Confira os campos e a configuração do cofre.'; }
        wp_enqueue_style('ctwpml-vault', CHECKOUT_TABS_WP_ML_URL . 'assets/css/key-vault.css', [], checkout_tabs_wp_ml_get_version());
        echo '<div class="wrap ctwpml-vault" data-endpoint="' . esc_url(admin_url('admin-ajax.php')) . '" data-nonce="' . esc_attr(wp_create_nonce('ctwpml_vault_access')) . '"><div class="ctv-heading"><span class="dashicons dashicons-lock" aria-hidden="true"></span><div><h1>Segurança das chaves de API</h1><p>Cadastre uma chave e use seu nome nas integrações do plugin.</p></div></div>';
        if ($notice) echo '<div class="notice notice-info"><p>' . esc_html($notice) . '</p></div>';
        echo '<section class="ctv-card"><h2>Adicionar ou atualizar chave</h2><form method="post" action="' . esc_url(self::url()) . '" class="ctv-create">'; wp_nonce_field('ctwpml_vault');
        echo '<input type="hidden" name="ctwpml_vault_action" value="save"><div class="ctv-field"><label for="ctwpml-key-name">Nome de referência</label><input id="ctwpml-key-name" name="key_name" required maxlength="128" pattern="[a-zA-Z0-9_.-]+" placeholder="Ex.: motoboy_conexao" autocomplete="off"><small>É o nome que você informa nas configurações da conexão.</small></div><div class="ctv-field"><label for="ctwpml-new-key">Valor da chave</label><div class="ctv-secret"><input type="password" name="key_value" id="ctwpml-new-key" required maxlength="8192" autocomplete="new-password" spellcheck="false"><button type="button" class="button ctv-button" data-new-toggle aria-label="Mostrar valor da nova chave" aria-pressed="false"><span class="dashicons dashicons-visibility" aria-hidden="true"></span><span>Mostrar</span></button></div><div class="ctv-actions"><button type="button" class="button ctv-button" id="ctwpml-generate-key">Gerar chave</button><button type="button" class="button ctv-button" data-new-copy><span class="dashicons dashicons-admin-page" aria-hidden="true"></span>Copiar valor</button></div><small>Para usar em dois sites, copie o mesmo valor. Instalar o plugin não transfere as chaves.</small></div><div class="ctv-save"><button class="button button-primary ctv-primary">Salvar chave</button><small>Salvar um nome existente atualiza o valor dessa chave.</small></div></form></section>';
        $internal = (array) get_option(self::OPTION, []); $legacy = (array) get_option('sakm_encrypted_keys', []);
        $names = array_unique(array_merge(array_keys($internal), array_keys($legacy))); natcasesort($names);
        echo '<section class="ctv-card"><div class="ctv-section-title"><h2>Chaves cadastradas</h2><span class="ctv-count" data-count>' . count($names) . '</span></div><p class="ctv-description">Valores protegidos. Mostrar e copiar ficam disponíveis somente para administradores.</p><div class="ctv-list">';
        foreach ($names as $name) {
            echo '<article class="ctv-key" data-name="' . esc_attr($name) . '"><div class="ctv-key-title"><strong>' . esc_html($name) . '</strong><span class="ctv-badge">' . (isset($internal[$name]) ? 'Cofre do plugin' : 'Gerenciador anterior') . '</span></div><div class="ctv-secret"><input type="password" readonly value="" placeholder="••••••••••••••••" autocomplete="off" spellcheck="false" aria-label="Valor da chave ' . esc_attr($name) . '"><button type="button" class="button ctv-button" data-key-action="show" aria-label="Mostrar chave ' . esc_attr($name) . '" aria-pressed="false"><span class="dashicons dashicons-visibility" aria-hidden="true"></span><span data-toggle-label>Mostrar</span></button></div><div class="ctv-actions"><button type="button" class="button ctv-button" data-key-action="copy"><span class="dashicons dashicons-admin-page" aria-hidden="true"></span>Copiar chave</button><button type="button" class="button ctv-button" data-key-action="name"><span class="dashicons dashicons-admin-page" aria-hidden="true"></span>Copiar nome</button><button type="button" class="button ctv-button ctv-danger" data-key-action="delete"><span class="dashicons dashicons-trash" aria-hidden="true"></span>Remover</button></div><p class="ctv-row-status" role="status"></p></article>';
        }
        echo '</div><p class="ctv-empty" ' . ($names ? 'hidden' : '') . '>Nenhuma chave cadastrada neste site.</p></section><details class="ctv-card ctv-legacy"><summary>Importar do gerenciador anterior</summary><p>Mantenha o snippet ativo durante a importação. As chaves antigas serão copiadas sem apagá-las ou substituir nomes já cadastrados no cofre. Faça backup antes de desativar o legado ou trocar os salts do WordPress.</p><form method="post" action="' . esc_url(self::url()) . '">'; wp_nonce_field('ctwpml_vault');
        echo '<button name="ctwpml_vault_action" value="migrate" class="button ctv-button">Importar chaves legadas</button></form></details><p class="ctv-global-status" role="status" aria-live="polite"></p></div>';
        wp_enqueue_script('ctwpml-vault', CHECKOUT_TABS_WP_ML_URL . 'assets/js/key-vault.js', [], checkout_tabs_wp_ml_get_version(), true);
    }
}
