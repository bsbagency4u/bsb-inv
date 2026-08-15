"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingBag } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function PurchaseOrdersPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = React.useState<string | null>(null);
  const [intraState, setIntraState] = React.useState(true);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState<string | null>(null);

  const { data: orders, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-orders", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPurchaseOrders(business.id);
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

  const filtered = React.useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) => order.orderNo.toLowerCase().includes(q) || order.status.toLowerCase().includes(q)
    );
  }, [orders, search]);

  if (isLoading) return <LoadingState label="Loading purchase orders…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load purchase orders"
      />
    );
  }

  const resetForm = () => {
    setSupplierId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setExpectedDate(null);
    setIntraState(true);
    setLines([]);
    setNotes(null);
  };

  const createOrder = async () => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("No items", "Add at least one line item to create an order.");
      return;
    }
    setSaving(true);
    try {
      const services = getClientServices();
      const orderNo = await services.transactions.nextDocumentNo(
        business.id,
        "PO",
        1001,
        "purchase-order"
      );
      await services.transactions.createPurchaseOrder(business.id, user.id, orderNo, {
        supplierId,
        orderDate: date,
        expectedDate,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstRate: line.gstRate,
        })),
        intraState,
      });
      toastSuccess("Order created", `Purchase order ${orderNo} was saved.`);
      setCreateOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    } catch (err) {
      toastError("Could not create order", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Orders you have placed with suppliers."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            New order
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search orders…"
            className="w-full max-w-sm"
            aria-label="Search orders"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "order" : "orders"}
          </span>
        </div>

        {!orders || orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="size-6" />}
            title="No purchase orders yet"
            description="Create a purchase order to plan stock you want to buy."
            action={{ label: "New order", onClick: () => { resetForm(); setCreateOpen(true); } }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium text-foreground">
                      {order.orderNo}
                      {order.supplierId ? (
                        <p className="text-xs text-muted-foreground">
                          {suppliers?.find((s) => s.id === order.supplierId)?.name ?? "Supplier"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(order.orderDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.expectedDate ? formatDate(order.expectedDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.total, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status === "draft" ? "secondary" : "info"}>
                        {order.status}
                      </Badge>
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
        title="New purchase order"
        description="Draft an order; GST is computed automatically."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createOrder()} loading={saving}>
              Create order
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
          dueDate={expectedDate}
          onDueDateChange={setExpectedDate}
          showDueDate
        />
      </Modal>
    </div>
  );
}
