import { bogotaNow } from "@/lib/catalog";
import { catalogToBackupCsv } from "@/lib/commerce-backup";
import { ownerBackupResponse } from "@/server/backup-download";
import { listProducts } from "@/server/catalog-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const stamp = bogotaNow().slice(0, 10);
  return ownerBackupResponse(`compruki-fichas-${stamp}.csv`, async () => catalogToBackupCsv(await listProducts()));
}
