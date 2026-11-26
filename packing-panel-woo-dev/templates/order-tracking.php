<?php
if (!defined('ABSPATH')) exit;
$base = plugin_dir_url(dirname(__DIR__) . '/packing-panel-woo-dev.php');
$version = painel_empacotamento_get_version();
$logo = get_option('ppwoo_tracking_logo', '') ?: get_option('ctwpml_thankyou_logo', '');
$asset_base = defined('CHECKOUT_TABS_WP_ML_URL') ? CHECKOUT_TABS_WP_ML_URL : dirname($base) . '/';
?><!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>Acompanhar sua entrega</title>
<link rel="stylesheet" href="<?php echo esc_url($base . 'assets/css/order-tracking.css?ver=' . rawurlencode($version)); ?>">
</head><body>
<?php echo PPWOO_Order_Tracking::shortcode(); ?>
<noscript>Habilite o JavaScript para acompanhar sua entrega. Em caso de dificuldade, entre em contato com a loja.</noscript>
<script id="ppwoo-tracking-script" data-endpoint="<?php echo esc_url(admin_url('admin-ajax.php')); ?>" data-home="<?php echo esc_url(home_url('/')); ?>" data-brand-name="<?php echo esc_attr(get_bloginfo('name')); ?>" data-logo="<?php echo esc_url($logo, ['http', 'https']); ?>" data-whatsapp-icon="<?php echo esc_url($asset_base . 'assets/whatsapp.svg'); ?>" src="<?php echo esc_url($base . 'assets/js/order-tracking.js?ver=' . rawurlencode($version)); ?>" defer></script>
</body></html>
