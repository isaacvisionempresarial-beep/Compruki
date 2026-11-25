import { describe, expect, it } from "vitest";
import { isPlausibleIp, resolveClientAddress } from "@/server/public-guard";

describe("resolveClientAddress", () => {
  it("prefiere x-real-ip", () => {
    expect(resolveClientAddress("1.1.1.1, 2.2.2.2", "10.0.0.9")).toBe("10.0.0.9");
  });

  it("usa el último hop de x-forwarded-for (no el primero spoofable)", () => {
    expect(resolveClientAddress("8.8.8.8, 203.0.113.10", null)).toBe("203.0.113.10");
  });

  it("rechaza basura", () => {
    expect(isPlausibleIp("not an ip")).toBe(false);
    expect(resolveClientAddress("evil, also-bad", null)).toBe("sin-ip");
  });
});
