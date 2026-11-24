"use client";

import Link from "next/link";
import { AgentBudgetPanel } from "@/components/panel/agent-budget-panel";
import { CampaignDraftPanel } from "@/components/panel/campaign-draft-panel";
import { CentralRouterPanel } from "@/components/panel/central-router-panel";
import { ContentCreatorPanel } from "@/components/panel/content-creator-panel";
import { PendingApprovalsPanel } from "@/components/panel/pending-approvals-panel";
import { publicationLabel } from "@/lib/catalog";
import { formatCop } from "@/lib/format";
import { usePanelSectionHash } from "@/lib/use-panel-section-hash";
import type { CampaignDraft } from "@/server/agent-campaign-draft";
import type { CentralRouteResult } from "@/server/agent-central";
import type { ContentDraft, ProductFacts, SavedContentDraft } from "@/server/agent-content";
import type { ExplorerShortlist } from "@/server/agent-explorer";
import type { AgentCenterView } from "@/server/agent-gateway";
import { runAnalystAction, searchExplorerAction } from "@/server/agent-panel-actions";
import type { AnalystReading, AnalystToolkit } from "@/server/agent-tools";

function agentIsOn(view: AgentCenterView, agentId: string) {
  const role = view.roles.find((item) => item.id === agentId);
  if (!role?.config) return true;
  return role.config.enabled === true;
}

