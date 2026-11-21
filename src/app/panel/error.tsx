"use client";

import { FailureScreen } from "@/components/failure-screen";

export default function PanelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <FailureScreen scope="panel" digest={error.digest} onRetry={retry} />;
}
