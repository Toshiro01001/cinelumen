// Testes de ponta a ponta. Rodar com: NODE_PATH=$(npm root -g) node tests/e2e.js
// Capturas vão para a pasta em CAPTURAS (padrão: tests/capturas).
const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('playwright');
const { iniciar } = require('./servidor');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = process.env.CAPTURAS || path.join(__dirname, 'capturas');
const INSTANTE = '2026-11-06T16:00:00Z'; // 13h em Brasília: as sessões de hoje ainda estão abertas em todo fuso
const iphone = { ...devices['iPhone 13'] }; delete iphone.defaultBrowserType;
const PERFIS = [
  { nome: 'computador', dir: SAIDA, ctx: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 } },
  { nome: 'celular', dir: SAIDA, ctx: { ...iphone, deviceScaleFactor: 2 } },
  { nome: '320', dir: path.join(SAIDA, '320px'), ctx: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
];
// Tabela escrita à parte do código do site, com o deslocamento oficial de cada capital em relação a UTC.
const CAPITAIS = [
  ['AC', 'Acre', 'Rio Branco', -5], ['AL', 'Alagoas', 'Maceió', -3], ['AP', 'Amapá', 'Macapá', -3], ['AM', 'Amazonas', 'Manaus', -4],
  ['BA', 'Bahia', 'Salvador', -3], ['CE', 'Ceará', 'Fortaleza', -3], ['DF', 'Distrito Federal', 'Brasília', -3], ['ES', 'Espírito Santo', 'Vitória', -3],
  ['GO', 'Goiás', 'Goiânia', -3], ['MA', 'Maranhão', 'São Luís', -3], ['MT', 'Mato Grosso', 'Cuiabá', -4], ['MS', 'Mato Grosso do Sul', 'Campo Grande', -4],
  ['MG', 'Minas Gerais', 'Belo Horizonte', -3], ['PA', 'Pará', 'Belém', -3], ['PB', 'Paraíba', 'João Pessoa', -3], ['PR', 'Paraná', 'Curitiba', -3],
  ['PE', 'Pernambuco', 'Recife', -3], ['PI', 'Piauí', 'Teresina', -3], ['RJ', 'Rio de Janeiro', 'Rio de Janeiro', -3], ['RN', 'Rio Grande do Norte', 'Natal', -3],
  ['RS', 'Rio Grande do Sul', 'Porto Alegre', -3], ['RO', 'Rondônia', 'Porto Velho', -4], ['RR', 'Roraima', 'Boa Vista', -4], ['SC', 'Santa Catarina', 'Florianópolis', -3],
  ['SP', 'São Paulo', 'São Paulo', -3], ['SE', 'Sergipe', 'Aracaju', -3], ['TO', 'Tocantins', 'Palmas', -3],
];
let ok = 0; const falhas = [];
function checar(nome, cond, detalhe = '') {
  if (cond) ok++; else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ''}`);
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}${!cond && detalhe ? ` (${detalhe})` : ''}`);
}

