"use server";

import { DROPI_MCP_HOST, DROPI_OAUTH_HOST, officialDropiHost } from "@/lib/dropi-provider";
import { recordDropiAdvertisement } from "@/server/dropi-connection";
import { assertPanelSignedIn } from "@/server/panel-auth";

const OFFICIAL_MCP = `https://${DROPI_MCP_HOST}/mcp`;
const OFFICIAL_HOST = DROPI_MCP_HOST;

export type DropiProbe = {
  state: "pide_autorizacion" | "sin_respuesta" | "saludo_sin_cuenta" | "respuesta_no_usable";
  detail: string;
};

export async function probeOfficialDropi(_previous: DropiProbe | null = null): Promise<DropiProbe> {
  void _previous;
  if (!(await assertPanelSignedIn())) {
    return { state: "sin_respuesta", detail: "Entra al panel para consultar el servidor oficial." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(OFFICIAL_MCP, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "compruki", version: "0.1.0" },
        },
      }),
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        state: "pide_autorizacion",
        detail: "El servidor oficial redirige a la autorización. Esta aplicación no tiene sesión de la cuenta.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        state: "pide_autorizacion",
        detail: "El servidor oficial respondió que falta autorización. No hay órdenes ni productos.",
      };
    }
    if (!response.ok) {
      return {
        state: "respuesta_no_usable",
        detail: `El servidor oficial contestó ${response.status}. No es una consulta de la cuenta.`,
      };
    }

    const host = new URL(response.url).host;
    if (host !== OFFICIAL_HOST) {
      return {
        state: "respuesta_no_usable",
        detail: "La respuesta salió del servidor oficial. No se usa.",
      };
    }

    const text = (await response.text()).slice(0, 2000);
    if (text.includes("mcp.dropi.co") && text.toLowerCase().includes("initialize") && text.includes("serverInfo")) {
      return {
        state: "saludo_sin_cuenta",
        detail: "Contestó el saludo. No autoriza la cuenta ni devuelve pedidos o productos. El total guardado no cambió.",
      };
    }
    if (text.includes('"result"') || text.includes("serverInfo") || text.startsWith("event:")) {
      return {
        state: "saludo_sin_cuenta",
        detail: "Contestó el saludo MCP. Esta aplicación sigue sin autorización de la cuenta. El total guardado no cambió.",
      };
    }
    return {
      state: "respuesta_no_usable",
      detail: "Contestó, pero no es una consulta de la cuenta. No hay pedidos ni productos. El total guardado no cambió.",
    };
  } catch {
    return {
      state: "sin_respuesta",
      detail: "No contestó a tiempo. Esta aplicación no está conectada.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type DropiAdvertisement = {
  state: "anuncia_autorizacion" | "sin_documento" | "sin_respuesta" | "respuesta_no_usable";
  detail: string;
};

export async function inspectDropiAuthorization(_previous: DropiAdvertisement | null = null): Promise<DropiAdvertisement> {
  void _previous;
  if (!(await assertPanelSignedIn())) {
    return { state: "sin_respuesta", detail: "Entra al panel para ver qué anuncia el servidor oficial." };
  }

  const result = await readAuthorizationAdvertisement();
  await recordDropiAdvertisement(result.detail);
  return result;
}

async function readAuthorizationAdvertisement(): Promise<DropiAdvertisement> {
  const headerUrl = await metadataUrlFromMcp();
  const candidates = [
    headerUrl,
    `https://${DROPI_MCP_HOST}/.well-known/oauth-protected-resource`,
    `https://${DROPI_MCP_HOST}/.well-known/oauth-protected-resource/mcp`,
  ].filter((value): value is string => Boolean(value));

  let sawDocument = false;
  for (const candidate of candidates) {
    if (!officialDropiHost(candidate)) continue;
    const body = await fetchOfficialJson(candidate);
    if (body === "timeout") {
      return {
        state: "sin_respuesta",
        detail: "El servidor oficial no contestó a tiempo. Conectar sigue bloqueado. La contraseña no se pide aquí.",
      };
    }
    if (body === "offhost" || body === "redirect") {
      return {
        state: "respuesta_no_usable",
        detail: "La respuesta salió del servidor oficial o redirigió. No la seguí. Conectar sigue bloqueado.",
      };
    }
    if (!body) continue;
    sawDocument = true;
    const hosts = authorizationHosts(body);
    if (hosts.length > 0) {
      const named = hosts.includes(DROPI_OAUTH_HOST) ? DROPI_OAUTH_HOST : hosts[0];
      return {
        state: "anuncia_autorizacion",
        detail: `Anuncia autorización en ${named}. Esta aplicación no está registrada: no hay client_id ni token. La contraseña no se pide aquí. El total guardado no cambió.`,
      };
    }
  }

  if (sawDocument) {
    return {
      state: "sin_documento",
      detail: "Contestó, pero no anunció un servidor de autorización en dropi.co. Conectar sigue bloqueado. La contraseña no se pide aquí.",
    };
  }
  return {
    state: "sin_documento",
    detail: "No publicó el documento de autorización. Conectar sigue bloqueado. La contraseña no se pide aquí. El total guardado no cambió.",
  };
}

async function metadataUrlFromMcp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(OFFICIAL_MCP, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (response.status >= 300 && response.status < 400) return null;
    const host = new URL(response.url).host;
    if (host !== OFFICIAL_HOST) return null;
    return metadataUrl(response.headers.get("www-authenticate"));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function metadataUrl(header: string | null) {
  if (!header) return null;
  const match = header.match(/resource_metadata="([^"]+)"/i);
  const value = match?.[1];
  if (!value || !officialDropiHost(value)) return null;
  return value;
}

async function fetchOfficialJson(target: string): Promise<unknown | "timeout" | "redirect" | "offhost" | null> {
  if (!officialDropiHost(target)) return "offhost";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (response.status >= 300 && response.status < 400) return "redirect";
    const host = new URL(response.url).host;
    if (!officialDropiHost(`https://${host}`)) return "offhost";
    if (!response.ok) return null;
    const text = (await response.text()).slice(0, 8000);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "timeout";
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function authorizationHosts(body: unknown) {
  const hosts = new Set<string>();
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const values = [record?.authorization_servers, record?.authorization_server, record?.issuer].flat();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const host = officialDropiHost(value);
    if (host) hosts.add(host);
  }
  return [...hosts];
}
