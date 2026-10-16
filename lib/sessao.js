// Sessão do painel: o cookie guarda "<expira em ms>.<assinatura>", com HMAC-SHA256 usando a própria
// senha (secret PAINEL_SENHA) como chave. Trocar a senha derruba todas as sessões.
// Comparações via crypto.subtle.verify: tempo constante e o mesmo código roda no Cloudflare e no Node (testes).

export const COOKIE = "__Host-painel";
export const DURACAO_MS = 14 * 24 * 60 * 60 * 1000;

const texto = new TextEncoder();
const TOKEN = /^(\d{13})\.([A-Za-z0-9_-]{43})$/; // 13 dígitos de ms + 32 bytes em base64url

const chave = senha => crypto.subtle.importKey(
  "raw", texto.encode(`painel-da-festa:${senha}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const paraBase64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deBase64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

/**
 * @param {string} senha
 * @param {number} [agora]
 * @returns {Promise<string>}
 */
export async function criarToken(senha, agora = Date.now()) {
  if (!senha) throw new Error("PAINEL_SENHA não configurada");
  const expira = String(agora + DURACAO_MS);
  const assinatura = await crypto.subtle.sign("HMAC", await chave(senha), texto.encode(expira));
  return `${expira}.${paraBase64url(assinatura)}`;
}

/**
 * @param {unknown} token valor do cookie
 * @param {string | undefined} senha
 * @param {number} [agora]
 * @returns {Promise<boolean>}
 */
export async function tokenValido(token, senha, agora = Date.now()) {
  if (!senha || typeof token !== "string") return false;
  const partes = TOKEN.exec(token);
  if (!partes || Number(partes[1]) <= agora) return false;
  return crypto.subtle.verify("HMAC", await chave(senha), deBase64url(partes[2]), texto.encode(partes[1]));
}

/**
 * Compara a senha digitada com a certa sem vazar tempo: assina a certa e verifica a digitada contra essa assinatura.
 * @param {unknown} digitada
 * @param {string | undefined} senha
 * @returns {Promise<boolean>}
 */
export async function senhaCorreta(digitada, senha) {
  if (!senha || typeof digitada !== "string") return false;
  const k = await chave(senha);
  const esperada = await crypto.subtle.sign("HMAC", k, texto.encode(senha));
  return crypto.subtle.verify("HMAC", k, esperada, texto.encode(digitada));
}

/**
 * @param {string | null} cabecalho valor do header Cookie
 * @param {string} nome
 * @returns {string | null}
 */
export function lerCookie(cabecalho, nome) {
  for (const parte of (cabecalho ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}

// No `npm run dev` (http no próprio computador) o Safari descarta cookie Secure, e __Host- exige Secure:
// lá a sessão vai num cookie simples, que o porteiro só aceita em http local.
export const COOKIE_LOCAL = "painel";

/** @param {boolean} local true no npm run dev (http local) */
export const nomeCookie = local => (local ? COOKIE_LOCAL : COOKIE);

// __Host-: só vale com Secure, Path=/ e sem Domain (o navegador descarta o cookie se faltar algo)
const atributos = local => `Path=/; HttpOnly;${local ? "" : " Secure;"} SameSite=Strict`;

/**
 * @param {string} token
 * @param {{ local?: boolean }} [opcoes]
 */
export const cookieSessao = (token, { local = false } = {}) =>
  `${nomeCookie(local)}=${token}; ${atributos(local)}; Max-Age=${DURACAO_MS / 1000}`;

/** @param {{ local?: boolean }} [opcoes] */
export const cookieSaida = ({ local = false } = {}) => `${nomeCookie(local)}=; ${atributos(local)}; Max-Age=0`;
