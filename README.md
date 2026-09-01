# Albion Calc

Calculadora de refino para Albion Online, criada para ajudar o jogador a comparar rotas, custos e rentabilidade antes de investir prata.

## Visão geral

O Albion Calc ajuda a entender onde refinar, qual cidade entrega o melhor resultado e como cada insumo impacta o custo final por unidade. A ferramenta lê preços em tempo real do Albion Online Data Project e combina esses dados com configurações locais como premium, foco, taxa da refinaria e encantamentos selecionados.

A aplicação é focada em decisões práticas:

- comparar recursos e tiers
- avaliar rentabilidade cidade a cidade
- estimar custo unitário e lucro líquido
- destacar a melhor rota automaticamente
- inspecionar a receita do item refinado por hover e modal

## Funcionalidades

- cobertura de minério, madeira, couro, fibra e pedra
- suporte de tiers de T2 a T8
- filtro de encantamentos de .0 a .4
- ranqueamento da melhor rota por margem por padrão, com priorização opcional de lucro líquido
- prévia dinâmica da receita do item ao passar o mouse
- modal de receita com imagem, fórmula e explicação de tier equivalente
- sobrescrita manual de preços e preferências persistentes no localStorage
- layout responsivo para desktop e mobile

## Por que usar

Em Albion Online, a diferença entre uma rota inteligente e uma ruim pode ser enorme. Esta ferramenta ajuda a responder perguntas como:

- Onde devo refinar este item?
- Qual cidade oferece o melhor custo de insumo?
- Qual cidade vende o produto final pelo melhor valor?
- O uso de foco realmente melhora o resultado?
- Qual é a receita exata deste tier e encantamento?

## Começo rápido

Como é uma aplicação web estática, você pode executá-la de algumas formas.

### Abrir diretamente no navegador

Abra a pasta do projeto e carregue o arquivo index.html no navegador.

### VS Code com Live Server

1. Abra o projeto no VS Code
2. Abra o arquivo index.html
3. Execute com Live Server
4. Acesse a URL local gerada pela extensão, normalmente:

```text
http://localhost:5500
```

### Servidor local em Python

```bash
cd AlbionCalc
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

## Estrutura do projeto

```text
AlbionCalc/
├── .gitignore
├── README.md
├── index.html
├── package.json
├── src/
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   ├── modals.css
│   │   └── responsive.css
│   └── js/
│       ├── api.js
│       ├── app.js
│       ├── database.js
│       ├── engine.js
│       └── store.js
```

## Stack tecnológica

- HTML5
- CSS3
- JavaScript ES Modules
- Fetch API para dados do AODP
- localStorage para persistência local

## Observações

Este repositório é focado no fluxo de refino. O módulo de crafting ainda não está ativo como funcionalidade separada.

A versão atual também está alinhada com as novas convenções de nomenclatura de insumos brutos e refinados e com a lógica de tier superior com equivalente de encantamento.

## Fonte de dados

A aplicação usa dados públicos de mercado do Albion Online Data Project:

https://www.albion-online-data.com/

## Licença

Este projeto é atualmente distribuído como ferramenta local para uso pessoal.
