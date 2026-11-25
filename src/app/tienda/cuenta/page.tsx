import type { Metadata } from "next";
import { AccountScreen } from "@/components/store/account-screen";
import { getCustomerSession } from "@/server/customer-auth";
import { listOrdersForCustomer } from "@/server/customer-orders";

export const metadata: Metadata = {
  title: "Tu cuenta",
  description: "Entra o crea cuenta para pedir, guardar el carrito y ver tus pedidos.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function bootErrorMessage(code: string | undefined) {
  if (code === "google") return "No se pudo abrir Google. Revisa el proveedor en Supabase o intenta con correo.";
  if (code === "enlace") return "El enlace no es válido o ya venció. Pide otro.";
  if (code === "limite") return "Demasiados intentos. Espera unos minutos.";
  return null;
}

export default async function CustomerAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; modo?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//") && !params.next.startsWith("/panel")
      ? params.next
      : "/tienda/pagar";
  const session = await getCustomerSession();
  const orders = session ? await listOrdersForCustomer(session.user.id) : [];
  const initialMode = params.modo === "nueva-clave" ? "nueva-clave" : "login";

  return (
    <div className="store-rise py-2" style={{ animationDelay: "40ms" }}>
      <AccountScreen
        nextPath={nextPath}
        signedIn={Boolean(session)}
        displayName={session?.profile.displayName}
        email={session?.profile.email}
        phone={session?.profile.phone}
        emailOrderUpdates={session?.profile.emailOrderUpdates}
        orders={orders}
        bootError={bootErrorMessage(params.error)}
        initialMode={initialMode}
      />
    </div>
  );
}
