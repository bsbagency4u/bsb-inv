"use client";

import { PosSaleForm } from "@/components/sales/pos-sale-form";

export default function NewSalesInvoicePage() {
  return (
    <PosSaleForm
      title="New sales invoice"
      description="Create a GST sales invoice. Drafts do not reduce stock; completing the sale does."
      afterSaveHref="/sales/invoices"
    />
  );
}
