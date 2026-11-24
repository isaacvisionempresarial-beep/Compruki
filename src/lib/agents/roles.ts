export type AgentPriority = "P0-IA" | "P1" | "P2";

export type AgentRoleDefinition = {
  id: string;
  name: string;
  job: string;
  tools: string[];
  priority: AgentPriority;
};

/** Catálogo de diseño del Documento Maestro. No implica que estén desplegados. */
export const AGENT_ROLES: AgentRoleDefinition[] = [
  {
    id: "AG-01",
    name: "COMPRUKI Central",
    job: "Comprender intención, coordinar especialistas, resumir propuestas y presentar pendientes de aprobación.",
    tools: ["route_task", "get_store_summary", "list_pending_approvals"],
    priority: "P0-IA",
  },
  {
    id: "AG-02",
    name: "Explorador de Productos",
    job: "Buscar categorías y productos autorizados, revisar fichas y costos; shortlist trazable.",
    tools: ["search_provider_products", "get_product_details", "get_catalog_categories"],
    priority: "P0-IA",
  },
  {
    id: "AG-03",
    name: "Creador de Contenido",
    job: "Borradores de títulos, descripciones, anuncios y variantes por canal para revisión humana.",
    tools: ["get_product_facts", "get_brand_guidelines", "save_content_draft"],
    priority: "P0-IA",
  },
  {
    id: "AG-04",
    name: "Analista de Rentabilidad",
    job: "Explicar margen y escenarios con cifras del catálogo y pedidos; sin inventar datos.",
    tools: ["calculate_margin", "compare_price_scenarios", "get_order_financials"],
    priority: "P0-IA",
  },
  {
    id: "AG-05",
    name: "Asesor de Ventas",
    job: "Responder dudas verificables del catálogo público; si no alcanza, handoff con borrador para revisión humana.",
    tools: ["search_public_catalog", "get_delivery_terms", "request_human_handoff", "draft_owner_answer"],
    priority: "P1",
  },
  {
    id: "AG-06",
    name: "Gestor de Pedidos",
    job: "Lectura de estado y anomalías del pedido con datos locales; envíos con confirmación humana más adelante.",
    tools: ["get_order_status", "draft_order_reading", "prepare_order_submission", "submit_approved_order"],
    priority: "P1",
  },
  {
    id: "AG-07",
    name: "Gestor de Clientes",
    job: "Borradores de mensaje al cliente desde el pedido; envío manual. Seguimientos con consentimiento más adelante.",
    tools: ["draft_customer_message", "list_consented_leads", "create_followup_task"],
    priority: "P1",
  },
  {
    id: "AG-08",
    name: "Especialista en Publicidad",
    job: "Preparar hipótesis y copies; no compra anuncios sin aprobación.",
    tools: ["get_campaign_metrics", "draft_campaign", "prepare_publish_request"],
    priority: "P2",
  },
  {
    id: "AG-09",
    name: "Agente de Posventa",
    job: "Borradores de resolución y aviso al cliente en incidencias; un humano decide y envía.",
    tools: ["get_order_history", "draft_resolution", "draft_customer_note"],
    priority: "P2",
  },
  {
    id: "AG-10",
    name: "Asistente SaaS",
    job: "Guiar alta y configuración de cada comerciante.",
    tools: ["get_onboarding_progress", "get_plan_limits", "create_support_ticket"],
    priority: "P2",
  },
];

export function agentRolesByPriority(priority: AgentPriority) {
  return AGENT_ROLES.filter((role) => role.priority === priority);
}
