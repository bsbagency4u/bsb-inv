"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import {
  DEFAULT_INVOICE,
  PRINT_DOCUMENT_TYPES,
  PRINT_DOCUMENT_TYPE_META,
  parseInvoiceDefaults,
} from "@/lib/invoice-settings";
import { documentPrintHtml, samplePrintModel } from "@/lib/invoice-print";
import type {
  InvoiceDefaults,
  InvoiceOrientation,
  InvoicePaperSize,
  InvoicePrintOutput,
  PrintDocumentType,
} from "@/types/domain";

const TABS = [
  { value: "documents", label: "Documents" },
  { value: "paper", label: "Paper" },
  { value: "fields", label: "Fields" },
  { value: "print", label: "Print" },
  { value: "share", label: "Share" },
  { value: "numbering", label: "Numbering" },
];

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel} />
    </div>
  );
}

export default function InvoiceSettingsPage() {
  const { user, business, refresh } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [tab, setTab] = React.useState("documents");
  const [savingNumbering, setSavingNumbering] = React.useState(false);
  const [savingLayout, setSavingLayout] = React.useState(false);
  const [prefixOverride, setPrefixOverride] = React.useState<string | null>(null);
  const [startNumberOverride, setStartNumberOverride] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<InvoiceDefaults | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoice-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInvoiceDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const settings = draft ?? parseInvoiceDefaults(defaults ?? DEFAULT_INVOICE);
  const prefix = prefixOverride ?? business?.invoicePrefix ?? "INV";
  const startNumber = startNumberOverride ?? String(business?.invoiceStartNumber ?? 1001);
  const year = new Date().getFullYear();
  const previewNumber = `${(prefix || "INV").toUpperCase()}-${year}-${String(Number(startNumber) || 1).padStart(6, "0")}`;
  const previewKind: PrintDocumentType = settings.documentTypes.sales_invoice.enabled
    ? "sales_invoice"
    : (PRINT_DOCUMENT_TYPES.find((kind) => settings.documentTypes[kind].enabled) ?? "sales_invoice");
  const previewHtml = business
    ? documentPrintHtml(business, settings, samplePrintModel(previewKind), business.currency ?? "INR")
    : "";

  const patch = (next: Partial<InvoiceDefaults>) => {
    setDraft(parseInvoiceDefaults({ ...settings, ...next }));
  };

  const saveNumbering = async () => {
    if (!business || !user) return;
    setSavingNumbering(true);
    try {
      await getClientServices().businesses.updateInvoiceNumbering(user.id, business.id, {
        invoicePrefix: prefix,
        invoiceStartNumber: Number(startNumber) || 1,
      });
      toastSuccess("Numbering saved", "New invoices will use this prefix.");
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["business"] });
    } catch (err) {
      toastError("Could not save numbering", normalizeError(err).userMessage);
    } finally {
      setSavingNumbering(false);
    }
  };

  const saveLayout = async () => {
    if (!business || !user) return;
    setSavingLayout(true);
    try {
      await getClientServices().businesses.updateInvoiceDefaults(user.id, business.id, settings);
      toastSuccess("Invoice & print saved", "New prints use these options. Saved invoices keep their original tax and totals.");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["invoice-defaults"] });
    } catch (err) {
      toastError("Could not save invoice settings", normalizeError(err).userMessage);
    } finally {
      setSavingLayout(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading invoice settings…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load invoice settings"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Invoice & Print"
        description="Paper, fields, copies and share options used by every document screen."
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Tabs tabs={TABS} value={tab} onValueChange={setTab} />

          {tab === "documents" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Document types
                </CardTitle>
                <CardDescription>
                  Choose which saved documents can print, export PDF or share. Quotations and challans store layout only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRINT_DOCUMENT_TYPES.map((kind) => {
                  const meta = PRINT_DOCUMENT_TYPE_META[kind];
                  const enabled = settings.documentTypes[kind].enabled;
                  return (
                    <label
                      key={kind}
                      className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <Checkbox
                        className="mt-1"
                        checked={enabled}
                        onChange={(event) =>
                          patch({
                            documentTypes: {
                              ...settings.documentTypes,
                              [kind]: { enabled: event.target.checked },
                            },
                          })
                        }
                        aria-label={meta.label}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveLayout()} loading={savingLayout}>
                  Save print settings
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {tab === "paper" ? (
            <Card>
              <CardHeader>
                <CardTitle>Paper & size</CardTitle>
                <CardDescription>Applied to new prints. Saved invoices keep original tax and totals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Paper size" htmlFor="invoice-paper">
                  <Select
                    id="invoice-paper"
                    value={settings.paperSize}
                    onChange={(event) => patch({ paperSize: event.target.value as InvoicePaperSize })}
                  >
                    <option value="a4">A4</option>
                    <option value="a5">A5</option>
                    <option value="thermal">Thermal 80mm</option>
                    <option value="custom">Custom</option>
                  </Select>
                </Field>
                <Field label="Orientation" htmlFor="invoice-orientation">
                  <Select
                    id="invoice-orientation"
                    value={settings.orientation}
                    onChange={(event) => patch({ orientation: event.target.value as InvoiceOrientation })}
                    disabled={settings.paperSize === "thermal"}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </Select>
                </Field>
                {settings.paperSize === "custom" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Width (mm)" htmlFor="invoice-width">
                      <Input
                        id="invoice-width"
                        type="number"
                        min={40}
                        max={400}
                        value={settings.customWidthMm}
                        onChange={(event) => patch({ customWidthMm: Number(event.target.value) || 40 })}
                      />
                    </Field>
                    <Field label="Height (mm)" htmlFor="invoice-height">
                      <Input
                        id="invoice-height"
                        type="number"
                        min={40}
                        max={600}
                        value={settings.customHeightMm}
                        onChange={(event) => patch({ customHeightMm: Number(event.target.value) || 40 })}
                      />
                    </Field>
                  </div>
                ) : null}
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveLayout()} loading={savingLayout}>
                  Save print settings
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {tab === "fields" ? (
            <Card>
              <CardHeader>
                <CardTitle>Layout fields</CardTitle>
                <CardDescription>Controls columns and footer blocks on printed documents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow
                  label="Show business logo"
                  hint="Requires a logo on the business profile."
                  checked={settings.showLogo}
                  onCheckedChange={(checked) => patch({ showLogo: checked })}
                  ariaLabel="Show business logo"
                />
                <ToggleRow
                  label="Show GSTIN"
                  hint="Prints seller and party GSTIN when present."
                  checked={settings.showGstin}
                  onCheckedChange={(checked) => patch({ showGstin: checked })}
                  ariaLabel="Show GSTIN"
                />
                <ToggleRow
                  label="Show HSN / SAC"
                  hint="Adds an HSN column to line items."
                  checked={settings.showHsn}
                  onCheckedChange={(checked) => patch({ showHsn: checked })}
                  ariaLabel="Show HSN"
                />
                <ToggleRow
                  label="Show SKU"
                  hint="Adds a SKU column when the product has one."
                  checked={settings.showSku}
                  onCheckedChange={(checked) => patch({ showSku: checked })}
                  ariaLabel="Show SKU"
                />
                <ToggleRow
                  label="Show batch"
                  hint="Prints batch numbers from saved line items."
                  checked={settings.showBatch}
                  onCheckedChange={(checked) => patch({ showBatch: checked })}
                  ariaLabel="Show batch"
                />
                <ToggleRow
                  label="Show MRP"
                  hint="Prints MRP when the line stored one."
                  checked={settings.showMrp}
                  onCheckedChange={(checked) => patch({ showMrp: checked })}
                  ariaLabel="Show MRP"
                />
                <ToggleRow
                  label="Show discount"
                  hint="Shows line and invoice discounts."
                  checked={settings.showDiscount}
                  onCheckedChange={(checked) => patch({ showDiscount: checked })}
                  ariaLabel="Show discount"
                />
                <ToggleRow
                  label="Show tax breakup"
                  hint="Prints CGST/SGST or IGST from saved invoice totals."
                  checked={settings.showTaxBreakup}
                  onCheckedChange={(checked) => patch({ showTaxBreakup: checked })}
                  ariaLabel="Show tax breakup"
                />
                <ToggleRow
                  label="Show paid and balance"
                  hint="Prints paid amount and remaining balance."
                  checked={settings.showPaidBalance}
                  onCheckedChange={(checked) => patch({ showPaidBalance: checked })}
                  ariaLabel="Show paid and balance"
                />
                <ToggleRow
                  label="Show notes"
                  hint="Prints the notes saved on the document."
                  checked={settings.showNotes}
                  onCheckedChange={(checked) => patch({ showNotes: checked })}
                  ariaLabel="Show notes"
                />
                <ToggleRow
                  label="Show signature"
                  hint="Adds a signature line at the bottom."
                  checked={settings.showSignature}
                  onCheckedChange={(checked) => patch({ showSignature: checked })}
                  ariaLabel="Show signature"
                />
                {settings.showSignature ? (
                  <Field label="Signature label" htmlFor="invoice-sign">
                    <Input
                      id="invoice-sign"
                      value={settings.signatureLabel}
                      onChange={(event) => patch({ signatureLabel: event.target.value })}
                      maxLength={80}
                    />
                  </Field>
                ) : null}
                <ToggleRow
                  label="Show bank details"
                  hint="Prints payment instructions on the invoice."
                  checked={settings.showBankDetails}
                  onCheckedChange={(checked) => patch({ showBankDetails: checked })}
                  ariaLabel="Show bank details"
                />
                {settings.showBankDetails ? (
                  <Field label="Bank details" htmlFor="invoice-bank">
                    <Textarea
                      id="invoice-bank"
                      value={settings.bankDetails}
                      onChange={(event) => patch({ bankDetails: event.target.value })}
                      placeholder="Account name, number, IFSC and bank branch"
                      rows={3}
                      maxLength={300}
                    />
                  </Field>
                ) : null}
                <Field label="Terms and conditions" htmlFor="invoice-terms">
                  <Textarea
                    id="invoice-terms"
                    value={settings.termsAndConditions}
                    onChange={(event) => patch({ termsAndConditions: event.target.value })}
                    placeholder="e.g. Goods once sold will not be taken back."
                    rows={3}
                    maxLength={1000}
                  />
                </Field>
                <Field label="Footer note" htmlFor="invoice-footer">
                  <Input
                    id="invoice-footer"
                    value={settings.footerNote}
                    onChange={(event) => patch({ footerNote: event.target.value })}
                    placeholder="e.g. Thank you for your business!"
                    maxLength={200}
                  />
                </Field>
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveLayout()} loading={savingLayout}>
                  Save print settings
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {tab === "print" ? (
            <Card>
              <CardHeader>
                <CardTitle>Print behaviour</CardTitle>
                <CardDescription>
                  Auto-print runs only after a successful save. Drafts never print.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  label="Auto print after save"
                  hint="Opens print or PDF after a completed sale, bill, return or payment."
                  checked={settings.autoPrintOnSave}
                  onCheckedChange={(checked) => patch({ autoPrintOnSave: checked })}
                  ariaLabel="Auto print after save"
                />
                <Field label="Copies" htmlFor="invoice-copies" hint="Printed on each document, including reprints.">
                  <Input
                    id="invoice-copies"
                    type="number"
                    min={1}
                    max={9}
                    value={settings.copies}
                    onChange={(event) => patch({ copies: Number(event.target.value) || 1 })}
                  />
                </Field>
                <Field label="Default output" htmlFor="invoice-output">
                  <Select
                    id="invoice-output"
                    value={settings.defaultOutput}
                    onChange={(event) => patch({ defaultOutput: event.target.value as InvoicePrintOutput })}
                  >
                    <option value="print">Printer</option>
                    <option value="pdf">PDF / Save as PDF</option>
                  </Select>
                </Field>
                <Alert title="If the browser blocks printing">
                  Use Print Invoice on the document. This workspace does not fail silently.
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveLayout()} loading={savingLayout}>
                  Save print settings
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {tab === "share" ? (
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp & share</CardTitle>
                <CardDescription>
                  Opens a message with document details. A file is downloaded so you can attach it. This app does not send a PDF attachment by itself.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  label="Enable WhatsApp share"
                  hint="Shows Share on document screens."
                  checked={settings.whatsappEnabled}
                  onCheckedChange={(checked) => patch({ whatsappEnabled: checked })}
                  ariaLabel="Enable WhatsApp share"
                />
                <Field
                  label="Message template"
                  htmlFor="invoice-message"
                  hint="Tokens: {party} {docTitle} {docNo} {business} {date} {total}"
                >
                  <Textarea
                    id="invoice-message"
                    value={settings.messageTemplate}
                    onChange={(event) => patch({ messageTemplate: event.target.value })}
                    rows={4}
                    maxLength={500}
                  />
                </Field>
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveLayout()} loading={savingLayout}>
                  Save print settings
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {tab === "numbering" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Numbering
                </CardTitle>
                <CardDescription>
                  Applied to new documents as <code>{previewNumber}</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Invoice prefix"
                  htmlFor="invoice-prefix"
                  hint="Letters, numbers and dashes, up to 8 characters."
                >
                  <Input
                    id="invoice-prefix"
                    value={prefix}
                    onChange={(event) => setPrefixOverride(event.target.value.toUpperCase())}
                    placeholder="INV"
                    maxLength={8}
                  />
                </Field>
                <Field
                  label="Starting number"
                  htmlFor="invoice-start"
                  hint="Used when the first document of the new financial year is created."
                >
                  <Input
                    id="invoice-start"
                    type="number"
                    min={1}
                    step={1}
                    value={startNumber}
                    onChange={(event) => setStartNumberOverride(event.target.value)}
                  />
                </Field>
              </CardContent>
              <CardFooter>
                <Button onClick={() => void saveNumbering()} loading={savingNumbering}>
                  Save numbering
                </Button>
              </CardFooter>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>Sample data. Reprints of saved invoices use stored totals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-border bg-white">
              <iframe
                title="Invoice print preview"
                className="h-[640px] w-full bg-white"
                srcDoc={previewHtml}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
