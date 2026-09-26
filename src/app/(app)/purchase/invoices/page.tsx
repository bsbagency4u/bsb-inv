"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Plus, Receipt } from "lucide-react";
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
import type { PurchaseInvoice } from "@/types/domain";

function statusVariant(status: string): "success" | "info" | "warning" | "secondary" {
  if (status === "paid") return "success";
  if (status === "unpaid") return "warning";
  if (status === "draft") return "secondary";
  return "info";
}

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [paying, setPaying] = React.useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMode, setPayMode] = React.useState("cash");
  const [paySaving, setPaySaving] = React.useState(false);
  const [completingId, setCompletingId] = React.useState<string | null>(null);

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

  const { data: paymentModes } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: purchaseDefaults } = useQuery({
    queryKey: ["purchase-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getPurchaseDefaults(business.id);
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

  const openCreate = () => router.push("/purchase/invoices/new");

  const openPay = (invoice: PurchaseInvoice) => {
    setPaying(invoice);
    setPayAmount(String(invoice.total - invoice.paidAmount));
    setPayMode("cash");
  };

  const completeDraft = async (invoice: PurchaseInvoice) => {
    if (!business || !user) return;
    setCompletingId(invoice.id);
    try {
      await getClientServices().transactions.completePurchaseInvoice(
        business.id,
        user.id,
        invoice.id,
        purchaseDefaults?.defaultWarehouseId ?? null
      );
      toastSuccess("Bill received", `${invoice.billNo} was completed and stock updated.`);
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not complete bill", normalizeError(err).userMessage);
    } finally {
      setCompletingId(null);
    }
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
          <Button onClick={openCreate}>
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
            action={{ label: "Record purchase", onClick: openCreate }}
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
                      <Badge variant={statusVariant(invoice.status)}>
                        {invoice.status}
                        {invoice.status !== "paid" && invoice.status !== "draft" && invoice.paidAmount > 0
                          ? ` · paid ${formatCurrency(invoice.paidAmount, business?.currency ?? "INR")}`
                          : ""}
                      </Badge>
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
                            Receive
                          </Button>
                        ) : null}
                        {invoice.status !== "paid" && invoice.status !== "draft" ? (
                          <Button variant="outline" size="sm" onClick={() => openPay(invoice)}>
                            <Banknote className="size-4" />
                            Pay
                          </Button>
                        ) : null}
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
