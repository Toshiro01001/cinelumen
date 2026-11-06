// Estado local da demonstração.
// localStorage guarda o que todo mundo no navegador compartilha (capital, assentos vendidos, ingressos).
// sessionStorage guarda o carrinho, separado por aba: duas abas funcionam como dois clientes.
// Nada de nome, CPF ou cartão entra aqui.
import { filmePorId, itemPorId, salaPorId, ufPorSigla } from './dados.js';
import { sessaoPorId } from './programacao.js';

const CHAVE_LOCAL = 'cinelumen.v1';
const CHAVE_ABA = 'cinelumen.aba.v1';
export const MINUTOS_RESERVA = 10;
export const MAX_ASSENTOS = 8;

let armazenamentoOk = true;
const memoria = { local: null, aba: null };

function ler(area, chave) {
  try { return area().getItem(chave); } catch { armazenamentoOk = false; return null; }
}
function gravar(area, chave, valor) {
  try { area().setItem(chave, valor); return true; } catch { armazenamentoOk = false; return false; }
}
const local = () => window.localStorage;
const aba = () => window.sessionStorage;

export function armazenamentoDisponivel() { lerComum(); return armazenamentoOk; }

const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const lista = (v) => (Array.isArray(v) ? v : []);

function normalizarComum(bruto) {
  const b = objeto(bruto);
  return {
    uf: ufPorSigla(b.uf) ? b.uf : null,
    vendidos: objeto(b.vendidos),
    reservas: objeto(b.reservas),
    ingressos: lista(b.ingressos).filter((i) => i && typeof i.codigo === 'string' && Array.isArray(i.assentos) && Array.isArray(i.itens) && filmePorId(i.filmeId) && ufPorSigla(i.uf)),
    extras: lista(b.extras).filter((s) => s && typeof s.id === 'string' && ufPorSigla(s.uf) && salaPorId(s.salaId) && filmePorId(s.filmeId) && /^\d{2}:\d{2}$/.test(s.hora)),
  };
}
function lerComum() {
  const texto = ler(local, CHAVE_LOCAL);
  if (texto === null) return normalizarComum(memoria.local);
  try { return normalizarComum(JSON.parse(texto)); } catch { return normalizarComum(null); }
}
function salvarComum(c) {
  memoria.local = c;
  gravar(local, CHAVE_LOCAL, JSON.stringify(c));
}

function carrinhoVazio() { return { sessaoId: null, assentos: [], itens: {}, expira: 0, abaId: novaAbaId() }; }
function novaAbaId() { return `aba-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`; }
function lerCarrinho() {
  const texto = ler(aba, CHAVE_ABA);
  let b = memoria.aba;
  if (texto !== null) { try { b = JSON.parse(texto); } catch { b = null; } }
  const c = carrinhoVazio();
  const o = objeto(b);
  if (typeof o.abaId === 'string') c.abaId = o.abaId;
  c.sessaoId = typeof o.sessaoId === 'string' ? o.sessaoId : null;
  c.assentos = lista(o.assentos).filter((a) => a && typeof a.id === 'string').map((a) => ({ id: a.id, tipo: a.tipo === 'meia' ? 'meia' : 'inteira' }));
  c.expira = Number(o.expira) || 0;
  for (const [id, qtd] of Object.entries(objeto(o.itens))) {
    if (itemPorId(id) && Number.isInteger(qtd) && qtd > 0) c.itens[id] = Math.min(qtd, 20);
  }
  return c;
}
function salvarCarrinho(c) {
  memoria.aba = c;
  gravar(aba, CHAVE_ABA, JSON.stringify(c));
}

// ---- Capital ----
export function capitalAtual() { return lerComum().uf; }
export function escolherCapital(uf) {
  const c = lerComum();
  c.uf = ufPorSigla(uf) ? uf : null;
  salvarComum(c);
}

// ---- Sessões do gerente ----
export function sessoesExtras() { return lerComum().extras; }
export function adicionarSessao(s) { const c = lerComum(); c.extras.push(s); salvarComum(c); }
export function removerSessao(id) { const c = lerComum(); c.extras = c.extras.filter((s) => s.id !== id); salvarComum(c); }

// ---- Assentos ----
function limparVencidas(c, agora) {
  for (const [sessao, reservas] of Object.entries(c.reservas)) {
    for (const [assento, r] of Object.entries(objeto(reservas))) if (!r || r.exp <= agora) delete reservas[assento];
    if (!Object.keys(objeto(reservas)).length) delete c.reservas[sessao];
  }
}
export function vendidosDe(sessaoId) { return lista(lerComum().vendidos[sessaoId]); }

// Assentos que outra aba está segurando agora.
export function reservadosPorOutros(sessaoId) {
  const c = lerComum(); const eu = lerCarrinho().abaId; const agora = Date.now();
  limparVencidas(c, agora);
  return Object.entries(objeto(c.reservas[sessaoId])).filter(([, r]) => r.aba !== eu).map(([a]) => a);
}
function soltarReservas(c, carrinho) {
  const reservas = objeto(c.reservas[carrinho.sessaoId]);
  for (const a of Object.keys(reservas)) if (reservas[a].aba === carrinho.abaId) delete reservas[a];
}

export function carrinho() { return lerCarrinho(); }

