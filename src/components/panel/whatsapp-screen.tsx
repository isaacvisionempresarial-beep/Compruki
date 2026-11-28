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

const card = "elevate-1 mt-2 rounded-[12px] border border-line bg-card px-2.5 py-2";
const ctrl =
  "h-7 w-full rounded-[6px] border border-line bg-canvas px-2 text-[11px] text-ink outline-none focus:border-ink";
const area =
  "w-full rounded-[6px] border border-line bg-canvas px-2 py-1.5 text-[11px] text-ink outline-none focus:border-ink";
const btn =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-card px-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:opacity-50";
const btnDark =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] bg-ink px-2.5 text-[11px] font-semibold text-canvas disabled:opacity-50";
const labelCap = "text-[10px] font-bold tracking-[0.08em] text-muted uppercase";

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

      <section className={card} aria-labelledby="wa-plantillas">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={labelCap}>Plantillas</p>
            <h2 id="wa-plantillas" className="mt-0.5 text-sm font-semibold">
              Enviar a aprobación
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">
              Meta revisa y, si queda APPROVED, se usa en el Inbox.
              {templateStats.total > 0
                ? ` · ${templateStats.approved} OK${
                    templateStats.approvedEs ? ` (${templateStats.approvedEs} ES)` : " · sin ES"
                  }${templateStats.pending ? ` · ${templateStats.pending} pend.` : ""}${
                    templateStats.rejected ? ` · ${templateStats.rejected} rech.` : ""
                  }`
                : ""}
            </p>
          </div>
          <form action={listAction}>
            <button type="submit" disabled={listing || !connection.env.ready} className={btn}>
              {listing ? "…" : "Actualizar"}
            </button>
          </form>
        </div>

        {saludoTemplate ? (
          <p
            className={cx(
              "mt-2 rounded-[8px] px-2 py-1.5 text-[11px] leading-4",
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
              ? " — lista para Inbox fuera de 24 h."
              : saludoTemplate.status.toUpperCase() === "PENDING" ||
                  saludoTemplate.status.toUpperCase() === "IN_APPEAL"
                ? " — Meta la revisa."
                : saludoTemplate.rejectedReason
                  ? ` — ${saludoTemplate.rejectedReason}`
                  : " — envía otra en ES."}
          </p>
        ) : (
          <p className="mt-2 rounded-[8px] bg-warning-tint px-2 py-1.5 text-[11px] leading-4 text-warning">
            Falta <span className="font-semibold">saludo_*</span>. Envía{" "}
            <span className="font-semibold">saludo_compruki</span> en ES abajo.
          </p>
        )}

        <form action={tplAction} className="mt-2 grid gap-1.5">
          <div className="grid gap-1.5 sm:grid-cols-3">
            <label className="grid gap-0.5">
              <span className={labelCap}>Nombre</span>
              <input
                name="name"
                required
                pattern="[a-z0-9_]{2,64}"
                defaultValue="saludo_compruki"
                placeholder="saludo_compruki"
                className={ctrl}
              />
            </label>
            <label className="grid gap-0.5">
              <span className={labelCap}>Categoría</span>
              <select name="category" defaultValue="UTILITY" className={ctrl}>
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className={labelCap}>Idioma</span>
              <select name="language" defaultValue="es" className={ctrl}>
                <option value="es">es</option>
                <option value="es_CO">es_CO</option>
                <option value="en_US">en_US</option>
              </select>
            </label>
          </div>
          <label className="grid gap-0.5">
            <span className={labelCap}>Texto</span>
            <textarea
              name="body"
              required
              rows={2}
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              className={area}
            />
            <span className="text-[10px] text-muted">
              Variables {"{{1}}"}… no al inicio ni al final.
            </span>
          </label>
          {draftPositions.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {draftPositions.map((position) => (
                <label key={position} className="grid gap-0.5">
                  <span className={labelCap}>Ejemplo {`{{${position}}}`}</span>
                  <input
                    name={`example_${position}`}
                    required
                    defaultValue={position === 1 ? "Leidy" : `Ejemplo ${position}`}
                    className={ctrl}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={tplBusy || !connection.env.ready || !connection.env.businessAccountId}
            className={btnDark}
          >
            {tplBusy ? "Enviando…" : "Enviar a aprobación"}
          </button>
          {tplState.error ? <p className="text-[11px] text-danger">{tplState.error}</p> : null}
          {tplState.ok ? <p className="text-[11px] text-success">{tplState.ok}</p> : null}
          {listState.ok ? <p className="text-[11px] text-success">{listState.ok}</p> : null}
        </form>

        {sortedTemplates.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted">Sin plantillas (o falta WABA ID).</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
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
                    "rounded-[6px] border px-2 py-1.5 text-[11px]",
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
                    <span className={cx("ml-1.5 text-[10px] font-bold uppercase", statusClassName)}>
                      {item.status || "—"}
                      {item.category ? ` · ${item.category}` : ""}
                    </span>
                  </p>
                  {item.body ? (
                    <p className="mt-0.5 truncate text-[10px] text-muted" title={item.body}>
                      {item.body}
                    </p>
                  ) : null}
                  {item.rejectedReason ? (
                    <p className="mt-0.5 text-[10px] text-danger">{item.rejectedReason}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="wa-webhook">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={labelCap}>Webhook</p>
            <h2 id="wa-webhook" className="mt-0.5 text-sm font-semibold">
              URL Meta Developer
            </h2>
            <p className="mt-0.5 text-[11px] leading-4 text-muted">
              Verify = <code className="text-ink">META_WA_VERIFY_TOKEN</code> · fields{" "}
              <code className="text-ink">messages</code>
            </p>
          </div>
        </div>
        <p className="mt-1.5 break-all rounded-[6px] border border-line bg-canvas px-2 py-1.5 text-[11px] font-semibold tabular-nums">
          {webhookUrl}
        </p>
      </section>

      <section className={card} aria-labelledby="wa-envio">
        <p className={labelCap}>Prueba</p>
        <h2 id="wa-envio" className="mt-0.5 text-sm font-semibold">
          Enviar mensaje
        </h2>
        <p className="mt-0.5 text-[11px] leading-4 text-muted">
          Texto solo en ventana 24 h; fuera de ella usa plantilla aprobada.
        </p>

        <form action={sendAction} className="mt-2 grid gap-1.5">
          <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-0.5">
              <span className={labelCap}>Celular</span>
              <input
                name="phone"
                required
                inputMode="tel"
                placeholder="573001112233"
                className={ctrl}
              />
            </label>
            <fieldset className="flex items-end gap-3 pb-0.5">
              <legend className="sr-only">Tipo</legend>
              <label className="flex items-center gap-1 text-[11px] font-semibold">
                <input type="radio" name="mode" value="text" defaultChecked />
                Texto
              </label>
              <label className="flex items-center gap-1 text-[11px] font-semibold">
                <input type="radio" name="mode" value="template" />
                Plantilla
              </label>
            </fieldset>
          </div>

          <label className="grid gap-0.5">
            <span className={labelCap}>Texto</span>
            <textarea
              name="body"
              rows={2}
              placeholder="Hola, te escribimos desde Compruki…"
              className={area}
            />
          </label>

          <div className="grid gap-1.5 sm:grid-cols-3">
            <label className="grid gap-0.5 sm:col-span-1">
              <span className={labelCap}>Plantilla</span>
              <input
                name="templateName"
                placeholder="hello_world"
                className={ctrl}
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
            <label className="grid gap-0.5">
              <span className={labelCap}>Idioma</span>
              <input name="language" defaultValue="es" placeholder="es" className={ctrl} />
            </label>
            <label className="grid gap-0.5">
              <span className={labelCap}>Vars |</span>
              <input
                name="templateValues"
                placeholder="Juan|Pedido 1234"
                className={ctrl}
              />
            </label>
          </div>

          <button type="submit" disabled={sending || !connection.env.ready} className={btnDark}>
            {sending ? "Enviando…" : "Enviar prueba"}
          </button>
        </form>

        {feedbackError ? <p className="mt-1.5 text-[11px] text-danger">{feedbackError}</p> : null}
        {feedbackOk ? <p className="mt-1.5 text-[11px] text-success">{feedbackOk}</p> : null}
      </section>

      <section className={card} aria-labelledby="wa-recientes">
        <p className={labelCap}>Actividad</p>
        <h2 id="wa-recientes" className="mt-0.5 text-sm font-semibold">
          Últimos mensajes
        </h2>
        {recent.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted">Aún no hay mensajes.</p>
        ) : (
          <ul className="mt-1.5 max-h-52 space-y-1 overflow-y-auto">
            {recent.map((msg) => (
              <li key={msg.id} className="rounded-[6px] border border-line px-2 py-1.5 text-[11px]">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <p className="font-semibold">
                    {msg.direction === "inbound" ? "↓" : "↑"} {msg.phone}
                    {msg.contactName ? ` · ${msg.contactName}` : ""}
                  </p>
                  <p className="text-[10px] text-muted tabular-nums">
                    {new Date(msg.createdAt).toLocaleString("es-CO")}
                  </p>
                </div>
                <p className="mt-0.5 truncate text-muted" title={msg.body}>
                  {msg.body}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {msg.messageType} · {msg.deliveryStatus}
                  {msg.createdBy ? ` · ${msg.createdBy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="wa-alta">
        <p className={labelCap}>Alta Meta</p>
        <h2 id="wa-alta" className="mt-0.5 text-sm font-semibold">
          Número nuevo
        </h2>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] leading-4 text-muted">
          <li>App Compruki + WhatsApp Business con el número.</li>
          <li>System user con Control total en WABA y cuenta de mensajería.</li>
          <li>
            Token con <code className="text-ink">whatsapp_business_messaging</code> y{" "}
            <code className="text-ink">whatsapp_business_management</code>.
          </li>
          <li>Railway: TOKEN, PHONE_ID, WABA, VERIFY, APP_SECRET (+ APP_ID).</li>
          <li>Webhook = URL de arriba · Verificar · prueba en Inbox.</li>
        </ol>
      </section>
    </div>
  );
}
