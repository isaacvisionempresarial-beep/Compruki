import { describe, expect, it } from "vitest";
import {
  groupFollowupsByStage,
  normalizeFollowupStage,
  nextFollowupStages,
} from "@/lib/crm-pipeline";

describe("normalizeFollowupStage", () => {
  it("acepta etapas válidas y cae a nuevo", () => {
    expect(normalizeFollowupStage("contactar")).toBe("contactar");
    expect(normalizeFollowupStage("")).toBe("nuevo");
    expect(normalizeFollowupStage("otra")).toBe("nuevo");
  });
});

describe("nextFollowupStages", () => {
  it("ofrece avances desde nuevo", () => {
    expect(nextFollowupStages("nuevo")).toEqual(["contactar", "espera", "negociacion"]);
  });
});

describe("groupFollowupsByStage", () => {
  it("agrupa por columna", () => {
    const grouped = groupFollowupsByStage([
      { id: "1", stage: "nuevo" as const },
      { id: "2", stage: "espera" as const },
      { id: "3", stage: "nuevo" as const },
    ]);
    expect(grouped.nuevo).toHaveLength(2);
    expect(grouped.contactar).toHaveLength(0);
    expect(grouped.espera).toHaveLength(1);
  });
});
