/**
 * Módulo de receitas e preview de item refinado.
 *
 * Responsável por montar a receita do refino, renderizar o hover
 * e abrir/fechar o modal da receita do item.
 */

import { RESOURCE_TYPES, RECEITAS_REFINO, getResourceLabels } from './database.js';

export function buildEncantadoId(baseId, enc) {
  return enc === 0 ? baseId : `${baseId}_LEVEL${enc}@${enc}`;
}

export function buildRecipeData(resource, tier, enc) {
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
    ? 'Para tier 5+, o item do tier anterior precisa usar o mesmo encantamento equivalente do refinado atual.'
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

export function renderRecipeHoverCard(event, card, resource, tier, enc) {
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

export function hideRecipeHoverCard(card) {
  if (card) {
    card.classList.add('hidden');
  }
}

export function openRecipeModal(elements, resource, tier, enc) {
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

export function closeRecipeModal(elements) {
  if (!elements.recipeModal) return;
  elements.recipeModal.classList.add('hidden');
  elements.recipeModal.setAttribute('aria-hidden', 'true');
}

export function setupRecipeInteraction(elements) {
  if (!elements.tableBody) return;

  elements.tableBody.querySelectorAll('.item-icon').forEach(icon => {
    icon.addEventListener('mouseenter', (event) => {
      const resource = event.target.dataset.resource;
      const tier = Number(event.target.dataset.tier);
      const enc = Number(event.target.dataset.enc);
      if (!resource || (!tier && tier !== 0)) return;
      renderRecipeHoverCard(event, elements.recipeHoverCard, resource, tier, enc);
    });

    icon.addEventListener('mouseleave', () => hideRecipeHoverCard(elements.recipeHoverCard));
    icon.addEventListener('click', (event) => {
      const resource = event.target.dataset.resource;
      const tier = Number(event.target.dataset.tier);
      const enc = Number(event.target.dataset.enc);
      if (!resource || Number.isNaN(tier) || Number.isNaN(enc)) return;
      openRecipeModal(elements, resource, tier, enc);
    });
  });
}
