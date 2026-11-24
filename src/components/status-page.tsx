import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { safeFailureCode } from "@/lib/failure-copy";

type Action = {
  href?: string;
  label: string;
  title?: string;
  primary?: boolean;
  onClick?: () => void;
};

export function StatusPage({
  eyebrow,
  title,
  body,
  actions,
  asideTitle = "Qué puedes hacer",
  asideItems,
  showBrand = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions: Action[];
  asideTitle?: string;
  asideItems: Array<{ label: string; text: string }>;
  showBrand?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={showBrand ? "mx-auto max-w-6xl px-4 py-4" : undefined}>
      {showBrand ? (
        <div className="mb-4">
          <Wordmark />
        </div>
      ) : null}
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
      <h1 className="mt-1 text-[24px] leading-7 font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted">{body}</p>

      <section className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="status-guia">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Guía</p>
        <h2 id="status-guia" className="mt-0.5 text-sm font-semibold">{asideTitle}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {asideItems.map((item) => (
            <li key={item.label}>
              <span className="font-semibold text-sm">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3">
        <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          {actions.map((action) => <ActionControl key={action.label} action={action} />)}
        </nav>
      </div>
    </div>
  );
}

function ActionControl({ action }: { action: Action }) {
  const className = action.primary
    ? "inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark"
    : "inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold";

  if (action.href) {
    return (
      <Link href={action.href} title={action.title} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" title={action.title} className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function ErrorDigest({ digest }: { digest?: string }) {
  const code = safeFailureCode(digest);
  if (!code) return null;
  return <p className="mt-3 text-xs leading-5 text-muted">Código de referencia: {code}</p>;
}
