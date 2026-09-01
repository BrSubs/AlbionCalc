/**
 * Controlador Principal - Albion Calc
 * 
 * Conecta a interface gráfica (HTML/CSS), a camada de dados (database.js),
 * o motor de cálculo (engine.js), a camada de API (api.js) e o gerenciador de estado (store.js).
 */

import { RESOURCE_TYPES, RECEITAS_REFINO, VALORES_ITENS, formatIntegerValue, getCostColumnLabels, getResourceLabels } from './database.js';
import { determineRRR, applyRRR, calcNutritionCost, calcProfit } from './engine.js';
import { fetchPrices, formatPriceAge } from './api.js';
import { getPreferences, savePreferences, getPriceOverrides, setPriceOverride, clearPriceOverrides } from './store.js';

// Cache em memória dos dados da API e overrides ativos
let apiDataCache = [];
let activePreferences = {};
let lastBestRouteSummary = null;

// Elementos DOM
const elements = {
  chkPremium: document.getElementById('chk-premium'),
  chkFocus: document.getElementById('chk-focus'),
  chkPriorizarLucro: document.getElementById('chk-priorizar-lucro'),
  txtTaxaEstacao: document.getElementById('txt-taxa-estacao'),
  recipeHoverCard: document.getElementById('recipe-hover-card'),
  recipeModal: document.getElementById('recipe-modal'),
  recipeModalClose: document.getElementById('recipe-modal-close'),
  recipeModalImage: document.getElementById('recipe-modal-image'),
  recipeModalItemName: document.getElementById('recipe-modal-item-name'),
  recipeModalTierNote: document.getElementById('recipe-modal-tier-note'),
  recipeModalIngredients: document.getElementById('recipe-modal-ingredients'),
  recipeModalFormula: document.getElementById('recipe-modal-formula'),
  recipeModalNote: document.getElementById('recipe-modal-note'),
  resourceSelector: document.getElementById('resource-selector'),
  tierSelector: document.getElementById('tier-selector'),
  enchantmentFilter: document.getElementById('enchantment-filter'),
  tableBody: document.getElementById('table-body'),
  decisionText: document.getElementById('decision-text'),
  btnResetPrices: document.getElementById('btn-reset-prices'),
  cityFilters: document.querySelectorAll('.city-filter'),
  helpCostModal: document.getElementById('cost-help-modal'),
  helpCostOpenButton: document.getElementById('help-cost-unitario'),
  helpCostCloseButton: document.getElementById('help-modal-close'),
  helpModalDescription: document.getElementById('help-modal-description'),
  helpModalFormula: document.getElementById('help-modal-formula'),
  helpModalExample: document.getElementById('help-modal-example'),
  helpModalSteps: document.getElementById('help-modal-steps'),
  helpProfitModal: document.getElementById('profit-help-modal'),
  helpProfitOpenButton: document.getElementById('help-profit-unitario'),
  helpProfitCloseButton: document.getElementById('profit-help-modal-close'),
  helpProfitModalDescription: document.getElementById('profit-help-modal-description'),
  helpProfitModalFormula: document.getElementById('profit-help-modal-formula'),
  helpProfitModalExample: document.getElementById('profit-help-modal-example'),
  helpProfitModalSteps: document.getElementById('profit-help-modal-steps'),
  helpFocusModal: document.getElementById('focus-help-modal'),
  helpFocusOpenButton: document.getElementById('help-focus-toggle'),
  helpFocusCloseButton: document.getElementById('focus-help-modal-close'),
  helpFocusModalDescription: document.getElementById('focus-help-modal-description'),
  helpFocusModalFormula: document.getElementById('focus-help-modal-formula'),
  helpFocusModalExample: document.getElementById('focus-help-modal-example'),
  helpFocusModalSteps: document.getElementById('focus-help-modal-steps')
};

// Inicialização ao carregar o documento
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('config-details').open = window.matchMedia('(min-width: 768px)').matches;
  activePreferences = getPreferences();
  applyPreferencesToUI();
  setupEventListeners();
  setupCostHelpModal();
  setupProfitHelpModal();
  setupFocusHelpModal();
  setupRecipeModal();
  buildCostUnitHelpContent();
  buildProfitUnitHelpContent();
  buildFocusHelpContent();
  loadAndRender();
});

