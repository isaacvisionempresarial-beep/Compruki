export type StoreIdentity = {
  name: string;
  slug: string;
  tagline: string;
  whatsapp: string;
  tableReady: boolean;
};

const DEFAULT_TAGLINE =
  "Elige, deja el pedido y paga cuando te llegue. El envío se acuerda aparte. Nadie cobra aquí.";

export function storePublicTagline(identity: Pick<StoreIdentity, "tagline">) {
  return identity.tagline.trim() || DEFAULT_TAGLINE;
}
