import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NormalizedError } from "@/lib/errors";

export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  className,
}: {
  error?: NormalizedError | string | null;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const message =
    typeof error === "string" ? error : error?.userMessage ?? error?.message ?? null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-16 text-center",
        className
      )}
    >
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-destructive-muted text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {message ? (
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      ) : null}
      {onRetry ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
