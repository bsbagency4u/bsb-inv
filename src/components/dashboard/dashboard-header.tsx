"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Package,
  RefreshCw,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { getBusinessType } from "@/config/business-types";
import { RANGE_PRESET_LABELS, type DashboardRangePreset } from "@/lib/dashboard";
import type { BusinessProfile } from "@/types/domain";

const PRESETS: DashboardRangePreset[] = ["today", "7d", "30d", "month", "custom"];

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Sale", href: "/sales/invoices/new", icon: ShoppingCart, primary: true },
  { label: "New Purchase", href: "/purchase/invoices/new", icon: ShoppingBag },
  { label: "Add Product", href: "/inventory/products", icon: Package },
  { label: "Receive Stock", href: "/inventory/stock", icon: Boxes },
  { label: "Customer Receipt", href: "/payments?direction=in", icon: Wallet },
  { label: "Supplier Payment", href: "/payments?direction=out", icon: Receipt },
  { label: "View Reports", href: "/reports", icon: BarChart3 },
];

export function DashboardHeader({
  business,
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onRefresh,
  refreshing,
}: {
  business: BusinessProfile;
  preset: DashboardRangePreset;
  onPresetChange: (preset: DashboardRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const router = useRouter();
  const type = getBusinessType(business.type);
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${today} · ${business.name} (${type.label})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Date range"
              className="w-[9.5rem]"
              value={preset}
              onChange={(event) => onPresetChange(event.target.value as DashboardRangePreset)}
            >
              {PRESETS.map((option) => (
                <option key={option} value={option}>
                  {RANGE_PRESET_LABELS[option]}
                </option>
              ))}
            </Select>
            {preset === "custom" ? (
              <div className="flex items-center gap-1.5">
                <DatePicker
                  value={customFrom}
                  onValueChange={onCustomFromChange}
                  className="w-[8.5rem]"
                  placeholder="From"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <DatePicker
                  value={customTo}
                  onValueChange={onCustomToChange}
                  className="w-[8.5rem]"
                  placeholder="To"
                />
              </div>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              aria-label="Refresh dashboard"
              title="Refresh"
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant={action.primary ? "primary" : "outline"}
            size="sm"
            onClick={() => router.push(action.href)}
          >
            <action.icon className="size-4" />
            {action.label}
          </Button>
        ))}
        {business.isActive ? null : (
          <Badge variant="warning" className="ml-auto">
            Inactive
          </Badge>
        )}
      </div>
    </>
  );
}
