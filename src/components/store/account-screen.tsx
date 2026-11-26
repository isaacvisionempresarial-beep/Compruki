"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  customerGoogleSignInAction,
  customerRecoverAction,
  customerSaveProfileAction,
  customerSignInAction,
  customerSignOutAction,
  customerSignUpAction,
  customerUpdatePasswordAction,
  type CustomerAuthState,
} from "@/server/customer-auth-actions";
import type { CustomerOrderSummary } from "@/server/customer-orders";

const initial: CustomerAuthState = { error: null, message: null };

const fieldClass =
  "mt-1 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,199,165,0.12)] focus:outline-none";

type Mode = "login" | "register" | "recovery" | "nueva-clave";

export function AccountScreen({
  nextPath,
  signedIn,
  displayName,
  email,
  phone,
  emailOrderUpdates,
  orders,
  bootError,
  initialMode = "login",
}: {
  nextPath: string;
  signedIn: boolean;
  displayName?: string;
  email?: string;
  phone?: string;
  emailOrderUpdates?: boolean;
  orders?: CustomerOrderSummary[];
  bootError?: string | null;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  if (signedIn) {
    const firstName = (displayName ?? "").trim().split(/\s+/).filter(Boolean)[0] || "tu cuenta";
    return (
      <div className="space-y-3">
        <AccountHero
          eyebrow="Tu cuenta"
          title={firstName}
          note="Perfil, avisos del pedido y tus compras en un solo lugar. Nadie cobra aquí."
        />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ProfileCard
            displayName={displayName ?? ""}
            email={email ?? ""}
            phone={phone ?? ""}
            emailOrderUpdates={emailOrderUpdates !== false}
          />
          <OrdersCard orders={orders ?? []} />
        </div>
      </div>
    );
  }

  const authTitle =
    mode === "register" ? "Crear cuenta" : mode === "recovery" ? "Recuperar clave" : mode === "nueva-clave" ? "Nueva clave" : "Entrar";

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <AccountHero
        eyebrow="Cuenta"
        title={authTitle}
        note="Para pedir necesitas cuenta. Guarda el carrito y recibe avisos del pedido. No cobra."
      />
      <section className="elevate-1 rounded-[18px] border border-line bg-card px-4 py-4 sm:px-5">
        {bootError ? (
          <p role="alert" className="mb-3 text-sm font-semibold text-danger">
            {bootError}
          </p>
        ) : null}
        {mode === "login" ? (
          <AuthLogin nextPath={nextPath} onRegister={() => setMode("register")} onRecover={() => setMode("recovery")} />
        ) : null}
        {mode === "register" ? <AuthRegister nextPath={nextPath} onLogin={() => setMode("login")} /> : null}
        {mode === "recovery" ? <AuthRecover onBack={() => setMode("login")} /> : null}
        {mode === "nueva-clave" ? <AuthNewPassword /> : null}
      </section>
    </div>
  );
}

function AccountHero({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <section className="store-hero store-rise relative overflow-hidden rounded-[18px] border border-line bg-card">
      <div className="absolute inset-0 bg-gradient-to-r from-card via-card to-[#e8eef5]" aria-hidden="true" />
      <div className="store-hero-glow pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
      <div className="relative z-10 grid items-center gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(8.5rem,12.5rem)] sm:gap-4 sm:p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">{eyebrow}</p>
          <h1 className="store-display mt-1 text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">{title}</h1>
          <p className="mt-1.5 text-sm leading-5 text-muted">{note}</p>
        </div>
        <div className="relative isolate mx-auto w-full max-w-[12.5rem] sm:mx-0 sm:justify-self-end" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/store/account-hero.jpg?v=1"
            alt=""
            width={640}
            height={360}
            decoding="async"
            className="h-24 w-full rounded-[14px] object-cover object-center ring-1 ring-line/80 sm:h-28"
          />
        </div>
      </div>
    </section>
  );
}

