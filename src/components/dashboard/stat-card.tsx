import * as React from "react";
import { TrendingUp, ShoppingBag, Boxes, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const ICON_TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  info: "bg-info-muted text-info",
};

export function StatCard({ label, value, hint, icon, tone = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            ICON_TONES[tone]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function buildStatsCards(stats: {
  todaySales: number;
  todayPurchase: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  outstanding: number;
  currency: string;
}) {
  return [
    {
      label: "Today's Sales",
      value: formatCurrency(stats.todaySales, stats.currency),
      icon: <TrendingUp className="size-5" />,
      tone: "success" as const,
    },
    {
      label: "Today's Purchase",
      value: formatCurrency(stats.todayPurchase, stats.currency),
      icon: <ShoppingBag className="size-5" />,
      tone: "info" as const,
    },
    {
      label: "Stock Value",
      value: formatCurrency(stats.stockValue, stats.currency),
      icon: <Boxes className="size-5" />,
      tone: "default" as const,
    },
    {
      label: "Low Stock Items",
      value: String(stats.lowStockCount),
      icon: <AlertTriangle className="size-5" />,
      tone: "warning" as const,
    },
    {
      label: "Out of Stock",
      value: String(stats.outOfStockCount),
      icon: <PackageX className="size-5" />,
      tone: "destructive" as const,
    },
    {
      label: "Outstanding (Receivables)",
      value: formatCurrency(stats.outstanding, stats.currency),
      icon: <Wallet className="size-5" />,
      tone: "default" as const,
    },
  ];
}

export function DemoDataBadge() {
  return (
    <Badge variant="warning" className="shrink-0">
      Placeholder data
    </Badge>
  );
}
