import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InboxScreen } from "@/components/panel/inbox-screen";
import { hasPermission, requirePanelAccess } from "@/server/panel-auth";
import { loadInboxPanelData } from "@/server/whatsapp-inbox-actions";

export const metadata: Metadata = {
  title: "Inbox WhatsApp",
  description: "Bandeja de conversaciones Meta Cloud API con pipeline CRM.",
};

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; phone?: string; name?: string; f?: string }>;
}) {
  const access = await requirePanelAccess();
  if (!hasPermission(access, "whatsapp_manage")) {
    redirect("/panel/whatsapp");
  }
  const params = await searchParams;
  const filterRaw = (params.f ?? "").trim().toLowerCase();
  const initialFilter =
    filterRaw === "mine" ||
    filterRaw === "unassigned" ||
    filterRaw === "unread" ||
    filterRaw === "awaiting" ||
    filterRaw === "urgent" ||
    filterRaw === "template"
      ? filterRaw
      : "all";
  const data = await loadInboxPanelData({
    activeId: params.c ?? null,
    phone: params.phone ?? null,
    contactName: params.name ?? null,
  });
  return (
    <InboxScreen
      tableReady={data.tableReady}
      initialConversations={data.conversations}
      initialActiveId={data.activeId}
      initialMessages={data.messages}
      initialActiveOrders={data.activeOrders}
      initialActiveOrderExtra={data.activeOrderExtra}
      assignees={data.assignees}
      templates={data.templates}
      actorUserId={data.actorUserId}
      roleLabel={data.roleLabel || access.roleLabel}
      bootError={data.bootError}
      initialFilter={initialFilter}
    />
  );
}
