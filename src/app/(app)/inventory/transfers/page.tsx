"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Repeat } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";

export default function StockTransfersPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [fromWarehouseId, setFromWarehouseId] = React.useState("");
  const [toWarehouseId, setToWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { data: products, isLoading, isError, error, refetch } = useQuery({
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

  const { data: movements } = useQuery({
    queryKey: ["stock-movements", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listMovements(business.id, undefined, 200);
    },
    enabled: Boolean(business),
  });

  const transfers = React.useMemo(() => {
    const rows = (movements ?? []).filter(
      (movement) =>
        movement.movementType === "TRANSFER_IN" || movement.movementType === "TRANSFER_OUT"
    );
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((movement) => {
      const product = products?.find((p) => p.id === movement.productId);
      return (
        (product?.name ?? "").toLowerCase().includes(q) ||
        (product?.sku ?? "").toLowerCase().includes(q) ||
        (movement.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [movements, products, search]);

  const resetForm = () => {
    setProductId(products?.[0]?.id ?? "");
    setQuantity("");
    setFromWarehouseId(warehouses?.[0]?.id ?? "");
    setToWarehouseId(warehouses?.[1]?.id ?? warehouses?.[0]?.id ?? "");
    setNotes("");
  };

  const openForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const submit = async () => {
    if (!business || !user) return;
    const qty = Number(quantity);
    if (!productId) {
      toastError("Missing product", "Choose a product to transfer.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toastError("Invalid quantity", "Enter a positive transfer quantity.");
      return;
    }
    if (!fromWarehouseId || !toWarehouseId) {
      toastError("Warehouses required", "Choose source and destination warehouses.");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().inventory.transferStock(business.id, user.id, {
        productId,
        quantity: qty,
        fromWarehouseId,
        toWarehouseId,
        notes: notes || null,
      });
      toastSuccess("Stock transferred", "Transfer movements were recorded.");
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not transfer stock", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading transfers…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load transfers"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        description="Move stock between warehouses. Each transfer writes a matched pair of ledger movements."
        actions={
          <Button onClick={openForm}>
            <Repeat className="size-4" />
            New transfer
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search transfers…"
            className="w-full max-w-sm"
            aria-label="Search transfers"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {transfers.length} {transfers.length === 1 ? "movement" : "movements"}
          </span>
        </div>

        {transfers.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="size-6" />}
            title="No transfers yet"
            description="Transfer stock between warehouses. You need at least two warehouses."
            action={{ label: "New transfer", onClick: openForm }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((movement) => {
                  const product = products?.find((p) => p.id === movement.productId);
                  const warehouse = warehouses?.find((w) => w.id === movement.warehouseId);
                  const outbound = movement.movementType === "TRANSFER_OUT";
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(movement.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {product?.name ?? movement.productId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={outbound ? "warning" : "success"}>
                          {outbound ? "Out" : "In"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {warehouse?.name ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {movement.change > 0 ? "+" : ""}
                        {movement.change}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Transfer stock"
        description="Source and destination warehouses must differ."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Product" htmlFor="transfer-product" required>
            <Select
              id="transfer-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Select product</option>
              {(products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.stockQuantity})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="transfer-qty" required>
            <Input
              id="transfer-qty"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="From warehouse" htmlFor="transfer-from" required>
            <Select
              id="transfer-from"
              value={fromWarehouseId}
              onChange={(event) => setFromWarehouseId(event.target.value)}
            >
              <option value="">Select source</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To warehouse" htmlFor="transfer-to" required>
            <Select
              id="transfer-to"
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
            >
              <option value="">Select destination</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="transfer-notes">
            <Textarea
              id="transfer-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional reason or reference"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
