Fixture PHP obtida do repositório do usuário para reproduzir a dependência externa, sem alterar o gateway:

- Arquivo original: `includes/connectivity/service/class-webhook-invoices-service.php` em `caslusilver/own-gateway-clone`.
- Blob: `de95545e880ce0d39a0fb7a1489e2d8612d6a26e`.
- Referência: https://github.com/caslusilver/own-gateway-clone/blob/main/includes/connectivity/service/class-webhook-invoices-service.php
- A fixture exige `sakm_get_key` e monta `Authorization` com o valor exato. Os testes substituem integralmente `wp_remote_post`; não chamam o endpoint de produção que consta no default da classe original e não usam credenciais reais.
