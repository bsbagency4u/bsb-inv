"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { getClientServices } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { GST_DOCUMENT_TYPE_LABELS, GST_REGISTRATION_TYPE_LABELS } from "@/lib/gst";
import { gstDocumentLabel } from "@/lib/gst-recon";
import {
  GST_REPORT_CATEGORIES,
  GST_REPORT_DEFINITIONS,
  defaultGstReportId,
  gstDocumentTypes,
  gstReportVisible,
  hsnTotals,
  rateWiseTotals,
  type GstReportId,
} from "@/lib/gst-reports";
import { fyContaining, fyOptions, taxPeriodPresets } from "@/lib/gst-period";
import { downloadCsv, printReport } from "@/reports/export";
import type { GstReportsSnapshot } from "@/services/report.service";
import type { GstRegistrationType, ReportPeriod } from "@/types/domain";

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadRows(filename: string, header: string[], rows: Array<Array<string | number | boolean | null>>) {
  const csv = [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
  downloadCsv(filename, csv);
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function BooksTable({
  rows,
  currency,
  empty,
  showItc = false,
}: {
  rows: GstReportsSnapshot["sales"];
  currency: string;
  empty: string;
  showItc?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileSpreadsheet className="size-6" />}
        title={empty}
        description="Figures use GST snapshots stored on each document."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            {showItc ? <TableHead>ITC</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.documentNo}
                {row.reverseCharge ? (
                  <Badge variant="warning" className="ml-2">
                    RCM
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.documentDate)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.partyName}
                {row.gstin ? <span className="block text-xs">{row.gstin}</span> : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{gstDocumentLabel(row.documentType)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.taxableAmount, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.cgst, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.sgst, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.igst, currency)}</TableCell>
              {showItc ? (
                <TableCell>
                  <Badge variant={row.itcEligible ? "success" : "outline"}>{row.itcEligible ? "Yes" : "No"}</Badge>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function booksCsvRows(rows: GstReportsSnapshot["sales"]) {
  return rows.map((row) => [
    row.gstin,
    row.partyName,
    gstDocumentLabel(row.documentType),
    row.documentNo,
    row.documentDate,
    row.invoiceValue,
    row.placeOfSupplyState,
    row.reverseCharge ? "Y" : "N",
    row.taxableAmount,
    row.cgst,
    row.sgst,
    row.igst,
    row.taxAmount,
  ]);
}

const BOOKS_CSV_HEADER = [
  "GSTIN/UIN",
  "Party name",
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

export function GstReportsCentre({
  businessId,
  currency,
  financialYear,
  registrationType,
}: {
  businessId: string;
  currency: string;
  financialYear: string;
  registrationType: GstRegistrationType;
}) {
  const years = React.useMemo(() => fyOptions(new Date(), financialYear), [financialYear]);
  const [fyLabel, setFyLabel] = React.useState(years[0]?.label ?? "");
  const fy = years.find((item) => item.label === fyLabel) ?? years[0] ?? fyContaining(new Date().toISOString().slice(0, 10), financialYear);
  const presets = React.useMemo(() => taxPeriodPresets(fy), [fy]);
  const [presetId, setPresetId] = React.useState("fy");
  const preset = presets.find((item) => item.id === presetId) ?? presets[0];
  const [custom, setCustom] = React.useState<ReportPeriod>({ from: fy.from, to: fy.to });
  const period: ReportPeriod =
    presetId === "custom" ? custom : { from: preset?.from ?? fy.from, to: preset?.to ?? fy.to };
  const [reportId, setReportId] = React.useState<GstReportId>("sales-register");

  const query = useQuery({
    queryKey: ["gst-reports", businessId, period],
    queryFn: () => getClientServices().reports.gstReportsSnapshot(businessId, period),
  });

  const snapshot = query.data;
  const visibleReports = React.useMemo(() => {
    if (!snapshot) return GST_REPORT_DEFINITIONS.filter((item) => !item.requires);
    return GST_REPORT_DEFINITIONS.filter((item) => gstReportVisible(item, snapshot.filing));
  }, [snapshot]);

  const activeReportId = visibleReports.some((item) => item.id === reportId)
    ? reportId
    : snapshot
      ? defaultGstReportId(snapshot.filing)
      : "sales-register";
  const definition = visibleReports.find((item) => item.id === activeReportId) ?? visibleReports[0];

  function exportCurrent() {
    if (!snapshot || !definition) return;
    const stamp = `${period.from}-to-${period.to}`;
    if (definition.id === "hsn-summary") {
      downloadRows(`hsn-summary-${stamp}.csv`, ["HSN", "Rate", "Qty", "Documents", "Taxable", "CGST", "SGST", "IGST", "Tax"], snapshot.hsn.map((row) => [row.hsn, row.rate, row.quantity, row.documentCount, row.taxableAmount, row.cgst, row.sgst, row.igst, row.taxAmount]));
      return;
    }
    if (definition.id === "rate-wise") {
      downloadRows(`rate-wise-${stamp}.csv`, ["Rate", "Documents", "Taxable", "CGST", "SGST", "IGST", "Tax"], snapshot.rateWise.map((row) => [row.rate, row.documentCount, row.taxableAmount, row.cgst, row.sgst, row.igst, row.taxAmount]));
      return;
    }
    if (definition.id === "gstr-3b") {
      downloadRows(`gstr-3b-prep-${stamp}.csv`, ["Section", "Taxable", "CGST", "SGST", "IGST", "Tax"], snapshot.gstr3b.rows.map((row) => [row.label, row.taxableAmount, row.cgst, row.sgst, row.igst, row.taxAmount]));
      return;
    }
    if (definition.id === "gstr-4") {
      downloadRows(`gstr-4-prep-${stamp}.csv`, ["Metric", "Value"], [
        ["Outward turnover", snapshot.gstr4.outwardTurnover],
        ["Tax collected on invoices", snapshot.gstr4.taxCollected],
        ["Purchase turnover", snapshot.gstr4.purchaseTurnover],
        ["Sales documents", snapshot.gstr4.documentCount],
        ["Purchase documents", snapshot.gstr4.purchaseCount],
      ]);
      return;
    }
    const rows =
      definition.id === "purchase-itc"
        ? snapshot.purchases
        : definition.id === "b2b-b2c"
          ? [...snapshot.b2b, ...snapshot.b2c]
          : definition.id === "credit-debit-notes"
            ? [...snapshot.creditNotes, ...snapshot.debitNotes]
            : snapshot.sales;
    downloadRows(`${definition.id}-${stamp}.csv`, BOOKS_CSV_HEADER, booksCsvRows(rows));
  }

  function printCurrent() {
    if (!snapshot || !definition) return;
    if (definition.id === "gstr-3b") {
      printReport(
        definition.title,
        [
          { key: "label", label: "Section", type: "text" },
          { key: "taxableAmount", label: "Taxable", type: "currency" },
          { key: "taxAmount", label: "Tax", type: "currency" },
        ],
        snapshot.gstr3b.rows.map((row) => ({ label: row.label, taxableAmount: row.taxableAmount, taxAmount: row.taxAmount }))
      );
      return;
    }
    if (definition.id === "hsn-summary") {
      printReport(
        definition.title,
        [
          { key: "hsn", label: "HSN", type: "text" },
          { key: "rate", label: "Rate", type: "number" },
          { key: "quantity", label: "Qty", type: "qty" },
          { key: "taxableAmount", label: "Taxable", type: "currency" },
          { key: "taxAmount", label: "Tax", type: "currency" },
        ],
        snapshot.hsn.map((row) => ({
          hsn: row.hsn,
          rate: row.rate,
          quantity: row.quantity,
          taxableAmount: row.taxableAmount,
          taxAmount: row.taxAmount,
        }))
      );
      return;
    }
    if (definition.id === "rate-wise") {
      printReport(
        definition.title,
        [
          { key: "rate", label: "Rate", type: "number" },
          { key: "documentCount", label: "Documents", type: "number" },
          { key: "taxableAmount", label: "Taxable", type: "currency" },
          { key: "taxAmount", label: "Tax", type: "currency" },
        ],
        snapshot.rateWise.map((row) => ({
          rate: row.rate,
          documentCount: row.documentCount,
          taxableAmount: row.taxableAmount,
          taxAmount: row.taxAmount,
        }))
      );
      return;
    }
    const rows =
      definition.id === "purchase-itc"
        ? snapshot.purchases
        : definition.id === "credit-debit-notes"
          ? [...snapshot.creditNotes, ...snapshot.debitNotes]
          : definition.id === "b2b-b2c"
            ? [...snapshot.b2b, ...snapshot.b2c]
            : snapshot.sales;
    printReport(
      definition.title,
      [
        { key: "documentNo", label: "Document", type: "text" },
        { key: "documentDate", label: "Date", type: "date" },
        { key: "partyName", label: "Party", type: "text" },
        { key: "taxableAmount", label: "Taxable", type: "currency" },
        { key: "taxAmount", label: "Tax", type: "currency" },
      ],
      rows.map((row) => ({
        documentNo: row.documentNo,
        documentDate: row.documentDate,
        partyName: row.partyName,
        taxableAmount: row.taxableAmount,
        taxAmount: row.taxAmount,
      }))
    );
  }

  if (query.isLoading) return <LoadingState label="Loading GST reports…" />;
  if (query.isError) {
    return (
      <ErrorState
        error={normalizeError(query.error).userMessage}
        onRetry={() => query.refetch()}
        title="Could not load GST reports"
      />
    );
  }
  if (!snapshot || !definition) return null;

  const documents = gstDocumentTypes(snapshot.sales);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-surface p-3">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">GST reports</p>
        <div className="space-y-3">
          {GST_REPORT_CATEGORIES.map((category) => {
            const reports = visibleReports.filter((item) => item.category === category.id);
            if (reports.length === 0) return null;
            return (
              <div key={category.id}>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{category.label}</p>
                <div className="space-y-0.5">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setReportId(report.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        activeReportId === report.id
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {report.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">{definition.title}</h2>
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Financial year">
              <Select
                value={fy.label}
                onChange={(event) => {
                  const next = years.find((item) => item.label === event.target.value);
                  setFyLabel(event.target.value);
                  setPresetId("fy");
                  if (next) setCustom({ from: next.from, to: next.to });
                }}
              >
                {years.map((item) => (
                  <option key={item.label} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tax period">
              <Select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {presets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Registration">
              <Input value={GST_REGISTRATION_TYPE_LABELS[registrationType]} readOnly />
            </Field>
            {presetId === "custom" ? (
              <>
                <Field label="From">
                  <Input type="date" value={custom.from} onChange={(event) => setCustom((p) => ({ ...p, from: event.target.value }))} />
                </Field>
                <Field label="To">
                  <Input type="date" value={custom.to} onChange={(event) => setCustom((p) => ({ ...p, to: event.target.value }))} />
                </Field>
              </>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{GST_REGISTRATION_TYPE_LABELS[snapshot.registrationType]}</Badge>
            <Badge variant={snapshot.filing.gstr1Allowed ? "success" : "outline"}>
              GSTR-1 {snapshot.filing.gstr1Allowed ? "prep" : "n/a"}
            </Badge>
            <Badge variant={snapshot.filing.gstr3bAllowed ? "info" : "outline"}>
              GSTR-3B {snapshot.filing.gstr3bAllowed ? "prep" : "n/a"}
            </Badge>
            <Badge variant={snapshot.filing.gstr4Allowed ? "info" : "outline"}>
              GSTR-4 {snapshot.filing.gstr4Allowed ? "books" : "n/a"}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCurrent}>
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printCurrent}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{snapshot.filing.reason}</p>

        {activeReportId === "sales-register" || activeReportId === "gstr-1" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile label="Taxable" value={formatCurrency(snapshot.salesTotals.taxable, currency)} />
              <Tile label="CGST" value={formatCurrency(snapshot.salesTotals.cgst, currency)} />
              <Tile label="SGST" value={formatCurrency(snapshot.salesTotals.sgst, currency)} />
              <Tile label="IGST" value={formatCurrency(snapshot.salesTotals.igst, currency)} />
              <Tile label="Documents" value={String(snapshot.salesTotals.count)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(documents).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {GST_DOCUMENT_TYPE_LABELS[type as keyof typeof GST_DOCUMENT_TYPE_LABELS] ?? type}: {count}
                </Badge>
              ))}
            </div>
            <BooksTable rows={snapshot.sales} currency={currency} empty="No posted sales in this period." />
          </div>
        ) : null}

        {activeReportId === "purchase-itc" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Taxable" value={formatCurrency(snapshot.purchaseTotals.taxable, currency)} />
              <Tile label="Tax" value={formatCurrency(snapshot.purchaseTotals.tax, currency)} />
              <Tile
                label="ITC in books"
                value={snapshot.filing.itcAllowed ? formatCurrency(snapshot.purchaseTotals.itc, currency) : "Not claimed"}
              />
              <Tile label="RCM tax" value={formatCurrency(snapshot.purchaseTotals.rcm, currency)} />
            </div>
            <BooksTable rows={snapshot.purchases} currency={currency} empty="No posted purchase bills in this period." showItc />
          </div>
        ) : null}

        {activeReportId === "gstr-3b" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Outward tax" value={formatCurrency(snapshot.salesTotals.tax, currency)} />
              <Tile label="Credit notes" value={formatCurrency(snapshot.creditTotals.tax, currency)} />
              <Tile
                label="ITC in books"
                value={snapshot.filing.itcAllowed ? formatCurrency(snapshot.purchaseTotals.itc, currency) : "Not claimed"}
              />
              <Tile label="Net tax estimate" value={formatCurrency(snapshot.gstr3b.netTaxEstimate, currency)} hint="Estimate only, not a filed liability" />
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.gstr3b.rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
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
              GSTR-3B prep uses stored invoice snapshots. Net tax is an estimate for books review, not GST payable on the portal.
            </p>
          </div>
        ) : null}

        {activeReportId === "gstr-4" ? (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Composition books summary</CardTitle>
                <CardDescription>
                  Turnover from stored bills of supply. This is not a CMP-08 or GSTR-4 filing.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Outward turnover" value={formatCurrency(snapshot.gstr4.outwardTurnover, currency)} />
                <Tile label="Tax on invoices" value={formatCurrency(snapshot.gstr4.taxCollected, currency)} hint="Should be zero for composition" />
                <Tile label="Purchase turnover" value={formatCurrency(snapshot.gstr4.purchaseTurnover, currency)} />
                <Tile label="Documents" value={`${snapshot.gstr4.documentCount} sales / ${snapshot.gstr4.purchaseCount} purchases`} />
              </CardContent>
            </Card>
            <BooksTable rows={snapshot.sales} currency={currency} empty="No composition sales in this period." />
          </div>
        ) : null}

        {activeReportId === "hsn-summary" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile label="Taxable" value={formatCurrency(hsnTotals(snapshot.hsn).taxableAmount, currency)} />
              <Tile label="Tax" value={formatCurrency(hsnTotals(snapshot.hsn).taxAmount, currency)} />
              <Tile label="Qty" value={formatNumber(hsnTotals(snapshot.hsn).quantity)} />
            </div>
            {snapshot.hsn.length === 0 ? (
              <EmptyState icon={<FileSpreadsheet className="size-6" />} title="No HSN lines" description="Posted sales lines with stored HSN and tax snapshots appear here." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Docs</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.hsn.map((row) => (
                      <TableRow key={`${row.hsn}-${row.rate}`}>
                        <TableCell className="font-medium">{row.hsn}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.rate}%</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.documentCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.taxableAmount, currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.taxAmount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : null}

        {activeReportId === "rate-wise" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile label="Taxable" value={formatCurrency(rateWiseTotals(snapshot.rateWise).taxableAmount, currency)} />
              <Tile label="Tax" value={formatCurrency(rateWiseTotals(snapshot.rateWise).taxAmount, currency)} />
              <Tile label="Rates" value={String(snapshot.rateWise.length)} />
            </div>
            {snapshot.rateWise.length === 0 ? (
              <EmptyState icon={<FileSpreadsheet className="size-6" />} title="No rate lines" description="Posted sales lines with stored GST rates appear here." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GST rate</TableHead>
                      <TableHead className="text-right">Documents</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.rateWise.map((row) => (
                      <TableRow key={row.rate}>
                        <TableCell className="font-medium">{row.rate}%</TableCell>
                        <TableCell className="text-right tabular-nums">{row.documentCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.taxableAmount, currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.cgst, currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.sgst, currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.igst, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : null}

        {activeReportId === "b2b-b2c" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="B2B taxable" value={formatCurrency(snapshot.b2bTotals.taxable, currency)} hint={`${snapshot.b2b.length} invoices with GSTIN`} />
              <Tile label="B2C taxable" value={formatCurrency(snapshot.b2cTotals.taxable, currency)} hint={`${snapshot.b2c.length} invoices without GSTIN`} />
            </div>
            <h3 className="text-sm font-semibold">B2B</h3>
            <BooksTable rows={snapshot.b2b} currency={currency} empty="No B2B invoices in this period." />
            <h3 className="text-sm font-semibold">B2C</h3>
            <BooksTable rows={snapshot.b2c} currency={currency} empty="No B2C invoices in this period." />
          </div>
        ) : null}

        {activeReportId === "credit-debit-notes" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Credit notes" value={String(snapshot.creditNotes.length)} hint={formatCurrency(snapshot.creditTotals.tax, currency)} />
              <Tile label="Debit notes" value={String(snapshot.debitNotes.length)} hint="Only stored debit-note documents" />
            </div>
            <h3 className="text-sm font-semibold">Credit notes</h3>
            <BooksTable rows={snapshot.creditNotes} currency={currency} empty="No sales-return credit notes in this period." />
            <h3 className="text-sm font-semibold">Debit notes</h3>
            <BooksTable rows={snapshot.debitNotes} currency={currency} empty="No debit-note documents are stored in this period." />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          CSV and print are preview exports from books. They are not filing-ready returns. 2B compare stays under Reports → Finance → GST recon.
        </p>
      </div>
    </div>
  );
}
