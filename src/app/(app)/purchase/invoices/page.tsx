"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, Receipt } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PurchaseInvoice } from "@/types/domain";

export default function PurchaseInvoicesPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [paying, setPaying] = React.useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMode, setPayMode] = React.useState("cash");
  const [paySaving, setPaySaving] = React.useState(false);

  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState<string | null>(null);
  const [intraState, setIntraState] = React.useState(true);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState<string | null>(null);

  const { data: invoices, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-invoices", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPurchaseInvoices(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listSuppliers(business.id);
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

  const { data: paymentModes } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!invoices) return [];
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (invoice) => invoice.billNo.toLowerCase().includes(q) || invoice.status.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  if (isLoading) return <LoadingState label="Loading purchase invoices…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load purchase invoices"
      />
    );
  }

  const resetForm = () => {
    setSupplierId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate(null);
    setIntraState(true);
    setLines([]);
    setNotes(null);
  };

  const createInvoice = async () => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("No items", "Add at least one line item to record a bill.");
      return;
    }
    setSaving(true);
    try {
      const services = getClientServices();
      const billNo = await services.transactions.nextDocumentNo(
        business.id,
        "BILL",
        "purchase_invoice"
      );
      await services.transactions.createPurchaseInvoice(business.id, user.id, billNo, {
        supplierId,
        invoiceDate: date,
        dueDate,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstRate: line.gstRate,
        })),
        intraState,
      });
      toastSuccess("Purchase recorded", `Bill ${billNo} was saved and stock updated.`);
      setCreateOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not record purchase", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const openPay = (invoice: PurchaseInvoice) => {
    setPaying(invoice);
    setPayAmount(String(invoice.total - invoice.paidAmount));
    setPayMode("cash");
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
        direction: "out",
        partyType: "supplier",
        partyId: paying.supplierId,
        purchaseInvoiceId: paying.id,
        amount,
        mode: payMode,
      });
      toastSuccess("Payment recorded", "The supplier payment was recorded.");
      setPaying(null);
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not record payment", normalizeError(err).userMessage);
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase Invoices"
        description="Bills received from suppliers."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            Record purchase
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search bills…"
            className="w-full max-w-sm"
            aria-label="Search bills"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "bill" : "bills"}
          </span>
        </div>

        {!invoices || invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No purchase invoices yet"
            description="Record a supplier bill to bring stock into the business."
            action={{ label: "Record purchase", onClick: () => { resetForm(); setCreateOpen(true); } }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
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
                      {invoice.billNo}
                      {invoice.supplierId ? (
                        <p className="text-xs text-muted-foreground">
                          {suppliers?.find((s) => s.id === invoice.supplierId)?.name ?? "Supplier"}
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
                      <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "unpaid" ? "warning" : "info"}>
                        {invoice.status}
                        {invoice.status !== "paid" && invoice.paidAmount > 0
                          ? ` · paid ${formatCurrency(invoice.paidAmount, business?.currency ?? "INR")}`
                          : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.status !== "paid" ? (
                        <Button variant="outline" size="sm" onClick={() => openPay(invoice)}>
                          <Banknote className="size-4" />
                          Pay
                        </Button>
                      ) : null}
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
        title="Record purchase"
        description="Enter the supplier bill; stock increases automatically."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createInvoice()} loading={saving}>
              Save bill
            </Button>
          </>
        }
      >
        <TransactionBuilder
          currency={business?.currency ?? "INR"}
          products={products ?? []}
          partyType="supplier"
          parties={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name, gstin: s.gstin }))}
          partyLabel="Supplier"
          partyValue={supplierId}
          onPartyChange={setSupplierId}
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
      </Modal>

      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={paying ? `Pay supplier: ${paying.billNo}` : "Pay supplier"}
        description="Record a payment against this purchase bill."
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
              Bill total:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(paying.total, business?.currency ?? "INR")}
              </span>
              {" · "}Paid: {formatCurrency(paying.paidAmount, business?.currency ?? "INR")}
              {" · "}Due:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(Math.max(0, paying.total - paying.paidAmount), business?.currency ?? "INR")}
              </span>
            </div>
            <Field label="Amount" htmlFor="pay-amount" required>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min={0}
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Payment mode" htmlFor="pay-mode">
              <Select
                id="pay-mode"
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
