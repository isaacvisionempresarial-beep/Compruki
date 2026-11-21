"use client";

import { FailureScreen } from "@/components/failure-screen";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh bg-canvas font-sans antialiased">
        <main id="contenido" className="px-4 py-4">
          <FailureScreen scope="app" digest={error.digest} onRetry={retry} showBrand />
        </main>
      </body>
    </html>
  );
}
