"use client";

import * as React from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  downloadDocumentHtml,
  exportDocumentPdf,
  printDocument,
  shareDocumentWhatsApp,
} from "@/lib/invoice-print";
import { isPrintDocumentEnabled, parseInvoiceDefaults } from "@/lib/invoice-settings";
import type { BusinessProfile, InvoiceDefaults, PrintDocumentType } from "@/types/domain";
import type { PrintDocumentModel } from "@/lib/invoice-print";

export function DocumentPrintActions({
  business,
  defaults,
  model,
  currency,
  size = "sm",
}: {
  business: BusinessProfile;
  defaults: InvoiceDefaults | Partial<InvoiceDefaults> | null | undefined;
  model: PrintDocumentModel;
  currency?: string;
  size?: "sm" | "md";
}) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const settings = parseInvoiceDefaults(defaults);
  const money = currency ?? business.currency ?? "INR";
  const enabled = isPrintDocumentEnabled(settings, model.kind as PrintDocumentType);

  const onPrint = () => {
    if (!enabled) {
      toastError("Print disabled", "Enable this document type in Settings → Invoice.");
      return;
    }
    const result = printDocument(business, settings, model, money);
    if (!result.ok) {
      toastInfo("Print Invoice", "The browser blocked the print dialog. Click Print again.");
      return;
    }
  };

  const onPdf = () => {
    if (!enabled) {
      toastError("PDF disabled", "Enable this document type in Settings → Invoice.");
      return;
    }
    const result = exportDocumentPdf(business, settings, model, money);
    if (!result.ok) {
      toastError("Could not export PDF", "Use Print Invoice and choose Save as PDF in the browser dialog.");
      return;
    }
    toastSuccess("PDF ready", "Use the print dialog to save as PDF, or keep the downloaded HTML copy.");
  };

  const onShare = () => {
    if (!settings.whatsappEnabled) {
      toastError("WhatsApp sharing is off", "Enable it in Settings → Invoice → Share.");
      return;
    }
    shareDocumentWhatsApp(business, settings, model, money);
    downloadDocumentHtml(business, settings, model, money);
    toastInfo(
      "WhatsApp message opened",
      "A copy of the document was downloaded. Attach it yourself if you want to send the file."
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
      {settings.whatsappEnabled ? (
        <Button variant="outline" size={size} onClick={onShare} disabled={!enabled}>
          <Share2 className="size-4" />
          Share
        </Button>
      ) : null}
    </div>
  );
}
