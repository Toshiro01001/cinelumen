// Roteador e casca do site. As rotas ficam no # do endereço, então o site funciona em qualquer subpasta.
import { ufPorSigla } from './dados.js';
import { agoraEm } from './programacao.js';
import { armazenamentoDisponivel, capitalAtual, carrinho, escolherCapital, restaurarTudo, verificarValidade } from './estado.js';
import { avisar, h, vazio } from './ui.js';
import { seletorCapitais, telaFilme, telaInicio } from './telas-cartaz.js';
import { ganchos, telaAssentos, telaBomboniere, telaIngresso, telaMeusIngressos, telaPagamento, telaResumo, telaTipos } from './telas-compra.js';
import { telaComoFunciona, telaGerente } from './telas-gerente.js';

const main = document.getElementById('conteudo');
const btnCapital = document.getElementById('btn-capital');
const btnCarrinho = document.getElementById('btn-carrinho');
const btnMenu = document.getElementById('btn-menu');
const nav = document.getElementById('nav-principal');
const dlgCapital = document.getElementById('dlg-capital');
const dlgRestaurar = document.getElementById('dlg-restaurar');
let primeira = true;

const ctx = {
  escolherCapital(uf) {
    escolherCapital(uf);
    if (dlgCapital.open) dlgCapital.close();
    const u = ufPorSigla(uf);
    avisar(`Agora em ${u.capital}. Unidade fictícia, pipoca imaginária.`);
    atualizarTopo();
    desenhar(true);
  },
  atualizarTopo,
  atualizarContadores,
  abrirCapitais,
  redesenhar: () => desenhar(false),
  ir(destino) {
    if (location.hash === destino) desenhar(true); else location.hash = destino;
  },
};

function atualizarTopo() {
  const u = ufPorSigla(capitalAtual());
  btnCapital.replaceChildren();
  if (u) {
    const a = agoraEm(u.fuso);
    btnCapital.append(h('span', { classe: 'capital-nome' }, `${u.capital}, ${u.uf}`), h('small', { 'data-relogio': true }, `${a.hora} (${a.utc})`));
    btnCapital.setAttribute('aria-label', `Capital escolhida: ${u.capital}, ${u.estado}. Horário local ${a.hora}. Trocar capital`);
  } else {
    btnCapital.append(h('span', { classe: 'capital-nome' }, 'Escolher capital'));
    btnCapital.setAttribute('aria-label', 'Escolher capital');
  }
  const car = carrinho();
  const n = car.assentos.length + Object.values(car.itens).reduce((t, q) => t + q, 0);
  btnCarrinho.replaceChildren(h('span', null, 'Carrinho'), h('b', { classe: 'carrinho-num', 'data-carrinho': n }, n));
  btnCarrinho.setAttribute('aria-label', `Carrinho, ${n} ${n === 1 ? 'item' : 'itens'}`);
}

function abrirCapitais() {
  document.getElementById('dlg-capital-corpo').replaceChildren(seletorCapitais(ctx.escolherCapital));
  dlgCapital.showModal();
  dlgCapital.querySelector('input').focus();
}

function telaDaRota(partes) {
  const [rota, a, b] = partes;
  switch (rota) {
    case undefined: case '': return telaInicio(ctx);
    case 'filme': return telaFilme(ctx, a, b);
    case 'assentos': return telaAssentos(ctx, a);
    case 'tipos': return telaTipos();
    case 'bomboniere': return telaBomboniere(ctx);
    case 'resumo': return telaResumo(ctx);
    case 'pagamento': return telaPagamento(ctx);
    case 'ingresso': return telaIngresso(ctx, a);
    case 'meus-ingressos': return telaMeusIngressos();
    case 'gerente': return telaGerente(ctx);
    case 'como-funciona': return telaComoFunciona();
    default:
      document.title = 'Página não encontrada: CineLumen';
      return vazio('Essa sala não existe', 'O endereço não leva a nenhuma tela. Volte para o cartaz.', 'Ver filmes em cartaz', '#/');
  }
}

function desenhar(focar) {
  const partes = location.hash.replace(/^#\/?/, '').split('/').map((p) => { try { return decodeURIComponent(p); } catch { return '?'; } });
  ganchos.aoMudarArmazenamento = null;
  if (verificarValidade()) avisar('O tempo da reserva acabou e os assentos voltaram para a sala. A pipoca continua no carrinho.');
  main.replaceChildren(telaDaRota(partes));
  document.body.classList.toggle('luzes-baixas', partes[0] === 'assentos');
  for (const l of nav.querySelectorAll('a')) {
    const r = l.dataset.rota;
    const ativo = r === (partes[0] || 'inicio');
    if (ativo) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
  }
  nav.classList.remove('aberta');
  btnMenu.setAttribute('aria-expanded', 'false');
  atualizarTopo();
  atualizarContadores();
  if (focar) {
    window.scrollTo(0, 0);
    if (!primeira) main.querySelector('h1')?.focus({ preventScroll: true });
  }
  primeira = false;
}

function atualizarContadores() {
  const { expira, assentos } = carrinho();
  const els = main.querySelectorAll('[data-contador]');
  if (!els.length) return;
  const resta = Math.max(0, Math.ceil((expira - Date.now()) / 1000));
  const txt = assentos.length ? `Assentos seguros por ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}` : '';
  els.forEach((e) => { e.textContent = txt; });
}

setInterval(() => {
  atualizarContadores();
  if (verificarValidade()) { avisar('O tempo da reserva acabou e os assentos voltaram para a sala. A pipoca continua no carrinho.'); desenhar(false); }
  const r = btnCapital.querySelector('[data-relogio]');
  const u = ufPorSigla(capitalAtual());
  if (r && u) { const a = agoraEm(u.fuso); const t = `${a.hora} (${a.utc})`; if (r.textContent !== t) r.textContent = t; }
}, 1000);

window.addEventListener('hashchange', () => desenhar(true));
window.addEventListener('storage', () => {
  atualizarTopo();
  if (ganchos.aoMudarArmazenamento) ganchos.aoMudarArmazenamento();
});

btnCapital.addEventListener('click', abrirCapitais);
document.getElementById('dlg-capital-fechar').addEventListener('click', () => dlgCapital.close());
btnMenu.addEventListener('click', () => {
  const aberta = nav.classList.toggle('aberta');
  btnMenu.setAttribute('aria-expanded', String(aberta));
});
document.getElementById('pular').addEventListener('click', (e) => { e.preventDefault(); main.focus(); });
document.getElementById('btn-restaurar').addEventListener('click', () => dlgRestaurar.showModal());
document.getElementById('restaurar-nao').addEventListener('click', () => dlgRestaurar.close());
document.getElementById('restaurar-sim').addEventListener('click', () => {
  restaurarTudo();
  dlgRestaurar.close();
  avisar('Demonstração restaurada. Tudo como no primeiro dia de cartaz.');
  ctx.ir('#/');
});

document.getElementById('aviso-armazenamento').hidden = armazenamentoDisponivel();
desenhar(true);