// Vigia de console, erro de página e requisição externa em cada página aberta.
function vigiar(page, rotulo, base, problemas) {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemas.push(`${rotulo} console: ${m.text()}`); });
  page.on('pageerror', (e) => problemas.push(`${rotulo} erro: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) problemas.push(`${rotulo} externo: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problemas.push(`${rotulo} ${r.status()}: ${r.url()}`); });
}
async function novaPagina(ctx, rotulo, base, problemas) {
  const p = await ctx.newPage();
  vigiar(p, rotulo, base, problemas);
  await p.clock.install({ time: new Date(INSTANTE) });
  return p;
}
const ir = async (p, base, h) => { await p.goto(`${base}#${h}`); await p.waitForSelector('main h1, main h2'); };
const rota = async (p, h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(60); };
async function largura(p, rotulo, perfil) {
  const r = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: window.innerWidth }));
  checar(`${perfil}: sem rolagem lateral em ${rotulo}`, r.s <= r.w && r.b <= r.w, JSON.stringify(r));
}
// Contraste de texto contra o fundo sólido mais próximo e tamanho mínimo de alvo de toque.
const auditoria = () => {
  const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const cor = (t) => { const m = t.match(/[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m[3] === undefined ? 1 : m[3] }; };
  const fundo = (el) => { for (let e = el; e; e = e.parentElement) { const b = cor(getComputedStyle(e).backgroundColor); if (b.a > 0.9) return b.c; } return [6, 25, 40]; };
  const ruins = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode; if (!n.textContent.trim()) continue;
    const el = n.parentElement; const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !el.getClientRects().length || el.closest('.so-leitor') || el.closest('dialog:not([open])') || el.closest('noscript') || el.closest('[aria-hidden="true"]')) continue;
    if (cs.color === 'rgba(0, 0, 0, 0)') continue;
    const f = cor(cs.color).c; const b = fundo(el);
    const [a, d] = [lum(f), lum(b)].sort((x, y) => y - x); const r = (a + 0.05) / (d + 0.05);
    const px = parseFloat(cs.fontSize); const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    if (r < (grande ? 3 : 4.5)) ruins.push(`${n.textContent.trim().slice(0, 30)} ${r.toFixed(2)}`);
  }
  const pequenos = [...document.querySelectorAll('a[href],button,input,select,summary')].filter((e) => {
    if (e.closest('p, li.linha, .secao-nota, dd') && e.tagName === 'A') return false; // link dentro de texto corrido
    if (e.closest('dialog:not([open])') || !e.getClientRects().length || e.id === 'pular' || (e.tagName === 'INPUT' && e.closest('label'))) return false;
    const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24;
  }).map((e) => `${e.tagName} ${(e.textContent || e.id).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  return { ruins, pequenos };
};
async function auditar(p, rotulo, perfil) {
  const a = await p.evaluate(auditoria);
  checar(`${perfil}: contraste em ${rotulo}`, a.ruins.length === 0, a.ruins.slice(0, 5).join('; '));
  checar(`${perfil}: alvos de toque em ${rotulo}`, a.pequenos.length === 0, a.pequenos.slice(0, 5).join('; '));
}

async function foto(p, perfil, n, nome, inteira = false) {
  const pre = perfil.nome === 'computador' ? 'computador' : 'celular';
  fs.mkdirSync(perfil.dir, { recursive: true });
  await p.waitForTimeout(120);
  await p.evaluate(() => { document.getElementById('aviso').hidden = true; });
  await p.screenshot({ path: path.join(perfil.dir, `${pre}-${String(n).padStart(2, '0')}-${nome}.png`), fullPage: inteira, animations: 'disabled' });
}
async function passar(p, rotulo, perfil) {
  await largura(p, rotulo, perfil.nome); await auditar(p, rotulo, perfil.nome);
  const lixo = (await p.innerText('body')).match(/\b(null|undefined|NaN|\[object Object\])\b/);
  checar(`${perfil.nome}: sem texto quebrado em ${rotulo}`, !lixo, lixo && lixo[0]);
}

// Fluxo inteiro: capital, filme, sessão, assento, meia, pipoca, resumo, pagamento, ingresso, painel.
async function fluxo(browser, perfil, base, problemas) {
  const ctx = await browser.newContext(perfil.ctx);
  const p = await novaPagina(ctx, perfil.nome, base, problemas);
  const nm = perfil.nome;
  await ir(p, base, '/');
  await p.waitForTimeout(900);
  await foto(p, perfil, 1, 'primeira-visita');
  await passar(p, 'início sem capital', perfil);
  await p.fill('#busca-capital', 'mato grosso');
  checar(`${nm}: busca acha os dois Mato Grosso`, await p.locator('main .seletor-capital:visible').count() === 2);
  await p.click('main .seletor-capital[data-uf="MT"]');
  await p.waitForTimeout(900);
  await foto(p, perfil, 2, 'inicio-cuiaba');
  await foto(p, perfil, 3, 'inicio-inteiro', true);
  await passar(p, 'início em Cuiabá', perfil);
  checar(`${nm}: faixa de cinema fictício visível`, await p.locator('#faixa').isVisible() && (await p.textContent('#faixa')).includes('Cinema fictício: demonstração sem venda real de ingressos'));
  checar(`${nm}: letreiro cita a capital`, (await p.textContent('.marquise .so-leitor')).includes('CUIABÁ'));
  // Filme
  const capa = p.locator('.filme-capa').first();
  await capa.click(); await p.waitForTimeout(100);
  await foto(p, perfil, 4, 'filme');
  await passar(p, 'filme', perfil);
  // Sessão com folga de assentos
  const chip = p.locator('main a.chip').first();
  await chip.click(); await p.waitForSelector('.assento');
  await p.waitForTimeout(1000);
  await foto(p, perfil, 5, 'assentos-vazio');
  await passar(p, 'mapa de assentos', perfil);
  const livres = p.locator('.fileira .assento.livre:not(.acessivel)');
  checar(`${nm}: mapa tem assentos livres e ocupados`, await livres.count() > 2 && await p.locator('.fileira .assento.vendido').count() > 0);
  const a1 = await livres.nth(0).getAttribute('data-assento');
  await livres.nth(0).click();
  const a2 = await livres.nth(0).getAttribute('data-assento');
  await livres.nth(0).click();
  await p.locator('.fileira .assento.vendido').first().click({ force: true });
  checar(`${nm}: assento ocupado não entra no carrinho`, await p.locator('.fileira .assento.escolhido').count() === 2);
  checar(`${nm}: recado de assento ocupado`, (await p.textContent('.recado')).includes('já tem dono'));
  checar(`${nm}: contagem no carrinho`, await p.getAttribute('[data-carrinho]', 'data-carrinho') === '2');
  await foto(p, perfil, 6, 'assentos-escolhidos');
  await passar(p, 'assentos escolhidos', perfil);
  // Persistência no meio da compra
  await p.reload(); await p.waitForSelector('.assento');
  checar(`${nm}: assentos continuam após recarregar`, await p.locator('.fileira .assento.escolhido').count() === 2);
  await p.click('#continuar'); await p.waitForSelector('.tipo-linha');
  const antes = await p.textContent('.lado-total b');
  await p.locator('.tipo-linha').first().locator('input[value="meia"]').check();
  const depois = await p.textContent('.lado-total b');
  checar(`${nm}: meia reduz o total`, antes !== depois, `${antes} ${depois}`);
  await foto(p, perfil, 7, 'inteira-meia');
  await passar(p, 'inteira e meia', perfil);
  await p.click('#continuar'); await p.waitForSelector('.bomb-item');
  await p.click('[data-add="combo-dupla"]');
  await p.click('[data-add="agua"]');
  await p.click('[data-add="agua"]');
  checar(`${nm}: bomboniere soma no carrinho`, await p.getAttribute('[data-carrinho]', 'data-carrinho') === '5');
  await foto(p, perfil, 8, 'bomboniere');
  await foto(p, perfil, 9, 'bomboniere-inteira', true);
  await passar(p, 'bomboniere', perfil);
  await p.click('#continuar'); await p.waitForSelector('#total-resumo');
  await foto(p, perfil, 10, 'resumo', true);
  await passar(p, 'resumo', perfil);
  await p.click('#continuar'); await p.waitForSelector('#confirmar-pagamento');
  await foto(p, perfil, 11, 'pagamento');
  await passar(p, 'pagamento', perfil);
  const campos = await p.locator('main input:not([type="radio"])').count();
  checar(`${nm}: pagamento não pede nenhum dado digitado`, campos === 0);
  await p.click('input[value="cartao"]');
  await p.click('#confirmar-pagamento');
  await p.waitForSelector('.pag-passos li');
  await foto(p, perfil, 12, 'pagamento-etapas');
  await p.waitForSelector('.ingresso', { timeout: 8000 });
  await foto(p, perfil, 13, 'ingresso', true);
  await passar(p, 'ingresso', perfil);
  const codigo = await p.textContent('.ingresso-codigo');
  checar(`${nm}: compra completa gera código`, /^CL-MT-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codigo), codigo);
  checar(`${nm}: carrinho zera depois da compra`, await p.getAttribute('[data-carrinho]', 'data-carrinho') === '0');
  // Nenhum dado pessoal no armazenamento
  const guardado = await p.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
  checar(`${nm}: nada de CPF ou cartão guardado`, !/cpf|numeroCartao|cvv|titular/i.test(guardado));
  // Meus ingressos e persistência
  await p.reload(); await p.waitForSelector('.ingresso');
  await rota(p, '/meus-ingressos');
  await foto(p, perfil, 14, 'meus-ingressos', true);
  await passar(p, 'meus ingressos', perfil);
  checar(`${nm}: ingresso em Meus ingressos`, (await p.textContent('main')).includes(codigo));
  // O assento comprado fica ocupado na sessão
  const sessaoId = await p.evaluate(() => JSON.parse(localStorage.getItem('cinelumen.v1')).ingressos[0].sessaoId);
  await rota(p, `/assentos/${sessaoId}`); await p.waitForSelector('.assento');
  checar(`${nm}: assento comprado aparece ocupado`, (await p.getAttribute(`[data-assento="${a1}"]`, 'class')).includes('vendido') && (await p.getAttribute(`[data-assento="${a2}"]`, 'class')).includes('vendido'));
  // Painel
  await rota(p, '/gerente'); await p.waitForSelector('.tabela-ocupacao');
  await foto(p, perfil, 15, 'gerente');
  await foto(p, perfil, 16, 'gerente-inteiro', true);
  await passar(p, 'painel do gerente', perfil);
  checar(`${nm}: painel lista as 27 capitais`, await p.locator('.tabela-vendas tbody tr').count() === 27);
  const linhaComprada = p.locator(`tr[data-sessao="${sessaoId}"] [data-ocupacao]`);
  checar(`${nm}: ocupação da sessão aparece`, /\d+ de \d+ \(\d+%\)/.test(await linhaComprada.textContent()));
  await rota(p, '/como-funciona');
  await foto(p, perfil, 17, 'como-funciona', true);
  await passar(p, 'como funciona', perfil);
  const rod = p.locator('.rodape a[href="https://mileumalinhas.com.br"]');
  checar(`${nm}: rodapé com a Mil e Uma Linhas!`, (await rod.textContent()) === 'Mil e Uma Linhas!' && (await p.textContent('.rodape')).includes('Demonstração feita por Mil e Uma Linhas!'));
  // Diálogo da capital
  await p.click('#btn-capital');
  await p.waitForSelector('#dlg-capital[open]');
  await foto(p, perfil, 18, 'trocar-capital');
  await largura(p, 'diálogo de capital', nm);
  await p.keyboard.press('Escape');
  // Menu no celular
  if (nm !== 'computador') {
    await p.click('#btn-menu');
    checar(`${nm}: menu abre`, await p.locator('#nav-principal a').first().isVisible());
    await foto(p, perfil, 19, 'menu');
    await p.click('#btn-menu');
  }
  await p.goto(`${base}#/rota-que-nao-existe`); await p.waitForSelector('.vazio');
  await largura(p, 'rota inexistente', nm);
  await ctx.close();
}