// Se a reserva venceu, os assentos voltam para a sala e a pipoca fica no carrinho.
export function verificarValidade() {
  const car = lerCarrinho();
  const sumiu = car.sessaoId && !sessaoPorId(car.sessaoId, lerComum().extras); // o gerente excluiu a sessão
  if (car.assentos.length && ((car.expira && car.expira <= Date.now()) || sumiu)) {
    const c = lerComum(); soltarReservas(c, car); salvarComum(c);
    car.assentos = []; car.expira = 0; car.sessaoId = null;
    salvarCarrinho(car);
    return true;
  }
  return false;
}

// Tenta segurar um assento. Lê o estado de novo na hora, que é o que evita venda dupla entre abas.
export function alternarAssento(sessao, assentoId, ocupadosFixos) {
  const car = lerCarrinho();
  const c = lerComum();
  const agora = Date.now();
  limparVencidas(c, agora);
  if (car.sessaoId !== sessao.id && car.assentos.length) { soltarReservas(c, car); car.assentos = []; car.expira = 0; }
  car.sessaoId = sessao.id;
  const ja = car.assentos.findIndex((a) => a.id === assentoId);
  const reservas = objeto(c.reservas[sessao.id]);
  if (ja >= 0) {
    car.assentos.splice(ja, 1);
    delete reservas[assentoId];
    if (!car.assentos.length) car.expira = 0;
    c.reservas[sessao.id] = reservas;
    salvarComum(c); salvarCarrinho(car);
    return { ok: true, acao: 'soltou', car };
  }
  if (ocupadosFixos.includes(assentoId) || lista(c.vendidos[sessao.id]).includes(assentoId)) return { ok: false, motivo: 'vendido' };
  if (reservas[assentoId] && reservas[assentoId].aba !== car.abaId) return { ok: false, motivo: 'reservado' };
  if (car.assentos.length >= MAX_ASSENTOS) return { ok: false, motivo: 'limite' };
  if (!car.assentos.length) car.expira = agora + MINUTOS_RESERVA * 60000;
  car.assentos.push({ id: assentoId, tipo: 'inteira' });
  reservas[assentoId] = { aba: car.abaId, exp: car.expira };
  c.reservas[sessao.id] = reservas;
  salvarComum(c); salvarCarrinho(car);
  return { ok: true, acao: 'pegou', car };
}

export function trocarTipo(assentoId, tipo) {
  const car = lerCarrinho();
  const a = car.assentos.find((x) => x.id === assentoId);
  if (a) { a.tipo = tipo === 'meia' ? 'meia' : 'inteira'; salvarCarrinho(car); }
}
export function largarAssentos() {
  const car = lerCarrinho(); const c = lerComum();
  soltarReservas(c, car); salvarComum(c);
  car.assentos = []; car.sessaoId = null; car.expira = 0;
  salvarCarrinho(car);
}

// Demonstração: faz de conta que outra pessoa comprou um assento deste carrinho.
export function simularOutroCliente(assentoId) {
  const car = lerCarrinho(); const c = lerComum();
  c.vendidos[car.sessaoId] = [...lista(c.vendidos[car.sessaoId]), assentoId];
  const r = objeto(c.reservas[car.sessaoId]); delete r[assentoId];
  salvarComum(c);
}

// ---- Bomboniere ----
export function mudarItem(id, delta) {
  const car = lerCarrinho();
  const qtd = Math.max(0, Math.min(20, (car.itens[id] || 0) + delta));
  if (qtd) car.itens[id] = qtd; else delete car.itens[id];
  salvarCarrinho(car);
  return qtd;
}

// ---- Fechamento ----
// Confere tudo de novo. Se alguém levou um assento, tira só esse do carrinho e diz qual foi.
export function conferirAssentos(ocupadosFixos) {
  const car = lerCarrinho(); const c = lerComum();
  limparVencidas(c, Date.now());
  const reservas = objeto(c.reservas[car.sessaoId]);
  const perdidos = car.assentos.filter((a) => ocupadosFixos.includes(a.id)
    || lista(c.vendidos[car.sessaoId]).includes(a.id)
    || (reservas[a.id] && reservas[a.id].aba !== car.abaId)).map((a) => a.id);
  if (perdidos.length) {
    car.assentos = car.assentos.filter((a) => !perdidos.includes(a.id));
    if (!car.assentos.length) car.expira = 0;
    salvarCarrinho(car);
  }
  return perdidos;
}

export function emitirIngresso(ingresso) {
  const car = lerCarrinho(); const c = lerComum();
  c.vendidos[car.sessaoId] = [...lista(c.vendidos[car.sessaoId]), ...car.assentos.map((a) => a.id)];
  soltarReservas(c, car);
  c.ingressos.unshift(ingresso);
  salvarComum(c);
  salvarCarrinho({ ...carrinhoVazio(), abaId: car.abaId });
}
export function meusIngressos() { return lerComum().ingressos; }
export function ingressoPorCodigo(codigo) { return lerComum().ingressos.find((i) => i.codigo === codigo) || null; }

export function restaurarTudo() {
  memoria.local = null; memoria.aba = null;
  try { local().removeItem(CHAVE_LOCAL); } catch { /* armazenamento bloqueado: a memória já foi limpa */ }
  try { aba().removeItem(CHAVE_ABA); } catch { /* idem */ }
}

export function sessaoDoCarrinho() {
  const car = lerCarrinho();
  return car.sessaoId ? sessaoPorId(car.sessaoId, lerComum().extras) : null;
}
