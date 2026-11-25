import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/login-screen";
import { getAuthUser, userHasPanelMembership } from "@/server/customer-auth";

const loginDescription = "Acceso al panel de la tienda piloto. Dropi no está conectado.";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: loginDescription,
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "Iniciar sesión · COMPRUKI",
    description: loginDescription,
    url: "/ingresar",
  },
  twitter: {
    card: "summary",
    title: "Iniciar sesión · COMPRUKI",
    description: loginDescription,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.modo === "nueva-clave" ? "nueva-clave" : params.error === "enlace" ? "recovery" : "login";
  const linkError = params.error === "enlace";
  const accessDenied = params.error === "sin-acceso";
  const otherStore = params.error === "otra-tienda";

  const user = await getAuthUser();
  if (user && initialMode !== "nueva-clave" && !accessDenied && !otherStore) {
    if (await userHasPanelMembership(user.id)) redirect("/panel");
    redirect("/tienda/cuenta");
  }

  return <LoginScreen initialMode={initialMode} linkError={linkError} accessDenied={accessDenied} otherStore={otherStore} />;
}