async function capitais(browser, base, problemas) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const p = await novaPagina(ctx, 'capitais', base, problemas);
  await ir(p, base, '/');
  checar('27 capitais no seletor', await p.locator('main .seletor-capital').count() === 27);
  const assinaturas = new Set();
  for (const [uf, estado, capital, offset] of CAPITAIS) {
    const bt = p.locator(`.seletor-capital[data-uf="${uf}"]`).first();
    if (!(await bt.count())) await p.click('#btn-capital');
    const dlgAberto = await p.locator('#dlg-capital[open]').count();
    const alvo = p.locator(`${dlgAberto ? '#dlg-capital ' : 'main '}.seletor-capital[data-uf="${uf}"]`);
    const texto = await alvo.textContent();
    checar(`${uf}: estado e capital`, texto.includes(capital) && texto.includes(`${estado}, ${uf}`), texto);
    await alvo.click(); await p.waitForTimeout(40);
    const esperado = new Date(new Date(INSTANTE).getTime() + offset * 3600000);
    const hora = `${String(esperado.getUTCHours()).padStart(2, '0')}:`;
    const relogio = await p.textContent('[data-relogio]');
    checar(`${uf}: relógio ${capital} em UTC${offset}`, relogio.startsWith(hora) && relogio.includes(`UTC${offset}`), relogio);
    const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('cinelumen.v1')).uf);
    checar(`${uf}: escolha salva`, salvo === uf);
    checar(`${uf}: capital no título`, (await p.textContent('main h1')).includes(capital));
    const chips = await p.locator('main a.chip').evaluateAll((els) => els.map((e) => e.getAttribute('data-sessao')));
    checar(`${uf}: sessões do dia`, chips.length >= 3 && chips.every((c) => c.startsWith(`${uf}_2026-11-06`)), String(chips.length));
    const assin = chips.map((c) => c.split('_').slice(2).join('_')).join() + (await p.locator('.filme h3').allTextContents()).join();
    assinaturas.add(assin);
    await p.reload(); await p.waitForSelector('main a.chip');
    const de2 = await p.locator('main a.chip').evaluateAll((els) => els.map((e) => e.getAttribute('data-sessao')));
    checar(`${uf}: programação igual ao recarregar e capital mantida`, JSON.stringify(de2) === JSON.stringify(chips) && (await p.textContent('main h1')).includes(capital));
  }
  checar('capitais têm programações diferentes', assinaturas.size >= 26, String(assinaturas.size));
  // Mesma capital em outro dia muda a programação
  const hoje = await p.evaluate(() => import('./js/programacao.js').then((m) => JSON.stringify(m.programaDoDia('SP', '2026-11-06'))));
  const amanha = await p.evaluate(() => import('./js/programacao.js').then((m) => JSON.stringify(m.programaDoDia('SP', '2026-11-07'))));
  const hoje2 = await p.evaluate(() => import('./js/programacao.js').then((m) => JSON.stringify(m.programaDoDia('SP', '2026-11-06'))));
  checar('programação muda com a data e repete na mesma data', hoje !== amanha && hoje === hoje2);
  await ctx.close();
  // Virada de dia: à 0h30 de Brasília, Rio Branco ainda está no dia anterior
  const c2 = await browser.newContext(); const q = await c2.newPage(); vigiar(q, 'virada', base, problemas);
  await q.clock.install({ time: new Date('2026-11-07T03:30:00Z') });
  await ir(q, base, '/');
  const datas = await q.evaluate(() => import('./js/programacao.js').then((m) => [m.agoraEm('America/Sao_Paulo').data, m.agoraEm('America/Rio_Branco').data, m.agoraEm('America/Rio_Branco').hora]));
  checar('fuso muda a data: São Paulo no dia 7, Rio Branco no dia 6 às 22:30', datas[0] === '2026-11-07' && datas[1] === '2026-11-06' && datas[2] === '22:30', datas.join());
  await q.click('main .seletor-capital[data-uf="AC"]'); await q.waitForTimeout(50);
  checar('sessão que já passou aparece encerrada', await q.evaluate(() => import('./js/programacao.js').then((m) => m.programaDoDia('AC', '2026-11-06').some((s) => m.jaPassou(s)))));
  await c2.close();
}

