import { describe, expect, it } from "vitest";
import { attentionQueueOrderHref } from "@/lib/store-order";

describe("attentionQueueOrderHref", () => {
  it("manda Dropi a Sincronización", () => {
    expect(attentionQueueOrderHref("cola-numero-dropi", "PED-1")).toContain("/panel/sincronizacion/");
    expect(attentionQueueOrderHref("cola-numero-cerrado", "PED-1")).toContain("/panel/sincronizacion/");
  });

  it("ancla preparar, posventa y avisos", () => {
    expect(attentionQueueOrderHref("cola-preparacion", "PED-2")).toContain("#pedido-preparar");
    expect(attentionQueueOrderHref("cola-resolver", "PED-2")).toContain("#pedido-posventa");
    expect(attentionQueueOrderHref("cola-motivo", "PED-2")).toContain("#pedido-avisos");
  });

  it("cae en herramientas para despacho y cobro", () => {
    expect(attentionQueueOrderHref("cola-despacho", "PED-3")).toContain("#pedido-herramientas");
    expect(attentionQueueOrderHref("cola-cobro", "PED-3")).toContain("#pedido-herramientas");
  });
});
