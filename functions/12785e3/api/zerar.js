// POST /12785e3/api/zerar — apaga todos os eventos: o botão "Zerar métricas" do painel (o mesmo que o
// npm run zerar). O _middleware.js da pasta já checou a sessão e que o pedido veio do próprio painel; aqui
// o corpo ainda precisa trazer {"confirmar":"ZERAR"}, pra nenhum POST perdido apagar a festa.
// Apagou sem querer? O D1 volta no tempo (ver README).
import { lerCorpo } from "../../../lib/requisicao.js";

export const CONFIRMACAO = "ZERAR";
const MAX_CORPO = 256;

const erro = (mensagem, status) => Response.json({ erro: mensagem }, { status });

function confirmou(corpo) {
  try {
    return JSON.parse(corpo)?.confirmar === CONFIRMACAO;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  const corpo = await lerCorpo(request, MAX_CORPO);
  if (corpo === null) return erro("Pedido grande demais.", 413);
  if (!confirmou(corpo)) return erro(`Faltou confirmar com "${CONFIRMACAO}". Nada foi apagado.`, 400);
  try {
    const { meta } = await env.DB.prepare("DELETE FROM eventos").run();
    return Response.json({ apagados: meta?.changes ?? 0 });
  } catch (falha) {
    console.error("painel: falha ao zerar os eventos do D1", falha);
    return erro("Não deu pra zerar agora; tente de novo.", 503);
  }
}
