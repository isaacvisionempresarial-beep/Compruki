"use client";

import { useState, type ReactNode } from "react";
import { useActionState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/icons";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-account";
import { signIn, type SignInState } from "@/server/auth";

const initialState: SignInState = { error: null };

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "recovery">("login");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="brand-panel hidden flex-col px-8 py-8 text-on-dark lg:flex lg:px-12" aria-label="Presentación">
        <Wordmark onDark />
        <div className="mt-8 max-w-md">
          <p className="text-3xl font-semibold tracking-tight text-balance">«Tu negocio, en modo venta.»</p>
          <p className="mt-2 text-sm leading-5 text-on-dark-muted">
            Pedidos, sincronización, catálogo y rentabilidad, cada uno en su sitio. Dropi no está conectado.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Publica solo lo que ya revisaste.",
              "Cada pedido tiene un estado claro.",
              "El margen estimado no se presenta como dinero cobrado.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-5 text-[#E7EAF2]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-primary">
                  <Icon name="check" className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-auto pt-8 text-xs text-on-dark-muted">Identidad provisional para el prototipo · Colombia</p>
      </section>

      <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-start bg-canvas px-4 py-4 outline-none sm:px-8 lg:items-center lg:px-12">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-4 lg:hidden">
            <Wordmark />
            <p className="mt-2 text-lg font-semibold tracking-tight">«Tu negocio, en modo venta.»</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              Pedidos, sincronización, catálogo y rentabilidad. Dropi no está conectado.
            </p>
          </div>

          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 sm:px-4">
            {mode === "login" ? <LoginForm onRecover={() => setMode("recovery")} /> : <RecoveryForm onBack={() => setMode("login")} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginForm({ onRecover }: { onRecover: () => void }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const canEnter = Boolean(email.trim() && email.includes("@") && password);

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Panel</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted">Correo de tu comercio. Dropi no está conectado.</p>

      <form action={formAction} className="mt-3 space-y-2">
        <Field label="Correo" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field label="Contraseña" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              className={`${inputClass} pr-24`}
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-[10px] px-2 text-sm font-semibold text-accent-strong"
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <button type="button" className="text-sm font-semibold text-accent-strong" onClick={onRecover}>
            Olvidé mi acceso
          </button>
        </div>

        {state.error ? (
          <p id="login-error" role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <p className="text-xs leading-5 text-muted">
          {canEnter ? "Entras al panel de la tienda piloto." : "Sin correo y contraseña el botón queda bloqueado."}
        </p>

        <button
          type="submit"
          className={`inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark ${
            pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
          }`}
          disabled={pending || !canEnter}
        >
          {pending ? "Entrando…" : "Entrar al panel"}
        </button>
      </form>

      <div className="mt-3 rounded-[10px] border border-line bg-subtle px-3 py-2">
        <p className="text-sm font-semibold">Acceso de muestra</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">Prototipo. Auth definitiva con Supabase.</p>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Correo</dt>
            <dd className="font-medium">{DEMO_EMAIL}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Contraseña</dt>
            <dd className="font-medium">{DEMO_PASSWORD}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="mt-2 inline-flex h-10 items-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-canvas"
          onClick={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
          }}
        >
          Llenar con este acceso
        </button>
      </div>
    </>
  );
}

function RecoveryForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const canPrepare = Boolean(email.trim() && email.includes("@"));

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Panel</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Recuperar acceso</h1>
      <p className="mt-1 text-sm text-muted">
        El enlace se enviará cuando el correo quede conectado. Dropi no está conectado.
      </p>

      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canPrepare) return;
          setSent(true);
        }}
      >
        <Field label="Correo" htmlFor="recovery-email">
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        {sent ? (
          <p role="status" className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 text-sm leading-5 text-ink">
            Quedó anotado el correo, pero este prototipo todavía no envía el enlace. Cuando Supabase Auth esté
            conectado, este paso mandará el correo para crear una contraseña nueva.
          </p>
        ) : null}

        <p className="text-xs leading-5 text-muted">
          {canPrepare
            ? "Todavía no se envía el correo. Solo deja el aviso de que falta conectar Auth."
            : "Sin un correo el botón queda bloqueado."}
        </p>

        <button
          type="submit"
          disabled={!canPrepare}
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
        >
          {sent ? "Volver a preparar" : "Preparar enlace"}
        </button>
      </form>

      <button type="button" className="mt-3 text-sm font-semibold text-accent-strong" onClick={onBack}>
        Volver a iniciar sesión
      </button>
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";
