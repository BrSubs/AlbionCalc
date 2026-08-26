/**
 * Banco de Dados Estático do Albion Calc
 * 
 * Contém dados estruturados sobre receitas de refino, Item Value de recursos e 
 * bônus regionais de cidades para cálculo da RRR e nutrição.
 */

// 1. Receitas de Refino (Qtd de recursos brutos e refinados anteriores necessários)
export const RECEITAS_REFINO = {
  2: { bruto: 1, refinadoAnterior: 0 },
  3: { bruto: 2, refinadoAnterior: 1 },
  4: { bruto: 2, refinadoAnterior: 1 },
  5: { bruto: 3, refinadoAnterior: 1 },
  6: { bruto: 4, refinadoAnterior: 1 },
  7: { bruto: 5, refinadoAnterior: 1 },
  8: { bruto: 5, refinadoAnterior: 1 }
};

// 2. Valor do Item (Item Value) dos recursos refinados por Tier e Encantamento (.0 a .4)
export const VALORES_ITENS = {
  // Tier: [ .0, .1, .2, .3, .4 ]
  2: [2, 0, 0, 0, 0],
  3: [8, 0, 0, 0, 0],
  4: [16, 32, 64, 128, 256],
  5: [32, 64, 128, 256, 512],
  6: [64, 128, 256, 512, 1024],
  7: [128, 256, 512, 1024, 2048],
  8: [256, 512, 1024, 2048, 4096]
};

// 3. Mapeamento de Recursos com bônus de refino por cidade
export const BONUS_REFINO_CIDADES = {
  "Bridgewatch": "STONE",     // Bloco / Pedra
  "Lymhurst": "FIBER",       // Tecido / Fibra
  "Fort Sterling": "WOOD",           // Tábua / Tronco
  "Thetford": "ORE",            // Barra / Minério
  "Martlock": "HIDE",           // Couro / Pelego
  "Caerleon": "NONE",            // Sem bônus de refino
  "Brecilien": "NONE"            // Sem bônus de refino
};

// 4. Taxas de Retorno de Recursos (RRR) Padrão
export const TAXAS_RRR = {
  COM_BONUS: {
    SEM_FOCO: 0.367, // 36.7%
    COM_FOCO: 0.539  // 53.9%
  },
  SEM_BONUS: {
    SEM_FOCO: 0.152, // 15.2%
    COM_FOCO: 0.439  // 43.9%
  }
};

// 5. IDs e Nomes Internos dos Itens para busca na API
export const RESOURCE_TYPES = {
  ORE: {
    name: "Minério / Barra de Metal",
    bruto_prefix: "T{tier}_ORE",
    refinado_prefix: "T{tier}_METALBAR"
  },
  WOOD: {
    name: "Tronco / Tábua",
    bruto_prefix: "T{tier}_WOOD",
    refinado_prefix: "T{tier}_PLANKS"
  },
  HIDE: {
    name: "Pelego / Couro",
    bruto_prefix: "T{tier}_HIDE",
    refinado_prefix: "T{tier}_LEATHER"
  },
  FIBER: {
    name: "Fibra / Tecido",
    bruto_prefix: "T{tier}_FIBER",
    refinado_prefix: "T{tier}_CLOTH"
  },
  STONE: {
    name: "Pedra / Bloco de Pedra",
    bruto_prefix: "T{tier}_ROCK",
    refinado_prefix: "T{tier}_STONEBLOCK"
  }
};
