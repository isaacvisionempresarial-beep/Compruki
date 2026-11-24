import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPilotTenantId } from "@/server/tenant";

export type ProductQuestionStatus = "open" | "answered" | "dismissed";

export type ProductQuestionRow = {
  id: string;
  productSku: string;
  question: string;
  autoReply: string;
  status: ProductQuestionStatus;
  answeredLine: string;
  resolvedBy: string;
  resolvedAt: string | null;
  createdAt: string;
};

function missingTable(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("product_questions")
  );
}

function mapRow(row: Record<string, unknown>): ProductQuestionRow {
  const statusRaw = String(row.status ?? "open");
  const status: ProductQuestionStatus =
    statusRaw === "answered" || statusRaw === "dismissed" ? statusRaw : "open";
  return {
    id: String(row.id),
    productSku: String(row.product_sku ?? ""),
    question: String(row.question ?? ""),
    autoReply: typeof row.auto_reply === "string" ? row.auto_reply : "",
    status,
    answeredLine: typeof row.answered_line === "string" ? row.answered_line : "",
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : "",
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function createProductQuestion(input: {
  productSku: string;
  question: string;
  autoReply: string;
}): Promise<{ error: string | null; id: string | null }> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("product_questions")
      .insert({
        tenant_id: tenantId,
        product_sku: input.productSku.trim().toUpperCase().slice(0, 40),
        question: input.question.trim().slice(0, 200),
        auto_reply: input.autoReply.trim().slice(0, 500),
        status: "open",
      })
      .select("id")
      .single();

    if (error) {
      return {
        error: missingTable(error.message)
          ? "Falta product_questions. Ejecuta supabase/migrations/012_product_questions.sql."
          : error.message,
        id: null,
      };
    }
    return { error: null, id: data?.id ? String(data.id) : null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la pregunta.",
      id: null,
    };
  }
}

export async function listOpenProductQuestions(limit = 8): Promise<ProductQuestionRow[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("product_questions")
      .select("id, product_sku, question, auto_reply, status, answered_line, resolved_by, resolved_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(Math.min(20, Math.max(1, limit)));

    if (error) {
      if (missingTable(error.message)) return [];
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function listOpenProductQuestionsForSku(sku: string, limit = 12): Promise<ProductQuestionRow[]> {
  const normalized = sku.trim().toUpperCase();
  if (!normalized) return [];
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("product_questions")
      .select("id, product_sku, question, auto_reply, status, answered_line, resolved_by, resolved_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("product_sku", normalized)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(Math.min(20, Math.max(1, limit)));

    if (error) {
      if (missingTable(error.message)) return [];
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getOpenProductQuestion(id: string): Promise<ProductQuestionRow | null> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("product_questions")
      .select("id, product_sku, question, auto_reply, status, answered_line, resolved_by, resolved_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .eq("status", "open")
      .maybeSingle();

    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function resolveProductQuestion(input: {
  id: string;
  status: "answered" | "dismissed";
  answeredLine?: string;
  resolvedBy: string;
}): Promise<{ error: string | null; row: ProductQuestionRow | null }> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("product_questions")
      .update({
        status: input.status,
        answered_line: (input.answeredLine ?? "").trim().slice(0, 400),
        resolved_by: input.resolvedBy.trim().slice(0, 120),
        resolved_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", input.id)
      .eq("status", "open")
      .select("id, product_sku, question, auto_reply, status, answered_line, resolved_by, resolved_at, created_at")
      .maybeSingle();

    if (error) {
      return {
        error: missingTable(error.message)
          ? "Falta product_questions. Ejecuta supabase/migrations/012_product_questions.sql."
          : error.message,
        row: null,
      };
    }
    if (!data) return { error: "Esa pregunta ya no está abierta.", row: null };
    return { error: null, row: mapRow(data as Record<string, unknown>) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo resolver la pregunta.",
      row: null,
    };
  }
}
