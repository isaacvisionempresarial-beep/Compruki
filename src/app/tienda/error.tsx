"use client";

import { FailureScreen } from "@/components/failure-screen";

export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <FailureScreen scope="tienda" digest={error.digest} onRetry={retry} />;
}
