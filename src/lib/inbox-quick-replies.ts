/** Textos cortos para la ventana de 24 h (no son plantillas Meta). */
export type InboxQuickReply = {
  id: string;
  label: string;
  text: string;
};

export const INBOX_QUICK_REPLIES: InboxQuickReply[] = [
  {
    id: "saludo",
    label: "Saludo",
    text: "Hola{nombre}, gracias por escribirnos a Compruki. ¿En qué te ayudamos?",
  },
  {
    id: "disponibilidad",
    label: "Disponible",
    text: "Sí, lo tenemos disponible. ¿Para qué ciudad lo necesitas?",
  },
  {
    id: "precio",
    label: "Precio",
    text: "Te confirmo precio y envío con gusto. ¿Me dices el producto y tu ciudad?",
  },
  {
    id: "pedido",
    label: "Pedido",
    text: "Perfecto. Para armar el pedido necesito nombre completo, ciudad, dirección y celular de contacto.",
  },
  {
    id: "espera",
    label: "Un momento",
    text: "Dame un momento, lo reviso y te confirmo por aquí.",
  },
  {
    id: "cierre",
    label: "Cierre",
    text: "Quedamos atentos. Cualquier duda nos escribes por este mismo chat.",
  },
];

/** `{nombre}` → " María" o "" si no hay nombre útil. */
export function fillInboxQuickReply(template: string, contactName: string) {
  const first = contactName.trim().split(/\s+/).filter(Boolean)[0] || "";
  const skip = !first || /^57\d+$/.test(first) || /^\d+$/.test(first);
  const nombre = skip ? "" : ` ${first}`;
  return template.replaceAll("{nombre}", nombre);
}

const MEDIA_LABEL: Record<string, string> = {
  image: "Imagen",
  audio: "Audio",
  voice: "Audio",
  document: "Documento",
  video: "Video",
  sticker: "Sticker",
  reaction: "Reacción",
};

/** Etiqueta corta para tipos no texto en el hilo del Inbox. */
export function inboxMediaLabel(messageType: string) {
  return MEDIA_LABEL[messageType.trim().toLowerCase()] || null;
}

/** Borrador de estado con el pedido más reciente del chat. */
export function orderStatusQuickReply(
  order: { number: string; statusLabel: string },
  contactName: string,
) {
  return fillInboxQuickReply(
    `Hola{nombre}, tu pedido ${order.number} está en: ${order.statusLabel}. ¿Te ayudo con algo más?`,
    contactName,
  );
}
