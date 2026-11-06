// Fluxo de compra: assentos, tipo de ingresso, bomboniere, resumo, pagamento simulado e ingresso.
import { BOMBONIERE, itemPorId, ufPorSigla, unidadeDe } from './dados.js';
import { agoraEm, dataLonga, detalhes, hash, jaPassou, mapaDaSala, ocupadosBase, sessaoPorId } from './programacao.js';
import { MAX_ASSENTOS, MINUTOS_RESERVA, alternarAssento, carrinho, conferirAssentos, emitirIngresso, ingressoPorCodigo, largarAssentos, meusIngressos, mudarItem, reservadosPorOutros, sessaoDoCarrinho, sessoesExtras, simularOutroCliente, trocarTipo, vendidosDe } from './estado.js';
import { anunciar, avisar, cartaz, etapas, h, moeda, pausa, plural, s, vazio } from './ui.js';

let recado = null; // aviso que atravessa uma mudança de tela, como o conflito de assento
export const ganchos = { aoMudarArmazenamento: null };

export function precoDe(sessao, tipoIngresso) {
  const base = detalhes(sessao).tipo.preco;
  return tipoIngresso === 'meia' ? Math.round(base / 2) : base;
}
export function totais(car = carrinho(), sessao = sessaoDoCarrinho()) {
  const ingressos = sessao ? car.assentos.map((a) => ({ ...a, preco: precoDe(sessao, a.tipo) })) : [];
  const itens = Object.entries(car.itens).map(([id, qtd]) => ({ id, qtd, nome: itemPorId(id).nome, preco: itemPorId(id).preco }));
  const total = ingressos.reduce((n, a) => n + a.preco, 0) + itens.reduce((n, i) => n + i.preco * i.qtd, 0);
  return { ingressos, itens, total };
}
const ligacoesFluxo = (sessao) => (sessao ? {
  1: `#/filme/${sessao.filmeId}/${sessao.data}`, 2: `#/assentos/${sessao.id}`, 3: '#/tipos',
} : {});

function faixaSessao(sessao) {
  const { filme, sala, tipo, unidade } = detalhes(sessao);
  return h('p', { classe: 'faixa-sessao' }, `${filme.titulo}, ${sala.nome} ${tipo.nome}, ${dataLonga(sessao.data)} às ${sessao.hora}, ${unidade.capital}, ${unidade.uf}`);
}
function caixaRecado() {
  if (!recado) return null;
  const el = h('p', { classe: 'recado-alerta', role: 'alert' }, recado);
  recado = null;
  return el;
}
const contador = () => h('p', { classe: 'contador', 'data-contador': true });

function rotuloAssento(a, estado) {
  const base = `Fila ${a.fila}, assento ${a.numero}${a.acessivel ? ', espaço para cadeirante e acompanhante' : ''}`;
  return `${base}, ${{ livre: 'livre', escolhido: 'selecionado', vendido: 'ocupado', reservado: 'reservado por outro cliente' }[estado]}`;
}

