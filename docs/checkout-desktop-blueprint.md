# Checkout desktop — escopo para aprovação visual

Origem: usuário de26/11/2026 aprovou comunicação do acesso aos dados salvos e autorizou a integração; pediu prévia desktop antes da aplicação visual. A versão mobile atual foi considerada perfeita e deve ser preservada.

## Composição proposta

- Cabeçalho discreto com marca e compra segura; etapas clicáveis com estado claro.
- Duas colunas em telas largas: à esquerda itens/quantidade, valores de produto/entrega/total e endereço selecionado; à direita somente a etapa corrente e suas ações.
- Identificação com “Não preencha tudo de novo” e fingerprint fornecido; entrega com endereço salvo/editável; frete; Pix; conferência e termos. A ação principal acompanha a etapa em vez de repetir botões sem contexto.
- Não esconder total/custo da entrega enquanto altera campos. Sem mudanças de regra financeira ou novos dados de pedidos no HTML público.
- Durante finalização, preservar tela e rascunho, bloquear duplicação e cobrir o trabalho pendente; resposta Woo de sucesso → confirmação → obrigado. Erro restaura ação.
- Desktop suporta teclado, foco, autofill e mensagens de validação junto ao campo. Em larguras menores manter composição mobile conhecida; não simplesmente reduzir ou esticar duas colunas.

## Referências reais e estratégia futura

Reutilizar `assets/js/address-ml-modal.js`, `assets/css/address-ml-modal.css`, os módulos AddressMlScreens/WooHost e a raiz do shortcode. Evitar dois formulários Woo ou campos duplicados: reorganizar os mesmos controles no DOM/CSS por breakpoint. Não clonar IDs, selects de pagamento ou resumo com handlers concorrentes. Manter valores digitados, endereço, seleção, termos, reCAPTCHA e estado do gate durante AJAX.

Antes da implementação do layout, conferir quais regiões podem ser posicionadas por CSS e quais precisam de contêiner estável. Renderização do resumo à esquerda deve acompanhar os totais canônicos do Woo, não recalcular preços no navegador. Sem refazer lógica de login/checkout em paralelo com a composição visual.

Prévia navegável `checkout-desktop-previa.html` na pasta de visualizações da conversa, com dados e preços fictícios; usa o SVG fornecido como imagem. Ainda não representa código implementado no checkout. Aceite visual pendente. Após aprovação: CSS desktop escopado, testes de etapas/AJAX e edição em1280/1440, tablet, mobile e PWA; bump próprio e PR.

## Aceite

Informações da compra/endereço legíveis à esquerda, ações à direita; nenhum campo ou botão perdido; foco percorre ordem lógica; mobile permanece funcional; erro não duplica compra ou perde dados; total/frete correspondem ao Woo. Desktop só entra na release depois do aceite visual do usuário e validação do DOM real.
