"use server";

import { revalidatePath } from "next/cache";
import { normalizeCrmPhone } from "@/lib/crm-contacts";
import type { StoreIdentity } from "@/lib/store-identity";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertPanelAccess } from "@/server/panel-auth";
import { getPilotTenantId } from "@/server/tenant";

export type { StoreIdentity };

export type StoreIdentityState = {
  error: string | null;
  message: string | null;
};

function missingIdentityColumns(message: string) {
  return (
    message.includes("public_tagline") ||
    message.includes("public_whatsapp") ||
    ((message.includes("schema cache") || message.includes("does not exist") || message.includes("column")) &&
      (message.includes("tagline") || message.includes("whatsapp")))
  );
}

export async function probeStoreIdentityColumns(): Promise<boolean> {
  try {
    const tenantId = await getPilotTenantId();
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("tenants")
      .select("public_tagline, public_whatsapp")
      .eq("id", tenantId)
      .limit(1);
    if (!error) return true;
    return !missingIdentityColumns(error.message);
  } catch {
    return false;
  }
}

export async function getStoreIdentity(): Promise<StoreIdentity> {
  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();

  const withIdentity = await supabase
    .from("tenants")
    .select("name, slug, public_tagline, public_whatsapp")
    .eq("id", tenantId)
    .maybeSingle();

  if (!withIdentity.error && withIdentity.data) {
    return {
      name: String(withIdentity.data.name ?? "").trim() || "Tienda piloto",
      slug: String(withIdentity.data.slug ?? "tienda-piloto"),
      tagline: String(withIdentity.data.public_tagline ?? "").trim(),
      whatsapp: normalizeCrmPhone(String(withIdentity.data.public_whatsapp ?? "")),
      tableReady: true,
    };
  }

  if (withIdentity.error && missingIdentityColumns(withIdentity.error.message)) {
    const basic = await supabase.from("tenants").select("name, slug").eq("id", tenantId).maybeSingle();
    return {
      name: String(basic.data?.name ?? "").trim() || "Tienda piloto",
      slug: String(basic.data?.slug ?? "tienda-piloto"),
      tagline: "",
      whatsapp: "",
      tableReady: false,
    };
  }

  throw new Error(withIdentity.error?.message || "No se pudo leer la identidad de la tienda.");
}

export async function updateStoreIdentityAction(
  _prev: StoreIdentityState,
  formData: FormData,
): Promise<StoreIdentityState> {
  const access = await assertPanelAccess();
  if (!access) return { error: "Sesión vencida. Vuelve a ingresar.", message: null };
  if (access.role !== "owner") {
    return { error: "Solo el propietario guarda el nombre y el contacto públicos.", message: null };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const tagline = String(formData.get("tagline") ?? "").trim().slice(0, 220);
  const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();
  const whatsapp = normalizeCrmPhone(whatsappRaw);

  if (name.length < 2) return { error: "El nombre de la tienda debe tener al menos 2 caracteres.", message: null };
  if (whatsappRaw && !/^3\d{9}$/.test(whatsapp)) {
    return { error: "El WhatsApp debe ser un celular Colombia de 10 dígitos que empiece en 3.", message: null };
  }

  const ready = await probeStoreIdentityColumns();
  if (!ready) {
    return {
      error: "Falta la migración 015_store_identity.sql. Ejecútala en Supabase SQL Editor.",
      message: null,
    };
  }

  const tenantId = await getPilotTenantId();
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("tenants")
    .update({
      name,
      public_tagline: tagline,
      public_whatsapp: whatsapp,
    })
    .eq("id", tenantId);

  if (error) {
    if (missingIdentityColumns(error.message)) {
      return {
        error: "Falta la migración 015_store_identity.sql. Ejecútala en Supabase SQL Editor.",
        message: null,
      };
    }
    return { error: error.message.slice(0, 280), message: null };
  }

  revalidatePath("/panel/ajustes");
  revalidatePath("/panel");
  revalidatePath("/tienda");
  revalidatePath("/tienda", "layout");

  return { error: null, message: "Identidad pública guardada. Se ve en la tienda. No conecta Dropi ni envía WhatsApp." };
}
