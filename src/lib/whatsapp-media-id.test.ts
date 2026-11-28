import { describe, expect, it } from "vitest";
import { mediaIdFromDetail } from "@/lib/whatsapp-media";

describe("mediaIdFromDetail", () => {
  it("lee el media_id guardado en delivery_detail", () => {
    expect(mediaIdFromDetail("media:1287364512398765")).toBe("1287364512398765");
    expect(mediaIdFromDetail("media:abc123 extra")).toBe("abc123");
    expect(mediaIdFromDetail("")).toBe("");
    expect(mediaIdFromDetail("Ventana de 24 h cerrada")).toBe("");
  });
});
