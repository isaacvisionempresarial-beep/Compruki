export const CAMPAIGN_ORIGIN = "campana";
const STORAGE_KEY = "store_campaign";

export function campaignPath(sku: string) {
  return `/tienda/producto/${sku}?origen=${CAMPAIGN_ORIGIN}`;
}

export function rememberCampaignSku(sku: string) {
  const current = readCampaignSkus();
  if (current.includes(sku)) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...current, sku]));
}

export function readCampaignSkus() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && /^[A-Z0-9-]{3,32}$/.test(item));
  } catch {
    return [];
  }
}

export function campaignSkusInOrder(lines: Array<{ sku: string }>, marked: string[]) {
  const wanted = new Set(marked.map((sku) => sku.toUpperCase()));
  return [...new Set(lines.map((line) => line.sku.toUpperCase()).filter((sku) => wanted.has(sku)))];
}
