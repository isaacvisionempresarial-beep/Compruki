"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { applyApprovedContentDraft } from "@/server/catalog-store";
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
    return resolveDraft(id, decision, access.user.id, access.actorName, formData);
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
  actorName: string,
  formData: FormData,
): Promise<ResolveApprovalState> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data: current, error: loadError } = await supabase
      .from("content_drafts")
      .select("id, product_sku, channel, title, body, cta")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("review_status", "pending")
      .maybeSingle();

    if (loadError) {
      return {
        error:
          loadError.message.includes("review_status") || loadError.message.includes("schema cache")
            ? "Falta review_status. Ejecuta supabase/migrations/007_content_draft_review.sql."
            : loadError.message,
        message: null,
      };
    }
    if (!current) return { error: "Ese borrador ya no está pendiente.", message: null };

    const title = clipField(formData.get("title"), current.title, 200);
    const body = clipField(formData.get("body"), current.body, 4000);
    const cta = clipField(formData.get("cta"), current.cta, 120);
    const edited = title !== String(current.title ?? "") || body !== String(current.body ?? "") || cta !== String(current.cta ?? "");

    if (decision === "approve" && !title.trim() && !body.trim()) {
      return { error: "El borrador necesita título o cuerpo para escribirse en el catálogo.", message: null };
    }

    const reviewStatus = decision === "approve" ? "approved" : "rejected";
    const { data, error } = await supabase
      .from("content_drafts")
      .update({
        review_status: reviewStatus,
        title,
        body,
        cta,
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("review_status", "pending")
      .select("id, product_sku, channel, title, body, cta")
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

    const channel = String(data.channel) as "ficha" | "anuncio" | "whatsapp";
    let applyNote = "";
    if (decision === "approve") {
      const applied = await applyApprovedContentDraft(
        {
          sku: String(data.product_sku),
          channel,
          title,
          body,
          cta,
        },
        actorName,
      );
      if (applied.error) {
        await supabase
          .from("content_drafts")
          .update({ review_status: "pending" })
          .eq("tenant_id", tenantId)
          .eq("id", id);
        return { error: `Aprobado en bandeja falló al escribir catálogo: ${applied.error}`, message: null };
      }
      applyNote = !applied.applied
        ? "El catálogo ya tenía ese texto."
        : channel === "ficha"
          ? "Aplicado a título y descripción."
          : channel === "anuncio"
            ? "Aplicado a destacados."
            : "Aplicado a respuestas / WhatsApp.";
      if (applied.applied) {
        revalidatePath("/panel/catalogo");
        revalidatePath(`/panel/catalogo/${encodeURIComponent(String(data.product_sku))}`);
        revalidatePath("/tienda");
      }
    }

    const editNote = edited ? " · texto editado en bandeja" : "";
    await recordAgentRun({
      agentId: "AG-03",
      status: decision === "approve" ? "succeeded" : "cancelled",
      summary:
        decision === "approve"
          ? `Borrador aprobado · ${data.product_sku} · ${data.channel} · ${applyNote}${editNote}`
          : `Borrador rechazado · ${data.product_sku} · ${data.channel}${editNote}`,
      createdBy: userId,
    });

    revalidatePath("/panel/agentes");
    revalidatePath("/panel");
    return {
      error: null,
      message:
        decision === "approve"
          ? `Borrador ${data.channel} de ${data.product_sku} aprobado. ${applyNote}${edited ? " Se usó el texto editado." : ""}`
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

function clipField(value: FormDataEntryValue | null, fallback: unknown, max: number) {
  const raw = typeof value === "string" ? value : fallback == null ? "" : String(fallback);
  return raw.trim().slice(0, max);
}
