import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCorpo, ehPagesDev, ehLocal } from "../lib/requisicao.js";

const comCorpo = corpo => new Request("https://x.test/", { method: "POST", body: corpo, duplex: "half" });
const emPedacos = (...pedacos) => new ReadableStream({
  start(ctrl) {
    for (const p of pedacos) ctrl.enqueue(new TextEncoder().encode(p));
    ctrl.close();
  },
});

test("lê o corpo inteiro quando cabe no limite", async () => {
  assert.equal(await lerCorpo(comCorpo('{"a":1}'), 100), '{"a":1}');
  assert.equal(await lerCorpo(comCorpo(emPedacos("abó", "bora")), 100), "abóbora");
});

test("devolve null assim que passa do limite, mesmo sem Content-Length", async () => {
  assert.equal(await lerCorpo(comCorpo(emPedacos("x".repeat(60), "y".repeat(60))), 100), null);
  assert.equal(await lerCorpo(comCorpo("z".repeat(101)), 100), null);
});

test("sem corpo devolve texto vazio", async () => {
  assert.equal(await lerCorpo(new Request("https://x.test/"), 100), "");
});

test("reconhece endereço *.pages.dev e computador local", () => {
  assert.equal(ehPagesDev(new URL("https://fantasia-dado.pages.dev/api/e")), true);
  assert.equal(ehPagesDev(new URL("https://abc123.fantasia-dado.pages.dev/")), true);
  assert.equal(ehPagesDev(new URL("https://qualseunumerodasorte.party/")), false);
  assert.equal(ehLocal(new URL("http://127.0.0.1:8788/")), true);
  assert.equal(ehLocal(new URL("http://localhost:8788/")), true);
  assert.equal(ehLocal(new URL("http://qualseunumerodasorte.party/")), false);
});
