// Validação dos lotes que o public/metricas.js manda pra /api/e. Tudo que vem do navegador é suspeito:
// só passam tipos e campos conhecidos, com formato e faixa limitados. Evento inválido é descartado
// (o resto do lote segue); lote sem visitante válido é descartado inteiro.

export const MAX_BYTES = 8 * 1024;
export const MAX_EVENTOS = 20; // o mesmo lote máximo que o metricas.js manda
export const MAX_ATRASO_MS = 10 * 60 * 1000; // evento parado na fila mais que isso conta como "agora - 10min"

// ordem das colunas na tabela eventos (schema.sql), sem o id
export const COLUNAS = ["ts", "visitante", "tipo", "pessoa", "origem", "face", "sup", "layout", "x", "y", "alvo"];

// slugs da crew (nome em minúsculas, como no public/index.html): sem isso, qualquer um inventaria
// gente nova no ranking. O teste test/eventos.test.js confere que as duas listas batem.
export const PESSOAS = new Set(["ian", "igor", "seibt", "matheus", "leonardo", "gabriel"]);

const VISITANTE = /^[a-z0-9]{8,32}$/;
const LAYOUTS = ["2col", "3col"];
const SUPERFICIES = ["pagina", "mesa", "perfil"];
const ALVOS = ["card", "girar", "dado", "mesa", "beijo", "mata", "foto", "insta", "denovo", "fechar", "fundo",
  "lua", "morcego", "olhos", "nada"];
const ORIGENS = {
  perfil: ["card", "dado"], // também vale pra beijo e mata, escolhidos dentro do perfil
  insta: ["card", "dado", "direto"],
  giro: ["botao", "mesa", "denovo"],
};

const umDe = (lista, v) => (lista.includes(v) ? v : null);
const pessoa = v => (PESSOAS.has(v) ? v : null);
const face = v => (Number.isInteger(v) && v >= 1 && v <= 6 ? v : null);
const fracao = v => (typeof v === "number" && Number.isFinite(v)
  ? Math.round(Math.min(1.5, Math.max(-0.5, v)) * 1000) / 1000
  : null);

// perfil aberto, ou a escolha feita nele (beijo ou mata): pessoa + de onde o perfil veio
const noPerfil = e => {
  const campos = { pessoa: pessoa(e.pessoa), origem: umDe(ORIGENS.perfil, e.origem) };
  return campos.pessoa && campos.origem ? campos : null;
};

// cada tipo devolve só os campos dele já validados, ou null se o evento não serve
const TIPOS = {
  visita: e => ({ layout: umDe(LAYOUTS, e.layout) }),
  perfil: noPerfil,
  beijo: noPerfil,
  mata: noPerfil,
  insta: e => {
    const campos = { pessoa: pessoa(e.pessoa), origem: umDe(ORIGENS.insta, e.origem) };
    return campos.pessoa && campos.origem ? campos : null;
  },
  giro: e => {
    const campos = { face: face(e.face), origem: umDe(ORIGENS.giro, e.origem), pessoa: pessoa(e.pessoa) };
    return campos.face && campos.origem ? campos : null;
  },
  impaciente: () => ({}),
  toque: e => {
    const campos = {
      sup: umDe(SUPERFICIES, e.sup), layout: umDe(LAYOUTS, e.layout),
      x: fracao(e.x), y: fracao(e.y),
      alvo: umDe(ALVOS, e.alvo) ?? "nada", pessoa: pessoa(e.pessoa),
    };
    return campos.sup && campos.x !== null && campos.y !== null ? campos : null;
  },
};

const VAZIO = Object.freeze(Object.fromEntries(COLUNAS.map(c => [c, null])));

/**
 * Valida um evento cru e devolve a linha pronta pro INSERT (todas as COLUNAS, null onde não se aplica).
 * @param {unknown} cru
 * @param {string} visitante já validado
 * @param {number} agora epoch ms do servidor
 * @returns {Record<string, string | number | null> | null}
 */
export function validarEvento(cru, visitante, agora) {
  // tipo só como texto: um array ou objeto viraria texto no hasOwn (e um toString falso estouraria)
  if (!cru || typeof cru !== "object" || typeof cru.tipo !== "string" || !Object.hasOwn(TIPOS, cru.tipo)) return null;
  const campos = TIPOS[cru.tipo](cru);
  if (!campos) return null;
  const atraso = Number.isInteger(cru.dt) && cru.dt > 0 ? Math.min(cru.dt, MAX_ATRASO_MS) : 0;
  return { ...VAZIO, ...campos, ts: agora - atraso, visitante, tipo: cru.tipo };
}

/**
 * Valida o corpo `{ v: visitante, e: [eventos] }` mandado pelo navegador.
 * @param {unknown} corpo
 * @param {number} agora epoch ms do servidor
 * @returns {Array<Record<string, string | number | null>>} linhas válidas (pode ser vazio)
 */
export function validarLote(corpo, agora) {
  if (!corpo || typeof corpo !== "object" || !Array.isArray(corpo.e)) return [];
  if (typeof corpo.v !== "string" || !VISITANTE.test(corpo.v)) return [];
  return corpo.e.slice(0, MAX_EVENTOS).map(e => validarEvento(e, corpo.v, agora)).filter(Boolean);
}
