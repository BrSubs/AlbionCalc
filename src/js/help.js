/**
 * Módulo de ajuda e conteúdos de explicação.
 *
 * Responsável por gerar os textos, fórmulas e exemplos usados nos
 * modais de custo unitário, lucro unitário e uso de foco.
 */

import { RECEITAS_REFINO, VALORES_ITENS, formatIntegerValue, getResourceLabels } from './database.js';
import { determineRRR, applyRRR, calcNutritionCost } from './engine.js';

export function buildCostUnitHelpContent({ activePreferences, lastBestRouteSummary, elements }) {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const formula = RECEITAS_REFINO[tier];
  const labels = getResourceLabels(resource);
  const recursoBruto = labels.bruto;
  const recursoRefinado = labels.refinado;
  const custoBrutoLabel = `custo do ${labels.brutoPlural.toLowerCase()}`;
  const custoAnteriorLabel = tier > 2 ? `custo do ${labels.anterior.toLowerCase()}` : null;

  const description = `O custo unitário representa o gasto total para produzir 1 ${recursoRefinado.toLowerCase()} do tier ${tier}. Ele é um somatório do custo dos insumos multiplicado pelo valor complementar de RRR e acrecido à taxa de refino unitário.`;

  const truFormula = 'TRU = valor do item × 0,1125 × (taxa da refinaria ÷ 100)';
  const custoUnitarioFormula = tier > 2
    ? `Custo unitário = (n × ${custoBrutoLabel} t${tier} + ${custoAnteriorLabel}) × (1 − RRR) + TRU`
    : `Custo unitário = (n × ${custoBrutoLabel} t${tier}) × (1 − RRR) + TRU`;

  const steps = [
    'TRU = taxa de refino unitário, arredondada para o inteiro mais próximo.',
    'RRR = Resource Return Rate; varia pela cidade e pelo bônus de refino.',
    `n = número de ${recursoBruto.toLowerCase()} usado no refino do tier ${tier}.`,
    'O valor do RRR reduz o custo efetivo dos insumos antes de somar a taxa de refino.'
  ];

  let exampleText = 'Exemplo base: use a melhor rota do recurso e do tier atual para ver a conta em ação.';

  if (lastBestRouteSummary) {
    const itemValue = VALORES_ITENS[tier]?.[lastBestRouteSummary.encantamento ?? 0] ?? 0;
    const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;
    const valorTru = calcNutritionCost(itemValue, taxaEstacao);
    const custoBrutoEfeito = applyRRR(lastBestRouteSummary.precoBruto * formula.bruto, lastBestRouteSummary.rrr ?? 0);
    const custoPrevioEfeito = lastBestRouteSummary.precoPrevio > 0 && formula.refinadoAnterior
      ? applyRRR(lastBestRouteSummary.precoPrevio * formula.refinadoAnterior, lastBestRouteSummary.rrr ?? 0)
      : 0;
    const custoUnitarioExemplo = custoBrutoEfeito + custoPrevioEfeito + valorTru;
    const rrrPercentual = ((lastBestRouteSummary.rrr ?? 0) * 100).toFixed(1);
    const truTexto = String(Math.round(Number(valorTru) || 0));

    const formulaExemplo = formula.refinadoAnterior
      ? `(${formula.bruto} × ${formatIntegerValue(lastBestRouteSummary.precoBruto)} + ${formula.refinadoAnterior} × ${formatIntegerValue(lastBestRouteSummary.precoPrevio)}) × (1 − ${rrrPercentual}%) + ${truTexto}`
      : `(${formula.bruto} × ${formatIntegerValue(lastBestRouteSummary.precoBruto)}) × (1 − ${rrrPercentual}%) + ${truTexto}`;

    exampleText = `Exemplo em ${lastBestRouteSummary.refinoCidade}: ${formulaExemplo} = ${formatIntegerValue(custoUnitarioExemplo)} Silver.`;
  }

  if (elements.helpModalDescription) elements.helpModalDescription.textContent = description;
  if (elements.helpModalFormula) {
    elements.helpModalFormula.innerHTML = `${truFormula}<br>${custoUnitarioFormula}`;
  }
  if (elements.helpModalExample) {
    elements.helpModalExample.textContent = exampleText;
  }
  if (elements.helpModalSteps) {
    elements.helpModalSteps.innerHTML = steps.map(step => `<li>${step}</li>`).join('');
  }
}

