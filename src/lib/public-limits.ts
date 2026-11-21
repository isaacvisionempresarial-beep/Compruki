export const LOOKUP_PHONE_RULE = { limit: 8, windowMs: 10 * 60 * 1000 };
export const LOOKUP_IP_RULE = { limit: 40, windowMs: 10 * 60 * 1000 };
export const CHECKOUT_TRY_RULE = { limit: 40, windowMs: 10 * 60 * 1000 };
export const CHECKOUT_CREATE_RULE = { limit: 30, windowMs: 60 * 60 * 1000 };
export const CUSTOMER_WRITE_RULE = { limit: 20, windowMs: 10 * 60 * 1000 };

export const LOOKUP_BURST_ERROR =
  "Demasiados intentos seguidos. Espera unos minutos y vuelve a consultar. No se abrió ningún pedido. Nadie cobra en la tienda.";

export const CHECKOUT_BURST_ERROR =
  "Llegaron muchos intentos seguidos. Espera un momento. No se creó el pedido. Nadie cobra en la tienda.";

export const CUSTOMER_BURST_ERROR =
  "Demasiados cambios seguidos. Espera unos minutos. No se cambió el pedido. Nadie cobra en la tienda.";
