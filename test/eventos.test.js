import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarLote, validarEvento, MAX_EVENTOS, MAX_ATRASO_MS, COLUNAS, PESSOAS } from "../lib/eventos.js";

const AGORA = 1_760_000_000_000;
const V = "abc12345xyz";
const vazio = Object.fromEntries(COLUNAS.map(c => [c, null]));
const lote = (...e) => ({ v: V, e });

test("aceita uma visita e preenche os campos ausentes com null", () => {
  const [linha] = validarLote(lote({ tipo: "visita", layout: "2col", dt: 1500 }), AGORA);
  assert.deepEqual(linha, { ...vazio, ts: AGORA - 1500, visitante: V, tipo: "visita", layout: "2col" });
});

test("recusa o lote inteiro sem visitante válido", () => {
  for (const v of [undefined, 123, "", "ABCDEFGH", "abc-1234", "a".repeat(33), "curto"]) {
    assert.deepEqual(validarLote({ v, e: [{ tipo: "visita" }] }, AGORA), [], `visitante ${v}`);
  }
});

test("recusa corpos que não são objeto ou sem lista de eventos", () => {
  for (const corpo of [null, undefined, "x", 42, [], { v: V }, { v: V, e: "visita" }]) {
    assert.deepEqual(validarLote(corpo, AGORA), []);
  }
});

test("descarta tipos desconhecidos e mantém os válidos", () => {
  const linhas = validarLote(lote({ tipo: "hack" }, { tipo: "impaciente" }, { tipo: "__proto__" }), AGORA);
  assert.deepEqual(linhas.map(l => l.tipo), ["impaciente"]);
});

test("perfil exige pessoa e origem conhecidas", () => {
  assert.deepEqual(
    validarEvento({ tipo: "perfil", pessoa: "igor", origem: "dado" }, V, AGORA),
    { ...vazio, ts: AGORA, visitante: V, tipo: "perfil", pessoa: "igor", origem: "dado" });
  assert.equal(validarEvento({ tipo: "perfil", pessoa: "igor", origem: "direto" }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: "perfil", origem: "card" }, V, AGORA), null);
});

test("pessoa só passa se for alguém da crew (ninguém inventa um membro no ranking)", () => {
  for (const pessoa of ["Igor", "ig0r", "fulanodetal", "<script>", "igor ", 7, "__proto__", "constructor"]) {
    assert.equal(validarEvento({ tipo: "insta", pessoa, origem: "card" }, V, AGORA), null, `pessoa ${pessoa}`);
  }
  assert.equal(validarEvento({ tipo: "insta", pessoa: "leonardo", origem: "direto" }, V, AGORA).pessoa, "leonardo");
});

test("a lista da crew aqui é a mesma do public/index.html", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const nomes = [...html.matchAll(/\{\s*nome:\s*"([^"]+)"/g)].map(m => m[1].toLowerCase());
  assert.ok(nomes.length > 0, "não achei a lista pessoas no index.html");
  assert.deepEqual([...PESSOAS].sort(), [...nomes].sort());
});

test("tipo precisa ser texto: array e objeto com toString não passam nem estouram", () => {
  assert.equal(validarEvento({ tipo: ["visita"] }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: { toString: 1 } }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: { toString: () => "visita" } }, V, AGORA), null);
});

test("beijo e mata exigem pessoa da crew e a origem do perfil (card ou dado)", () => {
  for (const tipo of ["beijo", "mata"]) {
    assert.deepEqual(
      validarEvento({ tipo, pessoa: "gabriel", origem: "dado" }, V, AGORA),
      { ...vazio, ts: AGORA, visitante: V, tipo, pessoa: "gabriel", origem: "dado" });
    assert.equal(validarEvento({ tipo, pessoa: "gabriel", origem: "card" }, V, AGORA).origem, "card");
    assert.equal(validarEvento({ tipo, pessoa: "gabriel", origem: "direto" }, V, AGORA), null, `${tipo} direto`);
    assert.equal(validarEvento({ tipo, pessoa: "fulano", origem: "dado" }, V, AGORA), null, `${tipo} fulano`);
    assert.equal(validarEvento({ tipo, origem: "dado" }, V, AGORA), null, `${tipo} sem pessoa`);
  }
});

