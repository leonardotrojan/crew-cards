// Página de senha do painel, servida pelo functions/12785e3/_middleware.js.
// Sem JS: um formulário que posta pra /12785e3/entrar. Mesmas cores e fontes do tema Halloween do site.

/**
 * @param {{ erro?: boolean }} [opcoes]
 * @returns {string}
 */
export const paginaLogin = ({ erro = false } = {}) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0d0716">
<title>Painel · Qual seu número da sorte?</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<style>
:root {
  color-scheme: dark;
  --card: #17102a; --line: #2d2047; --fg: #f6ecd9; --muted: #a999c4; --accent: #ff7a1a; --erro: #ff5c8a;
  --display: "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --mono: "DM Mono", ui-monospace, Menlo, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100dvh; padding: 16px;
  display: grid; place-items: center;
  background:
    radial-gradient(55% 38% at 82% 10%, rgba(255,122,26,.16), transparent 70%),
    radial-gradient(60% 45% at 10% 100%, rgba(140,255,90,.07), transparent 70%),
    linear-gradient(180deg, #1c1033 0%, #130b24 45%, #0a0512 100%);
  color: var(--fg); font-family: var(--display);
}
form {
  width: min(380px, 100%);
  display: grid; gap: 14px;
  padding: 30px 24px 26px;
  background: var(--card); border: 1px solid var(--line); border-radius: 26px;
  box-shadow: 0 30px 80px -20px rgba(0,0,0,.8), 0 0 60px -30px rgba(255,122,26,.5);
}
.tag { font-family: var(--mono); font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0 0 6px; font-size: 2.1rem; font-weight: 800; line-height: .95; letter-spacing: -0.04em; }
label { font-size: .9rem; color: var(--muted); }
input {
  width: 100%; padding: 14px 16px;
  font: 500 1.05rem var(--display); color: var(--fg);
  background: #0f0a1c; border: 1px solid var(--line); border-radius: 14px;
}
input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-color: transparent; }
button {
  margin-top: 4px; padding: 14px 18px;
  font: 800 1.05rem var(--display); color: #1a0f26;
  background: linear-gradient(180deg, #ffb063, #ff7a1a 60%, #f0640a);
  border: 0; border-radius: 999px; cursor: pointer;
  box-shadow: 0 4px 0 #9a3d05, 0 12px 30px -10px rgba(255,122,26,.8);
  transition: transform .15s ease, box-shadow .15s ease;
}
button:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #9a3d05, 0 16px 36px -10px rgba(255,122,26,.9); }
button:active { transform: translateY(3px); box-shadow: 0 1px 0 #9a3d05; }
button:focus-visible { outline: 2px solid var(--fg); outline-offset: 3px; }
.erro { margin: 0; color: var(--erro); font-size: .95rem; }
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
</head>
<body>
<form method="post" action="/12785e3/entrar">
  <span class="tag">Só pra crew 🎃</span>
  <h1>Painel da festa</h1>
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required autofocus${erro ? ' aria-describedby="erro" aria-invalid="true"' : ""}>
  ${erro ? '<p class="erro" id="erro" role="alert">Senha errada. O dado não perdoa 🎲</p>' : ""}
  <button type="submit">Entrar</button>
</form>
</body>
</html>`;
