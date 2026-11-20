# Cofre integrado e compatibilidade com o snippet SAKM — v3.4.2

## Problema investigado

Usuário relatou que o pedido 6828, na versão 3.4.1, era criado mas permanecia na última etapa sem alcançar a página Pix. O arquivo de log fornecido contém execuções de `woocommerce_checkout_order_processed` para esse pedido às 13:07:29, 13:07:37, 13:07:51 e 13:09:29, sem um resultado final de checkout associado. O log isolado não contém a mensagem SAKM nem comprova o resultado do gateway.

A inspeção do HTML público identificou o plugin `own-gateway-clone` e WooCommerce 11.3.1. No repositório do usuário, `includes/connectivity/service/class-webhook-invoices-service.php` exige `function_exists('sakm_get_key')` e devolve `asaas_clone_env_key_provider_missing` / “Função sakm_get_key não está disponível.” antes de fazer HTTP quando não há provedor. `includes/gateway/class-pix-clone.php::process_payment` chama esse serviço depois de o WooCommerce criar o pedido e retorna failure nesse caso. Só retorna success/redirect após a cobrança ser gerada ou já existir um identificador de pagamento.

O cofre das versões 3.4.0/3.4.1 atendia os próprios consumidores por `CTWPML_Key_Vault::get`, mas não oferecia a função pública antiga para outros plugins depois de desligar o snippet. Essa incompatibilidade foi reproduzida com a classe original do serviço, blob `de95545e880ce0d39a0fb7a1489e2d8612d6a26e`, sob HTTP inteiramente simulado. Não foi feita uma cobrança ou alterado o gateway/site.

## Contrato restaurado

`CTWPML_Key_Vault::init` agenda a ponte no fim de `wp_loaded`, depois de plugins e init. Se o snippet já declarou `sakm_get_key`, respeita o provedor existente e não redeclara funções. Caso contrário, carrega `inc/security/sakm-compat.php` e passa a atender consultas externas pelo cofre, sem recursão pelo próprio fallback. A ponte fica disponível nas requisições normais de checkout/AJAX/REST depois do bootstrap; não deve ser chamada por outro plugin antes de o WordPress concluir `wp_loaded`.

| API anterior | Com o provedor integrado |
| --- | --- |
| `sakm_get_key($nome)` | Valor exato por referência; ausente/ilegível retorna null. Interno tem prioridade e corrupção não é escondida pelo legado. |
| `sakm_get_keys()` | Mapa de referências para valores protegidos; reúne internos/legados sem expor plaintext. |
| `sakm_encrypt($valor)` / `sakm_decrypt($valor)` | Round-trip com envelope identificado `ctwpml-v1:` e AES-GCM/IV aleatório para novas escritas. O decrypt também lê o formato CTR antigo quando seus parâmetros reais existem. Não é um ciphertext CTR intercambiável com o snippet antigo. |
| `sakm_save_keys($mapa)` | Substitui a lista conforme o contrato antigo, recriptografando valores legíveis no cofre. Mantém ciphertext legado opaco quando faltam parâmetros, sem inventar uma chave para decriptar. Nomes ausentes da lista são removidos, como na API anterior. |
| `sakm_render_admin_page()` | Encaminha para a interface atual, com capacidade administrativa. Não restaura a interface antiga. |

Esses são helpers PHP, não endpoints anônimos. Salvar um mapa pela API é uma escrita deliberada de código confiável no servidor; não passa a ser um comando HTTP público. Não adicionamos constantes privadas nem copiamos valores do arquivo do usuário para produção. O layout de Segurança das chaves, botões, nonce, capacidade, importação explícita e armazenamento permanecem.

Se o snippet continua ativo, ele continua dono de suas funções e da opção antiga. Para aposentá-lo: importar as chaves enquanto ele estiver ativo, validar os nomes e depois desativar manualmente. A ponte passa a atender na próxima requisição. Se as chaves ficaram somente em CTR e o snippet/constantes reais desapareceram antes da importação, restaurar temporariamente o provedor original ou recadastrar os valores: ciphertext não permite recuperar um segredo desconhecido.

## Checkout e mapa

O WooCommerce da loja foi lido publicamente, sem carrinho ou pedido de teste. Ele dispara `checkout_place_order_success` com `triggerHandler` no formulário; o listener anterior em body não recebia esse evento. Agora o binding é direto no formulário, renovado após atualização do checkout e com fallback para eventos que sobem a body. Dedupe para o mesmo payload, exige success + redirect, nunca retorna false nem propaga erro de animação. O WooCommerce continua dono do redirecionamento; não forçamos uma página de pagamento quando o gateway falhar.

A mensagem “O Google recusou a chave” estava no carregador do mapa e podia aparecer também em timeout/rede. As causas agora têm mensagens distintas. Recusa real do SDK ainda exige verificar referência da chave em PackPanel → Rotas, valor no cofre e restrições/API/faturamento Google. Isso não corrige credenciais externas inválidas nem comprova que o Google e o Pix falharam pela mesma razão.

## Testes e retomada

- `tests/sakm-compat.test.php` executado com e sem provedor anterior. Antes da ponte, reproduz a recusa do serviço Pix; depois, a classe original envia uma única requisição simulada com Authorization exato e recebe os campos Pix fictícios. Também cobre helpers, referência com espaço, CTR antigo, importação, leitura sem mutação e corrupção sem fallback.
- `tests/fixtures/asaas-webhook-invoices-service.php` é uma cópia do serviço original somente para teste, com origem registrada no arquivo adjacente. `wp_remote_post` é substituído integralmente; o endpoint default de produção nunca é chamado.
- Testes DOM do evento nativo, substituição de formulário, erro de feedback sem bloquear redirect, veto de gateway preservado e animação verde somente no sucesso.
- Testes das três causas de falha do mapa e regressões de cofre/rotas/driver/telefones.

Próximo teste no site: conferir a chave usada no campo **Auth key name** do Pix Clone (padrão `authorization`) e a mesma referência no cofre. Atualizar o plugin e testar um pedido controlado, sem trocar o nome do gateway por `motoboy_conexao` ou pela chave Google. A versão corrigida não cria chave nova nem faz cobrança por conta própria. Pedido pendente já criado deve ser conferido antes de refazer a compra; não foi marcada quitação ou alterado o pedido 6828 pelo agente.

Rollback desta correção: v3.4.1, commit `d99a600f2f50c5158b1c38b0bf3b370228dab067`. A versão anterior não tem a ponte SAKM; consumidores externos voltam a precisar do provedor antigo. Não desfaz cobranças ou alterações deliberadas de chaves. Alterações no site/snippet/n8n, faturamento Google ou plugin do gateway não fazem parte desta execução.
