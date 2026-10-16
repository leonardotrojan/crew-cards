import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linhasParaEventos, resumo, ranking, rejeicoes, dado, toques, QUI2_SUSPEITO, QUI2_VICIADO,
} from "../public/12785e3/agregar.js";

const crew = [
  { slug: "ian", nome: "Ian", dado: 1 },
  { slug: "igor", nome: "Igor", dado: 2 },
  { slug: "seibt", nome: "Seibt", dado: 3 },
];

// fábrica de eventos com id crescente, como vêm do D1
function fabrica() {
  let id = 0;
  return (visitante, tipo, campos = {}) => ({
    id: ++id, ts: id * 1000, visitante, tipo,
    pessoa: null, origem: null, face: null, sup: null, layout: null, x: null, y: null, alvo: null,
    ...campos,
  });
}

test("linhasParaEventos transforma as linhas cruas da API em objetos", () => {
  const eventos = linhasParaEventos(["id", "tipo", "pessoa"], [[1, "insta", "igor"], [2, "visita", null]]);
  assert.deepEqual(eventos, [{ id: 1, tipo: "insta", pessoa: "igor" }, { id: 2, tipo: "visita", pessoa: null }]);
});

test("resumo conta visitantes únicos, visitas, perfis, instas e giros", () => {
  const ev = fabrica();
  const eventos = [
    ev("a", "visita"), ev("a", "visita"), ev("b", "visita"),
    ev("a", "perfil", { pessoa: "igor", origem: "card" }),
    ev("b", "insta", { pessoa: "igor", origem: "card" }),
    ev("b", "giro", { face: 3, origem: "botao" }), ev("b", "giro", { face: 1, origem: "mesa" }),
    ev("c", "toque", { sup: "pagina", x: 0.5, y: 0.5, alvo: "nada" }),
  ];
  assert.deepEqual(resumo(eventos), { visitantes: 3, visitas: 3, perfis: 1, instas: 1, giros: 2 });
  assert.deepEqual(resumo([]), { visitantes: 0, visitas: 0, perfis: 0, instas: 0, giros: 0 });
});

test("ranking ordena por quem teve mais visitantes únicos abrindo o Insta", () => {
  const ev = fabrica();
  const eventos = [
    ev("a", "perfil", { pessoa: "igor", origem: "card" }),
    ev("a", "insta", { pessoa: "igor", origem: "card" }),
    ev("a", "insta", { pessoa: "igor", origem: "card" }), // mesma pessoa abrindo de novo
    ev("b", "perfil", { pessoa: "igor", origem: "dado" }),
    ev("b", "insta", { pessoa: "igor", origem: "dado" }),
    ev("a", "perfil", { pessoa: "ian", origem: "card" }),
    ev("c", "perfil", { pessoa: "ian", origem: "dado" }),
    ev("c", "insta", { pessoa: "seibt", origem: "direto" }), // cmd-clique: abriu sem ver o perfil
  ];
  const [primeiro, segundo, terceiro] = ranking(eventos, crew);

  assert.equal(primeiro.slug, "igor");
  assert.deepEqual(
    { perfisCard: primeiro.perfisCard, perfisDado: primeiro.perfisDado, viram: primeiro.viram, abriram: primeiro.abriram, instas: primeiro.instas, conversao: primeiro.conversao },
    { perfisCard: 1, perfisDado: 1, viram: 2, abriram: 2, instas: 3, conversao: 1 });

  assert.equal(segundo.slug, "seibt"); // 1 visitante abriu, mesmo sem ver o perfil
  assert.equal(segundo.abriram, 1);
  assert.equal(segundo.conversao, null); // ninguém viu o perfil: conversão indefinida

  assert.equal(terceiro.slug, "ian");
  assert.equal(terceiro.viram, 2);
  assert.equal(terceiro.conversao, 0);
});

test("ranking inclui a crew inteira e quem aparecer só nos eventos", () => {
  const ev = fabrica();
  const lista = ranking([ev("a", "insta", { pessoa: "gabriel", origem: "direto" })], crew);
  assert.deepEqual(lista.map(p => p.slug), ["gabriel", "ian", "igor", "seibt"]);
  assert.equal(lista[0].nome, "Gabriel");
  assert.equal(lista[0].dado, null);
});

