"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Boxes, FileText } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
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
import { StockReportsCentre } from "@/components/reports/stock-reports-centre";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { defaultPeriod } from "@/reports/stock-math";
import type { ReportPeriod } from "@/types/domain";

export default function ReportsPage() {
  const { business } = useSession();
  const [tab, setTab] = React.useState("stock");
  const [period, setPeriod] = React.useState<ReportPeriod>(defaultPeriod);

  const salesQuery = useQuery({
    queryKey: ["report-sales", business?.id, period],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().reports.salesReport(business.id, period);
    },
    enabled: Boolean(business) && tab === "sales",
  });

  const gstQuery = useQuery({
    queryKey: ["report-gst", business?.id, period],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().reports.gstReport(business.id, period);
    },
    enabled: Boolean(business) && tab === "gst",
  });

  const query = tab === "sales" ? salesQuery : gstQuery;
  const currency = business?.currency ?? "INR";

  const totals = React.useMemo(() => {
    if (tab === "sales" && salesQuery.data) {
      return {
        amount: salesQuery.data.reduce((sum, row) => sum + row.total, 0),
        count: salesQuery.data.length,
      };
    }
    if (tab === "gst" && gstQuery.data) {
      return {
        amount: gstQuery.data.reduce((sum, row) => sum + row.taxAmount, 0),
        count: gstQuery.data.length,
      };
    }
    return null;
  }, [tab, salesQuery.data, gstQuery.data]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Stock, sales and GST summaries from live ledger data."
        actions={
          tab !== "stock" ? (
            <div className="flex items-end gap-2">
              <Field label="From">
                <Input
                  type="date"
                  value={period.from}
                  onChange={(event) => setPeriod((p) => ({ ...p, from: event.target.value }))}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={period.to}
                  onChange={(event) => setPeriod((p) => ({ ...p, to: event.target.value }))}
                />
              </Field>
            </div>
          ) : null
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          tabs={[
            { value: "stock", label: "Stock", icon: <Boxes className="size-4" /> },
            { value: "sales", label: "Sales", icon: <FileText className="size-4" /> },
            { value: "gst", label: "GST", icon: <BarChart3 className="size-4" /> },
          ]}
          value={tab}
          onValueChange={setTab}
        />

        {tab === "stock" && business ? (
          <StockReportsCentre businessId={business.id} currency={currency} />
        ) : null}

        {tab !== "stock" && totals ? (
          <div className="flex flex-wrap gap-3">
            <Badge variant="info" className="px-3 py-1 text-sm">
              {tab === "gst" ? "Tax" : "Total"}: {formatCurrency(totals.amount, currency)}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {totals.count} {totals.count === 1 ? "record" : "records"}
            </Badge>
          </div>
        ) : null}

        {tab !== "stock" && query.isLoading ? (
          <LoadingState label="Loading report…" />
        ) : tab !== "stock" && query.isError ? (
          <ErrorState
            error={normalizeError(query.error).userMessage}
            onRetry={() => query.refetch()}
            title="Could not load report"
          />
        ) : tab === "sales" && (!salesQuery.data || salesQuery.data.length === 0) ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="No data for this report"
            description="Record sales invoices to see them here."
          />
        ) : tab === "gst" && (!gstQuery.data || gstQuery.data.length === 0) ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="No data for this report"
            description="No GST-able invoices in the selected period."
          />
        ) : tab === "sales" ? (
          <SalesReportTable rows={salesQuery.data ?? []} currency={currency} />
        ) : tab === "gst" ? (
          <GstReportTable rows={gstQuery.data ?? []} currency={currency} />
        ) : null}
      </div>
    </div>
  );
}

function SalesReportTable({
  rows,
  currency,
}: {
  rows: Array<{
    invoiceNo: string;
    invoiceDate: string;
    customerName: string;
    total: number;
    taxTotal: number;
    status: string;
  }>;
  currency: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.invoiceNo}>
              <TableCell className="font-medium text-foreground">{row.invoiceNo}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.invoiceDate)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.customerName}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.taxTotal, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.total, currency)}</TableCell>
              <TableCell>
                <Badge variant={row.status === "cancelled" ? "destructive" : "success"}>{row.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GstReportTable({
  rows,
  currency,
}: {
  rows: Array<{
    invoiceNo: string;
    invoiceDate: string;
    taxableAmount: number;
    taxAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
  }>;
  currency: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.invoiceNo}>
              <TableCell className="font-medium text-foreground">{row.invoiceNo}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.invoiceDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.taxableAmount, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.cgst, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.sgst, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.igst, currency)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.taxAmount, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
