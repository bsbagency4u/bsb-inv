"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
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
import { ADJUSTMENT_REASON_META, ADJUSTMENT_REASONS } from "@/lib/inventory-settings";
import type { StockAdjustment, StockAdjustmentReasonCode, StockAdjustmentStatus } from "@/types/domain";

const STATUS_LABEL: Record<StockAdjustmentStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending",
  posted: "Posted",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<StockAdjustmentStatus, "secondary" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  pending_approval: "warning",
  posted: "success",
  cancelled: "destructive",
};

export default function StockAdjustmentsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [active, setActive] = React.useState<StockAdjustment | null>(null);
  const [productId, setProductId] = React.useState("");
  const [change, setChange] = React.useState("");
  const [reason, setReason] = React.useState<StockAdjustmentReasonCode>("physical_count");
  const [warehouseId, setWarehouseId] = React.useState("");
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

  const { data: adjustments } = useQuery({
    queryKey: ["stock-adjustments", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listAdjustments(business.id);
    },
    enabled: Boolean(business),
  });

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = adjustments ?? [];
    if (!q) return list;
    return list.filter((row) => {
      const warehouse = warehouses?.find((w) => w.id === row.warehouseId)?.name ?? "";
      return (
        row.adjustmentNo.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q) ||
        warehouse.toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, adjustments, warehouses]);

  const resetForm = () => {
    setProductId(products?.[0]?.id ?? "");
    setChange("");
    setReason("physical_count");
    setWarehouseId(warehouses?.[0]?.id ?? "");
    setNotes("");
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const submit = async () => {
    if (!business || !user) return;
    const qty = Number(change);
    if (!productId) {
      toastError("Missing product", "Choose a product to adjust.");
      return;
    }
    if (!Number.isFinite(qty) || qty === 0) {
      toastError("Invalid quantity", "Enter a non-zero adjustment quantity.");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().inventory.requestAdjustment(business.id, user.id, {
        reason,
        warehouseId: warehouseId || null,
        notes: notes || null,
        items: [{ productId, change: qty }],
      });
      toastSuccess("Adjustment saved", "The stock adjustment was recorded.");
      setFormOpen(false);
      await invalidate();
    } catch (err) {
      toastError("Could not save adjustment", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading adjustments…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load adjustments"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        description="Post quantity corrections through the ledger. Sensitive reasons stay visible in history."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
            New adjustment
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search adjustments…"
            className="w-full max-w-sm"
            aria-label="Search adjustments"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "adjustment" : "adjustments"}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal className="size-6" />}
            title="No adjustments yet"
            description="Correct damage, expiry, found stock or opening errors without overwriting the ledger."
            action={{
              label: "New adjustment",
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
                  <TableHead>Reason</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const warehouse = warehouses?.find((w) => w.id === row.warehouseId);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.adjustmentNo}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      </TableCell>
                      <TableCell>{ADJUSTMENT_REASON_META[row.reason]?.label ?? row.reason}</TableCell>
                      <TableCell>{warehouse?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.items.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.postedAt ?? row.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setActive(row)}>
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
        title="New adjustment"
        description="Positive quantity adds stock. Negative quantity writes it off through the ledger."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Save adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Product" htmlFor="adj-product" required>
            <Select id="adj-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Select product</option>
              {(products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.stockQuantity})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity change" htmlFor="adj-qty" required hint="Use a negative number to reduce stock.">
            <Input
              id="adj-qty"
              type="number"
              step="any"
              value={change}
              onChange={(event) => setChange(event.target.value)}
              placeholder="e.g. -2 or 3"
            />
          </Field>
          <Field label="Reason" htmlFor="adj-reason" required>
            <Select
              id="adj-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as StockAdjustmentReasonCode)}
            >
              {ADJUSTMENT_REASONS.map((code) => (
                <option key={code} value={code}>
                  {ADJUSTMENT_REASON_META[code].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Warehouse" htmlFor="adj-warehouse">
            <Select id="adj-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Any / unspecified</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="adj-notes">
            <Textarea
              id="adj-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional explanation"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Adjustment ${active.adjustmentNo}` : "Adjustment"}
        description="Posted adjustments write ADJUSTMENT ledger rows. Pending ones wait for approval."
        size="lg"
        footer={
          active ? (
            <>
              <Button variant="outline" onClick={() => setActive(null)}>
                Close
              </Button>
              {active.status === "pending_approval" || active.status === "draft" ? (
                <Button
                  loading={acting}
                  onClick={() => {
                    if (!business || !user || !active) return;
                    setActing(true);
                    void getClientServices()
                      .inventory.postAdjustment(business.id, user.id, active.id)
                      .then(async () => {
                        toastSuccess("Adjustment posted", "Ledger entries were written.");
                        setActive(null);
                        await invalidate();
                      })
                      .catch((err) => {
                        toastError("Could not post adjustment", normalizeError(err).userMessage);
                      })
                      .finally(() => setActing(false));
                  }}
                >
                  Post
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {active ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {STATUS_LABEL[active.status]} · {ADJUSTMENT_REASON_META[active.reason]?.label ?? active.reason}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.items.map((item) => {
                  const product = products?.find((p) => p.id === item.productId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{product?.name ?? item.productId}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.change}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.notes ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
