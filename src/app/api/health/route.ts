import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/server/health";

export const dynamic = "force-dynamic";

/**
 * Readiness liviano para deploy.
 * Público: solo ok/servicio (sin mapa de checks ni openai).
 * El detalle sigue en el panel vía getHealthSnapshot().
 */
export async function GET() {
  const snapshot = await getHealthSnapshot();

  return NextResponse.json(
    {
      ok: snapshot.ok,
      service: "compruki",
    },
    {
      status: snapshot.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
