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

- **Cobertura Completa de Recursos**: Minério, Madeira, Couro, Fibra e Pedra
- **Suporte de Tiers**: T2 a T8 com fórmulas específicas de refino
- **Filtro de Encantamentos**: .0 a .4 com seleção múltipla (ou todos se vazio)
- **Seleção de Critério**: Ranqueamento por margem de lucro (padrão) ou lucro líquido (opcional)
- **Análise de Rotas**: Destaque automático da melhor rota considerando compra, refino e venda em cidades distintas
- **Prévia de Receita**: Hover card com ingredientes necessários
- **Modal de Receita Detalhado**: Imagem, fórmula, explicação de tier equivalente e encantamento
- **Modais de Ajuda Educacionais**: Explicação de Custo Unitário, Lucro Unitário e Uso de Foco com fórmulas e exemplos práticos
- **Edição Manual de Preços**: Todos os valores são editáveis inline sem sair da tela
- **Reset de Preços**: Limpar sobrescrita e voltar aos valores da API com um clique
- **Preferências Persistentes**: Todas as configurações (tier, recurso, encantamentos, taxa de estação, Premium/Foco) são salvas no localStorage
- **Layout Responsivo**: Mobile-first com interface otimizada para smartphone e desktop
- **Touch-Friendly**: Todos os controles com 44px mínimos para fácil acesso em telas mobile
- **Dados em Tempo Real**: Integração com Albion Online Data Project (AODP) para preços atualizados

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

## Estrutura do Projeto

```text
AlbionCalc/
├── index.html                      # Estrutura HTML única (SPA)
├── package.json                    # Metadados e scripts
├── README.md                       # Este arquivo
├── src/
│   ├── css/
│   │   ├── base.css               # Variáveis, reset, estilos base
│   │   ├── components.css         # Botões, inputs, cards, badges
│   │   ├── layout.css             # Grid, sidebar, tabelas (mobile-first)
│   │   ├── modals.css             # Diálogos e overlays
│   │   └── responsive.css         # Media query desktop (768px+)
│   └── js/
│       ├── app.js                 # Controlador principal
│       ├── api.js                 # Integração AODP + formatação
│       ├── database.js            # Constantes e referências
│       ├── engine.js              # Cálculos (RRR, nutrição, lucro)
│       ├── help.js                # Gerador de conteúdo dos modais
│       ├── recipes.js             # Gerenciador de modal de receita
│       ├── render.js              # Renderização de tabelas
│       ├── route.js               # Avaliador de melhor rota
│       └── store.js               # Persistência em localStorage
```

## Stack Tecnológica

- **Runtime**: JavaScript (Vanilla ES Modules)
- **Apresentação**: HTML5 + Vanilla CSS 3
- **Estado**: localStorage (browser nativo)
- **Dados**: AODP API JSON via Fetch
- **Testes**: Node.js test runner (built-in)

## Como Usar

### Seleção de Recurso
1. Abra a seção de configurações (aba no topo em mobile, sidebar em desktop)
2. Clique em um dos botões de recurso: Minério, Madeira, Couro, Fibra ou Pedra

### Escolha de Tier
3. Selecione um tier entre T2 e T8
4. A tabela atualiza com os encantamentos disponíveis para esse tier

### Filtro de Encantamentos
5. Por padrão, apenas `.0` é mostrado
6. Marque os encantamentos desejados (ou desmarque todos para ver tudo)

### Configurar Cidades
7. Selecione uma ou mais cidades para análise (Martlock, Lymhurst, Fort Sterling, etc.)
8. A calculadora computa a melhor rota (menor custo de compra + maior preço de venda)

### Ativar Premium/Foco
9. Use os toggles para ativar Premium (reduz imposto) e/ou Foco (aumenta RRR)
10. Ajuste a taxa da refinaria conforme necessário (padrão: 500 prata por 100 nutrição)

### Editar Preços Manualmente
11. Clique em qualquer célula de preço para editar manualmente (preços da API podem ser baixos)
12. Use "Redefinir Preços" para restaurar valores da API

### Entender a Melhor Rota
13. A linha destacada mostra a combinação de cidades com maior margem (ou lucro se selecionado)
14. Passe o mouse sobre o ícone do item refinado para ver ingredientes necessários
15. Clique no ícone para abrir modal com fórmula completa e explicações

### Modais de Ajuda
16. Clique em `?` ao lado de "Custo Unitário", "Lucro Unitário" ou "Usar Foco" para entender cada métrica
17. Os exemplos são gerados com base na melhor rota atual

---

## Observações

- O módulo de Crafting não está desabilitado no momento (em breve).
- A aplicação utiliza **nomenclatura nova** de insumos brutos e refinados alinhada com as convenções atuais de Albion Online.
- Fórmulas de refino refletem a lógica de tier superior com equivalente de encantamento.
- Suporte completo para **mobile-first**: confira no smartphone!
- Todos os dados são **calculados no navegador**; nenhuma informação é enviada a servidores externos além da API AODP.

## Fonte de Dados

A aplicação usa dados públicos de mercado do [Albion Online Data Project](https://www.albion-online-data.com/). Os preços são atualizados em tempo real conforme a comunidade relata transações.

## Licença

Este projeto é distribuído como ferramenta local para uso pessoal.
