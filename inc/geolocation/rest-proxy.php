<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Geolocation REST Proxy
 *
 * Mantém o endpoint público:
 *   POST /wp-json/geolocation/v1/send
 *
 * E repassa o payload (latitude/longitude/version/event/...) para o webhook externo configurado.
 */

function checkout_tabs_wp_ml_handle_geolocation_proxy_request(WP_REST_Request $request) {
	$is_debug_enabled = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();
	$external_webhook_url = function_exists('checkout_tabs_wp_ml_get_geolocation_webhook_url')
		? checkout_tabs_wp_ml_get_geolocation_webhook_url()
		: 'https://webhook.cubensisstore.com.br/webhook/geolocalizacao/';

	$payload = $request->get_json_params();
	if (!is_array($payload)) {
		return new WP_Error('bad_request', 'Payload inválido ou ausente.', ['status' => 400]);
	}

	$event = isset($payload['event']) ? strtolower(trim((string) $payload['event'])) : '';
	$lat = $payload['latitude'] ?? null;
	$lng = $payload['longitude'] ?? null;
	$cep = isset($payload['cep']) ? preg_replace('/\D/', '', (string) $payload['cep']) : '';
	$has_geo = ($lat !== null && $lng !== null && is_numeric($lat) && is_numeric($lng));
	$has_cep = ($cep !== '' && strlen($cep) === 8);

	if (!$has_geo && !$has_cep) {
		return new WP_Error('bad_request', 'Payload inválido (latitude/longitude ou CEP).', ['status' => 400]);
	}
	if ($has_cep && ($event === 'cep' || $event === 'geolocation_cep' || $event === '')) {
		$payload['event'] = 'CEP';
	}
	if ($has_cep) {
		$payload['cep'] = $cep;
	}

	$args = [
		'method'      => 'POST',
		'timeout'     => 15,
		'redirection' => 5,
		'httpversion' => '1.1',
		'blocking'    => true,
		'headers'     => [
			'Content-Type' => 'application/json; charset=utf-8',
		],
		'body'        => wp_json_encode($payload),
		'cookies'     => [],
	];

	if ($is_debug_enabled) {
		error_log('[CTWPML GEO] Proxy OUT URL: ' . $external_webhook_url);
		error_log('[CTWPML GEO] Proxy OUT Payload: ' . wp_json_encode($payload));
	}

	$response = wp_remote_post($external_webhook_url, $args);
	if (is_wp_error($response)) {
		$error_message = $response->get_error_message();
		if ($is_debug_enabled) {
			error_log('[CTWPML GEO] Proxy ERROR wp_remote_post: ' . $error_message);
		}
		return new WP_Error(
			'webhook_request_failed',
			'Erro ao contatar o serviço de geolocalização: ' . $error_message,
			['status' => 502]
		);
	}

	$response_body = wp_remote_retrieve_body($response);
	$response_code = (int) wp_remote_retrieve_response_code($response);

	if ($is_debug_enabled) {
		error_log('[CTWPML GEO] Proxy IN Code: ' . $response_code);
		error_log('[CTWPML GEO] Proxy IN Body: ' . $response_body);
	}

	$data = json_decode((string) $response_body, true);
	$json_ok = json_last_error() === JSON_ERROR_NONE;

	if (!$json_ok || $response_code < 200 || $response_code >= 300) {
		if ($is_debug_enabled) {
			error_log('[CTWPML GEO] Proxy ERROR invalid response. Code=' . $response_code . ' json_ok=' . ($json_ok ? 'yes' : 'no'));
		}

		$error_data_for_client = [
			'code'    => 'webhook_invalid_response',
			'message' => 'Resposta inválida do serviço de geolocalização externo.',
			'data'    => [
				'status'        => $response_code,
				'external_body' => $response_body,
			],
		];

		return new WP_REST_Response($error_data_for_client, $response_code ?: 502);
	}

	return new WP_REST_Response($data, $response_code);
}

