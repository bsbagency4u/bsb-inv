"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardSetupChecklist } from "@/lib/dashboard";

interface SetupTask {
  key: keyof DashboardSetupChecklist;
  label: string;
  href: string;
}

const TASKS: SetupTask[] = [
  { key: "businessProfile", label: "Complete your business profile", href: "/settings/business" },
  { key: "businessType", label: "Choose a business type", href: "/settings/business" },
  { key: "taxSettings", label: "Configure GST / tax settings", href: "/settings/tax" },
  { key: "warehouse", label: "Set up a warehouse", href: "/inventory/warehouses" },
  { key: "products", label: "Add your first products", href: "/inventory/products" },
  { key: "customers", label: "Add customers", href: "/customers" },
  { key: "suppliers", label: "Add suppliers", href: "/suppliers" },
  { key: "firstSale", label: "Record your first sale", href: "/sales/invoices/new" },
  { key: "firstPurchase", label: "Record your first purchase", href: "/purchase/invoices/new" },
];

export function SetupChecklistCard({
  businessId,
  checklist,
}: {
  businessId: string;
  checklist: DashboardSetupChecklist;
}) {
  const storageKey = `dashboard.setup.dismissed.${businessId}`;
  const [dismissed, setDismissed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const doneCount = TASKS.filter((task) => checklist[task.key]).length;
  const percent = Math.round((doneCount / TASKS.length) * 100);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures (private mode); dismissal is best-effort.
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Finish setting up your workspace</CardTitle>
          <CardDescription>
            {doneCount} of {TASKS.length} steps complete. Tasks mark themselves done only when the
            underlying data exists.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Hide setup checklist"
          className="shrink-0"
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {TASKS.map((task) => {
            const done = checklist[task.key];
            return (
              <Link
                key={task.key}
                href={task.href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "truncate text-sm",
                    done ? "text-muted-foreground line-through" : "font-medium text-foreground"
                  )}
                >
                  {task.label}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
