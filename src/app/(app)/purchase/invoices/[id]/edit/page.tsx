"use client";

import { useParams } from "next/navigation";
import { PurchaseInvoiceForm } from "@/components/purchase/purchase-invoice-form";

export default function EditPurchaseInvoicePage() {
  const params = useParams<{ id: string }>();
  return <PurchaseInvoiceForm invoiceId={params?.id} />;
}
