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
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { DashboardOutstandingSummary } from "@/lib/dashboard";

export function FinancialOverviewCard({
  title,
  description,
  summary,
  currency,
}: {
  title: string;
  description: string;
  summary: DashboardOutstandingSummary;
  currency: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Link href="/outstanding" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border bg-surface-subtle p-3">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(summary.total, currency)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface-subtle p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 truncate text-base font-semibold tabular-nums text-destructive">
              {formatCurrency(summary.overdue, currency)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface-subtle p-3">
            <p className="text-xs text-muted-foreground">Documents</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {formatNumber(summary.count)}
            </p>
          </div>
        </div>

        {summary.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing outstanding right now.
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.map((row) => (
                  <TableRow key={`${row.partyId}-${row.documentNo}`}>
                    <TableCell className="max-w-[160px] truncate font-medium text-foreground">
                      <Link href={row.href} className="hover:text-primary hover:underline">
                        {row.partyName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.documentNo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.dueDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatCurrency(row.balance, currency)}
                    </TableCell>
                    <TableCell>
                      {row.daysOverdue > 0 ? (
                        <Badge variant="destructive">{row.daysOverdue}d overdue</Badge>
                      ) : (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
