<?php
require __DIR__.'/thankyou-page.test.php';
require dirname(__DIR__).'/inc/frontend/order-status-strip.php';
$queries=[];$pendingOrders=[];$paidOrders=[];
function wc_get_orders($args){$GLOBALS['queries'][]=$args;return in_array('pending',$args['status'],true)?$GLOBALS['pendingOrders']:$GLOBALS['paidOrders'];}
expect_ty(CTWPML_Order_Strip::find_order(0)===null,'Visitante consultou pedidos');
expect_ty(count($queries)===0,'Visitante chegou à consulta');
$pending=new WC_Order();$paid=new WC_Order();$paid->state='processing';
$pendingOrders=[$pending];$paidOrders=[$paid];
expect_ty(CTWPML_Order_Strip::find_order(7)===$pending,'Pendente não foi priorizado');
expect_ty($queries[0]['customer_id']===7&&$queries[0]['limit']===5,'Consulta não limita ao próprio usuário');
$pendingOrders=[];expect_ty(CTWPML_Order_Strip::find_order(7)===$paid,'Pago não foi usado como alternativa');
expect_ty(CTWPML_Order_Strip::find_order(8)===null,'Pedido de outro cliente foi aceito');
echo "Tarja: visitante não consulta; pendente primeiro; pago alternativo e isolamento por comprador passaram.\n";
