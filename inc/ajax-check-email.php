<?php

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_nopriv_ctwpml_check_email', 'ctwpml_ajax_check_email_exists');
add_action('wp_ajax_ctwpml_check_email', 'ctwpml_ajax_check_email_exists');

function ctwpml_ajax_check_email_exists(): void {
	if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { wp_send_json_error(['message'=>'Método inválido.'],405); return; }
	if (!check_ajax_referer('ctwpml_check_email', '_ajax_nonce', false)) {
		wp_send_json_error(['message' => 'Nonce inválido.']);
		return;
	}

	$email = isset($_POST['email']) && is_string($_POST['email']) ? sanitize_email(wp_unslash($_POST['email'])) : '';
	if ($email === '' || !is_email($email)) {
		wp_send_json_error(['message' => 'E-mail inválido.']);
		return;
	}

	$bucket='ctwpml_email_route_'.hash('sha256',($_SERVER['REMOTE_ADDR'] ?? '').'|'.floor(time()/60));
	$count=(int)get_transient($bucket);
	if ($count>=20) { wp_send_json_error(['message'=>'Aguarde um momento e tente novamente.'],429); return; }
	set_transient($bucket,$count+1,60);
	$user_id = (int)email_exists($email);
	if (function_exists('WC') && WC()->session) {
		// A próxima requisição AJAX precisa receber a mesma sessão, inclusive no primeiro acesso.
		WC()->session->set_customer_session_cookie(true);
		WC()->session->set('ctwpml_pk_expected_user',$user_id);
		WC()->session->save_data();
	}
	$exists = $user_id > 0 ? 1 : 0;
	$data = [
		'exists' => $exists,
		'auth_method' => $user_id && class_exists('CTWPML_Passkeys') && CTWPML_Passkeys::has_keys($user_id) ? 'passkey' : 'password',
	];
	if (!empty($_POST['early']) && class_exists('CTWPML_Early_Login') && $data['auth_method']==='passkey') $data['ticket']=CTWPML_Early_Login::issue_ticket($user_id);
	wp_send_json_success($data);
}
