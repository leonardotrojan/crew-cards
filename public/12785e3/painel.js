// Painel da festa: busca só os eventos novos (cursor por id), agrega no navegador (agregar.js) e desenha.
// Atualiza sozinho a cada 30s enquanto a aba está visível. A crew (nomes, fotos, faces) vem da própria
// página do site, carregada no iframe do mapa de calor: a lista continua existindo só no index.html.
import { linhasParaEventos, resumo, ranking, dado, toques, MIN_GIROS, QUI2_SUSPEITO, QUI2_VICIADO } from "./agregar.js";
import { desenharCalor, rampaCss } from "./calor.js";

const API = "/12785e3/api/eventos";
const ATUALIZAR_MS = 30_000;
const CHAVE_NAO_CONTAR = "crew-nao-contar"; // a mesma do public/metricas.js
const FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// tela simulada no iframe em cada layout e raio do borrão de cada toque (px da página)
const TELAS = { "2col": { largura: 390, altura: 844, raio: 18 }, "3col": { largura: 1280, altura: 800, raio: 24 } };
const NOMES_ALVO = {
  card: "Cards da crew", girar: "Botão “Girar o dado”", mesa: "Mesa do dado", insta: "Botão do Insta",
  denovo: "Jogar de novo", fechar: "Fechar (×)", fundo: "Fora do pop-up", lua: "Lua 🌙", morcego: "Morcegos 🦇",
  olhos: "Olhos no escuro 👀", nada: "Nada (espaço vazio)",
};

const numero = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const plural = (n, um, varios) => `${numero.format(n)} ${n === 1 ? um : varios}`;

const VEREDITOS = {
  poucos: {
    selo: "⏳ Poucos giros",
    texto: d => `Com ${plural(d.total, "giro", "giros")} ainda não dá pra julgar. Faltam ${MIN_GIROS - d.total}.`,
  },
  honesto: {
    selo: "✅ Honesto",
    texto: d => `χ² = ${decimal.format(d.qui2)} em ${plural(d.total, "giro", "giros")}: normal pra um dado justo (abaixo de ${decimal.format(QUI2_SUSPEITO)}).`,
  },
  suspeito: {
    selo: "🤨 Suspeito",
    texto: d => `χ² = ${decimal.format(d.qui2)} em ${plural(d.total, "giro", "giros")}: passou de ${decimal.format(QUI2_SUSPEITO)}, coisa que um dado justo faz menos de 1 vez em 1.000.`,
  },
  viciado: {
    selo: "😈 Viciado",
    texto: d => `χ² = ${decimal.format(d.qui2)} em ${plural(d.total, "giro", "giros")}: passou de ${decimal.format(QUI2_VICIADO)}, coisa que um dado justo faz menos de 1 vez em 10.000.`,
  },
};

const $ = id => document.getElementById(id);

// cria elementos sem innerHTML: texto entra sempre como nó de texto
function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome === "class") no.className = valor;
    else if (nome === "style") Object.assign(no.style, valor);
    else no.setAttribute(nome, String(valor));
  }
  no.append(...filhos.flat().filter(f => f !== null && f !== undefined && f !== false && f !== ""));
  return no;
}

const ler = chave => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravar = (chave, valor) => {
  try { localStorage.setItem(chave, valor); } catch { /* sem localStorage: o interruptor vale só nesta aba */ }
};

let eventos = [];
let cursor = 0;
let crew = []; // { slug, nome, dado, foto } lidos dos cards do site
let sup = "pagina";
let layout = "2col";

/* ---------- dados ---------- */

class SessaoExpirada extends Error {}

async function buscarNovos() {
  for (;;) {
    const resposta = await fetch(`${API}?depois=${cursor}`, { cache: "no-store" });
    if (resposta.status === 401) throw new SessaoExpirada();
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const { colunas, linhas, mais } = await resposta.json();
    const novos = linhasParaEventos(colunas, linhas);
    if (novos.length) {
      eventos = eventos.concat(novos);
      cursor = novos[novos.length - 1].id;
    }
    if (!mais) return;
  }
}

let carregando = false;
let expirou = false;
async function atualizar() {
  if (carregando || expirou) return;
  carregando = true;
  document.body.classList.add("atualizando");
  try {
    await buscarNovos();
    desenhar();
    $("atualizado").textContent = `Atualizado às ${hora.format(new Date())}`;
    $("erro").hidden = true;
  } catch (erro) {
    // sessão vencida: um link pra entrar de novo (recarregar sozinho poderia virar laço)
    expirou = erro instanceof SessaoExpirada;
    if (expirou) $("erro").replaceChildren("Sessão expirada. ", el("a", { href: "/12785e3/" }, "Entrar de novo"));
    else $("erro").textContent = "Não deu pra atualizar agora; tento de novo em 30s.";
    $("erro").hidden = false;
  } finally {
    carregando = false;
    document.body.classList.remove("atualizando");
  }
}

