import { describe, expect, it } from "vitest";
import {
  clearExplorerPreviewCache,
  getExplorerShortlistPreview,
  parseOpenAIExplorerPlan,
  rememberExplorerShortlist,
  type ExplorerProduct,
  type ExplorerShortlist,
} from "@/server/agent-explorer";

const products: ExplorerProduct[] = [
  {
    sku: "LAM-MES-01",
    title: "Lámpara",
    category: "Hogar",
    price: 80_000,
    margin: 38_000,
    published: true,
    available: true,
    variants: [],
    sizeKind: null,
    externalRef: "",
    source: "catalogo_local",
  },
  {
    sku: "FAJ-MOL-02",
    title: "Faja",
    category: "Ropa",
    price: 60_000,
    margin: 20_000,
    published: true,
    available: true,
    variants: ["M"],
    sizeKind: "letra",
    externalRef: "",
    source: "catalogo_local",
  },
];

describe("parseOpenAIExplorerPlan", () => {
  it("ordena SKUs válidos y limpia bullets", () => {
    const parsed = parseOpenAIExplorerPlan(
      JSON.stringify({
        skus: ["FAJ-MOL-02", "NO-EXISTE", "LAM-MES-01"],
        bullets: ["Mejor match Dropi ropa", "OpenAI sugiere faja"],
      }),
      products,
    );
    expect(parsed?.skus).toEqual(["FAJ-MOL-02", "LAM-MES-01"]);
    expect(parsed?.bullets).toEqual(["Mejor match ropa", "sugiere faja"]);
  });

  it("devuelve null si no hay datos útiles", () => {
    expect(parseOpenAIExplorerPlan(JSON.stringify({ skus: [], bullets: [] }), products)).toBeNull();
    expect(parseOpenAIExplorerPlan("no-json", products)).toBeNull();
  });
});

describe("cache de Explorador", () => {
  it("recuerda la shortlist openai tras Buscar", () => {
    clearExplorerPreviewCache();
    const shortlist: ExplorerShortlist = {
      query: "faja",
      category: "",
      sourceLabel: "Catálogo local de la tienda piloto",
      dropiLive: false,
      categories: ["Ropa"],
      results: [products[1]],
      via: "openai",
      costEstimateCop: 7,
      bullets: ["ok"],
    };
    rememberExplorerShortlist(shortlist);
    expect(getExplorerShortlistPreview("faja", "")?.via).toBe("openai");
    expect(getExplorerShortlistPreview("faja", "")?.costEstimateCop).toBe(7);
    clearExplorerPreviewCache();
    expect(getExplorerShortlistPreview("faja", "")).toBeNull();
  });
});
