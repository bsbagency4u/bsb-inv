"use client";

import { BookOpen } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import type { LedgerLine, PartyBalance } from "@/lib/party-ledger";
import { formatCurrency, formatDate } from "@/lib/utils";

const TYPE_VARIANT: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  opening: "secondary",
  sales_invoice: "info",
  purchase_invoice: "info",
  sales_return: "warning",
  purchase_return: "warning",
  receipt: "success",
  payment: "success",
  advance: "success",
  cancellation: "destructive",
};

export function PartyBalanceCards({
  balance,
  currency,
}: {
  balance: PartyBalance;
  currency: string;
}) {
  const items = [
    { label: "Opening", value: balance.opening },
    { label: "Invoiced", value: balance.invoiced },
    { label: "Returned", value: balance.returned },
    { label: "Paid", value: balance.paid },
    { label: "Advance", value: balance.advance },
    { label: "Outstanding", value: balance.outstanding },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(item.value, currency)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PartyLedgerTable({
  lines,
  currency,
}: {
  lines: LedgerLine[];
  currency: string;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-6" />}
        title="No ledger entries"
        description="Invoices, payments and returns for this party will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={`${line.sourceId}-${line.type}-${line.documentNo}`}>
              <TableCell className="text-sm text-muted-foreground">
                {line.date === "1970-01-01" ? "—" : formatDate(line.date)}
              </TableCell>
              <TableCell className="font-medium text-foreground">{line.documentNo}</TableCell>
              <TableCell>
                <Badge variant={TYPE_VARIANT[line.type] ?? "secondary"}>{line.typeLabel}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{line.paymentMethod ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {line.debit ? formatCurrency(line.debit, currency) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.credit ? formatCurrency(line.credit, currency) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCurrency(line.balance, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
