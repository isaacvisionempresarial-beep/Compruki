export function RouteLoading({
  eyebrow,
  title,
  hint,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "mx-auto max-w-[1600px] pb-8" : undefined} aria-busy="true">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
      <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted">{hint}</p>
      <p className="sr-only" role="status">
        Cargando
      </p>

      <div className="mt-3 grid gap-3" aria-hidden="true">
        <div className="elevate-1 route-skeleton h-28 rounded-[14px] border border-line bg-card" />
        <div className="elevate-1 route-skeleton h-32 rounded-[14px] border border-line bg-card" />
      </div>
    </div>
  );
}
