import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/e.js";
import { MAX_BYTES } from "../lib/eventos.js";

// D1 de mentira: guarda o que seria gravado
function bancoFalso({ falhar = false } = {}) {
  const gravacoes = [];
  const DB = {
    prepare: sql => ({
      bind: (...params) => ({
        run: async () => {
          if (falhar) throw new Error("D1 fora do ar");
          gravacoes.push({ sql, params });
          return { success: true };
        },
      }),
    }),
  };
  return { DB, gravacoes };
}

const postar = (env, corpo, host = "qualseunumerodasorte.party") => onRequestPost({
  request: new Request(`https://${host}/api/e`, { method: "POST", body: corpo, duplex: "half" }),
  env,
});
const lote = e => JSON.stringify({ v: "abc12345xyz", e });

test("grava um lote válido com um INSERT só", async () => {
  const env = bancoFalso();
  const resposta = await postar(env, lote([{ tipo: "visita", layout: "2col" }, { tipo: "giro", face: 3, origem: "mesa" }]));
  assert.equal(resposta.status, 204);
  assert.equal(env.gravacoes.length, 1);
  assert.match(env.gravacoes[0].sql, /^INSERT INTO eventos .* FROM json_each\(\?1\)$/s);
  const linhas = JSON.parse(env.gravacoes[0].params[0]);
  assert.deepEqual(linhas.map(l => l.tipo), ["visita", "giro"]);
});

test("corpo que não é JSON, ou sem evento válido, dá 400", async () => {
  for (const corpo of ["isso não é json", lote([{ tipo: "hack" }]), "null", "[]"]) {
    const env = bancoFalso();
    assert.equal((await postar(env, corpo)).status, 400, corpo);
    assert.equal(env.gravacoes.length, 0);
  }
});

test("tipo que não é texto dá 400 em vez de estourar", async () => {
  const env = bancoFalso();
  assert.equal((await postar(env, lote([{ tipo: { toString: 1 } }]))).status, 400);
  assert.equal((await postar(env, lote([{ tipo: ["visita"] }]))).status, 400);
  assert.equal(env.gravacoes.length, 0);
});

test("corpo maior que o limite dá 413, mesmo chegando em pedaços", async () => {
  const pedacos = new ReadableStream({
    start(ctrl) {
      for (let i = 0; i < 10; i++) ctrl.enqueue(new TextEncoder().encode("x".repeat(MAX_BYTES / 4)));
      ctrl.close();
    },
  });
  assert.equal((await postar(bancoFalso(), pedacos)).status, 413);
});

test("D1 fora do ar dá 503", async (t) => {
  t.mock.method(console, "error", () => {});
  assert.equal((await postar(bancoFalso({ falhar: true }), lote([{ tipo: "impaciente" }]))).status, 503);
});

test("endereço *.pages.dev não grava (a regra de rate limit do domínio não vale lá)", async () => {
  const env = bancoFalso();
  assert.equal((await postar(env, lote([{ tipo: "impaciente" }]), "fantasia-dado.pages.dev")).status, 404);
  assert.equal(env.gravacoes.length, 0);
});
