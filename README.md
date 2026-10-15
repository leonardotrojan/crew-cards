# crew-cards

Página da crew: cada um é uma face do dado. Clicar num card abre o Instagram da pessoa,
e o botão "Girar o dado" abre uma mesa com um dado 3D que sorteia alguém.

| Dado | Nome     | Instagram          |
|------|----------|--------------------|
| 3    | Seibt    | @seibt0_           |
| 4    | Matheus  | @matheus.mariussi  |
| 5    | Leonardo | @trojan.yaml       |
| 6    | Gabriel  | @gabrielmariussi   |

## Rodar

É um arquivo só. Abra `index.html` no navegador, ou sirva a pasta:

```sh
npx serve .
```

## Fotos

Coloque as fotos em `fotos/` (quadradas ficam melhor):

- `fotos/seibt.jpg`
- `fotos/matheus.jpg`
- `fotos/leonardo.jpg`
- `fotos/gabriel.jpg`

Sem foto, o card mostra a inicial do nome.

## Editar a crew

Mude a lista `pessoas` dentro do `<script>` no `index.html`.
