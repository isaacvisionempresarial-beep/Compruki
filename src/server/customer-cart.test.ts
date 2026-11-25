import { describe, expect, it } from "vitest";
import { mergeCartLines } from "@/server/customer-cart";

describe("mergeCartLines", () => {
  it("suma cantidades del mismo sku/variante con tope 5", () => {
    const merged = mergeCartLines(
      [{ sku: "A", quantity: 2, variant: "L" }],
      [
        { sku: "A", quantity: 3, variant: "L" },
        { sku: "B", quantity: 1, variant: "" },
      ],
    );
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: "A", quantity: 5, variant: "L" }),
        expect.objectContaining({ sku: "B", quantity: 1, variant: "" }),
      ]),
    );
  });
});
