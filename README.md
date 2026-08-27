# Albion Calc

## Decida onde refinar. Saiba quanto vai ganhar.

O **Albion Calc** é uma calculadora de refino para *Albion Online* que transforma preços de mercado em decisões práticas. Compare cidades, recursos e encantamentos, estime o custo real de produção e encontre a rota mais rentável antes de investir sua prata.

Os preços são obtidos pelo [Albion Online Data Project (AODP)](https://www.albion-online-data.com/), enquanto as preferências e os ajustes manuais ficam salvos no próprio navegador.

## Por que usar

Refinar sem comparar cidades pode consumir margem sem que você perceba. O Albion Calc reúne os dados essenciais em uma única visão:

- Qual cidade oferece o melhor custo de compra.
- Onde o bônus regional favorece o refino.
- Qual cidade apresenta o melhor preço de venda.
- Quanto custa produzir cada unidade.
- Qual é o lucro líquido estimado depois das taxas.

## Recursos

### Comparação de refino

Analise Minério, Madeira, Couro, Fibra e Pedra nos tiers T2 a T8. A tabela apresenta, por cidade:

- Preço do insumo bruto.
- Preço do insumo refinado anterior, quando necessário.
- Preço de venda do produto final.
- Idade individual de cada preço.
- Custo unitário de produção.
- Lucro unitário e margem estimada.

### Filtros rápidos

- Seleção de recurso em um controle segmentado.
- Filtro de tier de T2 a T8.
- Filtro de encantamento `.0`, `.1`, `.2`, `.3` e `.4`.
- `.0` selecionado por padrão.
- Nenhum encantamento selecionado para exibir todos os encantamentos disponíveis.
- Seleção das cidades analisadas.

### Cálculo mais próximo da realidade

O motor considera:

- Taxa de Retorno de Recursos (RRR) por cidade.
- Uso de foco.
- Bônus regionais de refino.
- Taxa de mercado com ou sem Premium.
- Custo de nutrição e taxa da estação.
- Ingredientes do tier atual e do tier anterior.

### Controle sobre os dados

Os preços da API podem ser editados diretamente na tabela. Isso permite simular ordens de compra, negociações ou preços observados no jogo. O botão **Redefinir preços** restaura os valores da API.

## Como funciona

1. Escolha o recurso que deseja refinar.
2. Selecione o tier e os encantamentos de interesse.
3. Marque as cidades que deseja comparar.
4. Ajuste Premium, foco e taxa da refinaria.
5. Analise o custo unitário, a margem e a melhor rota sugerida.

No desktop, os controles ficam em uma sidebar fixa e aberta. Em telas menores, as configurações ficam em um painel recolhível para preservar o espaço da tabela.

## Como executar

O projeto é uma aplicação web estática, sem backend próprio, e pode ser utilizado de duas formas.

### Acesso pelo GitHub Pages

A aplicação está disponível online pelo GitHub Pages:

**[Abrir o Albion Calc](https://brsubs.github.io/AlbionCalc/)**

### Execução local com Live Server

Para executar localmente, abra a pasta do projeto no VS Code e use a extensão **Live Server** para abrir o arquivo `index.html`. Isso inicia um servidor HTTP local adequado para os módulos ES6.

Depois, abra o endereço fornecido pelo servidor, normalmente:

```text
http://localhost:5500
```

## Testes

Os testes do motor de cálculo usam o Node.js:

```bash
npm test
```

O projeto também possui uma suíte offline em PowerShell para validar as regras principais sem depender da API.

## Tecnologias

- HTML5
- CSS3 responsivo
- JavaScript moderno com ES Modules
- API pública do AODP
- `localStorage` para preferências e ajustes de preços
- Node.js para testes automatizados

## Estrutura

```text
index.html              Interface principal
src/css/styles.css      Estilos responsivos
src/js/app.js           Controle da aplicação e renderização
src/js/api.js           Integração com a AODP
src/js/database.js      Receitas, valores e bônus regionais
src/js/engine.js        Fórmulas puras de cálculo
src/js/store.js         Preferências e preços personalizados
tests/                  Testes do motor de cálculo
docs/                   Regras, arquitetura, API e UX
```

## Estado do projeto

O módulo de **Refino** está disponível e utiliza dados reais de mercado. O módulo de **Crafting** aparece na interface como uma funcionalidade planejada para uma próxima etapa.

## Documentação

- [Regras de negócio](docs/business-rules.md)
- [Arquitetura](docs/architecture.md)
- [Contrato da API](docs/api-contract.md)
- [Diretrizes de UI/UX](docs/ui-ux.md)