export function telaAssentos(ctx, sessaoId) {
  const sessao = sessaoPorId(sessaoId, sessoesExtras());
  if (!sessao) return vazio('Essa sessão não existe mais', 'Ela pode ter sido removida pelo gerente. Escolha outra na programação.', 'Ver filmes em cartaz', '#/');
  const { filme, sala } = detalhes(sessao);
  document.title = `Assentos de ${filme.titulo}: CineLumen`;
  if (jaPassou(sessao)) return vazio('Essa sessão já começou', 'A venda fecha quando as luzes apagam. Veja os próximos horários.', 'Ver sessões do filme', `#/filme/${filme.id}`);
  const mapa = mapaDaSala(sala);
  const fixos = ocupadosBase(sessao);
  const botoes = new Map();
  const assentos = mapa.filas.flatMap((f) => f.assentos);
  let foco = null;

  const estado = (id, car, vendidos, outros) => {
    if (car.sessaoId === sessao.id && car.assentos.some((a) => a.id === id)) return 'escolhido';
    if (fixos.includes(id) || vendidos.includes(id)) return 'vendido';
    return outros.includes(id) ? 'reservado' : 'livre';
  };
  const lado = h('aside', { classe: 'lado', 'aria-label': 'Seus assentos' });
  const recadoLocal = h('p', { classe: 'recado', 'aria-hidden': 'true' }, 'Toque em uma poltrona livre. No teclado, setas e Enter.');
  const dizer = (t) => { recadoLocal.textContent = t; anunciar(t); };

  function pintar() {
    const car = carrinho();
    const vendidos = vendidosDe(sessao.id);
    const outros = reservadosPorOutros(sessao.id);
    for (const a of assentos) {
      const b = botoes.get(a.id);
      const e = estado(a.id, car, vendidos, outros);
      b.className = `assento ${e}${a.acessivel ? ' acessivel' : ''}`;
      b.setAttribute('aria-label', rotuloAssento(a, e));
      b.setAttribute('aria-pressed', e === 'escolhido' ? 'true' : 'false');
      if (e === 'vendido' || e === 'reservado') b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    }
    const meus = car.sessaoId === sessao.id ? car.assentos : [];
    const total = meus.reduce((n, a) => n + precoDe(sessao, a.tipo), 0);
    lado.replaceChildren(...[
      h('h2', null, meus.length ? plural(meus.length, 'assento escolhido', 'assentos escolhidos') : 'Nenhum assento ainda'),
      meus.length ? h('ul', { classe: 'lista-assentos' }, meus.map((a) => h('li', null, a.id))) : h('p', { classe: 'lado-nota' }, `Até ${MAX_ASSENTOS} por compra. Seguramos cada poltrona por ${MINUTOS_RESERVA} minutos.`),
      meus.length ? contador() : null,
      recadoLocal,
      h('p', { classe: 'lado-total' }, h('span', null, 'Total em inteiras'), h('b', null, moeda(total))),
      meus.length
        ? h('a', { classe: 'botao', href: '#/tipos', id: 'continuar' }, 'Continuar para os ingressos')
        : h('span', { classe: 'botao botao-off', id: 'continuar', 'aria-disabled': 'true' }, 'Escolha um assento'),
    ].filter(Boolean));
    ctx.atualizarTopo();
    ctx.atualizarContadores();
  }

  function apertar(a) {
    const r = alternarAssento(sessao, a.id, fixos);
    if (r.ok) dizer(r.acao === 'pegou' ? `${a.id} é seu por ${MINUTOS_RESERVA} minutos. Boa escolha.` : `${a.id} voltou para a sala.`);
    else if (r.motivo === 'vendido') dizer(`${a.id} já tem dono. Escolha outro assento.`);
    else if (r.motivo === 'reservado') dizer(`Outro cliente está segurando ${a.id} agora. Escolha outro assento.`);
    else dizer(`O limite é de ${MAX_ASSENTOS} assentos por compra. Solte um para trocar.`);
    pintar();
  }
  function setas(ev, a) {
    const f = mapa.filas.findIndex((x) => x.letra === a.fila);
    const c = a.numero - 1;
    const alvo = { ArrowLeft: [f, c - 1], ArrowRight: [f, c + 1], ArrowUp: [f - 1, c], ArrowDown: [f + 1, c] }[ev.key];
    if (!alvo) return;
    ev.preventDefault();
    const prox = mapa.filas[alvo[0]]?.assentos[alvo[1]];
    if (!prox) return;
    botoes.get(a.id).tabIndex = -1;
    const b = botoes.get(prox.id);
    b.tabIndex = 0; b.focus(); foco = prox.id;
  }
  for (const a of assentos) {
    const b = h('button', { type: 'button', 'data-assento': a.id, tabindex: -1, onclick: () => apertar(a), onkeydown: (e) => setas(e, a) },
      h('span', { classe: 'assento-rotulo', 'aria-hidden': 'true' }, a.numero));
    botoes.set(a.id, b);
  }
  ganchos.aoMudarArmazenamento = pintar;

  const grade = h('div', { classe: 'sala-mapa' },
    h('div', { classe: 'tela-cinema', 'aria-hidden': 'true' }, 'Tela'),
    h('div', { classe: 'fileiras', role: 'group', 'aria-label': `Mapa de assentos da ${sala.nome}` },
      mapa.filas.map((fila) => h('div', { classe: 'fileira', role: 'group', 'aria-label': `Fila ${fila.letra}` },
        h('span', { classe: 'fila-letra', 'aria-hidden': 'true' }, fila.letra),
        fila.assentos.flatMap((a) => (a.numero === mapa.corredorApos
          ? [botoes.get(a.id), h('span', { classe: 'corredor', 'aria-hidden': 'true' })] : [botoes.get(a.id)]))))),
    h('ul', { classe: 'legenda' },
      [['livre', 'Livre'], ['escolhido', 'Seu'], ['vendido', 'Ocupado'], ['reservado', 'Em reserva por outro cliente'], ['livre acessivel', 'Espaço para cadeirante e acompanhante']]
        .map(([c, t]) => h('li', null, h('span', { classe: `assento amostra ${c}`, 'aria-hidden': 'true' }), t))));

  const inicial = () => {
    const car = carrinho();
    foco = (car.sessaoId === sessao.id && car.assentos[0]?.id) || assentos.find((a) => !fixos.includes(a.id))?.id || assentos[0].id;
    botoes.get(foco).tabIndex = 0;
  };
  inicial();
  const tela = h('div', { classe: 'pagina pagina-sala' },
    etapas(2, ligacoesFluxo(sessao)),
    h('h1', { tabindex: -1 }, 'Escolha seus assentos'),
    faixaSessao(sessao),
    caixaRecado(),
    h('div', { classe: 'compra-duas' }, h('div', null, grade), lado));
  pintar();
  return tela;
}

