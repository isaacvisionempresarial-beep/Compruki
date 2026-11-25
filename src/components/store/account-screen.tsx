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
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ProfileCard
          displayName={displayName ?? ""}
          email={email ?? ""}
          phone={phone ?? ""}
          emailOrderUpdates={emailOrderUpdates !== false}
        />
        <OrdersCard orders={orders ?? []} />
      </div>
    );
  }

  return (
    <section className="elevate-1 mx-auto max-w-md rounded-[18px] border border-line bg-card px-4 py-5 sm:px-6">
      <p className="text-[10px] font-bold tracking-[0.1em] text-accent-strong uppercase">Cuenta</p>
      <h1 className="store-display mt-1 text-2xl font-extrabold tracking-tight">
        {mode === "register" ? "Crear cuenta" : mode === "recovery" ? "Recuperar clave" : mode === "nueva-clave" ? "Nueva clave" : "Entrar"}
      </h1>
      <p className="mt-1.5 text-sm leading-5 text-muted">
        Para pedir necesitas cuenta. Guarda el carrito y recibe avisos del pedido. No cobra.
      </p>
      {bootError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
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
      <form action={customerGoogleSignInAction}>
        <input type="hidden" name="next" value={nextPath} />
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold hover:bg-subtle"
        >
          Continuar con Google
        </button>
      </form>
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
      <form action={customerGoogleSignInAction}>
        <input type="hidden" name="next" value={nextPath} />
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold hover:bg-subtle"
        >
          Continuar con Google
        </button>
      </form>
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
    <section className="elevate-1 rounded-[18px] border border-line bg-card px-4 py-4">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Perfil</p>
      <h2 className="mt-0.5 text-base font-bold">Tu cuenta</h2>
      <p className="mt-1 text-sm text-muted">{email}</p>
      <form action={action} className="mt-3 grid gap-3">
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
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="emailOrderUpdates"
            checked={notifyMail}
            onChange={(event) => setNotifyMail(event.target.checked)}
            className="mt-1"
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
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold disabled:cursor-wait"
        >
          Guardar
        </button>
      </form>
      <form action={customerSignOutAction} className="mt-3">
        <button type="submit" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">
          Cerrar sesión
        </button>
      </form>
      <p className="mt-3 text-xs leading-5 text-muted">
        <Link href="/tienda/pagar" className="font-semibold text-accent-strong underline-offset-2 hover:underline">
          Ir a pagar
        </Link>
        {" · "}
        <Link href="/tienda/carrito" className="font-semibold underline-offset-2 hover:underline">
          Carrito
        </Link>
      </p>
    </section>
  );
}

function OrdersCard({ orders }: { orders: CustomerOrderSummary[] }) {
  return (
    <section className="elevate-1 rounded-[18px] border border-line bg-card px-4 py-4">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Pedidos</p>
      <h2 className="mt-0.5 text-base font-bold">Mis pedidos</h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no tienes pedidos con esta cuenta.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{order.number}</p>
                <p className="text-xs text-muted">
                  {order.statusLabel} · {order.totalLabel}
                </p>
              </div>
              <Link
                href={`/tienda/pedido/${order.id}?t=${order.viewToken}`}
                className="shrink-0 text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
              >
                Ver
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
