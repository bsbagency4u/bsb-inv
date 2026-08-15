"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { normalizeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";

export default function AuditLogPage() {
  const { business } = useSession();

  const { data: logs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit-logs", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().audits.listForBusiness(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading audit log…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load audit log"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="A record of key actions taken in this business."
      />

      <div className="space-y-4 p-6">
        {!logs || logs.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" />}
            title="No activity yet"
            description="Actions like creating products, invoices and stock adjustments are recorded here."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entityType ?? "—"}
                      {log.entityId ? (
                        <span className="block font-mono text-xs">{log.entityId}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
