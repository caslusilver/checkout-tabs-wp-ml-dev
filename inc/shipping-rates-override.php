<?php

if (!defined('ABSPATH')) {
	exit;
}

add_filter('woocommerce_package_rates', 'checkout_tabs_wp_ml_override_shipping_rates_with_webhook', 999, 2);

function checkout_tabs_wp_ml_override_shipping_rates_with_webhook($rates, $package) {
	if (!class_exists('WC') || !function_exists('WC') || !WC()->session) {
		return $rates;
	}

	$is_debug_enabled = checkout_tabs_wp_ml_is_debug_enabled();
	$web = WC()->session->get('webhook_shipping');
	if (!is_array($web)) {
		return $rates;
	}

	foreach ($rates as $rate_id => $rate) {
		if (!is_object($rate) || !method_exists($rate, 'get_method_id') || !method_exists($rate, 'get_instance_id')) {
			continue;
		}

		$rate_identifier = $rate->get_method_id() . ':' . $rate->get_instance_id();

		switch ($rate_identifier) {
			case 'flat_rate:1': // PAC MINI
				$valor = $web['fretePACMini']['valor'] ?? '';
				if (empty($valor) || !is_numeric($valor) || floatval($valor) <= 0) {
					if ($is_debug_enabled) {
						error_log('[CTWPML DEBUG] flat_rate:1 (PAC Mini) valor inválido: ' . ($valor === '' ? 'empty' : (is_null($valor) ? 'null' : $valor)));
					}
					// Mantém o comportamento do snippet (não remove).
				} else {
					$rate->set_cost(floatval($valor));
				}
				break;

			case 'flat_rate:5': // SEDEX
				$valor = $web['freteSedex']['valor'] ?? '';
				if (empty($valor) || !is_numeric($valor) || floatval($valor) <= 0) {
					if ($is_debug_enabled) {
						error_log('[CTWPML DEBUG] Removendo flat_rate:5 (SEDEX) por valor inválido: ' . ($valor === '' ? 'empty' : (is_null($valor) ? 'null' : $valor)));
					}
					unset($rates[$rate_id]);
				} else {
					$rate->set_cost(floatval($valor));
				}
				break;

			case 'flat_rate:3': // Motoboy
				$valor = $web['freteMotoboy']['valor'] ?? '';
				if (empty($valor) || !is_numeric($valor) || floatval($valor) <= 0) {
					if ($is_debug_enabled) {
						error_log('[CTWPML DEBUG] Removendo flat_rate:3 (Motoboy) por valor inválido: ' . ($valor === '' ? 'empty' : (is_null($valor) ? 'null' : $valor)));
					}
					unset($rates[$rate_id]);
				} else {
					$rate->set_cost(floatval($valor));
				}
				break;
		}
	}

	return $rates;
}


