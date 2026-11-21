import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";

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

  return <LoginScreen initialMode={initialMode} linkError={linkError} accessDenied={accessDenied} otherStore={otherStore} />;
}