function checkout_tabs_wp_ml_handle_cep_proxy_request(WP_REST_Request $request) {
	$is_debug_enabled = function_exists('checkout_tabs_wp_ml_is_debug_enabled') && checkout_tabs_wp_ml_is_debug_enabled();
	$external_webhook_url = function_exists('checkout_tabs_wp_ml_get_webhook_url')
		? checkout_tabs_wp_ml_get_webhook_url()
		: 'https://webhook.cubensisstore.com.br/webhook/consulta-frete';

	$payload = $request->get_json_params();
	if (!is_array($payload)) {
		return new WP_Error('bad_request', 'Payload inválido ou ausente.', ['status' => 400]);
	}

	$cep = isset($payload['cep']) ? preg_replace('/\D+/', '', (string) $payload['cep']) : '';
	if ($cep === '' || strlen($cep) !== 8) {
		return new WP_Error('bad_request', 'Payload inválido (cep).', ['status' => 400]);
	}
	$payload['cep'] = $cep;
	if (empty($payload['event'])) {
		$payload['event'] = 'cep';
	}
	if (empty($payload['version'])) {
		$payload['version'] = '1.0';
	}

	$args = [
		'method'      => 'POST',
		'timeout'     => 15,
		'redirection' => 5,
		'httpversion' => '1.1',
		'blocking'    => true,
		'headers'     => [
			'Content-Type' => 'application/json; charset=utf-8',
		],
		'body'        => wp_json_encode($payload),
		'cookies'     => [],
	];

	if ($is_debug_enabled) {
		error_log('[CTWPML CEP] Proxy OUT URL: ' . $external_webhook_url);
		error_log('[CTWPML CEP] Proxy OUT Payload: ' . wp_json_encode($payload));
	}

	$response = wp_remote_post($external_webhook_url, $args);
	if (is_wp_error($response)) {
		$error_message = $response->get_error_message();
		if ($is_debug_enabled) {
			error_log('[CTWPML CEP] Proxy ERROR wp_remote_post: ' . $error_message);
		}
		return new WP_Error(
			'webhook_request_failed',
			'Erro ao contatar o serviço de frete: ' . $error_message,
			['status' => 502]
		);
	}

	$response_body = wp_remote_retrieve_body($response);
	$response_code = (int) wp_remote_retrieve_response_code($response);

	if ($is_debug_enabled) {
		error_log('[CTWPML CEP] Proxy IN Code: ' . $response_code);
		error_log('[CTWPML CEP] Proxy IN Body: ' . $response_body);
	}

	$data = json_decode((string) $response_body, true);
	$json_ok = json_last_error() === JSON_ERROR_NONE;

	if (!$json_ok || $response_code < 200 || $response_code >= 300) {
		if ($is_debug_enabled) {
			error_log('[CTWPML CEP] Proxy ERROR invalid response. Code=' . $response_code . ' json_ok=' . ($json_ok ? 'yes' : 'no'));
		}

		$error_data_for_client = [
			'code'    => 'webhook_invalid_response',
			'message' => 'Resposta inválida do serviço externo.',
			'data'    => [
				'status'        => $response_code,
				'external_body' => $response_body,
			],
		];

		return new WP_REST_Response($error_data_for_client, $response_code ?: 502);
	}

	return new WP_REST_Response($data, $response_code);
}

add_action('rest_api_init', function () {
	register_rest_route('geolocation/v1', '/send', [
		'methods'             => 'POST',
		'callback'            => 'checkout_tabs_wp_ml_handle_geolocation_proxy_request',
		'permission_callback' => '__return_true',
		'args'                => [
			'latitude'  => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_numeric($param);
				},
			],
			'longitude' => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_numeric($param);
				},
			],
			'cep'       => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					$cep = preg_replace('/\D/', '', (string) $param);
					return strlen($cep) === 8;
				},
			],
			'version'   => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_string($param) && $param !== '';
				},
			],
			'event'     => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_string($param) && $param !== '';
				},
			],
		],
	]);

	register_rest_route('geolocation/v1', '/cep', [
		'methods'             => 'POST',
		'callback'            => 'checkout_tabs_wp_ml_handle_cep_proxy_request',
		'permission_callback' => '__return_true',
		'args'                => [
			'cep'     => [
				'required'          => true,
				'validate_callback' => static function ($param) {
					$digits = preg_replace('/\D+/', '', (string) $param);
					return strlen($digits) === 8;
				},
			],
			'version' => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_string($param) && $param !== '';
				},
			],
			'event'   => [
				'required'          => false,
				'validate_callback' => static function ($param) {
					return is_string($param) && $param !== '';
				},
			],
		],
	]);
});


