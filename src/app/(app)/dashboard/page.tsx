"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, LayoutDashboard, Store } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, buildStatsCards, DemoDataBadge } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { normalizeError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { getBusinessType } from "@/config/business-types";

export default function DashboardPage() {
  const { business, isDemo } = useSession();

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().dashboard.getStats(business);
    },
    enabled: Boolean(business),
  });

  if (statsQuery.isLoading) {
    return <LoadingState label="Loading dashboard…" />;
  }

  if (statsQuery.isError) {
    return (
      <ErrorState
        error={normalizeError(statsQuery.error).userMessage}
        onRetry={() => statsQuery.refetch()}
        title="Could not load dashboard"
      />
    );
  }

  const stats = statsQuery.data;

  if (!business || !stats) {
    return (
      <div className="p-6">
        <Alert variant="warning" title="Business not set up yet">
          <p>
            Set up your business profile to unlock the dashboard.
          </p>
        </Alert>
      </div>
    );
  }

  const type = getBusinessType(business.type);
  const cards = buildStatsCards(stats);
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const setupSteps = [
    { label: "Business profile", done: Boolean(business.name), href: "/settings/business", icon: Store },
    { label: "Business type configured", done: Boolean(business.type), href: "/settings/business", icon: Store },
    { label: "Products added", done: false, href: "/inventory/products", icon: Store },
    { label: "Customers added", done: false, href: "/customers", icon: Store },
    { label: "Dashboard ready", done: true, href: "/dashboard", icon: LayoutDashboard },
  ];

  const nextSteps = [
    { name: "Add products & stock", phase: "Inventory", href: "/inventory/products" },
    { name: "Record your first sale", phase: "Sales", href: "/sales/invoices" },
    { name: "Track a purchase", phase: "Purchase", href: "/purchase/invoices" },
    { name: "Review reports", phase: "Insights", href: "/reports" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${today} · ${business.name} (${type.label})`}
        actions={
          <div className="flex items-center gap-2">
            {isDemo || stats.isDemo ? <DemoDataBadge /> : null}
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Setup checklist</CardTitle>
              <CardDescription>Get your workspace ready to sell.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {setupSteps.map((step) => (
                <a
                  key={step.label}
                  href={step.href}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                >
                  {step.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={
                      step.done ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="ml-auto">
                    <Badge variant={step.done ? "success" : "secondary"}>
                      {step.done ? "Done" : "Next"}
                    </Badge>
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get started</CardTitle>
              <CardDescription>
                Jump into the modules that matter for your business.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {nextSteps.map((step) => (
                <a
                  key={step.name}
                  href={step.href}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-medium text-foreground">{step.name}</span>
                  <Badge variant="secondary">{step.phase}</Badge>
                </a>
              ))}
              <p className="px-2 pt-2 text-xs text-muted-foreground">
                Last updated {formatDate(stats.updatedAt)}.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