async function conflito(browser, base, problemas) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 });
  const a = await novaPagina(ctx, 'aba A', base, problemas);
  const b = await novaPagina(ctx, 'aba B', base, problemas);
  await ir(a, base, '/');
  await a.click('main .seletor-capital[data-uf="BA"]'); await a.waitForSelector('main a.chip');
  const sessao = await a.locator('main a.chip').first().getAttribute('data-sessao');
  await ir(a, base, `/assentos/${sessao}`); await a.waitForSelector('.assento');
  await ir(b, base, `/assentos/${sessao}`); await b.waitForSelector('.assento');
  const alvo = await a.locator('.fileira .assento.livre:not(.acessivel)').first().getAttribute('data-assento');
  const outro = await a.locator('.fileira .assento.livre:not(.acessivel)').nth(1).getAttribute('data-assento');
  await a.click(`[data-assento="${alvo}"]`);
  await b.waitForFunction((x) => document.querySelector(`[data-assento="${x}"]`).classList.contains('reservado'), alvo, { timeout: 3000 });
  checar('conflito: assento segurado na aba A aparece reservado na aba B', true);
  checar('conflito: leitor de tela ouve a reserva', (await b.getAttribute(`[data-assento="${alvo}"]`, 'aria-label')).includes('reservado por outro cliente'));
  await b.click(`[data-assento="${alvo}"]`, { force: true });
  checar('conflito: aba B não consegue pegar o mesmo assento', (await b.getAttribute(`[data-assento="${alvo}"]`, 'aria-pressed')) === 'false' && (await b.textContent('.recado')).includes('Outro cliente'));
  await foto(b, { nome: 'computador', dir: SAIDA }, 20, 'conflito-reservado');
  await b.click(`[data-assento="${outro}"]`);
  checar('conflito: lado sem texto quebrado', !/null|undefined/.test(await b.innerText('.lado')));
  // Soltar em A libera em B
  await a.click(`[data-assento="${alvo}"]`);
  await b.waitForFunction((x) => document.querySelector(`[data-assento="${x}"]`).classList.contains('livre'), alvo, { timeout: 3000 });
  checar('conflito: soltar na aba A libera na aba B', true);
  // Corrida: A segura; outro cliente compra enquanto A paga
  await a.click(`[data-assento="${alvo}"]`);
  await rota(a, '/resumo'); await a.waitForSelector('#simular-conflito', { state: 'attached' });
  await a.locator('.teste-conflito summary').click();
  await a.click('#simular-conflito');
  await a.click('#continuar'); await a.waitForSelector('#confirmar-pagamento');
  await a.click('#confirmar-pagamento');
  await a.waitForSelector('.recado-alerta', { timeout: 5000 });
  const txt = await a.textContent('.recado-alerta');
  checar('conflito: pagamento recusa o assento perdido e volta ao mapa', txt.includes(alvo) && txt.includes('Nada foi cobrado') && a.url().includes('/assentos/'), txt);
  checar('conflito: assento perdido sai do carrinho e fica ocupado', (await a.getAttribute(`[data-assento="${alvo}"]`, 'class')).includes('vendido'));
  checar('conflito: nenhum ingresso emitido', await a.evaluate(() => JSON.parse(localStorage.getItem('cinelumen.v1')).ingressos.length) === 0);
  await foto(a, { nome: 'computador', dir: SAIDA }, 21, 'conflito-no-pagamento');
  // Duas abas compram: a segunda não leva o que a primeira levou
  const c = await a.locator('.fileira .assento.livre:not(.acessivel)').first().getAttribute('data-assento');
  await a.click(`[data-assento="${c}"]`);
  await rota(a, '/resumo'); await a.waitForSelector('#continuar'); await a.click('#continuar');
  await a.waitForSelector('#confirmar-pagamento'); await a.click('#confirmar-pagamento');
  await a.waitForSelector('.ingresso', { timeout: 8000 });
  await b.waitForFunction((x) => document.querySelector(`[data-assento="${x}"]`).classList.contains('vendido'), c, { timeout: 3000 });
  checar('conflito: compra na aba A ocupa o assento na aba B', true);
  // Reserva vence depois de 10 minutos
  await b.clock.fastForward('11:00'); await b.waitForTimeout(150);
  checar('reserva vence e o assento volta para a sala', (await b.getAttribute('[data-carrinho]', 'data-carrinho')) === '0' && (await b.getAttribute(`[data-assento="${outro}"]`, 'class')).includes('livre'));
  await ctx.close();
}

