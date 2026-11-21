import { describe, expect, it } from "vitest";
import { recordAttempt } from "@/lib/attempt-budget";
import { CHECKOUT_CREATE_RULE, LOOKUP_PHONE_RULE } from "@/lib/public-limits";

describe("intentos seguidos de la tienda", () => {
  it("deja consultar hasta el cupo y frena el siguiente dentro de la ventana", () => {
    let stamps: number[] = [];
    const start = 1_000_000;
    for (let index = 0; index < LOOKUP_PHONE_RULE.limit; index += 1) {
      const result = recordAttempt(stamps, start + index, LOOKUP_PHONE_RULE);
      expect(result.allowed).toBe(true);
      stamps = result.stamps;
    }
    expect(recordAttempt(stamps, start + LOOKUP_PHONE_RULE.limit, LOOKUP_PHONE_RULE).allowed).toBe(false);
  });

  it("vuelve a permitir cuando los intentos viejos salen de la ventana", () => {
    const start = 5_000_000;
    let stamps = Array.from({ length: LOOKUP_PHONE_RULE.limit }, (_, index) => start + index);
    const later = start + LOOKUP_PHONE_RULE.limit + LOOKUP_PHONE_RULE.windowMs;
    const result = recordAttempt(stamps, later, LOOKUP_PHONE_RULE);
    expect(result.allowed).toBe(true);
    expect(result.stamps).toEqual([later]);
  });

  it("cuenta aparte la creación de pedidos y no arrastra intentos de otra regla", () => {
    let stamps: number[] = [];
    const start = 9_000_000;
    for (let index = 0; index < CHECKOUT_CREATE_RULE.limit; index += 1) {
      const result = recordAttempt(stamps, start + index * 1000, CHECKOUT_CREATE_RULE);
      expect(result.allowed).toBe(true);
      stamps = result.stamps;
    }
    expect(recordAttempt(stamps, start + 60_000, CHECKOUT_CREATE_RULE).allowed).toBe(false);
    expect(recordAttempt([], start, LOOKUP_PHONE_RULE).allowed).toBe(true);
  });
});