function desenhar() {
  $("dica").hidden = true;
  desenharResumo(resumo(eventos));
  desenharRanking(ranking(eventos, crew));
  desenharDado(dado(eventos));
  desenharCalorAtual();
}

/* ---------- números do topo ---------- */

function desenharResumo(r) {
  $("k-visitantes").textContent = numero.format(r.visitantes);
  $("k-visitas").textContent = `${plural(r.visitas, "visita", "visitas")} no total`;
  $("k-perfis").textContent = numero.format(r.perfis);
  $("k-instas").textContent = numero.format(r.instas);
  $("k-giros").textContent = numero.format(r.giros);
}

/* ---------- ranking ---------- */

const miniDado = n => el("span", { class: "mini-dado", "aria-hidden": "true" },
  Array.from({ length: 9 }, (_, i) => el("i", { class: FACES[n]?.includes(i) ? "on" : null })));

// um anel por pessoa, reaproveitado entre atualizações (a foto não pisca a cada 30s)
const aneis = new Map();
function anelDe(p) {
  if (!aneis.has(p.slug)) {
    const avatar = el("span", { class: "avatar" }, p.nome[0]);
    const foto = crew.find(c => c.slug === p.slug)?.foto;
    if (foto) {
      const img = el("img", { src: foto, alt: "", decoding: "async" });
      img.addEventListener("load", () => avatar.replaceChildren(img), { once: true });
    }
    aneis.set(p.slug, el("span", { class: "anel" }, avatar, p.dado ? miniDado(p.dado) : null));
  }
  return aneis.get(p.slug);
}

// duas linhas curtas: de onde vieram os perfis; conversão e rejeições
function detalhesDe(p) {
  const perfis = plural(p.perfisCard + p.perfisDado, "perfil", "perfis");
  const conversao = p.conversao === null ? null : `${porcento.format(p.conversao)} de quem viu abriu o Insta`;
  const rejeicoes = p.rejeicoes ? el("span", { class: "junto" }, `💔 ${plural(p.rejeicoes, "rejeição", "rejeições")}`) : null;
  return [
    el("span", {}, `${perfis} (${numero.format(p.perfisCard)} card · ${numero.format(p.perfisDado)} dado)`),
    conversao || rejeicoes ? el("span", {}, conversao, conversao && rejeicoes ? " · " : null, rejeicoes) : null,
  ];
}

function desenharRanking(lista) {
  const maior = Math.max(1, ...lista.map(p => p.abriram));
  $("ranking").replaceChildren(...lista.map((p, i) => {
    const coroa = i === 0 && p.abriram > 0;
    return el("li", { class: coroa ? "linha primeiro" : "linha" },
      el("span", { class: "pos" }, String(i + 1)),
      anelDe(p),
      el("span", { class: "nome" }, p.nome, coroa ? " 👑" : ""),
      el("span", { class: "valor" },
        el("strong", {}, numero.format(p.abriram)),
        el("span", {}, p.abriram === 1 ? "pessoa" : "pessoas")),
      el("span", {
        class: "trilho", tabindex: 0,
        "aria-label": `${p.nome}: ${plural(p.abriram, "pessoa abriu", "pessoas abriram")} o Insta`,
        "data-valor": plural(p.abriram, "pessoa abriu o Insta", "pessoas abriram o Insta"),
        "data-rotulo": `${p.nome} · ${plural(p.instas, "abertura", "aberturas")} no total`,
      }, el("span", { style: { width: `${(p.abriram / maior) * 100}%` } })),
      el("span", { class: "meta" }, detalhesDe(p)));
  }));
}

/* ---------- dado ---------- */

const quemEhFace = f => crew.find(c => c.dado === f)?.nome ?? "";

