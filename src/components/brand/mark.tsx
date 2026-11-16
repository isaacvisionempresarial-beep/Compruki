export function BrandMark({ size, centered = false }: { size: number; centered?: boolean }) {
  const scale = size / 32;
  const bar = Math.max(1, Math.round(5 * scale));
  const gap = Math.max(1, Math.round(2 * scale));
  const pad = centered ? Math.round(size * 0.22) : Math.max(1, Math.round(6 * scale));
  const radius = Math.max(1, Math.round(scale));
  const inner = size - pad * 2;
  const heights = [10, 18, 13].map((height) =>
    Math.max(1, Math.round(centered ? (height / 20) * inner : height * scale)),
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#222638",
        display: "flex",
        alignItems: centered ? "center" : "flex-end",
        justifyContent: "center",
        gap,
        padding: pad,
      }}
    >
      <div style={{ width: bar, height: heights[0], background: "#25C7A5", borderRadius: radius }} />
      <div style={{ width: bar, height: heights[1], background: "#25C7A5", borderRadius: radius }} />
      <div style={{ width: bar, height: heights[2], background: "#25C7A5", borderRadius: radius }} />
    </div>
  );
}
