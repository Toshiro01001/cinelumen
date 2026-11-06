// Início, escolha da capital e página do filme.
import { BOMBONIERE, FILMES, REGIOES, UFS, filmePorId, ufPorSigla, unidadeDe } from './dados.js';
import { agoraEm, dataCurta, dataLonga, detalhes, jaPassou, mapaDaSala, ocupadosBase, programaDoDia, proximosDias, salasDe, somaDias } from './programacao.js';
import { capitalAtual, sessoesExtras, vendidosDe } from './estado.js';
import { cartaz, duracao, etapas, h, horaLetreiro, letreiro, moeda, vazio } from './ui.js';

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function seletorCapitais(aoEscolher) {
  const nada = h('p', { classe: 'seletor-nada', hidden: true, role: 'status' }, 'Nenhum estado ou capital com esse nome. Confira a grafia ou apague a busca.');
  const botoes = [];
  const grupos = REGIOES.map((regiao) => {
    const itens = UFS.filter((u) => u.regiao === regiao).sort((a, b) => a.capital.localeCompare(b.capital, 'pt-BR'));
    const grupo = h('section', { classe: 'seletor-regiao' },
      h('h3', null, regiao),
      h('ul', null, itens.map((u) => {
        const b = h('button', { type: 'button', classe: 'seletor-capital', 'data-uf': u.uf, onclick: () => aoEscolher(u.uf) },
          h('strong', null, u.capital), h('span', null, `${u.estado}, ${u.uf}`));
        const li = h('li', null, b);
        botoes.push({ li, chave: semAcento(`${u.capital} ${u.estado} ${u.uf}`) });
        return li;
      })));
    return { grupo, itens: () => grupo.querySelectorAll('li:not([hidden])').length };
  });
  const busca = h('input', { type: 'search', id: 'busca-capital', autocomplete: 'off', placeholder: 'Ex.: Mato Grosso ou Cuiabá',
    oninput: () => {
      const q = semAcento(busca.value.trim());
      botoes.forEach(({ li, chave }) => { li.hidden = q !== '' && !chave.includes(q); });
      grupos.forEach((g) => { g.grupo.hidden = g.itens() === 0; });
      nada.hidden = grupos.some((g) => g.itens() > 0);
    } });
  return h('div', { classe: 'seletor' },
    h('label', { for: 'busca-capital' }, 'Busque por estado ou capital'), busca, nada,
    h('div', { classe: 'seletor-grupos' }, grupos.map((g) => g.grupo)));
}

export function livresDe(sessao) {
  const { sala } = detalhes(sessao);
  const total = mapaDaSala(sala).total;
  const ocup = new Set([...ocupadosBase(sessao), ...vendidosDe(sessao.id)]).size;
  return { total, ocupados: ocup, livres: total - ocup };
}

export function chipSessao(sessao, comSala = true) {
  const { sala, tipo } = detalhes(sessao);
  const { livres } = livresDe(sessao);
  const rotulo = `${sessao.hora}, ${sala.nome} ${tipo.nome}, ${livres} lugares livres`;
  if (jaPassou(sessao)) return h('span', { classe: 'chip chip-off', 'aria-label': `${sessao.hora}, sessão encerrada` }, h('b', null, sessao.hora), h('small', null, 'Encerrada'));
  if (!livres) return h('span', { classe: 'chip chip-off', 'aria-label': `${sessao.hora}, sessão lotada` }, h('b', null, sessao.hora), h('small', null, 'Lotada'));
  return h('a', { classe: 'chip', href: `#/assentos/${sessao.id}`, 'aria-label': rotulo, 'data-sessao': sessao.id },
    h('b', null, sessao.hora), h('small', null, comSala ? sala.nome : `${livres} livres`));
}

function programaHoje(uf) {
  const u = ufPorSigla(uf);
  const agora = agoraEm(u.fuso);
  let data = agora.data;
  let lista = programaDoDia(uf, data, sessoesExtras()).filter((x) => !jaPassou(x));
  const hoje = lista.length > 0;
  if (!hoje) { data = somaDias(data, 1); lista = programaDoDia(uf, data, sessoesExtras()); }
  return { data, lista, hoje, agora };
}

