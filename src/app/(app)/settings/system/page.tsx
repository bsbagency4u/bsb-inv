"use client";

import * as React from "react";
import { Database, Server, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { isSupabaseConfigured, hasServiceRoleKey } from "@/lib/supabase/env";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE } from "@/config/site";
import { formatDateTime } from "@/lib/utils";

export default function SystemSettingsPage() {
  const { isDemo, user } = useSession();

  const rows = [
    { label: "Product", value: SITE.name },
    { label: "Tagline", value: SITE.tagline },
    { label: "Phase", value: "3 — Transaction engine" },
    { label: "Environment", value: isDemo ? "Demo (local)" : "Supabase connected" },
    { label: "Database", value: isSupabaseConfigured() ? "Supabase PostgreSQL" : "Local storage (demo)" },
    { label: "Service-role key", value: hasServiceRoleKey() ? "Configured (server-only)" : "Not configured" },
    { label: "Signed in as", value: user?.email ?? "—" },
    { label: "Checked at", value: formatDateTime(new Date()) },
  ];

  return (
    <div>
      <PageHeader
        title="System"
        description="Platform information and configuration status."
      />
      <div className="max-w-3xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4" />
              Platform status
            </CardTitle>
            <CardDescription>Read-only environment summary.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {row.label === "Environment" ? (
                      <Badge variant={isDemo ? "warning" : "success"}>{row.value}</Badge>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" />
              Database foundation
            </CardTitle>
            <CardDescription>Core tables from the Phase 1–3 migrations.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-1.5 text-sm text-foreground sm:grid-cols-2">
              {["businesses", "business_members", "business_settings", "profiles", "roles", "permissions", "role_permissions", "audit_logs"].map(
                (table) => (
                  <li key={table} className="flex items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 font-mono text-xs">
                    {table}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Security
            </CardTitle>
            <CardDescription>How data is protected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Row Level Security is enabled on every business-scoped table.</p>
            <p>Business data is isolated by membership and ownership checks.</p>
            <p>The Supabase service-role key is server-only and never shipped to the browser.</p>
            <p>No universal anonymous write policies exist.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
