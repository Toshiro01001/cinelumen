// Pequenos ajudantes de interface. Todo texto vira nó de texto: dado variável nunca é tratado como HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';
const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function montar(el, attrs, filhos) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'estilo') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else el.setAttribute(k === 'classe' ? 'class' : k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
export function h(tag, attrs, ...filhos) { return montar(document.createElement(tag), attrs, filhos); }
export function s(tag, attrs, ...filhos) { return montar(document.createElementNS(SVG_NS, tag), attrs, filhos); }

export const moeda = (centavos) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
export const duracao = (min) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const horaLetreiro = (hora) => hora.replace(':', 'H');
export const pausa = (ms) => new Promise((ok) => { setTimeout(ok, reduzido() ? Math.min(ms, 60) : ms); });

export function anunciar(texto) {
  const st = document.getElementById('status');
  st.textContent = '';
  requestAnimationFrame(() => { st.textContent = texto; });
}
let timerAviso = 0;
export function avisar(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto; el.hidden = false;
  anunciar(texto);
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { el.hidden = true; }, 3000);
}

// Letreiro de cinema: letra por letra em plaquinhas, com o texto real para o leitor de tela.
export function letreiro(linhas) {
  let i = 0;
  const texto = linhas.join('. ');
  return h('div', { classe: 'marquise' },
    h('p', { classe: 'so-leitor' }, texto),
    h('div', { classe: 'marquise-painel', 'aria-hidden': 'true' },
      linhas.map((linha) => h('div', { classe: 'marquise-linha' },
        linha.split(' ').map((palavra) => h('span', { classe: 'marquise-palavra' },
          [...palavra].map((letra) => { i++; return h('span', { classe: `placa p${i % 5}`, estilo: { '--i': i } }, letra); })))))));
}

export function cartaz(filme, classe = '') {
  return h('img', { classe: `cartaz ${classe}`, src: `assets/cartazes/${filme.id}.svg`, alt: `Cartaz de ${filme.titulo}`, width: 400, height: 600, loading: 'lazy' });
}

const ETAPAS = [['Filme e sessão'], ['Assentos'], ['Ingressos'], ['Bomboniere', '#/bomboniere'], ['Resumo', '#/resumo'], ['Pagamento']];
// ligacoes: rotas das etapas já concluídas, para poder voltar.
export function etapas(atual, ligacoes = {}) {
  return h('nav', { classe: 'etapas', 'aria-label': `Etapa ${atual} de ${ETAPAS.length}: ${ETAPAS[atual - 1][0]}` },
    h('ol', null, ETAPAS.map(([nome, rota], i) => {
      const n = i + 1;
      const destino = n < atual ? (ligacoes[n] || rota) : null;
      const miolo = [h('span', { classe: 'etapa-n' }, n), h('span', { classe: 'etapa-nome' }, nome)];
      return h('li', { classe: n === atual ? 'atual' : (n < atual ? 'feita' : '') , 'aria-current': n === atual ? 'step' : null },
        destino ? h('a', { href: destino }, miolo) : h('span', { classe: 'etapa-caixa' }, miolo));
    })));
}

export function vazio(titulo, texto, rotulo, destino) {
  return h('section', { classe: 'vazio' },
    h('h1', { tabindex: -1 }, titulo), h('p', null, texto),
    rotulo && h('a', { classe: 'botao', href: destino }, rotulo));
}
