"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: string | null;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}

/**
 * Phase 1 ships a simple, dependency-free date input. Later phases may replace
 * this with a full calendar popover while keeping the same props contract.
 */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Select date…",
  className,
  invalid,
}: DatePickerProps) {
  return (
    <div className={cn("relative", className)}>
      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onValueChange?.(event.target.value)}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1.5 pr-9 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          !value && "text-muted-foreground",
          invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
        )}
        placeholder={placeholder}
      />
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
