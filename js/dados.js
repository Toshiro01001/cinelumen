// Dados fixos da demonstração. Tudo aqui é fictício, menos a geografia.

// As 27 unidades federativas, com a capital e o fuso oficial da capital (banco de fusos IANA).
export const UFS = [
  { uf: 'AC', estado: 'Acre', capital: 'Rio Branco', regiao: 'Norte', fuso: 'America/Rio_Branco' },
  { uf: 'AL', estado: 'Alagoas', capital: 'Maceió', regiao: 'Nordeste', fuso: 'America/Maceio' },
  { uf: 'AP', estado: 'Amapá', capital: 'Macapá', regiao: 'Norte', fuso: 'America/Belem' },
  { uf: 'AM', estado: 'Amazonas', capital: 'Manaus', regiao: 'Norte', fuso: 'America/Manaus' },
  { uf: 'BA', estado: 'Bahia', capital: 'Salvador', regiao: 'Nordeste', fuso: 'America/Bahia' },
  { uf: 'CE', estado: 'Ceará', capital: 'Fortaleza', regiao: 'Nordeste', fuso: 'America/Fortaleza' },
  { uf: 'DF', estado: 'Distrito Federal', capital: 'Brasília', regiao: 'Centro-Oeste', fuso: 'America/Sao_Paulo' },
  { uf: 'ES', estado: 'Espírito Santo', capital: 'Vitória', regiao: 'Sudeste', fuso: 'America/Sao_Paulo' },
  { uf: 'GO', estado: 'Goiás', capital: 'Goiânia', regiao: 'Centro-Oeste', fuso: 'America/Sao_Paulo' },
  { uf: 'MA', estado: 'Maranhão', capital: 'São Luís', regiao: 'Nordeste', fuso: 'America/Fortaleza' },
  { uf: 'MT', estado: 'Mato Grosso', capital: 'Cuiabá', regiao: 'Centro-Oeste', fuso: 'America/Cuiaba' },
  { uf: 'MS', estado: 'Mato Grosso do Sul', capital: 'Campo Grande', regiao: 'Centro-Oeste', fuso: 'America/Campo_Grande' },
  { uf: 'MG', estado: 'Minas Gerais', capital: 'Belo Horizonte', regiao: 'Sudeste', fuso: 'America/Sao_Paulo' },
  { uf: 'PA', estado: 'Pará', capital: 'Belém', regiao: 'Norte', fuso: 'America/Belem' },
  { uf: 'PB', estado: 'Paraíba', capital: 'João Pessoa', regiao: 'Nordeste', fuso: 'America/Fortaleza' },
  { uf: 'PR', estado: 'Paraná', capital: 'Curitiba', regiao: 'Sul', fuso: 'America/Sao_Paulo' },
  { uf: 'PE', estado: 'Pernambuco', capital: 'Recife', regiao: 'Nordeste', fuso: 'America/Recife' },
  { uf: 'PI', estado: 'Piauí', capital: 'Teresina', regiao: 'Nordeste', fuso: 'America/Fortaleza' },
  { uf: 'RJ', estado: 'Rio de Janeiro', capital: 'Rio de Janeiro', regiao: 'Sudeste', fuso: 'America/Sao_Paulo' },
  { uf: 'RN', estado: 'Rio Grande do Norte', capital: 'Natal', regiao: 'Nordeste', fuso: 'America/Fortaleza' },
  { uf: 'RS', estado: 'Rio Grande do Sul', capital: 'Porto Alegre', regiao: 'Sul', fuso: 'America/Sao_Paulo' },
  { uf: 'RO', estado: 'Rondônia', capital: 'Porto Velho', regiao: 'Norte', fuso: 'America/Porto_Velho' },
  { uf: 'RR', estado: 'Roraima', capital: 'Boa Vista', regiao: 'Norte', fuso: 'America/Boa_Vista' },
  { uf: 'SC', estado: 'Santa Catarina', capital: 'Florianópolis', regiao: 'Sul', fuso: 'America/Sao_Paulo' },
  { uf: 'SP', estado: 'São Paulo', capital: 'São Paulo', regiao: 'Sudeste', fuso: 'America/Sao_Paulo' },
  { uf: 'SE', estado: 'Sergipe', capital: 'Aracaju', regiao: 'Nordeste', fuso: 'America/Maceio' },
  { uf: 'TO', estado: 'Tocantins', capital: 'Palmas', regiao: 'Norte', fuso: 'America/Araguaina' },
];

export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

const RUAS = ['Avenida da Claquete', 'Rua do Rolo de Filme', 'Travessa do Projetor', 'Alameda da Pipoca',
  'Largo da Bilheteria', 'Rua da Sessão Dupla', 'Avenida dos Créditos Finais', 'Praça da Tela Grande'];

export function ufPorSigla(sigla) { return UFS.find((u) => u.uf === sigla) || null; }

export function unidadeDe(u) {
  const i = UFS.indexOf(u);
  return {
    nome: `CineLumen ${u.capital}`,
    endereco: `${RUAS[i % RUAS.length]}, ${100 + i * 37}, ${u.capital}, ${u.uf} (endereço fictício)`,
  };
}

