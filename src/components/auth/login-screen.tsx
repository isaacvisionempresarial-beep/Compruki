"use client";

import { useState, type ReactNode } from "react";
import { useActionState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="brand-panel hidden flex-col px-8 py-8 text-on-dark lg:flex lg:px-12" aria-label="Presentación">
        <Wordmark onDark />
        <div className="mt-8 max-w-lg">
          <p className="text-3xl font-semibold tracking-tight text-balance">«Tu negocio, en modo venta.»</p>
          <p className="mt-2 text-sm leading-5 text-on-dark-muted">
            El panel está en tres bloques. Leer esto no cobra ni cambia pedidos. Dropi no está conectado.
          </p>
          <dl className="mt-4 grid gap-3">
            <div>
              <dt className="text-[10px] font-bold tracking-[0.08em] text-on-dark-muted uppercase">Tienda</dt>
              <dd className="mt-0.5 text-sm leading-5 text-[#E7EAF2]">Panel, pedidos, catálogo y rentabilidad. El margen estimado no se presenta como dinero cobrado.</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-[0.08em] text-on-dark-muted uppercase">Operación</dt>
              <dd className="mt-0.5 text-sm leading-5 text-[#E7EAF2]">Sincronización y conexiones. Cada pedido tiene un estado claro. Dropi no está conectado.</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-[0.08em] text-on-dark-muted uppercase">Sistema</dt>
              <dd className="mt-0.5 text-sm leading-5 text-[#E7EAF2]">Centro de agentes y configuración. Publica solo lo que ya revisaste.</dd>
            </div>
          </dl>
        </div>
        <p className="mt-auto pt-8 text-xs text-on-dark-muted">Identidad provisional para el prototipo · Colombia</p>
      </section>

      <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-start bg-canvas px-4 py-4 outline-none sm:px-8 lg:items-center lg:px-12">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-4 lg:hidden">
            <Wordmark />
            <p className="mt-2 text-lg font-semibold tracking-tight">«Tu negocio, en modo venta.»</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              Tienda, operación y sistema. Leer esto no cobra ni cambia pedidos. Dropi no está conectado.
            </p>
          </div>

          <div className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 sm:px-4">
            {mode === "login" ? (
              <LoginForm onRecover={() => setMode("recovery")} accessDenied={accessDenied} otherStore={otherStore} />
            ) : null}
            {mode === "recovery" ? <RecoveryForm onBack={() => setMode("login")} linkError={linkError} /> : null}
            {mode === "nueva-clave" ? <NewPasswordForm onBack={() => setMode("login")} /> : null}
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const canEnter = Boolean(email.trim() && email.includes("@") && password);

  return (
    <>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sesión</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted">Correo de tu comercio. Escribirlo no cobra ni cambia pedidos. Dropi no está conectado.</p>

      {otherStore ? (
        <div className="mt-3 space-y-2">
          <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            Tu cuenta es de otra tienda. Este panel solo abre la tienda piloto. No se leyeron ni se cambiaron sus pedidos.
          </p>
          <form action={signOut} className="contents">
            <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
              <button
                type="submit"
                title="Cerrarla no cobra ni cambia pedidos."
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
              >
                Cerrar sesión
              </button>
            </nav>
            <p className="mt-1 text-xs leading-5 text-muted">Cerrarla no cobra ni cambia pedidos.</p>
          </form>
        </div>
      ) : null}

      {accessDenied ? (
        <div className="mt-3 space-y-2">
          <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            Tu cuenta entró, pero no tiene membresía en la tienda piloto. No cobra ni cambia pedidos. Pide que te enlacen en Supabase
            (tabla memberships) o cierra sesión.
          </p>
          <form action={signOut} className="contents">
            <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
              <button
                type="submit"
                title="Cerrarla no cobra ni cambia pedidos."
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-subtle"
              >
                Cerrar sesión
              </button>
            </nav>
            <p className="mt-1 text-xs leading-5 text-muted">Cerrarla no cobra ni cambia pedidos.</p>
          </form>
        </div>
      ) : null}

      <form action={formAction} className="mt-3 space-y-2">
        <Field label="Correo" htmlFor="email">
          <input
            id="email"
            title="Escribirlo no cobra ni cambia pedidos."
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
              title="Escribirla no cobra ni cambia pedidos."
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

        <p className="text-xs leading-5 text-muted">
          {canEnter ? "Entras al panel de la tienda piloto." : "Sin correo y contraseña el botón queda bloqueado."} Entrar no cobra ni cambia pedidos. Mostrarla u ocultarla tampoco.
        </p>

        <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <button
            type="submit"
            title="Entrar no cobra ni cambia pedidos."
            className={`inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark ${
              pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"
            }`}
            disabled={pending || !canEnter}
          >
            {pending ? "Entrando…" : "Entrar al panel"}
          </button>
          <a href="/ingresar?modo=nueva-clave" title="Abrirla no cobra ni cambia pedidos." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Cambiar contraseña
          </a>
          <button type="button" title="Abrirlo no envía el enlace ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle" onClick={onRecover}>
            Olvidé mi acceso
          </button>
        </nav>
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
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sesión</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Recuperar acceso</h1>
      <p className="mt-1 text-sm text-muted">
        Te enviamos un enlace. Al abrirlo volverás aquí para elegir la nueva contraseña. Pedir el enlace no cobra ni cambia pedidos. Dropi no está conectado.
      </p>

      {linkError ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
          El enlace no se pudo usar. Pide uno nuevo o cambia la contraseña con tu clave actual.
        </p>
      ) : null}

      <form action={formAction} className="mt-3 space-y-2">
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
          <p role="status" className="elevate-1 rounded-[14px] border border-line bg-card px-3 py-2 text-sm leading-5 text-ink">
            Si el correo existe, recibirás el enlace. Ábrelo en este mismo navegador; te traerá a «Nueva
            contraseña». Recibirlo no cobra ni cambia pedidos.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <button
            type="submit"
            title="Enviarlo no cobra ni cambia pedidos."
            disabled={!canSend || pending}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? "Enviando…" : state.sent ? "Volver a enviar" : "Enviar enlace"}
          </button>
        </nav>
      </form>

      <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
        <a href="/ingresar?modo=nueva-clave" title="Abrirla no guarda la contraseña ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
          Ya puedo cambiar la contraseña aquí
        </a>
        <button type="button" title="Volver no envía el enlace ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle" onClick={onBack}>
          Volver a iniciar sesión
        </button>
      </nav>
      <p className="mt-2 text-xs leading-5 text-muted">Volver no envía el enlace ni cobra.</p>
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
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sesión</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Nueva contraseña</h1>
      <p className="mt-1 text-sm text-muted">
        Si viniste del correo de recuperación, basta la clave nueva. Si no, escribe también la actual (por ejemplo{" "}
        <span className="font-semibold">ComprukiTemp2026!</span>). Cambiarla no cobra ni cambia pedidos.
      </p>

      <form action={formAction} className="mt-3 space-y-2">
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

        <Field label="Contraseña actual (si no usaste el enlace)" htmlFor="current-password">
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
              className={`${inputClass} pr-24`}
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-[10px] px-2 text-sm font-semibold text-accent-strong"
              aria-pressed={visible}
              title="Mostrarla u ocultarla no cobra ni cambia pedidos."
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>

        <Field label="Confirmar nueva contraseña" htmlFor="confirm-password">
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
          {canSave ? "Al guardar entrarás al panel con la nueva clave." : "Mínimo 8 caracteres y que coincidan."}
        </p>

        <nav aria-label="Herramientas" className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Herramientas</span>
          <button
            type="submit"
            title="Guardarla no cobra ni cambia pedidos."
            disabled={!canSave || pending}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? "Guardando…" : "Guardar y entrar"}
          </button>
        </nav>
      </form>
      <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
        <button type="button" title="Volver no guarda la contraseña ni cobra." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle" onClick={onBack}>
          Volver a iniciar sesión
        </button>
      </nav>
      <p className="mt-2 text-xs leading-5 text-muted">Volver no guarda la contraseña ni cobra.</p>
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
