// Porteiro do painel em /12785e3. Sem sessão válida, responde a página de senha (ou 401 na API); com
// sessão, deixa seguir pro painel estático (public/12785e3/) e pra API de eventos. Quem guarda os números
// é a API: o HTML/JS do painel é o mesmo do repositório público e, por caminhos esquisitos (//12785e3/)
// ou com as Functions fora do ar em "fail open", pode sair sem passar por aqui, mas sem dado nenhum.
// A senha é o secret PAINEL_SENHA (npx wrangler pages secret put PAINEL_SENHA).
import {
  criarToken, tokenValido, senhaCorreta, lerCookie, nomeCookie, cookieSessao, cookieSaida,
} from "../../lib/sessao.js";
import { lerCorpo, ehPagesDev, ehLocal } from "../../lib/requisicao.js";
import { paginaLogin } from "../../lib/login.js";

const BASE = "/12785e3";
const ATRASO_SENHA_ERRADA_MS = 500; // freia quem tenta adivinhar em sequência (em paralelo, quem freia é o WAF)
const MAX_FORMULARIO = 1024;

const SEGURANCA = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "frame-src 'self'", // o mapa de calor mostra o próprio site num iframe
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
};

function comSeguranca(resposta) {
  const nova = new Response(resposta.body, resposta);
  for (const [nome, valor] of Object.entries(SEGURANCA)) nova.headers.set(nome, valor);
  return nova;
}

const texto = (corpo, status) => comSeguranca(new Response(corpo, { status }));
const html = (corpo, status) =>
  comSeguranca(new Response(corpo, { status, headers: { "Content-Type": "text/html; charset=utf-8" } }));
const irPara = (local, cookie) =>
  comSeguranca(new Response(null, { status: 303, headers: { Location: local, "Set-Cookie": cookie } }));
const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

// navegadores mandam Sec-Fetch-Site: formulário postado por outro site (CSRF) não passa
const mesmaOrigem = request => (request.headers.get("Sec-Fetch-Site") ?? "same-origin") === "same-origin";

async function entrar(request, senha, local) {
  const corpo = await lerCorpo(request, MAX_FORMULARIO);
  if (corpo === null) return texto("Formulário grande demais.", 413);
  const digitada = new URLSearchParams(corpo).get("senha");
  if (await senhaCorreta(digitada, senha)) return irPara(`${BASE}/`, cookieSessao(await criarToken(senha), { local }));
  await esperar(ATRASO_SENHA_ERRADA_MS);
  return html(paginaLogin({ erro: true }), 401);
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (ehPagesDev(url)) return texto("Não encontrado.", 404);
  if (url.protocol === "http:" && !ehLocal(url)) {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301); // a senha nunca anda sem criptografia
  }
  const senha = env.PAINEL_SENHA;
  if (!senha) return texto("Painel sem senha configurada (PAINEL_SENHA).", 503);
  const local = url.protocol === "http:"; // depois do redirecionamento acima, http só sobra no npm run dev

  const formulario = request.method === "POST" && [`${BASE}/entrar`, `${BASE}/sair`].includes(url.pathname);
  if (formulario && !mesmaOrigem(request)) return texto("Formulário de outro site.", 403);
  if (formulario && url.pathname === `${BASE}/entrar`) return entrar(request, senha, local);
  if (formulario) return irPara(`${BASE}/`, cookieSaida({ local }));

  const token = lerCookie(request.headers.get("Cookie"), nomeCookie(local));
  if (await tokenValido(token, senha)) return comSeguranca(await next());

  if (url.pathname.startsWith(`${BASE}/api/`)) {
    return comSeguranca(Response.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 }));
  }
  return html(paginaLogin(), 401);
}
