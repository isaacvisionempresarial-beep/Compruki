"use client";

import { FailureScreen } from "@/components/failure-screen";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="contenido" tabIndex={-1} className="min-h-dvh bg-canvas px-4 py-4 outline-none">
      <FailureScreen scope="app" digest={error.digest} onRetry={retry} showBrand />
    </main>
  );
}
