/**
 * Módulo de renderização da interface.
 *
 * Responsável por montar a tabela principal, os loaders, os inputs e
 * atualizar o estado visual da interface com os valores calculados.
 */

import { RESOURCE_TYPES, RECEITAS_REFINO, VALORES_ITENS, formatIntegerValue, getCostColumnLabels } from './database.js';
import { determineRRR, applyRRR, calcNutritionCost, calcProfit } from './engine.js';
import { fetchPrices, formatPriceAge } from './api.js';
import { getPriceOverrides, setPriceOverride } from './store.js';
import { buildEncantadoId, setupRecipeInteraction } from './recipes.js';

export function renderSkeletons(elements) {
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

export function renderEmptyLines(elements) {
  elements.tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhuma cidade selecionada como ativa.</td></tr>';
}

export function getPriceAgeClass(ageText) {
  if (ageText.endsWith('m')) return 'age-fresh';
  if (ageText.endsWith('h')) return 'age-stale';
  return 'age-old';
}

export function setupTableInputs({ elements, apiDataCache, updateStateAfterInput }) {
  document.querySelectorAll('.price-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemId = e.target.dataset.item;
      const city = e.target.dataset.city;
      const rawValue = e.target.value;
      const cleanedValue = String(rawValue).replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '');
      const value = rawValue === '' ? null : Math.max(0, Number(cleanedValue) || 0);

      setPriceOverride(itemId, city, value);
      updateStateAfterInput({ apiDataCache, elements });
    });
  });
}