// Carrega as preferências salvas e configura os inputs da UI
function applyPreferencesToUI() {
  elements.chkPremium.checked = activePreferences.premium;
  elements.chkFocus.checked = activePreferences.usarFoco;
  elements.chkPriorizarLucro.checked = Boolean(activePreferences.priorizarLucroLiquido);
  
  const currentResource = activePreferences.recursoAtivo;
  elements.txtTaxaEstacao.value = activePreferences.taxasEstacao[currentResource] ?? 500;

  // Botões de Recurso
  document.querySelectorAll('.res-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.res === activePreferences.recursoAtivo);
  });

  // Botões de Tier
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.tier) === activePreferences.tierAtivo);
  });

  const selectedEnchantments = Array.isArray(activePreferences.encantamentosSelecionados)
    ? activePreferences.encantamentosSelecionados
    : [];
  document.querySelectorAll('.enchantment-filter-input').forEach(input => {
    input.checked = selectedEnchantments.includes(Number(input.value));
  });

  // Checkboxes de Cidades
  elements.cityFilters.forEach(chk => {
    chk.checked = activePreferences.cidadesSelecionadas.includes(chk.value);
  });
}

// Configura os escutadores de eventos na interface
function setupEventListeners() {
  // Mudança de Recurso
  elements.resourceSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.res-btn');
    if (!btn) return;
    
    document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    activePreferences.recursoAtivo = btn.dataset.res;
    // Carrega taxa correspondente salva para este recurso
    elements.txtTaxaEstacao.value = activePreferences.taxasEstacao[activePreferences.recursoAtivo] ?? 500;
    
    updateStore();
    loadAndRender();
  });

  // Mudança de Tier
  elements.tierSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.tier-btn');
    if (!btn) return;
    
    document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    activePreferences.tierAtivo = Number(btn.dataset.tier);
    updateStore();
    loadAndRender();
  });

  // Filtro de encantamentos: sem seleção, exibe todos
  elements.enchantmentFilter.addEventListener('change', () => {
    activePreferences.encantamentosSelecionados = [...document.querySelectorAll('.enchantment-filter-input:checked')]
      .map(input => Number(input.value));
    updateStore();
    loadAndRender();
  });

  // Checkboxes e inputs simples
  elements.chkPremium.addEventListener('change', () => {
    activePreferences.premium = elements.chkPremium.checked;
    updateStore();
    renderCalculations();
  });

  elements.chkFocus.addEventListener('change', () => {
    activePreferences.usarFoco = elements.chkFocus.checked;
    updateStore();
    renderCalculations();
  });

  elements.chkPriorizarLucro.addEventListener('change', () => {
    activePreferences.priorizarLucroLiquido = elements.chkPriorizarLucro.checked;
    updateStore();
    renderCalculations();
  });

  elements.txtTaxaEstacao.addEventListener('input', () => {
    const val = Math.max(0, parseInt(elements.txtTaxaEstacao.value) || 0);
    activePreferences.taxasEstacao[activePreferences.recursoAtivo] = val;
    updateStore();
    renderCalculations();
  });

  // Filtros de Cidades
  elements.cityFilters.forEach(chk => {
    chk.addEventListener('change', () => {
      const ativas = [];
      elements.cityFilters.forEach(c => {
        if (c.checked) ativas.push(c.value);
      });
      activePreferences.cidadesSelecionadas = ativas;
      updateStore();
      loadAndRender();
    });
  });

  // Botão Reset
  elements.btnResetPrices.addEventListener('click', () => {
    clearPriceOverrides();
    loadAndRender();
  });
}

// Salva as configurações de tela atuais no LocalStorage
function updateStore() {
  savePreferences(activePreferences);
}

function buildRecipeData(resource, tier, enc) {
  const labels = getResourceLabels(resource);
  const formula = RECEITAS_REFINO[tier] ?? { bruto: 1, refinadoAnterior: 0 };
  const itemResultado = `${labels.refinado} T${tier}.${enc}`;
  const prevTier = tier - 1;
  const prevEnc = tier >= 5 ? enc : 0;
  const itemAnterior = tier > 2 ? `${labels.anterior} T${prevTier}.${prevEnc}` : null;

  const brutoName = `${labels.bruto} T${tier}.${enc}`;
  const ingredientes = [
    {
      name: brutoName,
      quantity: formula.bruto,
      isMain: true
    }
  ];

  if (tier > 2 && formula.refinadoAnterior) {
    ingredientes.push({
      name: itemAnterior,
      quantity: formula.refinadoAnterior,
      isMain: false
    });
  }

  const formulaText = tier > 2 && formula.refinadoAnterior
    ? `${formula.bruto} × ${labels.bruto} T${tier}.${enc} + ${formula.refinadoAnterior} × ${labels.anterior} T${prevTier}.${prevEnc} = 1 × ${labels.refinado} T${tier}.${enc}`
    : `${formula.bruto} × ${labels.bruto} T${tier}.${enc} = 1 × ${labels.refinado} T${tier}.${enc}`;

  const note = tier >= 5
    ? `Para tier 5+, o item do tier anterior precisa usar o mesmo encantamento equivalente do refinado atual.`
    : 'No tier atual, o insumo anterior é usado sem encantar ou com o equivalente do mesmo tier anterior quando aplicável.';

  return {
    resource,
    tier,
    enc,
    itemResultado,
    brutoName,
    itemAnterior,
    ingredientes,
    formulaText,
    note,
    itemId: buildEncantadoId(RESOURCE_TYPES[resource].refinado_prefix.replace('{tier}', tier), enc)
  };
}

