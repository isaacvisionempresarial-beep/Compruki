"use server";

import { assertPanelAccess } from "@/server/panel-auth";
import { probeOpenAI, type OpenAIProbeResult } from "@/server/openai-client";

export type ProbeOpenAIState = {
  error: string | null;
  result: OpenAIProbeResult | null;
};

export async function probeOpenAIAction(
  _state: ProbeOpenAIState,
  _formData: FormData,
): Promise<ProbeOpenAIState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite probar OpenAI.", result: null };
  if (access.role !== "owner") {
    return { error: "Solo el propietario puede probar la conexión a OpenAI.", result: null };
  }

  const result = await probeOpenAI({ force: true });
  if (!result.ok) {
    return { error: result.detail, result };
  }
  return { error: null, result };
}
