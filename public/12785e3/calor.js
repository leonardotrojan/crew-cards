// Mapa de calor sem dependências, na linha do simpleheat: cada toque vira um borrão radial de pouca
// opacidade; onde os toques se acumulam a opacidade soma, e no fim cada nível vira uma cor da rampa.
// Escala sequencial de um tom só (o verde-fantasma do tema), de transparente a quase branco, relativa
// ao lugar mais tocado: mais claro = mais toques.

export const RAMPA = [
  [0, "rgba(140, 255, 90, 0)"],
  [0.25, "rgba(140, 255, 90, 0.45)"],
  [0.6, "rgba(178, 255, 132, 0.85)"],
  [1, "rgba(246, 255, 236, 1)"],
];
const ALFA_POR_TOQUE = 0.12;

let cores = null; // RAMPA amostrada em 256 tons (RGBA)
function amostrarRampa() {
  if (cores) return cores;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext("2d");
  const gradiente = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [posicao, cor] of RAMPA) gradiente.addColorStop(posicao, cor);
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, 256, 1);
  cores = ctx.getImageData(0, 0, 256, 1).data;
  return cores;
}

function borrao(raio) {
  const c = document.createElement("canvas");
  c.width = c.height = raio * 2;
  const ctx = c.getContext("2d");
  const gradiente = ctx.createRadialGradient(raio, raio, 0, raio, raio, raio);
  gradiente.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradiente.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, raio * 2, raio * 2);
  return c;
}

/**
 * Desenha o calor no canvas (que já deve estar dimensionado em pixels reais).
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, y: number }[]} pontos em pixels do canvas
 * @param {number} raio em pixels do canvas
 */
export function desenharCalor(canvas, pontos, raio) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!pontos.length || !canvas.width || !canvas.height) return;

  const marca = borrao(Math.max(2, Math.round(raio)));
  const meio = marca.width / 2;
  ctx.globalAlpha = ALFA_POR_TOQUE;
  for (const { x, y } of pontos) ctx.drawImage(marca, x - meio, y - meio);
  ctx.globalAlpha = 1;

  const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imagem.data;
  let maximo = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > maximo) maximo = px[i];
  if (!maximo) return;

  const rampa = amostrarRampa();
  for (let i = 0; i < px.length; i += 4) {
    const alfa = px[i + 3];
    if (!alfa) continue;
    const j = Math.round((alfa / maximo) * 255) * 4;
    px[i] = rampa[j];
    px[i + 1] = rampa[j + 1];
    px[i + 2] = rampa[j + 2];
    px[i + 3] = rampa[j + 3];
  }
  ctx.putImageData(imagem, 0, 0);
}

/** A mesma rampa como gradiente CSS, pra legenda da escala. */
export const rampaCss = () => `linear-gradient(90deg, ${RAMPA.map(([p, cor]) => `${cor} ${p * 100}%`).join(", ")})`;
