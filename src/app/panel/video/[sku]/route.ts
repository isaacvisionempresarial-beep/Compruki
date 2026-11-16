import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";
import { loadProductVideo } from "@/server/catalog-store";

export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value !== SESSION_VALUE) return new Response("No encontrado", { status: 404 });
  const { sku } = await params;
  const video = loadProductVideo(sku, false);
  if (!video) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(video.bytes), {
    headers: {
      "Content-Type": video.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
