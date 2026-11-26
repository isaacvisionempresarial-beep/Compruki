"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useActionState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  requestPasswordReset,
  signIn,
  signOut,
  updatePassword,
  type RecoverState,
  type SignInState,
  type UpdatePasswordState,
} from "@/server/auth";

const initialState: SignInState = { error: null };

type Mode = "login" | "recovery" | "nueva-clave";

export function LoginScreen({
  initialMode = "login",
  linkError = false,
  accessDenied = false,
  otherStore = false,
}: {
  initialMode?: Mode;
  linkError?: boolean;
  accessDenied?: boolean;
  otherStore?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="login-shell min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
      <section className="login-hero relative hidden overflow-hidden text-on-dark lg:flex" aria-label="Presentación">
        <Image
          src="/brand/login-hero.jpg"
          alt=""
          fill
          priority
          sizes="58vw"
          className="login-hero-photo object-cover"
        />
        <div className="login-hero-veil absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex min-h-dvh w-full flex-col px-10 py-10 xl:px-14">
          <BrandLogo onDark className="h-9 max-w-[12.5rem]" priority />
          <div className="mt-auto max-w-md pb-2">
            <p className="store-display text-[2.75rem] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance">
              Vende claro. Atiende rápido.
            </p>
            <p className="mt-3 max-w-[36ch] text-sm leading-6 text-on-dark/88">
              Catálogo, pedidos, clientes y WhatsApp en un solo panel para tu comercio.
            </p>
            <p className="mt-6 text-[11px] font-semibold tracking-[0.08em] text-on-dark-muted uppercase">
              Colombia · COMPRUKÍ
            </p>
          </div>
        </div>
      </section>

      <main id="contenido" tabIndex={-1} className="relative flex min-h-dvh flex-col outline-none">
        <div className="login-mobile-hero relative h-44 overflow-hidden sm:h-52 lg:hidden">
          <Image
            src="/brand/login-hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="login-hero-veil absolute inset-0" aria-hidden="true" />
          <div className="relative z-10 flex h-full flex-col justify-between px-5 py-5 text-on-dark">
            <BrandLogo onDark className="h-8 max-w-[11rem]" priority />
            <p className="store-display max-w-[13ch] text-[1.7rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
              Vende claro. Atiende rápido.
            </p>
          </div>
        </div>

        <div className="login-form-panel relative flex flex-1 items-start px-5 py-7 sm:px-8 sm:py-10 lg:items-center lg:px-12">
          <div className="login-form-rise mx-auto w-full max-w-[400px]">
            <div className="rounded-[20px] border border-line/70 bg-card/95 px-5 py-6 shadow-[0_22px_48px_-30px_rgb(23_26_40/0.42)] backdrop-blur-[2px] sm:px-7 sm:py-7">
              {mode === "login" ? (
                <LoginForm onRecover={() => setMode("recovery")} accessDenied={accessDenied} otherStore={otherStore} />
              ) : null}
              {mode === "recovery" ? <RecoveryForm onBack={() => setMode("login")} linkError={linkError} /> : null}
              {mode === "nueva-clave" ? <NewPasswordForm onBack={() => setMode("login")} /> : null}
            </div>

            <Link
              href="/tienda"
              target="_self"
              className="login-store-cta group mt-4 block overflow-hidden rounded-[18px] border border-line/80 bg-card/90 shadow-[0_14px_32px_-28px_rgb(23_26_40/0.4)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-[0_18px_36px_-26px_rgb(37_199_165/0.45)]"
              title="Abrir la tienda pública"
            >
              <span className="flex items-center gap-3 bg-[linear-gradient(120deg,#222638_0%,#2c334c_55%,#1f6f5c_140%)] px-4 py-3.5">
                <BrandLogo onDark className="h-8 max-w-[10.5rem]" />
                <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary-dark transition-transform group-hover:translate-x-0.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
              <span className="block px-4 py-3">
                <span className="block text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">
                  Tienda online
                </span>
                <span className="store-display mt-0.5 block text-[1.08rem] leading-tight font-extrabold tracking-[-0.02em] text-ink">
                  Entrar a la tienda
                </span>
                <span className="mt-0.5 block text-xs leading-4 text-muted">
                  Catálogo y compras para tus clientes. Sin entrar al panel.
                </span>
              </span>
            </Link>

            <p className="mt-4 text-center text-xs leading-5 text-muted">
              El panel es para tu equipo. La tienda es para tus compradores.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginForm({
  onRecover,
  accessDenied,
  otherStore,
}: {
  onRecover: () => void;
  accessDenied?: boolean;
  otherStore?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Equipo COMPRUKÍ</p>
      <h1 className="store-display mt-1 text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em]">
        Iniciar sesión
      </h1>
      <p className="mt-1.5 text-sm leading-5 text-muted">Entra al panel de tu tienda con tu correo.</p>

      {otherStore ? (
        <AccessAlert
          message="Tu cuenta pertenece a otra tienda. Este panel solo abre COMPRUKÍ."
          actionLabel="Cerrar sesión"
        />
      ) : null}

      {accessDenied ? (
        <AccessAlert
          message="Tu cuenta entró, pero aún no tiene membresía en COMPRUKÍ. Pide acceso al propietario o cierra sesión."
          actionLabel="Cerrar sesión"
        />
      ) : null}

      <form action={formAction} className="mt-5 space-y-3.5">
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
            defaultValue=""
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field label="Contraseña" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              title="Escribirla no cobra ni cambia pedidos."
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              defaultValue=""
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              className={`${inputClass} pr-20`}
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-xs font-semibold text-accent-strong hover:bg-accent-tint"
              aria-pressed={visible}
              title="Mostrarla u ocultarla no cobra ni cambia pedidos."
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>

        {state.error ? (
          <p id="login-error" role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          title="Entrar no cobra ni cambia pedidos."
          className={`mt-2 inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-on-dark transition-colors hover:bg-primary-soft active:bg-primary-dark ${
            pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
          }`}
          disabled={pending}
        >
          {pending ? "Entrando…" : "Entrar al panel"}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/80 pt-4 text-sm">
          <Link
            href="/ingresar?modo=nueva-clave"
            target="_self"
            className="font-semibold text-accent-strong hover:underline"
          >
            Cambiar contraseña
          </Link>
          <button
            type="button"
            title="Abrirlo no envía el enlace ni cobra."
            className="font-semibold text-muted hover:text-ink"
            onClick={onRecover}
          >
            Olvidé mi acceso
          </button>
        </div>
      </form>
    </>
  );
}

function RecoveryForm({ onBack, linkError }: { onBack: () => void; linkError?: boolean }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {
    error: null,
    sent: false,
  } satisfies RecoverState);
  const [email, setEmail] = useState("");
  const canSend = Boolean(email.trim() && email.includes("@"));

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Equipo COMPRUKÍ</p>
      <h1 className="store-display mt-1 text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em]">
        Recuperar acceso
      </h1>
      <p className="mt-1.5 text-sm leading-5 text-muted">Te enviamos un enlace para elegir la nueva contraseña.</p>

      {linkError ? (
        <p role="alert" className="mt-4 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
          El enlace no se pudo usar. Pide uno nuevo o cambia la contraseña con tu clave actual.
        </p>
      ) : null}

      <form action={formAction} className="mt-5 space-y-3.5">
        <Field label="Correo" htmlFor="recovery-email">
          <input
            id="recovery-email"
            title="Escribirlo no envía el enlace ni cobra."
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

        {state.sent ? (
          <p role="status" className="rounded-[12px] border border-line bg-subtle/70 px-3 py-2.5 text-sm leading-5 text-ink">
            Si el correo existe, recibirás el enlace. Ábrelo en este mismo navegador.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          title="Enviarlo no cobra ni cambia pedidos."
          disabled={!canSend || pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "Enviando…" : state.sent ? "Volver a enviar" : "Enviar enlace"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <Link
          href="/ingresar?modo=nueva-clave"
          target="_self"
          title="Abrirla no guarda la contraseña ni cobra."
          className="font-semibold text-accent-strong hover:underline"
        >
          Ya tengo el enlace
        </Link>
        <button type="button" title="Volver no envía el enlace ni cobra." className="font-semibold text-muted hover:text-ink" onClick={onBack}>
          Volver
        </button>
      </div>
    </>
  );
}

function NewPasswordForm({ onBack }: { onBack: () => void }) {
  const [state, formAction, pending] = useActionState(updatePassword, {
    error: null,
    ok: false,
  } satisfies UpdatePasswordState);
  const [email, setEmail] = useState("isaacvisionempresarial@gmail.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const canSave = password.length >= 8 && password === confirm;

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Equipo COMPRUKÍ</p>
      <h1 className="store-display mt-1 text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em]">
        Nueva contraseña
      </h1>
      <p className="mt-1.5 text-sm leading-5 text-muted">
        Con el enlace basta la clave nueva. Si no, escribe también la actual.
      </p>

      <form action={formAction} className="mt-5 space-y-3.5">
        <Field label="Correo" htmlFor="new-email">
          <input
            id="new-email"
            title="Escribirlo no guarda la contraseña ni cobra."
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Contraseña actual (opcional)" htmlFor="current-password">
          <input
            id="current-password"
            title="Escribirla no guarda la contraseña ni cobra."
            name="currentPassword"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Nueva contraseña" htmlFor="new-password">
          <div className="relative">
            <input
              id="new-password"
              title="Escribirla no guarda la contraseña ni cobra."
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-20`}
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-xs font-semibold text-accent-strong hover:bg-accent-tint"
              aria-pressed={visible}
              title="Mostrarla u ocultarla no cobra ni cambia pedidos."
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>

        <Field label="Confirmar" htmlFor="confirm-password">
          <input
            id="confirm-password"
            title="Escribirla no guarda la contraseña ni cobra."
            name="confirm"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={inputClass}
          />
        </Field>

        {state.error ? (
          <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <p className="text-xs leading-5 text-muted">
          {canSave ? "Al guardar entrarás al panel." : "Mínimo 8 caracteres y que coincidan."}
        </p>

        <button
          type="submit"
          title="Guardarla no cobra ni cambia pedidos."
          disabled={!canSave || pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        <button type="button" title="Volver no guarda la contraseña ni cobra." className="font-semibold text-muted hover:text-ink" onClick={onBack}>
          Volver a iniciar sesión
        </button>
      </div>
    </>
  );
}

function AccessAlert({ message, actionLabel }: { message: string; actionLabel: string }) {
  return (
    <div className="mt-4 space-y-2">
      <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
        {message}
      </p>
      <form action={signOut}>
        <button
          type="submit"
          title="Cerrarla no cobra ni cambia pedidos."
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
        >
          {actionLabel}
        </button>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted transition-[border-color,box-shadow] focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_rgba(37,199,165,0.14)] focus:outline-none";
