import { listOpenFollowups } from "@/server/followups";
import { countInboxUnread, listInboxConversations, probeInboxTables } from "@/server/whatsapp-inbox";

export type OpsSnapshot = {
  inboxReady: boolean;
  unread: number;
  openChats: number;
  freeChats: number;
  myChats: number;
  awaitingReply: number;
  urgentWindow: number;
  openFollowups: number;
  overdueFollowups: number;
  highFollowups: number;
  myFollowups: number;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;
const URGENT_LEFT_MS = 2 * 60 * 60 * 1000;

export async function getOpsSnapshot(tenantId: string, actorUserId: string): Promise<OpsSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const inboxReady = await probeInboxTables();

  const [unread, conversations, followups] = await Promise.all([
    inboxReady ? countInboxUnread(tenantId).catch(() => 0) : Promise.resolve(0),
    inboxReady ? listInboxConversations(tenantId, 80).catch(() => []) : Promise.resolve([]),
    listOpenFollowups(100).catch(() => []),
  ]);

  const awaiting = conversations.filter(
    (item) => item.lastDirection === "inbound" && item.status !== "closed",
  );

  return {
    inboxReady,
    unread,
    openChats: conversations.filter((item) => item.status !== "closed").length,
    freeChats: conversations.filter((item) => !item.assignedTo && item.status !== "closed").length,
    myChats: conversations.filter((item) => item.assignedTo === actorUserId).length,
    awaitingReply: awaiting.length,
    urgentWindow: awaiting.filter((item) => {
      if (!item.lastMessageAt) return false;
      const at = new Date(item.lastMessageAt).getTime();
      if (!Number.isFinite(at)) return false;
      const left = at + WINDOW_MS - now;
      return left > 0 && left < URGENT_LEFT_MS;
    }).length,
    openFollowups: followups.length,
    overdueFollowups: followups.filter((task) => task.dueAt && task.dueAt.slice(0, 10) < today).length,
    highFollowups: followups.filter((task) => task.priority === "high").length,
    myFollowups: followups.filter((task) => task.assignedTo === actorUserId).length,
  };
}