export function AgentsScreen({
  view,
  analyst,
  analystReading = null,
  marginSku = "",
  explorer,
  creator,
  campaign,
  central,
  policyError = null,
  canApproveCatalog = false,
  roleLabel = "Operador",
}: {
  view: AgentCenterView;
  analyst: AnalystToolkit;
  analystReading?: AnalystReading | null;
  marginSku?: string;
  explorer: ExplorerShortlist;
  creator: {
    products: Array<{ sku: string; title: string }>;
    selectedSku: string;
    facts: ProductFacts | null;
    drafts: ContentDraft[];
    saved: SavedContentDraft[];
  };
  campaign: {
    products: Array<{ sku: string; title: string }>;
    selectedSku: string;
    draft: CampaignDraft | null;
  };
  central: { route: CentralRouteResult | null; defaultIntent: string };
  policyError?: { agentId: string | null; message: string } | null;
  canApproveCatalog?: boolean;
  roleLabel?: string;
}) {
  const p0 = view.roles.filter((role) => role.priority === "P0-IA");
  const ag05 = view.roles.find((role) => role.id === "AG-05");
  const ag06 = view.roles.find((role) => role.id === "AG-06");
  const ag07 = view.roles.find((role) => role.id === "AG-07");
  const ag08 = view.roles.find((role) => role.id === "AG-08");
  const ag09 = view.roles.find((role) => role.id === "AG-09");
  const budgetRoles = [
    ...p0,
    ...(ag05 ? [ag05] : []),
    ...(ag06 ? [ag06] : []),
    ...(ag07 ? [ag07] : []),
    ...(ag08 ? [ag08] : []),
    ...(ag09 ? [ag09] : []),
  ];
  const later = view.roles.filter(
    (role) =>
      role.priority !== "P0-IA" &&
      role.id !== "AG-05" &&
      role.id !== "AG-06" &&
      role.id !== "AG-07" &&
      role.id !== "AG-08" &&
      role.id !== "AG-09",
  );
  usePanelSectionHash(["pendientes-humanos", "publicidad", "corridas"]);
  const ag01 = agentIsOn(view, "AG-01");
  const ag02 = agentIsOn(view, "AG-02");
  const ag03 = agentIsOn(view, "AG-03");
  const ag04 = agentIsOn(view, "AG-04");
  const ag08On = agentIsOn(view, "AG-08");

  return (
    <div className="mx-auto max-w-[1600px] pb-8">
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Sistema</p>
      <h1 className="mt-0.5 text-[24px] leading-7 font-extrabold tracking-tight">Centro de agentes</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{view.status.message}</p>
      <p className="mt-1 text-sm text-muted">
        Sesión: {roleLabel}.{" "}
        {canApproveCatalog
          ? "Puedes aprobar borradores y cambiar presupuesto. Usar el centro no cobra ni cambia pedidos."
          : "Puedes usar las herramientas y rechazar borradores. Aprobar y el presupuesto los guarda el propietario. Usar el centro no cobra ni cambia pedidos."}
      </p>

      <div className="elevate-1 mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-3">
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Estado</span>
        <StatusChip label="OpenAI" ok={view.status.openaiConnected} />
        <StatusChip label="Dropi" ok={view.status.dropiConnected} />
        <StatusChip label="Checkout independiente" ok={view.status.checkoutIndependent} positive />
      </div>

      {policyError ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
          {policyError.agentId ? `${policyError.agentId}: ` : null}
          {policyError.message}
        </p>
      ) : null}

      <p className="mt-6 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Cifras</p>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="resumen-tienda">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Local</p>
        <h2 id="resumen-tienda" className="mt-0.5 text-sm font-semibold">
          Resumen determinista de la tienda
        </h2>
        <p className="mt-1 text-sm text-muted">Cifras del catálogo y pedidos locales. No pasan por un modelo. Verlas no cobra ni cambia pedidos.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Publicados" value={view.storeSummary.publishedProducts} />
          <Stat label="Disponibles" value={view.storeSummary.availableProducts} />
          <Stat label="Pedidos abiertos" value={view.storeSummary.openOrders} />
          <Stat label="Pendiente confirmación" value={view.storeSummary.pendingConfirmation} />
        </dl>
        <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
          <Link href="/panel/catalogo" title="Abrirlo no cobra ni cambia pedidos." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Ir al catálogo
          </Link>
          <Link href="/panel/pedidos" title="Abrirlos no cobra ni cambia el total guardado." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Ir a pedidos
          </Link>
          <Link href="/panel/conexiones" title="Verlas no cobra ni cambia pedidos." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Ver conexiones
          </Link>
        </nav>
      </section>

      <p className="mt-6 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Atención</p>

      <PendingApprovalsPanel
        items={view.pendingApprovals}
        canApproveCatalog={canApproveCatalog}
        productQuestionsReady={view.productQuestionsReady}
      />

      <CentralRouterPanel
        route={central.route}
        defaultIntent={central.defaultIntent}
        enabled={ag01}
        canTurnOn={canApproveCatalog}
      />

      <p className="mt-6 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Agentes</p>

      <section className="mt-3" aria-labelledby="explorador">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Buscar</p>
        <h2 id="explorador" className="mt-0.5 text-base font-bold">
          Explorador de productos
        </h2>
        <p className="mt-1 text-sm text-muted">
          AG-02: shortlist del catálogo local; si OpenAI responde, ordena y resume. Fuente: {explorer.sourceLabel}.
          Buscar no cambia el catálogo ni cobra. No es Dropi en vivo.
          {canApproveCatalog ? "" : " El precio y la publicación los guarda el propietario."}
        </p>
        {!ag02 ? (
          <p role="status" className="mt-2 text-sm font-medium text-coral">
            {canApproveCatalog
              ? "AG-02 está apagado. Actívalo en Presupuesto y activación."
              : "AG-02 está apagado. Lo enciende el propietario en Presupuesto y activación."}
          </p>
        ) : null}

        <form
          action={searchExplorerAction}
          className="elevate-1 mt-3 grid gap-2 rounded-[14px] border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_12rem_auto]"
        >
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-3">Filtro</p>
          {creator.selectedSku ? <input type="hidden" name="sku" value={creator.selectedSku} /> : null}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Buscar</span>
            <input
              name="q"
              title="Escribirlo no cobra ni cambia el catálogo."
              defaultValue={explorer.query}
              disabled={!ag02}
              placeholder="SKU, título o variante"
              className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Categoría</span>
            <select
              name="categoria"
              title="Filtrar no cobra ni cambia el catálogo."
              defaultValue={explorer.category}
              disabled={!ag02}
              className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
            >
              <option value="">Todas</option>
              {explorer.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Consulta" className="flex flex-wrap items-end gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
            <button
              type="submit"
              title="Buscar no cobra ni cambia el catálogo."
              disabled={!ag02}
              className="inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55 sm:w-auto"
            >
              Buscar
            </button>
          </nav>
        </form>

        <p className="mt-2 text-sm text-muted">
          Selección: {explorer.results.length} producto{explorer.results.length === 1 ? "" : "s"}
          {explorer.query ? ` · «${explorer.query}»` : ""}
          {explorer.category ? ` · ${explorer.category}` : ""}
          {" · "}
          fuente {explorer.via === "openai" ? "OpenAI" : "local"}
          {explorer.costEstimateCop > 0 ? ` · costo est. ${explorer.costEstimateCop} COP` : ""}
        </p>

        {explorer.bullets.length > 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lectura</p>
            <ul className="mt-1.5 space-y-1.5 text-sm text-muted">
              {explorer.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {explorer.results.length === 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">
              No hay coincidencias en el catálogo local. Buscar no cobra ni cambia el catálogo.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {explorer.results.map((product) => (
              <li key={product.sku} className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Ficha</p>
                    <h3 className="mt-0.5 text-sm font-semibold">{product.title}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {product.sku}
                      {product.externalRef ? ` · ref ${product.externalRef}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-[10px] border border-line px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                    Local
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {product.category} · {publicationLabel(product)} · Precio de la ficha {formatCop(product.price)}
                </p>
                <p className="mt-1 text-sm">
                  Margen estimado {formatCop(product.margin)}. No es dinero cobrado.
                  {product.variants.length > 0 ? ` · ${product.variants.length} variantes` : ""}
                </p>
                <nav aria-label="Línea" className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Línea</span>
                  <Link href={`/panel/catalogo/${encodeURIComponent(product.sku)}`} title="Abrirla no cobra ni cambia el precio ni la publicación." className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle">
                    Abrir en catálogo
                  </Link>
                </nav>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContentCreatorPanel
        products={creator.products}
        selectedSku={creator.selectedSku}
        facts={creator.facts}
        drafts={creator.drafts}
        saved={creator.saved}
        preserveQuery={explorer.query}
        preserveCategory={explorer.category}
        enabled={ag03}
        canTurnOn={canApproveCatalog}
      />

      <CampaignDraftPanel
        products={campaign.products}
        selectedSku={campaign.selectedSku}
        draft={campaign.draft}
        preserveQuery={explorer.query}
        preserveCategory={explorer.category}
        preserveContentSku={creator.selectedSku}
        enabled={ag08On}
        canTurnOn={canApproveCatalog}
      />

      <section className="mt-6" aria-labelledby="analista">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Margen</p>
        <h2 id="analista" className="mt-0.5 text-base font-bold">
          Analista de rentabilidad
        </h2>
        <p className="mt-1 text-sm text-muted">
          AG-04: cifras locales siempre; si OpenAI responde, añade una lectura corta. «Calcular» solo lee y
          deja corrida auditable: no cambia el precio
          {canApproveCatalog ? "" : " (lo guarda el propietario)"} ni el costo del pedido. No es utilidad
          realizada.
        </p>
        {!ag04 ? (
          <p role="status" className="mt-2 text-sm font-medium text-coral">
            {canApproveCatalog
              ? "AG-04 está apagado. Actívalo en Presupuesto y activación."
              : "AG-04 está apagado. Lo enciende el propietario en Presupuesto y activación."}
          </p>
        ) : null}

        <form
          action={runAnalystAction}
          className="elevate-1 mt-3 grid gap-2 rounded-[14px] border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto]"
        >
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase sm:col-span-2">Calcular</p>
          {explorer.query ? <input type="hidden" name="q" value={explorer.query} /> : null}
          {explorer.category ? <input type="hidden" name="categoria" value={explorer.category} /> : null}
          {creator.selectedSku ? <input type="hidden" name="sku" value={creator.selectedSku} /> : null}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">SKU (opcional)</span>
            <input
              name="marginSku"
              title="Escribirlo no cobra ni cambia pedidos."
              disabled={!ag04}
              defaultValue={marginSku}
              placeholder="Vacío = todos los productos"
              className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-sm focus:border-accent focus:outline-none disabled:opacity-55"
            />
          </label>
          <nav aria-label="Consulta" className="flex flex-wrap items-end gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Consulta</span>
            <button
              type="submit"
              title="Calcular no cobra ni cambia pedidos."
              disabled={!ag04}
              className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-dark hover:bg-primary-soft disabled:opacity-55"
            >
              Calcular
            </button>
          </nav>
        </form>

        {analystReading ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lectura</p>
            <h3 className="mt-0.5 text-sm font-semibold">
              Vista previa · fuente {analystReading.via === "openai" ? "OpenAI" : "cifras"}
              {analystReading.costEstimateCop > 0
                ? ` · costo est. ${analystReading.costEstimateCop} COP`
                : ""}
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {analystReading.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Acumulado</p>
          <h3 className="mt-0.5 text-sm font-semibold">Pedidos acumulados</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            El total de líneas suma lo guardado en cada línea, de todos los pedidos. No es dinero cobrado. El margen
            estimado no es utilidad realizada.
          </p>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyStat label="Total de líneas" value={analyst.orders.revenue} />
            <MoneyStat label="Margen estimado" value={analyst.orders.estimatedMargin} />
            <Stat label="Pedidos" value={analyst.orders.orderCount} />
            <Stat label="Líneas sin costo" value={analyst.orders.missingCostLines} />
          </dl>
          {!canApproveCatalog && analyst.orders.missingCostLines > 0 ? (
            <p className="mt-2 text-xs leading-5 text-muted">
              Esas líneas las copia el propietario desde la ficha.
            </p>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-5 text-muted">
          −10 % y +10 % leen el precio de la ficha. Calcular no lo guarda
          {canApproveCatalog ? "." : ". El precio lo guarda el propietario."} El precio y el margen de la tabla son de
          la ficha. No son un pedido ni dinero cobrado.
        </p>
        <div className="mt-2 overflow-x-auto rounded-[14px] border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Margen estimado por producto</caption>
            <thead className="border-b border-line text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Precio ficha</th>
                <th className="px-3 py-2">Margen est.</th>
                <th className="px-3 py-2">−10 %</th>
                <th className="px-3 py-2">+10 %</th>
              </tr>
            </thead>
            <tbody>
              {analyst.scenarios.map((row) => {
                const down = row.scenarios[0];
                const up = row.scenarios[2];
                return (
                  <tr key={row.sku} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-semibold">{row.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{row.sku}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatCop(row.base.price)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatCop(row.base.margin)}
                      {row.base.marginRate !== null ? (
                        <span className="mt-0.5 block text-xs text-muted">{pct(row.base.marginRate)}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {down ? formatCop(down.margin) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{up ? formatCop(up.margin) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AgentBudgetPanel
        roles={budgetRoles.map((role) => ({
          id: role.id,
          name: role.name,
          job: role.job,
          config: role.config,
        }))}
        monthSpend={view.monthSpend}
        canEdit={canApproveCatalog}
      />

      {ag05 || ag06 || ag07 || ag08 || ag09 ? (
        <section className="elevate-1 mt-4 space-y-3 rounded-[14px] border border-line bg-card px-4 py-3" aria-labelledby="en-uso-lite">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">En uso</p>
          <h2 id="en-uso-lite" className="sr-only">
            Roles lite activos
          </h2>
          {ag05 ? (
            <div>
              <h3 className="text-sm font-bold">
                {ag05.id} · {ag05.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Responde con la ficha; si no alcanza, deriva a Pendientes humanos con borrador sugerido (OpenAI o
                plantilla). Verlo no cobra ni cambia pedidos.
              </p>
            </div>
          ) : null}
          {ag06 ? (
            <div>
              <h3 className="text-sm font-bold">
                {ag06.id} · {ag06.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Lite: «Leer pedido» en el detalle resume el estado (OpenAI o cifras). No cambia el pedido ni cobra.
              </p>
            </div>
          ) : null}
          {ag07 ? (
            <div>
              <h3 className="text-sm font-bold">
                {ag07.id} · {ag07.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Lite: «Generar borrador» en el pedido arma un mensaje para copiar. No envía WhatsApp ni cobra.
              </p>
            </div>
          ) : null}
          {ag08 ? (
            <div>
              <h3 className="text-sm font-bold">
                {ag08.id} · {ag08.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Lite: «Generar campaña» arma hipótesis y copy. No compra anuncios ni publica.
              </p>
            </div>
          ) : null}
          {ag09 ? (
            <div>
              <h3 className="text-sm font-bold">
                {ag09.id} · {ag09.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Lite: «Generar resolución» propone pasos y aviso al cliente. No resuelve ni envía solo.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="mt-6 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Después</p>

      <section className="mt-3" aria-labelledby="mas-adelante">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Lista</p>
        <h2 id="mas-adelante" className="mt-0.5 text-base font-bold">
          Más adelante (P1 / P2)
        </h2>
        <p className="mt-1 text-sm text-muted">Todavía no se usan. Verlos no cobra ni cambia pedidos.</p>
        <ul className="mt-3 space-y-2">
          {later.map((role) => (
            <li key={role.id} className="elevate-1 rounded-[14px] border border-line bg-card px-4 py-2.5">
              <p className="text-sm font-semibold">
                <span className="text-muted">{role.id} · </span>
                {role.name}
                <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{role.priority}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">{role.job}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Historial</p>

      <section className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-3 py-3" aria-labelledby="corridas">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Registro</p>
        <h2 id="corridas" className="mt-0.5 scroll-mt-24 text-base font-bold">
          Corridas recientes
        </h2>
        <p className="mt-1 text-sm text-muted">
          Últimas 8 en pantalla, con costo estimado cuando hubo OpenAI. Verlas o bajar el CSV no cobra ni cambia
          pedidos. El CSV trae hasta 500 del tenant. El costo estimado no es dinero cobrado.
        </p>
        <nav aria-label="Vista" className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vista</span>
          <a
            href="/panel/agentes/export"
            title="Bajarlo no cobra ni cambia pedidos."
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm font-semibold text-ink hover:bg-subtle"
          >
            Descargar CSV
          </a>
        </nav>
        {view.recentRuns.length === 0 ? (
          <div className="elevate-1 mt-3 rounded-[14px] border border-line bg-card px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">Vacío</p>
            <p className="mt-0.5 text-sm text-muted">
              Todavía no hay corridas. Usa Enrutar, Buscar, Generar borradores o Calcular para dejar el
              primer registro. Si OpenAI responde, la corrida puede mostrar costo estimado.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.recentRuns.map((run) => (
              <li key={run.id} className="rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold">{run.agentId}</span>
                  <span className="text-muted">· {run.status}</span>
                  {run.costEstimateCop > 0 ? (
                    <span className="text-muted">· costo est. {formatCop(run.costEstimateCop)}</span>
                  ) : (
                    <span className="text-muted">· sin costo est.</span>
                  )}
                  {run.actorName ? <span className="text-muted">· {run.actorName}</span> : null}
                  {run.createdAt ? (
                    <time className="text-xs text-muted" dateTime={run.createdAt}>
                      {new Date(run.createdAt).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  ) : null}
                </div>
                <p className="mt-0.5 text-muted">{run.summary || "Sin resumen."}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusChip({ label, ok, positive = false }: { label: string; ok: boolean; positive?: boolean }) {
  const tone = ok || positive ? "border-line text-ink" : "border-line text-muted";
  return (
    <span className={`inline-flex h-9 items-center rounded-[10px] border bg-card px-3 text-xs font-semibold ${tone}`}>
      <span
        className={`mr-2 h-2 w-2 rounded-full ${ok ? "bg-accent" : positive ? "bg-accent" : "bg-coral"}`}
        aria-hidden="true"
      />
      {label}: {ok ? "sí" : positive ? "sí" : "no"}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-xl font-extrabold tracking-tight">{value}</dd>
    </div>
  );
}

function MoneyStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-xl font-extrabold tracking-tight">{formatCop(value)}</dd>
    </div>
  );
}

function pct(rate: number) {
  return `${Math.round(rate * 1000) / 10} %`;
}
