import { getPanelAccess } from "@/server/panel-auth";
import { loadProductImage } from "@/server/catalog-store";

export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  if (!(await getPanelAccess())) return new Response("No encontrado", { status: 404 });
  const { sku } = await params;
  const asset = new URL(_request.url).searchParams.get("m");
  const image = await loadProductImage(sku, false, asset);
  if (!image) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
