"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Boxes, Download, FileText, Landmark, Wallet } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { StockReportsCentre } from "@/components/reports/stock-reports-centre";
import { FinanceCentre } from "@/components/reports/finance-centre";
import { AgingSummary, OutstandingTable } from "@/components/ledger/outstanding-table";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { defaultPeriod } from "@/reports/stock-math";
import { agingTotals, roundMoney } from "@/lib/party-ledger";
import { GST_DOCUMENT_TYPE_LABELS } from "@/lib/gst";
import type { GstReportRow, ReportPeriod } from "@/types/domain";

export default function ReportsPage() {
  const { business, user } = useSession();
  const [tab, setTab] = React.useState("stock");
  const [period, setPeriod] = React.useState<ReportPeriod>(defaultPeriod);

  const outstandingKind = tab === "payables" ? "payables" : "receivables";

  const outstandingQuery = useQuery({
    queryKey: ["report-outstanding", outstandingKind, business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return outstandingKind === "receivables"
        ? getClientServices().reports.receivables(business.id)
        : getClientServices().reports.payables(business.id);
    },
    enabled: Boolean(business) && (tab === "receivables" || tab === "payables"),
  });

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

  const query = tab === "sales" ? salesQuery : tab === "gst" ? gstQuery : outstandingQuery;
  const currency = business?.currency ?? "INR";
  const outstandingRows = outstandingQuery.data ?? [];
  const outstandingAging = agingTotals(outstandingRows);

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
        taxable: gstQuery.data.reduce((sum, row) => sum + row.taxableAmount, 0),
        count: gstQuery.data.length,
      };
    }
    if ((tab === "receivables" || tab === "payables") && outstandingQuery.data) {
      return {
        amount: roundMoney(outstandingQuery.data.reduce((sum, row) => sum + row.balance, 0)),
        count: outstandingQuery.data.length,
      };
    }
    return null;
  }, [tab, salesQuery.data, gstQuery.data, outstandingQuery.data]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Stock, sales, GST, outstanding and finance summaries from live ledger data."
        actions={
          tab === "sales" || tab === "gst" || tab === "finance" ? (
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
            { value: "finance", label: "Finance", icon: <Landmark className="size-4" /> },
            { value: "sales", label: "Sales", icon: <FileText className="size-4" /> },
            { value: "gst", label: "GST", icon: <BarChart3 className="size-4" /> },
            { value: "receivables", label: "Receivables", icon: <Wallet className="size-4" /> },
            { value: "payables", label: "Payables", icon: <Wallet className="size-4" /> },
          ]}
          value={tab}
          onValueChange={setTab}
        />

        {tab === "stock" && business ? (
          <StockReportsCentre businessId={business.id} currency={currency} />
        ) : null}

        {tab === "finance" && business ? (
          <FinanceCentre
            businessId={business.id}
            currency={currency}
            period={period}
            userId={user?.id ?? null}
          />
        ) : null}

        {tab !== "stock" && tab !== "finance" && totals ? (
          <div className="flex flex-wrap gap-3">
            <Badge variant="info" className="px-3 py-1 text-sm">
              {tab === "gst" ? "Tax" : tab === "receivables" || tab === "payables" ? "Outstanding" : "Total"}: {formatCurrency(totals.amount, currency)}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {totals.count} {totals.count === 1 ? "record" : "records"}
            </Badge>
            {tab === "gst" && "taxable" in totals && totals.taxable != null ? (
              <Badge variant="outline" className="px-3 py-1 text-sm">
                Taxable: {formatCurrency(totals.taxable, currency)}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {tab !== "stock" && tab !== "finance" && query.isLoading ? (
          <LoadingState label="Loading report…" />
        ) : tab !== "stock" && tab !== "finance" && query.isError ? (
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
          <GstReportTable rows={gstQuery.data ?? []} currency={currency} period={period} />
        ) : tab === "receivables" || tab === "payables" ? (
          <div className="space-y-4">
            <AgingSummary totals={outstandingAging} currency={currency} />
            <OutstandingTable
              rows={outstandingRows}
              currency={currency}
              emptyTitle={tab === "receivables" ? "No receivables" : "No payables"}
              emptyDescription="Open invoices from the shared ledger appear here."
            />
          </div>
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
  period,
}: {
  rows: GstReportRow[];
  currency: string;
  period: ReportPeriod;
}) {
  const summary = React.useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => ({
        taxable: acc.taxable + row.taxableAmount,
        cgst: acc.cgst + row.cgst,
        sgst: acc.sgst + row.sgst,
        igst: acc.igst + row.igst,
        tax: acc.tax + row.taxAmount,
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
    );
    const documents = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.documentType] = (acc[row.documentType] ?? 0) + 1;
      return acc;
    }, {});
    return { totals, documents };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile label="Taxable value" value={formatCurrency(summary.totals.taxable, currency)} />
        <SummaryTile label="CGST" value={formatCurrency(summary.totals.cgst, currency)} />
        <SummaryTile label="SGST" value={formatCurrency(summary.totals.sgst, currency)} />
        <SummaryTile label="IGST" value={formatCurrency(summary.totals.igst, currency)} />
        <SummaryTile label="Total tax" value={formatCurrency(summary.totals.tax, currency)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.documents).map(([type, count]) => (
            <Badge key={type} variant="secondary">
              {GST_DOCUMENT_TYPE_LABELS[type as keyof typeof GST_DOCUMENT_TYPE_LABELS] ?? type}: {count}
            </Badge>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadGstCsv(rows, period)}
          disabled={rows.length === 0}
        >
          <Download className="size-4" />
          Export GST CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Place of supply</TableHead>
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
                <TableCell className="font-medium text-foreground">
                  {row.invoiceNo}
                  {row.reverseCharge ? (
                    <Badge variant="warning" className="ml-2">
                      RCM
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(row.invoiceDate)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.customerName}
                  {row.customerGstin ? (
                    <span className="block text-xs">{row.customerGstin}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {GST_DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.placeOfSupplyState ?? "—"}
                </TableCell>
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

      <p className="text-xs text-muted-foreground">
        Figures use the GST treatment stored on each invoice. The CSV is an export aid, not a filing-ready
        return; reconcile with your GST portal before filing.
      </p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadGstCsv(rows: GstReportRow[], period: ReportPeriod) {
  const header = [
    "GSTIN/UIN",
    "Receiver name",
    "Document type",
    "Invoice number",
    "Invoice date",
    "Invoice value",
    "Place of supply",
    "Reverse charge",
    "Taxable value",
    "CGST",
    "SGST",
    "IGST",
    "Total tax",
  ];
  const lines = rows.map((row) =>
    [
      row.customerGstin ?? "",
      row.customerName,
      GST_DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType,
      row.invoiceNo,
      row.invoiceDate,
      row.taxableAmount + row.taxAmount,
      row.placeOfSupplyState ?? "",
      row.reverseCharge ? "Y" : "N",
      row.taxableAmount,
      row.cgst,
      row.sgst,
      row.igst,
      row.taxAmount,
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [header.map(csvCell).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gst-export-${period.from}-to-${period.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
