"use client";

import { useParams } from "next/navigation";
import { QuotationForm } from "@/components/sales/quotation-form";

export default function EditQuotationPage() {
  const params = useParams<{ id: string }>();
  return (
    <QuotationForm
      title="Edit quotation"
      description="Update this offer. Converted quotations cannot be edited."
      quotationId={params?.id}
    />
  );
}
