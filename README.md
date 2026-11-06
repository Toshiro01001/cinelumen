# CineLumen

Site e sistema de uma rede de cinema fictícia com unidade nas 27 capitais do Brasil. É uma demonstração: nada é vendido, nenhum dado sai do navegador e não existe servidor.

Publicado em: https://toshiro01001.github.io/cinelumen/

## O que tem

- Escolha do estado e da capital, com relógio no fuso de cada uma. A escolha fica salva.
- Oito filmes inventados, com cartazes originais em SVG.
- Compra completa: filme, sala, sessão, mapa de assentos com ocupação, inteira e meia, bomboniere, resumo, pagamento simulado em etapas e ingresso com código fictício.
- Bomboniere com pipocas, bebidas e combos de nomes genéricos, no mesmo carrinho do ingresso.
- "Meus ingressos" e painel do gerente, com ocupação por sessão, vendas simuladas por capital e cadastro de sessão.
- Seção "Como isto funciona", com o que dá para adaptar e o que a versão real precisa a mais.

## Como funciona

- **Programação:** uma função gera as sessões e os assentos ocupados a partir da capital e da data. O mesmo dia na mesma capital sempre dá o mesmo resultado, sem banco de dados.
- **Fuso:** cada capital tem seu fuso IANA, lido pelo `Intl.DateTimeFormat` do navegador. A venda de uma sessão fecha no horário local da capital.
- **Assentos:** cada poltrona escolhida fica reservada por 10 minutos. O carrinho fica por aba (`sessionStorage`) e as reservas e vendas ficam no navegador (`localStorage`), então duas abas se comportam como dois clientes. O sistema confere os assentos de novo antes de emitir o ingresso.
- **Dados:** só ficam guardados capital, carrinho, ingressos de teste e sessões cadastradas. Nunca CPF, nome ou cartão. O botão "Restaurar demonstração", no rodapé, apaga tudo.
- **Segurança:** política de conteúdo (CSP) por meta sem nenhum terceiro, dado variável sempre como texto e leitura do armazenamento protegida contra dado corrompido ou bloqueado.

A reserva só vale dentro de um navegador. Uma versão real precisa de servidor, pagamento de verdade, login do gerente e tratamento de dados conforme a LGPD. A lista completa está na seção "Como isto funciona" do site.

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

## Tecnologias

HTML, CSS e JavaScript puros, sem build e sem CDN. Imagens em SVG. Fontes League Gothic e Figtree (licença SIL OFL 1.1) hospedadas no próprio site.

Desenvolvido por Rodrigo Terroso Junior. O Claude, da Anthropic, foi usado como ferramenta durante o desenvolvimento.