function desenharDado(d) {
  const veredito = VEREDITOS[d.veredito];
  $("selo").textContent = veredito.selo;
  $("selo").dataset.status = d.veredito;
  $("explica").textContent = veredito.texto(d);

  // escala comum às barras e à linha do esperado; a ponta reserva --sobra pro número
  const maior = Math.max(1, d.esperado, ...d.faces);
  const ate = f => `calc((100% - var(--sobra)) * ${f})`;
  const fatia = n => (d.total ? n / d.total : 0);
  $("barras-dado").replaceChildren(...d.faces.map((n, i) => {
    const face = i + 1;
    const quem = quemEhFace(face) || `Face ${face}`;
    return el("div", {
      class: "barra-dado", tabindex: 0, role: "img",
      "aria-label": `Face ${face}, ${quem}: ${plural(n, "giro", "giros")}`,
      "data-valor": `${plural(n, "giro", "giros")} · ${porcento.format(fatia(n))}`,
      "data-rotulo": `Face ${face} · ${quem} · esperado ${decimal.format(d.esperado)}`,
    },
    el("span", { class: "quem-face" }, miniDado(face), quem),
    el("span", { class: "trilha-dado" },
      el("span", { class: "barra", style: { width: ate(n / maior) } }),
      el("span", { class: "valor-dado" }, numero.format(n))));
  }));
  $("esperado").hidden = !d.total;
  $("esperado").style.left = `calc(var(--col) + var(--vao) + (100% - var(--col) - var(--vao) - var(--sobra)) * ${d.esperado / maior})`;
  $("legenda-dado").hidden = !d.total;
  $("esperado-rotulo").textContent = `esperado por face num dado justo: ${decimal.format(d.esperado)}`;

  $("r-giros").textContent = numero.format(d.recordeGiros);
  $("r-impacientes").textContent = numero.format(d.impacientes);
  $("r-impacientes-nota").textContent = `toques na mesa com o dado ainda rolando${d.recordeImpaciente ? ` · recorde de uma pessoa: ${numero.format(d.recordeImpaciente)}` : ""}`;
  $("r-origens").textContent = d.total
    ? `Botão de cima ${numero.format(d.origens.botao)} · mesa ${numero.format(d.origens.mesa)} · “jogar de novo” ${numero.format(d.origens.denovo)}`
    : "Ninguém girou ainda.";
  $("tabela-dado").replaceChildren(...d.faces.map((n, i) => el("tr", {},
    el("td", {}, String(i + 1)), el("td", {}, quemEhFace(i + 1) || "–"),
    el("td", { class: "num" }, numero.format(n)), el("td", { class: "num" }, porcento.format(fatia(n))))));
}

/* ---------- mapa de calor ---------- */

// Um palco por tela (página, mesa, perfil), cada um com o próprio iframe do site e o próprio canvas.
// Na tela estreita só aparece (e só carrega) o da aba escolhida; na larga, os três lado a lado.
const largo = matchMedia("(min-width: 1100px)"); // o mesmo corte do CSS
const PREVIA_MAX_MS = 15_000;

const lerCrew = doc => [...doc.querySelectorAll(".card[data-pessoa]")].map(card => {
  const foto = card.querySelector(".avatar")?.dataset.foto;
  return {
    slug: card.dataset.pessoa,
    nome: card.querySelector("h2")?.textContent.trim() || card.dataset.pessoa,
    dado: Number(card.dataset.dado) || null,
    foto: foto ? `/${foto}` : null,
  };
});

const doisQuadros = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

