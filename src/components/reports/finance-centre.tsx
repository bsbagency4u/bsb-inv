"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Download, FileSpreadsheet, Landmark, Users } from "lucide-react";
import { getClientServices } from "@/services";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
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
import { AgingSummary } from "@/components/ledger/outstanding-table";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { agingTotals, allocatedAmount, isActivePayment, unallocatedAmount } from "@/lib/party-ledger";
import {
  gstDocumentLabel,
  parseGstPortalCsv,
  reconcileGstLines,
  reconSummary,
  type GstPortalLine,
  type GstReconMatchStatus,
} from "@/lib/gst-recon";
import { downloadCsv } from "@/reports/export";
import type { FinanceSnapshot } from "@/services/report.service";
import type { ReportPeriod } from "@/types/domain";

function Tile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block hover:border-primary/40">
      {body}
    </Link>
  );
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBooksCsv(filename: string, header: string[], rows: Array<Array<string | number | boolean | null>>) {
  const csv = [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
  downloadCsv(filename, csv);
}

const MATCH_LABEL: Record<GstReconMatchStatus, string> = {
  matched: "Matched",
  mismatch: "Mismatch",
  books_only: "Books only",
  portal_only: "Portal only",
};

const MATCH_VARIANT: Record<GstReconMatchStatus, "success" | "warning" | "info" | "destructive"> = {
  matched: "success",
  mismatch: "warning",
  books_only: "info",
  portal_only: "destructive",
};

export function FinanceCentre({
  businessId,
  currency,
  period,
  userId,
}: {
  businessId: string;
  currency: string;
  period: ReportPeriod;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [view, setView] = React.useState("overview");
  const [partyKind, setPartyKind] = React.useState<"customers" | "suppliers">("customers");
  const [portalRows, setPortalRows] = React.useState<GstPortalLine[]>([]);
  const [portalError, setPortalError] = React.useState<string | null>(null);
  const [noteDocument, setNoteDocument] = React.useState("");
  const [noteText, setNoteText] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  const query = useQuery({
    queryKey: ["finance-centre", businessId, period],
    queryFn: async () => getClientServices().reports.financeSnapshot(businessId, period),
  });

  const snapshot = query.data;
  const matches = React.useMemo(() => {
    if (!snapshot) return [];
    return reconcileGstLines(snapshot.purchaseGst, portalRows);
  }, [snapshot, portalRows]);
  const matchCounts = reconSummary(matches);

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseGstPortalCsv(text);
      setPortalRows(rows);
      setPortalError(null);
      toastSuccess("CSV imported", `${rows.length} portal / 2B rows loaded. Invoices were not changed.`);
    } catch (error) {
      setPortalRows([]);
      setPortalError(normalizeError(error).userMessage);
      toastError("Could not read CSV", normalizeError(error).userMessage);
    }
  };

  const saveNote = async () => {
    if (!userId) {
      toastError("Sign in required", "Reconciliation notes need an active user.");
      return;
    }
    setSavingNote(true);
    try {
      await getClientServices().reports.saveGstReconNote(businessId, userId, period, noteDocument, noteText);
      setNoteText("");
      await queryClient.invalidateQueries({ queryKey: ["finance-centre", businessId, period] });
      toastSuccess("Note saved", "The mismatch is recorded without editing the invoice.");
    } catch (error) {
      toastError("Could not save note", normalizeError(error).userMessage);
    } finally {
      setSavingNote(false);
    }
  };

  if (query.isLoading) return <LoadingState label="Loading finance workspace…" />;
  if (query.isError) {
    return (
      <ErrorState
        error={normalizeError(query.error).userMessage}
        onRetry={() => query.refetch()}
        title="Could not load finance figures"
      />
    );
  }
  if (!snapshot) return null;

  const partyRows = partyKind === "customers" ? snapshot.customers : snapshot.suppliers;

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { value: "overview", label: "Overview", icon: <Landmark className="size-4" /> },
          { value: "cash", label: "Cash", icon: <Banknote className="size-4" /> },
          { value: "parties", label: "Parties", icon: <Users className="size-4" /> },
          { value: "gst", label: "GST recon", icon: <FileSpreadsheet className="size-4" /> },
        ]}
        value={view}
        onValueChange={setView}
      />

      {view === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Period sales"
              value={formatCurrency(snapshot.salesTotal, currency)}
              hint={`${snapshot.salesCount} posted invoices`}
              href="/sales/invoices"
            />
            <Tile
              label="Period purchases"
              value={formatCurrency(snapshot.purchaseTotal, currency)}
              hint={`${snapshot.purchaseCount} posted bills`}
              href="/purchase/invoices"
            />
            <Tile
              label="Receivables"
              value={formatCurrency(snapshot.receivableTotal, currency)}
              hint={`Overdue ${formatCurrency(snapshot.receivableOverdue, currency)}`}
              href="/outstanding"
            />
            <Tile
              label="Payables"
              value={formatCurrency(snapshot.payableTotal, currency)}
              hint={`Overdue ${formatCurrency(snapshot.payableOverdue, currency)}`}
              href="/outstanding"
            />
            <Tile
              label="Receipts"
              value={formatCurrency(snapshot.cash.receipts, currency)}
              hint={`${snapshot.cash.receiptCount} vouchers`}
              href="/payments"
            />
            <Tile
              label="Payouts"
              value={formatCurrency(snapshot.cash.payouts, currency)}
              hint={`${snapshot.cash.paymentCount} vouchers`}
              href="/payments"
            />
            <Tile
              label="Customer advances"
              value={formatCurrency(snapshot.advances.customer, currency)}
              hint={`${snapshot.advances.customerCount} unallocated`}
            />
            <Tile
              label="Supplier advances"
              value={formatCurrency(snapshot.advances.supplier, currency)}
              hint={`${snapshot.advances.supplierCount} unallocated`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Outstanding uses the same ledger allocations as Payments and Outstanding. Cash is posted
            vouchers only — there is no bank-statement balance in this workspace.
          </p>
        </div>
      ) : null}

      {view === "cash" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Inward" value={formatCurrency(snapshot.cash.receipts, currency)} />
            <Tile label="Outward" value={formatCurrency(snapshot.cash.payouts, currency)} />
            <Tile label="Net movement" value={formatCurrency(snapshot.cash.net, currency)} />
            <Tile
              label="Cancelled in period"
              value={String(snapshot.cash.cancelledCount)}
              hint="Excluded from totals"
            />
          </div>
          {snapshot.cash.byMode.length === 0 ? (
            <EmptyState
              icon={<Banknote className="size-6" />}
              title="No posted payments in this period"
              description="Receipts and supplier payments from the Payments module appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Inward</TableHead>
                    <TableHead className="text-right">Outward</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Vouchers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.cash.byMode.map((row) => (
                    <TableRow key={row.mode}>
                      <TableCell className="font-medium capitalize">{row.mode.replace("_", " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.inward, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.outward, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.net, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {snapshot.payments.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Unallocated</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.documentNo ?? payment.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.direction === "in" ? "Receipt" : "Payment"} · {payment.mode}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(payment.amount, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(isActivePayment(payment) ? unallocatedAmount(payment) : 0, currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.status === "cancelled" ? "destructive" : allocatedAmount(payment) === 0 ? "info" : "success"}>
                          {payment.status === "cancelled" ? "Cancelled" : unallocatedAmount(payment) > 0 ? "Advance" : "Allocated"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}

      {view === "parties" ? (
        <div className="space-y-4">
          <Tabs
            tabs={[
              { value: "customers", label: "Customers" },
              { value: "suppliers", label: "Suppliers" },
            ]}
            value={partyKind}
            onValueChange={(value) => setPartyKind(value as "customers" | "suppliers")}
          />
          <AgingSummary
            totals={agingTotals(partyKind === "customers" ? snapshot.receivables : snapshot.payables)}
            currency={currency}
          />
          {partyRows.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title={partyKind === "customers" ? "No customers" : "No suppliers"}
              description="Party opening, invoices, returns and receipts come from the existing ledger."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partyRows.map((row) => (
                    <TableRow key={row.partyId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${row.kind === "customer" ? "/customers" : "/suppliers"}/${row.partyId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {row.partyName}
                        </Link>
                        {row.gstin ? <span className="block text-xs text-muted-foreground">{row.gstin}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.balance.opening, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.balance.invoiced, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.balance.returned, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.balance.paid, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.balance.advance, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.balance.outstanding, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.overdueTotal, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}

      {view === "gst" ? (
        <GstReconView
          snapshot={snapshot}
          currency={currency}
          period={period}
          portalError={portalError}
          matchCounts={matchCounts}
          matches={matches}
          noteDocument={noteDocument}
          noteText={noteText}
          savingNote={savingNote}
          onNoteDocument={setNoteDocument}
          onNoteText={setNoteText}
          onImport={onImport}
          onSaveNote={() => void saveNote()}
          onClearPortal={() => {
            setPortalRows([]);
            setPortalError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function GstReconView({
  snapshot,
  currency,
  period,
  portalError,
  matchCounts,
  matches,
  noteDocument,
  noteText,
  savingNote,
  onNoteDocument,
  onNoteText,
  onImport,
  onSaveNote,
  onClearPortal,
}: {
  snapshot: FinanceSnapshot;
  currency: string;
  period: ReportPeriod;
  portalError: string | null;
  matchCounts: ReturnType<typeof reconSummary>;
  matches: ReturnType<typeof reconcileGstLines>;
  noteDocument: string;
  noteText: string;
  savingNote: boolean;
  onNoteDocument: (value: string) => void;
  onNoteText: (value: string) => void;
  onImport: (file: File | null) => void;
  onSaveNote: () => void;
  onClearPortal: () => void;
}) {
  const filing = snapshot.filing;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>GST filing workspace</CardTitle>
          <CardDescription>{filing.reason}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={filing.gstr1Allowed ? "success" : "outline"}>
            GSTR-1 {filing.gstr1Allowed ? "prep" : "not applicable"}
          </Badge>
          <Badge variant={filing.itcAllowed ? "info" : "outline"}>
            ITC {filing.itcAllowed ? "eligible buyers" : "not claimed"}
          </Badge>
          <Badge variant="secondary">{snapshot.registrationType}</Badge>
          {snapshot.lockedSalesCount + snapshot.lockedPurchaseCount > 0 ? (
            <Badge variant="warning">
              {snapshot.lockedSalesCount + snapshot.lockedPurchaseCount} locked documents
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {!filing.gstr1Allowed ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Outward GSTR-1 figures are hidden because they are not a valid filing report for this registration.
          Purchase snapshots below remain available for books review only.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">GSTR-1 prep (sales snapshots)</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={snapshot.salesGst.length === 0}
              onClick={() =>
                downloadBooksCsv(
                  `gstr1-prep-${period.from}-to-${period.to}.csv`,
                  ["GSTIN/UIN", "Receiver name", "Document type", "Invoice number", "Invoice date", "Invoice value", "Place of supply", "Reverse charge", "Taxable value", "CGST", "SGST", "IGST", "Total tax"],
                  snapshot.salesGst.map((row) => [
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
                  ])
                )
              }
            >
              <Download className="size-4" />
              Export GSTR-1 CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Taxable" value={formatCurrency(snapshot.salesGstTotals.taxable, currency)} />
            <Tile label="CGST" value={formatCurrency(snapshot.salesGstTotals.cgst, currency)} />
            <Tile label="SGST" value={formatCurrency(snapshot.salesGstTotals.sgst, currency)} />
            <Tile label="IGST" value={formatCurrency(snapshot.salesGstTotals.igst, currency)} />
            <Tile label="Credit notes" value={String(snapshot.creditNotes.length)} />
          </div>
          <GstBooksTable rows={snapshot.salesGst} currency={currency} empty="No posted sales in this period." />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Purchase / ITC books</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={snapshot.purchaseGst.length === 0}
            onClick={() =>
              downloadBooksCsv(
                `purchase-itc-${period.from}-to-${period.to}.csv`,
                ["GSTIN", "Supplier", "Bill number", "Bill date", "Invoice value", "Taxable value", "CGST", "SGST", "IGST", "RCM", "ITC eligible"],
                snapshot.purchaseGst.map((row) => [
                  row.gstin,
                  row.partyName,
                  row.documentNo,
                  row.documentDate,
                  row.invoiceValue,
                  row.taxableAmount,
                  row.cgst,
                  row.sgst,
                  row.igst,
                  row.reverseCharge ? "Y" : "N",
                  row.itcEligible ? "Y" : "N",
                ])
              )
            }
          >
            <Download className="size-4" />
            Export purchase CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Taxable" value={formatCurrency(snapshot.purchaseGstTotals.taxable, currency)} />
          <Tile label="Tax" value={formatCurrency(snapshot.purchaseGstTotals.tax, currency)} />
          <Tile
            label="ITC in books"
            value={filing.itcAllowed ? formatCurrency(snapshot.purchaseGstTotals.itc, currency) : "Not claimed"}
          />
          <Tile label="RCM tax" value={formatCurrency(snapshot.purchaseGstTotals.rcm, currency)} />
        </div>
        <GstBooksTable rows={snapshot.purchaseGst} currency={currency} empty="No posted purchase bills in this period." showItc />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GSTR-2B / portal CSV compare</CardTitle>
          <CardDescription>
            Import a portal or 2B CSV to mark matches and mismatches. This never files a return and never edits invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Portal / 2B CSV">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => onImport(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Button variant="outline" size="sm" onClick={onClearPortal}>
              Clear import
            </Button>
          </div>
          {portalError ? <p className="text-sm text-destructive">{portalError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Matched {matchCounts.matched}</Badge>
            <Badge variant="warning">Mismatch {matchCounts.mismatch}</Badge>
            <Badge variant="info">Books only {matchCounts.books_only}</Badge>
            <Badge variant="destructive">Portal only {matchCounts.portal_only}</Badge>
          </div>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Import a CSV to compare against purchase snapshots.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Books taxable</TableHead>
                    <TableHead className="text-right">Portal taxable</TableHead>
                    <TableHead>Difference</TableHead>
                    <TableHead>Lock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match, index) => {
                    const documentNo = match.books?.documentNo ?? match.portal?.documentNo ?? "—";
                    return (
                      <TableRow key={`${documentNo}-${index}`}>
                        <TableCell>
                          <Badge variant={MATCH_VARIANT[match.status]}>{MATCH_LABEL[match.status]}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{documentNo}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {match.books?.partyName ?? match.portal?.partyName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {match.books ? formatCurrency(match.books.taxableAmount, currency) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {match.portal ? formatCurrency(match.portal.taxableAmount, currency) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {match.differences.join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {match.books?.locked ? <Badge variant="warning">Locked</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mismatch notes</CardTitle>
          <CardDescription>
            Notes are stored on the business. Historical invoices stay unchanged even when a period is locked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <Field label="Document no.">
              <Input value={noteDocument} onChange={(event) => onNoteDocument(event.target.value)} placeholder="BILL-12" />
            </Field>
            <Field label="Note">
              <Textarea value={noteText} onChange={(event) => onNoteText(event.target.value)} rows={2} />
            </Field>
            <Button onClick={onSaveNote} loading={savingNote} disabled={!noteDocument.trim() || !noteText.trim()}>
              Save note
            </Button>
          </div>
          {snapshot.reconNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes for this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {snapshot.reconNotes.map((note) => (
                <li key={note.id} className="rounded-md border border-border px-3 py-2">
                  <p className="font-medium">{note.documentNo}</p>
                  <p className="text-muted-foreground">{note.note}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GstBooksTable({
  rows,
  currency,
  empty,
  showItc = false,
}: {
  rows: FinanceSnapshot["salesGst"];
  currency: string;
  empty: string;
  showItc?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={<FileSpreadsheet className="size-6" />} title={empty} description="Figures use GST snapshots stored on each document." />;
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
            <TableHead className="text-right">Tax</TableHead>
            {showItc ? <TableHead>ITC</TableHead> : null}
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.documentNo}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(row.documentDate)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.partyName}
                {row.gstin ? <span className="block text-xs">{row.gstin}</span> : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{gstDocumentLabel(row.documentType)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.taxableAmount, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.taxAmount, currency)}</TableCell>
              {showItc ? (
                <TableCell>
                  <Badge variant={row.itcEligible ? "success" : "outline"}>{row.itcEligible ? "Yes" : "No"}</Badge>
                </TableCell>
              ) : null}
              <TableCell className="space-x-1">
                {row.reverseCharge ? <Badge variant="warning">RCM</Badge> : null}
                {row.locked ? <Badge variant="secondary">Locked</Badge> : null}
                {row.documentType === "bill_of_supply" ? <Badge variant="outline">BOS</Badge> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
