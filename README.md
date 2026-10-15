# crew-cards

Página da crew: cada um é uma face do dado. Clicar num card abre o perfil da pessoa
(foto grande + botão pro Instagram), e o botão "Girar o dado" abre uma mesa com um dado 3D
que sorteia alguém e mostra o mesmo perfil.

| Dado | Nome     | Instagram          |
|------|----------|--------------------|
| 1    | Ian      | @i.m.zanini        |
| 2    | Igor     | @igor_bcs          |
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

Cada pessoa tem duas versões da foto, com o nome em minúsculas (`ian`, `igor`, `seibt`,
`matheus`, `leonardo`, `gabriel`):

- `fotos/<nome>.jpg`: quadrada, fechada no rosto (360×360). Vai no círculo do card.
- `fotos/cena/<nome>.jpg`: em pé, 3:4, mostrando o cenário (540×720). Vai no perfil.

Sem a foto da cena, o perfil usa a quadrada; sem nenhuma, aparece a inicial do nome.

Ao trocar ou adicionar uma foto:

1. Salve em JPEG progressivo, qualidade ~80 (`cjpeg -quality 80 -progressive -optimize`).
2. Aumente `FOTOS_V` no `<script>` do `index.html` e o `?v=` dos `<link rel="preload">` no
   `<head>` (mesmo número). Sem isso, quem já abriu o site continua vendo a versão antiga
   por algumas horas.
3. Foto nova de quadrada? Adicione o `<link rel="preload">` dela no `<head>`.

O `404.html` precisa existir: sem ele o Cloudflare Pages responde a página inteira (status 200)
pra qualquer arquivo que falte, e o navegador guarda esse HTML no lugar da foto.

## Prévia do link

`og.jpg` (1200×630) é a imagem que aparece ao compartilhar o link (WhatsApp, iMessage,
Instagram...). As tags `og:*` ficam no `<head>` do `index.html` e usam URL absoluta. Se trocar a
imagem, aumente o `?v=` do `og:image` para os apps buscarem a nova.

## Editar a crew

Mude a lista `pessoas` dentro do `<script>` no `index.html`.
