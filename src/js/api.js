/**
 * Integração com a API do AODP - Albion Calc
 * 
 * Contém funções para realizar requisições HTTP assíncronas para obter preços
 * e formatar a idade do preço retornado.
 */

// URL Base da API do Albion Online Data Project (Servidor West/Américas)
const API_BASE_URL = "https://west.albion-online-data.com/api/v2/stats/prices";

/**
 * Busca preços de uma lista de itens nas cidades especificadas
 * @param {string[]} itemIds Lista de IDs de itens (ex: ["T4_ORE", "T4_METALBAR"])
 * @param {string[]} locations Lista de cidades (ex: ["Caerleon", "Bridgewatch"])
 * @param {number} timeoutMs Tempo máximo de espera para a requisição (padrão 8000ms)
 * @returns {Promise<Object[]>} Array de registros de preços da API
 */
export async function fetchPrices(itemIds, locations, timeoutMs = 8000) {
  if (!itemIds || itemIds.length === 0 || !locations || locations.length === 0) {
    return [];
  }

  const itemsQuery = itemIds.join(',');
  const locationsQuery = locations.join(',');
  const url = `${API_BASE_URL}/${itemsQuery}.json?locations=${locationsQuery}&qualities=1`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(id);
    console.error("Falha ao buscar preços na API AODP:", error);
    throw error;
  }
}

/**
 * Calcula e formata de forma legível a idade do preço baseado na data UTC retornada
 * @param {string} dateString Carimbo de data/hora UTC (ex: "2026-08-25T15:30:00")
 * @param {Date} dateNow Instância opcional da hora atual (útil para testes unitários)
 * @returns {string} Idade formatada (ex: "15m", "3h", "2d", "Sem dados")
 */
export function formatPriceAge(dateString, dateNow = new Date()) {
  if (!dateString || dateString.startsWith("0001-01-01") || dateString === "") {
    return "Sem dados";
  }

  try {
    const dataPreco = new Date(dateString);
    if (isNaN(dataPreco.getTime())) {
      return "Sem dados";
    }

    // Calcula a diferença em milissegundos ajustando para o timezone
    const diferencaMs = dateNow.getTime() - dataPreco.getTime();
    
    // Se a diferença for negativa (ex: relógio local atrasado), trata como 0
    const diferencaMinutos = Math.max(0, Math.floor(diferencaMs / (1000 * 60)));

    if (diferencaMinutos < 60) {
      return `${diferencaMinutos}m`;
    } else if (diferencaMinutos < 1440) {
      const horas = Math.floor(diferencaMinutos / 60);
      return `${horas}h`;
    } else {
      const dias = Math.floor(diferencaMinutos / 1440);
      return `${dias}d`;
    }
  } catch (e) {
    return "Sem dados";
  }
}
