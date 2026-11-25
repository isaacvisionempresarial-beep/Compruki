import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { CartProvider } from "@/components/store/cart-state";
import { StoreShell } from "@/components/store/store-shell";
import { storePublicTagline } from "@/lib/store-identity";
import { getCustomerSession } from "@/server/customer-auth";
import { getStoreIdentity } from "@/server/store-identity";

export const dynamic = "force-dynamic";

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

function buyerLabel(displayName: string, email: string) {
  const first = displayName.trim().split(/\s+/).filter(Boolean)[0];
  if (first) return first.slice(0, 18);
  const local = email.split("@")[0]?.trim();
  return (local || "Cuenta").slice(0, 18);
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [identity, session] = await Promise.all([getStoreIdentity(), getCustomerSession()]);
  const accountLabel = session
    ? buyerLabel(session.profile.displayName, session.profile.email)
    : null;
  return (
    <div className={outfit.variable}>
      <CartProvider>
        <StoreShell identity={identity} accountLabel={accountLabel}>
          {children}
        </StoreShell>
      </CartProvider>
    </div>
  );
}
