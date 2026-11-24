export type FollowupStageId = "nuevo" | "contactar" | "espera";

export type FollowupStageDef = {
  id: FollowupStageId;
  label: string;
  hint: string;
};

/** Etapas abiertas del pipeline CRM lite (pedido / postventa). */
export const FOLLOWUP_OPEN_STAGES: readonly FollowupStageDef[] = [
  { id: "nuevo", label: "Nuevo", hint: "Acaba de entrar a la cola." },
  { id: "contactar", label: "Contactar", hint: "Toca escribir o llamar." },
  { id: "espera", label: "En espera", hint: "Ya contactaste; esperas respuesta." },
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
  return FOLLOWUP_OPEN_STAGES.find((item) => item.id === stage)?.label ?? "Nuevo";
}

export function nextFollowupStages(stage: FollowupStageId): FollowupStageId[] {
  if (stage === "nuevo") return ["contactar", "espera"];
  if (stage === "contactar") return ["espera", "nuevo"];
  return ["contactar", "nuevo"];
}

export function groupFollowupsByStage<T extends { stage: FollowupStageId }>(tasks: T[]) {
  const buckets: Record<FollowupStageId, T[]> = {
    nuevo: [],
    contactar: [],
    espera: [],
  };
  for (const task of tasks) {
    buckets[normalizeFollowupStage(task.stage)].push(task);
  }
  return buckets;
}
