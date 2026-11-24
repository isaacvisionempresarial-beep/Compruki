"use client";

import { StatusPage } from "@/components/status-page";
import { failureBody, failureCopy, type FailureScope } from "@/lib/failure-copy";

export function FailureScreen({
  scope,
  digest,
  onRetry,
  showBrand = false,
}: {
  scope: FailureScope;
  digest?: string;
  onRetry: () => void;
  showBrand?: boolean;
}) {
  const copy = failureCopy(scope);
  return (
    <StatusPage
      showBrand={showBrand}
      wide={scope === "panel"}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={failureBody(scope, digest)}
      actions={[
        { label: "Reintentar", title: copy.retryTitle, onClick: onRetry, primary: true },
        ...copy.links,
      ]}
      asideItems={[
        { label: "Pedidos", text: "Esta falla no confirma, no cancela y no cambia el total guardado." },
        { label: "Cobro", text: "Nadie cobra en el sitio. Reintentar tampoco." },
        { label: "Envío", text: "No se inventa guía ni fecha. El envío se acuerda aparte." },
      ]}
    />
  );
}
