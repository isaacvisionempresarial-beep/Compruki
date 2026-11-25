import { cx } from "@/lib/cx";

/** Logotipo oficial COMPRUKÍ (PNG con fondo transparente). */
export function BrandLogo({
  className,
  priority = false,
  title,
  onDark = false,
}: {
  className?: string;
  priority?: boolean;
  title?: string;
  /** Versión clara para fondos oscuros (panel). */
  onDark?: boolean;
}) {
  return (
    // Logo estático local; next/image no aporta aquí frente a control fino de altura.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={onDark ? "/brand/compruki-logo-on-dark.png" : "/brand/compruki-logo.png"}
      alt="COMPRUKÍ"
      title={title}
      width={1024}
      height={341}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cx("h-7 w-auto max-w-[9.5rem] object-contain object-left", className)}
    />
  );
}
