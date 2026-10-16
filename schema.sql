-- Métricas da festa (Cloudflare D1). Uma linha por evento; o painel (/12785e3/) agrega no navegador.
-- Aplicar: npx wrangler d1 execute crew-metricas --remote --file=schema.sql  (ou --local pro npm run dev)
CREATE TABLE IF NOT EXISTS eventos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT, -- nunca reaproveita id: o painel lê "depois do id X"
  ts        INTEGER NOT NULL, -- epoch ms, relógio do servidor
  visitante TEXT    NOT NULL, -- id aleatório guardado no localStorage do convidado
  tipo      TEXT    NOT NULL, -- visita | perfil | insta | giro | impaciente | toque
  pessoa    TEXT,             -- slug da crew (ian, igor, seibt...)
  origem    TEXT,             -- perfil: card|dado · insta: card|dado|direto · giro: botao|mesa|denovo
  face      INTEGER,          -- giro: face que o dado tirou
  sup       TEXT,             -- toque: pagina | mesa | perfil
  layout    TEXT,             -- 2col (celular) | 3col
  x         REAL,             -- toque: posição em fração da superfície (0..1, fora disso = fora dela)
  y         REAL,
  alvo      TEXT              -- toque: card, girar, mesa, insta, denovo, fechar, fundo, lua, morcego, olhos, nada
);
