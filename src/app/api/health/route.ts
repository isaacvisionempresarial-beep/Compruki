import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/server/health";

export const dynamic = "force-dynamic";

/** Readiness liviano para deploy. No expone secretos. openaiConnected no bloquea el 200. */
export async function GET() {
  const snapshot = await getHealthSnapshot();

  return NextResponse.json(
    {
      ok: snapshot.ok,
      service: "compruki",
      dropiConnected: snapshot.dropiConnected,
      openaiConnected: snapshot.openaiConnected,
      checks: snapshot.checks,
    },
    {
      status: snapshot.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
