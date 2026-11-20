<?php
if (!defined('ABSPATH')) exit;
$assets = CHECKOUT_TABS_WP_ML_URL . 'assets/driver/';
$version = checkout_tabs_wp_ml_get_version();
$scope = hash('sha256', home_url('/') . '|' . (CTWPML_Driver_Panel::config()['origin'] ?? '') . '|' . (CTWPML_Driver_Panel::config()['connection'] ?? 'local'));
?><!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Sua rota de entrega</title><link rel="stylesheet" href="<?php echo esc_url($assets . 'driver.css?ver=' . rawurlencode($version)); ?>"></head><body>
<?php echo CTWPML_Driver_Panel::shortcode(); ?>
<noscript>Ative o JavaScript para consultar a rota. Se precisar, peça os dados ao responsável pelo envio.</noscript>
<script src="<?php echo esc_url($assets . 'state.js?ver=' . rawurlencode($version)); ?>" defer></script>
<script id="ctdrv-script" src="<?php echo esc_url($assets . 'app.js?ver=' . rawurlencode($version)); ?>" data-endpoint="<?php echo esc_url(admin_url('admin-ajax.php')); ?>" data-worker="<?php echo esc_url(add_query_arg('ctdrv_worker', '1', CTWPML_Driver_Panel::page_url())); ?>" data-scope="<?php echo esc_attr($scope); ?>" defer></script>
</body></html>