test("rejeição: o dado tirou a pessoa e o convidado girou de novo sem abrir o Insta", () => {
  const ev = fabrica();
  const eventos = [
    ev("a", "perfil", { pessoa: "igor", origem: "dado" }),
    ev("b", "perfil", { pessoa: "igor", origem: "dado" }), // eventos de visitantes intercalados
    ev("b", "insta", { pessoa: "igor", origem: "dado" }),
    ev("a", "giro", { face: 5, origem: "denovo" }), // a rejeitou o Igor
    ev("b", "giro", { face: 1, origem: "denovo" }), // b abriu o Insta antes: não é rejeição
    ev("c", "perfil", { pessoa: "ian", origem: "card" }),
    ev("c", "giro", { face: 2, origem: "denovo" }), // veio do card, não do dado
    ev("d", "perfil", { pessoa: "seibt", origem: "dado" }),
    ev("d", "giro", { face: 2, origem: "botao" }), // fechou e girou pelo botão de fora: não conta
    ev("d", "giro", { face: 3, origem: "denovo" }),
  ];
  assert.deepEqual(Object.fromEntries(rejeicoes(eventos)), { igor: 1 });
  assert.equal(ranking(eventos, crew).find(p => p.slug === "igor").rejeicoes, 1);
});

test("dado: conta faces, origens, recordes e dá o veredito pelo qui-quadrado", () => {
  const ev = fabrica();
  const giros = [
    ...Array.from({ length: 3 }, () => ev("a", "giro", { face: 1, origem: "botao" })),
    ev("b", "giro", { face: 6, origem: "mesa" }),
    ev("b", "giro", { face: 6, origem: "denovo" }),
    ev("a", "impaciente"), ev("a", "impaciente"), ev("b", "impaciente"),
  ];
  const r = dado(giros);
  assert.deepEqual(r.faces, [3, 0, 0, 0, 0, 2]);
  assert.equal(r.total, 5);
  assert.equal(r.veredito, "poucos");
  assert.deepEqual(r.origens, { botao: 3, mesa: 1, denovo: 1 });
  assert.equal(r.recordeGiros, 3);
  assert.equal(r.impacientes, 3);
  assert.equal(r.recordeImpaciente, 2);
});

test("veredito do dado: honesto, suspeito e viciado", () => {
  const comFaces = contagens => {
    const ev = fabrica();
    return contagens.flatMap((n, i) => Array.from({ length: n }, () => ev("x", "giro", { face: i + 1, origem: "mesa" })));
  };
  const honesto = dado(comFaces([10, 10, 10, 10, 10, 10]));
  assert.equal(honesto.qui2, 0);
  assert.equal(honesto.veredito, "honesto");
  assert.equal(honesto.esperado, 10);

  // o painel refaz o teste a cada 30s: o corte é bem alto pra um dado justo não ser acusado por azar
  assert.equal(dado(comFaces([18, 2, 10, 10, 10, 10])).veredito, "honesto"); // qui2 = 12,8

  const suspeito = dado(comFaces([22, 0, 10, 10, 10, 8])); // qui2 = 24,8
  assert.ok(suspeito.qui2 >= QUI2_SUSPEITO && suspeito.qui2 < QUI2_VICIADO);
  assert.equal(suspeito.veredito, "suspeito");

  assert.equal(dado(comFaces([25, 0, 10, 10, 10, 5])).veredito, "viciado"); // qui2 = 35
  assert.equal(dado([]).veredito, "poucos");
  assert.equal(dado([]).recordeGiros, 0);
});

test("toques filtra por superfície e layout e conta toques no nada e nos enfeites", () => {
  const ev = fabrica();
  const t = (sup, layout, alvo, x = 0.5, y = 0.5) => ev("a", "toque", { sup, layout, alvo, x, y });
  const eventos = [
    t("pagina", "2col", "card", 0.25, 0.75),
    t("pagina", "2col", "nada"),
    t("pagina", "2col", "lua"),
    t("pagina", "2col", "morcego"), t("pagina", "2col", "morcego"),
    t("pagina", "3col", "nada"),
    t("mesa", "2col", "mesa"),
    ev("a", "visita", { layout: "2col" }),
  ];
  const r = toques(eventos, { sup: "pagina", layout: "2col" });
  assert.equal(r.total, 5);
  assert.equal(r.nada, 1);
  assert.deepEqual(r.enfeites, { lua: 1, morcego: 2, olhos: 0 });
  assert.deepEqual(r.pontos[0], { x: 0.25, y: 0.75 });
  assert.deepEqual(r.porAlvo, [["morcego", 2], ["card", 1], ["nada", 1], ["lua", 1]]); // mais tocado primeiro
  assert.equal(toques(eventos, { sup: "mesa", layout: "2col" }).total, 1);
  assert.equal(toques(eventos, { sup: "perfil", layout: "3col" }).total, 0);
});

test("toques sem superfície soma todas as telas do layout (resumo do mapa de calor)", () => {
  const ev = fabrica();
  const t = (sup, layout, alvo) => ev("a", "toque", { sup, layout, alvo, x: 0.5, y: 0.5 });
  const eventos = [t("pagina", "2col", "card"), t("mesa", "2col", "mesa"), t("perfil", "2col", "insta"), t("pagina", "3col", "card")];
  const r = toques(eventos, { layout: "2col" });
  assert.equal(r.total, 3);
  assert.deepEqual(r.porAlvo.map(([alvo]) => alvo).sort(), ["card", "insta", "mesa"]);
});
