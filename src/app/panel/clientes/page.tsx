import type { Metadata } from "next";
import { CustomersScreen } from "@/components/panel/customers-screen";
import { buildCrmContacts } from "@/lib/crm-contacts";
import { getFollowupPriorityPreview } from "@/server/agent-followup-priority";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { listRegisteredStoreAccounts } from "@/server/customer-auth";
import {
  countOpenFollowupsByPhone,
  listOpenFollowups,
  probeFollowupCrmPro,
  probeFollowupPipeline,
  probeFollowupsTable,
} from "@/server/followups";
import { listOrders } from "@/server/order-store";
import { requirePanelAccess } from "@/server/panel-auth";
import { listTeamMembers } from "@/server/team";

export const metadata: Metadata = {
  title: "Clientes",
  description: "CRM con pipeline Lead → Postventa, cuentas de tienda e Inbox WhatsApp.",
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
    f?: string;
  }>;
}) {
  const params = await searchParams;
  const access = await requirePanelAccess();
  const filterRaw = (params.f ?? "").trim().toLowerCase();
  const initialBoardFilter =
    filterRaw === "mine" || filterRaw === "overdue" || filterRaw === "high" || filterRaw === "all"
      ? filterRaw
      : "all";

  const [orders, openTasks, openByPhone, tableReady, pipelineReady, crmProReady, policy, accounts, members] =
    await Promise.all([
      listOrders(),
      listOpenFollowups(100),
      countOpenFollowupsByPhone(),
      probeFollowupsTable(),
      probeFollowupPipeline(),
      probeFollowupCrmPro(),
      evaluateAgentPolicy("AG-07"),
      listRegisteredStoreAccounts(),
      listTeamMembers(access.tenantId).catch(() => []),
    ]);

  const contacts = buildCrmContacts(orders, openByPhone);
  const priority = params.prioridad === "1" ? getFollowupPriorityPreview() : null;

  const flash =
    params.creado === "1"
      ? "Seguimiento guardado. No se envió mensaje."
      : params.cerrado === "1"
        ? "Seguimiento cerrado."
        : params.movido === "1"
          ? "Pipeline actualizado."
          : null;

  return (
    <CustomersScreen
      accounts={accounts}
      contacts={contacts}
      openTasks={openTasks}
      assignees={members.map((member) => ({
        userId: member.userId,
        name: member.name || member.email,
      }))}
      actorUserId={access.user.id}
      initialBoardFilter={initialBoardFilter}
      tableReady={tableReady}
      pipelineReady={pipelineReady}
      crmProReady={crmProReady}
      priority={priority}
      ag07Enabled={policy.ok}
      flash={flash}
      error={params.error?.trim() || null}
      policyError={params.agente === "AG-07" ? params.agenteError?.trim() || null : null}
    />
  );
}
