"use server";

import { assertPanelSignedIn } from "@/server/panel-auth";

const OFFICIAL_MCP = "https://mcp.dropi.co/mcp";
const OFFICIAL_HOST = "mcp.dropi.co";

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
        detail: "Contestó el saludo. No autoriza la cuenta ni devuelve pedidos o productos.",
      };
    }
    if (text.includes('"result"') || text.includes("serverInfo") || text.startsWith("event:")) {
      return {
        state: "saludo_sin_cuenta",
        detail: "Contestó el saludo MCP. Esta aplicación sigue sin autorización de la cuenta.",
      };
    }
    return {
      state: "respuesta_no_usable",
      detail: "Contestó, pero no es una consulta de la cuenta. No hay pedidos ni productos.",
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
