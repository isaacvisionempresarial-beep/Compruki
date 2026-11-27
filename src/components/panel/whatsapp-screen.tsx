"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  sendWhatsAppTestAction,
  verifyWhatsAppConnectionAction,
  type WhatsAppActionState,
} from "@/server/whatsapp-actions";
import type { RecentWaMessage, WhatsAppConnectionState } from "@/server/whatsapp/connection";
import { cx } from "@/lib/cx";

/** Avisos técnicos que no deben pintar la conexión como rota. */
function isSoftWaWarning(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("suscripción waba") ||
    t.includes("subscribed_apps") ||
    t.includes("unsupported post request") ||
    t.includes("missing permissions")
  );
}

const verifyInitial: WhatsAppActionState = {
  error: null,
  ok: null,
  connection: null,
  templates: [],
  recent: [],
};

function statusLabel(status: WhatsAppConnectionState["status"]) {
  switch (status) {
    case "verificada":
      return "Verificada";
    case "configurada":
      return "Credenciales listas";
    case "error":
      return "Error";
    default:
      return "Sin configurar";
  }
}

function statusClass(status: WhatsAppConnectionState["status"]) {
  switch (status) {
    case "verificada":
      return "text-success";
    case "configurada":
      return "text-warning";
    case "error":
      return "text-danger";
    default:
      return "text-muted";
  }
}

