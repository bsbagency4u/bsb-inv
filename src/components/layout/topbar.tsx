"use client";

import * as React from "react";
import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { GlobalSearch } from "./global-search";
import { NotificationMenu } from "./notification-menu";
import { BusinessSwitcher } from "./business-switcher";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <BusinessSwitcher />
        <Tooltip content="Settings">
          <Link
            href="/settings"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="size-4.5" />
          </Link>
        </Tooltip>
        <NotificationMenu />
        <div className="mx-1 h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