export function renderCalculations({
  activePreferences,
  apiDataCache,
  elements,
  renderBestRoute,
  updateStateAfterInput
}) {
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

  const activeEl = document.activeElement;
  let focoAnterior = null;
  if (activeEl && activeEl.classList && activeEl.classList.contains('price-input') && elements.tableBody.contains(activeEl)) {
    focoAnterior = {
      item: activeEl.dataset.item,
      city: activeEl.dataset.city,
      classe: [...activeEl.classList].find(c => c.endsWith('-input')),
      selectionStart: activeEl.selectionStart,
      selectionEnd: activeEl.selectionEnd
    };
  }

  elements.tableBody.innerHTML = '';

  const rotasCalculadas = [];

  for (let enc = 0; enc < 5; enc++) {
    const brutoBase = config.bruto_prefix.replace('{tier}', tier);
    const refinadoBase = config.refinado_prefix.replace('{tier}', tier);
    const brutoId = buildEncantadoId(brutoBase, enc);
    const refinadoId = buildEncantadoId(refinadoBase, enc);

    let refinadoAnteriorId = null;
    if (tier > 2) {
      const tierAnterior = tier - 1;
      const tierAnteriorSuportaEncante = tierAnterior >= 4;
      const encAnterior = tierAnteriorSuportaEncante ? enc : 0;
      refinadoAnteriorId = buildEncantadoId(
        config.refinado_prefix.replace('{tier}', tierAnterior),
        encAnterior
      );
    }

    const valorItemRefinado = itemValues[enc];

    if (valorItemRefinado === 0) continue;
    if (selectedEnchantments.length > 0 && !selectedEnchantments.includes(enc)) continue;

    cidades.forEach(cidade => {
      const precoBruto = getActivePrice(apiDataCache, brutoId, cidade, 0, 'sell_price_min');
      const precoPrevio = refinadoAnteriorId ? getActivePrice(apiDataCache, refinadoAnteriorId, cidade, 0, 'sell_price_min') : 0;
      const precoVenda = getActivePrice(apiDataCache, refinadoId, cidade, 0, 'sell_price_min');

      const recordBruto = getApiRecord(apiDataCache, brutoId, cidade);
      const recordPrevio = refinadoAnteriorId ? getApiRecord(apiDataCache, refinadoAnteriorId, cidade) : null;
      const recordVenda = getApiRecord(apiDataCache, refinadoId, cidade);

      const rrr = determineRRR(resource, cidade, activePreferences.usarFoco);
      const custoBrutoEfetivo = applyRRR(precoBruto * formula.bruto, rrr);
      const custoPrevioEfetivo = refinadoAnteriorId ? applyRRR(precoPrevio * formula.refinadoAnterior, rrr) : 0;

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

      const tr = document.createElement('tr');
      const nomeItem = `${resource} T${tier}.${enc}`;
      const cdnUrl = `https://render.albiononline.com/v1/item/${refinadoId}.png?size=40`;

      const ageTextBruto = recordBruto ? formatPriceAge(recordBruto.sell_price_min_date) : 'Sem dados';
      const ageTextPrevio = recordPrevio ? formatPriceAge(recordPrevio.sell_price_min_date) : 'Sem dados';
      const ageTextVenda = recordVenda ? formatPriceAge(recordVenda.sell_price_min_date) : 'Sem dados';

      tr.innerHTML = `
        <td>
          <div class="item-cell">
            <img class="item-icon" src="${cdnUrl}" alt="${nomeItem}" data-resource="${resource}" data-tier="${tier}" data-enc="${enc}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'40\' height=\'40\' fill=\'%23232329\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23fff\' font-size=\'10\'>T${tier}.${enc}</text></svg>'">
            <span>T${tier}.${enc}</span>
          </div>
        </td>
        <td class="city-cell">${cidade}</td>
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input bruto-input" data-item="${brutoId}" data-city="${cidade}" value="${precoBruto > 0 ? formatIntegerValue(precoBruto) : ''}" placeholder="0">
          <span class="price-age ${getPriceAgeClass(ageTextBruto)}">${ageTextBruto}</span>
        </td>
        <td class="price-cell">
          ${refinadoAnteriorId ? `
            <input type="text" inputmode="numeric" class="price-input prev-input" data-item="${refinadoAnteriorId}" data-city="${cidade}" value="${precoPrevio > 0 ? formatIntegerValue(precoPrevio) : ''}" placeholder="0">
            <span class="price-age ${getPriceAgeClass(ageTextPrevio)}">${ageTextPrevio}</span>
          ` : '<span style="color:#555;">-</span>'}
        </td>
        <td class="price-cell">
          <input type="text" inputmode="numeric" class="price-input venda-input" data-item="${refinadoId}" data-city="${cidade}" value="${precoVenda > 0 ? formatIntegerValue(precoVenda) : ''}" placeholder="0">
          <span class="price-age ${getPriceAgeClass(ageTextVenda)}">${ageTextVenda}</span>
        </td>
        <td class="value-cell">${Math.round(custoUnitario).toLocaleString('pt-BR')}</td>
        <td class="profit-cell ${lucro >= 0 ? 'profit-positive' : 'profit-negative'}">
          ${lucro >= 0 ? '+' : ''}${Math.round(lucro).toLocaleString('pt-BR')}
          <span class="percent-label">${margemPercentual.toFixed(1)}%</span>
        </td>
      `;

      elements.tableBody.appendChild(tr);
    });
  }

  setupTableInputs({ elements, apiDataCache, updateStateAfterInput: updateStateAfterInput });
  setupRecipeInteraction(elements);
  renderBestRoute({ rotas: rotasCalculadas, activePreferences, elements });

  if (focoAnterior) {
    const seletor = `.${focoAnterior.classe}[data-item="${CSS.escape(focoAnterior.item)}"][data-city="${CSS.escape(focoAnterior.city)}"]`;
    const novoInput = elements.tableBody.querySelector(seletor);
    if (novoInput) {
      novoInput.focus();
      try {
        novoInput.setSelectionRange(focoAnterior.selectionStart, focoAnterior.selectionEnd);
      } catch (err) {
        // ignorado em navegadores sem suporte
      }
    }
  }
}

export function getActivePrice(apiDataCache, itemId, city, defaultValue = 0, source = 'sell_price_min') {
  const overrides = getPriceOverrides();
  const overrideKey = `${itemId}_${city}`;

  if (overrides[overrideKey] !== undefined) {
    return overrides[overrideKey];
  }

  const record = apiDataCache.find(r => r.item_id === itemId && r.city === city);
  return record ? record[source] : defaultValue;
}

export function getApiRecord(apiDataCache, itemId, city) {
  return apiDataCache.find(r => r.item_id === itemId && r.city === city);
}