// Filmes inventados. Classificação, duração e sinopse também.
export const FILMES = [
  { id: 'a-ultima-pipoca', titulo: 'A Última Pipoca', genero: 'Comédia', minutos: 98, classe: 'Livre', familia: true,
    sinopse: 'Numa sala lotada, resta uma única pipoca no balde. Seis amigos, uma lanterna de celular e nenhum senso de limite.' },
  { id: 'mare-de-vidro', titulo: 'Maré de Vidro', genero: 'Drama', minutos: 124, classe: '14 anos',
    sinopse: 'Uma pescadora encontra, a cada maré, cacos de um barco que afundou antes de ela nascer, e decide montar o que falta da história da família.' },
  { id: 'o-farol-de-papel', titulo: 'O Farol de Papel', genero: 'Animação', minutos: 89, classe: 'Livre', familia: true,
    sinopse: 'Um barquinho de dobradura precisa atravessar a enxurrada da rua até o farol que uma criança desenhou no muro.' },
  { id: 'expresso-cerrado', titulo: 'Expresso Cerrado', genero: 'Ação', minutos: 112, classe: '12 anos',
    sinopse: 'O maquinista descobre, no meio do chapadão, que o freio foi vendido no último pátio. Faltam 900 quilômetros e um jantar de família.' },
  { id: 'noite-sem-eclipse', titulo: 'Noite sem Eclipse', genero: 'Suspense', minutos: 107, classe: '16 anos',
    sinopse: 'A cidade inteira sai à rua para ver o eclipse anunciado. A sombra aparece no horário certo, mas a lua continua lá. O que passou na frente?' },
  { id: 'sete-luas-sobre-arua', titulo: 'Sete Luas sobre Aruá', genero: 'Fantasia', minutos: 132, classe: '10 anos', familia: true,
    sinopse: 'Num vilarejo de rio inventado, cada lua cobra uma promessa antiga. Uma barqueira tem sete noites para quitar todas.' },
  { id: 'reparticao-das-coisas-perdidas', titulo: 'Repartição das Coisas Perdidas', genero: 'Comédia', minutos: 101, classe: '12 anos',
    sinopse: 'Toda meia sumida tem protocolo. Um estagiário recém-chegado encontra o formulário do próprio pai, perdido em 1998.' },
  { id: 'orbita-do-quintal', titulo: 'Órbita do Quintal', genero: 'Ficção científica', minutos: 116, classe: '10 anos', familia: true,
    sinopse: 'Uma menina transforma a caixa-d\'água em foguete. O problema é que funciona, e a vizinha de cima quer carona.' },
];
export function filmePorId(id) { return FILMES.find((f) => f.id === id) || null; }

// Tipos de sala: tamanho do mapa e preço da inteira em centavos.
export const TIPOS_SALA = {
  classica: { nome: 'Clássica', descricao: 'Tela grande, poltrona confortável e o cheiro de sempre.', filas: 9, colunas: 10, preco: 3200 },
  familia: { nome: 'Família', descricao: 'Luz mais baixa aos poucos e som mais gentil, para quem ainda tem medo do trailer.', filas: 8, colunas: 10, preco: 2800 },
  estrela: { nome: 'Estrela', descricao: 'Poltrona reclinável e mais espaço para as pernas.', filas: 6, colunas: 8, preco: 4600 },
};
export const SALAS = [
  { id: 's1', nome: 'Sala 1', tipo: 'classica' },
  { id: 's2', nome: 'Sala 2', tipo: 'familia' },
  { id: 's3', nome: 'Sala 3', tipo: 'estrela' },
  { id: 's4', nome: 'Sala 4', tipo: 'classica' },
  { id: 's5', nome: 'Sala 5', tipo: 'classica' },
];
export function salaPorId(id) { return SALAS.find((s) => s.id === id) || null; }

// Bomboniere com nomes genéricos, sem marca nenhuma. Preços em centavos.
export const BOMBONIERE = [
  { grupo: 'Pipocas', itens: [
    { id: 'pipoca-p', nome: 'Pipoca salgada pequena', desc: 'Para quem jura que só quer provar.', preco: 1400 },
    { id: 'pipoca-m', nome: 'Pipoca salgada média', desc: 'Dura até o fim dos trailers, com disciplina.', preco: 1900 },
    { id: 'pipoca-g', nome: 'Pipoca salgada grande', desc: 'Dá para dividir. Ninguém divide.', preco: 2400 },
    { id: 'pipoca-doce', nome: 'Pipoca doce de leite', desc: 'Tamanho médio, com calda de doce de leite.', preco: 2200 },
    { id: 'pipoca-queijo', nome: 'Pipoca de queijo', desc: 'Tamanho médio. Deixa rastro nos dedos.', preco: 2200 },
  ] },
  { grupo: 'Bebidas', itens: [
    { id: 'cola', nome: 'Refrigerante de cola', desc: 'Copo de 500 ml.', preco: 1200 },
    { id: 'guarana', nome: 'Refrigerante de guaraná', desc: 'Copo de 500 ml.', preco: 1200 },
    { id: 'caju', nome: 'Suco de caju', desc: 'Copo de 400 ml.', preco: 1300 },
    { id: 'agua', nome: 'Água mineral', desc: 'Garrafa de 500 ml, servida no copo.', preco: 700 },
  ] },
  { grupo: 'Combos', itens: [
    { id: 'combo-solo', nome: 'Combo Solo', desc: 'Pipoca média e uma bebida.', preco: 2700 },
    { id: 'combo-dupla', nome: 'Combo Dupla', desc: 'Pipoca grande e duas bebidas.', preco: 4200 },
    { id: 'combo-turma', nome: 'Combo Turma', desc: 'Duas pipocas médias e quatro bebidas.', preco: 7900 },
  ] },
];
export function itemPorId(id) {
  for (const g of BOMBONIERE) { const i = g.itens.find((x) => x.id === id); if (i) return i; }
  return null;
}