async function gerente(browser, base, problemas) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const p = await novaPagina(ctx, 'gerente', base, problemas);
  await ir(p, base, '/');
  await p.click('main .seletor-capital[data-uf="RJ"]');
  await rota(p, '/gerente'); await p.waitForSelector('#salvar-sessao');
  const qtd = await p.locator('.tabela-ocupacao tbody tr').count();
  await p.click('#salvar-sessao');
  checar('gerente: exige horário', (await p.textContent('#sessao-erro')).includes('Informe o horário'));
  await p.fill('#nova-hora', '09:00');
  await p.selectOption('#nova-data', { index: 0 });
  await p.click('#salvar-sessao');
  checar('gerente: recusa horário passado', (await p.textContent('#sessao-erro')).includes('já passou'));
  await p.selectOption('#nova-data', { index: 1 });
  await p.selectOption('#nova-sala', 's1');
  const dataAlvo = await p.inputValue('#nova-data');
  const grade = await p.evaluate((d) => import('./js/programacao.js').then((m) => m.programaDoDia('RJ', d).filter((s) => s.salaId === 's1')[0].hora), dataAlvo);
  await p.fill('#nova-hora', grade);
  await p.click('#salvar-sessao');
  checar('gerente: recusa choque de sala', (await p.textContent('#sessao-erro')).includes('A sala está ocupada'));
  await p.selectOption('#nova-sala', 's1');
  await p.fill('#nova-hora', '10:00');
  await p.selectOption('#nova-filme', 'o-farol-de-papel');
  await p.click('#salvar-sessao'); await p.waitForTimeout(60);
  checar('gerente: sessão cadastrada aparece na lista', await p.locator('.tabela-ocupacao tbody tr').count() >= qtd && (await p.textContent('.tabela-ocupacao')).includes('cadastrada'));
  const id = await p.locator('.tabela-ocupacao tr:has(.selo)').getAttribute('data-sessao');
  await p.reload(); await p.waitForSelector('.tabela-ocupacao');
  await rota(p, `/assentos/${id}`); await p.waitForSelector('.assento');
  checar('gerente: sessão cadastrada persiste e nasce vazia', await p.locator('.fileira .assento.vendido').count() === 0 && await p.locator('.fileira .assento.livre').count() > 0);
  await rota(p, '/gerente'); await p.waitForSelector('#painel-dia');
  await p.selectOption('#painel-dia', dataAlvo); await p.waitForTimeout(50);
  await p.locator('.tabela-ocupacao tr:has(.selo) .botao-texto').click(); await p.waitForTimeout(50);
  checar('gerente: sessão excluída some', await p.locator('.tabela-ocupacao tr:has(.selo)').count() === 0);
  // Restaurar
  await p.click('#btn-restaurar'); await p.waitForSelector('#dlg-restaurar[open]');
  await p.click('#restaurar-sim'); await p.waitForTimeout(80);
  checar('restaurar limpa o armazenamento', await p.evaluate(() => localStorage.getItem('cinelumen.v1') === null));
  checar('restaurar volta para a escolha de capital', await p.locator('main .seletor-capital').count() === 27);
  await ctx.close();
}

