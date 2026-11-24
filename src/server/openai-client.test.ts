import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

vi.mock("openai", () => ({
  default: class {
    models = { list: listMock };
    constructor(_opts: unknown) {}
  },
}));

describe("openai-client AG-0", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  beforeEach(() => {
    listMock.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  });

  it("reporta falta de clave sin llamar a la red", async () => {
    const { probeOpenAI, openAIKeyConfigured, openAIModel } = await import("@/server/openai-client");
    expect(openAIKeyConfigured()).toBe(false);
    expect(openAIModel()).toBe("gpt-4.1-mini");
    const result = await probeOpenAI({ force: true });
    expect(result.ok).toBe(false);
    expect(result.keyConfigured).toBe(false);
    expect(result.detail).toContain("OPENAI_API_KEY");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("marca ok cuando models.list responde", async () => {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    listMock.mockResolvedValueOnce({ data: [{ id: "gpt-4.1-mini" }] });
    const { probeOpenAI } = await import("@/server/openai-client");
    const result = await probeOpenAI({ force: true });
    expect(result.ok).toBe(true);
    expect(result.keyConfigured).toBe(true);
    expect(result.detail).toContain("gpt-4.1-mini");
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("no filtra la clave en errores de autenticación", async () => {
    process.env.OPENAI_API_KEY = "sk-secret-should-not-leak";
    listMock.mockRejectedValueOnce(new Error("Incorrect API key provided: sk-secret-should-not-leak"));
    const { probeOpenAI, safeOpenAIError } = await import("@/server/openai-client");
    const result = await probeOpenAI({ force: true });
    expect(result.ok).toBe(false);
    expect(result.detail).not.toContain("sk-secret-should-not-leak");
    expect(safeOpenAIError(new Error("Incorrect API key provided: sk-secret-should-not-leak"))).not.toContain(
      "sk-secret",
    );
  });
});
