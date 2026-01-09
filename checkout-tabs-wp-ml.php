<?php
/**
 * Plugin Name: Checkout Tabs WP ML
 * Plugin URI: https://github.com/caslusilver/checkout-tabs-wp-ml-dev
 * Description: Abas no checkout do WooCommerce (checkout clássico) com consulta de frete via webhook e integração em WC_Session.
 * Version: 3.2.40
 * Author: Lucas Andrade / AI
 * Author URI: https://github.com/caslusilver
 * License: GPL2
 * Text Domain: checkout-tabs-wp-ml
 *
 * GitHub Plugin URI: caslusilver/checkout-tabs-wp-ml-dev
 * Primary Branch: develop
 */

if (!defined('ABSPATH')) {
	exit;
}

define('CHECKOUT_TABS_WP_ML_FILE', __FILE__);
define('CHECKOUT_TABS_WP_ML_DIR', plugin_dir_path(__FILE__));
define('CHECKOUT_TABS_WP_ML_URL', plugin_dir_url(__FILE__));

require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/version.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/settings.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/admin/menu.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/frontend/login-popup.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/frontend/addresses-api.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/frontend/cart-api.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/frontend/checkout-blocks-api.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/enqueue.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/ajax-signup.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/ajax-login.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/cpf-lock.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/ajax-debug-logs.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/ajax-store-webhook-shipping.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/shipping-rates-override.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/admin-refresh-cache.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/geolocation/rest-proxy.php';
require_once CHECKOUT_TABS_WP_ML_DIR . 'inc/geolocation/enqueue.php';

/**
 * Defaults do plugin (não sobrescreve valores existentes).
 */
function checkout_tabs_wp_ml_activate(): void {
	$defaults = [
		'webhook_url' => 'https://webhook.cubensisstore.com.br/webhook/consulta-frete',
		'geolocation_webhook_url' => 'https://webhook.cubensisstore.com.br/webhook/geolocalizacao/',
		'debug'       => 0,
	];

	foreach ($defaults as $key => $value) {
		$opt_name = 'checkout_tabs_wp_ml_' . $key;
		if (get_option($opt_name, null) === null) {
			add_option($opt_name, $value);
		}
	}
}
register_activation_hook(__FILE__, 'checkout_tabs_wp_ml_activate');