function renderRecipeHoverCard(event, resource, tier, enc) {
  const card = elements.recipeHoverCard;
  if (!card) return;

  const data = buildRecipeData(resource, tier, enc);
  const itemUrl = `https://render.albiononline.com/v1/item/${data.itemId}.png?size=40`;

  card.innerHTML = `
    <div class="recipe-hover-title">Receita</div>
    <div class="recipe-hover-item">
      <img src="${itemUrl}" alt="${data.itemResultado}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'40\' height=\'40\' fill=\'%23232329\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23fff\' font-size=\'10\'>T${tier}.${enc}</text></svg>'">
      <strong>${data.itemResultado}</strong>
    </div>
    <ul class="recipe-hover-list">
      ${data.ingredientes.map(item => `<li><span>${item.quantity} ×</span> ${item.name}</li>`).join('')}
    </ul>
  `;

  const rect = event.target.getBoundingClientRect();
  card.style.left = `${Math.min(window.innerWidth - 220, rect.right + 14)}px`;
  card.style.top = `${Math.max(16, rect.top - 8)}px`;
  card.classList.remove('hidden');
}

function hideRecipeHoverCard() {
  if (elements.recipeHoverCard) {
    elements.recipeHoverCard.classList.add('hidden');
  }
}

function openRecipeModal(resource, tier, enc) {
  const recipe = buildRecipeData(resource, tier, enc);
  if (!elements.recipeModal || !elements.recipeModalImage || !elements.recipeModalIngredients || !elements.recipeModalFormula || !elements.recipeModalNote || !elements.recipeModalItemName || !elements.recipeModalTierNote) return;

  const itemUrl = `https://render.albiononline.com/v1/item/${recipe.itemId}.png?size=80`;
  elements.recipeModalImage.src = itemUrl;
  elements.recipeModalImage.alt = recipe.itemResultado;
  elements.recipeModalItemName.textContent = recipe.itemResultado;
  elements.recipeModalTierNote.textContent = `Tier ${tier} • Encantamento ${enc}`;
  elements.recipeModalIngredients.innerHTML = recipe.ingredientes.map(item => `<li><span class="recipe-qty">${item.quantity} ×</span> ${item.name}</li>`).join('');
  elements.recipeModalFormula.textContent = recipe.formulaText;
  elements.recipeModalNote.textContent = recipe.note;

  elements.recipeModal.classList.remove('hidden');
  elements.recipeModal.setAttribute('aria-hidden', 'false');
}

function closeRecipeModal() {
  if (!elements.recipeModal) return;
  elements.recipeModal.classList.add('hidden');
  elements.recipeModal.setAttribute('aria-hidden', 'true');
}

function setupRecipeInteraction() {
  if (!elements.tableBody) return;

  elements.tableBody.querySelectorAll('.item-icon').forEach(icon => {
    icon.addEventListener('mouseenter', (event) => {
      const resource = event.target.dataset.resource;
      const tier = Number(event.target.dataset.tier);
      const enc = Number(event.target.dataset.enc);
      if (!resource || !tier && tier !== 0) return;
      renderRecipeHoverCard(event, resource, tier, enc);
    });

    icon.addEventListener('mouseleave', hideRecipeHoverCard);
    icon.addEventListener('click', (event) => {
      const resource = event.target.dataset.resource;
      const tier = Number(event.target.dataset.tier);
      const enc = Number(event.target.dataset.enc);
      if (!resource || Number.isNaN(tier) || Number.isNaN(enc)) return;
      openRecipeModal(resource, tier, enc);
    });
  });
}

