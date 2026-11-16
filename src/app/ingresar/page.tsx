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

export default function LoginPage() {
  return <LoginScreen />;
}
