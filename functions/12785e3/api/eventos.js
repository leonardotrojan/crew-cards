// GET /12785e3/api/eventos?depois=<id> — eventos crus pro painel a partir de um cursor: cada atualização
// lê só as linhas novas do D1 e o painel agrega no navegador. O _middleware.js da pasta já checou a sessão.
import { COLUNAS } from "../../../lib/eventos.js";

const LIMITE = 5000;
const CAMPOS = ["id", ...COLUNAS];
const CONSULTA = `SELECT ${CAMPOS.join(", ")} FROM eventos WHERE id > ?1 ORDER BY id LIMIT ${LIMITE}`;

export async function onRequestGet({ request, env }) {
  const depois = Number(new URL(request.url).searchParams.get("depois"));
  const cursor = Number.isSafeInteger(depois) && depois > 0 ? depois : 0;
  try {
    const linhas = await env.DB.prepare(CONSULTA).bind(cursor).raw();
    return Response.json({ colunas: CAMPOS, linhas, mais: linhas.length === LIMITE });
  } catch (erro) {
    console.error("painel: falha ao ler os eventos do D1", erro);
    return Response.json({ erro: "Não deu pra ler o banco agora." }, { status: 503 });
  }
}
