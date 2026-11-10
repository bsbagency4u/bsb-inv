"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { quotationPrintModel } from "@/lib/document-print-models";
import { QuotationPrintActions } from "@/components/documents/quotation-print-actions";
import { DEFAULT_INVOICE } from "@/lib/invoice-settings";
import { DEFAULT_QUOTATION, QUOTATION_FORMAT_META } from "@/lib/quotation-settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quotation, QuotationStatus } from "@/types/domain";

const STATUS_VARIANTS: Record<QuotationStatus, "success" | "info" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  sent: "info",
  accepted: "success",
  rejected: "destructive",
  expired: "warning",
  converted: "success",
  cancelled: "destructive",
};

export default function QuotationsPage() {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<Quotation | null>(null);
  const [deleting, setDeleting] = React.useState<Quotation | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { data: quotations, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quotations", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listQuotations(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: invoiceDefaults } = useQuery({
    queryKey: ["invoice-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInvoiceDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: quotationDefaults } = useQuery({
    queryKey: ["quotation-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getQuotationDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!quotations) return [];
    const q = search.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter(
      (item) =>
        item.quotationNo.toLowerCase().includes(q) ||
        item.partyName.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        (item.title ?? "").toLowerCase().includes(q)
    );
  }, [quotations, search]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["quotations"] });
  };

  const setStatus = async (quotation: Quotation, status: QuotationStatus) => {
    if (!business || !user) return;
    setBusyId(quotation.id);
    try {
      await getClientServices().transactions.updateQuotationStatus(business.id, user.id, quotation.id, status);
      toastSuccess("Quotation updated", `${quotation.quotationNo} is now ${status}.`);
      setDetail(null);
      await refresh();
    } catch (err) {
      toastError("Could not update quotation", normalizeError(err).userMessage);
    } finally {
      setBusyId(null);
    }
  };

  const convert = async (quotation: Quotation) => {
    if (!business || !user) return;
    setBusyId(quotation.id);
    try {
      const result = await getClientServices().transactions.convertQuotationToInvoice(
        business.id,
        user.id,
        quotation.id,
        { asDraft: true }
      );
      toastSuccess("Converted to invoice", `${result.invoice.invoiceNo} was created as a draft. Stock and payments are not posted until you complete the sale.`);
      setDetail(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      router.push(`/sales/invoices/${result.invoice.id}/edit`);
    } catch (err) {
      toastError("Could not convert quotation", normalizeError(err).userMessage);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!business || !user || !deleting) return;
    setBusyId(deleting.id);
    try {
      await getClientServices().transactions.deleteQuotation(business.id, user.id, deleting.id);
      toastSuccess("Quotation deleted", `${deleting.quotationNo} was deleted.`);
      setDeleting(null);
      setDetail(null);
      await refresh();
    } catch (err) {
      toastError("Could not delete quotation", normalizeError(err).userMessage);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <LoadingState label="Loading quotations…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load quotations"
      />
    );
  }

  const printModel = (quotation: Quotation) =>
    quotationPrintModel(quotation, { settings: quotationDefaults ?? DEFAULT_QUOTATION });

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Formal proposals and product or service quotes. They never post sales, stock or finance."
        actions={
          <Button onClick={() => router.push("/sales/quotations/new")}>
            <Plus className="size-4" />
            New quotation
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search quotations…"
            className="w-full max-w-sm"
            aria-label="Search quotations"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "quotation" : "quotations"}
          </span>
        </div>

        {!quotations || quotations.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No quotations yet"
            description="Create a formal proposal or a product quotation. Converting later uses the existing sales invoice."
            action={{ label: "New quotation", onClick: () => router.push("/sales/quotations/new") }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((quotation) => (
                  <TableRow key={quotation.id}>
                    <TableCell className="font-medium text-foreground">
                      {quotation.quotationNo}
                      <p className="text-xs text-muted-foreground">
                        {quotation.partyName} · {QUOTATION_FORMAT_META[quotation.format].label}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(quotation.quotationDate)}
                      {quotation.validUntil ? (
                        <p className="text-xs">Valid {formatDate(quotation.validUntil)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(quotation.total, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[quotation.status]}>{quotation.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {quotation.status === "draft" || quotation.status === "sent" || quotation.status === "accepted" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/sales/quotations/${quotation.id}/edit`)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                        ) : null}
                        {quotation.status === "sent" || quotation.status === "accepted" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busyId === quotation.id}
                            onClick={() => void convert(quotation)}
                          >
                            <CheckCircle2 className="size-4" />
                            Invoice
                          </Button>
                        ) : null}
                        {quotation.status === "draft" || quotation.status === "sent" || quotation.status === "accepted" ? (
                          <Button variant="outline" size="sm" onClick={() => setDeleting(quotation)}>
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        ) : null}
                        {business ? (
                          <QuotationPrintActions
                            business={business}
                            invoiceDefaults={invoiceDefaults ?? DEFAULT_INVOICE}
                            model={printModel(quotation)}
                            currency={business.currency ?? "INR"}
                          />
                        ) : null}
                        <Button variant="outline" size="sm" onClick={() => setDetail(quotation)}>
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.quotationNo ?? "Quotation"}
        description={detail ? `${detail.partyName} · ${formatDate(detail.quotationDate)}` : undefined}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail.status === "draft" ? (
                <Button loading={busyId === detail.id} onClick={() => void setStatus(detail, "sent")}>
                  Mark sent
                </Button>
              ) : null}
              {detail.status === "sent" ? (
                <Button loading={busyId === detail.id} onClick={() => void setStatus(detail, "accepted")}>
                  Accept
                </Button>
              ) : null}
              {detail.status === "sent" || detail.status === "accepted" ? (
                <Button loading={busyId === detail.id} onClick={() => void convert(detail)}>
                  Convert to invoice
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Format:</span> {QUOTATION_FORMAT_META[detail.format].label}
            </p>
            <p>
              <span className="text-muted-foreground">Valid until:</span> {formatDate(detail.validUntil)}
            </p>
            <p>
              <span className="text-muted-foreground">Total:</span>{" "}
              {formatCurrency(detail.total, business?.currency ?? "INR")}
            </p>
            {detail.convertedSalesInvoiceId ? (
              <p className="text-muted-foreground">Converted to a sales invoice. Stock and finance posted only on that invoice.</p>
            ) : null}
            {business ? (
              <QuotationPrintActions
                business={business}
                invoiceDefaults={invoiceDefaults ?? DEFAULT_INVOICE}
                model={printModel(detail)}
                currency={business.currency ?? "INR"}
              />
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete quotation"
        description={deleting ? `Delete ${deleting.quotationNo}? This does not affect invoices.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={Boolean(busyId)} onClick={() => void remove()}>
              <XCircle className="size-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Quotations never posted stock or payments, so deleting one only removes the offer.</p>
      </Modal>
    </div>
  );
}
