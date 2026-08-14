"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { SidebarContent, BrandMark } from "./sidebar";
import { Topbar } from "./topbar";
import { useSession } from "@/components/providers/session-provider";
import { LoadingState } from "@/components/states/loading-state";
import { cn } from "@/lib/utils";

/**
 * ERP application shell: fixed sidebar (desktop), topbar, content area and a
 * mobile drawer. Guards the app against unauthenticated access.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Link href="/dashboard" aria-label="Dashboard">
            <BrandMark />
          </Link>
        </div>
        <SidebarContent />
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-[11px] leading-4 text-muted-foreground">
            BSB StockFlow · Phase 1
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface shadow-overlay">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className={cn("flex min-w-0 flex-1 flex-col")}>
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
