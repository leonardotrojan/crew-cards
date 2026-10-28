// Agregações do painel: recebem os eventos como vêm do D1 e devolvem os números prontos pra mostrar.
// Funções puras, sem DOM (testadas em test/agregar.test.js).

/** @typedef {{ id: number, ts: number, visitante: string, tipo: string, pessoa: string | null, origem: string | null,
 *   face: number | null, sup: string | null, layout: string | null, x: number | null, y: number | null, alvo: string | null }} Evento */
/** @typedef {{ slug: string, nome: string, dado: number | null }} Membro */

// Qui-quadrado crítico com 5 graus de liberdade (6 faces). O painel refaz o teste a cada atualização,
// então o corte é bem mais alto que o p = 0,05 de livro: senão um dado justo acabaria acusado por azar.
export const QUI2_SUSPEITO = 20.52; // p = 0,001
export const QUI2_VICIADO = 25.74; // p = 0,0001
export const MIN_GIROS = 30; // com menos giros que isso não dá pra julgar o dado

/**
 * @param {string[]} colunas
 * @param {unknown[][]} linhas
 * @returns {Evento[]}
 */
export const linhasParaEventos = (colunas, linhas) =>
  linhas.map(linha => Object.fromEntries(colunas.map((c, i) => [c, linha[i]])));

const doTipo = (eventos, tipo) => eventos.filter(e => e.tipo === tipo);
const visitantes = eventos => new Set(eventos.map(e => e.visitante));
const contar = (itens, chave) => itens.reduce((m, it) => m.set(chave(it), (m.get(chave(it)) ?? 0) + 1), new Map());
const maiorContagem = (itens, chave) => Math.max(0, ...contar(itens, chave).values());
const capitalizar = s => s[0].toUpperCase() + s.slice(1);

/**
 * @param {Evento[]} eventos
 * @returns {{ visitantes: number, visitas: number, perfis: number, instas: number, giros: number, beijos: number, tiros: number }}
 */
export function resumo(eventos) {
  return {
    visitantes: visitantes(eventos).size,
    visitas: doTipo(eventos, "visita").length,
    perfis: doTipo(eventos, "perfil").length,
    instas: doTipo(eventos, "insta").length,
    giros: doTipo(eventos, "giro").length,
    beijos: doTipo(eventos, "beijo").length,
    tiros: doTipo(eventos, "mata").length,
  };
}

// o que conta como dar atenção pra quem o dado tirou: escolher beijo ou mata, ou abrir o Insta
const RESPOSTAS = new Set(["beijo", "mata", "insta"]);

/**
 * Rejeição: o dado tirou a pessoa (perfil com origem "dado") e o convidado apertou "Jogar de novo"
 * sem escolher beijo ou mata nem abrir o Insta dela. Fechar a mesa e girar pelo botão de fora não conta.
 * @param {Evento[]} eventos
 * @returns {Map<string, number>} pessoa → rejeições
 */
export function rejeicoes(eventos) {
  const tirada = new Map(); // visitante → pessoa que o dado mostrou e ainda está na tela
  const contagem = new Map();
  for (const e of [...eventos].sort((a, b) => a.id - b.id)) {
    if (e.tipo === "perfil") tirada.set(e.visitante, e.origem === "dado" ? e.pessoa : null);
    else if (RESPOSTAS.has(e.tipo) && tirada.get(e.visitante) === e.pessoa) tirada.set(e.visitante, null);
    else if (e.tipo === "giro") {
      const rejeitada = tirada.get(e.visitante);
      if (rejeitada && e.origem === "denovo") contagem.set(rejeitada, (contagem.get(rejeitada) ?? 0) + 1);
      tirada.set(e.visitante, null);
    }
  }
  return contagem;
}

