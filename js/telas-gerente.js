// Painel do gerente e explicação do sistema.
import { FILMES, filmePorId, ufPorSigla, unidadeDe } from './dados.js';
import { agoraEm, conflitoDeSala, dataCurta, detalhes, jaPassou, mapaDaSala, ocupadosBase, programaDoDia, proximosDias, salasDe, vendasSimuladas } from './programacao.js';
import { adicionarSessao, capitalAtual, meusIngressos, removerSessao, sessoesExtras, vendidosDe } from './estado.js';
import { avisar, h, moeda, vazio } from './ui.js';

let dataPainel = null;

// As tabelas viram blocos no celular; estes papéis mantêm a leitura como tabela no leitor de tela.
function tabela(classe, ...filhos) {
  const t = h('table', { classe }, ...filhos);
  t.setAttribute('role', 'table');
  t.querySelectorAll('thead, tbody').forEach((e) => e.setAttribute('role', 'rowgroup'));
  t.querySelectorAll('tr').forEach((e) => e.setAttribute('role', 'row'));
  t.querySelectorAll('th').forEach((e) => e.setAttribute('role', 'columnheader'));
  t.querySelectorAll('td').forEach((e) => e.setAttribute('role', 'cell'));
  return t;
}

function barra(pct) {
  return h('span', { classe: 'barra', 'aria-hidden': 'true' }, h('span', { estilo: { width: `${pct}%` } }));
}

