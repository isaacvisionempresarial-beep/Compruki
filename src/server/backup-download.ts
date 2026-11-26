import { assertPanelAccess, hasPermission } from "@/server/panel-auth";

export async function ownerBackupResponse(filename: string, build: () => Promise<string>) {
  const access = await assertPanelAccess();
  if (!access) return new Response("No autorizado", { status: 401 });
  if (!hasPermission(access, "backups")) {
    return new Response("Tu rol no permite descargar el respaldo.", { status: 403 });
  }

  const body = await build();
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