test("todo alvo que o metricas.js manda é aceito aqui (senão vira nada no mapa de calor)", () => {
  const js = readFileSync(new URL("../public/metricas.js", import.meta.url), "utf8");
  const nomes = [...js.matchAll(/,\s*"([a-z]+)"\]/g)].map(m => m[1]); // entradas [seletor, "nome"] de ALVOS e ENFEITES
  assert.ok(nomes.includes("beijo") && nomes.includes("lua"), "não achei as listas ALVOS e ENFEITES no metricas.js");
  for (const alvo of nomes) {
    assert.equal(validarEvento({ tipo: "toque", sup: "perfil", x: 0.5, y: 0.5, alvo }, V, AGORA).alvo, alvo, `alvo ${alvo}`);
  }
});

test("insta aceita as origens card, dado e direto", () => {
  for (const origem of ["card", "dado", "direto"]) {
    assert.equal(validarEvento({ tipo: "insta", pessoa: "seibt", origem }, V, AGORA).origem, origem);
  }
  assert.equal(validarEvento({ tipo: "insta", pessoa: "seibt", origem: "mesa" }, V, AGORA), null);
});

test("giro exige face inteira de 1 a 6 e origem; pessoa é opcional", () => {
  assert.deepEqual(
    validarEvento({ tipo: "giro", face: 4, origem: "mesa", pessoa: "matheus" }, V, AGORA),
    { ...vazio, ts: AGORA, visitante: V, tipo: "giro", face: 4, origem: "mesa", pessoa: "matheus" });
  assert.equal(validarEvento({ tipo: "giro", face: 4, origem: "mesa", pessoa: "X" }, V, AGORA).pessoa, null);
  for (const face of [0, 7, 2.5, "3", null]) {
    assert.equal(validarEvento({ tipo: "giro", face, origem: "botao" }, V, AGORA), null, `face ${face}`);
  }
  assert.equal(validarEvento({ tipo: "giro", face: 2, origem: "dado" }, V, AGORA), null);
});

test("toque limita x/y a [-0.5, 1.5] com 3 casas e troca alvo desconhecido por nada", () => {
  const linha = validarEvento(
    { tipo: "toque", sup: "pagina", layout: "2col", x: 0.123456, y: 9, alvo: "botao-secreto", pessoa: "ian" }, V, AGORA);
  assert.deepEqual(linha, {
    ...vazio, ts: AGORA, visitante: V, tipo: "toque",
    sup: "pagina", layout: "2col", x: 0.123, y: 1.5, alvo: "nada", pessoa: "ian",
  });
  assert.equal(validarEvento({ tipo: "toque", sup: "mesa", x: -3, y: 0.5, alvo: "fundo" }, V, AGORA).x, -0.5);
  assert.equal(validarEvento({ tipo: "toque", sup: "perfil", x: 0.5, y: 0.5, layout: "4col" }, V, AGORA).layout, null);
});

test("toque sem superfície ou coordenada válida é descartado", () => {
  assert.equal(validarEvento({ tipo: "toque", sup: "teto", x: 0.5, y: 0.5 }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: "toque", sup: "pagina", x: NaN, y: 0.5 }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: "toque", sup: "pagina", x: 0.5, y: "0.5" }, V, AGORA), null);
  assert.equal(validarEvento({ tipo: "toque", sup: "pagina", x: Infinity, y: 0.5 }, V, AGORA), null);
});

test("dt inválido vira 0 e atraso grande é limitado", () => {
  assert.equal(validarEvento({ tipo: "impaciente", dt: -50 }, V, AGORA).ts, AGORA);
  assert.equal(validarEvento({ tipo: "impaciente", dt: 12.7 }, V, AGORA).ts, AGORA);
  assert.equal(validarEvento({ tipo: "impaciente", dt: 10 ** 12 }, V, AGORA).ts, AGORA - MAX_ATRASO_MS);
});

test("ignora campos extras e eventos que não são objeto", () => {
  const linhas = validarLote(lote(null, "visita", { tipo: "visita", sql: "DROP TABLE eventos", id: 1 }), AGORA);
  assert.equal(linhas.length, 1);
  assert.deepEqual(Object.keys(linhas[0]).sort(), [...COLUNAS].sort());
});

test(`aceita no máximo ${MAX_EVENTOS} eventos por lote`, () => {
  const muitos = Array.from({ length: MAX_EVENTOS + 10 }, () => ({ tipo: "impaciente" }));
  assert.equal(validarLote(lote(...muitos), AGORA).length, MAX_EVENTOS);
});
