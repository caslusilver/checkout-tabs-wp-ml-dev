Toda e qualquer modificação realizada no código deve obrigatoriamente ser registrada no `CHANGELOG.md` sob a seção **`[Unreleased]`**, antes de qualquer commit ou push.

Regras obrigatórias (para o comando `/pull` nunca travar):

1) Em `CHANGELOG.md`, a seção **`## [Unreleased]`** deve existir e conter **sempre** exatamente **UM** bloco no formato abaixo.
2) O bloco deve conter **Versão atual**, **Versão sugerida** e **Descrição** (nunca inferir versões).
3) Use exatamente a estrutura abaixo (incluindo `### Changed` e o bullet com as 3 chaves).
4) **Proibido** adicionar qualquer outra linha/bullet dentro de `[Unreleased]` fora do bloco (inclui: `#### Protocol`, `Protocol: [pendente]`, “Notas”, etc).
5) Ao fechar um release, o agente deve:
   - Converter `## [Unreleased]` em `## [vX.Y.Z] - YYYY-MM-DD`
   - Incluir `#### Protocol: <hash_do_commit_anterior_ao_release>` dentro da seção versionada
   - Recriar `## [Unreleased]` com o bloco vazio (template) para o próximo ciclo

Modelo aceito (copie e edite):

## [Unreleased]

### Changed
- **Versão atual**: vX.Y.Z  
  **Versão sugerida após a mudança**: vX.Y.Z  
  **Descrição**: texto objetivo do que mudou e impacto (pode listar itens separados por ponto e vírgula).

Checklist rápido antes de executar `/pull`:
- `[Unreleased]` está presente e segue o template acima
- A versão sugerida segue SemVer
- A versão atual bate com o cabeçalho `Version:` do arquivo principal do plugin

O `CHANGELOG.md` é a fonte da verdade. O agente irá ler apenas `[Unreleased]` e, com base nessas entradas (já com versão sugerida), fará o pull, commit, tag e push.

Nenhuma modificação é considerada concluída se não estiver registrada em `[Unreleased]` com **versão atual + versão sugerida**.