async function robustez(browser, base, problemas) {
  // Dados corrompidos
  let ctx = await browser.newContext(); let p = await novaPagina(ctx, 'corrompido', base, problemas);
  await p.addInitScript(() => { try { localStorage.setItem('cinelumen.v1', '{isto nao e json'); sessionStorage.setItem('cinelumen.aba.v1', '[1,2'); } catch (e) { /* teste */ } });
  await ir(p, base, '/');
  checar('dados corrompidos não quebram o site', await p.locator('main .seletor-capital').count() === 27);
  await ctx.close();
  // Dado malicioso não vira HTML
  ctx = await browser.newContext(); p = await novaPagina(ctx, 'xss', base, problemas);
  await p.addInitScript(() => { localStorage.setItem('cinelumen.v1', JSON.stringify({ uf: 'SP', ingressos: [{ codigo: '<img src=x onerror=alert(1)>', filmeId: 'mare-de-vidro', filme: '<b>x</b>', sala: 's', uf: 'SP', unidade: 'u', data: '2026-11-06', hora: '10:00', assentos: [{ id: 'A1', tipo: 'meia' }], itens: [], total: 1 }] })); });
  await ir(p, base, '/meus-ingressos');
  checar('texto do armazenamento não vira HTML', await p.locator('main .ingresso img[src="x"], main .ingresso b:text-is("x")').count() === 0 && (await p.textContent('.ingresso-codigo')).includes('<img'));
  await ctx.close();
  // Armazenamento bloqueado
  ctx = await browser.newContext(); p = await novaPagina(ctx, 'bloqueado', base, problemas);
  await p.addInitScript(() => {
    const bloqueio = { get() { throw new DOMException('bloqueado', 'SecurityError'); } };
    Object.defineProperty(window, 'localStorage', bloqueio); Object.defineProperty(window, 'sessionStorage', bloqueio);
  });
  await ir(p, base, '/');
  checar('armazenamento bloqueado: avisa', await p.locator('#aviso-armazenamento').isVisible());
  await p.click('main .seletor-capital[data-uf="PE"]'); await p.waitForTimeout(50);
  checar('armazenamento bloqueado: funciona em memória', (await p.textContent('main h1')).includes('Recife'));
  await ctx.close();
  // Teclado
  ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } }); p = await novaPagina(ctx, 'teclado', base, problemas);
  await ir(p, base, '/');
  await p.keyboard.press('Tab');
  checar('teclado: primeiro Tab no atalho de conteúdo', await p.evaluate(() => document.activeElement.id) === 'pular');
  await p.goto(`${base}#/filme/%E0%A4%A`); await p.waitForSelector('.vazio');
  checar('endereço malformado mostra aviso, sem erro', (await p.textContent('.vazio h1')).length > 0);
  await p.goto(`${base}#/assentos/SP_2026-99-99_s1_1300`); await p.waitForSelector('.vazio');
  checar('sessão inexistente mostra aviso', (await p.textContent('.vazio h1')).includes('não existe'));
  await p.goto(`${base}#/`); await p.waitForSelector('main .seletor-capital');
  await p.click('main .seletor-capital[data-uf="CE"]');
  const sessao = await p.locator('main a.chip').first().getAttribute('data-sessao');
  await rota(p, `/assentos/${sessao}`); await p.waitForSelector('.assento');
  checar('foco vai para o título ao trocar de tela', await p.evaluate(() => document.activeElement.tagName) === 'H1');
  const primeiro = p.locator('.fileira .assento[tabindex="0"]');
  checar('teclado: só um assento entra no Tab', await primeiro.count() === 1);
  await primeiro.focus();
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight');
  const foco = await p.evaluate(() => document.activeElement.dataset.assento);
  checar('teclado: setas andam no mapa', !!foco);
  const contorno = await p.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle + c.outlineWidth; });
  checar('teclado: foco visível', contorno.includes('solid') && !contorno.includes('0px'), contorno);
  // Procura um assento livre pelo teclado
  let cont = 0;
  while (cont++ < 80 && !(await p.evaluate(() => document.activeElement.classList.contains('livre')))) await p.keyboard.press(cont % 10 === 0 ? 'ArrowDown' : (Math.floor(cont / 10) % 2 ? 'ArrowLeft' : 'ArrowRight'));
  await p.keyboard.press('Enter');
  checar('teclado: Enter escolhe o assento', await p.locator('.fileira .assento.escolhido').count() === 1);
  await p.click('#btn-capital'); await p.keyboard.press('Escape');
  checar('teclado: Esc fecha o diálogo', await p.locator('#dlg-capital[open]').count() === 0);
  // Animação respeita a preferência do sistema
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.goto(`${base}#/`); await p.waitForSelector('.placa');
  checar('movimento reduzido desliga a animação do letreiro', parseFloat(await p.evaluate(() => getComputedStyle(document.querySelector('.placa')).animationDuration)) < 0.01);
  // Bomboniere sem sessão
  await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } }); p = await novaPagina(ctx, 'avulso', base, problemas);
  await ir(p, base, '/');
  await p.click('main .seletor-capital[data-uf="SC"]');
  await rota(p, '/bomboniere'); await p.waitForSelector('.bomb-item');
  await p.click('[data-add="pipoca-doce"]');
  await p.click('#continuar'); await p.waitForTimeout(60);
  checar('carrinho só com pipoca pede a sessão e guarda o item', (await p.textContent('main')).includes('Escolha uma sessão') && (await p.textContent('main')).includes('Pipoca doce de leite'));
  await rota(p, '/resumo'); await p.reload(); await p.waitForSelector('main h1');
  checar('item da bomboniere continua após recarregar', (await p.textContent('main')).includes('Pipoca doce de leite'));
  await ctx.close();
}