export function telaInicio(ctx) {
  const uf = capitalAtual();
  const u = ufPorSigla(uf);
  document.title = u ? `CineLumen ${u.capital}: em cartaz` : 'CineLumen: cinema fictício nas 27 capitais';
  if (!u) {
    return h('div', null,
      h('section', { classe: 'palco' },
        letreiro(['ESCOLHA SUA CAPITAL', 'A PIPOCA ESPERA']),
        h('div', { classe: 'palco-texto' },
          h('h1', { tabindex: -1 }, 'Uma sala de cinema em cada capital do Brasil. Todas de mentira, com muito capricho.'),
          h('p', null, 'Escolha onde quer assistir. A programação, o relógio e a sala mudam junto com a capital.')),
      ),
      h('section', { classe: 'faixa-secao', 'aria-labelledby': 'tit-escolha' },
        h('h2', { id: 'tit-escolha' }, 'Em qual capital vai ser a sessão?'),
        seletorCapitais(ctx.escolherCapital)),
      h('section', { classe: 'faixa-secao', 'aria-labelledby': 'tit-cartaz' },
        h('h2', { id: 'tit-cartaz' }, 'Em cartaz na rede'),
        h('p', { classe: 'secao-nota' }, 'Os horários aparecem depois que você escolhe a capital.'),
        h('ul', { classe: 'grade-filmes todos' }, FILMES.map((f) => h('li', null, cardFilme(f, []))))));
  }
  const { data, lista, hoje, agora } = programaHoje(uf);
  const unidade = unidadeDe(u);
  const proximos = [];
  for (const x of lista) if (!proximos.some((p) => p.filmeId === x.filmeId) && proximos.length < 2) proximos.push(x);
  const quando = hoje ? 'HOJE' : 'AMANHÃ';
  const emCartaz = FILMES.filter((f) => lista.some((x) => x.filmeId === f.id))
    .sort((a, b) => lista.findIndex((x) => x.filmeId === a.id) - lista.findIndex((x) => x.filmeId === b.id));
  return h('div', null,
    h('section', { classe: 'palco' },
      letreiro([`${quando} EM ${u.capital.toUpperCase()}`, ...proximos.map((p) => `${filmePorId(p.filmeId).titulo.toUpperCase()} ${horaLetreiro(p.hora)}`)]),
      h('div', { classe: 'palco-texto' },
        h('h1', { tabindex: -1 }, `Escolha o filme, a poltrona e a pipoca em ${u.capital}.`),
        h('p', null, `${unidade.nome} é uma unidade fictícia, com ${salasDe(uf).length} salas e endereço inventado: ${unidade.endereco.split(',').slice(0, 2).join(',')}. Os horários seguem o relógio local: agora são ${agora.hora} (${agora.utc}).`),
        h('div', { classe: 'palco-acoes' },
          h('a', { classe: 'botao', href: '#em-cartaz', onclick: (e) => { e.preventDefault(); document.getElementById('em-cartaz').focus(); document.getElementById('em-cartaz').scrollIntoView(); } }, `Ver sessões em ${u.capital}`),
          h('a', { classe: 'botao botao-linha', href: '#/bomboniere' }, 'Ver a bomboniere')))),
    h('section', { classe: 'faixa-secao', 'aria-labelledby': 'em-cartaz' },
      h('h2', { id: 'em-cartaz', tabindex: -1 }, hoje ? `Hoje em ${u.capital}` : `Amanhã em ${u.capital}`),
      h('p', { classe: 'secao-nota' }, hoje
        ? `${dataLonga(data)}. Toque em um horário para escolher o assento.`
        : `As sessões de hoje acabaram, então mostramos ${dataLonga(data)}.`),
      h('ul', { classe: 'grade-filmes' }, emCartaz.map((f) => h('li', null, cardFilme(f, lista.filter((x) => x.filmeId === f.id)))))),
    h('section', { classe: 'faixa-secao vitrine-bomboniere', 'aria-labelledby': 'tit-bomb' },
      h('div', null,
        h('h2', { id: 'tit-bomb' }, 'Filme sem pipoca é só uma reunião no escuro'),
        h('p', null, 'Pipocas, bebidas e combos entram no mesmo carrinho do ingresso.'),
        h('a', { classe: 'botao botao-linha', href: '#/bomboniere' }, 'Abrir a bomboniere')),
      h('ul', null, BOMBONIERE.map((g) => g.itens[g.itens.length - 1]).map((it) => h('li', null,
        h('img', { src: `assets/bomboniere/${it.id}.svg`, alt: '', width: 120, height: 120, loading: 'lazy' }),
        h('span', null, it.nome), h('small', null, moeda(it.preco)))))));
}