function buildCostUnitHelpContent() {
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

  const helpDescription = document.getElementById('help-modal-description');
  const helpFormula = document.getElementById('help-modal-formula');
  const helpExample = document.getElementById('help-modal-example');
  const helpSteps = document.getElementById('help-modal-steps');

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

  if (helpDescription) helpDescription.textContent = description;
  if (helpFormula) {
    helpFormula.innerHTML = `${truFormula}<br>${custoUnitarioFormula}`;
  }
  if (helpExample) {
    helpExample.textContent = exampleText;
  }
  if (helpSteps) {
    helpSteps.innerHTML = steps.map(step => `<li>${step}</li>`).join('');
  }
}

function buildProfitUnitHelpContent() {
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

function buildFocusHelpContent() {
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

function openCostHelpModal() {
  buildCostUnitHelpContent();
  if (!elements.helpCostModal) return;
  elements.helpCostModal.classList.remove('hidden');
  elements.helpCostModal.setAttribute('aria-hidden', 'false');
}

function closeCostHelpModal() {
  if (!elements.helpCostModal) return;
  elements.helpCostModal.classList.add('hidden');
  elements.helpCostModal.setAttribute('aria-hidden', 'true');
}

function openProfitHelpModal() {
  buildProfitUnitHelpContent();
  if (!elements.helpProfitModal) return;
  elements.helpProfitModal.classList.remove('hidden');
  elements.helpProfitModal.setAttribute('aria-hidden', 'false');
}

function closeProfitHelpModal() {
  if (!elements.helpProfitModal) return;
  elements.helpProfitModal.classList.add('hidden');
  elements.helpProfitModal.setAttribute('aria-hidden', 'true');
}

function openFocusHelpModal() {
  buildFocusHelpContent();
  if (!elements.helpFocusModal) return;
  elements.helpFocusModal.classList.remove('hidden');
  elements.helpFocusModal.setAttribute('aria-hidden', 'false');
}

function closeFocusHelpModal() {
  if (!elements.helpFocusModal) return;
  elements.helpFocusModal.classList.add('hidden');
  elements.helpFocusModal.setAttribute('aria-hidden', 'true');
}

function setupCostHelpModal() {
  if (elements.helpCostOpenButton) {
    elements.helpCostOpenButton.addEventListener('click', openCostHelpModal);
  }

  if (elements.helpCostCloseButton) {
    elements.helpCostCloseButton.addEventListener('click', closeCostHelpModal);
  }

  if (elements.helpCostModal) {
    elements.helpCostModal.addEventListener('click', (event) => {
      if (event.target === elements.helpCostModal) {
        closeCostHelpModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpCostModal.classList.contains('hidden')) {
        closeCostHelpModal();
      }
    });
  }
}

function setupProfitHelpModal() {
  if (elements.helpProfitOpenButton) {
    elements.helpProfitOpenButton.addEventListener('click', openProfitHelpModal);
  }

  if (elements.helpProfitCloseButton) {
    elements.helpProfitCloseButton.addEventListener('click', closeProfitHelpModal);
  }

  if (elements.helpProfitModal) {
    elements.helpProfitModal.addEventListener('click', (event) => {
      if (event.target === elements.helpProfitModal) {
        closeProfitHelpModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpProfitModal.classList.contains('hidden')) {
        closeProfitHelpModal();
      }
    });
  }
}

function setupFocusHelpModal() {
  if (elements.helpFocusOpenButton) {
    elements.helpFocusOpenButton.addEventListener('click', openFocusHelpModal);
  }

  if (elements.helpFocusCloseButton) {
    elements.helpFocusCloseButton.addEventListener('click', closeFocusHelpModal);
  }

  if (elements.helpFocusModal) {
    elements.helpFocusModal.addEventListener('click', (event) => {
      if (event.target === elements.helpFocusModal) {
        closeFocusHelpModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.helpFocusModal.classList.contains('hidden')) {
        closeFocusHelpModal();
      }
    });
  }
}

function setupRecipeModal() {
  if (elements.recipeModalClose) {
    elements.recipeModalClose.addEventListener('click', closeRecipeModal);
  }

  if (elements.recipeModal) {
    elements.recipeModal.addEventListener('click', (event) => {
      if (event.target === elements.recipeModal) {
        closeRecipeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.recipeModal.classList.contains('hidden')) {
        closeRecipeModal();
      }
    });
  }
}

// app.js
function buildEncantadoId(baseId, enc) {
  return enc === 0 ? baseId : `${baseId}_LEVEL${enc}@${enc}`;
}

// Retorna a lista de IDs de itens para consultar a API
function buildItemIds() {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const config = RESOURCE_TYPES[resource];
  const ids = [];
  const selectedEnchantments = Array.isArray(activePreferences.encantamentosSelecionados)
    ? activePreferences.encantamentosSelecionados
    : [];
  const enchantments = selectedEnchantments.length > 0
    ? selectedEnchantments
    : [0, 1, 2, 3, 4];
  const validEnchantments = enchantments.filter(enc => VALORES_ITENS[tier]?.[enc] > 0);

  const brutoBase = config.bruto_prefix.replace('{tier}', tier);
  validEnchantments.forEach(enc => ids.push(buildEncantadoId(brutoBase, enc)));

  if (tier > 2) {
    const tierAnterior = tier - 1;
    const prevBase = config.refinado_prefix.replace('{tier}', tierAnterior);
    const prevEnchantments = tierAnterior >= 4
      ? validEnchantments
      : (validEnchantments.length > 0 ? [0] : []);
    prevEnchantments.forEach(enc => ids.push(buildEncantadoId(prevBase, enc)));
  }

  const refinadoBase = config.refinado_prefix.replace('{tier}', tier);
  validEnchantments.forEach(enc => ids.push(buildEncantadoId(refinadoBase, enc)));

  return [...new Set(ids)];
}

// Busca os preços na API e renderiza a tabela
async function loadAndRender() {
  const itemIds = buildItemIds();
  const cidades = activePreferences.cidadesSelecionadas;

  // Renderiza Skeletons (loaders) nas linhas da tabela enquanto baixa
  renderSkeletons();

  if (cidades.length === 0) {
    elements.tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhuma cidade selecionada como ativa.</td></tr>`;
    elements.decisionText.innerText = "Por favor, selecione ao menos uma cidade nas configurações.";
    return;
  }

  try {
    apiDataCache = await fetchPrices(itemIds, cidades);
    renderCalculations();
  } catch (error) {
    elements.tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--color-loss); padding: 20px;">Erro ao carregar dados da API. Você pode digitar os preços manualmente.</td></tr>`;
    elements.decisionText.innerText = "API do AODP indisponível. Preencha os valores desejados manualmente.";
    
    // Tenta montar linhas vazias para permitir edição manual sem quebrar
    renderEmptyLines();
  }
}

// Renderiza a estrutura da tabela vazia
function renderEmptyLines() {
  apiDataCache = []; // Limpa cache de API
  renderCalculations();
}

// Cria Skeletons visuais de carregamento
function renderSkeletons() {
  elements.tableBody.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="loading-skeleton" style="width: 80px;"></div></td>
      <td><div class="loading-skeleton" style="width: 70px;"></div></td>
      <td><div class="loading-skeleton" style="width: 50px;"></div></td>
      <td><div class="loading-skeleton" style="width: 50px;"></div></td>
      <td><div class="loading-skeleton" style="width: 50px;"></div></td>
      <td><div class="loading-skeleton" style="width: 60px;"></div></td>
      <td><div class="loading-skeleton" style="width: 60px;"></div></td>
    `;
    elements.tableBody.appendChild(tr);
  }
}

// Retorna o preço ativo para o cálculo (prioriza a sobrescrita manual, depois a API)
function getActivePrice(itemId, city, defaultValue = 0, source = "sell_price_min") {
  const overrides = getPriceOverrides();
  const overrideKey = `${itemId}_${city}`;
  
  if (overrides[overrideKey] !== undefined) {
    return overrides[overrideKey];
  }

  const record = apiDataCache.find(r => r.item_id === itemId && r.city === city);
  return record ? record[source] : defaultValue;
}

// Retorna os dados originais da API (para saber se o preço está nulo ou qual sua data)
function getApiRecord(itemId, city) {
  return apiDataCache.find(r => r.item_id === itemId && r.city === city);
}

function getPriceAgeClass(ageText) {
  if (ageText.endsWith('m')) return 'age-fresh';
  if (ageText.endsWith('h')) return 'age-stale';
  return 'age-old';
}

// Renderiza os cálculos e popula a tabela com dados reais e editáveis
function renderCalculations() {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const config = RESOURCE_TYPES[resource];
  const cidades = activePreferences.cidadesSelecionadas;
  const costLabels = getCostColumnLabels(resource);

  const headerBruto = document.getElementById('header-custo-bruto');
  const headerRefinado = document.getElementById('header-custo-refinado');
  if (headerBruto) headerBruto.textContent = costLabels.bruto;
  if (headerRefinado) headerRefinado.textContent = costLabels.refinado;
  
  const formula = RECEITAS_REFINO[tier];
  const itemValues = VALORES_ITENS[tier];
  const selectedEnchantments = Array.isArray(activePreferences.encantamentosSelecionados)
    ? activePreferences.encantamentosSelecionados
    : [];
  
  const taxaMercado = activePreferences.premium ? 0.065 : 0.105;
  const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;

  // ---- Guarda qual input estava focado ANTES de limpar a tabela ----
  // O innerHTML='' logo abaixo destrói o elemento focado; sem isso, o cursor
  // "pula" e a digitação parece travar a cada tecla.
  const activeEl = document.activeElement;
  let focoAnterior = null;
  if (activeEl && activeEl.classList && activeEl.classList.contains('price-input') && elements.tableBody.contains(activeEl)) {
    focoAnterior = {
      item: activeEl.dataset.item,
      city: activeEl.dataset.city,
      classe: [...activeEl.classList].find(c => c.endsWith('-input')), // bruto-input / prev-input / venda-input
      selectionStart: activeEl.selectionStart,
      selectionEnd: activeEl.selectionEnd
    };
  }
  
  elements.tableBody.innerHTML = '';
  
  // Guardará as rotas calculadas para determinar a melhor no Card de Decisão
  const rotasCalculadas = [];

  // Looping pelos 5 encantamentos (.0 a .4)
  for (let enc = 0; enc < 5; enc++) {
    const suffix = enc === 0 ? "" : `_LEVEL${enc}`;
    // DEPOIS (correto)
    const brutoBase = config.bruto_prefix.replace('{tier}', tier);
    const refinadoBase = config.refinado_prefix.replace('{tier}', tier);
    const brutoId = buildEncantadoId(brutoBase, enc);
    const refinadoId = buildEncantadoId(refinadoBase, enc);

    let refinadoAnteriorId = null;
    if (tier > 2) {
      const tierAnterior = tier - 1;
      const tierAnteriorSuportaEncante = tierAnterior >= 4; // T2/T3 só têm .0
      const encAnterior = tierAnteriorSuportaEncante ? enc : 0;
      refinadoAnteriorId = buildEncantadoId(
        config.refinado_prefix.replace('{tier}', tierAnterior),
        encAnterior
      );
    }
    
    const valorItemRefinado = itemValues[enc];
    
    // Ignora se for encantamento inexistente (T2 e T3 só têm .0)
    if (valorItemRefinado === 0) continue;
    if (selectedEnchantments.length > 0 && !selectedEnchantments.includes(enc)) continue;

    cidades.forEach(cidade => {
      // 1. Coleta preços das fontes de entrada
      const precoBruto = getActivePrice(brutoId, cidade, 0, "sell_price_min");
      const precoPrevio = refinadoAnteriorId ? getActivePrice(refinadoAnteriorId, cidade, 0, "sell_price_min") : 0;
      const precoVenda = getActivePrice(refinadoId, cidade, 0, "sell_price_min");
      
      const recordBruto = getApiRecord(brutoId, cidade);
      const recordPrevio = refinadoAnteriorId ? getApiRecord(refinadoAnteriorId, cidade) : null;
      const recordVenda = getApiRecord(refinadoId, cidade);

      // 2. Calcula as frações de RRR e custos efetivos
      const rrr = determineRRR(resource, cidade, activePreferences.usarFoco);
      const custoBrutoEfetivo = applyRRR(precoBruto * formula.bruto, rrr);
      const custoPrevioEfetivo = refinadoAnteriorId ? applyRRR(precoPrevio * formula.refinadoAnterior, rrr) : 0;
      
      // 3. Lucro líquido unitário
      const lucro = calcProfit(
        precoVenda,
        taxaMercado,
        custoBrutoEfetivo,
        custoPrevioEfetivo,
        valorItemRefinado,
        taxaEstacao
      );
      
      const custoEfetivoTotal = custoBrutoEfetivo + custoPrevioEfetivo;
      const custoUnitario = custoEfetivoTotal + calcNutritionCost(valorItemRefinado, taxaEstacao);
      const margemPercentual = custoEfetivoTotal > 0 ? (lucro / custoEfetivoTotal) * 100 : 0;

      // Armazena dados da rota para posterior avaliação no card de decisão
      rotasCalculadas.push({
        recurso: `${tier}.${enc}`,
        cidade,
        lucro,
        margemPercentual,
        precoBruto,
        precoPrevio,
        precoVenda,
        brutoId,
        refinadoId,
        refinadoAnteriorId
      });

      // 4. Cria a linha na tabela
      const tr = document.createElement('tr');
      
      // Coluna Item (Ícone oficial CDN + Nome)
      const nomeItem = `${resource} T${tier}.${enc}`;
      const cdnUrl = `https://render.albiononline.com/v1/item/${refinadoId}.png?size=40`;
      
      const ageTextBruto = recordBruto ? formatPriceAge(recordBruto.sell_price_min_date) : "Sem dados";
      const ageTextPrevio = recordPrevio ? formatPriceAge(recordPrevio.sell_price_min_date) : "Sem dados";
      const ageTextVenda = recordVenda ? formatPriceAge(recordVenda.sell_price_min_date) : "Sem dados";

      tr.innerHTML = `
        <td>
          <div class="item-cell">
            <img class="item-icon" src="${cdnUrl}" alt="${nomeItem}" data-resource="${resource}" data-tier="${tier}" data-enc="${enc}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'40\' height=\'40\' fill=\'%23232329\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23fff\' font-size=\'10\'>T${tier}.${enc}</text></svg>'">
            <span>T${tier}.${enc}</span>
          </div>
        </td>
        <td class="city-cell">${cidade}</td>
        
        <!-- Célula de entrada bruta editável -->
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input bruto-input" 
                 data-item="${brutoId}" data-city="${cidade}" 
                 value="${precoBruto > 0 ? formatIntegerValue(precoBruto) : ''}" placeholder="0">
             <span class="price-age ${getPriceAgeClass(ageTextBruto)}">${ageTextBruto}</span>
        </td>

        <!-- Célula de entrada refinada anterior (vazia se T2) -->
        <td class="price-cell">
          ${refinadoAnteriorId ? `
            <input type="text" inputmode="numeric" class="price-input prev-input" 
                   data-item="${refinadoAnteriorId}" data-city="${cidade}" 
                   value="${precoPrevio > 0 ? formatIntegerValue(precoPrevio) : ''}" placeholder="0">
                 <span class="price-age ${getPriceAgeClass(ageTextPrevio)}">${ageTextPrevio}</span>
          ` : '<span style="color:#555;">-</span>'}
        </td>

        <!-- Célula de venda editável com badge de idade do preço -->
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input venda-input" 
                 data-item="${refinadoId}" data-city="${cidade}" 
                 value="${precoVenda > 0 ? formatIntegerValue(precoVenda) : ''}" placeholder="0">
             <span class="price-age ${getPriceAgeClass(ageTextVenda)}">${ageTextVenda}</span>
        </td>

        <!-- Custo total para produzir uma unidade refinada -->
        <td class="value-cell">
          ${Math.round(custoUnitario).toLocaleString('pt-BR')}
        </td>

        <!-- Célula de Lucro Líquido formatada em verde ou vermelho -->
        <td class="profit-cell ${lucro >= 0 ? 'profit-positive' : 'profit-negative'}">
          ${lucro >= 0 ? '+' : ''}${Math.round(lucro).toLocaleString('pt-BR')}
          <span class="percent-label">${margemPercentual.toFixed(1)}%</span>
        </td>
      `;

      elements.tableBody.appendChild(tr);
    });
  }

  // 5. Acopla os event listeners dinâmicos de digitação para sobrescrever preços na hora
  setupTableInputs();
  setupRecipeInteraction();

  // 6. Atualiza o card da melhor rota
  renderBestRoute(rotasCalculadas);

  // ---- Restaura o foco e a posição do cursor no input equivalente ----
  // Precisa vir DEPOIS de setupTableInputs(), já que é ali que os novos
  // inputs recebem seus listeners.
  if (focoAnterior) {
    const seletor = `.${focoAnterior.classe}[data-item="${CSS.escape(focoAnterior.item)}"][data-city="${CSS.escape(focoAnterior.city)}"]`;
    const novoInput = elements.tableBody.querySelector(seletor);
    if (novoInput) {
      novoInput.focus();
      try {
        novoInput.setSelectionRange(focoAnterior.selectionStart, focoAnterior.selectionEnd);
      } catch (err) {
        // type="number" em alguns navegadores (ex: Firefox) não suporta
        // setSelectionRange — ignora silenciosamente, o foco já foi restaurado
      }
    }
  }
}