function GoogleGMark() {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 48 48" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}

function GoogleSignInButton({ nextPath }: { nextPath: string }) {
  return (
    <form action={customerGoogleSignInAction}>
      <input type="hidden" name="next" value={nextPath} />
      <button
        type="submit"
        title="Abre Google para entrar. No cobra."
        className="inline-flex h-11 w-full items-center gap-3 rounded-full bg-[#4285F4] px-2 pr-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition-[filter,transform] hover:brightness-105 active:translate-y-px"
      >
        <GoogleGMark />
        <span className="flex-1 text-center pr-7">Continuar con Google</span>
      </button>
    </form>
  );
}

function AuthLogin({
  nextPath,
  onRegister,
  onRecover,
}: {
  nextPath: string;
  onRegister: () => void;
  onRecover: () => void;
}) {
  const [state, action, pending] = useActionState(customerSignInAction, initial);
  return (
    <div className="mt-4 grid gap-3">
      <GoogleSignInButton nextPath={nextPath} />
      <p className="text-center text-[10px] font-bold tracking-[0.08em] text-muted uppercase">o con correo</p>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="next" value={nextPath} />
        <Field label="Correo" htmlFor="login-email">
          <input id="login-email" name="email" type="email" required autoComplete="email" className={fieldClass} />
        </Field>
        <Field label="Contraseña" htmlFor="login-password">
          <input id="login-password" name="password" type="password" required autoComplete="current-password" className={fieldClass} />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark disabled:cursor-wait"
        >
          Entrar
        </button>
      </form>
      <nav className="flex flex-wrap gap-3 text-sm font-semibold">
        <button type="button" className="text-accent-strong underline-offset-2 hover:underline" onClick={onRegister}>
          Crear cuenta
        </button>
        <button type="button" className="text-muted underline-offset-2 hover:underline" onClick={onRecover}>
          Olvidé la clave
        </button>
      </nav>
    </div>
  );
}

function AuthRegister({ nextPath, onLogin }: { nextPath: string; onLogin: () => void }) {
  const [state, action, pending] = useActionState(customerSignUpAction, initial);
  return (
    <div className="mt-4 grid gap-3">
      <GoogleSignInButton nextPath={nextPath} />
      <form action={action} className="grid gap-3">
        <input type="hidden" name="next" value={nextPath} />
        <Field label="Nombre" htmlFor="reg-name">
          <input id="reg-name" name="name" autoComplete="name" className={fieldClass} />
        </Field>
        <Field label="Correo" htmlFor="reg-email">
          <input id="reg-email" name="email" type="email" required autoComplete="email" className={fieldClass} />
        </Field>
        <Field label="Contraseña" htmlFor="reg-password" hint="Mínimo 8 caracteres.">
          <input id="reg-password" name="password" type="password" required autoComplete="new-password" minLength={8} className={fieldClass} />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm text-accent-strong">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark disabled:cursor-wait"
        >
          Crear cuenta
        </button>
      </form>
      <button type="button" className="text-sm font-semibold text-accent-strong underline-offset-2 hover:underline" onClick={onLogin}>
        Ya tengo cuenta
      </button>
    </div>
  );
}

function AuthRecover({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(customerRecoverAction, initial);
  return (
    <form action={action} className="mt-4 grid gap-3">
      <Field label="Correo" htmlFor="rec-email">
        <input id="rec-email" name="email" type="email" required autoComplete="email" className={fieldClass} />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-accent-strong">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark disabled:cursor-wait"
      >
        Enviar enlace
      </button>
      <button type="button" className="text-sm font-semibold text-muted underline-offset-2 hover:underline" onClick={onBack}>
        Volver
      </button>
    </form>
  );
}

function AuthNewPassword() {
  const [state, action, pending] = useActionState(customerUpdatePasswordAction, initial);
  return (
    <form action={action} className="mt-4 grid gap-3">
      <Field label="Nueva contraseña" htmlFor="new-password">
        <input id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} />
      </Field>
      <Field label="Confirmar" htmlFor="new-confirm">
        <input id="new-confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark disabled:cursor-wait"
      >
        Guardar clave
      </button>
    </form>
  );
}

function ProfileCard({
  displayName,
  email,
  phone,
  emailOrderUpdates,
}: {
  displayName: string;
  email: string;
  phone: string;
  emailOrderUpdates: boolean;
}) {
  const [state, action, pending] = useActionState(customerSaveProfileAction, initial);
  const [nameValue, setNameValue] = useState(displayName);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [notifyMail, setNotifyMail] = useState(emailOrderUpdates);

  useEffect(() => {
    setNameValue(displayName);
    setPhoneValue(phone);
    setNotifyMail(emailOrderUpdates);
  }, [displayName, phone, emailOrderUpdates]);

  return (
    <section className="elevate-1 rounded-[18px] border border-line bg-card px-3.5 py-3.5 sm:px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Perfil</p>
          <h2 className="mt-0.5 text-base font-bold">Datos de contacto</h2>
          <p className="mt-1 truncate text-sm text-muted">{email}</p>
        </div>
        <span className="shrink-0 rounded-[8px] bg-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-accent-strong uppercase">
          Sesión
        </span>
      </div>
      <form action={action} className="mt-3 grid gap-2.5">
        <Field label="Nombre" htmlFor="prof-name">
          <input
            id="prof-name"
            name="name"
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Celular" htmlFor="prof-phone" hint="10 dígitos, opcional.">
          <input
            id="prof-phone"
            name="phone"
            inputMode="tel"
            value={phoneValue}
            onChange={(event) => setPhoneValue(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <label className="flex items-start gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            name="emailOrderUpdates"
            checked={notifyMail}
            onChange={(event) => setNotifyMail(event.target.checked)}
            className="mt-0.5"
          />
          <span>Avisarme por correo cuando cambie el estado del pedido.</span>
        </label>
        {state.error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm text-accent-strong">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-semibold text-on-dark disabled:cursor-wait"
        >
          Guardar
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-sm">
        <form action={customerSignOutAction}>
          <button type="submit" className="font-semibold text-muted underline-offset-2 hover:underline">
            Cerrar sesión
          </button>
        </form>
        <Link href="/tienda/carrito" className="font-semibold text-accent-strong underline-offset-2 hover:underline">
          Carrito
        </Link>
        <Link href="/tienda/pagar" className="font-semibold underline-offset-2 hover:underline">
          Ir a pagar
        </Link>
        <Link href="/tienda/privacidad" className="font-semibold underline-offset-2 hover:underline">
          Privacidad
        </Link>
      </div>
    </section>
  );
}

function OrdersCard({ orders }: { orders: CustomerOrderSummary[] }) {
  return (
    <section className="elevate-1 rounded-[18px] border border-line bg-card px-3.5 py-3.5 sm:px-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedidos</p>
          <h2 className="mt-0.5 text-base font-bold">Mis pedidos</h2>
        </div>
        {orders.length > 0 ? (
          <p className="text-xs font-semibold text-muted tabular-nums">{orders.length}</p>
        ) : null}
      </div>
      {orders.length === 0 ? (
        <div className="mt-3 rounded-[12px] border border-dashed border-line bg-canvas/80 px-3 py-6 text-center">
          <p className="text-sm font-semibold">Todavía no hay pedidos</p>
          <p className="mt-1 text-xs leading-5 text-muted">Cuando confirmes uno, aparece aquí con su estado.</p>
          <Link
            href="/tienda"
            className="mt-3 inline-flex h-9 items-center justify-center rounded-[10px] border border-line bg-card px-3 text-sm font-semibold hover:bg-subtle"
          >
            Ver tienda
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/tienda/pedido/${order.id}?t=${order.viewToken}`}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-canvas px-3 py-2.5 transition-colors hover:border-accent/40 hover:bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{order.number}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-semibold text-accent-strong">{order.statusLabel}</span>
                    {" · "}
                    {order.totalLabel}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-accent-strong">Ver</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold" htmlFor={htmlFor}>
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}