export function buildProfitUnitHelpContent({ activePreferences, lastBestRouteSummary, elements }) {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const formula = RECEITAS_REFINO[tier];
  const labels = getResourceLabels(resource);
  const recursoRefinado = labels.refinado;

  const description = `O lucro unitário mostra o ganho líquido por 1 ${recursoRefinado.toLowerCase()} vendido depois de pagar o custo dos insumos e a taxa de refino.`;
  const formulaText = 'Lucro unitário = preço de venda × (1 − taxa de mercado) − custo efetivo dos insumos − TRU';

  const steps = [
    'Receita líquida = preço de venda × (1 − taxa de mercado).',
    'Custo efetivo = custo do insumo bruto + custo do insumo anterior, já ajustado pelo RRR.',
    'TRU = valor do item × 0,1125 × (taxa da refinaria ÷ 100).',
    'Se o resultado for positivo, o refino é lucrativo para esse preço.'
  ];

  let exampleText = 'Exemplo base: use a melhor rota do recurso e do tier atual para ver o lucro em ação.';

  if (lastBestRouteSummary) {
    const itemValue = VALORES_ITENS[tier]?.[lastBestRouteSummary.encantamento ?? 0] ?? 0;
    const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;
    const taxaMercado = activePreferences.premium ? 0.065 : 0.105;
    const tru = calcNutritionCost(itemValue, taxaEstacao);
    const custoEfeito = (lastBestRouteSummary.custoTotal ?? 0);
    const receitaLiquida = lastBestRouteSummary.precoVenda * (1 - taxaMercado);
    const lucroExemplo = receitaLiquida - custoEfeito - tru;

    exampleText = `Exemplo em ${lastBestRouteSummary.refinoCidade}: ${formatIntegerValue(lastBestRouteSummary.precoVenda)} × (1 − ${((taxaMercado * 100)).toFixed(1)}%) − ${formatIntegerValue(custoEfeito)} − ${formatIntegerValue(tru)} = ${formatIntegerValue(lucroExemplo)} Silver.`;
  }

  if (elements.helpProfitModalDescription) elements.helpProfitModalDescription.textContent = description;
  if (elements.helpProfitModalFormula) elements.helpProfitModalFormula.textContent = formulaText;
  if (elements.helpProfitModalExample) elements.helpProfitModalExample.textContent = exampleText;
  if (elements.helpProfitModalSteps) {
    elements.helpProfitModalSteps.innerHTML = steps.map(step => `<li>${step}</li>`).join('');
  }
}

export function buildFocusHelpContent({ activePreferences, lastBestRouteSummary, elements }) {
  const description = 'Quando o foco está ativo, a taxa de retorno de recursos (RRR) da cidade aumenta. Isso reduz o custo efetivo dos insumos e pode alterar tanto o custo unitário quanto o lucro líquido do refino.';
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const formula = RECEITAS_REFINO[tier];
  const labels = getResourceLabels(resource);
  const cidadeRefino = lastBestRouteSummary?.refinoCidade || 'Thetford';
  const rrrSemFoco = determineRRR(resource, cidadeRefino, false);
  const rrrComFoco = determineRRR(resource, cidadeRefino, true);
  const custoBruto = lastBestRouteSummary ? lastBestRouteSummary.precoBruto * formula.bruto : 200;
  const custoPrevio = lastBestRouteSummary && formula.refinadoAnterior && lastBestRouteSummary.precoPrevio > 0
    ? lastBestRouteSummary.precoPrevio * formula.refinadoAnterior
    : 0;
  const itemValue = lastBestRouteSummary
    ? VALORES_ITENS[tier]?.[lastBestRouteSummary.encantamento ?? 0] ?? 0
    : VALORES_ITENS[tier]?.[0] ?? 0;
  const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;
  const tru = calcNutritionCost(itemValue, taxaEstacao);

  const custoSemFoco = (custoBruto + custoPrevio) * (1 - rrrSemFoco) + tru;
  const custoComFoco = (custoBruto + custoPrevio) * (1 - rrrComFoco) + tru;
  const diferenca = custoSemFoco - custoComFoco;

  const formulaText = tier > 2 && formula.refinadoAnterior
    ? `Custo unitário = (${formula.bruto} × custo do insumo + ${formula.refinadoAnterior} × custo anterior) × (1 − RRR) + TRU`
    : `Custo unitário = (${formula.bruto} × custo do insumo) × (1 − RRR) + TRU`;

  const exampleText = `
    <div class="focus-example-card">
      <div class="focus-example-title">Exemplo real em ${cidadeRefino}</div>
      <div class="focus-example-line"><span class="focus-example-label">Sem foco:</span> (${formula.bruto} × ${formatIntegerValue(custoBruto / formula.bruto)} + ${formatIntegerValue(custoPrevio)}) × (1 − ${(rrrSemFoco * 100).toFixed(1)}%) + ${formatIntegerValue(tru)} = ${formatIntegerValue(custoSemFoco)} Silver</div>
      <div class="focus-example-line"><span class="focus-example-label">Com foco:</span> (${formula.bruto} × ${formatIntegerValue(custoBruto / formula.bruto)} + ${formatIntegerValue(custoPrevio)}) × (1 − ${(rrrComFoco * 100).toFixed(1)}%) + ${formatIntegerValue(tru)} = ${formatIntegerValue(custoComFoco)} Silver</div>
      <div class="focus-example-result">O foco reduz o custo em <strong>${formatIntegerValue(diferenca)} Silver</strong> por unidade refinada.</div>
    </div>
  `;

  const steps = [
    'O foco aumenta o RRR na cidade onde o refino acontece.',
    'Como o RRR entra na fórmula do custo unitário, o custo efetivo dos insumos cai.',
    'Menor custo de insumo pode aumentar o lucro líquido por unidade refinada.',
    'Se a cidade não tiver bônus de refino, o ganho do foco ainda é relevante porque o RRR geral aumenta.'
  ];

  if (elements.helpFocusModalDescription) elements.helpFocusModalDescription.textContent = description;
  if (elements.helpFocusModalFormula) elements.helpFocusModalFormula.innerHTML = formulaText;
  if (elements.helpFocusModalExample) elements.helpFocusModalExample.innerHTML = exampleText;
  if (elements.helpFocusModalSteps) {
    elements.helpFocusModalSteps.innerHTML = steps.map(step => `<li>${step}</li>`).join('');
  }
}

