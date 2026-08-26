/**
 * Motor de Cálculos (Calculadora de Refino) - Albion Calc
 * 
 * Contém funções puras responsáveis por calcular RRR, custos de insumos,
 * taxas de uso de estação e lucros líquidos.
 */

import { BONUS_REFINO_CIDADES, TAXAS_RRR } from './database.js';

/**
 * Determina a fração de RRR (Taxa de Retorno de Recursos) correta
 * @param {string} resourceType Tipo do recurso (ORE, WOOD, HIDE, FIBER, STONE)
 * @param {string} city Nome da cidade (ex: Bridgewatch)
 * @param {boolean} usarFoco Se o usuário está usando Foco
 * @returns {number} Fração de RRR (entre 0 e 1)
 */
export function determineRRR(resourceType, city, usarFoco) {
  const bonusRecurso = BONUS_REFINO_CIDADES[city];
  const temBonus = (bonusRecurso === resourceType);

  if (temBonus) {
    return usarFoco ? TAXAS_RRR.COM_BONUS.COM_FOCO : TAXAS_RRR.COM_BONUS.SEM_FOCO;
  } else {
    return usarFoco ? TAXAS_RRR.SEM_BONUS.COM_FOCO : TAXAS_RRR.SEM_BONUS.SEM_FOCO;
  }
}

/**
 * Calcula o custo efetivo do insumo deduzindo o retorno de recursos (RRR)
 * @param {number} preco Preço unitário do insumo
 * @param {number} rrr Fator RRR (ex: 0.367)
 * @returns {number} Custo ajustado pelo retorno
 */
export function applyRRR(preco, rrr) {
  if (preco < 0) return 0;
  return preco * (1 - rrr);
}

/**
 * Calcula a quantidade de nutrição consumida com base no valor interno do item (Item Value)
 * @param {number} itemValue Valor interno do item (Item Value)
 * @returns {number} Quantidade de nutrição consumida
 */
export function calcNutrition(itemValue) {
  if (itemValue < 0) return 0;
  return itemValue * 0.1125;
}

/**
 * Calcula o custo de nutrição (taxa de uso) arredondado em Prata
 * @param {number} itemValue Valor do item
 * @param {number} taxaEstacao Taxa em Prata cobrada por 100 de nutrição
 * @returns {number} Taxa de uso arredondada para o inteiro mais próximo
 */
export function calcNutritionCost(itemValue, taxaEstacao) {
  if (itemValue <= 0 || taxaEstacao <= 0) return 0;
  const nut = calcNutrition(itemValue);
  const custo = nut * (taxaEstacao / 100.0);
  return Math.round(custo);
}

/**
 * Calcula o lucro de refino de 1 unidade de recurso refinado
 * @param {number} precoRefinado Preço de venda do produto refinado
 * @param {number} taxaMercado Percentual total de taxa de mercado (ex: 0.065 para 6.5%)
 * @param {number} custoInsumoEfetivo Custo efetivo total do recurso bruto
 * @param {number} custoRefinadoPrevio Custo efetivo do recurso refinado de tier anterior (0 para T2)
 * @param {number} itemValue Valor do item refinado para fins de nutrição
 * @param {number} taxaEstacao Taxa cobrada por 100 de nutrição
 * @returns {number} Lucro líquido em Prata por unidade refinada
 */
export function calcProfit(
  precoRefinado, 
  taxaMercado, 
  custoInsumoEfetivo, 
  custoRefinadoPrevio, 
  itemValue, 
  taxaEstacao
) {
  const receitaLiquida = precoRefinado * (1 - taxaMercado);
  const custoLoja = calcNutritionCost(itemValue, taxaEstacao);
  const custoIngredientes = custoInsumoEfetivo + custoRefinadoPrevio;
  
  return receitaLiquida - custoIngredientes - custoLoja;
}
