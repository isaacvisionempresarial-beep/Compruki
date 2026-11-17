"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { recordAgentRun } from "@/server/agent-runs";
import { assertPanelAccess } from "@/server/panel-auth";
import { getPilotTenantId } from "@/server/tenant";

export type ResolveApprovalState = { error: string | null; message: string | null };

export async function resolvePendingApprovalAction(
  _state: ResolveApprovalState,
  formData: FormData,
): Promise<ResolveApprovalState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Tu sesión no permite resolver pendientes.", message: null };

  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!id || (decision !== "approve" && decision !== "reject")) {
    return { error: "Decisión no válida.", message: null };
  }

  if (kind === "borrador") {
    return resolveDraft(id, decision, access.user.id);
  }
  if (kind === "agente") {
    return resolveAgentRun(id, decision, access.user.id);
  }

  return { error: "Este pendiente se resuelve en Pedidos.", message: null };
}

async function resolveDraft(
  id: string,
  decision: "approve" | "reject",
  userId: string,
): Promise<ResolveApprovalState> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const reviewStatus = decision === "approve" ? "approved" : "rejected";
    const { data, error } = await supabase
      .from("content_drafts")
      .update({ review_status: reviewStatus })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("review_status", "pending")
      .select("id, product_sku, channel")
      .maybeSingle();

    if (error) {
      return {
        error:
          error.message.includes("review_status") || error.message.includes("schema cache")
            ? "Falta review_status. Ejecuta supabase/migrations/007_content_draft_review.sql."
            : error.message,
        message: null,
      };
    }
    if (!data) return { error: "Ese borrador ya no está pendiente.", message: null };

    await recordAgentRun({
      agentId: "AG-03",
      status: decision === "approve" ? "succeeded" : "cancelled",
      summary:
        decision === "approve"
          ? `Borrador aprobado · ${data.product_sku} · ${data.channel}`
          : `Borrador rechazado · ${data.product_sku} · ${data.channel}`,
      createdBy: userId,
    });

    revalidatePath("/panel/agentes");
    revalidatePath("/panel");
    return {
      error: null,
      message:
        decision === "approve"
          ? `Borrador ${data.channel} de ${data.product_sku} aprobado.`
          : `Borrador ${data.channel} de ${data.product_sku} rechazado.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo resolver el borrador.",
      message: null,
    };
  }
}

async function resolveAgentRun(
  id: string,
  decision: "approve" | "reject",
  userId: string,
): Promise<ResolveApprovalState> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data: current, error: loadError } = await supabase
      .from("agent_runs")
      .select("id, agent_id, summary")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("status", "awaiting_approval")
      .maybeSingle();

    if (loadError) return { error: loadError.message, message: null };
    if (!current) return { error: "Esa corrida ya no está en espera de aprobación.", message: null };

    const prefix = decision === "approve" ? "Aprobado humano" : "Rechazado humano";
    const baseSummary = typeof current.summary === "string" ? current.summary : "";
    const nextStatus = decision === "approve" ? "succeeded" : "cancelled";
    const { error } = await supabase
      .from("agent_runs")
      .update({
        status: nextStatus,
        summary: `${prefix} · ${baseSummary}`.slice(0, 2000),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .eq("status", "awaiting_approval");

    if (error) return { error: error.message, message: null };

    await recordAgentRun({
      agentId: "AG-01",
      status: decision === "approve" ? "succeeded" : "cancelled",
      summary: `${prefix} · corrida ${current.agent_id} (${id.slice(0, 8)})`,
      createdBy: userId,
    });

    revalidatePath("/panel/agentes");
    revalidatePath("/panel");
    return {
      error: null,
      message:
        decision === "approve"
          ? `Corrida ${current.agent_id} aprobada.`
          : `Corrida ${current.agent_id} rechazada.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo resolver la corrida.",
      message: null,
    };
  }
}