export function telaTipos() {
  const car = carrinho();
  const sessao = sessaoDoCarrinho();
  if (!sessao || !car.assentos.length) return vazio('Você ainda não escolheu assentos', 'Escolha filme e sessão para seguir com a compra.', 'Ver filmes em cartaz', '#/');
  document.title = 'Tipo de ingresso: CineLumen';
  const totalEl = h('b', null, moeda(totais(car, sessao).total));
  const inteira = precoDe(sessao, 'inteira');
  const meia = precoDe(sessao, 'meia');
  return h('div', { classe: 'pagina' },
    etapas(3, ligacoesFluxo(sessao)),
    h('h1', { tabindex: -1 }, 'Inteira ou meia?'),
    faixaSessao(sessao),
    h('div', { classe: 'compra-duas' },
      h('div', { classe: 'tipos' }, car.assentos.map((a) => h('fieldset', { classe: 'tipo-linha' },
        h('legend', null, `Assento ${a.id}`),
        [['inteira', `Inteira, ${moeda(inteira)}`], ['meia', `Meia, ${moeda(meia)}`]].map(([v, t]) => h('label', { classe: 'opcao' },
          h('input', { type: 'radio', name: `tipo-${a.id}`, value: v, checked: a.tipo === v ? true : null,
            onchange: () => { trocarTipo(a.id, v); totalEl.textContent = moeda(totais().total); anunciar(`${a.id}: ${v}. Total ${totalEl.textContent}.`); } }),
          h('span', null, t))))),
      h('p', { classe: 'secao-nota' }, 'Num cinema de verdade a meia pede comprovante na entrada. Aqui só muda a conta.')),
      h('aside', { classe: 'lado', 'aria-label': 'Total parcial' },
        h('h2', null, plural(car.assentos.length, 'ingresso', 'ingressos')),
        contador(),
        h('p', { classe: 'lado-total' }, h('span', null, 'Total'), totalEl),
        h('a', { classe: 'botao', href: '#/bomboniere', id: 'continuar' }, 'Continuar para a bomboniere'))));
}

export function telaBomboniere(ctx) {
  document.title = 'Bomboniere: CineLumen';
  const car = carrinho();
  const sessao = sessaoDoCarrinho();
  const noFluxo = sessao && car.assentos.length > 0;
  const totalEl = h('b', null, moeda(totais(car, sessao).total));
  const qtds = new Map();
  const mudar = (it, delta) => {
    const q = mudarItem(it.id, delta);
    qtds.get(it.id).textContent = q;
    totalEl.textContent = moeda(totais().total);
    anunciar(`${it.nome}: ${q} no carrinho. Total ${totalEl.textContent}.`);
    ctx.atualizarTopo();
  };
  return h('div', { classe: 'pagina' },
    noFluxo && etapas(4, ligacoesFluxo(sessao)),
    h('h1', { tabindex: -1 }, 'Bomboniere'),
    h('p', { classe: 'secao-nota' }, noFluxo ? 'Opcional, mas a gente vai julgar um pouquinho. Tudo entra no mesmo carrinho do ingresso.' : 'Seus itens ficam no carrinho e seguem junto com o ingresso quando você escolher a sessão.'),
    BOMBONIERE.map((g) => h('section', { 'aria-labelledby': `g-${g.grupo}` },
      h('h2', { id: `g-${g.grupo}` }, g.grupo),
      h('ul', { classe: 'grade-bomb' }, g.itens.map((it) => {
        const q = h('output', { classe: 'qtd', 'aria-live': 'off', 'data-qtd': it.id }, car.itens[it.id] || 0);
        qtds.set(it.id, q);
        return h('li', { classe: 'bomb-item' },
          h('img', { src: `assets/bomboniere/${it.id}.svg`, alt: '', width: 120, height: 120, loading: 'lazy' }),
          h('div', { classe: 'bomb-texto' },
            h('h3', null, it.nome), h('p', null, it.desc), h('p', { classe: 'bomb-preco' }, moeda(it.preco)),
            h('div', { classe: 'contador-qtd' },
              h('button', { type: 'button', 'aria-label': `Tirar ${it.nome}`, onclick: () => mudar(it, -1) }, '−'),
              q,
              h('button', { type: 'button', 'aria-label': `Adicionar ${it.nome}`, 'data-add': it.id, onclick: () => mudar(it, 1) }, '+'))));
      })))),
    h('div', { classe: 'barra-fim' },
      h('p', { classe: 'lado-total' }, h('span', null, 'Total do carrinho'), totalEl),
      noFluxo ? h('a', { classe: 'botao', href: '#/resumo', id: 'continuar' }, 'Continuar para o resumo')
        : h('a', { classe: 'botao', href: '#/resumo', id: 'continuar' }, 'Ver o carrinho')));
}

