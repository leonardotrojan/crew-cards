# crew-cards

Página da crew: cada um é uma face do dado. Clicar num card abre o perfil da pessoa
(foto grande + botão pro Instagram), e o botão "Girar o dado" abre uma mesa com um dado 3D
que sorteia alguém e mostra o mesmo perfil. Tem também [métricas da festa](#métricas-da-festa),
com um painel fechado por senha.

| Dado | Nome     | Instagram          |
|------|----------|--------------------|
| 1    | Ian      | @i.m.zanini        |
| 2    | Igor     | @igor_bcs          |
| 3    | Seibt    | @seibt0_           |
| 4    | Matheus  | @matheus.mariussi  |
| 5    | Leonardo | @trojan.yaml       |
| 6    | Gabriel  | @gabrielmariussi   |

## Estrutura

- `public/`: o site que vai pro ar (`index.html` é a página inteira; `metricas.js` e o painel em
  `12785e3/` são das métricas).
- `functions/`: Pages Functions (recebem as métricas e protegem o painel). `lib/` tem o código que
  elas dividem.
- `schema.sql`, `wrangler.toml`: banco D1 e configuração do Cloudflare Pages (projeto `fantasia-dado`).
- `test/`: testes (`npm test`).

## Rodar

Só o site: abra `public/index.html` no navegador, ou sirva a pasta (`npx serve public`).

Com métricas e painel (Functions + D1 locais, em http://localhost:8788):

```sh
cp .dev.vars.example .dev.vars   # senha do painel no dev (fica fora do git e do deploy)
npx wrangler d1 execute crew-metricas --local --file=schema.sql   # uma vez
npm run dev
```

## Fotos

Cada pessoa tem duas versões da foto, com o nome em minúsculas (`ian`, `igor`, `seibt`,
`matheus`, `leonardo`, `gabriel`):

- `public/fotos/<nome>.jpg`: quadrada, fechada no rosto (360×360). Vai no círculo do card.
- `public/fotos/cena/<nome>.jpg`: em pé, 3:4, mostrando o cenário (540×720). Vai no perfil.

Sem a foto da cena, o perfil usa a quadrada; sem nenhuma, aparece a inicial do nome.

Ao trocar ou adicionar uma foto:

1. Salve em JPEG progressivo, qualidade ~80 (`cjpeg -quality 80 -progressive -optimize`).
2. Aumente `FOTOS_V` no `<script>` do `public/index.html` e o `?v=` dos `<link rel="preload">` no
   `<head>` (mesmo número). Sem isso, quem já abriu o site continua vendo a versão antiga
   por algumas horas.
3. Foto nova de quadrada? Adicione o `<link rel="preload">` dela no `<head>`.

O `public/404.html` precisa existir: sem ele o Cloudflare Pages responde a página inteira (status 200)
pra qualquer arquivo que falte, e o navegador guarda esse HTML no lugar da foto.

## Prévia do link

`public/og.jpg` (1200×630) é a imagem que aparece ao compartilhar o link (WhatsApp, iMessage,
Instagram...). As tags `og:*` ficam no `<head>` do `public/index.html` e usam URL absoluta. Se trocar
a imagem, aumente o `?v=` do `og:image` para os apps buscarem a nova.

## Editar a crew

Mude a lista `pessoas` dentro do `<script>` no `public/index.html` e os nomes em `PESSOAS` no
`lib/eventos.js` (as métricas só aceitam gente da crew; o `npm test` avisa se as duas listas não
baterem). O painel lê nomes, fotos e faces da própria página.

## Métricas da festa

O `public/metricas.js` anota o que acontece no site e manda em lotes pra `functions/api/e.js`, que
valida e grava no D1 (`crew-metricas`, tabela em `schema.sql`). Sem cookie, IP ou user-agent: o único
identificador é um id aleatório no `localStorage` do convidado.

| Evento       | Quando                                                                 |
|--------------|------------------------------------------------------------------------|
| `visita`     | abriu o site                                                           |
| `perfil`     | abriu o perfil de alguém, pelo card ou pelo dado                       |
| `insta`      | tocou em "Insta?" (ou deu cmd/ctrl-clique no card)                     |
| `giro`       | girou o dado (botão de cima, mesa ou "Jogar de novo"), com a face      |
| `impaciente` | tocou na mesa com o dado ainda rolando                                 |
| `toque`      | qualquer toque, com a posição (pro mapa de calor) e onde foi           |

**Painel:** https://qualseunumerodasorte.party/12785e3/ (senha: o secret `PAINEL_SENHA`). Mostra:
- quem teve o Insta aberto por mais gente, com conversão e "rejeições" (o dado tirou a pessoa e o
  convidado girou de novo sem abrir o Insta);
- se o dado é honesto (teste de qui-quadrado), recorde de giros e de impaciência;
- o mapa de calor por cima do próprio site: página, mesa do dado e perfil, no celular e no computador.

O caminho aparece aqui no repositório; quem protege os números é a senha.

**Não contar um aparelho** (a crew testando, por exemplo): abrir o painel nele já desliga (tem o
botão no rodapé), ou visite `/?nt=1` uma vez. Instagram e WhatsApp abrem links num navegador
próprio, com memória separada: marque em cada um. `/?nt=0` volta a contar.

### Configurar (uma vez)

```sh
npx wrangler d1 create crew-metricas   # cole o database_id no wrangler.toml
npx wrangler d1 execute crew-metricas --remote --file=schema.sql
npx wrangler pages secret put PAINEL_SENHA --project-name fantasia-dado
```

Use uma senha de umas quatro palavras. O secret precisa existir antes do deploy.

No painel do Cloudflare (projeto `fantasia-dado` > Settings > Runtime), deixe o limite diário das
Functions em **Fail closed**: se o limite grátis estourar, só métricas e painel param, e o site segue
no ar.

Pra frear quem quiser bagunçar os números ou chutar a senha: uma regra de rate limiting (Security >
WAF, cabe no plano grátis) para `/api/e` e `/12785e3/entrar` no domínio da festa. O endereço
`fantasia-dado.pages.dev` não tem essa regra, por isso métricas e painel não funcionam por lá.

### Deploy

```sh
npm run deploy   # npx wrangler pages deploy: lê public/ e functions/ pelo wrangler.toml
```

Arrastar a pasta no painel do Cloudflare não serve mais: por ali ele não sobe as Functions.

### Antes da festa

Apague os dados de teste pelo botão **Zerar métricas** no rodapé do painel (pede pra digitar
`ZERAR`; a API `functions/12785e3/api/zerar.js` confere a palavra de novo) ou com `npm run zerar`, e
recarregue os outros painéis que estiverem abertos. Se apagar sem querer, o D1 volta no tempo (até 7 dias):
`npx wrangler d1 time-travel restore crew-metricas --timestamp=<data ou unix>`.

Tudo cabe no plano grátis (100 mil requisições de Functions por dia).

### Testes

`npm test`: validação dos eventos, recepção das métricas, porteiro do painel, sessão e agregações
(node:test, sem dependências).
