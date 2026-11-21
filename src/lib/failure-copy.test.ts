import { describe, expect, it } from "vitest";
import { failureBody, safeFailureCode } from "@/lib/failure-copy";

describe("recuperación ante fallas", () => {
  it("no muestra claves, contraseñas ni direcciones del error", () => {
    const leaked = "postgres://service_role:super-secret@db.supabase.co/postgres password=abc";
    expect(safeFailureCode(leaked)).toBe("");
    expect(failureBody("tienda", leaked)).not.toContain("postgres");
    expect(failureBody("panel", leaked)).not.toContain("secret");
    expect(failureBody("app", "Error: Bearer sk-live-123")).not.toContain("sk-live");
    expect(failureBody("tienda")).toContain("nadie cobra");
    expect(failureBody("panel")).toContain("No se leyeron ni se cambiaron los pedidos");
  });

  it("conserva solo un código opaco para poder reportarlo", () => {
    expect(failureBody("app", "a1b2c3d4")).toContain("Código a1b2c3d4.");
    expect(safeFailureCode("ok")).toBe("");
    expect(safeFailureCode("codigo con espacios")).toBe("");
  });
});
