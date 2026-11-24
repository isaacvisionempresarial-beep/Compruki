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

function createClient(apiKey: string, timeoutMs = PROBE_TIMEOUT_MS) {
  return new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
  });
}

export type OpenAIChatResult =
  | {
      ok: true;
      text: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      /** Estimación local en COP para agent_runs; no es factura de OpenAI. */
      costEstimateCop: number;
    }
  | { ok: false; detail: string };

function copPerThousandTokens() {
  const raw = Number(process.env.OPENAI_COP_PER_1K_TOKENS ?? "200");
  if (!Number.isFinite(raw) || raw < 0) return 200;
  return Math.min(50_000, raw);
}

/** Chat corto con JSON. Solo hechos que el caller ya filtró; sin PII de clientes. */
export async function chatJsonCompletion(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<OpenAIChatResult> {
  const apiKey = readApiKey();
  if (!apiKey) {
    return { ok: false, detail: "Falta OPENAI_API_KEY en el servidor." };
  }

  const model = openAIModel();
  try {
    const client = createClient(apiKey, 20_000);
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: Math.min(1200, Math.max(200, input.maxTokens ?? 900)),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, detail: "OpenAI devolvió una respuesta vacía." };
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const total = promptTokens + completionTokens;
    const costEstimateCop = Math.max(1, Math.ceil((total / 1000) * copPerThousandTokens()));
    return {
      ok: true,
      text,
      model,
      promptTokens,
      completionTokens,
      costEstimateCop,
    };
  } catch (error) {
    return { ok: false, detail: safeOpenAIError(error) };
  }
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