// Captura as alterações manuais feitas diretamente na tabela de forma em tempo real
function setupTableInputs() {
  document.querySelectorAll('.price-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemId = e.target.dataset.item;
      const city = e.target.dataset.city;
      const rawValue = e.target.value;
      const cleanedValue = String(rawValue).replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
      const value = rawValue === '' ? null : Math.max(0, Number(cleanedValue) || 0);

      // Salva a alteração manual no estado persistente do LocalStorage
      setPriceOverride(itemId, city, value);

      // Recalcula imediatamente a tabela e o painel de melhor rota de forma fluida
      renderCalculations();
    });
  });
}

// Analisa os cálculos gerados e indica qual a melhor cidade para compra e venda
function renderBestRoute(rotas) {
  if (rotas.length === 0) {
    elements.decisionText.innerText = "Por favor, selecione ao menos uma cidade nas configurações.";
    return;
  }

  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const itemValues = VALORES_ITENS[tier];
  const formula = RECEITAS_REFINO[tier]; // formula.bruto = qtd de material bruto por refino, formula.refinadoAnterior = qtd do refinado do tier anterior

  const taxaEstacao = activePreferences.taxasEstacao[resource] ?? 500;
  const taxaMercado = activePreferences.premium ? 0.065 : 0.105;

  const tiposUnicos = [...new Set(rotas.map(r => r.recurso))];
  let melhorGeral = null;

  tiposUnicos.forEach(tipo => {
    const rotasDoTipo = rotas.filter(r => r.recurso === tipo);
    const indexEncantamento = Number(tipo.split('.')[1]);
    const valorItemRefinado = itemValues[indexEncantamento];

    // ---- PASSO 1: achar a cidade de COMPRA mais barata (preço bruto puro, sem RRR) ----
    // RRR é um bônus da cidade onde você REFINA, não de onde você compra o insumo.
    // Por isso a escolha da cidade de compra não deve levar RRR em conta.
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

    if (!melhorPrecoBruto) return; // sem cidade vendendo o insumo bruto, não dá pra montar rota

    const compraCidadePrevio = melhorPrecoPrevio ? melhorPrecoPrevio.cidade : null;

    // ---- PASSO 2: achar a cidade de VENDA com maior preço ----
    let melhorVenda = null;
    let maiorPrecoVenda = -Infinity;

    rotasDoTipo.forEach(r => {
      if (r.precoVenda > maiorPrecoVenda) {
        maiorPrecoVenda = r.precoVenda;
        melhorVenda = r;
      }
    });

    if (!melhorVenda) return;

    // ---- PASSO 3: testar TODAS as cidades como candidatas a cidade de REFINO ----
    // O RRR entra aqui, na cidade onde o refino de fato acontece — que pode ser
    // diferente tanto da cidade de compra quanto da cidade de venda.
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
          compraCidadePrevio: melhorPrecoPrevio ? melhorPrecoPrevio.cidade : null,
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

  if (melhorGeral && melhorGeral.lucroTransporte > 0) {
    const tipoRefino = melhorGeral.tipo;
    const indexEncantamento = Number(tipoRefino.split('.')[1]);
    const itemValue = VALORES_ITENS[tier]?.[indexEncantamento] ?? 0;
    const rrrCidade = determineRRR(resource, melhorGeral.refinoCidade, activePreferences.usarFoco);
    const custoBruto = applyRRR(melhorGeral.precoCompraBruta * formula.bruto, rrrCidade);
    const custoPrevio = melhorGeral.precoCompraPrevio > 0 && formula.refinadoAnterior
      ? applyRRR(melhorGeral.precoCompraPrevio * formula.refinadoAnterior, rrrCidade)
      : 0;
    const tru = calcNutritionCost(itemValue, taxaEstacao);

    lastBestRouteSummary = {
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

    elements.decisionText.innerHTML = `
      Para o recurso <strong>T${melhorGeral.tipo}</strong>:<br>
      ${compraRawText}
      🔨 Refine em <strong>${melhorGeral.refinoCidade}</strong> (para um custo efetivo aproximado de <span class="focus-gold">${Math.round(melhorGeral.custoInsumo).toLocaleString('pt-BR')} Silver</span> por refino.)<br>
      💰 Venda em <strong>${melhorGeral.vendaCidade}</strong> por <span class="focus-gold">${melhorGeral.precoVenda.toLocaleString('pt-BR')} Silver</span>.<br>
      🔥 Margem Esperada: <strong><span style="color: var(--color-profit);">${melhorGeral.margemTransporte.toFixed(1)}%</span></strong>
      (Lucro Líquido: <strong><span style="color: var(--color-profit);">+${Math.round(melhorGeral.lucroTransporte).toLocaleString('pt-BR')} Silver</span></strong> por refinado).
    `;
  } else {
    lastBestRouteSummary = null;
    elements.decisionText.innerText = "Nenhuma rota de transporte lucrativa foi encontrada no momento com os preços ativos.";
  }
}

