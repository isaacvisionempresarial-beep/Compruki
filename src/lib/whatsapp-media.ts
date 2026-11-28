/** media_id de Meta guardado como `media:<id>` en delivery_detail (sin migración). */
export function mediaIdFromDetail(detail: string) {
  const match = /^media:(\S+)/.exec(detail.trim());
  return match?.[1] || "";
}
