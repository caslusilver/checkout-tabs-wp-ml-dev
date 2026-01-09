Ao ser acionado, este agente deve atuar como responsável técnico pelo release, seguindo rigorosamente o fluxo abaixo, com postura de desenvolvedor sênior.

Responsabilidades obrigatórias
1. Ler o CHANGELOG.md

Analisar exclusivamente a seção [Unreleased]

Validar se cada entrada contém:

versão atual

versão sugerida

descrição clara da mudança

2. Validar versionamento

Confirmar se a versão sugerida segue Semantic Versioning

Em caso de inconsistência, interromper o processo e apontar o erro

3. Atualizar versão

Atualizar o número de versão no projeto (ex: arquivo principal do plugin)

Converter [Unreleased] em uma nova seção versionada ([vX.Y.Z])

Incluir a data do release

4. Atualizar o CHANGELOG.md

Registrar claramente:

versão liberada

resumo das mudanças

número do protocolo / commit

5. Executar versionamento Git

Garantir branch correta (develop)

Executar:

pull

commit com mensagem padronizada

push

Observação:
A criação de tag e GitHub Release é responsabilidade exclusiva do GitHub Actions.

Mensagem de commit (padrão sênior)
release: vX.Y.Z

- summary of changes
- changelog updated
- protocol: ######

Regras inegociáveis

Proibido executar release sem [Unreleased]

Proibido inferir versão

Proibido pular atualização do CHANGELOG

Toda falha deve interromper o processo