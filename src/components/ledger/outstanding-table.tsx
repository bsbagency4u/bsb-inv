"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_AGING_BUCKETS, type OutstandingRow } from "@/lib/party-ledger";
import { formatCurrency, formatDate } from "@/lib/utils";

export function AgingSummary({
  totals,
  currency,
}: {
  totals: Record<string, number>;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DEFAULT_AGING_BUCKETS.map((bucket) => (
        <Card key={bucket.key}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{bucket.label} days</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(totals[bucket.key] ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OutstandingTable({
  rows,
  currency,
  emptyTitle = "No outstanding invoices",
  emptyDescription = "Paid, cancelled and draft invoices are hidden.",
  onPay,
}: {
  rows: OutstandingRow[];
  currency: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onPay?: (row: OutstandingRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Aging</TableHead>
            {onPay ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.invoiceId}>
              <TableCell className="font-medium text-foreground">{row.invoiceNo}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.partyName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.invoiceDate)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.dueDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.total, currency)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatCurrency(row.paid + row.adjustments, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCurrency(row.balance, currency)}
              </TableCell>
              <TableCell>
                <Badge variant={row.daysOverdue > 90 ? "destructive" : row.daysOverdue > 30 ? "warning" : "secondary"}>
                  {row.agingBucket}
                  {row.daysOverdue > 0 ? ` · ${row.daysOverdue}d` : ""}
                </Badge>
              </TableCell>
              {onPay ? (
                <TableCell className="text-right">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => onPay(row)}
                  >
                    Pay
                  </button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
