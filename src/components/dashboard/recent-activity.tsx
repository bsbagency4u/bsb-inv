"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DashboardActivityRow } from "@/lib/dashboard";

const STATUS_VARIANTS: Record<
  string,
  "success" | "info" | "warning" | "destructive" | "secondary"
> = {
  paid: "success",
  posted: "info",
  completed: "info",
  partial: "warning",
  unpaid: "warning",
  draft: "secondary",
  returned: "secondary",
  cancelled: "destructive",
};

const TYPE_STYLES: Record<DashboardActivityRow["type"], string> = {
  sale: "text-primary",
  purchase: "text-destructive",
  sales_return: "text-warning",
  purchase_return: "text-warning",
  receipt: "text-success",
  payment: "text-info",
};

export function RecentActivityCard({
  rows,
  currency,
}: {
  rows: DashboardActivityRow[];
  currency: string;
}) {
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest activity in the selected period.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No transactions in this period yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.type}-${row.id}`}
                  className={row.href ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (row.href) router.push(row.href);
                  }}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(row.date)}
                  </TableCell>
                  <TableCell className={`font-medium ${TYPE_STYLES[row.type]}`}>
                    {row.typeLabel}
                  </TableCell>
                  <TableCell>
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.documentNo}
                      </Link>
                    ) : (
                      <span className="text-foreground">{row.documentNo}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-muted-foreground">
                    {row.partyName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {formatCurrency(row.amount, currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.status] ?? "secondary"}>
                      {row.status}
                    </Badge>
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