/**
 * Ranking "mais stalkeado": visitantes únicos que abriram o Insta de cada um.
 * Conversão = dos que viram o perfil, quantos abriram o Insta (null se ninguém viu).
 * Beijos e tiros (arma de bebida) contam cada escolha, não visitantes: o celular passa de mão em mão.
 * @param {Evento[]} eventos
 * @param {Membro[]} crew
 */
export function ranking(eventos, crew) {
  const conhecidos = new Map(crew.map(p => [p.slug, p]));
  const slugs = new Set([...crew.map(p => p.slug), ...eventos.filter(e => e.pessoa).map(e => e.pessoa)]);
  const rejeitados = rejeicoes(eventos);
  return [...slugs].map(slug => {
    const perfis = eventos.filter(e => e.tipo === "perfil" && e.pessoa === slug);
    const instas = eventos.filter(e => e.tipo === "insta" && e.pessoa === slug);
    const viram = visitantes(perfis);
    const abriram = visitantes(instas);
    const membro = conhecidos.get(slug);
    return {
      slug,
      nome: membro?.nome ?? capitalizar(slug),
      dado: membro?.dado ?? null,
      perfisCard: perfis.filter(e => e.origem === "card").length,
      perfisDado: perfis.filter(e => e.origem === "dado").length,
      viram: viram.size,
      abriram: abriram.size,
      instas: instas.length,
      conversao: viram.size ? [...viram].filter(v => abriram.has(v)).length / viram.size : null,
      rejeicoes: rejeitados.get(slug) ?? 0,
      beijos: eventos.filter(e => e.tipo === "beijo" && e.pessoa === slug).length,
      tiros: eventos.filter(e => e.tipo === "mata" && e.pessoa === slug).length,
    };
  }).sort((a, b) => b.abriram - a.abriram || b.instas - a.instas || b.viram - a.viram || (a.dado ?? 99) - (b.dado ?? 99));
}

/**
 * Estatísticas do dado, com o teste de qui-quadrado contra um dado justo (cada face com 1/6).
 * @param {Evento[]} eventos
 */
export function dado(eventos) {
  const giros = doTipo(eventos, "giro");
  const impacientes = doTipo(eventos, "impaciente");
  const total = giros.length;
  const faces = [1, 2, 3, 4, 5, 6].map(f => giros.filter(e => e.face === f).length);
  const esperado = total / 6;
  const qui2 = total ? faces.reduce((soma, obs) => soma + (obs - esperado) ** 2 / esperado, 0) : 0;
  const veredito = total < MIN_GIROS ? "poucos"
    : qui2 < QUI2_SUSPEITO ? "honesto"
    : qui2 < QUI2_VICIADO ? "suspeito"
    : "viciado";
  const origens = contar(giros, e => e.origem);
  return {
    total, faces, esperado, qui2, veredito,
    origens: { botao: origens.get("botao") ?? 0, mesa: origens.get("mesa") ?? 0, denovo: origens.get("denovo") ?? 0 },
    recordeGiros: maiorContagem(giros, e => e.visitante),
    impacientes: impacientes.length,
    recordeImpaciente: maiorContagem(impacientes, e => e.visitante),
  };
}

/**
 * Toques de uma superfície (pagina | mesa | perfil) num layout (2col | 3col), pro mapa de calor.
 * Sem `sup`, soma as três telas daquele layout.
 * @param {Evento[]} eventos
 * @param {{ sup?: string, layout: string }} filtro
 */
export function toques(eventos, { sup, layout }) {
  const lista = eventos.filter(e => e.tipo === "toque" && e.layout === layout && (sup === undefined || e.sup === sup));
  const em = alvo => lista.filter(e => e.alvo === alvo).length;
  return {
    pontos: lista.map(e => ({ x: e.x, y: e.y })),
    total: lista.length,
    nada: em("nada"),
    enfeites: { lua: em("lua"), morcego: em("morcego"), olhos: em("olhos") },
    porAlvo: [...contar(lista, e => e.alvo)].sort((a, b) => b[1] - a[1]), // [alvo, toques], mais tocado primeiro
  };
}