function cardFilme(f, sessoes) {
  return h('article', { classe: 'filme' },
    h('a', { href: `#/filme/${f.id}`, classe: 'filme-capa', 'aria-label': `${f.titulo}, ver detalhes e todas as sessões` }, cartaz(f)),
    h('h3', null, f.titulo),
    h('p', { classe: 'filme-meta' }, `${f.genero}, ${duracao(f.minutos)}, ${f.classe}`),
    sessoes.length > 0 && h('div', { classe: 'chips' }, sessoes.slice(0, 3).map((x) => chipSessao(x))),
    sessoes.length > 3 && h('a', { classe: 'mais-sessoes', href: `#/filme/${f.id}/${sessoes[0].data}` }, `Ver as ${sessoes.length} sessões`));
}

export function telaFilme(ctx, id, dataPedida) {
  const f = filmePorId(id);
  if (!f) return vazio('Esse filme não está na programação', 'O endereço pode estar errado. Veja o que está em cartaz.', 'Ver filmes em cartaz', '#/');
  document.title = `${f.titulo}: CineLumen`;
  const u = ufPorSigla(capitalAtual());
  const topo = h('header', { classe: 'filme-topo' },
    cartaz(f, 'cartaz-grande'),
    h('div', null,
      h('h1', { tabindex: -1 }, f.titulo),
      h('p', { classe: 'filme-meta' }, `${f.genero}, ${duracao(f.minutos)}, classificação ${f.classe}`),
      h('p', { classe: 'sinopse' }, f.sinopse),
      h('p', { classe: 'secao-nota' }, 'Filme inventado para esta demonstração, com classificação também fictícia.')));
  if (!u) {
    return h('div', { classe: 'pagina' }, topo,
      h('section', { 'aria-labelledby': 'tit-esc' }, h('h2', { id: 'tit-esc' }, 'Escolha a capital para ver os horários'), seletorCapitais(ctx.escolherCapital)));
  }
  const agora = agoraEm(u.fuso);
  const extras = sessoesExtras();
  const dias = proximosDias(agora.data);
  const comSessao = (d) => programaDoDia(u.uf, d, extras).filter((x) => x.filmeId === f.id);
  const abertas = (d) => comSessao(d).filter((x) => !jaPassou(x));
  const data = dias.includes(dataPedida) ? dataPedida : (dias.find((d) => abertas(d).length) || agora.data);
  const sessoes = comSessao(data);
  const proxima = dias.find((d) => d > data && abertas(d).length);
  const salas = [...new Set(sessoes.map((x) => x.salaId))];
  return h('div', { classe: 'pagina' },
    etapas(1),
    topo,
    h('section', { 'aria-labelledby': 'tit-sessoes' },
      h('h2', { id: 'tit-sessoes' }, `Sessões em ${u.capital}`),
      h('p', { classe: 'secao-nota' }, `Horário local de ${u.capital} (${agora.utc}).`),
      h('nav', { classe: 'dias', 'aria-label': 'Escolha o dia' }, dias.map((d) => h('a', { href: `#/filme/${f.id}/${d}`, 'aria-current': d === data ? 'date' : null, 'data-dia': d },
        d === agora.data ? 'Hoje' : dataCurta(d)))),
      sessoes.length === 0 && h('div', { classe: 'sem-sessao' },
        h('p', null, `${f.titulo} não passa em ${u.capital} em ${dataLonga(data)}.`),
        proxima ? h('a', { classe: 'botao', href: `#/filme/${f.id}/${proxima}` }, `Ver ${dataLonga(proxima)}`)
          : h('a', { classe: 'botao', href: '#/' }, 'Ver o que está em cartaz')),
      salas.map((salaId) => {
        const daSala = sessoes.filter((x) => x.salaId === salaId);
        const { sala, tipo } = detalhes(daSala[0]);
        return h('article', { classe: 'sala-linha' },
          h('div', null, h('h3', null, `${sala.nome}, ${tipo.nome}`), h('p', null, `${tipo.descricao} Inteira ${moeda(tipo.preco)}, meia ${moeda(tipo.preco / 2)}.`)),
          h('div', { classe: 'chips' }, daSala.map((x) => chipSessao(x, false))));
      })));
}
