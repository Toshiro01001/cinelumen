// Camada visual do CineLumen: céu, lua e letras de máquina de escrever.
// Não toca em dados nem em regras do site; se este arquivo falhar, o cinema continua funcionando.

const parado = matchMedia('(prefers-reduced-motion: reduce)');
const main = document.getElementById('conteudo');

/* ---------- Céu (Nebulosa) ---------- */
const ceu = document.createElement('div');
ceu.className = 'ceu';
ceu.setAttribute('aria-hidden', 'true');
document.body.append(ceu);
const depois = window.requestIdleCallback || ((f) => setTimeout(f, 300));
depois(() => { import('./ceu.js').then((m) => m.montarCeu(ceu)).catch(() => ceu.classList.add('no-gl')); });

/* ---------- Lua em retícula (Dither Sphere) ---------- */
// Mares da lua: manchas fixas que escurecem a face, em coordenadas do disco (-1 a 1).
const MARES = [[-0.45, -0.1, 0.38, 0.5], [-0.2, -0.45, 0.26, 0.55], [0.18, -0.35, 0.18, 0.5], [0.32, -0.1, 0.2, 0.5], [0.52, -0.3, 0.1, 0.5], [0.25, 0.16, 0.14, 0.4], [-0.3, 0.3, 0.2, 0.4]];
const LADO = 460; // lado do desenho; o CSS estica com suavização
const PASSO = 7;
const pontos = [];
{
  const R = LADO * 0.46;
  for (let y = -R; y <= R; y += PASSO) for (let x = -R; x <= R; x += PASSO) {
    const u = x / R; const v = y / R; const d = Math.hypot(u, v);
    if (d >= 1) continue;
    let claro = 1;
    for (const [mx, my, mr, mk] of MARES) { const q = Math.hypot(u - mx, v - my) / mr; if (q < 1) claro -= mk * (1 - q * q); }
    pontos.push([LADO / 2 + x, LADO / 2 + y, u, v, Math.sqrt(1 - d * d) * 0.8, Math.max(0.25, claro)]);
  }
}
let tempo = 3.7; // ângulo da luz; continua de onde parou quando a tela é redesenhada
let luaAtual = null; let luaVisivel = false; let quadro = 0; let ultimo = 0;
const olho = new IntersectionObserver((es) => { luaVisivel = es.some((e) => e.isIntersecting); agendar(); });

function pintarLua(ctx) {
  const lx = Math.cos(tempo); const ly = Math.sin(tempo);
  ctx.clearRect(0, 0, LADO, LADO);
  ctx.fillStyle = '#efe9d8';
  ctx.beginPath();
  for (const [px, py, u, v, nz, claro] of pontos) {
    // lado escuro: pontinho mínimo, para o disco inteiro continuar legível (luz cinérea)
    const raio = Math.max(0.75, Math.min(1, Math.max(0, u * lx + v * ly + nz)) * claro * PASSO * 0.5);
    ctx.moveTo(px + raio, py); ctx.arc(px, py, raio, 0, 6.2832);
  }
  ctx.fill();
}
function passo(agora) {
  quadro = 0;
  if (!luaAtual || !luaAtual.isConnected || !luaVisivel || document.hidden) return;
  if (agora - ultimo >= 33) { // 30 quadros por segundo bastam para a luz girar
    tempo += Math.min(0.1, (agora - ultimo) / 1000) * 0.22;
    ultimo = agora;
    pintarLua(luaAtual.getContext('2d'));
  }
  agendar();
}
function agendar() { if (!quadro && !parado.matches && luaAtual && luaVisivel && !document.hidden) quadro = requestAnimationFrame(passo); }
document.addEventListener('visibilitychange', agendar);

function porLua() {
  const palco = main.querySelector('.palco');
  if (!palco || palco.querySelector('.lua')) return;
  const caixa = document.createElement('div');
  caixa.className = 'lua';
  caixa.setAttribute('aria-hidden', 'true');
  const tela = document.createElement('canvas');
  tela.width = LADO; tela.height = LADO;
  const disco = document.createElement('div');
  disco.className = 'lua-disco';
  disco.append(tela); caixa.append(disco);
  palco.prepend(caixa);
  const ctx = tela.getContext('2d');
  if (!ctx) return;
  olho.disconnect(); luaAtual = tela; olho.observe(tela);
  pintarLua(ctx);
}

/* ---------- Título batido à máquina (Typewriter: mola 600/30, 45 ms por letra) ---------- */
let ultimoTitulo = '';
function datilografar() {
  const h1 = main.querySelector('.palco-texto h1');
  if (!h1) { ultimoTitulo = ''; return; }
  const texto = h1.textContent;
  if (texto === ultimoTitulo || h1.dataset.dat) return;
  ultimoTitulo = texto;
  if (parado.matches) return;
  h1.dataset.dat = '1';
  const letras = [];
  h1.replaceChildren(...texto.split(/(\s+)/).map((pedaco) => {
    if (!pedaco.trim()) return document.createTextNode(pedaco);
    const palavra = document.createElement('span'); palavra.className = 'dat';
    for (const ch of pedaco) { const s = document.createElement('span'); s.textContent = ch; s.style.opacity = '0'; palavra.append(s); letras.push(s); }
    return palavra;
  }));
  const espera = Math.min(45, 2400 / letras.length);
  const inicio = performance.now() + 250;
  const fim = () => { if (h1.isConnected && h1.dataset.dat) { h1.textContent = texto; delete h1.dataset.dat; } };
  (function bater(agora) {
    if (!h1.isConnected) return;
    let pronto = true;
    for (let i = 0; i < letras.length; i++) {
      const t = (agora - inicio - i * espera) / 1000;
      if (t <= 0) { pronto = false; continue; }
      // mola 600/30 resolvida: x = 1 - e^(-15t) (cos 19,36t + 0,775 sen 19,36t)
      const x = 1 - Math.exp(-15 * t) * (Math.cos(19.36 * t) + 0.775 * Math.sin(19.36 * t));
      if (t < 0.5) pronto = false;
      letras[i].style.opacity = String(Math.min(1, Math.max(0, x)));
    }
    if (pronto) fim(); else requestAnimationFrame(bater);
  })(performance.now());
}

function vestir() { try { porLua(); datilografar(); } catch (e) { /* a camada visual nunca derruba o site */ } }
new MutationObserver(vestir).observe(main, { childList: true });
vestir();
