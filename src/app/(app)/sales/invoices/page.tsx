"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, XCircle } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionBuilder, type CartLine } from "@/components/transactions/transaction-builder";
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
  finalized: "info",
  paid: "success",
  partial: "warning",
  cancelled: "destructive",
};

export default function SalesInvoicesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<SalesInvoice | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState<string | null>(null);
  const [intraState, setIntraState] = React.useState(true);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState<string | null>(null);
  const [paymentMode, setPaymentMode] = React.useState<string>("cash");

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

  const { data: products } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!invoices) return [];
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (invoice) =>
        invoice.invoiceNo.toLowerCase().includes(q) ||
        invoice.status.toLowerCase().includes(q)
    );
  }, [invoices, search]);

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

  const resetForm = () => {
    setCustomerId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate(null);
    setIntraState(true);
    setLines([]);
    setNotes(null);
    setPaymentMode("cash");
  };

  const createInvoice = async () => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("No items", "Add at least one line item to create an invoice.");
      return;
    }
    setSaving(true);
    try {
      const services = getClientServices();
      const invoiceNo = await services.transactions.nextDocumentNo(
        business.id,
        business.invoicePrefix || "INV",
        business.invoiceStartNumber ?? 1001,
        "sales"
      );
      await services.transactions.createSalesInvoice(business.id, user.id, invoiceNo, {
        customerId,
        invoiceDate: date,
        dueDate,
        paymentMode,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstRate: line.gstRate,
        })),
        intraState,
      });
      toastSuccess("Invoice created", `Invoice ${invoiceNo} was saved.`);
      setCreateOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not create invoice", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const cancelInvoice = async (invoice: SalesInvoice) => {
    if (!business || !user) return;
    try {
      await getClientServices().transactions.cancelSalesInvoice(business.id, user.id, invoice.id);
      toastSuccess("Invoice cancelled", `${invoice.invoiceNo} was cancelled and stock restored.`);
      setDetail(null);
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not cancel invoice", normalizeError(err).userMessage);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales Invoices"
        description="GST invoices raised against sales."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
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
            action={{ label: "New invoice", onClick: () => { resetForm(); setCreateOpen(true); } }}
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
                      {invoice.customerId ? (
                        <p className="text-xs text-muted-foreground">
                          {customers?.find((c) => c.id === invoice.customerId)?.name ?? "Customer"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(invoice.total, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[invoice.status]}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setDetail(invoice)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New sales invoice"
        description="Add line items; GST is computed automatically."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createInvoice()} loading={saving}>
              Create invoice
            </Button>
          </>
        }
      >
        <TransactionBuilder
          currency={business?.currency ?? "INR"}
          products={products ?? []}
          partyType="customer"
          parties={(customers ?? []).map((c) => ({ id: c.id, name: c.name, gstin: c.gstin }))}
          partyLabel="Customer"
          partyValue={customerId}
          onPartyChange={setCustomerId}
          intraState={intraState}
          onIntraStateChange={setIntraState}
          lines={lines}
          onLinesChange={setLines}
          notes={notes}
          onNotesChange={setNotes}
          date={date}
          onDateChange={setDate}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          showDueDate
        />
        <Field label="Payment mode" htmlFor="invoice-mode" className="mt-4">
          <Select
            id="invoice-mode"
            value={paymentMode}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            {["cash", "card", "upi", "bank transfer", "credit"].map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.invoiceNo ?? "Invoice"}
        description={detail ? `Created ${formatDate(detail.invoiceDate)}` : undefined}
        size="lg"
        footer={
          detail && detail.status !== "cancelled" ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => void cancelInvoice(detail)}
              >
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
        {detail ? <InvoiceDetail invoice={detail} currency={business?.currency ?? "INR"} /> : null}
      </Modal>
    </div>
  );
}

function InvoiceDetail({ invoice, currency }: { invoice: SalesInvoice; currency: string }) {
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
          <p className="text-sm font-semibold text-foreground">
            {invoice.customerId ?? "Walk-in customer"}
          </p>
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
                <TableCell className="font-medium text-foreground">
                  {item.productId}
                </TableCell>
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
      </div>
      {invoice.notes ? (
        <p className="text-sm text-muted-foreground">{invoice.notes}</p>
      ) : null}
    </div>
  );
}
