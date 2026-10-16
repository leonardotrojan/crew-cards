// POST /api/e — recebe os lotes do public/metricas.js e grava no D1 (binding DB).
// Um INSERT só por requisição, lendo o lote como JSON (json_each), pra não esbarrar no limite
// de consultas por invocação do plano grátis.
import { COLUNAS, MAX_BYTES, validarLote } from "../../lib/eventos.js";
import { lerCorpo, ehPagesDev } from "../../lib/requisicao.js";

const INSERIR = `INSERT INTO eventos (${COLUNAS.join(", ")})
  SELECT ${COLUNAS.map(c => `json_extract(value, '$.${c}')`).join(", ")} FROM json_each(?1)`;

const resposta = status => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }) {
  if (ehPagesDev(new URL(request.url))) return resposta(404);
  if (Number(request.headers.get("Content-Length")) > MAX_BYTES) return resposta(413);
  const texto = await lerCorpo(request, MAX_BYTES);
  if (texto === null) return resposta(413);

  let linhas;
  try {
    linhas = validarLote(JSON.parse(texto), Date.now());
  } catch {
    return resposta(400); // JSON quebrado ou com estrutura absurda
  }
  if (!linhas.length) return resposta(400);

  try {
    await env.DB.prepare(INSERIR).bind(JSON.stringify(linhas)).run();
  } catch (erro) {
    console.error("metricas: falha ao gravar no D1", erro);
    return resposta(503);
  }
  return resposta(204);
}
