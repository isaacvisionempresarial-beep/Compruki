"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  refreshWhatsAppTemplatesAction,
  sendWhatsAppTestAction,
  submitWhatsAppTemplateAction,
  verifyWhatsAppConnectionAction,
  type WhatsAppActionState,
  type WhatsAppTemplateRow,
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
  templates: initialTemplates = [],
  webhookUrl,
  roleLabel,
}: {
  connection: WhatsAppConnectionState;
  recent: RecentWaMessage[];
  templates?: WhatsAppTemplateRow[];
  webhookUrl: string;
  roleLabel: string;
}) {
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyWhatsAppConnectionAction,
    verifyInitial,
  );
  const [sendState, sendAction, sending] = useActionState(sendWhatsAppTestAction, verifyInitial);
  const [tplState, tplAction, tplBusy] = useActionState(submitWhatsAppTemplateAction, verifyInitial);
  const [listState, listAction, listing] = useActionState(
    refreshWhatsAppTemplatesAction,
    verifyInitial,
  );
  const [draftBody, setDraftBody] = useState(
    "Hola {{1}}, te escribimos desde Compruki. ¿En qué te ayudamos?",
  );

  const connection =
    tplState.connection ??
    listState.connection ??
    sendState.connection ??
    verifyState.connection ??
    initialConnection;
  const recent = sendState.recent.length
    ? sendState.recent
    : verifyState.recent.length
      ? verifyState.recent
      : initialRecent;
  const templates =
    tplState.templates.length || listState.templates.length || verifyState.templates.length
      ? tplState.templates.length
        ? tplState.templates
        : listState.templates.length
          ? listState.templates
          : verifyState.templates
      : initialTemplates;
  const feedbackError = tplState.error || listState.error || sendState.error || verifyState.error;
  const feedbackOk = tplState.ok || listState.ok || sendState.ok || verifyState.ok;

  const draftPositions = useMemo(() => {
    return [
      ...new Set([...draftBody.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1]))),
    ].sort((a, b) => a - b);
  }, [draftBody]);

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
        aria-labelledby="wa-plantillas"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Plantillas</p>
            <h2 id="wa-plantillas" className="mt-0.5 text-sm font-semibold">
              Enviar a aprobación de Meta
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Misma lógica que ConextaIA: se crea en la WABA y Meta la revisa. Cuando esté APPROVED,
              úsala en el Inbox.
            </p>
          </div>
          <form action={listAction}>
            <button type="submit" disabled={listing || !connection.env.ready} className="rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs font-semibold disabled:opacity-50">
              {listing ? "…" : "Actualizar lista"}
            </button>
          </form>
        </div>

        <form action={tplAction} className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-sm sm:col-span-1">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Nombre</span>
              <input
                name="name"
                required
                pattern="[a-z0-9_]{2,64}"
                defaultValue="saludo_compruki"
                placeholder="saludo_compruki"
                className="rounded-[10px] border border-line bg-canvas px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Categoría</span>
              <select name="category" defaultValue="UTILITY" className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Idioma</span>
              <select name="language" defaultValue="es" className="rounded-[10px] border border-line bg-canvas px-3 py-2">
                <option value="es">es</option>
                <option value="es_CO">es_CO</option>
                <option value="en_US">en_US</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Texto</span>
            <textarea
              name="body"
              required
              rows={3}
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              className="rounded-[10px] border border-line bg-canvas px-3 py-2"
            />
            <span className="text-[11px] text-muted">
              Variables {"{{1}}"}, {"{{2}}"}… no al inicio ni al final del texto.
            </span>
          </label>
          {draftPositions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {draftPositions.map((position) => (
                <label key={position} className="grid gap-1 text-sm">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                    Ejemplo {`{{${position}}}`}
                  </span>
                  <input
                    name={`example_${position}`}
                    required
                    defaultValue={position === 1 ? "Leidy" : `Ejemplo ${position}`}
                    className="rounded-[10px] border border-line bg-canvas px-3 py-2"
                  />
                </label>
              ))}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={tplBusy || !connection.env.ready || !connection.env.businessAccountId}
            className="w-fit rounded-[10px] bg-ink px-3 py-2 text-sm font-semibold text-canvas disabled:opacity-50"
          >
            {tplBusy ? "Enviando a Meta…" : "Enviar a aprobación"}
          </button>
          {tplState.error ? <p className="text-sm text-danger">{tplState.error}</p> : null}
          {tplState.ok ? <p className="text-sm text-success">{tplState.ok}</p> : null}
          {listState.ok ? <p className="text-sm text-success">{listState.ok}</p> : null}
        </form>

        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay plantillas en esta cuenta (o falta WABA ID).</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {templates.map((item) => (
              <li
                key={`${item.name}-${item.language}-${item.status}`}
                className="rounded-[10px] border border-line px-3 py-2 text-sm"
              >
                <p className="font-semibold">
                  {item.name} · {item.language}
                  <span className="ml-2 text-[11px] font-bold tracking-wide text-muted uppercase">
                    {item.status || "—"}
                    {item.category ? ` · ${item.category}` : ""}
                  </span>
                </p>
                {item.body ? <p className="mt-0.5 text-xs text-muted">{item.body}</p> : null}
                {item.rejectedReason ? (
                  <p className="mt-0.5 text-xs text-danger">{item.rejectedReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
