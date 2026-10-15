import * as React from "react";
import { ShoppingBag, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { PeriodSummary } from "@/lib/dashboard";

function SummaryColumn({
  title,
  icon,
  tone,
  summary,
  currency,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  summary: PeriodSummary;
  currency: string;
}) {
  const rows = [
    { label: "Total invoices", value: String(summary.count) },
    {
      label: "Avg. invoice value",
      value: formatCurrency(summary.average, currency),
    },
    { label: "Units sold", value: String(summary.items) },
  ];
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-md", tone)}>
          {icon}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums text-foreground">
        {formatCurrency(summary.total, currency)}
      </p>
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 text-xs">
          <dt className="text-muted-foreground">Top party</dt>
          <dd className="max-w-[55%] truncate font-medium text-foreground">
            {summary.topParty ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function PeriodSummaryCard({
  sales,
  purchases,
  rangeLabel,
  currency,
}: {
  sales: PeriodSummary;
  purchases: PeriodSummary;
  rangeLabel: string;
  currency: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sales &amp; Purchase Summary</CardTitle>
        <CardDescription>{rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SummaryColumn
          title="Sales"
          icon={<TrendingUp className="size-4" />}
          tone="bg-success-muted text-success"
          summary={sales}
          currency={currency}
        />
        <SummaryColumn
          title="Purchases"
          icon={<ShoppingBag className="size-4" />}
          tone="bg-info-muted text-info"
          summary={purchases}
          currency={currency}
        />
      </CardContent>
    </Card>
  );
}
