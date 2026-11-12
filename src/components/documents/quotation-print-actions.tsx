"use client";

import * as React from "react";
import { Download, Mail, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  downloadQuotationHtml,
  exportQuotationPdf,
  printQuotation,
  quotationPrintHtml,
  shareQuotationEmail,
  shareQuotationWhatsApp,
  type QuotationPrintModel,
} from "@/lib/quotation-print";
import { isPrintDocumentEnabled, parseInvoiceDefaults } from "@/lib/invoice-settings";
import type { BusinessProfile, InvoiceDefaults } from "@/types/domain";

export function QuotationPrintActions({
  business,
  invoiceDefaults,
  model,
  currency,
  size = "sm",
  showPreview = false,
}: {
  business: BusinessProfile;
  invoiceDefaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined;
  model: QuotationPrintModel;
  currency?: string;
  size?: "sm" | "md";
  showPreview?: boolean;
}) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const settings = parseInvoiceDefaults(invoiceDefaults);
  const money = currency ?? business.currency ?? "INR";
  const enabled = isPrintDocumentEnabled(settings, "quotation");
  const html = quotationPrintHtml(business, model, money);

  const onPrint = () => {
    if (!enabled) {
      toastError("Print disabled", "Enable quotations in Settings → Invoice.");
      return;
    }
    const result = printQuotation(business, settings, model, money);
    if (!result.ok) {
      toastInfo("Print quotation", "The browser blocked the print dialog. Click Print again.");
    }
  };

  const onPdf = () => {
    if (!enabled) {
      toastError("PDF disabled", "Enable quotations in Settings → Invoice.");
      return;
    }
    const result = exportQuotationPdf(business, settings, model, money);
    if (!result.ok) {
      toastError("Could not export PDF", "Use Print and choose Save as PDF in the browser dialog.");
      return;
    }
    toastSuccess("PDF ready", "Use the print dialog to save as PDF. Preview, print and PDF share this layout.");
  };

  const onShare = () => {
    if (!model.settings.whatsappEnabled) {
      toastError("WhatsApp sharing is off", "Enable it in Settings → Quotations.");
      return;
    }
    shareQuotationWhatsApp(business, model, money);
    downloadQuotationHtml(business, settings, model, money);
    toastInfo(
      "WhatsApp message opened",
      "A copy of the quotation was downloaded. Attach it yourself if you want to send the file."
    );
  };

  const onEmail = () => {
    if (!model.partyEmail) {
      toastError("No email on file", "Add a customer email to share this quotation by email.");
      return;
    }
    shareQuotationEmail(business, model, money);
    downloadQuotationHtml(business, settings, model, money);
    toastInfo("Email draft opened", "Attach the downloaded quotation file before sending.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size={size} onClick={onPrint} disabled={!enabled}>
          <Printer className="size-4" />
          Print
        </Button>
        <Button variant="outline" size={size} onClick={onPdf} disabled={!enabled}>
          <Download className="size-4" />
          PDF
        </Button>
        {model.settings.whatsappEnabled ? (
          <Button variant="outline" size={size} onClick={onShare} disabled={!enabled}>
            <Share2 className="size-4" />
            WhatsApp
          </Button>
        ) : null}
        <Button variant="outline" size={size} onClick={onEmail} disabled={!enabled}>
          <Mail className="size-4" />
          Email
        </Button>
      </div>
      {showPreview ? (
        <div className="overflow-hidden rounded-lg border border-border bg-[#dfe3ea]">
          <iframe title={`Preview ${model.quotation.quotationNo}`} className="h-[720px] w-full bg-white" srcDoc={html} />
        </div>
      ) : null}
    </div>
  );
}
