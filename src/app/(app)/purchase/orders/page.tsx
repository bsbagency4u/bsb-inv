"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, ShoppingBag } from "lucide-react";
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
import type { PurchaseOrder } from "@/types/domain";

interface ReceiveLine {
  productId: string;
  quantity: string;
  unitCost: string;
}

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

  const [receiving, setReceiving] = React.useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = React.useState<ReceiveLine[]>([]);
  const [receiveWarehouse, setReceiveWarehouse] = React.useState<string>("");
  const [receiveSaving, setReceiveSaving] = React.useState(false);

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

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listWarehouses(business.id);
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

  const openReceive = (order: PurchaseOrder) => {
    setReceiving(order);
    setReceiveLines(
      order.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitCost: String(item.unitPrice),
      }))
    );
    setReceiveWarehouse(order.warehouseId ?? "");
  };

  const receiveUpdateLine = (index: number, patch: Partial<ReceiveLine>) => {
    setReceiveLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  };

  const submitReceiving = async () => {
    if (!business || !user || !receiving) return;
    setReceiveSaving(true);
    try {
      const services = getClientServices();
      const receiptNo = await services.transactions.nextDocumentNo(
        business.id,
        "RCT",
        "purchase_order"
      );
      await services.transactions.createPurchaseReceipt(business.id, user.id, receiptNo, {
        purchaseOrderId: receiving.id,
        warehouseId: receiveWarehouse || null,
        notes: null,
        items: receiveLines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity) || 0,
          unitCost: Number(line.unitCost) || 0,
        })),
      });
      toastSuccess("Goods received", `${receiptNo} recorded and stock increased.`);
      setReceiving(null);
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not receive goods", normalizeError(err).userMessage);
    } finally {
      setReceiveSaving(false);
    }
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
        "purchase_order"
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReceive(order)}
                      >
                        <PackageCheck className="size-4" />
                        Receive
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

      <Modal
        open={Boolean(receiving)}
        onClose={() => setReceiving(null)}
        title={receiving ? `Receive goods: ${receiving.orderNo}` : "Receive goods"}
        description="Enter the quantities actually received; only these enter stock."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setReceiving(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitReceiving()} loading={receiveSaving}>
              Receive goods
            </Button>
          </>
        }
      >
        {receiving ? (
          <div className="space-y-4">
            <Field label="Warehouse" htmlFor="receive-warehouse">
              <Select
                id="receive-warehouse"
                value={receiveWarehouse}
                onChange={(event) => setReceiveWarehouse(event.target.value)}
              >
                <option value="">Unassigned</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24 text-right">Ordered</TableHead>
                    <TableHead className="w-24 text-right">Received</TableHead>
                    <TableHead className="w-32 text-right">Unit cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiveLines.map((line, index) => {
                    const product = products?.find((p) => p.id === line.productId);
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-foreground">
                          {product?.name ?? line.productId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {receiving.items[index]?.quantity ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={line.quantity}
                            onChange={(event) =>
                              receiveUpdateLine(index, { quantity: event.target.value })
                            }
                            className="h-8 text-right"
                            aria-label="Received quantity"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.unitCost}
                            onChange={(event) =>
                              receiveUpdateLine(index, { unitCost: event.target.value })
                            }
                            className="h-8 text-right"
                            aria-label="Unit cost"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
