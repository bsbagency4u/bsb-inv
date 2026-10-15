import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  DashboardInventoryOverview,
  DashboardStockAlert,
} from "@/lib/dashboard";

const SEGMENTS = [
  { key: "inStock", label: "In stock", color: "#16a34a" },
  { key: "lowStock", label: "Low stock", color: "#d97706" },
  { key: "outOfStock", label: "Out of stock", color: "#dc2626" },
  { key: "negative", label: "Negative stock", color: "#7c3aed" },
] as const;

const STATUS_VARIANTS: Record<DashboardStockAlert["status"], "warning" | "destructive"> = {
  low: "warning",
  out: "destructive",
  negative: "destructive",
};

const STATUS_LABELS: Record<DashboardStockAlert["status"], string> = {
  low: "Low stock",
  out: "Out of stock",
  negative: "Negative",
};

export function InventoryOverviewCard({
  inventory,
  currency,
}: {
  inventory: DashboardInventoryOverview;
  currency: string;
}) {
  const outNonNegative = Math.max(0, inventory.outOfStock - inventory.negative);
  const counts: Record<(typeof SEGMENTS)[number]["key"], number> = {
    inStock: inventory.inStock,
    lowStock: inventory.lowStock,
    outOfStock: outNonNegative,
    negative: inventory.negative,
  };
  const total = SEGMENTS.reduce((sum, segment) => sum + counts[segment.key], 0);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Inventory Overview</CardTitle>
          <CardDescription>Current stock health across tracked products.</CardDescription>
        </div>
        <Link href="/inventory/stock" className="text-xs font-medium text-primary hover:underline">
          View inventory
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
        <div className="relative size-40 shrink-0">
          <svg viewBox="0 0 140 140" className="size-40 -rotate-90">
            <circle
              cx={70}
              cy={70}
              r={radius}
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth={16}
            />
            {total > 0
              ? SEGMENTS.map((segment) => {
                  const value = counts[segment.key];
                  if (value <= 0) return null;
                  const length = (value / total) * circumference;
                  const dash = `${length} ${circumference - length}`;
                  const element = (
                    <circle
                      key={segment.key}
                      cx={70}
                      cy={70}
                      r={radius}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={16}
                      strokeDasharray={dash}
                      strokeDashoffset={-offset}
                      strokeLinecap="butt"
                    >
                      <title>{`${segment.label}: ${value}`}</title>
                    </circle>
                  );
                  offset += length;
                  return element;
                })
              : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {formatNumber(inventory.trackedProducts)}
            </span>
            <span className="text-xs text-muted-foreground">Tracked products</span>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-2">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="flex-1 text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(counts[segment.key])}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-border pt-2 text-sm">
            <span className="flex-1 text-muted-foreground">Inactive</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatNumber(inventory.inactive)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-muted-foreground">Total stock value</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCurrency(inventory.totalStockValue, currency)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StockAlertsCard({ alerts }: { alerts: DashboardStockAlert[] }) {
  const visible = alerts.slice(0, 6);
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Stock Alerts</CardTitle>
          <CardDescription>Products at or below their reorder threshold.</CardDescription>
        </div>
        <Link href="/inventory/stock" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No low or out-of-stock items. Stock levels look healthy.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Min. qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warehouse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((alert) => (
                <TableRow key={alert.productId}>
                  <TableCell className="max-w-[180px] truncate font-medium text-foreground">
                    {alert.productName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{alert.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {alert.threshold}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[alert.status]}>
                      {STATUS_LABELS[alert.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {alert.warehouseName ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
