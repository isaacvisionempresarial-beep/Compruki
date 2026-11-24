import { describe, expect, it } from "vitest";
import {
  buildSaasGuideTemplate,
  clearSaasGuideCache,
  getSaasGuidePreview,
  parseOpenAISaasGuide,
  rememberSaasGuide,
  type OnboardingProgress,
  type SaasGuide,
} from "@/server/agent-saas-guide";

const progress: OnboardingProgress = {
  tenantLabel: "Tienda piloto",
  publishedProducts: 2,
  availableProducts: 1,
  openOrders: 3,
  pendingApprovals: 1,
  openaiConnected: true,
  openaiKeyPresent: true,
  dropiConnected: false,
  planLabel: "Piloto local (sin cobro de suscripción)",
  planLimits: ["Una tienda activa por sesión."],
};

describe("buildSaasGuideTemplate", () => {
  it("incluye pendientes y foco", () => {
    const guide = buildSaasGuideTemplate(progress);
    expect(guide.via).toBe("plantilla");
    expect(guide.steps.some((line) => line.includes("pendiente"))).toBe(true);
    expect(guide.nextFocus.toLowerCase()).toContain("pendiente");
    expect(guide.supportNote).toContain("Tienda piloto");
  });

  it("prioriza publicar si no hay fichas", () => {
    const guide = buildSaasGuideTemplate({ ...progress, publishedProducts: 0, availableProducts: 0, pendingApprovals: 0 });
    expect(guide.nextFocus.toLowerCase()).toContain("publicar");
  });
});

describe("parseOpenAISaasGuide", () => {
  it("limpia proveedores", () => {
    const parsed = parseOpenAISaasGuide(
      JSON.stringify({
        steps: ["Revisa Dropi", "Publica una ficha", "Atiende pendientes"],
        nextFocus: "Publica una ficha OpenAI tip",
        supportNote: "Hola, necesito ayuda con Dropi y OpenAI en el piloto.",
      }),
      progress,
    );
    expect(parsed?.steps[0]).toContain("sincronización");
    expect(parsed?.nextFocus).not.toMatch(/OpenAI/i);
    expect(parsed?.supportNote).not.toMatch(/Dropi|OpenAI/i);
  });

  it("rechaza vacío", () => {
    expect(parseOpenAISaasGuide(JSON.stringify({ steps: ["solo"] }), progress)).toBeNull();
  });
});

describe("cache saas", () => {
  it("recuerda la guía", () => {
    clearSaasGuideCache();
    const guide: SaasGuide = {
      progress,
      scoreLabel: "4 de 5 señales listas",
      steps: ["a", "b"],
      nextFocus: "Atiende pendientes humanos.",
      supportNote: "Necesito ayuda con la configuración.",
      via: "openai",
      costEstimateCop: 5,
    };
    rememberSaasGuide(guide);
    expect(getSaasGuidePreview()?.via).toBe("openai");
    clearSaasGuideCache();
    expect(getSaasGuidePreview()).toBeNull();
  });
});
