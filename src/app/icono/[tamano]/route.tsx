import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/mark";

const allowed = new Set([192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ tamano: string }> }) {
  const { tamano } = await params;
  const size = Number(tamano);
  if (!allowed.has(size)) return new Response("No encontrado", { status: 404 });
  return new ImageResponse(<BrandMark size={size} centered />, { width: size, height: size });
}
