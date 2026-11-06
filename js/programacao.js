// Programação determinística: a mesma capital na mesma data sempre gera as mesmas sessões
// e os mesmos assentos ocupados, sem servidor e sem guardar nada.
import { FILMES, SALAS, TIPOS_SALA, UFS, filmePorId, salaPorId, ufPorSigla } from './dados.js';

export function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function sorteador(semente) {
  let a = hash(semente);
  return () => { // mulberry32
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Relógio de cada capital ----
const formatos = new Map();
function formato(fuso) {
  if (!formatos.has(fuso)) {
    formatos.set(fuso, new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset',
    }));
  }
  return formatos.get(fuso);
}
export function agoraEm(fuso, instante = new Date()) {
  const p = {};
  for (const parte of formato(fuso).formatToParts(instante)) p[parte.type] = parte.value;
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    utc: p.timeZoneName.replace('GMT', 'UTC'),
  };
}
export function somaDias(data, dias) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function proximosDias(data, quantos = 7) {
  return Array.from({ length: quantos }, (_, i) => somaDias(data, i));
}
export function dataCurta(data) {
  const d = new Date(`${data}T12:00:00Z`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).replace('.', '');
}
export function dataLonga(data) {
  const d = new Date(`${data}T12:00:00Z`);
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
const paraMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const paraHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ---- Salas e filmes do dia ----
export function salasDe(uf) { return SALAS.slice(0, 3 + (hash(`salas|${uf}`) % 3)); }

function filmesDoDia(uf, data) {
  const r = sorteador(`cartaz|${uf}|${data}`);
  const lista = FILMES.map((f) => ({ f, ordem: r() })).sort((a, b) => a.ordem - b.ordem).map((x) => x.f);
  return lista.slice(0, 6);
}

// Lista de sessões de uma capital num dia, somando as cadastradas pelo gerente.
export function programaDoDia(uf, data, extras = []) {
  const cartaz = filmesDoDia(uf, data);
  const sessoes = [];
  let vez = 0; // os filmes se revezam, para todos do cartaz terem sessão
  for (const sala of salasDe(uf)) {
    const r = sorteador(`grade|${uf}|${data}|${sala.id}`);
    const opcoes = sala.tipo === 'familia' ? cartaz.filter((f) => f.familia) : cartaz;
    const filmes = opcoes.length ? opcoes : cartaz;
    let inicio = 13 * 60 + Math.floor(r() * 10) * 10;
    while (inicio <= 22 * 60 + 30) {
      const filme = filmes[vez++ % filmes.length];
      const hora = paraHora(inicio);
      sessoes.push({ id: `${uf}_${data}_${sala.id}_${hora.replace(':', '')}`, uf, data, salaId: sala.id, hora, filmeId: filme.id, extra: false });
      inicio = Math.ceil((inicio + filme.minutos + 25) / 5) * 5;
    }
  }
  for (const e of extras) if (e.uf === uf && e.data === data) sessoes.push(e);
  return sessoes.sort((a, b) => a.hora.localeCompare(b.hora) || a.salaId.localeCompare(b.salaId));
}

export function sessaoPorId(id, extras = []) {
  const [uf, data] = String(id).split('_');
  if (!ufPorSigla(uf) || !/^\d{4}-\d{2}-\d{2}$/.test(data || '') || Number.isNaN(Date.parse(data))) return null;
  return programaDoDia(uf, data, extras).find((s) => s.id === id) || null;
}

export function detalhes(sessao) {
  const sala = salaPorId(sessao.salaId);
  return { sala, tipo: TIPOS_SALA[sala.tipo], filme: filmePorId(sessao.filmeId), unidade: ufPorSigla(sessao.uf) };
}
export function jaPassou(sessao, instante = new Date()) {
  const agora = agoraEm(ufPorSigla(sessao.uf).fuso, instante);
  return `${sessao.data} ${sessao.hora}` < `${agora.data} ${agora.hora}`;
}

// Choque de horário: mesma sala, com o filme novo mais 25 min de limpeza.
export function conflitoDeSala(uf, data, salaId, hora, filmeId, extras = []) {
  const novoIni = paraMin(hora);
  const novoFim = novoIni + filmePorId(filmeId).minutos + 25;
  return programaDoDia(uf, data, extras).find((s) => {
    if (s.salaId !== salaId) return false;
    const ini = paraMin(s.hora);
    return novoIni < ini + filmePorId(s.filmeId).minutos + 25 && ini < novoFim;
  }) || null;
}

// ---- Mapa de assentos ----
const LETRAS = 'ABCDEFGHIJKLMN';
export function mapaDaSala(sala) {
  const t = TIPOS_SALA[sala.tipo];
  const filas = [];
  for (let f = 0; f < t.filas; f++) {
    const assentos = [];
    for (let c = 1; c <= t.colunas; c++) {
      const acessivel = f === t.filas - 1 && c <= 2;
      assentos.push({ id: `${LETRAS[f]}${c}`, fila: LETRAS[f], numero: c, acessivel });
    }
    filas.push({ letra: LETRAS[f], assentos });
  }
  return { filas, corredorApos: Math.floor(t.colunas / 2), total: t.filas * t.colunas };
}

// Ocupação "de fundo": quem já teria comprado. Sessões do gerente nascem vazias.
export function ocupadosBase(sessao) {
  if (sessao.extra) return [];
  const r = sorteador(`ocupacao|${sessao.id}`);
  const mapa = mapaDaSala(salaPorId(sessao.salaId));
  const taxa = 0.15 + r() * 0.65;
  const meioFila = (mapa.filas.length - 1) * 0.6;
  const meioCol = (mapa.filas[0].assentos.length + 1) / 2;
  const fora = [];
  mapa.filas.forEach((fila, i) => {
    for (const a of fila.assentos) {
      if (a.acessivel) continue;
      // O miolo da sala enche primeiro, como no cinema de verdade.
      const dist = Math.abs(i - meioFila) / mapa.filas.length + Math.abs(a.numero - meioCol) / (meioCol * 2.4);
      if (r() < taxa * (1.35 - dist)) fora.push(a.id);
    }
  });
  return fora;
}

// Vendas simuladas: o que a programação gerada teria vendido hoje em cada capital.
export function vendasSimuladas(instante = new Date()) {
  return UFS.map((u) => {
    const { data } = agoraEm(u.fuso, instante);
    let ingressos = 0; let centavos = 0;
    for (const s of programaDoDia(u.uf, data)) {
      const qtd = ocupadosBase(s).length;
      const preco = TIPOS_SALA[salaPorId(s.salaId).tipo].preco;
      ingressos += qtd;
      centavos += Math.round(qtd * preco * 0.8); // supõe 40% de meias entre os ingressos
    }
    return { u, data, ingressos, centavos };
  });
}
