"use client";

import * as React from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  downloadQuotationHtml,
  exportQuotationPdf,
  printQuotation,
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
}: {
  business: BusinessProfile;
  invoiceDefaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined;
  model: QuotationPrintModel;
  currency?: string;
  size?: "sm" | "md";
}) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const settings = parseInvoiceDefaults(invoiceDefaults);
  const money = currency ?? business.currency ?? "INR";
  const enabled = isPrintDocumentEnabled(settings, "quotation");

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
    toastSuccess("PDF ready", "Use the print dialog to save as PDF, or keep the downloaded HTML copy.");
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

  return (
    <div className="flex justify-end gap-2">
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
          Share
        </Button>
      ) : null}
    </div>
  );
}