export function telaResumo(ctx) {
  document.title = 'Resumo da compra: CineLumen';
  const car = carrinho();
  const sessao = sessaoDoCarrinho();
  const { ingressos, itens, total } = totais(car, sessao);
  if (!ingressos.length && !itens.length) return vazio('Seu carrinho está vazio', 'Nem uma pipoquinha. Comece pelo filme, que o resto vem junto.', 'Ver filmes em cartaz', '#/');
  if (!ingressos.length) {
    return h('div', { classe: 'pagina' },
      h('h1', { tabindex: -1 }, 'Seu carrinho'),
      h('p', { classe: 'recado-alerta' }, 'A bomboniere sai junto com o ingresso. Escolha uma sessão para fechar a compra: seus itens continuam aqui.'),
      caixaRecado(),
      listaItens(itens),
      h('p', { classe: 'lado-total' }, h('span', null, 'Total'), h('b', null, moeda(total))),
      h('div', { classe: 'dlg-acoes' }, h('a', { classe: 'botao', href: '#/' }, 'Escolher a sessão'), h('a', { classe: 'botao botao-linha', href: '#/bomboniere' }, 'Mudar os itens')));
  }
  const { filme, sala, tipo, unidade } = detalhes(sessao);
  const primeiro = ingressos[0].id;
  return h('div', { classe: 'pagina' },
    etapas(5, ligacoesFluxo(sessao)),
    h('h1', { tabindex: -1 }, 'Confira antes de pagar'),
    caixaRecado(),
    h('div', { classe: 'compra-duas' },
      h('div', { classe: 'resumo' },
        h('section', { classe: 'resumo-filme' }, cartaz(filme, 'cartaz-mini'), h('div', null,
          h('h2', null, filme.titulo),
          h('p', null, `${dataLonga(sessao.data)} às ${sessao.hora}, horário local`),
          h('p', null, `${sala.nome} ${tipo.nome}, ${unidadeDe(unidade).nome}`),
          h('a', { href: `#/assentos/${sessao.id}` }, 'Trocar assentos'))),
        h('section', null, h('h2', null, 'Ingressos'),
          h('ul', { classe: 'linhas' }, ingressos.map((a) => h('li', null, h('span', null, `${a.id}, ${a.tipo}`), h('b', null, moeda(a.preco))))),
          h('a', { href: '#/tipos' }, 'Trocar inteira ou meia')),
        h('section', null, h('h2', null, 'Bomboniere'),
          itens.length ? listaItens(itens) : h('p', null, 'Nenhum item. O filme vai ser longo, viu?'),
          h('a', { href: '#/bomboniere' }, itens.length ? 'Mudar os itens' : 'Adicionar itens')),
        h('details', { classe: 'teste-conflito' },
          h('summary', null, 'Testar conflito de assento'),
          h('p', null, `Simula outra pessoa comprando o ${primeiro} enquanto você decide. Ao pagar, o sistema percebe e devolve você ao mapa.`),
          h('button', { type: 'button', classe: 'botao botao-linha', id: 'simular-conflito',
            onclick: () => { simularOutroCliente(primeiro); avisar(`Outro cliente comprou o ${primeiro}. Agora tente pagar.`); } }, `Outra pessoa compra o ${primeiro}`)),
        h('button', { type: 'button', classe: 'botao-texto', onclick: () => { largarAssentos(); ctx.ir('#/'); } }, 'Soltar os assentos e recomeçar')),
      h('aside', { classe: 'lado', 'aria-label': 'Total da compra' },
        h('h2', null, 'Total'),
        contador(),
        h('p', { classe: 'lado-total' }, h('span', null, plural(ingressos.length, 'ingresso', 'ingressos')), h('b', { id: 'total-resumo' }, moeda(total))),
        h('a', { classe: 'botao', href: '#/pagamento', id: 'continuar' }, 'Ir para o pagamento simulado'))));
}
function listaItens(itens) {
  return h('ul', { classe: 'linhas' }, itens.map((i) => h('li', null, h('span', null, `${i.qtd} x ${i.nome}`), h('b', null, moeda(i.preco * i.qtd)))));
}

