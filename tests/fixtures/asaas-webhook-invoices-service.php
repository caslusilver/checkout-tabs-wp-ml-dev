<?php
/**
 * Webhook invoices service.
 *
 * @package WooAsaas
 */

namespace WC_Asaas\Connectivity\Service;

use WC_Asaas\Gateway\Gateway;

class Webhook_Invoices_Service {
	/**
	 * Default webhook URL (Pix invoices).
	 */
	const DEFAULT_WEBHOOK_URL = 'https://webhook.cubensisstore.com.br/webhook/invoices';

	/**
	 * Sends invoice creation to webhook.
	 *
	 * @param array   $payload The invoice payload.
	 * @param Gateway $gateway The gateway instance.
	 * @return \stdClass|\WP_Error
	 */
	public function create_invoice( array $payload, Gateway $gateway ) {
		$auth_key = $this->resolve_auth_key( $gateway );
		if ( is_wp_error( $auth_key ) ) {
			return $auth_key;
		}

		$request = wp_remote_post(
			$this->resolve_webhook_url( $gateway ),
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => $auth_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$code = wp_remote_retrieve_response_code( $request );
		$body = wp_remote_retrieve_body( $request );

		$decoded = json_decode( $body );
		if ( ! is_object( $decoded ) ) {
			return new \WP_Error(
				'asaas_clone_invalid_response',
				__( 'Resposta do webhook inválida.', 'woo-asaas' ),
				array( 'body' => $body )
			);
		}

		if ( 200 > $code || 299 < $code ) {
			return new \WP_Error(
				'asaas_clone_webhook_error',
				sprintf( __( 'Erro no webhook (HTTP %d).', 'woo-asaas' ), $code ),
				array( 'body' => $body )
			);
		}

		return $decoded;
	}

	/**
	 * Resolve webhook URL with optional override.
	 *
	 * @param Gateway $gateway The gateway instance.
	 * @return string
	 */
	private function resolve_webhook_url( Gateway $gateway ) {
		$endpoint = trim( (string) $gateway->get_option( 'endpoint', '' ) );
		$url      = '' !== $endpoint ? $endpoint : self::DEFAULT_WEBHOOK_URL;

		return (string) apply_filters( 'woocommerce_asaas_clone_webhook_url', $url, $gateway );
	}

	/**
	 * Resolve auth key from environment (sakm_get_key).
	 *
	 * @param Gateway $gateway The gateway instance.
	 * @return string|\WP_Error
	 */
	private function resolve_auth_key( Gateway $gateway ) {
		$env_key_name = trim( (string) $gateway->get_option( 'api_key', 'authorization' ) );
		$env_key_name = '' !== $env_key_name ? $env_key_name : 'authorization';

		if ( ! function_exists( 'sakm_get_key' ) ) {
			return new \WP_Error(
				'asaas_clone_env_key_provider_missing',
				__( 'Função sakm_get_key não está disponível.', 'woo-asaas' )
			);
		}

		$auth_key = (string) sakm_get_key( $env_key_name );
		$auth_key = trim( $auth_key );

		if ( '' === $auth_key ) {
			return new \WP_Error(
				'asaas_clone_env_key_empty',
				__( 'Chave de autorização não encontrada ou vazia.', 'woo-asaas' )
			);
		}

		return $auth_key;
	}
}
