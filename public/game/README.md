# Black Ball — engine local

Esta pasta contém tudo o que a mesa HTML5 precisa para rodar sem autenticação,
API ou banco de dados.

## Tacos

O catálogo fica em `cue-catalog.js`, a interface em `cue-selector.js` e
`cue-selector.css`, e as imagens ficam em `assets/img/cues/`.

Tacos incluídos (todos com 865 × 23 px):

- `starter.png` — Taco Iniciante
- `oak.png` — Carvalho Clássico
- `crimson.png` — Crimson Edge
- `emerald.png` — Esmeralda
- `obsidian.png` — Obsidiana
- `royal.png` — Cetro Real

O taco selecionado é salvo no `localStorage` com a chave
`black-ball:cue-skin`. Também é possível abrir um taco específico com
`index.html?cue=royal`.

## Teste direto

Com o projeto principal em execução, abra:

`http://localhost:5173/game/index.html`

O botão **TACO** no canto inferior abre o seletor. A troca recarrega apenas a
mesa e mantém a escolha salva no navegador.
