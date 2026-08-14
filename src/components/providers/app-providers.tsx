"use client";

import * as React from "react";
import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { ToastProvider } from "@/components/ui/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>
        <SessionProvider>{children}</SessionProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