export function openCostHelpModal(elements) {
  buildCostUnitHelpContent({ activePreferences: window.__albionCalcState?.preferences ?? {}, lastBestRouteSummary: window.__albionCalcState?.lastBestRouteSummary ?? null, elements });
  if (!elements.helpCostModal) return;
  elements.helpCostModal.classList.remove('hidden');
  elements.helpCostModal.setAttribute('aria-hidden', 'false');
}

export function closeCostHelpModal(elements) {
  if (!elements.helpCostModal) return;
  elements.helpCostModal.classList.add('hidden');
  elements.helpCostModal.setAttribute('aria-hidden', 'true');
}

export function openProfitHelpModal(elements) {
  buildProfitUnitHelpContent({ activePreferences: window.__albionCalcState?.preferences ?? {}, lastBestRouteSummary: window.__albionCalcState?.lastBestRouteSummary ?? null, elements });
  if (!elements.helpProfitModal) return;
  elements.helpProfitModal.classList.remove('hidden');
  elements.helpProfitModal.setAttribute('aria-hidden', 'false');
}

export function closeProfitHelpModal(elements) {
  if (!elements.helpProfitModal) return;
  elements.helpProfitModal.classList.add('hidden');
  elements.helpProfitModal.setAttribute('aria-hidden', 'true');
}

export function openFocusHelpModal(elements) {
  buildFocusHelpContent({ activePreferences: window.__albionCalcState?.preferences ?? {}, lastBestRouteSummary: window.__albionCalcState?.lastBestRouteSummary ?? null, elements });
  if (!elements.helpFocusModal) return;
  elements.helpFocusModal.classList.remove('hidden');
  elements.helpFocusModal.setAttribute('aria-hidden', 'false');
}

export function closeFocusHelpModal(elements) {
  if (!elements.helpFocusModal) return;
  elements.helpFocusModal.classList.add('hidden');
  elements.helpFocusModal.setAttribute('aria-hidden', 'true');
}

export function setupCostHelpModal(elements) {
  if (elements.helpCostOpenButton) {
    elements.helpCostOpenButton.addEventListener('click', () => openCostHelpModal(elements));
  }

  if (elements.helpCostCloseButton) {
    elements.helpCostCloseButton.addEventListener('click', () => closeCostHelpModal(elements));
  }

  if (elements.helpCostModal) {
    elements.helpCostModal.addEventListener('click', (event) => {
      if (event.target === elements.helpCostModal) {
        closeCostHelpModal(elements);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpCostModal.classList.contains('hidden')) {
        closeCostHelpModal(elements);
      }
    });
  }
}

export function setupProfitHelpModal(elements) {
  if (elements.helpProfitOpenButton) {
    elements.helpProfitOpenButton.addEventListener('click', () => openProfitHelpModal(elements));
  }

  if (elements.helpProfitCloseButton) {
    elements.helpProfitCloseButton.addEventListener('click', () => closeProfitHelpModal(elements));
  }

  if (elements.helpProfitModal) {
    elements.helpProfitModal.addEventListener('click', (event) => {
      if (event.target === elements.helpProfitModal) {
        closeProfitHelpModal(elements);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpProfitModal.classList.contains('hidden')) {
        closeProfitHelpModal(elements);
      }
    });
  }
}

export function setupFocusHelpModal(elements) {
  if (elements.helpFocusOpenButton) {
    elements.helpFocusOpenButton.addEventListener('click', () => openFocusHelpModal(elements));
  }

  if (elements.helpFocusCloseButton) {
    elements.helpFocusCloseButton.addEventListener('click', () => closeFocusHelpModal(elements));
  }

  if (elements.helpFocusModal) {
    elements.helpFocusModal.addEventListener('click', (event) => {
      if (event.target === elements.helpFocusModal) {
        closeFocusHelpModal(elements);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpFocusModal.classList.contains('hidden')) {
        closeFocusHelpModal(elements);
      }
    });
  }
}
