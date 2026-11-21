import { bogotaNow } from "@/lib/catalog";
import { ordersToBackupCsv } from "@/lib/commerce-backup";
import { ownerBackupResponse } from "@/server/backup-download";
import { listOrders } from "@/server/order-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const stamp = bogotaNow().slice(0, 10);
  return ownerBackupResponse(`compruki-pedidos-${stamp}.csv`, async () => ordersToBackupCsv(await listOrders()));
}
