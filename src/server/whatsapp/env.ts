/** Credenciales Meta Cloud API (solo servidor / Railway). */

export type MetaWaEnv = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  verifyToken: string;
  appSecret: string;
  /** Opcional. Si falta, se intenta leer del token con debug_token. */
  appId: string;
  graphVersion: string;
};

export function readMetaWaEnv(): Partial<MetaWaEnv> {
  return {
    accessToken: process.env.META_WA_ACCESS_TOKEN?.trim() || undefined,
    phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID?.trim() || undefined,
    businessAccountId: process.env.META_WA_WABA_ID?.trim() || undefined,
    verifyToken: process.env.META_WA_VERIFY_TOKEN?.trim() || undefined,
    appSecret: process.env.META_WA_APP_SECRET?.trim() || undefined,
    appId: process.env.META_WA_APP_ID?.trim() || undefined,
    graphVersion: process.env.META_WA_GRAPH_VERSION?.trim() || "v22.0",
  };
}

export function metaWaConfigured(env: Partial<MetaWaEnv> = readMetaWaEnv()): boolean {
  return Boolean(env.accessToken && env.phoneNumberId && env.verifyToken && env.appSecret);
}

export function requireMetaWaEnv(): MetaWaEnv {
  const env = readMetaWaEnv();
  if (!env.accessToken || !env.phoneNumberId || !env.verifyToken || !env.appSecret) {
    throw new Error(
      "Faltan META_WA_ACCESS_TOKEN, META_WA_PHONE_NUMBER_ID, META_WA_VERIFY_TOKEN o META_WA_APP_SECRET.",
    );
  }
  return {
    accessToken: env.accessToken,
    phoneNumberId: env.phoneNumberId,
    businessAccountId: env.businessAccountId || "",
    verifyToken: env.verifyToken,
    appSecret: env.appSecret,
    appId: env.appId || "",
    graphVersion: env.graphVersion || "v22.0",
  };
}

export function metaWaEnvSummary(env: Partial<MetaWaEnv> = readMetaWaEnv()) {
  return {
    accessToken: Boolean(env.accessToken),
    phoneNumberId: Boolean(env.phoneNumberId),
    businessAccountId: Boolean(env.businessAccountId),
    verifyToken: Boolean(env.verifyToken),
    appSecret: Boolean(env.appSecret),
    appId: Boolean(env.appId),
    graphVersion: env.graphVersion || "v22.0",
    ready: metaWaConfigured(env),
  };
}
