"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, FileText, Plus, XCircle } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SalesInvoice, SalesInvoiceStatus } from "@/types/domain";

const STATUS_VARIANTS: Record<SalesInvoiceStatus, "success" | "info" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  completed: "info",
  paid: "success",
  partial: "warning",
  cancelled: "destructive",
  returned: "secondary",
};

function walkInNameFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/^Walk-in:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<SalesInvoice | null>(null);
  const [paying, setPaying] = React.useState<SalesInvoice | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMode, setPayMode] = React.useState("cash");
  const [paySaving, setPaySaving] = React.useState(false);
  const [completingId, setCompletingId] = React.useState<string | null>(null);

  const { data: invoices, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sales-invoices", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listSalesInvoices(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: paymentModes } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: salesDefaults } = useQuery({
    queryKey: ["sales-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getSalesDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!invoices) return [];
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((invoice) => {
      const customerName = invoice.customerId
        ? customers?.find((c) => c.id === invoice.customerId)?.name ?? ""
        : walkInNameFromNotes(invoice.notes) ?? "walk-in";
      return (
        invoice.invoiceNo.toLowerCase().includes(q) ||
        invoice.status.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, customers]);

  if (isLoading) return <LoadingState label="Loading invoices…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load invoices"
      />
    );
  }

  const openCreate = () => router.push("/sales/invoices/new");

  const cancelInvoice = async (invoice: SalesInvoice) => {
    if (!business || !user) return;
    try {
      await getClientServices().transactions.cancelSalesInvoice(business.id, user.id, invoice.id);
      toastSuccess(
        "Invoice cancelled",
        invoice.status === "draft"
          ? `${invoice.invoiceNo} was cancelled. Stock was not changed.`
          : `${invoice.invoiceNo} was cancelled and stock restored.`
      );
      setDetail(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not cancel invoice", normalizeError(err).userMessage);
    }
  };

  const completeDraft = async (invoice: SalesInvoice) => {
    if (!business || !user) return;
    setCompletingId(invoice.id);
    try {
      await getClientServices().transactions.completeSalesInvoice(business.id, user.id, invoice.id);
      toastSuccess("Sale completed", `${invoice.invoiceNo} was completed and stock updated.`);
      setDetail(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not complete sale", normalizeError(err).userMessage);
    } finally {
      setCompletingId(null);
    }
  };

  const openPay = (invoice: SalesInvoice) => {
    setPaying(invoice);
    setPayAmount(String(invoice.total - invoice.paidAmount));
    setPayMode(salesDefaults?.defaultPaymentMode ?? "cash");
  };

  const submitPayment = async () => {
    if (!business || !user || !paying) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toastError("Invalid amount", "Enter a positive payment amount.");
      return;
    }
    setPaySaving(true);
    try {
      await getClientServices().transactions.createPayment(business.id, user.id, {
        direction: "in",
        partyType: "customer",
        partyId: paying.customerId,
        salesInvoiceId: paying.id,
        amount,
        mode: payMode,
      });
      toastSuccess("Payment recorded", "The customer payment was recorded.");
      setPaying(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not record payment", normalizeError(err).userMessage);
    } finally {
      setPaySaving(false);
    }
  };

  const partyLabel = (invoice: SalesInvoice) => {
    if (invoice.customerId) {
      return customers?.find((c) => c.id === invoice.customerId)?.name ?? "Customer";
    }
    return walkInNameFromNotes(invoice.notes) ?? "Walk-in customer";
  };

  return (
    <div>
      <PageHeader
        title="Sales Invoices"
        description="GST invoices raised against sales."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New invoice
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search invoices…"
            className="w-full max-w-sm"
            aria-label="Search invoices"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>

        {!invoices || invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No invoices yet"
            description="Create your first sales invoice to record a sale with GST."
            action={{ label: "New invoice", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium text-foreground">
                      {invoice.invoiceNo}
                      <p className="text-xs text-muted-foreground">{partyLabel(invoice)}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(invoice.total, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[invoice.status]}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.status === "draft" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void completeDraft(invoice)}
                            loading={completingId === invoice.id}
                          >
                            <CheckCircle2 className="size-4" />
                            Complete
                          </Button>
                        ) : null}
                        {invoice.status !== "paid" && invoice.status !== "draft" && invoice.status !== "cancelled" ? (
                          <Button variant="outline" size="sm" onClick={() => openPay(invoice)}>
                            <Banknote className="size-4" />
                            Pay
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" onClick={() => setDetail(invoice)}>
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
        title={detail?.invoiceNo ?? "Invoice"}
        description={detail ? `Created ${formatDate(detail.invoiceDate)}` : undefined}
        size="lg"
        footer={
          detail && detail.status !== "cancelled" && detail.status !== "returned" ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail.status === "draft" ? (
                <Button
                  onClick={() => void completeDraft(detail)}
                  loading={completingId === detail.id}
                >
                  <CheckCircle2 className="size-4" />
                  Complete sale
                </Button>
              ) : detail.status !== "paid" ? (
                <Button variant="outline" onClick={() => openPay(detail)}>
                  <Banknote className="size-4" />
                  Record payment
                </Button>
              ) : null}
              <Button variant="destructive" onClick={() => void cancelInvoice(detail)}>
                <XCircle className="size-4" />
                Cancel invoice
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          )
        }
      >
        {detail ? (
          <InvoiceDetail invoice={detail} currency={business?.currency ?? "INR"} partyLabel={partyLabel(detail)} />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={paying ? `Record payment: ${paying.invoiceNo}` : "Record payment"}
        description="Record a customer payment against this invoice."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitPayment()} loading={paySaving}>
              Record payment
            </Button>
          </>
        }
      >
        {paying ? (
          <div className="space-y-4">
            <div className="rounded-md bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
              Invoice total:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(paying.total, business?.currency ?? "INR")}
              </span>
              {" · "}Paid: {formatCurrency(paying.paidAmount, business?.currency ?? "INR")}
              {" · "}Due:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(Math.max(0, paying.total - paying.paidAmount), business?.currency ?? "INR")}
              </span>
            </div>
            <Field label="Amount" htmlFor="spay-amount" required>
              <Input
                id="spay-amount"
                type="number"
                step="0.01"
                min={0}
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Payment mode" htmlFor="spay-mode">
              <Select
                id="spay-mode"
                value={payMode}
                onChange={(event) => setPayMode(event.target.value)}
              >
                {(paymentModes ?? []).map((mode) => (
                  <option key={mode.id} value={mode.code}>
                    {mode.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function InvoiceDetail({
  invoice,
  currency,
  partyLabel,
}: {
  invoice: SalesInvoice;
  currency: string;
  partyLabel: string;
}) {
  const customerLabel = invoice.customerId ? "Customer" : "Walk-in";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Badge variant={STATUS_VARIANTS[invoice.status]}>{invoice.status}</Badge>
          {invoice.paymentMode ? (
            <p className="mt-1 text-xs text-muted-foreground">Paid via {invoice.paymentMode}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{customerLabel}</p>
          <p className="text-sm font-semibold text-foreground">{partyLabel}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium text-foreground">{item.productId}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(item.unitPrice, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.gstRate}%</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(item.amount, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex w-52 justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(invoice.subtotal, currency)}</span>
        </div>
        {invoice.discount > 0 ? (
          <div className="flex w-52 justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="tabular-nums">{formatCurrency(invoice.discount, currency)}</span>
          </div>
        ) : null}
        <div className="flex w-52 justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span className="tabular-nums">{formatCurrency(invoice.taxTotal, currency)}</span>
        </div>
        <div className="flex w-52 justify-between border-t border-border pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(invoice.total, currency)}</span>
        </div>
        <div className="flex w-52 justify-between text-xs text-muted-foreground">
          <span>Paid</span>
          <span className="tabular-nums">{formatCurrency(invoice.paidAmount, currency)}</span>
        </div>
        <div className="flex w-52 justify-between text-xs">
          <span className="text-muted-foreground">Balance due</span>
          <span className="tabular-nums font-medium text-foreground">
            {formatCurrency(Math.max(0, invoice.total - invoice.paidAmount), currency)}
          </span>
        </div>
      </div>
      {invoice.notes ? <p className="text-sm text-muted-foreground">{invoice.notes}</p> : null}
    </div>
  );
}
