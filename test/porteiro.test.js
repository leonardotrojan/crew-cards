import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/12785e3/_middleware.js";
import { COOKIE } from "../lib/sessao.js";

const SENHA = "abobora morcego dado lua";
const SEGREDO = "conteúdo do painel";
const proximo = async () => new Response(SEGREDO, { headers: { "Content-Type": "text/html" } });

function pedir(caminho, { metodo = "GET", corpo, cabecalhos = {}, origem = "https://qualseunumerodasorte.party", env = { PAINEL_SENHA: SENHA } } = {}) {
  const request = new Request(`${origem}${caminho}`, { method: metodo, body: corpo, headers: cabecalhos });
  return onRequest({ request, env, next: proximo });
}
const formulario = senha => ({
  metodo: "POST",
  corpo: new URLSearchParams({ senha }).toString(),
  cabecalhos: { "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "same-origin" },
});
const cookieDe = resposta => resposta.headers.get("Set-Cookie")?.match(new RegExp(`${COOKIE}=([^;]*)`))?.[1];

test("sem sessão: página de senha em qualquer caminho, nunca o painel", async () => {
  for (const caminho of ["/12785e3", "/12785e3/", "/12785e3/index.html", "/12785e3/painel.js"]) {
    const resposta = await pedir(caminho);
    assert.equal(resposta.status, 401, caminho);
    const html = await resposta.text();
    assert.match(html, /Painel da festa/);
    assert.ok(!html.includes(SEGREDO));
    assert.equal(resposta.headers.get("Cache-Control"), "no-store");
  }
});

test("sem sessão a API responde 401 em JSON", async () => {
  const resposta = await pedir("/12785e3/api/eventos?depois=0");
  assert.equal(resposta.status, 401);
  assert.ok((await resposta.json()).erro);
});

test("senha certa cria a sessão e com ela o painel passa, com cabeçalhos de segurança", async () => {
  const entrada = await pedir("/12785e3/entrar", formulario(SENHA));
  assert.equal(entrada.status, 303);
  assert.equal(entrada.headers.get("Location"), "/12785e3/");
  const token = cookieDe(entrada);
  assert.ok(token);

  const painel = await pedir("/12785e3/", { cabecalhos: { Cookie: `${COOKIE}=${token}` } });
  assert.equal(painel.status, 200);
  assert.equal(await painel.text(), SEGREDO);
  assert.equal(painel.headers.get("X-Frame-Options"), "DENY");
  assert.match(painel.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.match(painel.headers.get("Strict-Transport-Security"), /max-age=\d+/);
});

test("senha errada demora, avisa e não cria sessão", async () => {
  const antes = Date.now();
  const resposta = await pedir("/12785e3/entrar", formulario("chute"));
  assert.ok(Date.now() - antes >= 400);
  assert.equal(resposta.status, 401);
  assert.match(await resposta.text(), /Senha errada/);
  assert.equal(resposta.headers.get("Set-Cookie"), null);
});

test("cookie adulterado não abre o painel", async () => {
  const resposta = await pedir("/12785e3/", { cabecalhos: { Cookie: `${COOKIE}=9999999999999.${"A".repeat(43)}` } });
  assert.equal(resposta.status, 401);
});

test("sair apaga o cookie", async () => {
  const resposta = await pedir("/12785e3/sair", { metodo: "POST", cabecalhos: { "Sec-Fetch-Site": "same-origin" } });
  assert.equal(resposta.status, 303);
  assert.match(resposta.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("formulário postado de outro site é recusado", async () => {
  const resposta = await pedir("/12785e3/entrar", { ...formulario(SENHA), cabecalhos: { ...formulario(SENHA).cabecalhos, "Sec-Fetch-Site": "cross-site" } });
  assert.equal(resposta.status, 403);
  assert.equal(resposta.headers.get("Set-Cookie"), null);
});

test("login com corpo enorme é recusado sem ler tudo", async () => {
  const resposta = await pedir("/12785e3/entrar", { ...formulario("x".repeat(5000)) });
  assert.equal(resposta.status, 413);
});

test("sem PAINEL_SENHA o painel fica fechado", async () => {
  const resposta = await pedir("/12785e3/", { env: {} });
  assert.equal(resposta.status, 503);
  assert.ok(!(await resposta.text()).includes(SEGREDO));
});

test("http vira https fora do computador local", async () => {
  const resposta = await pedir("/12785e3/", { origem: "http://qualseunumerodasorte.party" });
  assert.equal(resposta.status, 301);
  assert.equal(resposta.headers.get("Location"), "https://qualseunumerodasorte.party/12785e3/");
  assert.equal((await pedir("/12785e3/", { origem: "http://127.0.0.1:8788" })).status, 401); // dev local segue em http
});

test("no npm run dev (http local) a sessão usa cookie sem Secure, que o Safari aceita", async () => {
  const LOCAL = "http://127.0.0.1:8788";
  const entrada = await pedir("/12785e3/entrar", { ...formulario(SENHA), origem: LOCAL });
  assert.equal(entrada.status, 303);
  const cookie = entrada.headers.get("Set-Cookie");
  assert.match(cookie, /^painel=/);
  assert.ok(!/Secure/i.test(cookie), cookie);
  const token = cookie.match(/^painel=([^;]*)/)[1];
  assert.equal((await pedir("/12785e3/", { origem: LOCAL, cabecalhos: { Cookie: `painel=${token}` } })).status, 200);

  // em produção (https) esse cookie sem Secure não vale nada
  assert.equal((await pedir("/12785e3/", { cabecalhos: { Cookie: `painel=${token}` } })).status, 401);
});

test("endereço *.pages.dev não abre o painel", async () => {
  const resposta = await pedir("/12785e3/", { origem: "https://fantasia-dado.pages.dev" });
  assert.equal(resposta.status, 404);
});
