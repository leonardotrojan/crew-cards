import { test } from "node:test";
import assert from "node:assert/strict";
import {
  criarToken, tokenValido, senhaCorreta, lerCookie, cookieSessao, cookieSaida, nomeCookie, COOKIE, COOKIE_LOCAL, DURACAO_MS,
} from "../lib/sessao.js";

const SENHA = "abobora morcego dado lua";
const AGORA = 1_760_000_000_000;

test("token criado com a senha é válido até expirar", async () => {
  const token = await criarToken(SENHA, AGORA);
  assert.match(token, /^\d{13}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await tokenValido(token, SENHA, AGORA + 1000), true);
  assert.equal(await tokenValido(token, SENHA, AGORA + DURACAO_MS - 1), true);
  assert.equal(await tokenValido(token, SENHA, AGORA + DURACAO_MS + 1), false);
});

test("token adulterado, de outra senha ou malformado não vale", async () => {
  const token = await criarToken(SENHA, AGORA);
  const [exp, sig] = token.split(".");
  const outraSig = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
  const casos = [
    `${Number(exp) + 999_999}.${sig}`, // estendeu a validade
    `${exp}.${outraSig}`,
    await criarToken("outra senha", AGORA),
    "", "abc", `${exp}.`, `.${sig}`, `${exp}.${sig}.x`, null, undefined, 42,
  ];
  for (const caso of casos) assert.equal(await tokenValido(caso, SENHA, AGORA), false, `token ${caso}`);
});

test("sem senha configurada nada vale e não dá pra criar token", async () => {
  const token = await criarToken(SENHA, AGORA);
  assert.equal(await tokenValido(token, "", AGORA), false);
  assert.equal(await tokenValido(token, undefined, AGORA), false);
  assert.equal(await senhaCorreta("", ""), false);
  assert.equal(await senhaCorreta("x", undefined), false);
  await assert.rejects(criarToken("", AGORA));
});

test("senhaCorreta compara a senha inteira", async () => {
  assert.equal(await senhaCorreta(SENHA, SENHA), true);
  for (const tentativa of ["abobora", `${SENHA} `, SENHA.toUpperCase(), "", null, undefined, 123]) {
    assert.equal(await senhaCorreta(tentativa, SENHA), false, `tentativa ${tentativa}`);
  }
});

test("lerCookie acha o valor certo no cabeçalho", () => {
  const cabecalho = `outro=1; ${COOKIE}=123.abc=; x=y`;
  assert.equal(lerCookie(cabecalho, COOKIE), "123.abc=");
  assert.equal(lerCookie("x=y", COOKIE), null);
  assert.equal(lerCookie(null, COOKIE), null);
  assert.equal(lerCookie(`${COOKIE}x=1`, COOKIE), null);
});

test("cookie da sessão é __Host-, HttpOnly, Secure e SameSite=Strict, sem Domain", () => {
  const c = cookieSessao("tok");
  assert.match(c, new RegExp(`^${COOKIE}=tok;`));
  for (const parte of ["Path=/", "HttpOnly", "Secure", "SameSite=Strict", `Max-Age=${DURACAO_MS / 1000}`]) {
    assert.ok(c.includes(parte), parte);
  }
  assert.ok(!/domain/i.test(c));
  assert.match(cookieSaida(), new RegExp(`^${COOKIE}=;.*Max-Age=0`));
});

test("no dev local o cookie não tem Secure nem __Host- (Safari recusa em http)", () => {
  const c = cookieSessao("tok", { local: true });
  assert.match(c, new RegExp(`^${COOKIE_LOCAL}=tok;`));
  assert.ok(!/Secure/i.test(c));
  for (const parte of ["Path=/", "HttpOnly", "SameSite=Strict"]) assert.ok(c.includes(parte), parte);
  assert.match(cookieSaida({ local: true }), new RegExp(`^${COOKIE_LOCAL}=;.*Max-Age=0`));
  assert.equal(nomeCookie(true), COOKIE_LOCAL);
  assert.equal(nomeCookie(false), COOKIE);
});