const METODOS = [
  ['pix', 'Pix de mentirinha', 'Nenhum QR Code é gerado e nenhum banco é chamado.'],
  ['cartao', 'Cartão de mentirinha', 'Não pedimos número de cartão: esta tela nunca guarda esse dado.'],
  ['bilheteria', 'Na bilheteria imaginária', 'Fila zero, atendente zero, troco zero.'],
];
function gerarCodigo(uf) {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const v = crypto.getRandomValues(new Uint8Array(8));
  const t = [...v].map((n) => letras[n % letras.length]).join('');
  return `CL-${uf}-${t.slice(0, 4)}-${t.slice(4)}`;
}

export function telaPagamento(ctx) {
  const car = carrinho();
  const sessao = sessaoDoCarrinho();
  if (!sessao || !car.assentos.length) return vazio('Falta escolher os assentos', 'O pagamento vem depois do mapa da sala.', 'Ver filmes em cartaz', '#/');
  document.title = 'Pagamento simulado: CineLumen';
  const { total } = totais(car, sessao);
  let metodo = 'pix';
  const passos = h('ol', { classe: 'pag-passos', hidden: true });
  const form = h('form', { classe: 'pag-form', onsubmit: (e) => { e.preventDefault(); pagar(); } },
    h('fieldset', null, h('legend', null, 'Como você quer fingir que paga?'),
      METODOS.map(([v, t, d]) => h('label', { classe: 'opcao opcao-larga' },
        h('input', { type: 'radio', name: 'metodo', value: v, checked: v === metodo ? true : null, onchange: () => { metodo = v; } }),
        h('span', null, h('strong', null, t), h('small', null, d))))),
    h('p', { classe: 'lado-total' }, h('span', null, 'Total simulado'), h('b', null, moeda(total))),
    h('button', { type: 'submit', classe: 'botao', id: 'confirmar-pagamento' }, 'Confirmar pagamento simulado'));

  const etapa = async (texto, ms) => {
    const li = h('li', { classe: 'em-andamento' }, texto);
    passos.append(li); anunciar(texto);
    await pausa(ms);
    li.className = 'feito';
  };
  async function pagar() {
    form.querySelector('button').disabled = true;
    form.hidden = true; passos.hidden = false;
    await etapa('Conferindo se os assentos continuam seus', 650);
    const perdidos = conferirAssentos(ocupadosBase(sessao));
    if (perdidos.length) {
      const restam = carrinho().assentos.length;
      recado = `Outro cliente garantiu ${perdidos.join(', ')} antes de você terminar. ${restam ? 'Os outros assentos continuam seus.' : ''} Escolha ${perdidos.length > 1 ? 'outros lugares' : 'outro lugar'} para seguir. Nada foi cobrado.`.replace('  ', ' ');
      ctx.ir(`#/assentos/${sessao.id}`);
      return;
    }
    if (jaPassou(sessao)) {
      recado = 'A sessão começou enquanto você decidia. Nada foi cobrado.';
      largarAssentos();
      ctx.ir('#/resumo');
      return;
    }
    await etapa('Autorizando o pagamento simulado', 700);
    await etapa('Imprimindo o ingresso, sem gastar papel', 650);
    const atual = carrinho();
    const t = totais(atual, sessao);
    const { filme, sala, tipo, unidade } = detalhes(sessao);
    const codigo = gerarCodigo(unidade.uf);
    emitirIngresso({
      codigo, sessaoId: sessao.id, filmeId: filme.id, filme: filme.titulo, sala: `${sala.nome} ${tipo.nome}`,
      uf: unidade.uf, capital: unidade.capital, unidade: unidadeDe(unidade).nome, data: sessao.data, hora: sessao.hora,
      assentos: t.ingressos, itens: t.itens, total: t.total, metodo, emitidoEm: agoraEm(unidade.fuso).data,
    });
    ctx.ir(`#/ingresso/${codigo}`);
  }
  return h('div', { classe: 'pagina' },
    etapas(6, ligacoesFluxo(sessao)),
    h('h1', { tabindex: -1 }, 'Pagamento simulado'),
    faixaSessao(sessao),
    h('p', { classe: 'secao-nota' }, 'Nenhum dado é pedido e nenhum valor é cobrado. Esta etapa só mostra como a compra andaria.'),
    contador(),
    form, passos);
}