function varrer() {
  const textos = [];
  const andar = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'capturas', 'fontes'].includes(n.name)) continue;
    const f = path.join(d, n.name);
    if (n.isDirectory()) andar(f); else textos.push(f);
  } };
  andar(RAIZ);
  const site = textos.filter((f) => !f.includes(`${path.sep}tests${path.sep}`));
  const tudo = (fs_) => fs_.map((f) => [path.relative(RAIZ, f), fs.readFileSync(f, 'utf8')]);
  const achou = (re, lista) => tudo(lista).filter(([, t]) => re.test(t)).map(([f]) => f);
  const proib = 'cidade ' + '2000|sat' + 'us|\\br' + 'pg\\b';
  checar('sem referência ao jogo original', achou(new RegExp(proib, 'i'), textos).length === 0, achou(new RegExp(proib, 'i'), textos).join());
  checar('sem travessão', achou(/[\u2013\u2014]/, textos).length === 0, achou(/[\u2013\u2014]/, textos).join());
  const marcas = ['coca-cola', 'coca cola', 'doritos', 'pepsi', 'fanta', 'sprite', 'antarctica', 'netflix', 'disney', 'warner', 'marvel', 'cinemark', 'kinoplex', 'ingresso\\.com', 'tiktok'];
  const mr = new RegExp(`\\b(${marcas.join('|')})\\b`, 'i');
  checar('sem marca de terceiros no site', achou(mr, site).length === 0, achou(mr, site).join());
  checar('sem innerHTML, eval ou document.write', achou(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, site.filter((f) => f.endsWith('.js'))).length === 0);
  const ext = tudo(site.filter((f) => /\.(html|js|css)$/.test(f))).flatMap(([f, t]) => (t.match(/https?:\/\/[^"'\s)<]+/g) || []).filter((u) => !u.startsWith('https://mileumalinhas.com.br') && !u.startsWith('https://toshiro01001.github.io/cinelumen/') && !u.includes('www.w3.org')).map((u) => `${f} ${u}`));
  checar('sem endereço de terceiros', ext.length === 0, ext.join());
  checar('CSP por meta presente', /http-equiv="Content-Security-Policy"[^>]*default-src 'none'/.test(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')));
  checar('logo de referência apagado', !fs.existsSync(path.join(RAIZ, 'assets/logo-referencia.png')));
  checar('sem CLAUDE.md', !fs.existsSync(path.join(RAIZ, 'CLAUDE.md')));
  const readme = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8').trimEnd().split('\n');
  checar('README termina com a linha pedida', readme[readme.length - 1] === 'Desenvolvi este projeto e usei o Claude, da Anthropic, como ferramenta durante o desenvolvimento.');
  for (const f of fs.readdirSync(path.join(RAIZ, 'assets/cartazes'))) {
    const t = fs.readFileSync(path.join(RAIZ, 'assets/cartazes', f), 'utf8');
    if (/<image|href=/.test(t)) checar(`cartaz sem imagem externa: ${f}`, false);
  }
}

(async () => {
  varrer();
  const { srv, base } = await iniciar();
  const browser = await chromium.launch();
  const problemas = [];
  await capitais(browser, base, problemas);
  for (const perfil of PERFIS) await fluxo(browser, perfil, base, problemas);
  await conflito(browser, base, problemas);
  await gerente(browser, base, problemas);
  await robustez(browser, base, problemas);
  const reais = problemas.filter((x) => !(x.startsWith('xss') && x.includes('404')));
  checar('nenhum erro de console, requisição externa ou arquivo faltando', reais.length === 0, [...new Set(reais)].slice(0, 8).join(' | '));
  await browser.close(); srv.close();
  console.log(`\n${ok} verificações ok, ${falhas.length} falhas`);
  falhas.forEach((f) => console.log(`  FALHA ${f}`));
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