export function telaGerente(ctx) {
  document.title = 'Painel do gerente: CineLumen';
  const uf = capitalAtual();
  const u = ufPorSigla(uf);
  if (!u) {
    return h('div', { classe: 'pagina' }, h('h1', { tabindex: -1 }, 'Painel do gerente'),
      h('p', null, 'O painel mostra uma unidade por vez. Escolha a capital primeiro.'),
      h('button', { type: 'button', classe: 'botao', onclick: ctx.abrirCapitais }, 'Escolher capital'));
  }
  const agora = agoraEm(u.fuso);
  const dias = proximosDias(agora.data);
  if (!dias.includes(dataPainel)) dataPainel = agora.data;
  const extras = sessoesExtras();
  const sessoes = programaDoDia(uf, dataPainel, extras);

  const linhas = sessoes.map((x) => {
    const { filme, sala, tipo } = detalhes(x);
    const total = mapaDaSala(sala).total;
    const vendidos = vendidosDe(x.id);
    const ocup = new Set([...ocupadosBase(x), ...vendidos]).size;
    const pct = Math.round((ocup / total) * 100);
    return h('tr', { 'data-sessao': x.id },
      h('td', { 'data-rotulo': 'Hora' }, x.hora, jaPassou(x) && h('small', null, ' encerrada')),
      h('td', { 'data-rotulo': 'Filme' }, filme.titulo, x.extra && h('small', { classe: 'selo' }, ' cadastrada')),
      h('td', { 'data-rotulo': 'Sala' }, `${sala.nome} ${tipo.nome}`),
      h('td', { 'data-rotulo': 'Ocupação', classe: 'celula-barra' }, barra(pct), h('span', { 'data-ocupacao': true }, `${ocup} de ${total} (${pct}%)`)),
      h('td', { 'data-rotulo': 'Ações' }, x.extra && !vendidos.length
        ? h('button', { type: 'button', classe: 'botao-texto', 'aria-label': `Excluir sessão de ${filme.titulo} às ${x.hora}`, onclick: () => { removerSessao(x.id); avisar('Sessão excluída.'); ctx.redesenhar(); } }, 'Excluir')
        : h('span', { classe: 'sem-acao' }, x.extra ? 'Já tem venda' : 'Da grade')));
  });

  const vendas = vendasSimuladas();
  for (const v of vendas) {
    for (const i of meusIngressos()) {
      if (i.uf === v.u.uf && i.emitidoEm === v.data) { v.ingressos += i.assentos.length; v.centavos += i.total; }
    }
  }
  vendas.sort((a, b) => b.centavos - a.centavos);
  const maior = vendas[0].centavos || 1;
  const somaI = vendas.reduce((n, v) => n + v.ingressos, 0);
  const somaC = vendas.reduce((n, v) => n + v.centavos, 0);

  const erro = h('p', { classe: 'form-erro', id: 'sessao-erro', role: 'alert', hidden: true });
  const campo = (id, rotulo, ctl) => h('div', { classe: 'campo' }, h('label', { for: id }, rotulo), ctl);
  const selFilme = h('select', { id: 'nova-filme' }, FILMES.map((f) => h('option', { value: f.id }, f.titulo)));
  const selSala = h('select', { id: 'nova-sala' }, salasDe(uf).map((x) => h('option', { value: x.id }, x.nome)));
  const selData = h('select', { id: 'nova-data' }, dias.map((d) => h('option', { value: d, selected: d === dataPainel ? true : null }, dataCurta(d))));
  const inHora = h('input', { id: 'nova-hora', type: 'time', required: true, min: '08:00', max: '23:30', 'aria-describedby': 'sessao-erro' });
  const falhar = (t) => { erro.textContent = t; erro.hidden = false; };
  const cadastrar = (e) => {
    e.preventDefault();
    erro.hidden = true;
    const [filmeId, salaId, data, hora] = [selFilme.value, selSala.value, selData.value, inHora.value];
    if (!/^\d{2}:\d{2}$/.test(hora)) return falhar('Informe o horário da sessão.');
    if (hora < '08:00' || hora > '23:30') return falhar('O horário precisa ficar entre 08:00 e 23:30.');
    const nova = { id: `${uf}_${data}_${salaId}_${hora.replace(':', '')}m`, uf, data, salaId, hora, filmeId, extra: true };
    if (jaPassou(nova)) return falhar(`Esse horário já passou em ${u.capital}. Agora são ${agora.hora}.`);
    const choque = conflitoDeSala(uf, data, salaId, hora, filmeId, sessoesExtras());
    if (choque) return falhar(`A sala está ocupada: ${filmePorId(choque.filmeId).titulo} começa às ${choque.hora}. Escolha outro horário ou outra sala.`);
    adicionarSessao(nova);
    dataPainel = data;
    avisar(`Sessão cadastrada: ${filmePorId(filmeId).titulo} às ${hora}.`);
    ctx.redesenhar();
    return undefined;
  };

  return h('div', { classe: 'pagina' },
    h('h1', { tabindex: -1 }, `Painel do gerente: ${unidadeDe(u).nome}`),
    h('p', { classe: 'secao-nota' }, 'Na demonstração o painel fica aberto. A versão real pede login e permissão por unidade.'),
    h('section', { 'aria-labelledby': 'tit-ocup' },
      h('h2', { id: 'tit-ocup' }, 'Ocupação por sessão'),
      h('div', { classe: 'campo campo-linha' }, h('label', { for: 'painel-dia' }, 'Dia'),
        h('select', { id: 'painel-dia', onchange: (e) => { dataPainel = e.target.value; ctx.redesenhar(); } },
          dias.map((d) => h('option', { value: d, selected: d === dataPainel ? true : null }, dataCurta(d))))),
      tabela('tabela tabela-ocupacao',
        h('caption', { classe: 'so-leitor' }, `Ocupação das sessões em ${dataCurta(dataPainel)}`),
        h('thead', null, h('tr', null, ['Hora', 'Filme', 'Sala', 'Ocupação', 'Ações'].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', null, linhas))),
    h('section', { 'aria-labelledby': 'tit-nova' },
      h('h2', { id: 'tit-nova' }, 'Cadastrar sessão'),
      h('form', { classe: 'form-sessao', novalidate: true, onsubmit: cadastrar },
        campo('nova-filme', 'Filme', selFilme), campo('nova-sala', 'Sala', selSala),
        campo('nova-data', 'Dia', selData), campo('nova-hora', 'Horário', inHora),
        h('button', { type: 'submit', classe: 'botao', id: 'salvar-sessao' }, 'Cadastrar sessão'), erro),
      h('p', { classe: 'secao-nota' }, 'O sistema recusa horário passado e choque com outra sessão na mesma sala, contando 25 minutos de limpeza.')),
    h('section', { 'aria-labelledby': 'tit-vendas' },
      h('h2', { id: 'tit-vendas' }, 'Vendas simuladas por capital, hoje'),
      h('p', { classe: 'secao-nota' }, `Números calculados a partir da ocupação fictícia: ${somaI.toLocaleString('pt-BR')} ingressos e ${moeda(somaC)} nas 27 capitais, somando as compras de teste deste navegador. Não representam público nem receita real.`),
      tabela('tabela tabela-vendas',
        h('caption', { classe: 'so-leitor' }, 'Vendas simuladas por capital, da maior para a menor'),
        h('thead', null, h('tr', null, ['Capital', 'Ingressos', 'Receita simulada'].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', null, vendas.map((v) => h('tr', { classe: v.u.uf === uf ? 'atual' : null, 'data-capital': v.u.uf },
          h('td', { 'data-rotulo': 'Capital' }, `${v.u.capital}, ${v.u.uf}`),
          h('td', { 'data-rotulo': 'Ingressos' }, v.ingressos.toLocaleString('pt-BR')),
          h('td', { 'data-rotulo': 'Receita', classe: 'celula-barra' }, barra(Math.round((v.centavos / maior) * 100)), h('span', null, moeda(v.centavos)))))))));
}

export function telaComoFunciona() {
  document.title = 'Como isto funciona: CineLumen';
  const lista = (itens) => h('ul', { classe: 'lista-texto' }, itens.map((t) => h('li', null, t)));
  return h('div', { classe: 'pagina pagina-texto' },
    h('h1', { tabindex: -1 }, 'Como isto funciona'),
    h('p', null, 'O CineLumen é uma demonstração completa de site e sistema de cinema. Ele roda inteiro no seu navegador: não existe servidor, não existe cobrança e nenhum dado sai daqui.'),
    h('section', null, h('h2', null, 'O caminho de uma compra'),
      h('ol', { classe: 'lista-texto' }, [
        'Você escolhe o estado e a capital. A escolha fica salva neste navegador.',
        'A programação sai de uma conta com a capital e a data. Mesma capital e mesmo dia, sempre as mesmas sessões, sem precisar de banco de dados.',
        'O relógio segue o fuso da capital. Em Cuiabá a venda de uma sessão fecha uma hora depois de Brasília, em Rio Branco, duas.',
        'Ao tocar em uma poltrona, ela fica segura por 10 minutos. Antes de emitir o ingresso, o sistema confere de novo se continua sua.',
        'Inteira ou meia, bomboniere, resumo e pagamento simulado entram no mesmo carrinho, sem pedir nenhum dado pessoal.',
        'O ingresso sai com um código fictício e fica em "Meus ingressos".',
      ].map((t) => h('li', null, t)))),
    h('section', null, h('h2', null, 'Teste o conflito de assento'),
      h('p', null, 'Abra o site em duas abas: cada aba funciona como um cliente. Uma poltrona segura em uma aba aparece como reservada na outra na mesma hora. Se preferir, no resumo da compra há um botão que simula outra pessoa levando o seu lugar.')),
    h('section', null, h('h2', null, 'O que dá para adaptar'),
      lista(['Nome, logo, cores e textos da sua marca.',
        'Cidades e unidades: uma só cidade ou uma rede inteira.',
        'Salas, tamanho e desenho do mapa de assentos.',
        'Tabela de preços, dias promocionais e cardápio da bomboniere.',
        'O mesmo fluxo serve para teatro, show, palestra e evento com lugar marcado.'])),
    h('section', null, h('h2', null, 'O que a versão real precisa a mais'),
      lista(['Servidor e banco de dados, para que a reserva de assento valha entre clientes diferentes, em aparelhos diferentes. Aqui ela só vale dentro de um navegador.',
        'Pagamento real com uma empresa de pagamentos autorizada, para Pix e cartão, com estorno.',
        'Login do gerente, com permissão por unidade e registro de quem alterou o quê.',
        'Conta do cliente e tratamento de dados conforme a LGPD, com política de privacidade.',
        'Regras de meia-entrada da Lei 12.933/2013, com a checagem do comprovante e o limite de ingressos.',
        'Ingresso com código validado na porta, nota fiscal e as obrigações do setor, como os relatórios de bilheteria, a confirmar com o contador e o cliente.',
        'Filmes, cartazes e classificação indicativa licenciados com as distribuidoras.'])),
    h('section', null, h('h2', null, 'O que foi usado'),
      h('p', null, 'HTML, CSS e JavaScript puros, sem bibliotecas externas. As imagens são SVG desenhado para este projeto, e as fontes League Gothic e Figtree, de licença aberta, ficam no próprio site. A política de segurança bloqueia qualquer conexão a terceiros.')),
    h('p', null, h('a', { classe: 'botao', href: '#/' }, 'Voltar para o cartaz')));
}
export { vazio };
