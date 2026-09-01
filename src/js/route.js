/**
 * Módulo responsável por avaliar a melhor rota de refino.
 *
 * Analisa todas as cidades candidatas, compara custos efetivos e retorna
 * a combinação de compra, refino e venda com maior vantagem.
 */

import { VALORES_ITENS, RECEITAS_REFINO, getResourceLabels } from './database.js';
import { determineRRR, applyRRR, calcNutritionCost, calcProfit } from './engine.js';

export function renderBestRoute({ rotas, activePreferences, elements }) {
  if (!Array.isArray(rotas) || rotas.length === 0) {
    if (elements?.decisionText) {
      elements.decisionText.innerText = 'Por favor, selecione ao menos uma cidade nas configurações.';
    }
    return null;
  }

  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const itemValues = VALORES_ITENS[tier];
  const formula = RECEITAS_REFINO[tier];

  const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;
  const taxaMercado = activePreferences.premium ? 0.065 : 0.105;

  const tiposUnicos = [...new Set(rotas.map(r => r.recurso))];
  let melhorGeral = null;

  tiposUnicos.forEach(tipo => {
    const rotasDoTipo = rotas.filter(r => r.recurso === tipo);
    const indexEncantamento = Number(tipo.split('.')[1]);
    const valorItemRefinado = itemValues[indexEncantamento];

    let melhorPrecoBruto = null;
    let menorPrecoBrutoUnitario = Infinity;

    let melhorPrecoPrevio = null;
    let menorPrecoPrevioUnitario = Infinity;

    rotasDoTipo.forEach(r => {
      if (r.precoBruto > 0 && r.precoBruto < menorPrecoBrutoUnitario) {
        menorPrecoBrutoUnitario = r.precoBruto;
        melhorPrecoBruto = r;
      }

      if (r.refinadoAnteriorId && r.precoPrevio > 0 && r.precoPrevio < menorPrecoPrevioUnitario) {
        menorPrecoPrevioUnitario = r.precoPrevio;
        melhorPrecoPrevio = r;
      }
    });

    if (!melhorPrecoBruto) return;

    const compraCidadePrevio = melhorPrecoPrevio ? melhorPrecoPrevio.cidade : null;

    let melhorVenda = null;
    let maiorPrecoVenda = -Infinity;

    rotasDoTipo.forEach(r => {
      if (r.precoVenda > maiorPrecoVenda) {
        maiorPrecoVenda = r.precoVenda;
        melhorVenda = r;
      }
    });

    if (!melhorVenda) return;

    rotasDoTipo.forEach(candidataRefino => {
      const rrrCidade = determineRRR(resource, candidataRefino.cidade, activePreferences.usarFoco);

      const custoBrutoEfetivo = applyRRR(melhorPrecoBruto.precoBruto * formula.bruto, rrrCidade);
      const custoPrevioEfetivo = melhorPrecoPrevio
        ? applyRRR(melhorPrecoPrevio.precoPrevio * formula.refinadoAnterior, rrrCidade)
        : 0;

      const custoTotalInsumos = custoBrutoEfetivo + custoPrevioEfetivo;

      const lucroTransporte = calcProfit(
        melhorVenda.precoVenda,
        taxaMercado,
        custoBrutoEfetivo,
        custoPrevioEfetivo,
        valorItemRefinado,
        taxaEstacao
      );

      const margemTransporte = custoTotalInsumos > 0
        ? (lucroTransporte / custoTotalInsumos) * 100
        : 0;

      const priorizaLucro = Boolean(activePreferences.priorizarLucroLiquido);
      const deveSubstituirMelhor = !melhorGeral
        || (priorizaLucro
          ? lucroTransporte > melhorGeral.lucroTransporte
          : margemTransporte > melhorGeral.margemTransporte)
        || (!priorizaLucro
          ? Math.abs(margemTransporte - melhorGeral.margemTransporte) < 0.0001 && lucroTransporte > melhorGeral.lucroTransporte
          : Math.abs(lucroTransporte - melhorGeral.lucroTransporte) < 0.0001 && margemTransporte > melhorGeral.margemTransporte);

      if (deveSubstituirMelhor) {
        melhorGeral = {
          tipo,
          compraCidade: melhorPrecoBruto.cidade,
          compraCidadePrevio,
          refinoCidade: candidataRefino.cidade,
          vendaCidade: melhorVenda.cidade,
          lucroTransporte,
          margemTransporte,
          custoInsumo: custoTotalInsumos,
          precoVenda: melhorVenda.precoVenda,
          precoCompraBruta: melhorPrecoBruto.precoBruto,
          precoCompraPrevio: melhorPrecoPrevio ? melhorPrecoPrevio.precoPrevio : 0
        };
      }
    });
  });

  if (!melhorGeral || melhorGeral.lucroTransporte <= 0) {
    if (elements?.decisionText) {
      elements.decisionText.innerText = 'Nenhuma rota de transporte lucrativa foi encontrada no momento com os preços ativos.';
    }
    return null;
  }

  const tipoRefino = melhorGeral.tipo;
  const indexEncantamento = Number(tipoRefino.split('.')[1]);
  const itemValue = VALORES_ITENS[tier]?.[indexEncantamento] ?? 0;
  const rrrCidade = determineRRR(resource, melhorGeral.refinoCidade, activePreferences.usarFoco);
  const custoBruto = applyRRR(melhorGeral.precoCompraBruta * formula.bruto, rrrCidade);
  const custoPrevio = melhorGeral.precoCompraPrevio > 0 && formula.refinadoAnterior
    ? applyRRR(melhorGeral.precoCompraPrevio * formula.refinadoAnterior, rrrCidade)
    : 0;
  const tru = calcNutritionCost(itemValue, taxaEstacao);

  const summary = {
    rrr: rrrCidade,
    refinoCidade: melhorGeral.refinoCidade,
    precoBruto: melhorGeral.precoCompraBruta,
    precoPrevio: melhorGeral.precoCompraPrevio,
    precoVenda: melhorGeral.precoVenda,
    encantamento: indexEncantamento,
    custoUnitarioExemplo: custoBruto + custoPrevio + tru,
    custoTotal: melhorGeral.custoInsumo,
    n: formula.bruto,
    resource,
    tier
  };

  const labels = getResourceLabels(resource);
  const itemAtual = `${labels.bruto} T${tier}.${indexEncantamento}`;
  const prevTier = tier - 1;
  const anteriorEnc = tier >= 5 ? indexEncantamento : 0;
  const itemAnterior = `${labels.refinado} T${prevTier}.${anteriorEnc}`;

  const compraRawText = melhorGeral.compraCidadePrevio && melhorGeral.precoCompraPrevio > 0 && formula.refinadoAnterior
    ? `🛒 Compre ${itemAtual} em <strong>${melhorGeral.compraCidade}</strong> e ${itemAnterior} em <strong>${melhorGeral.compraCidadePrevio}</strong><br>`
    : `🛒 Compre ${itemAtual} em <strong>${melhorGeral.compraCidade}</strong><br>`;

  if (elements?.decisionText) {
    elements.decisionText.innerHTML = `
      Para o recurso <strong>T${melhorGeral.tipo}</strong>:<br>
      ${compraRawText}
      🔨 Refine em <strong>${melhorGeral.refinoCidade}</strong> (para um custo efetivo aproximado de <span class="focus-gold">${Math.round(melhorGeral.custoInsumo).toLocaleString('pt-BR')} Silver</span> por refino.)<br>
      💰 Venda em <strong>${melhorGeral.vendaCidade}</strong> por <span class="focus-gold">${melhorGeral.precoVenda.toLocaleString('pt-BR')} Silver</span>.<br>
      🔥 Margem Esperada: <strong><span style="color: var(--color-profit);">${melhorGeral.margemTransporte.toFixed(1)}%</span></strong>
      (Lucro Líquido: <strong><span style="color: var(--color-profit);">+${Math.round(melhorGeral.lucroTransporte).toLocaleString('pt-BR')} Silver</span></strong> por refinado).
    `;
  }

  return summary;
}
