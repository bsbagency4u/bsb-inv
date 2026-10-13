"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, XCircle } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentVoucherForm } from "@/components/payments/payment-voucher-form";
import { DocumentPrintActions } from "@/components/documents/document-print-actions";
import { customerContact, paymentReceiptPrintModel, supplierContact } from "@/lib/document-print-models";
import { DEFAULT_INVOICE } from "@/lib/invoice-settings";
import { allocatedAmount, unallocatedAmount } from "@/lib/party-ledger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payment } from "@/types/domain";

function queryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function initialVoucherState() {
  const direction = queryParam("direction");
  const partyId = queryParam("partyId");
  const hasDirection = direction === "in" || direction === "out";
  return {
    tab: hasDirection || partyId ? "new" : "list",
    direction: (hasDirection ? direction : "in") as "in" | "out",
    partyId,
  };
}

export default function PaymentsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const initial = React.useMemo(() => initialVoucherState(), []);
  const [tab, setTab] = React.useState(initial.tab);
  const [search, setSearch] = React.useState("");
  const [directionFilter, setDirectionFilter] = React.useState("all");
  const [cancelling, setCancelling] = React.useState<Payment | null>(null);
  const [cancelSaving, setCancelSaving] = React.useState(false);

  const paymentsQuery = useQuery({
    queryKey: ["payments", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPayments(business.id);
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

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listSuppliers(business.id);
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

  const partyName = React.useCallback(
    (payment: Payment) => {
      if (payment.partyType === "customer") {
        return customers?.find((item) => item.id === payment.partyId)?.name ?? "Customer";
      }
      return suppliers?.find((item) => item.id === payment.partyId)?.name ?? "Supplier";
    },
    [customers, suppliers]
  );

  const filtered = React.useMemo(() => {
    const rows = [...(paymentsQuery.data ?? [])].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt));
    const q = search.trim().toLowerCase();
    return rows.filter((payment) => {
      if (directionFilter !== "all" && payment.direction !== directionFilter) return false;
      if (!q) return true;
      const name = partyName(payment).toLowerCase();
      return (
        (payment.documentNo ?? "").toLowerCase().includes(q) ||
        name.includes(q) ||
        (payment.reference ?? "").toLowerCase().includes(q) ||
        payment.mode.toLowerCase().includes(q)
      );
    });
  }, [paymentsQuery.data, search, directionFilter, partyName]);

  const cancelPayment = async () => {
    if (!business || !user || !cancelling) return;
    setCancelSaving(true);
    try {
      await getClientServices().transactions.cancelPayment(business.id, user.id, cancelling.id);
      toastSuccess("Payment cancelled", "The voucher remains in history and no longer counts toward outstanding.");
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["outstanding"] });
      await queryClient.invalidateQueries({ queryKey: ["party-ledger"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not cancel payment", normalizeError(err).userMessage);
    } finally {
      setCancelSaving(false);
    }
  };

  if (paymentsQuery.isLoading) return <LoadingState label="Loading payments…" />;
  if (paymentsQuery.isError) {
    return (
      <ErrorState
        error={normalizeError(paymentsQuery.error).userMessage}
        onRetry={() => paymentsQuery.refetch()}
        title="Could not load payments"
      />
    );
  }

  const currency = business?.currency ?? "INR";

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Receipts, supplier payments, advances and allocations."
        actions={
          <Button onClick={() => setTab("new")}>
            <Plus className="size-4" />
            New voucher
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          tabs={[
            { value: "list", label: "Vouchers" },
            { value: "new", label: "New voucher" },
          ]}
          value={tab}
          onValueChange={setTab}
        />

        {tab === "new" ? (
          <PaymentVoucherForm
            initialDirection={initial.direction}
            initialPartyId={initial.partyId}
            onSaved={() => setTab("list")}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search vouchers…"
                className="w-full max-w-sm"
                aria-label="Search payments"
              />
              <div className="w-40">
                <Select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="in">Receipts</option>
                  <option value="out">Payments</option>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-6" />}
                title="No payments yet"
                description="Record a customer receipt or supplier payment. Surplus amounts stay as unallocated advances."
                action={{ label: "New voucher", onClick: () => setTab("new") }}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Unallocated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((payment) => {
                      const name = partyName(payment);
                      const contact =
                        payment.partyType === "customer"
                          ? customerContact(customers?.find((item) => item.id === payment.partyId))
                          : supplierContact(suppliers?.find((item) => item.id === payment.partyId));
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium text-foreground">
                            {payment.documentNo ?? payment.id.slice(0, 8)}
                            <p className="text-xs text-muted-foreground">
                              {payment.direction === "in" ? "Receipt" : "Payment"} · {payment.mode}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(payment.amount, currency)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatCurrency(unallocatedAmount(payment), currency)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "cancelled"
                                  ? "destructive"
                                  : allocatedAmount(payment) === 0
                                    ? "info"
                                    : "success"
                              }
                            >
                              {payment.status === "cancelled"
                                ? "cancelled"
                                : allocatedAmount(payment) === 0
                                  ? "advance"
                                  : "posted"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {business ? (
                                <DocumentPrintActions
                                  business={business}
                                  defaults={invoiceDefaults ?? DEFAULT_INVOICE}
                                  model={paymentReceiptPrintModel(payment, { partyLabel: name, ...contact })}
                                  currency={currency}
                                  size="sm"
                                />
                              ) : null}
                              {payment.status !== "cancelled" ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setCancelling(payment)}
                                  aria-label="Cancel payment"
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel payment"
        description={cancelling ? `Cancel ${cancelling.documentNo ?? cancelling.id.slice(0, 8)}?` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep
            </Button>
            <Button variant="destructive" loading={cancelSaving} onClick={() => void cancelPayment()}>
              Cancel voucher
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          The voucher stays in history and stops counting toward outstanding. Invoice paid amounts are recalculated.
        </p>
      </Modal>
    </div>
  );
}
