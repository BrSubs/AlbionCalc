/**
 * Controlador Principal - Albion Calc
 * 
 * Conecta a interface gráfica (HTML/CSS), a camada de dados (database.js),
 * o motor de cálculo (engine.js), a camada de API (api.js) e o gerenciador de estado (store.js).
 */

import { RESOURCE_TYPES, RECEITAS_REFINO, VALORES_ITENS } from './database.js';
import { determineRRR, applyRRR, calcNutritionCost, calcProfit } from './engine.js';
import { fetchPrices, formatPriceAge } from './api.js';
import { getPreferences, savePreferences, getPriceOverrides, setPriceOverride, clearPriceOverrides } from './store.js';

// Cache em memória dos dados da API e overrides ativos
let apiDataCache = [];
let activePreferences = {};

// Elementos DOM
const elements = {
  chkPremium: document.getElementById('chk-premium'),
  chkFocus: document.getElementById('chk-focus'),
  txtTaxaEstacao: document.getElementById('txt-taxa-estacao'),
  resourceSelector: document.getElementById('resource-selector'),
  tierSelector: document.getElementById('tier-selector'),
  tableBody: document.getElementById('table-body'),
  decisionText: document.getElementById('decision-text'),
  btnResetPrices: document.getElementById('btn-reset-prices'),
  cityFilters: document.querySelectorAll('.city-filter')
};

// Inicialização ao carregar o documento
document.addEventListener('DOMContentLoaded', () => {
  activePreferences = getPreferences();
  applyPreferencesToUI();
  setupEventListeners();
  loadAndRender();
});