function criarPalco(figura) {
  const sup = figura.dataset.palco;
  const iframe = figura.querySelector("iframe");
  const caixa = figura.querySelector(".palco");
  const escala = figura.querySelector(".escala");
  const canvas = figura.querySelector("canvas");
  const conta = figura.querySelector(".conta-palco");
  let previa = null; // o site no iframe (o metricas.js dele fica desligado por estar dentro de iframe)
  let montado = null; // { layout, altura, mapear } da última montagem
  let fila = Promise.resolve(); // um desenho de cada vez: remontar no meio de outra montagem embaralharia tudo

  // se falhar ou demorar, a próxima atualização tenta de novo
  function carregarPrevia() {
    previa ??= new Promise((resolve, reject) => {
      const desistir = setTimeout(() => reject(new Error("a prévia demorou demais")), PREVIA_MAX_MS);
      iframe.addEventListener("load", async () => {
        clearTimeout(desistir);
        const doc = iframe.contentDocument;
        if (!doc?.querySelector("main")) {
          reject(new Error("a prévia não carregou o site"));
          return;
        }
        // a prévia é só cenário: nada lá dentro pode puxar o foco (e a rolagem, no Safari) do painel
        doc.defaultView.HTMLElement.prototype.focus = () => {};
        // sem animação no pop-up (medir no meio do "pop" daria posições tortas) e enfeites parados (gasta menos
        // com três prévias abertas); as fotos seguem animando, senão ficam presas no começo do fade, invisíveis
        doc.head.append(el("style", {}, `dialog, dialog *, dialog::backdrop { animation: none !important; transition: none !important; }
          .night, .night *, .spark, h1, .go-insta { animation-play-state: paused !important; }`));
        await doc.fonts?.ready;
        resolve(doc);
      }, { once: true });
      iframe.src = "/";
    }).catch(erro => {
      previa = null;
      throw erro;
    });
    return previa;
  }

  // abrir o pop-up no iframe puxa o foco (e a rolagem) pra dentro dele: devolve os dois
  function semRoubarFoco(acao) {
    const foco = document.activeElement;
    const { scrollX, scrollY } = window;
    acao();
    if (foco instanceof HTMLElement && foco !== document.body) foco.focus({ preventScroll: true });
    else iframe.blur();
    window.scrollTo(scrollX, scrollY);
  }

  // arruma o site no iframe na tela deste palco e devolve como levar as frações gravadas pra pixels da página
  async function montar(doc, layout) {
    const tela = TELAS[layout];
    const dialogo = doc.getElementById("roll-dialog");
    semRoubarFoco(() => { if (dialogo.open) dialogo.close(); });
    iframe.style.width = `${tela.largura}px`;
    iframe.style.height = `${tela.altura}px`;
    await doisQuadros();

    if (sup === "pagina") {
      const altura = doc.documentElement.scrollHeight; // a página inteira, sem rolagem dentro do iframe
      iframe.style.height = `${altura}px`;
      await doisQuadros();
      const r = doc.querySelector("main").getBoundingClientRect();
      return { altura, mapear: ({ x, y }) => ({ x: r.left + x * r.width, y: r.top + y * r.height }) };
    }

    semRoubarFoco(() => {
      if (sup === "mesa") {
        doc.getElementById("reveal").hidden = true;
        dialogo.showModal();
      } else {
        doc.querySelector(".card")?.click(); // abre o perfil de alguém, igual a um convidado
      }
    });
    await doisQuadros();
    const r = dialogo.getBoundingClientRect();
    const { scrollHeight, scrollTop } = dialogo;
    return { altura: tela.altura, mapear: ({ x, y }) => ({ x: r.left + x * r.width, y: r.top + y * scrollHeight - scrollTop }) };
  }

  function ajustarEscala(largura, altura, layout) {
    caixa.classList.toggle("largo", layout === "3col");
    const k = Math.min(1, caixa.clientWidth / largura);
    escala.style.width = `${largura}px`;
    escala.style.height = `${altura}px`;
    escala.style.transform = `scale(${k})`;
    caixa.style.height = `${Math.ceil(altura * k)}px`;
    return k;
  }

  async function desenharAgora() {
    const atual = layout; // congelado aqui: um clique no meio da montagem entra na fila como a próxima rodada
    const t = toques(eventos, { sup, layout: atual });
    conta.textContent = plural(t.total, "toque", "toques");
    const doc = await carregarPrevia();
    if (montado?.layout !== atual) montado = { layout: atual, ...(await montar(doc, atual)) };
    const tela = TELAS[atual];
    const k = ajustarEscala(tela.largura, montado.altura, atual);
    const resolucao = Math.min(2, window.devicePixelRatio || 1) * k;
    canvas.width = Math.round(tela.largura * resolucao);
    canvas.height = Math.round(montado.altura * resolucao);
    canvas.style.width = `${tela.largura}px`;
    canvas.style.height = `${montado.altura}px`;
    const pontos = t.pontos.map(montado.mapear).map(p => ({ x: p.x * resolucao, y: p.y * resolucao }));
    desenharCalor(canvas, pontos, tela.raio * resolucao);
  }

  return {
    sup,
    figura,
    carregarPrevia,
    desenhar() {
      const vez = fila.then(desenharAgora);
      fila = vez.catch(() => {});
      return vez;
    },
  };
}

const palcos = [...document.querySelectorAll("[data-palco]")].map(criarPalco);

