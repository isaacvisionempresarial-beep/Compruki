import type { Metadata } from "next";
import { StoreHome } from "@/components/store/store-home";
import { storePublicTagline } from "@/lib/store-identity";
import { listPublicProducts } from "@/server/catalog-store";
import { getStoreIdentity } from "@/server/store-identity";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getStoreIdentity();
  return {
    title: identity.name,
    description: storePublicTagline(identity),
  };
}

export default async function StorePage() {
  const [products, identity] = await Promise.all([listPublicProducts(), getStoreIdentity()]);
  return <StoreHome products={products} identity={identity} />;
}
