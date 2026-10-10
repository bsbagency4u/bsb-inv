"use client";

import { useParams } from "next/navigation";
import { PosSaleForm } from "@/components/sales/pos-sale-form";

export default function EditSalesInvoicePage() {
  const params = useParams<{ id: string }>();
  return (
    <PosSaleForm
      title="Edit sales invoice"
      description="Update this invoice. Posted edits reverse then reapply stock and payments. The invoice number does not change."
      afterSaveHref="/sales/invoices"
      invoiceId={params?.id}
    />
  );
}
