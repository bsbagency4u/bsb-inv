"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KpiCard, KpiCardSkeleton } from "@/components/dashboard/stat-card";
import { SalesPurchaseChart } from "@/components/dashboard/sales-purchase-chart";
import { PeriodSummaryCard } from "@/components/dashboard/period-summary";
import { InventoryOverviewCard, StockAlertsCard } from "@/components/dashboard/inventory-overview";
import { FinancialOverviewCard } from "@/components/dashboard/financial-overview";
import { RecentActivityCard } from "@/components/dashboard/recent-activity";
import { SetupChecklistCard } from "@/components/dashboard/setup-checklist";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { normalizeError } from "@/lib/errors";
import type { DashboardRangePreset } from "@/lib/dashboard";

const KPI_KEYS = [
  "sales_today",
  "purchases_today",
  "sales_month",
  "purchases_month",
  "stock_value",
  "receivables",
  "payables",
  "low_stock",
  "out_of_stock",
  "overdue_invoices",
];

export default function DashboardPage() {
  const { user, business, status } = useSession();
  const router = useRouter();
  const [preset, setPreset] = React.useState<DashboardRangePreset>("30d");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  React.useEffect(() => {
    if (status === "authenticated" && !business) {
      router.replace("/onboarding");
    }
  }, [status, business, router]);

  const snapshotQuery = useQuery({
    queryKey: ["dashboard-snapshot", business?.id, preset, customFrom, customTo],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().dashboard.getSnapshot(business, user?.id ?? null, {
        preset,
        customFrom: customFrom || null,
        customTo: customTo || null,
      });
    },
    enabled: Boolean(business),
    placeholderData: keepPreviousData,
  });

  if (!business) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const firstLoad = snapshotQuery.isLoading && !snapshotQuery.data;
  const hardError = snapshotQuery.isError && !snapshotQuery.data;

  return (
    <div>
      <DashboardHeader
        business={business}
        preset={preset}
        onPresetChange={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onRefresh={() => snapshotQuery.refetch()}
        refreshing={snapshotQuery.isFetching}
      />

      {firstLoad ? (
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {KPI_KEYS.map((key) => (
              <KpiCardSkeleton key={key} />
            ))}
          </div>
          <LoadingState label="Crunching your numbers…" />
        </div>
      ) : hardError ? (
        <div className="p-6">
          <ErrorState
            error={normalizeError(snapshotQuery.error).userMessage}
            onRetry={() => snapshotQuery.refetch()}
            title="Could not load dashboard"
          />
        </div>
      ) : snapshotQuery.data ? (
        <div className="space-y-6 p-6">
          {snapshotQuery.isError ? (
            <ErrorState
              error={normalizeError(snapshotQuery.error).userMessage}
              onRetry={() => snapshotQuery.refetch()}
              title="Some figures could not be refreshed"
            />
          ) : null}

          {!snapshotQuery.data.setupComplete ? (
            <SetupChecklistCard
              key={business.id}
              businessId={business.id}
              checklist={snapshotQuery.data.setup}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {snapshotQuery.data.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} currency={snapshotQuery.data!.currency} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Sales vs Purchases</CardTitle>
                <CardDescription>{snapshotQuery.data.range.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesPurchaseChart
                  points={snapshotQuery.data.series}
                  currency={snapshotQuery.data.currency}
                />
              </CardContent>
            </Card>
            <PeriodSummaryCard
              sales={snapshotQuery.data.sales}
              purchases={snapshotQuery.data.purchases}
              rangeLabel={snapshotQuery.data.range.label}
              currency={snapshotQuery.data.currency}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <InventoryOverviewCard
              inventory={snapshotQuery.data.inventory}
              currency={snapshotQuery.data.currency}
            />
            <StockAlertsCard alerts={snapshotQuery.data.inventory.alerts} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <FinancialOverviewCard
              title="Receivables"
              description="Customer balances owed to you."
              summary={snapshotQuery.data.receivables}
              currency={snapshotQuery.data.currency}
            />
            <FinancialOverviewCard
              title="Payables"
              description="Supplier balances you owe."
              summary={snapshotQuery.data.payables}
              currency={snapshotQuery.data.currency}
            />
          </div>

          <RecentActivityCard
            rows={snapshotQuery.data.activity}
            currency={snapshotQuery.data.currency}
          />

          <p className="text-xs text-muted-foreground">
            Updated {new Date(snapshotQuery.data.generatedAt).toLocaleString("en-IN")}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
