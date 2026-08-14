"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary. Shows a friendly message without leaking stack traces.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive-muted text-destructive">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
