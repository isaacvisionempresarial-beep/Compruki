import { createAdminSupabase } from "@/lib/supabase/admin";
import { AGENT_ROLES, type AgentRoleDefinition } from "@/lib/agents/roles";
import { listProducts } from "@/server/catalog-store";
import { listOrders } from "@/server/order-store";
import { getPilotTenantId } from "@/server/tenant";

export type AgentGatewayStatus = {
  openaiConnected: boolean;
  dropiConnected: boolean;
  checkoutIndependent: true;
  message: string;
};

export type AgentConfigRow = {
  agentId: string;
  enabled: boolean;
  monthlyBudgetCop: number;
  notes: string;
};

export type AgentMonthSpend = {
  agentId: string;
  runCount: number;
  costEstimateCop: number;
};

export type AgentCenterView = {
  status: AgentGatewayStatus;
  roles: Array<AgentRoleDefinition & { config: AgentConfigRow | null }>;
  storeSummary: {
    publishedProducts: number;
    availableProducts: number;
    openOrders: number;
    pendingConfirmation: number;
  };
  monthSpend: {
    periodLabel: string;
    totalCostEstimateCop: number;
    totalRuns: number;
    byAgent: AgentMonthSpend[];
  };
  recentRuns: Array<{
    id: string;
    agentId: string;
    status: string;
    summary: string;
    createdAt: string;
  }>;
};

/** Puerta de agentes: sin OpenAI aún. El checkout no depende de este módulo. */
export function getAgentGatewayStatus(): AgentGatewayStatus {
  return {
    openaiConnected: false,
    dropiConnected: false,
    checkoutIndependent: true,
    message:
      "Piloto P0-IA en modo determinista: Central, Explorador, Creador y Analista usan datos locales. OpenAI no está conectado. Dropi no está conectado. Pedidos y checkout siguen por su cuenta.",
  };
}

export async function getAgentCenterView(): Promise<AgentCenterView> {
  const status = getAgentGatewayStatus();
  const configs = await loadAgentConfigs();
  const configById = new Map(configs.map((row) => [row.agentId, row]));

  const [products, orders, recentRuns, monthSpend] = await Promise.all([
    listProducts(),
    listOrders(),
    loadRecentRuns(),
    loadMonthSpend(),
  ]);

  return {
    status,
    roles: AGENT_ROLES.map((role) => ({
      ...role,
      config: configById.get(role.id) ?? null,
    })),
    storeSummary: {
      publishedProducts: products.filter((product) => product.published).length,
      availableProducts: products.filter((product) => product.published && product.available).length,
      openOrders: orders.filter((order) => !["entregado", "cancelado", "devuelto"].includes(order.status)).length,
      pendingConfirmation: orders.filter((order) => order.status === "pendiente_confirmacion").length,
    },
    monthSpend,
    recentRuns,
  };
}

async function loadAgentConfigs(): Promise<AgentConfigRow[]> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_configs")
      .select("agent_id, enabled, monthly_budget_cop, notes")
      .eq("tenant_id", tenantId);

    if (error) {
      // Tabla aún no creada: el UI sigue con roles de diseño.
      return [];
    }

    return (data ?? []).map((row) => ({
      agentId: String(row.agent_id),
      enabled: row.enabled === true,
      monthlyBudgetCop: Number(row.monthly_budget_cop) || 0,
      notes: typeof row.notes === "string" ? row.notes : "",
    }));
  } catch {
    return [];
  }
}

async function loadRecentRuns() {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("id, agent_id, status, summary, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data) return [];

    return data.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      status: String(row.status),
      summary: typeof row.summary === "string" ? row.summary : "",
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function loadMonthSpend(): Promise<AgentCenterView["monthSpend"]> {
  const periodLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const empty = { periodLabel, totalCostEstimateCop: 0, totalRuns: 0, byAgent: [] as AgentMonthSpend[] };

  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("agent_id, cost_estimate_cop")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStartIso());

    if (error || !data) return empty;

    const map = new Map<string, AgentMonthSpend>();
    for (const row of data) {
      const agentId = String(row.agent_id);
      const current = map.get(agentId) ?? { agentId, runCount: 0, costEstimateCop: 0 };
      current.runCount += 1;
      current.costEstimateCop += Math.max(0, Number(row.cost_estimate_cop) || 0);
      map.set(agentId, current);
    }

    const byAgent = [...map.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
    return {
      periodLabel,
      totalCostEstimateCop: byAgent.reduce((sum, row) => sum + row.costEstimateCop, 0),
      totalRuns: byAgent.reduce((sum, row) => sum + row.runCount, 0),
      byAgent,
    };
  } catch {
    return empty;
  }
}
