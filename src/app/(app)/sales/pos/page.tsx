"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionBuilder, type CartLine } from "@/components/transactions/transaction-builder";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";

export default function PosPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [showBuilder, setShowBuilder] = React.useState(false);

  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [intraState, setIntraState] = React.useState(true);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState<string | null>(null);
  const [paymentMode, setPaymentMode] = React.useState<string>("cash");

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const checkout = async () => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("Empty cart", "Add at least one product to checkout.");
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
      const { totals } = await services.transactions.createSalesInvoice(
        business.id,
        user.id,
        invoiceNo,
        {
          customerId,
          invoiceDate: date,
          paymentMode,
          notes,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            gstRate: line.gstRate,
          })),
          intraState,
        }
      );
      toastSuccess(
        "Sale completed",
        `${invoiceNo} for ${totals.total.toFixed(2)} ${business.currency} was recorded.`
      );
      setLines([]);
      setCustomerId(null);
      setNotes(null);
      setShowBuilder(false);
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not complete sale", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading point of sale…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load the POS"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        description="Record a sale quickly with automatic GST."
        actions={
          <Button onClick={() => setShowBuilder(true)}>
            <ShoppingCart className="size-4" />
            Open register
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {!products || products.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="size-6" />}
            title="No products to sell"
            description="Add products to the catalogue before using the register."
            action={{ label: "Add products", href: "/inventory/products" }}
          />
        ) : (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap gap-3">
                <Field label="Payment mode">
                  <Select
                    value={paymentMode}
                    onChange={(event) => setPaymentMode(event.target.value)}
                    className="min-w-40"
                  >
                    {["cash", "card", "upi", "bank transfer", "credit"].map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tax treatment">
                  <Select
                    value={intraState ? "intra" : "inter"}
                    onChange={(event) => setIntraState(event.target.value === "intra")}
                    className="min-w-56"
                  >
                    <option value="intra">Intra-state (CGST + SGST)</option>
                    <option value="inter">Inter-state (IGST)</option>
                  </Select>
                </Field>
              </div>

              <TransactionBuilder
                currency={business?.currency ?? "INR"}
                products={products}
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
                dueDate={null}
                onDueDateChange={() => {}}
              />

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLines([]);
                    setCustomerId(null);
                  }}
                >
                  Clear cart
                </Button>
                <Button onClick={() => void checkout()} loading={saving} size="lg">
                  Complete sale
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        title="Register"
        description="Add items to the cart, then complete the sale."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              Cancel
            </Button>
            <Button onClick={() => void checkout()} loading={saving}>
              Complete sale
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
          dueDate={null}
          onDueDateChange={() => {}}
        />
      </Modal>
    </div>
  );
}
