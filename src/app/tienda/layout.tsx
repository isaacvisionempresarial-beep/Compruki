import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { CartProvider } from "@/components/store/cart-state";
import { StoreShell } from "@/components/store/store-shell";
import { storePublicTagline } from "@/lib/store-identity";
import { getStoreIdentity } from "@/server/store-identity";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getStoreIdentity();
  const description = storePublicTagline(identity);
  return {
    title: {
      default: identity.name,
      template: `%s · ${identity.name}`,
    },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${identity.name} · COMPRUKI`,
      description,
      locale: "es_CO",
      type: "website",
      url: "/tienda",
    },
    twitter: {
      card: "summary_large_image",
      title: `${identity.name} · COMPRUKI`,
      description,
    },
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const identity = await getStoreIdentity();
  return (
    <div className={outfit.variable}>
      <CartProvider>
        <StoreShell identity={identity}>{children}</StoreShell>
      </CartProvider>
    </div>
  );
}
