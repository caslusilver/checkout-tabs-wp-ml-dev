<?php
if (!defined('ABSPATH')) exit;

// Carregado no fim de wp_loaded, somente se o provedor anterior não existe.
// Funções PHP servidor a servidor; não cria endpoints públicos nem imprime valores.
if (!function_exists('sakm_get_key')) {
    function sakm_get_key($name) { return is_string($name) ? CTWPML_Key_Vault::get($name) : null; }
}
if (!function_exists('sakm_get_keys')) {
    function sakm_get_keys() { return CTWPML_Key_Vault::compat_keys(); }
}
if (!function_exists('sakm_save_keys')) {
    function sakm_save_keys($keys) { if (is_array($keys)) CTWPML_Key_Vault::compat_save($keys); }
}
if (!function_exists('sakm_encrypt')) {
    function sakm_encrypt($value) { return is_string($value) ? CTWPML_Key_Vault::compat_encrypt($value) : false; }
}
if (!function_exists('sakm_decrypt')) {
    function sakm_decrypt($value) { return is_string($value) ? (CTWPML_Key_Vault::compat_decrypt($value) ?? false) : false; }
}
if (!function_exists('sakm_render_admin_page')) {
    function sakm_render_admin_page() { CTWPML_Key_Vault::render(); }
}
