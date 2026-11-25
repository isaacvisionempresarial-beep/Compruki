import { describe, expect, it } from "vitest";
import { isStoreOrderId } from "@/lib/store-order";
import { allocateOrderId } from "@/server/order-store";

describe("allocateOrderId", () => {
  it("emite ord_ de 32 hex y evita colisión", () => {
    const first = allocateOrderId([]);
    expect(isStoreOrderId(first)).toBe(true);
    expect(first).toMatch(/^ord_[0-9a-f]{32}$/i);

    const second = allocateOrderId([first]);
    expect(second).not.toBe(first);
    expect(isStoreOrderId(second)).toBe(true);
  });
});
