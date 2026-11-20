<?php
if (!defined('ABSPATH')) exit;

/** Cofre interno; não declara funções sakm_* para não colidir com o snippet legado. */
final class CTWPML_Key_Vault {
    public const OPTION = 'ctwpml_key_vault_v1';

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

    public static function render(): void {
        if (!current_user_can('manage_options')) return;
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
                } elseif ($action === 'delete') {
                    $name = is_string($_POST['key_name'] ?? null) ? wp_unslash($_POST['key_name']) : '';
                    unset($rows[$name]); update_option(self::OPTION, $rows, false); $notice = 'Chave interna removida. A cópia legada, se existir, permanece.';
                }
            }
        } catch (Throwable $error) { $notice = 'Não foi possível concluir. Confira os campos e a configuração do cofre.'; }
        echo '<div class="wrap"><h1>Chaves de API</h1><p>As integrações usam o nome da chave. Os valores salvos nunca são exibidos nesta lista.</p>';
        if ($notice) echo '<div class="notice notice-info"><p>' . esc_html($notice) . '</p></div>';
        echo '<form method="post">'; wp_nonce_field('ctwpml_vault');
        echo '<input type="hidden" name="ctwpml_vault_action" value="save"><p><label>Nome <input name="key_name" required maxlength="128" pattern="[a-zA-Z0-9_.-]+"></label></p><p><label>Valor <input type="password" name="key_value" id="ctwpml-new-key" required autocomplete="new-password"></label> <button type="button" class="button" id="ctwpml-generate-key">Gerar chave</button></p><button class="button button-primary">Salvar</button></form>';
        echo '<h2>Chaves internas</h2><ul>';
        foreach ((array) get_option(self::OPTION, []) as $name => $_) {
            echo '<li><strong>' . esc_html($name) . '</strong><form method="post" style="display:inline">'; wp_nonce_field('ctwpml_vault');
            echo '<input type="hidden" name="key_name" value="' . esc_attr($name) . '"><button class="button" name="ctwpml_vault_action" value="delete" onclick="return confirm(\'Remover esta chave interna?\')">Remover</button></form></li>';
        }
        echo '</ul><h2>Migrar do gerenciador anterior</h2><p>Mantenha o snippet ativo para importar. As chaves antigas não serão apagadas ou substituídas. Faça backup das chaves e do segredo do WordPress antes de desativar o legado ou trocar os salts.</p><form method="post">'; wp_nonce_field('ctwpml_vault');
        echo '<button name="ctwpml_vault_action" value="migrate" class="button">Importar chaves legadas</button></form></div>';
        wp_enqueue_script('ctwpml-vault', CHECKOUT_TABS_WP_ML_URL . 'assets/js/key-vault.js', [], checkout_tabs_wp_ml_get_version(), true);
    }
}
