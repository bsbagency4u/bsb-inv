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
import type { StockTransfer, StockTransferStatus } from "@/types/domain";

const STATUS_LABEL: Record<StockTransferStatus, string> = {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  dispatched: "Dispatched",
  in_transit: "In transit",
  partially_received: "Partial",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<StockTransferStatus, "secondary" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  requested: "warning",
  approved: "warning",
  dispatched: "warning",
  in_transit: "warning",
  partially_received: "warning",
  completed: "success",
  cancelled: "destructive",
};

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
  const [active, setActive] = React.useState<StockTransfer | null>(null);
  const [receiveQty, setReceiveQty] = React.useState<Record<string, string>>({});
  const [shortageReason, setShortageReason] = React.useState("");
  const [acting, setActing] = React.useState(false);

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

  const { data: transfers } = useQuery({
    queryKey: ["stock-transfers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listTransfers(business.id);
    },
    enabled: Boolean(business),
  });

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = transfers ?? [];
    if (!q) return list;
    return list.filter((transfer) => {
      const from = warehouses?.find((w) => w.id === transfer.fromWarehouseId)?.name ?? "";
      const to = warehouses?.find((w) => w.id === transfer.toWarehouseId)?.name ?? "";
      return (
        transfer.transferNo.toLowerCase().includes(q) ||
        from.toLowerCase().includes(q) ||
        to.toLowerCase().includes(q) ||
        (transfer.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, transfers, warehouses]);

  const resetForm = () => {
    setProductId(products?.[0]?.id ?? "");
    setQuantity("");
    setFromWarehouseId(warehouses?.[0]?.id ?? "");
    setToWarehouseId(warehouses?.[1]?.id ?? warehouses?.[0]?.id ?? "");
    setNotes("");
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
      await getClientServices().inventory.requestTransfer(business.id, user.id, {
        fromWarehouseId,
        toWarehouseId,
        notes: notes || null,
        items: [{ productId, quantity: qty }],
      });
      toastSuccess("Transfer requested", "The transfer was saved.");
      setFormOpen(false);
      await invalidate();
    } catch (err) {
      toastError("Could not request transfer", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (!business || !user) return;
    setActing(true);
    try {
      await fn();
      toastSuccess(label, "The transfer was updated.");
      setActive(null);
      await invalidate();
    } catch (err) {
      toastError("Could not update transfer", normalizeError(err).userMessage);
    } finally {
      setActing(false);
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
        description="Request, dispatch and receive stock. Quantity leaves the source on dispatch and arrives on receive."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
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
            {rows.length} {rows.length === 1 ? "transfer" : "transfers"}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="size-6" />}
            title="No transfers yet"
            description="Transfer stock between warehouses. You need at least two warehouses."
            action={{
              label: "New transfer",
              onClick: () => {
                resetForm();
                setFormOpen(true);
              },
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((transfer) => {
                  const from = warehouses?.find((w) => w.id === transfer.fromWarehouseId);
                  const to = warehouses?.find((w) => w.id === transfer.toWarehouseId);
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-mono text-xs">{transfer.transferNo}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[transfer.status]}>{STATUS_LABEL[transfer.status]}</Badge>
                      </TableCell>
                      <TableCell>{from?.name ?? transfer.fromWarehouseId}</TableCell>
                      <TableCell>{to?.name ?? transfer.toWarehouseId}</TableCell>
                      <TableCell className="text-right tabular-nums">{transfer.items.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(transfer.requestedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActive(transfer);
                            setShortageReason(transfer.shortageReason ?? "");
                            setReceiveQty(
                              Object.fromEntries(
                                transfer.items.map((item) => [
                                  item.id,
                                  String(Math.max(0, item.dispatchedQuantity - item.receivedQuantity)),
                                ])
                              )
                            );
                          }}
                        >
                          Open
                        </Button>
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
        title="Request transfer"
        description="Source and destination warehouses must differ. Stock leaves the source only when dispatched."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Request transfer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Product" htmlFor="transfer-product" required>
            <Select id="transfer-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
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
            <Select id="transfer-from" value={fromWarehouseId} onChange={(event) => setFromWarehouseId(event.target.value)}>
              <option value="">Select source</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To warehouse" htmlFor="transfer-to" required>
            <Select id="transfer-to" value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)}>
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

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Transfer ${active.transferNo}` : "Transfer"}
        description="Dispatch removes stock from the source. Receive posts it at the destination."
        size="lg"
        footer={
          active ? (
            <>
              <Button variant="outline" onClick={() => setActive(null)}>
                Close
              </Button>
              {active.status === "requested" || active.status === "draft" || active.status === "approved" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    void runAction("Transfer cancelled", () =>
                      getClientServices().inventory.cancelTransfer(business!.id, user!.id, active.id)
                    )
                  }
                  loading={acting}
                >
                  Cancel
                </Button>
              ) : null}
              {active.status === "requested" || active.status === "draft" ? (
                <Button
                  onClick={() =>
                    void runAction("Transfer approved", () =>
                      getClientServices().inventory.approveTransfer(business!.id, user!.id, active.id)
                    )
                  }
                  loading={acting}
                >
                  Approve
                </Button>
              ) : null}
              {active.status === "approved" || active.status === "requested" || active.status === "draft" ? (
                <Button
                  onClick={() =>
                    void runAction("Transfer dispatched", () =>
                      getClientServices().inventory.dispatchTransfer(business!.id, user!.id, active.id)
                    )
                  }
                  loading={acting}
                >
                  Dispatch
                </Button>
              ) : null}
              {active.status === "in_transit" || active.status === "dispatched" || active.status === "partially_received" ? (
                <Button
                  onClick={() =>
                    void runAction("Transfer received", () =>
                      getClientServices().inventory.receiveTransfer(business!.id, user!.id, active.id, {
                        shortageReason: shortageReason || null,
                        items: active.items.map((item) => ({
                          itemId: item.id,
                          receivedQuantity: Number(receiveQty[item.id] || 0),
                        })),
                      })
                    )
                  }
                  loading={acting}
                >
                  Receive
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {active ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {STATUS_LABEL[active.status]} · {active.items.length} line{active.items.length === 1 ? "" : "s"}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">This receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.items.map((item) => {
                  const product = products?.find((p) => p.id === item.productId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{product?.name ?? item.productId}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.dispatchedQuantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.receivedQuantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={receiveQty[item.id] ?? "0"}
                          onChange={(event) =>
                            setReceiveQty((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          className="ml-auto w-24"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Field label="Shortage reason" htmlFor="transfer-shortage">
              <Textarea
                id="transfer-shortage"
                value={shortageReason}
                onChange={(event) => setShortageReason(event.target.value)}
                placeholder="Required when receiving less than dispatched"
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