// Carrega as preferências salvas e configura os inputs da UI
function applyPreferencesToUI() {
  elements.chkPremium.checked = activePreferences.premium;
  elements.chkFocus.checked = activePreferences.usarFoco;
  
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

// Retorna a lista de IDs de itens para consultar a API
function buildItemIds() {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const config = RESOURCE_TYPES[resource];
  
  const ids = [];
  
  // Encantamentos do Insumo Bruto (.0 a .4)
  ids.push(config.bruto_prefix.replace('{tier}', tier)); // .0
  for (let i = 1; i <= 4; i++) {
    ids.push(`${config.bruto_prefix.replace('{tier}', tier)}_LEVEL${i}`); // .1 a .4
  }

  // Refinado do Tier anterior (.0 sempre)
  if (tier > 2) {
    const tierAnterior = tier - 1;
    const maxEncPrevio = (tierAnterior >= 4) ? 4 : 0; // T2/T3 só têm .0
    ids.push(config.refinado_prefix.replace('{tier}', tierAnterior)); // .0 sempre existe
    for (let i = 1; i <= maxEncPrevio; i++) {
      ids.push(`${config.refinado_prefix.replace('{tier}', tierAnterior)}_LEVEL${i}`);
    }
  }

  // Encantamentos do Refinado Final (.0 a .4)
  ids.push(config.refinado_prefix.replace('{tier}', tier)); // .0
  for (let i = 1; i <= 4; i++) {
    ids.push(`${config.refinado_prefix.replace('{tier}', tier)}_LEVEL${i}`); // .1 a .4
  }

  return ids;
}

// Busca os preços na API e renderiza a tabela
async function loadAndRender() {
  const itemIds = buildItemIds();
  const cidades = activePreferences.cidadesSelecionadas;

  // Renderiza Skeletons (loaders) nas linhas da tabela enquanto baixa
  renderSkeletons();

  if (cidades.length === 0) {
    elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhuma cidade selecionada como ativa.</td></tr>`;
    elements.decisionText.innerText = "Por favor, selecione ao menos uma cidade nas configurações.";
    return;
  }

  try {
    apiDataCache = await fetchPrices(itemIds, cidades);
    renderCalculations();
  } catch (error) {
    elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--color-loss); padding: 20px;">Erro ao carregar dados da API. Você pode digitar os preços manualmente.</td></tr>`;
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

// Renderiza os cálculos e popula a tabela com dados reais e editáveis
function renderCalculations() {
  const resource = activePreferences.recursoAtivo;
  const tier = activePreferences.tierAtivo;
  const config = RESOURCE_TYPES[resource];
  const cidades = activePreferences.cidadesSelecionadas;
  
  const formula = RECEITAS_REFINO[tier];
  const itemValues = VALORES_ITENS[tier];
  
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
    const brutoId = `${config.bruto_prefix.replace('{tier}', tier)}${suffix}`;
    const refinadoId = `${config.refinado_prefix.replace('{tier}', tier)}${suffix}`;
    const refinadoAnteriorId = tier > 2 ? config.refinado_prefix.replace('{tier}', tier - 1) : null;
    
    const valorItemRefinado = itemValues[enc];
    
    // Ignora se for encantamento inexistente (T2 e T3 só têm .0)
    if (valorItemRefinado === 0) continue;

    cidades.forEach(cidade => {
      // 1. Coleta preços das fontes de entrada
      const precoBruto = getActivePrice(brutoId, cidade, 0, "sell_price_min");
      const precoPrevio = refinadoAnteriorId ? getActivePrice(refinadoAnteriorId, cidade, 0, "sell_price_min") : 0;
      const precoVenda = getActivePrice(refinadoId, cidade, 0, "sell_price_min");
      
      const recordBruto = getApiRecord(brutoId, cidade);
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
      
      // Badge da idade do preço do refinado
      const ageText = recordVenda ? formatPriceAge(recordVenda.sell_price_min_date) : "Sem dados";
      let ageClass = "age-old";
      if (ageText.endsWith('m')) ageClass = "age-fresh";
      else if (ageText.endsWith('h')) ageClass = "age-stale";

      tr.innerHTML = `
        <td>
          <div class="item-cell">
            <img class="item-icon" src="${cdnUrl}" alt="${nomeItem}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'40\' height=\'40\' fill=\'%23232329\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23fff\' font-size=\'10\'>T${tier}.${enc}</text></svg>'">
            <span>T${tier}.${enc}</span>
          </div>
        </td>
        <td class="city-cell">${cidade}</td>
        
        <!-- Célula de entrada bruta editável -->
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input bruto-input" 
                 data-item="${brutoId}" data-city="${cidade}" 
                 value="${precoBruto > 0 ? precoBruto : ''}" placeholder="0">
        </td>

        <!-- Célula de entrada refinada anterior (vazia se T2) -->
        <td class="price-cell">
          ${refinadoAnteriorId ? `
            <input type="text" inputmode="numeric" class="price-input prev-input" 
                   data-item="${refinadoAnteriorId}" data-city="${cidade}" 
                   value="${precoPrevio > 0 ? precoPrevio : ''}" placeholder="0">
          ` : '<span style="color:#555;">-</span>'}
        </td>

        <!-- Célula de venda editável com badge de idade do preço -->
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input venda-input" 
                 data-item="${refinadoId}" data-city="${cidade}" 
                 value="${precoVenda > 0 ? precoVenda : ''}" placeholder="0">
          <span class="price-age ${ageClass}">${ageText}</span>
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
      const value = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);

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

      if (!melhorGeral || lucroTransporte > melhorGeral.lucroTransporte) {
        melhorGeral = {
          tipo,
          compraCidade: melhorPrecoBruto.cidade,
          refinoCidade: candidataRefino.cidade,
          vendaCidade: melhorVenda.cidade,
          lucroTransporte,
          margemTransporte,
          custoInsumo: custoTotalInsumos,
          precoVenda: melhorVenda.precoVenda
        };
      }
    });
  });

  if (melhorGeral && melhorGeral.lucroTransporte > 0) {
    elements.decisionText.innerHTML = `
      Para o recurso <strong>T${melhorGeral.tipo}</strong>:<br>
      🛒 Compre insumos brutos em <strong>${melhorGeral.compraCidade}</strong><br>
      🔨 Refine em <strong>${melhorGeral.refinoCidade}</strong> (para um custo efetivo aproximado de <span class="focus-gold">${Math.round(melhorGeral.custoInsumo).toLocaleString('pt-BR')} Silver</span> por refino.)<br>
      💰 Venda em <strong>${melhorGeral.vendaCidade}</strong> por <span class="focus-gold">${melhorGeral.precoVenda.toLocaleString('pt-BR')} Silver</span>.<br>
      🔥 Margem Esperada: <strong><span style="color: var(--color-profit);">${melhorGeral.margemTransporte.toFixed(1)}%</span></strong>
      (Lucro Líquido: <strong><span style="color: var(--color-profit);">+${Math.round(melhorGeral.lucroTransporte).toLocaleString('pt-BR')} Silver</span></strong> por refinado).
    `;
  } else {
    elements.decisionText.innerText = "Nenhuma rota de transporte lucrativa foi encontrada no momento com os preços ativos.";
  }
}