# Checkout desktop — escopo aprovado e implementação

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

Prévia navegável `checkout-desktop-previa.html` na pasta de visualizações da conversa, com dados e preços fictícios; usa o SVG fornecido como imagem. Em26/11/2026 o usuário aprovou a prévia e autorizou aplicação e merge, pedindo preservar controles, termos e link de privacidade atuais. Implementação incluída na versão3.4.12 ainda não publicada até essa autorização.

## Aceite

Informações da compra/endereço legíveis à esquerda, ações à direita; nenhum campo ou botão perdido; foco percorre ordem lógica; mobile permanece funcional; erro não duplica compra ou perde dados; total/frete correspondem ao Woo. Desktop só entra na release depois do aceite visual do usuário e validação do DOM real.

## Implementação e validação — 26/11/2026

`assets/js/checkout-desktop.js` e `assets/css/checkout-desktop.css`, carregados por `inc/enqueue.php`, compõem o modal/raiz existente em página inteira a partir de1024px. `state.desktopSnapshot` expõe somente o estado já disponível nessa página para apresentação. Nenhum endpoint novo, cálculo financeiro paralelo, formulário duplicado ou alteração dos valores digitados. O resumo usa `WooHost.readTotals/readCoupons/getCartThumbs`, atualiza por eventos Woo e limita chamadas concorrentes; não faz polling.

Cabeçalho usa nome da loja e imagem configurada na página de obrigado, quando existente. Oferta antecipada reorganiza os próprios elementos de passkeys; o modal mantém views, inputs, ações e handlers originais. Etapas só habilitam retornos já disponíveis na conferência; o botão Voltar mantém as demais transições. O aceite e link real da política vêm de `AddressMlScreens.buildPrivacyTermsHtml` e do mecanismo de termos existente, sem substituir nem clonar o checkbox. A composição desktop elimina o footer fixo mobile no desktop; erros/processamento continuam no fluxo original.

`tests/checkout-desktop.browser.qa.cjs`: renderizador AddressMlScreens e CSS reais no Edge, transporte Woo simulado. Testadas larguras1024/1280/1440 (página inteira/duas colunas) e390/768/1023 (composição mobile), link de privacidade original em outra aba, identidade e valor dos controles, foco/rascunho/checkbox preservados em AJAX, atualização do resumo/cupom, navegação pelos handlers existentes e ausência de loop/sobreposição de consultas. Screenshots locais de conferência e oferta inspecionados. Não representa compra completa na instalação WordPress/Elementor nem biometria real; validar no site/PWA após Git Updater. Rollback3.4.11 preserva banco de chaves do motor separado.
