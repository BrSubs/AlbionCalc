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
import { buildEncantadoId, closeRecipeModal, setupRecipeInteraction } from './recipes.js';
import { buildCostUnitHelpContent, buildProfitUnitHelpContent, buildFocusHelpContent, setupCostHelpModal, setupProfitHelpModal, setupFocusHelpModal } from './help.js';
import { renderSkeletons as renderSkeletonsView, renderEmptyLines as renderEmptyLinesView, setupTableInputs as bindTableInputs, renderCalculations as renderCalculationTable } from './render.js';
import { renderBestRoute as evaluateBestRoute } from './route.js';

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
  setupCostHelpModal(elements);
  setupProfitHelpModal(elements);
  setupFocusHelpModal(elements);
  setupRecipeModal();
  buildCostUnitHelpContent({ activePreferences, lastBestRouteSummary, elements });
  buildProfitUnitHelpContent({ activePreferences, lastBestRouteSummary, elements });
  buildFocusHelpContent({ activePreferences, lastBestRouteSummary, elements });
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
  window.__albionCalcState = {
    preferences: activePreferences,
    lastBestRouteSummary
  };
}

function setupRecipeModal() {
  if (elements.recipeModalClose) {
    elements.recipeModalClose.addEventListener('click', () => closeRecipeModal(elements));
  }

  if (elements.recipeModal) {
    elements.recipeModal.addEventListener('click', (event) => {
      if (event.target === elements.recipeModal) {
        closeRecipeModal(elements);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.recipeModal.classList.contains('hidden')) {
        closeRecipeModal(elements);
      }
    });
  }
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

function renderEmptyLines() {
  apiDataCache = [];
  renderCalculations();
}

function renderSkeletons() {
  renderSkeletonsView(elements);
}

function getActivePrice(itemId, city, defaultValue = 0, source = 'sell_price_min') {
  const overrides = getPriceOverrides();
  const overrideKey = `${itemId}_${city}`;

  if (overrides[overrideKey] !== undefined) {
    return overrides[overrideKey];
  }

  const record = apiDataCache.find(r => r.item_id === itemId && r.city === city);
  return record ? record[source] : defaultValue;
}

function getApiRecord(itemId, city) {
  return apiDataCache.find(r => r.item_id === itemId && r.city === city);
}

function getPriceAgeClass(ageText) {
  if (ageText.endsWith('m')) return 'age-fresh';
  if (ageText.endsWith('h')) return 'age-stale';
  return 'age-old';
}

function renderCalculations() {
  renderCalculationTable({
    activePreferences,
    apiDataCache,
    elements,
    renderBestRoute: (params) => {
      const summary = evaluateBestRoute(params);
      lastBestRouteSummary = summary;
      return summary;
    },
    updateStateAfterInput: () => renderCalculations()
  });
}

function setupTableInputs() {
  bindTableInputs({
    elements,
    apiDataCache,
    updateStateAfterInput: () => renderCalculations()
  });
}

function renderBestRoute({ rotas, activePreferences, elements }) {
  const summary = evaluateBestRoute({ rotas, activePreferences, elements });
  lastBestRouteSummary = summary;
  return summary;
}