function codigoBarras(codigo) {
  const barras = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    const v = hash(`${codigo}|${i}`);
    const larg = 1 + (v % 3);
    if (i % 2 === 0) barras.push(s('rect', { x, y: 0, width: larg, height: 40 }));
    x += larg;
  }
  return s('svg', { viewBox: `0 0 ${x} 40`, classe: 'barras', 'aria-hidden': 'true', preserveAspectRatio: 'none' }, barras);
}

export function cartaoIngresso(i) {
  const f = { id: i.filmeId, titulo: i.filme };
  return h('article', { classe: 'ingresso', 'data-codigo': i.codigo },
    h('div', { classe: 'ingresso-corpo' },
      cartaz(f, 'cartaz-mini'),
      h('div', null,
        h('h2', null, i.filme),
        h('dl', null,
          h('div', null, h('dt', null, 'Quando'), h('dd', null, `${dataLonga(i.data)}, ${i.hora}`)),
          h('div', null, h('dt', null, 'Onde'), h('dd', null, `${i.unidade}, ${i.uf}`)),
          h('div', null, h('dt', null, 'Sala'), h('dd', null, i.sala)),
          h('div', null, h('dt', null, 'Assentos'), h('dd', null, i.assentos.map((a) => `${a.id} (${a.tipo})`).join(', '))),
          i.itens.length > 0 && h('div', null, h('dt', null, 'Bomboniere'), h('dd', null, i.itens.map((x) => `${x.qtd} x ${x.nome}`).join(', '))),
          h('div', null, h('dt', null, 'Total simulado'), h('dd', null, moeda(i.total)))))),
    h('div', { classe: 'ingresso-canhoto' },
      codigoBarras(i.codigo),
      h('p', { classe: 'ingresso-codigo' }, i.codigo),
      h('p', { classe: 'secao-nota' }, 'Código fictício: não vale entrada, porque o cinema também não existe.')));
}

export function telaIngresso(_ctx, codigo) {
  const i = ingressoPorCodigo(codigo);
  if (!i) return vazio('Ingresso não encontrado', 'Ele pode ter sido apagado ao restaurar a demonstração.', 'Ver meus ingressos', '#/meus-ingressos');
  document.title = `Ingresso ${i.codigo}: CineLumen`;
  return h('div', { classe: 'pagina pagina-ingresso' },
    h('h1', { tabindex: -1 }, 'Pronto, sua sessão está garantida. Na imaginação.'),
    cartaoIngresso(i),
    h('div', { classe: 'dlg-acoes' },
      h('a', { classe: 'botao', href: '#/meus-ingressos' }, 'Ver meus ingressos'),
      h('a', { classe: 'botao botao-linha', href: '#/' }, 'Comprar outro')));
}

export function telaMeusIngressos() {
  document.title = 'Meus ingressos: CineLumen';
  const lista = meusIngressos();
  if (!lista.length) return vazio('Meus ingressos', 'Nenhum ingresso por aqui. Sua próxima sessão ainda nem sabe que você vem.', 'Ver filmes em cartaz', '#/');
  const fim = (i) => {
    const u = ufPorSigla(i.uf); const a = agoraEm(u.fuso);
    return `${i.data} ${i.hora}` < `${a.data} ${a.hora}`;
  };
  return h('div', { classe: 'pagina pagina-ingresso' },
    h('h1', { tabindex: -1 }, 'Meus ingressos'),
    h('p', { classe: 'secao-nota' }, `${plural(lista.length, 'compra guardada', 'compras guardadas')} só neste navegador, sem nenhum dado pessoal.`),
    h('ul', { classe: 'lista-ingressos' }, lista.map((i) => h('li', null,
      h('p', { classe: 'ingresso-estado' }, fim(i) ? 'Sessão já realizada' : 'Sessão futura'),
      cartaoIngresso(i)))));
}
