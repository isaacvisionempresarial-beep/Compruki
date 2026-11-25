import type { Metadata } from "next";
import { CustomersScreen } from "@/components/panel/customers-screen";
import { buildCrmContacts } from "@/lib/crm-contacts";
import { getFollowupPriorityPreview } from "@/server/agent-followup-priority";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { listRegisteredStoreAccounts } from "@/server/customer-auth";
import {
  countOpenFollowupsByPhone,
  listOpenFollowups,
  probeFollowupPipeline,
  probeFollowupsTable,
} from "@/server/followups";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";

export const metadata: Metadata = {
  title: "Clientes",
  description: "Cuentas de tienda y CRM lite con seguimientos. WhatsApp no está conectado.",
};

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    creado?: string;
    cerrado?: string;
    movido?: string;
    prioridad?: string;
    error?: string;
    agente?: string;
    agenteError?: string;
  }>;
}) {
  const params = await searchParams;
  await requirePanelAccess();

  const [orders, openTasks, openByPhone, tableReady, pipelineReady, policy, accounts] = await Promise.all([
    listOrders(),
    listOpenFollowups(),
    countOpenFollowupsByPhone(),
    probeFollowupsTable(),
    probeFollowupPipeline(),
    evaluateAgentPolicy("AG-07"),
    listRegisteredStoreAccounts(),
  ]);

  const contacts = buildCrmContacts(orders, openByPhone);
  const priority = params.prioridad === "1" ? getFollowupPriorityPreview() : null;

  const flash =
    params.creado === "1"
      ? "Seguimiento guardado. No se envió mensaje."
      : params.cerrado === "1"
        ? "Seguimiento cerrado."
        : params.movido === "1"
          ? "Etapa actualizada."
          : null;

  return (
    <CustomersScreen
      accounts={accounts}
      contacts={contacts}
      openTasks={openTasks}
      tableReady={tableReady}
      pipelineReady={pipelineReady}
      priority={priority}
      ag07Enabled={policy.ok}
      flash={flash}
      error={params.error?.trim() || null}
      policyError={params.agente === "AG-07" ? params.agenteError?.trim() || null : null}
    />
  );
}
