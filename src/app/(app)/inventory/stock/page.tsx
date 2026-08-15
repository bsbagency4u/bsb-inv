"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, PackageX, Plus, TriangleAlert } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import type { StockMovementReason } from "@/types/domain";

const REASON_LABELS: Record<StockMovementReason, string> = {
  opening: "Opening stock",
  purchase: "Purchase",
  sale: "Sale",
  adjustment: "Adjustment",
  return: "Return",
  transfer: "Transfer",
};

export default function StockPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [adjusting, setAdjusting] = React.useState<string | null>(null);
  const [change, setChange] = React.useState("");
  const [reason, setReason] = React.useState<StockMovementReason>("adjustment");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const filtered = React.useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const adjustingProduct = products?.find((p) => p.id === adjusting) ?? null;

  if (isLoading) return <LoadingState label="Loading stock…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load stock"
      />
    );
  }

  const applyAdjustment = async () => {
    if (!business || !user || !adjusting) return;
    const value = Number(change);
    if (!Number.isFinite(value) || value === 0) {
      toastError("Invalid quantity", "Enter a non-zero quantity (use − for stock out).");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().products.adjustStock(business.id, user.id, {
        productId: adjusting,
        change: value,
        reason,
        notes: notes || null,
      });
      toastSuccess("Stock adjusted", "The stock level was updated.");
      setAdjusting(null);
      setChange("");
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toastError("Could not adjust stock", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Current stock levels across your catalogue."
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search stock…"
            className="w-full max-w-sm"
            aria-label="Search stock"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </span>
        </div>

        {!products || products.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-6" />}
            title="No stock yet"
            description="Add products to the catalogue, then record opening stock."
            action={{ label: "Add products", href: "/inventory/products" }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => {
                  const out = product.stockQuantity <= 0;
                  const low =
                    !out &&
                    product.lowStockThreshold > 0 &&
                    product.stockQuantity <= product.lowStockThreshold;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku ? `SKU ${product.sku}` : "No SKU"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {product.stockQuantity} {product.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(product.stockValue, business?.currency ?? "INR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={out ? "destructive" : low ? "warning" : "success"}>
                          {out ? (
                            <PackageX className="size-3" />
                          ) : low ? (
                            <TriangleAlert className="size-3" />
                          ) : null}
                          {out ? "Out of stock" : low ? "Low stock" : "In stock"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAdjusting(product.id);
                            setChange("");
                            setReason("adjustment");
                            setNotes("");
                          }}
                        >
                          <Plus className="size-4" />
                          Adjust
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
        open={Boolean(adjustingProduct)}
        onClose={() => setAdjusting(null)}
        title={adjustingProduct ? `Adjust stock: ${adjustingProduct.name}` : "Adjust stock"}
        description="Positive quantities add stock; negative quantities remove it."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjusting(null)}>
              Cancel
            </Button>
            <Button onClick={() => void applyAdjustment()} loading={saving}>
              Save adjustment
            </Button>
          </>
        }
      >
        {adjustingProduct ? (
          <div className="space-y-4">
            <div className="rounded-md bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
              Current stock:{" "}
              <span className="font-semibold text-foreground">
                {adjustingProduct.stockQuantity} {adjustingProduct.unit}
              </span>
            </div>
            <Field
              label="Quantity change"
              htmlFor="adjust-change"
              hint="Use a minus sign (e.g. -5) for stock out."
              required
            >
              <Input
                id="adjust-change"
                type="number"
                step="any"
                value={change}
                onChange={(event) => setChange(event.target.value)}
                placeholder="e.g. 10 or -3"
                autoFocus
              />
            </Field>
            <Field label="Reason" htmlFor="adjust-reason">
              <Select
                id="adjust-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as StockMovementReason)}
              >
                {(Object.keys(REASON_LABELS) as StockMovementReason[]).map((key) => (
                  <option key={key} value={key}>
                    {REASON_LABELS[key]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="adjust-notes">
              <Textarea
                id="adjust-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note"
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
