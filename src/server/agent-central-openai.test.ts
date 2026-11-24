import { describe, expect, it } from "vitest";
import {
  clearCentralRoutePreviewCache,
  parseOpenAIRoutePlan,
  planRouteFromRules,
  rememberCentralRoute,
  getRememberedCentralRoute,
  type CentralRouteResult,
} from "@/server/agent-central";

describe("planRouteFromRules", () => {
  it("detecta margen y SKU", () => {
    const plan = planRouteFromRules("margen LAM-MES-01");
    expect(plan.sku).toBe("LAM-MES-01");
    expect(plan.wantsMargin).toBe(true);
    expect(plan.wantsExplore).toBe(true);
    expect(plan.via).toBe("reglas");
    expect(plan.costEstimateCop).toBe(0);
  });

  it("detecta borrador de contenido", () => {
    const plan = planRouteFromRules("borrador whatsapp faja");
    expect(plan.wantsContent).toBe(true);
    expect(plan.wantsMargin).toBe(false);
  });
});

describe("parseOpenAIRoutePlan", () => {
  it("lee banderas y focus sin Dropi/OpenAI", () => {
    const parsed = parseOpenAIRoutePlan(
      JSON.stringify({
        explore: true,
        margin: false,
        content: true,
        sku: "CAM-BAS-01",
        focus: "Quiere copy y shortlist Dropi con OpenAI",
      }),
      "",
    );
    expect(parsed).toEqual({
      wantsExplore: true,
      wantsMargin: false,
      wantsContent: true,
      sku: "CAM-BAS-01",
      focus: "Quiere copy y shortlist con",
    });
  });

  it("usa SKU de respaldo si el modelo no manda uno válido", () => {
    const parsed = parseOpenAIRoutePlan(
      JSON.stringify({ explore: true, margin: true, content: false, sku: "", focus: "Revisa precio" }),
      "FAJ-MOL-02",
    );
    expect(parsed?.sku).toBe("FAJ-MOL-02");
  });

  it("devuelve null si el JSON es inválido", () => {
    expect(parseOpenAIRoutePlan("{no-json", "")).toBeNull();
  });
});

describe("cache de ruta Central", () => {
  it("recuerda el resultado para no re-enrutar al recargar", () => {
    clearCentralRoutePreviewCache();
    const result: CentralRouteResult = {
      intent: "margen LAM-MES-01",
      openaiUsed: true,
      via: "openai",
      costEstimateCop: 8,
      agents: ["AG-01", "AG-04"],
      summary: ["ok"],
      pending: [],
      explorerCount: 0,
      marginNote: null,
      draftChannels: [],
      suggestedLinks: [],
    };
    rememberCentralRoute(result);
    expect(getRememberedCentralRoute("margen LAM-MES-01")?.via).toBe("openai");
    expect(getRememberedCentralRoute("margen LAM-MES-01")?.costEstimateCop).toBe(8);
    clearCentralRoutePreviewCache();
    expect(getRememberedCentralRoute("margen LAM-MES-01")).toBeNull();
  });
});
