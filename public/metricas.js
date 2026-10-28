// Métricas da festa: junta o que acontece na página e manda em lotes pra /api/e (Pages Function → D1).
// Nada de cookie, IP ou user-agent: só um id aleatório guardado no localStorage deste navegador.
// Fica desligado dentro de iframe (o painel mostra o site num iframe), fora de http(s) (arquivo aberto direto)
// e em aparelho marcado pra não contar: /?nt=1 marca, /?nt=0 desmarca (o painel também tem esse botão).
// Tudo dentro da função: o index.html já tem globais como timer, alvo e dialog.
(() => {
  "use strict";
  const ENDPOINT = "/api/e";
  const CHAVE_VISITANTE = "crew-visitante";
  const CHAVE_NAO_CONTAR = "crew-nao-contar";
  const ESPERA_MS = 5000; // junta eventos por até 5s antes de mandar
  const LOTE_MAX = 20;
  const TOQUE_MAX_PX = 12; // mexeu mais que isso entre apertar e soltar: foi arrasto, não toque
  const TOQUE_MAX_MS = 800;

  const ler = chave => { try { return localStorage.getItem(chave); } catch { return null; } };
  const gravar = (chave, valor) => {
    try { localStorage.setItem(chave, valor); } catch { /* sem localStorage (aba privada, bloqueio): só não lembra entre visitas */ }
  };

  // "1" = não contar; "0" = contar (escolha explícita, que o painel respeita em vez de marcar "1" sozinho)
  const nt = new URLSearchParams(location.search).get("nt");
  if (nt === "1" || nt === "0") {
    gravar(CHAVE_NAO_CONTAR, nt);
    // tira o ?nt= do endereço: quem copiar o link pra mandar pra alguém não leva a marcação junto
    try {
      const limpo = new URL(location.href);
      limpo.searchParams.delete("nt");
      history.replaceState(history.state, "", limpo);
    } catch { /* sem history (arquivo aberto direto): o endereço fica como está */ }
  }
  if (window.top !== window || !/^https?:$/.test(location.protocol) || ler(CHAVE_NAO_CONTAR) === "1") return;

  const visitante = ler(CHAVE_VISITANTE)
    || Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join("");
  gravar(CHAVE_VISITANTE, visitante);

  let fila = [];
  let espera = 0;

  function enviar() {
    clearTimeout(espera);
    espera = 0;
    if (!fila.length) return;
    const agora = performance.now();
    // dt = há quanto tempo cada evento aconteceu; o servidor usa o próprio relógio (o do celular pode estar errado)
    const corpo = JSON.stringify({ v: visitante, e: fila.map(({ t, ...ev }) => ({ ...ev, dt: Math.round(agora - t) })) });
    fila = [];
    try {
      if (navigator.sendBeacon(ENDPOINT, corpo)) return;
    } catch { /* sem beacon: vai de fetch */ }
    fetch(ENDPOINT, { method: "POST", body: corpo, keepalive: true }).catch(() => { /* métrica perdida não atrapalha a festa */ });
  }

  function registrar(tipo, dados = {}) {
    fila.push({ ...dados, tipo, t: performance.now() });
    // abrir o Insta pode tirar a pessoa da página na hora: manda já
    if (tipo === "insta" || fila.length >= LOTE_MAX) enviar();
    else if (!espera) espera = setTimeout(enviar, ESPERA_MS);
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviar(); });
  addEventListener("pagehide", enviar);

  /* ---------- toques (mapa de calor) ---------- */
  // o primeiro seletor que casar com o elemento tocado dá o nome do alvo
  const ALVOS = [[".card", "card"], ["#open-roll", "girar"], ["#palco-dado", "dado"], ["#table", "mesa"],
    ["[data-escolha='beijo']", "beijo"], ["[data-escolha='mata']", "mata"], [".reveal .ring", "foto"], [".arroba", "insta"],
    ["#again", "denovo"], [".close", "fechar"]];
  // enfeites do céu têm pointer-events: none, então o toque é conferido pela posição
  const ENFEITES = [[".moon", "lua"], [".bat", "morcego"], [".eyes", "olhos"]];
  const celular = matchMedia("(max-width: 680px)"); // mesmo corte da grade de 2 colunas no CSS
  const layout = () => (celular.matches ? "2col" : "3col");

  const dentro = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const enfeiteEm = (x, y) => ENFEITES.find(([sel]) =>
    [...document.querySelectorAll(`.night ${sel}`)].some(el => dentro(el.getBoundingClientRect(), x, y)))?.[1];

  function descreverToque(e) {
    const dialogo = document.getElementById("roll-dialog");
    const aberto = Boolean(dialogo?.open);
    const caixa = (aberto ? dialogo : document.querySelector("main")).getBoundingClientRect();
    const el = e.target instanceof Element ? e.target : null;
    // posição em fração da superfície; o pop-up do perfil rola por dentro, então y conta a altura do conteúdo todo
    const x = (e.clientX - caixa.left) / caixa.width;
    const y = aberto
      ? (e.clientY - caixa.top + dialogo.scrollTop) / dialogo.scrollHeight
      : (e.clientY - caixa.top) / caixa.height;
    const sup = !aberto ? "pagina" : document.getElementById("reveal")?.hidden ? "mesa" : "perfil";
    const alvo = ALVOS.find(([sel]) => el?.closest(sel))?.[1]
      ?? (aberto ? (dentro(caixa, e.clientX, e.clientY) ? "nada" : "fundo") : enfeiteEm(e.clientX, e.clientY) ?? "nada");
    return { sup, layout: layout(), x: +x.toFixed(3), y: +y.toFixed(3), alvo, pessoa: el?.closest(".card")?.dataset.pessoa };
  }

  // toque = apertar e soltar no mesmo lugar, rápido. Rolar a página dispara pointercancel e não conta.
  let inicio = null;
  const opcoes = { capture: true, passive: true };
  addEventListener("pointerdown", e => {
    inicio = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId } : null;
  }, opcoes);
  addEventListener("pointercancel", () => { inicio = null; }, opcoes);
  addEventListener("pointerup", e => {
    const i = inicio;
    inicio = null;
    if (!i || e.pointerId !== i.id) return;
    if (Math.hypot(e.clientX - i.x, e.clientY - i.y) > TOQUE_MAX_PX || e.timeStamp - i.t > TOQUE_MAX_MS) return;
    registrar("toque", descreverToque(e));
  }, opcoes);

  window.metricas = { registrar, enviar };
  registrar("visita", { layout: layout() });
})();
