import OpenAI from "openai";

const PROBE_CACHE_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;

export type OpenAIProbeResult = {
  ok: boolean;
  /** true si hay clave en env (sin revelarla). */
  keyConfigured: boolean;
  detail: string;
  model: string;
  checkedAt: string;
};

type CacheEntry = {
  at: number;
  result: OpenAIProbeResult;
};

let probeCache: CacheEntry | null = null;

/** Modelo por defecto del piloto AG-0. Sobrescribe con OPENAI_MODEL. */
export function openAIModel() {
  const raw = process.env.OPENAI_MODEL?.trim();
  return raw || "gpt-4.1-mini";
}

export function openAIKeyConfigured() {
  return Boolean(readApiKey());
}

function readApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    timeout: PROBE_TIMEOUT_MS,
    maxRetries: 0,
  });
}

/** Mensaje seguro: nunca incluye la clave ni el cuerpo crudo de la API. */
export function safeOpenAIError(error: unknown) {
  if (!(error instanceof Error)) return "No se pudo contactar OpenAI.";
  const message = error.message.replace(/\s+/g, " ").trim();
  if (/incorrect api key|invalid api key|authentication/i.test(message)) {
    return "La clave de OpenAI no es válida o fue rechazada.";
  }
  if (/rate limit|429/i.test(message)) {
    return "OpenAI limitó la prueba por tasa. Reintenta en un momento.";
  }
  if (/timeout|timed out|AbortError/i.test(message)) {
    return "OpenAI no respondió a tiempo.";
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(message)) {
    return "No hubo red hacia OpenAI.";
  }
  return "OpenAI no confirmó la conexión.";
}

/**
 * Prueba mínima de API (lista de modelos). Sin prompts ni datos de tienda/clientes.
 * Cache ~60s para no golpear la API en cada refresh del panel.
 */
export async function probeOpenAI(options?: { force?: boolean }): Promise<OpenAIProbeResult> {
  const model = openAIModel();
  const keyConfigured = openAIKeyConfigured();
  const now = Date.now();

  if (!options?.force && probeCache && now - probeCache.at < PROBE_CACHE_MS) {
    return probeCache.result;
  }

  if (!keyConfigured) {
    const result: OpenAIProbeResult = {
      ok: false,
      keyConfigured: false,
      detail: "Falta OPENAI_API_KEY en el servidor. El checkout no depende de OpenAI.",
      model,
      checkedAt: new Date().toISOString(),
    };
    probeCache = { at: now, result };
    return result;
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    const result: OpenAIProbeResult = {
      ok: false,
      keyConfigured: false,
      detail: "Falta OPENAI_API_KEY en el servidor. El checkout no depende de OpenAI.",
      model,
      checkedAt: new Date().toISOString(),
    };
    probeCache = { at: now, result };
    return result;
  }

  try {
    const client = createClient(apiKey);
    await client.models.list();
    const result: OpenAIProbeResult = {
      ok: true,
      keyConfigured: true,
      detail: `OpenAI respondió. Modelo configurado: ${model}.`,
      model,
      checkedAt: new Date().toISOString(),
    };
    probeCache = { at: Date.now(), result };
    return result;
  } catch (error) {
    const result: OpenAIProbeResult = {
      ok: false,
      keyConfigured: true,
      detail: `${safeOpenAIError(error)} El checkout no depende de OpenAI.`,
      model,
      checkedAt: new Date().toISOString(),
    };
    probeCache = { at: Date.now(), result };
    return result;
  }
}

/** Solo tests: limpia la cache del probe. */
export function clearOpenAIProbeCache() {
  probeCache = null;
}
