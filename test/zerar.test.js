import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, CONFIRMACAO } from "../functions/12785e3/api/zerar.js";

// D1 de mentira: conta quantas vezes apagou e finge que havia `linhas` eventos
function bancoFalso({ linhas = 42, falhar = false } = {}) {
  const comandos = [];
  const DB = {
    prepare: sql => ({
      run: async () => {
        if (falhar) throw new Error("D1 fora do ar");
        comandos.push(sql);
        return { success: true, meta: { changes: linhas } };
      },
    }),
  };
  return { DB, comandos };
}

const postar = (env, corpo) => onRequestPost({
  request: new Request("https://qualseunumerodasorte.party/12785e3/api/zerar", {
    method: "POST", body: corpo, headers: { "Content-Type": "application/json" },
  }),
  env,
});

test("com a confirmação certa apaga todos os eventos e diz quantos foram", async () => {
  const env = bancoFalso({ linhas: 42 });
  const resposta = await postar(env, JSON.stringify({ confirmar: CONFIRMACAO }));
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), { apagados: 42 });
  assert.deepEqual(env.comandos, ["DELETE FROM eventos"]);
});

test("sem a palavra exata não apaga nada", async () => {
  const errados = ["", "{}", "null", "isso não é json", '"ZERAR"', '{"confirmar":"zerar"}', '{"confirmar":" ZERAR"}', '{"confirmar":true}'];
  for (const corpo of errados) {
    const env = bancoFalso();
    const resposta = await postar(env, corpo);
    assert.equal(resposta.status, 400, corpo);
    assert.ok((await resposta.json()).erro, corpo);
    assert.equal(env.comandos.length, 0, corpo);
  }
});

test("corpo grande demais é recusado sem apagar", async () => {
  const env = bancoFalso();
  const resposta = await postar(env, JSON.stringify({ confirmar: CONFIRMACAO, lixo: "x".repeat(5000) }));
  assert.equal(resposta.status, 413);
  assert.equal(env.comandos.length, 0);
});

test("com o D1 fora do ar responde 503 com aviso", async () => {
  const resposta = await postar(bancoFalso({ falhar: true }), JSON.stringify({ confirmar: CONFIRMACAO }));
  assert.equal(resposta.status, 503);
  assert.ok((await resposta.json()).erro);
});
