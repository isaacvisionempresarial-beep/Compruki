import { BrandMark } from "@/components/brand/mark";

/** Tarjeta OG/Twitter con estilos en línea (ImageResponse). */
export function ShareImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(145deg, #f6f8fc 0%, #edf0f6 48%, #eaf9f5 100%)",
        padding: 64,
        color: "#222638",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <BrandMark size={72} centered />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>COMPRUKI</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#087d70" }}>
            {eyebrow}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontSize: 28, lineHeight: 1.35, color: "#59657a", maxWidth: 900 }}>{subtitle}</div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 600, color: "#59657a" }}>Dropi no está conectado</div>
    </div>
  );
}