// resumo ao lado: as três telas somadas, no aparelho escolhido
function desenharInfoCalor(t) {
  $("calor-escopo").textContent = layout === "2col" ? "Todos os toques no celular" : "Todos os toques no computador";
  $("calor-total").textContent = numero.format(t.total);
  $("calor-nada").textContent = t.total ? porcento.format(t.nada / t.total) : "–";
  const { lua, morcego, olhos } = t.enfeites;
  $("calor-enfeites").textContent = `Tentaram tocar nos enfeites: 🌙 lua ${lua} · 🦇 morcegos ${morcego} · 👀 olhos ${olhos}`;
  $("tabela-alvos").replaceChildren(...(t.total
    ? t.porAlvo.map(([alvo, n]) => el("tr", {},
      el("td", {}, NOMES_ALVO[alvo] ?? alvo), el("td", { class: "num" }, numero.format(n)),
      el("td", { class: "num" }, porcento.format(n / t.total))))
    : [el("tr", {}, el("td", { colspan: 3 }, "Nenhum toque ainda."))]));
}

function desenharCalorAtual() {
  $("calor").classList.toggle("computador", layout === "3col");
  for (const p of palcos) p.figura.classList.toggle("ativo", p.sup === sup); // antes de medir: o visível tem largura
  desenharInfoCalor(toques(eventos, { layout }));
  const visiveis = palcos.filter(p => largo.matches || p.sup === sup);
  Promise.all(visiveis.map(p => p.desenhar())).then(
    () => { $("calor-erro").hidden = true; },
    () => {
      $("calor-erro").textContent = "Não deu pra montar a prévia do site; os números continuam valendo.";
      $("calor-erro").hidden = false;
    });
}

function marcarBotoes() {
  for (const b of document.querySelectorAll("[data-sup]")) b.setAttribute("aria-pressed", String(b.dataset.sup === sup));
  for (const b of document.querySelectorAll("[data-layout]")) b.setAttribute("aria-pressed", String(b.dataset.layout === layout));
}

/* ---------- dica (tooltip): valor em destaque, rótulo embaixo ---------- */

const dica = $("dica");
function mostrarDica(alvo) {
  dica.replaceChildren(el("strong", {}, alvo.dataset.valor), alvo.dataset.rotulo ?? "");
  dica.hidden = false;
  const r = alvo.getBoundingClientRect();
  const d = dica.getBoundingClientRect();
  const x = Math.min(innerWidth - d.width - 8, Math.max(8, r.left + r.width / 2 - d.width / 2));
  const y = r.top - d.height - 8 >= 8 ? r.top - d.height - 8 : r.bottom + 8;
  dica.style.left = `${x}px`;
  dica.style.top = `${y}px`;
}
document.addEventListener("pointerover", e => {
  const alvo = e.target instanceof Element ? e.target.closest("[data-valor]") : null;
  if (alvo) mostrarDica(alvo);
  else dica.hidden = true;
});
document.addEventListener("focusin", e => {
  const alvo = e.target instanceof Element ? e.target.closest("[data-valor]") : null;
  if (alvo) mostrarDica(alvo);
});
document.addEventListener("focusout", () => { dica.hidden = true; });
addEventListener("scroll", () => { dica.hidden = true; }, { passive: true });

/* ---------- início ---------- */

// quem abre o painel é da crew: por padrão este aparelho sai da conta (pra não inflar o próprio ranking)
const interruptor = $("nao-contar");
if (ler(CHAVE_NAO_CONTAR) === null) gravar(CHAVE_NAO_CONTAR, "1");
interruptor.checked = ler(CHAVE_NAO_CONTAR) !== "0";
interruptor.addEventListener("change", () => gravar(CHAVE_NAO_CONTAR, interruptor.checked ? "1" : "0"));

$("escala-faixa").style.background = rampaCss();
for (const b of document.querySelectorAll("[data-sup]")) {
  b.addEventListener("click", () => { sup = b.dataset.sup; marcarBotoes(); desenharCalorAtual(); });
}
for (const b of document.querySelectorAll("[data-layout]")) {
  b.addEventListener("click", () => { layout = b.dataset.layout; marcarBotoes(); desenharCalorAtual(); });
}
marcarBotoes();

let redimensionar = 0;
addEventListener("resize", () => {
  clearTimeout(redimensionar);
  redimensionar = setTimeout(desenharCalorAtual, 200);
});

$("atualizar").addEventListener("click", atualizar);
document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizar(); });
setInterval(() => { if (!document.hidden) atualizar(); }, ATUALIZAR_MS);

// a crew vem do palco da página (o primeiro a carregar, em qualquer largura de tela)
palcos.find(p => p.sup === "pagina").carregarPrevia()
  .then(doc => { crew = lerCrew(doc); aneis.clear(); desenhar(); })
  .catch(() => { /* sem prévia: ranking só com quem aparece nos eventos; o aviso sai no mapa de calor */ });
atualizar();
