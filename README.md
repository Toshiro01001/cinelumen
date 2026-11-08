# CineLumen

![Página inicial do CineLumen](docs/tela.webp)

Fiz este site para mostrar como ficaria o site de um cinema de verdade: o visitante escolhe a cidade, o filme, o horário e a poltrona, junta pipoca e bebida e sai com um ingresso. O cinema, os filmes, os endereços e os preços são inventados. Nada é vendido, nada é cobrado e nenhum dado sai do navegador de quem usa.

Publicado em: https://toshiro01001.github.io/cinelumen/

## Como usar

1. Abra o site e escolha a capital. A rede fictícia tem uma unidade em cada uma das 27 capitais do Brasil, e a programação, o relógio e a sala mudam junto com a capital.
2. Toque em um filme ou direto em um horário. O site mostra o mapa da sala: toque nas poltronas livres para escolher as suas.
3. Diga se cada ingresso é inteira ou meia, junte itens da bomboniere se quiser e confira o resumo.
4. Escolha uma forma de pagamento de mentira e confirme. Sai um ingresso com código fictício, guardado em "Meus ingressos".
5. Na aba "Gerente" dá para ver a ocupação de cada sessão, cadastrar sessões novas e comparar as vendas simuladas das capitais.

O botão "Restaurar demonstração", no rodapé, apaga tudo e volta o site ao começo.

## O que tem

- Escolha do estado e da capital, com relógio no fuso de cada uma. A escolha fica salva no navegador.
- Oito filmes inventados, com cartazes originais em SVG.
- Compra completa: filme, sala, sessão, mapa de assentos com ocupação, inteira e meia, bomboniere, resumo, pagamento simulado em etapas e ingresso com código fictício.
- Bomboniere com pipocas, bebidas e combos de nomes genéricos, no mesmo carrinho do ingresso.
- "Meus ingressos" e painel do gerente, com ocupação por sessão, vendas simuladas por capital e cadastro de sessão.
- Seção "Como isto funciona", com o caminho de uma compra, o que dá para adaptar e o que a versão real precisa a mais.

## Como funciona por dentro

- **Programação:** uma conta feita com a capital e a data gera as sessões e os assentos já ocupados. O mesmo dia na mesma capital sempre dá o mesmo resultado, sem banco de dados.
- **Relógio:** cada capital tem seu fuso horário. A venda de uma sessão fecha no horário local da capital, então em Cuiabá fecha uma hora depois de Brasília.
- **Assentos:** cada poltrona escolhida fica segura por 10 minutos. Duas abas do navegador se comportam como dois clientes: a poltrona segura em uma aparece como reservada na outra. Antes de emitir o ingresso, o sistema confere de novo se as poltronas continuam suas.
- **Dados:** só ficam guardados, no próprio navegador, a capital, o carrinho, os ingressos de teste e as sessões cadastradas. Nunca CPF, nome ou cartão.

A reserva só vale dentro de um navegador. Uma versão real precisa de servidor, pagamento de verdade, login do gerente e tratamento de dados conforme a LGPD. A lista completa está na seção "Como isto funciona" do site.

## Detalhes técnicos

- HTML, CSS e JavaScript puros, sem build, sem biblioteca e sem CDN. Imagens em SVG. Fontes League Gothic e Figtree (licença SIL OFL 1.1) hospedadas no próprio site.
- As telas são montadas pelo JavaScript e as rotas ficam no `#` do endereço (hash), por isso o site funciona em qualquer subpasta.
- Fuso: cada capital tem seu fuso IANA, lido pelo `Intl.DateTimeFormat` do navegador.
- Armazenamento: o carrinho fica por aba (`sessionStorage`); reservas, ingressos e sessões cadastradas ficam no `localStorage`, e o evento `storage` sincroniza as abas abertas.
- Segurança: política de conteúdo (CSP) por meta sem nenhum terceiro, dado variável sempre como nó de texto (nunca HTML) e leitura do armazenamento protegida contra dado corrompido ou bloqueado.

## Como rodar

O site usa módulos JavaScript, então abra por um servidor local e não direto pelo arquivo:

```
node tests/servidor.js
```

Depois abra http://127.0.0.1:8080/cinelumen/. Qualquer servidor estático serve, sem build e sem instalar nada.

## Testes

Com Playwright e Chromium instalados globalmente:

```
NODE_PATH=$(npm root -g) node tests/e2e.js
```

Os testes percorrem os fluxos em 1366x800, iPhone 13 e 320 px, conferem as 27 capitais, o conflito de assento, a persistência e a compra completa, e salvam capturas em `tests/capturas`.

Desenvolvi este projeto e usei o Claude, da Anthropic, como ferramenta durante o desenvolvimento.
