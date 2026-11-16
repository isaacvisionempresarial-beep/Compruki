import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

type Action = {
  href?: string;
  label: string;
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
  wide = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions: Action[];
  asideTitle?: string;
  asideItems: Array<{ label: string; text: string }>;
  showBrand?: boolean;
  /** Panel chrome sticky offset (~3.75rem); tienda/root use ~3rem. */
  wide?: boolean;
}) {
  const stickyTop = wide ? "xl:top-[3.75rem]" : "xl:top-[3rem]";
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

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="order-2 min-w-0 xl:order-1">
          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2">
            <div className="flex flex-wrap gap-2">{actions.map((action) => <ActionControl key={action.label} action={action} />)}</div>
          </div>
        </div>
        <aside className={`elevate-1 order-1 rounded-[14px] border border-line bg-card px-3 py-2 xl:sticky ${stickyTop} xl:order-2`}>
          <h2 className="text-sm font-semibold">{asideTitle}</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5">
            {asideItems.map((item) => (
              <li key={item.label}>
                <span className="font-semibold text-sm">{item.label}</span>
                <span className="mt-0.5 block text-muted">{item.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function ActionControl({ action }: { action: Action }) {
  const className = action.primary
    ? "inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark"
    : "inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-4 text-sm font-semibold";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function ErrorDigest({ digest }: { digest?: string }) {
  if (!digest) return null;
  return <p className="mt-3 text-xs leading-5 text-muted">Código de referencia: {digest}</p>;
}
