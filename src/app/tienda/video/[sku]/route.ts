import { loadProductVideo } from "@/server/catalog-store";

export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const video = await loadProductVideo(sku, true);
  if (!video) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(video.bytes), {
    headers: {
      "Content-Type": video.type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
