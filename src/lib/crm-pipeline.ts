export type FollowupStageId =
  | "nuevo"
  | "contactar"
  | "espera"
  | "negociacion"
  | "pedido"
  | "postventa";

export type FollowupStageDef = {
  id: FollowupStageId;
  label: string;
  hint: string;
};

/** Etapas abiertas del pipeline CRM (seguimientos + inbox WhatsApp). */
export const FOLLOWUP_OPEN_STAGES: readonly FollowupStageDef[] = [
  { id: "nuevo", label: "Lead", hint: "Entró; aún no se contactó." },
  { id: "contactar", label: "Contactar", hint: "Toca escribir o llamar." },
  { id: "espera", label: "En espera", hint: "Ya contactaste; esperas respuesta." },
  { id: "negociacion", label: "Negociación", hint: "Cotizando o cerrando detalles." },
  { id: "pedido", label: "Pedido", hint: "Hay pedido en curso o por confirmar." },
  { id: "postventa", label: "Postventa", hint: "Entrega, soporte o seguimiento." },
] as const;

const STAGE_IDS = new Set<string>(FOLLOWUP_OPEN_STAGES.map((stage) => stage.id));

export function isFollowupStageId(value: string): value is FollowupStageId {
  return STAGE_IDS.has(value);
}

export function normalizeFollowupStage(value: string | null | undefined): FollowupStageId {
  const raw = (value ?? "").trim().toLowerCase();
  return isFollowupStageId(raw) ? raw : "nuevo";
}

export function followupStageLabel(stage: FollowupStageId) {
  return FOLLOWUP_OPEN_STAGES.find((item) => item.id === stage)?.label ?? "Lead";
}

export function nextFollowupStages(stage: FollowupStageId): FollowupStageId[] {
  const order = FOLLOWUP_OPEN_STAGES.map((item) => item.id);
  const index = order.indexOf(stage);
  if (index < 0) return ["contactar"];
  const next = order[index + 1];
  const prev = order[Math.max(0, index - 1)];
  const options = new Set<FollowupStageId>();
  if (next) options.add(next);
  if (prev && prev !== stage) options.add(prev);
  for (const id of order) {
    if (options.size >= 3) break;
    if (id !== stage) options.add(id);
  }
  return [...options];
}

export function groupFollowupsByStage<T extends { stage: FollowupStageId }>(tasks: T[]) {
  const buckets = Object.fromEntries(FOLLOWUP_OPEN_STAGES.map((stage) => [stage.id, [] as T[]])) as Record<
    FollowupStageId,
    T[]
  >;
  for (const task of tasks) {
    buckets[normalizeFollowupStage(task.stage)].push(task);
  }
  return buckets;
}
