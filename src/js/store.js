/**
 * Gerenciador de Estado e Persistência - Albion Calc
 * 
 * Responsável por salvar e recuperar preferências do usuário (Premium, Foco,
 * cidades selecionadas, taxas de uso e sobrescritas de preço) via LocalStorage.
 */

// Chaves utilizadas no LocalStorage
const STORAGE_KEYS = {
  PREFERENCES: "albion_calc_pref",
  PRICE_OVERRIDES: "albion_calc_price_overrides"
};

// Valores padrões iniciais do aplicativo
const DEFAULT_PREFERENCES = {
  premium: true,
  usarFoco: false,
  cidadesSelecionadas: ["Caerleon","Brecilien", "Bridgewatch", "Martlock", "Lymhurst", "Fort Sterling", "Thetford"],
  taxasEstacao: {
    ORE: 1,
    WOOD: 1,
    HIDE: 1,
    FIBER: 1,
    STONE: 1
  },
  recursoAtivo: "ORE", // ORE, WOOD, HIDE, FIBER, STONE
  tierAtivo: 4 // T2 a T8
};

/**
 * Carrega as preferências do usuário salvas ou retorna os valores padrões
 * @returns {Object} Objeto de preferências
 */
export function getPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    
    // Mescla o carregado com o default para prevenir problemas com novas propriedades
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Falha ao carregar preferências do LocalStorage:", e);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Salva as preferências do usuário no LocalStorage
 * @param {Object} preferences Objeto contendo as novas preferências
 */
export function savePreferences(preferences) {
  try {
    const current = getPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
  } catch (e) {
    console.error("Falha ao salvar preferências no LocalStorage:", e);
  }
}

/**
 * Carrega a tabela de preços sobrescritos manualmente pelo usuário
 * @returns {Object} Mapa de item_id -> preço sobrescrito (ex: {"T4_ORE_Caerleon": 150})
 */
export function getPriceOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRICE_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Falha ao carregar sobrescritas de preço:", e);
    return {};
  }
}

/**
 * Salva um preço sobrescrito manualmente pelo usuário
 * @param {string} itemId ID do item (ex: "T4_ORE")
 * @param {string} city Nome da cidade (ex: "Caerleon")
 * @param {number|null} price Preço manual digitado ou null para remover
 */
export function setPriceOverride(itemId, city, price) {
  try {
    const overrides = getPriceOverrides();
    const key = `${itemId}_${city}`;
    
    if (price === null || isNaN(price) || price < 0) {
      delete overrides[key];
    } else {
      overrides[key] = price;
    }
    
    localStorage.setItem(STORAGE_KEYS.PRICE_OVERRIDES, JSON.stringify(overrides));
  } catch (e) {
    console.error("Falha ao salvar sobrescrita de preço:", e);
  }
}

/**
 * Limpa todas as sobrescritas de preço registradas pelo usuário
 */
export function clearPriceOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PRICE_OVERRIDES);
  } catch (e) {
    console.error("Falha ao limpar sobrescritas de preço:", e);
  }
}
