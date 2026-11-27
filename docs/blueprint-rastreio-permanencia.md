# Próximo PR — permanência do rastreio e duas confirmações

## Origem e escopo

Pedido de 27/11/2026 após aprovação da central de Recuperação. Usuário relatou cliente que não conseguiu abrir o acompanhamento depois da conclusão da viagem e quer separar a entrega registrada pelo motoboy do recebimento confirmado pelo comprador. Esta nota prepara a próxima mudança; o PR 38 não altera encerramento/validade do rastreio.

Regra pretendida: concluir uma parada ou o percurso pelo motoboy registra a entrega, mas não desativa a visualização dos compradores. O administrador pode encerrar a rota; o comprador pode confirmar que recebeu, encerrando apenas seu próprio acompanhamento. No painel, dois indicadores independentes e seus horários: **motoboy marcou entregue** e **cliente confirmou recebimento**. Não apresentar uma ação como prova da outra. Preservar o histórico, gestos, idempotência e sincronização offline existentes.

## O que o código atual realmente faz

- `packing-panel-woo-dev/inc/core/class-driver-state.php`, método `apply`: evento `complete` muda a parada para `delivered`; na última, o estado do motorista vira `completed`. Não chama a baixa de cliente nem fecha a rota administrativa.
- `inc/driver/class-driver-panel.php`, método `local`: persiste os eventos do motorista e recalcula estimativas. Também não fecha automaticamente a rota por `completed`.
- `packing-panel-woo-dev/inc/core/class-order-tracking.php`, métodos `issue`, `link`, `authorize`: acesso público em rota exige rota `dispatched`, parada `on_route` e acesso não vencido. A validade atual é **24 horas desde a saída**, não desde a primeira abertura do cliente. Renovação administrativa conta mais 24 horas da renovação.
- `packing-panel-woo-dev/inc/core/class-routes.php`, `close_stops`: baixa administrativa ou confirmação do cliente fecha a parada; quando não restam paradas em rota e não há ficha pendente, pode fechar a rota inteira. Registra `closed_source=operator|customer` e `closed_at`.
- `packing-panel-woo-dev/assets/js/order-tracking.js`: etapa `delivered` já mostra que o motoboy registrou a entrega e pede confirmação pelo slide. Erros 403/410 retiram a projeção sensível da tela.

Conclusão: não há evidência de que o evento do motoboy, sozinho, tenha invalidado o link relatado. Expiração, baixa administrativa/cliente e renovação/revogação do acesso são hipóteses a verificar no caso real. Nenhum token de cliente ou dados pessoais são incluídos neste documento.

## Implementação a preparar separadamente

1. Reproduzir motorista concluindo primeira/última parada e demonstrar que a rota/paradas públicas continuam abertas; cobrir evento repetido e sincronização offline tardia.
2. Tornar visíveis no painel os dois fatos independentes já representados nas estruturas: `driver.stops[].delivered_at` e confirmação `closed_source=customer`/`closed_at`. Diferenciar baixa do administrador.
3. Separar encerramento operacional/estado do motoboy da autorização de visualização. Fechar uma parada de cliente não pode encerrar a visualização de outros clientes ainda sem confirmação. Encerramento administrativo deve ser explícito e confirmar a ação.
4. Rever a validade de 24 horas junto à regra desejada **até administrador encerrar ou cliente confirmar**. Prazo técnico finito, possível renovação e eventual resumo após encerramento devem ser decididos nesse PR; não assumir que hoje existe acesso permanente.
5. Preservar tokens protegidos, recusa em cancelamento/reembolso/revogação, projeção privada (sem dados de outros pedidos), telas de encerrado legíveis e recuperação de falha/retry. Não liberar acesso apenas por ID do pedido.

Critérios: motorista `completed` não encerra outros clientes; cliente confirma só o seu; administrador encerra conscientemente; indicadores independentes corretos; mensagem explica encerramento/expiração; desktop, mobile, PWA e perda de rede mantêm estado. Não mudar prazo ou autoridade de encerramento dentro do PR de Recuperação.