export function WhatsAppScreen({
  connection: initialConnection,
  recent: initialRecent,
  webhookUrl,
  roleLabel,
}: {
  connection: WhatsAppConnectionState;
  recent: RecentWaMessage[];
  webhookUrl: string;
  roleLabel: string;
}) {
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyWhatsAppConnectionAction,
    verifyInitial,
  );
  const [sendState, sendAction, sending] = useActionState(sendWhatsAppTestAction, verifyInitial);

  const connection = sendState.connection ?? verifyState.connection ?? initialConnection;
  const recent = sendState.recent.length
    ? sendState.recent
    : verifyState.recent.length
      ? verifyState.recent
      : initialRecent;
  const templates = verifyState.templates;
  const feedbackError = sendState.error || verifyState.error;
  const feedbackOk = sendState.ok || verifyState.ok;

  return (
    <div className="mx-auto max-w-[1100px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Operación</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">WhatsApp</h1>
      <p className="mt-1 max-w-2xl text-sm leading-5 text-muted">
        Meta Cloud API · conexión del número, webhook y prueba de envío. Conversaciones en{" "}
        <Link href="/panel/inbox" className="font-semibold text-ink underline-offset-2 hover:underline">
          Inbox
        </Link>
        . Acceso: {roleLabel}.
      </p>

      <section
        className="elevate-1 mt-5 rounded-[14px] border border-line bg-card px-3 py-3"
        aria-labelledby="wa-estado"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
        <h2 id="wa-estado" className={cx("mt-0.5 text-sm font-semibold", statusClass(connection.status))}>
          {statusLabel(connection.status)}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">{connection.detail || "—"}</p>
        {connection.lastError && !isSoftWaWarning(connection.lastError) ? (
          <p className="mt-1 text-xs leading-5 text-danger">{connection.lastError}</p>
        ) : null}
        {connection.status === "verificada" && connection.lastInboundAt ? (
          <p className="mt-1 text-xs leading-5 text-success">
            Entrantes y salientes listos. Usa el Inbox para atender chats.
          </p>
        ) : null}

        <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Número</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {connection.displayPhoneNumber || "Pendiente de verificación"}
            </dd>
          </div>
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre verificado</dt>
            <dd className="mt-0.5 font-semibold">{connection.verifiedName || "—"}</dd>
          </div>
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Último webhook / check</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {connection.lastCheckedAt
                ? new Date(connection.lastCheckedAt).toLocaleString("es-CO")
                : "Aún no llega ningún POST de Meta"}
            </dd>
          </div>
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Último entrante</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {connection.lastInboundAt
                ? new Date(connection.lastInboundAt).toLocaleString("es-CO")
                : "Ninguno (escribe un hola al número de Compruki)"}
            </dd>
          </div>
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Phone Number ID</dt>
            <dd className="mt-0.5 font-semibold break-all tabular-nums">
              {connection.phoneNumberId || "—"}
            </dd>
          </div>
          <div className="rounded-[10px] border border-line px-3 py-2">
            <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Calidad</dt>
            <dd className="mt-0.5 font-semibold">{connection.qualityRating || "—"}</dd>
          </div>
        </dl>

        <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
          {(
            [
              ["Token", connection.env.accessToken],
              ["Phone Number ID", connection.env.phoneNumberId],
              ["Verify token", connection.env.verifyToken],
              ["App secret", connection.env.appSecret],
              ["WABA ID", connection.env.businessAccountId],
              ["App ID", connection.env.appId],
              ["Graph", true],
            ] as const
          ).map(([label, ok]) => (
            <div key={label} className="rounded-[10px] border border-line px-3 py-2">
              <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{label}</dt>
              <dd className={cx("mt-0.5 font-semibold", label === "Graph" ? "text-ink" : ok ? "text-success" : "text-danger")}>
                {label === "Graph" ? connection.env.graphVersion : ok ? "OK" : "Falta"}
              </dd>
            </div>
          ))}
        </dl>

        <form action={verifyAction} className="mt-3">
          <button
            type="submit"
            disabled={verifying || !connection.env.ready}
            className="rounded-[10px] bg-ink px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            {verifying ? "Verificando…" : "Verificar con Meta"}
          </button>
        </form>
      </section>

      <section
        className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3"
        aria-labelledby="wa-webhook"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Webhook</p>
        <h2 id="wa-webhook" className="mt-0.5 text-sm font-semibold">
          URL para Meta Developer
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Meta entrega los mensajes a esta URL. Verify token ={" "}
          <code className="text-ink">META_WA_VERIFY_TOKEN</code>. Campo:{" "}
          <code className="text-ink">messages</code>.
        </p>
        <p className="mt-2 break-all rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm font-semibold tabular-nums">
          {webhookUrl}
        </p>
      </section>

      <section
        className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3"
        aria-labelledby="wa-envio"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Prueba</p>
        <h2 id="wa-envio" className="mt-0.5 text-sm font-semibold">
          Enviar mensaje
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Texto libre solo dentro de la ventana de 24 h (después de que el contacto te escriba).
          Fuera de esa ventana usa una plantilla aprobada.
        </p>

        <form action={sendAction} className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Celular</span>
            <input
              name="phone"
              required
              inputMode="tel"
              placeholder="573001112233"
              className="rounded-[10px] border border-line bg-canvas px-3 py-2"
            />
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Tipo</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" value="text" defaultChecked />
              Texto (ventana 24 h)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" value="template" />
              Plantilla aprobada
            </label>
          </fieldset>

          <label className="grid gap-1 text-sm">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Texto</span>
            <textarea
              name="body"
              rows={3}
              placeholder="Hola, te escribimos desde Compruki…"
              className="rounded-[10px] border border-line bg-canvas px-3 py-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                Plantilla (nombre)
              </span>
              <input
                name="templateName"
                placeholder="hello_world"
                className="rounded-[10px] border border-line bg-canvas px-3 py-2"
                list="wa-templates"
              />
              <datalist id="wa-templates">
                {templates.map((t) => (
                  <option key={`${t.name}-${t.language}`} value={t.name}>
                    {t.language} · {t.status}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Idioma</span>
              <input
                name="language"
                defaultValue="es"
                placeholder="es o en_US"
                className="rounded-[10px] border border-line bg-canvas px-3 py-2"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
              Variables plantilla (separadas por |)
            </span>
            <input
              name="templateValues"
              placeholder="Juan|Pedido 1234"
              className="rounded-[10px] border border-line bg-canvas px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={sending || !connection.env.ready}
            className="w-fit rounded-[10px] bg-ink px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar prueba"}
          </button>
        </form>

        {feedbackError ? <p className="mt-3 text-sm text-danger">{feedbackError}</p> : null}
        {feedbackOk ? <p className="mt-3 text-sm text-success">{feedbackOk}</p> : null}
      </section>

      <section
        className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3"
        aria-labelledby="wa-recientes"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Actividad</p>
        <h2 id="wa-recientes" className="mt-0.5 text-sm font-semibold">
          Últimos mensajes
        </h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Aún no hay mensajes. Cuando Meta entregue el webhook o envíes una prueba, aparecen aquí.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recent.map((msg) => (
              <li key={msg.id} className="rounded-[10px] border border-line px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {msg.direction === "inbound" ? "Entrante" : "Saliente"} · {msg.phone}
                    {msg.contactName ? ` · ${msg.contactName}` : ""}
                  </p>
                  <p className="text-[11px] text-muted tabular-nums">
                    {new Date(msg.createdAt).toLocaleString("es-CO")}
                  </p>
                </div>
                <p className="mt-1 text-muted">{msg.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {msg.messageType} · {msg.deliveryStatus}
                  {msg.createdBy ? ` · ${msg.createdBy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3"
        aria-labelledby="wa-alta"
      >
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Alta Meta</p>
        <h2 id="wa-alta" className="mt-0.5 text-sm font-semibold">
          Número nuevo desde cero
        </h2>
        <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm leading-5 text-muted">
          <li>App Compruki en Meta Developers + producto WhatsApp con el número Business.</li>
          <li>
            Usuario del sistema con acceso a la app, la cuenta de WhatsApp y la cuenta de
            mensajería (Control total en ambas).
          </li>
          <li>
            Token permanente con <code className="text-ink">whatsapp_business_messaging</code> y{" "}
            <code className="text-ink">whatsapp_business_management</code>.
          </li>
          <li>
            Railway: ACCESS_TOKEN, PHONE_NUMBER_ID, WABA_ID, VERIFY_TOKEN, APP_SECRET (y APP_ID).
          </li>
          <li>
            Webhook = URL de arriba + el mismo verify token. «Verificar con Meta» y prueba en Inbox.
          </li>
        </ol>
      </section>
    </div>
  );
}
