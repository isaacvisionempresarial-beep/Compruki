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

  const templateStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let approvedEs = 0;
    for (const item of templates) {
      const status = item.status.toUpperCase();
      if (status === "APPROVED") {
        approved += 1;
        if (/^es(_|$)/i.test(item.language || "")) approvedEs += 1;
      } else if (status === "PENDING" || status === "IN_APPEAL") pending += 1;
      else if (status === "REJECTED" || status === "DISABLED") rejected += 1;
    }
    return { approved, approvedEs, pending, rejected, total: templates.length };
  }, [templates]);

  const saludoTemplate = useMemo(() => {
    const matches = templates.filter((item) => /^saludo/i.test(item.name));
    if (!matches.length) return null;
    const rank = (item: (typeof matches)[number]) => {
      const status = item.status.toUpperCase();
      const lang = (item.language || "").toLowerCase();
      const statusScore =
        status === "APPROVED" ? 0 : status === "PENDING" || status === "IN_APPEAL" ? 1 : 2;
      const langScore = lang === "es" || lang.startsWith("es_") ? 0 : lang.startsWith("en") ? 2 : 1;
      return statusScore * 10 + langScore;
    };
    return [...matches].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))[0];
  }, [templates]);

  const sortedTemplates = useMemo(() => {
    const langScore = (language: string) => {
      const lang = (language || "").toLowerCase();
      if (lang === "es" || lang.startsWith("es_")) return 0;
      if (lang.startsWith("en")) return 2;
      return 1;
    };
    const statusScore = (status: string) => {
      const value = status.toUpperCase();
      if (value === "APPROVED") return 0;
      if (value === "PENDING" || value === "IN_APPEAL") return 1;
      return 2;
    };
    return [...templates].sort((a, b) => {
      const aSaludo = /^saludo/i.test(a.name) ? 0 : 1;
      const bSaludo = /^saludo/i.test(b.name) ? 0 : 1;
      if (aSaludo !== bSaludo) return aSaludo - bSaludo;
      const byLang = langScore(a.language) - langScore(b.language);
      if (byLang) return byLang;
      const byStatus = statusScore(a.status) - statusScore(b.status);
      if (byStatus) return byStatus;
      return a.name.localeCompare(b.name) || a.language.localeCompare(b.language);
    });
  }, [templates]);

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
        className="elevate-1 mt-4 rounded-[12px] border border-line bg-card px-2.5 py-2"
        aria-labelledby="wa-estado"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</p>
            <h2
              id="wa-estado"
              className={cx("mt-0.5 text-sm font-semibold", statusClass(connection.status))}
            >
              {statusLabel(connection.status)}
              {connection.status === "verificada" && connection.lastInboundAt ? (
                <span className="ml-1.5 text-[11px] font-semibold text-success">
                  · listo para Inbox
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted">
              {connection.detail || "—"}
            </p>
            {connection.lastError && !isSoftWaWarning(connection.lastError) ? (
              <p className="mt-0.5 text-[11px] leading-4 text-danger">{connection.lastError}</p>
            ) : null}
          </div>
          <form action={verifyAction}>
            <button
              type="submit"
              disabled={verifying || !connection.env.ready}
              className="inline-flex h-7 items-center rounded-[6px] bg-ink px-2.5 text-[11px] font-semibold text-canvas disabled:opacity-50"
            >
              {verifying ? "Verificando…" : "Verificar"}
            </button>
          </form>
        </div>

        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {(
            [
              ["Número", connection.displayPhoneNumber || "Pendiente de verificación"],
              ["Nombre", connection.verifiedName || "—"],
              [
                "Webhook",
                connection.lastCheckedAt
                  ? new Date(connection.lastCheckedAt).toLocaleString("es-CO")
                  : "Sin POST aún",
              ],
              [
                "Entrante",
                connection.lastInboundAt
                  ? new Date(connection.lastInboundAt).toLocaleString("es-CO")
                  : "Ninguno",
              ],
              ["Phone ID", connection.phoneNumberId || "—"],
              ["Calidad", connection.qualityRating || "—"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-baseline gap-1.5 text-[11px]">
              <dt className="shrink-0 font-semibold text-muted">{label}</dt>
              <dd className="min-w-0 truncate font-semibold text-ink tabular-nums" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-2 flex flex-wrap gap-1" aria-label="Variables de entorno">
          {(
            [
              ["Token", connection.env.accessToken],
              ["Phone ID", connection.env.phoneNumberId],
              ["Verify", connection.env.verifyToken],
              ["Secret", connection.env.appSecret],
              ["WABA", connection.env.businessAccountId],
              ["App", connection.env.appId],
            ] as const
          ).map(([label, ok]) => (
            <span
              key={label}
              className={cx(
                "inline-flex h-6 items-center rounded-[5px] border px-1.5 text-[10px] font-semibold",
                ok
                  ? "border-success/30 bg-success-tint text-success"
                  : "border-danger/30 bg-danger-tint text-danger",
              )}
            >
              {label} {ok ? "OK" : "Falta"}
            </span>
          ))}
          <span className="inline-flex h-6 items-center rounded-[5px] border border-line bg-subtle px-1.5 text-[10px] font-semibold text-ink">
            Graph {connection.env.graphVersion}
          </span>
        </div>
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
            {templateStats.total > 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-muted">
                {templateStats.approved} aprobada(s)
                {templateStats.approvedEs
                  ? ` · ${templateStats.approvedEs} ES`
                  : " · sin ES aprobada"}
                {templateStats.pending ? ` · ${templateStats.pending} pendiente(s)` : ""}
                {templateStats.rejected ? ` · ${templateStats.rejected} rechazada(s)` : ""}
              </p>
            ) : null}
          </div>
          <form action={listAction}>
            <button type="submit" disabled={listing || !connection.env.ready} className="rounded-[10px] border border-line bg-canvas px-3 py-2 text-xs font-semibold disabled:opacity-50">
              {listing ? "…" : "Actualizar lista"}
            </button>
          </form>
        </div>

        {saludoTemplate ? (
          <p
            className={cx(
              "mt-3 rounded-[10px] px-3 py-2 text-[12px] leading-5",
              saludoTemplate.status.toUpperCase() === "APPROVED"
                ? "bg-success-tint text-success"
                : saludoTemplate.status.toUpperCase() === "REJECTED" ||
                    saludoTemplate.status.toUpperCase() === "DISABLED"
                  ? "bg-danger-tint text-danger"
                  : "bg-warning-tint text-warning",
            )}
          >
            Saludo · <span className="font-semibold">{saludoTemplate.name}</span> (
            {saludoTemplate.language}) ·{" "}
            <span className="font-semibold uppercase">{saludoTemplate.status}</span>
            {saludoTemplate.status.toUpperCase() === "APPROVED"
              ? " — ya puedes usarla en el Inbox fuera de ventana 24 h."
              : saludoTemplate.status.toUpperCase() === "PENDING" ||
                  saludoTemplate.status.toUpperCase() === "IN_APPEAL"
                ? " — Meta aún la revisa. Actualiza la lista en un rato."
                : saludoTemplate.rejectedReason
                  ? ` — ${saludoTemplate.rejectedReason}`
                  : " — revisa el motivo o envía otra en ES."}
          </p>
        ) : (
          <p className="mt-3 rounded-[10px] bg-warning-tint px-3 py-2 text-[12px] leading-5 text-warning">
            Aún no hay un <span className="font-semibold">saludo_*</span> en esta WABA. Envía{" "}
            <span className="font-semibold">saludo_compruki</span> en ES abajo (útil fuera de ventana
            24 h).
          </p>
        )}

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

        {sortedTemplates.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay plantillas en esta cuenta (o falta WABA ID).</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {sortedTemplates.map((item) => {
              const status = item.status.toUpperCase();
              const isEs = /^es(_|$)/i.test(item.language || "");
              const isSaludo = /^saludo/i.test(item.name);
              const statusClassName =
                status === "APPROVED"
                  ? "text-success"
                  : status === "REJECTED" || status === "DISABLED"
                    ? "text-danger"
                    : "text-warning";
              return (
              <li
                key={`${item.name}-${item.language}-${item.status}`}
                className={cx(
                  "rounded-[10px] border px-3 py-2 text-sm",
                  isSaludo || (isEs && status === "APPROVED")
                    ? "border-accent/40 bg-accent-tint/20"
                    : "border-line",
                )}
              >
                <p className="font-semibold">
                  {item.name} · {item.language}
                  {isEs ? (
                    <span className="ml-1 rounded-[4px] bg-subtle px-1 text-[9px] font-bold text-muted">
                      ES
                    </span>
                  ) : null}
                  <span
                    className={cx(
                      "ml-2 text-[11px] font-bold tracking-wide uppercase",
                      statusClassName,
                    )}
                  >
                    {item.status || "—"}
                    {item.category ? ` · ${item.category}` : ""}
                  </span>
                </p>
                {item.body ? <p className="mt-0.5 text-xs text-muted">{item.body}</p> : null}
                {item.rejectedReason ? (
                  <p className="mt-0.5 text-xs text-danger">{item.rejectedReason}</p>
                ) : null}
              </li>
              );
            })}
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
