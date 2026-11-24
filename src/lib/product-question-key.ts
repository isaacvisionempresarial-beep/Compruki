/** Clave estable para detectar la misma pregunta abierta (SKU + texto). */
export function normalizeProductQuestionKey(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[¿¡?!.:,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
