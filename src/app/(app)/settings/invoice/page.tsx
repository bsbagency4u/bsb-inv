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
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { DEFAULT_INVOICE } from "@/services/business.service";

export default function InvoiceSettingsPage() {
  const { user, business, refresh } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [savingNumbering, setSavingNumbering] = React.useState(false);
  const [savingLayout, setSavingLayout] = React.useState(false);
  const [prefixOverride, setPrefixOverride] = React.useState<string | null>(null);
  const [startNumberOverride, setStartNumberOverride] = React.useState<string | null>(null);
  const [showLogoOverride, setShowLogoOverride] = React.useState<boolean | null>(null);
  const [showGstinOverride, setShowGstinOverride] = React.useState<boolean | null>(null);
  const [showHsnOverride, setShowHsnOverride] = React.useState<boolean | null>(null);
  const [showBankOverride, setShowBankOverride] = React.useState<boolean | null>(null);
  const [bankDetailsOverride, setBankDetailsOverride] = React.useState<string | null>(null);
  const [termsOverride, setTermsOverride] = React.useState<string | null>(null);
  const [footerOverride, setFooterOverride] = React.useState<string | null>(null);
  const [paperSizeOverride, setPaperSizeOverride] = React.useState<string | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoice-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInvoiceDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const prefix = prefixOverride ?? business?.invoicePrefix ?? "INV";
  const startNumber = startNumberOverride ?? String(business?.invoiceStartNumber ?? 1001);
  const showLogo = showLogoOverride ?? defaults?.showLogo ?? DEFAULT_INVOICE.showLogo;
  const showGstin = showGstinOverride ?? defaults?.showGstin ?? DEFAULT_INVOICE.showGstin;
  const showHsn = showHsnOverride ?? defaults?.showHsn ?? DEFAULT_INVOICE.showHsn;
  const showBankDetails = showBankOverride ?? defaults?.showBankDetails ?? DEFAULT_INVOICE.showBankDetails;
  const bankDetails = bankDetailsOverride ?? defaults?.bankDetails ?? DEFAULT_INVOICE.bankDetails;
  const terms = termsOverride ?? defaults?.termsAndConditions ?? DEFAULT_INVOICE.termsAndConditions;
  const footer = footerOverride ?? defaults?.footerNote ?? DEFAULT_INVOICE.footerNote;
  const paperSize = paperSizeOverride ?? defaults?.paperSize ?? DEFAULT_INVOICE.paperSize;

  const year = new Date().getFullYear();
  const previewNumber = `${(prefix || "INV").toUpperCase()}-${year}-${String(Number(startNumber) || 1).padStart(6, "0")}`;

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
      await getClientServices().businesses.updateInvoiceDefaults(user.id, business.id, {
        showLogo,
        showGstin,
        showHsn,
        showBankDetails,
        bankDetails,
        termsAndConditions: terms,
        footerNote: footer,
        paperSize: paperSize as typeof DEFAULT_INVOICE.paperSize,
      });
      toastSuccess("Invoice layout saved", "Print and PDF output will reflect these options.");
      await queryClient.invalidateQueries({ queryKey: ["invoice-defaults"] });
    } catch (err) {
      toastError("Could not save invoice layout", normalizeError(err).userMessage);
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
        title="Invoice"
        description="Numbering, layout and print options for sales invoices and purchase bills."
      />
      <div className="mx-auto max-w-2xl space-y-6 p-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Layout &amp; print</CardTitle>
            <CardDescription>
              Controls what appears on printed and PDF invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Paper size" htmlFor="invoice-paper">
              <Select
                id="invoice-paper"
                value={paperSize}
                onChange={(event) => setPaperSizeOverride(event.target.value)}
              >
                <option value="a4">A4</option>
                <option value="a5">A5</option>
                <option value="thermal">Thermal (80mm receipt)</option>
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Show business logo</p>
                <p className="text-xs text-muted-foreground">Requires a logo on the business profile.</p>
              </div>
              <Switch checked={showLogo} onCheckedChange={setShowLogoOverride} aria-label="Show business logo" />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Show GSTIN</p>
                <p className="text-xs text-muted-foreground">Prints the buyer and seller GSTIN.</p>
              </div>
              <Switch checked={showGstin} onCheckedChange={setShowGstinOverride} aria-label="Show GSTIN" />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Show HSN / SAC</p>
                <p className="text-xs text-muted-foreground">Adds an HSN column to the line items table.</p>
              </div>
              <Switch checked={showHsn} onCheckedChange={setShowHsnOverride} aria-label="Show HSN" />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Show bank details</p>
                <p className="text-xs text-muted-foreground">Prints payment instructions on the invoice.</p>
              </div>
              <Switch
                checked={showBankDetails}
                onCheckedChange={setShowBankOverride}
                aria-label="Show bank details"
              />
            </div>
            {showBankDetails ? (
              <Field label="Bank details" htmlFor="invoice-bank">
                <Textarea
                  id="invoice-bank"
                  value={bankDetails}
                  onChange={(event) => setBankDetailsOverride(event.target.value)}
                  placeholder="Account name, number, IFSC and bank branch"
                  rows={3}
                  maxLength={300}
                />
              </Field>
            ) : null}
            <Field label="Terms and conditions" htmlFor="invoice-terms">
              <Textarea
                id="invoice-terms"
                value={terms}
                onChange={(event) => setTermsOverride(event.target.value)}
                placeholder="e.g. Goods once sold will not be taken back."
                rows={3}
                maxLength={1000}
              />
            </Field>
            <Field label="Footer note" htmlFor="invoice-footer">
              <Input
                id="invoice-footer"
                value={footer}
                onChange={(event) => setFooterOverride(event.target.value)}
                placeholder="e.g. Thank you for your business!"
                maxLength={200}
              />
            </Field>
          </CardContent>
          <CardFooter>
            <Button onClick={() => void saveLayout()} loading={savingLayout}>
              Save layout
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
