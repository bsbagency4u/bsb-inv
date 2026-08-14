"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { getBusinessType } from "@/config/business-types";
import { cn } from "@/lib/utils";

/**
 * Current business indicator + business switcher. The switcher is prepared for
 * multi-business tenants (Phase 2+) while only rendering a single entry now.
 */
export function BusinessSwitcher() {
  const { business, businesses, setBusiness, isDemo } = useSession();

  if (!business) {
    return (
      <Link
        href="/onboarding"
        className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Store className="size-4" />
        Set up business
      </Link>
    );
  }

  const type = getBusinessType(business.type);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="group flex h-9 max-w-[16rem] items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm shadow-sm transition-colors hover:bg-accent"
      >
        <button type="button">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
            <Store className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate font-medium text-foreground">{business.name}</span>
            <span className="block truncate text-[11px] leading-3 text-muted-foreground">
              {type.label}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Businesses</DropdownMenuLabel>
        <div className="px-2.5 pb-1">
          {isDemo ? (
            <Badge variant="warning" className="mb-1">
              Demo mode
            </Badge>
          ) : null}
        </div>
        {businesses.map((item) => {
          const active = item.id === business.id;
          return (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => setBusiness(item)}
              icon={<Store className="size-4 text-muted-foreground" />}
              className={cn(active && "bg-primary-muted/60")}
            >
              <span className="flex-1 truncate">{item.name}</span>
              {active ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => undefined}>
          <Link href="/settings/business" className="flex w-full">
            Manage businesses
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
