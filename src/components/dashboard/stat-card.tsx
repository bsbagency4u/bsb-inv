import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  FileWarning,
  Minus,
  PackageX,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardKpi, DashboardTone } from "@/lib/dashboard";

const KPI_ICONS: Record<string, React.ReactNode> = {
  sales_today: <TrendingUp className="size-5" />,
  purchases_today: <ShoppingBag className="size-5" />,
  sales_month: <BarChart3 className="size-5" />,
  purchases_month: <Receipt className="size-5" />,
  stock_value: <Boxes className="size-5" />,
  receivables: <Users className="size-5" />,
  payables: <Wallet className="size-5" />,
  low_stock: <AlertTriangle className="size-5" />,
  out_of_stock: <PackageX className="size-5" />,
  overdue_invoices: <FileWarning className="size-5" />,
};

const TONE_STYLES: Record<DashboardTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  info: "bg-info-muted text-info",
};

function ComparisonLine({ kpi }: { kpi: DashboardKpi }) {
  if (kpi.comparison) {
    const { direction, percent, label } = kpi.comparison;
    const icon =
      direction === "up" ? (
        <TrendingUp className="size-3.5" />
      ) : direction === "down" ? (
        <TrendingDown className="size-3.5" />
      ) : (
        <Minus className="size-3.5" />
      );
    const tone =
      direction === "up"
        ? "text-success"
        : direction === "down"
          ? "text-destructive"
          : "text-muted-foreground";
    return (
      <p className={cn("mt-1 flex items-center gap-1 text-xs", tone)}>
        {icon}
        <span className="font-medium tabular-nums">{percent}%</span>
        <span className="text-muted-foreground">{label}</span>
      </p>
    );
  }
  if (kpi.hint) {
    return <p className="mt-1 truncate text-xs text-muted-foreground">{kpi.hint}</p>;
  }
  return null;
}

export function KpiCard({ kpi, currency }: { kpi: DashboardKpi; currency: string }) {
  const value =
    kpi.format === "currency" ? formatCurrency(kpi.value, currency) : formatNumber(kpi.value);
  return (
    <Link
      href={kpi.href}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`${kpi.label}: ${value}`}
    >
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:shadow-popover">
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              TONE_STYLES[kpi.tone]
            )}
          >
            {KPI_ICONS[kpi.key] ?? <BarChart3 className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-foreground">
              {value}
            </p>
            <ComparisonLine kpi={kpi} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
