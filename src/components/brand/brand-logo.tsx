import { cx } from "@/lib/cx";

/** Logotipo oficial COMPRUKÍ (PNG con fondo transparente). */
export function BrandLogo({
  className,
  priority = false,
  title,
}: {
  className?: string;
  priority?: boolean;
  title?: string;
}) {
  return (
    // Logo estático local; next/image no aporta aquí frente a control fino de altura.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/compruki-logo.png"
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
