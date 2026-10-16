// Ajudantes das Functions pra lidar com a requisição sem confiar em quem mandou.

/**
 * Lê o corpo como texto e para assim que passar do limite. Não depende do Content-Length,
 * que pode faltar (corpo em pedaços).
 * @param {Request} request
 * @param {number} limite em bytes
 * @returns {Promise<string | null>} null se passou do limite
 */
export async function lerCorpo(request, limite) {
  if (!request.body) return "";
  const leitor = request.body.getReader();
  const pedacos = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      return null;
    }
    pedacos.push(value);
  }
  const tudo = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    tudo.set(pedaco, posicao);
    posicao += pedaco.byteLength;
  }
  return new TextDecoder().decode(tudo);
}

// O projeto também responde em fantasia-dado.pages.dev (e nas prévias *.fantasia-dado.pages.dev), onde a
// regra de rate limit do domínio não vale: métricas e painel só funcionam no endereço da festa.
/** @param {URL} url */
export const ehPagesDev = url => url.hostname.endsWith(".pages.dev");

// o `npm run dev` roda em http no próprio computador
/** @param {URL} url */
export const ehLocal = url => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
