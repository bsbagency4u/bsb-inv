"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, History, PackageX, Repeat, TriangleAlert, Trash2 } from "lucide-react";
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
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { StockMovementType } from "@/types/domain";

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  OPENING: "Opening",
  PURCHASE: "Purchase",
  SALE: "Sale",
  PURCHASE_RETURN: "Purchase return",
  SALE_RETURN: "Sale return",
  ADJUSTMENT: "Adjustment",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  SCRAP: "Scrap",
};

type StockTab = "levels" | "ledger";

export default function StockPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [tab, setTab] = React.useState<StockTab>("levels");
  const [search, setSearch] = React.useState("");
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("");
  const [activeProductId, setActiveProductId] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<"opening" | "adjust" | "transfer" | "scrap" | null>(null);
  const [form, setForm] = React.useState({
    quantity: "",
    change: "",
    costPrice: "",
    warehouseId: "",
    locationId: "",
    toWarehouseId: "",
    reason: "",
    notes: "",
  });
  const [saving, setSaving] = React.useState(false);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: balances } = useQuery({
    queryKey: ["stock-balances", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listBalances(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: movements } = useQuery({
    queryKey: ["stock-movements", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listMovements(business.id);
    },
    enabled: Boolean(business) && tab === "ledger",
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listWarehouses(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: locations } = useQuery({
    queryKey: ["stock-locations", business?.id],
    queryFn: async () => {
      if (!business) return [];
      return getClientServices().inventory.listLocations(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: valuation } = useQuery({
    queryKey: ["stock-valuation", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.valuation(business.id);
    },
    enabled: Boolean(business),
  });

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (!warehouseFilter) return true;
      return (balances ?? []).some(
        (b) => b.productId === p.id && b.warehouseId === warehouseFilter
      );
    });
  }, [products, search, warehouseFilter, balances]);

  const activeProduct = products?.find((p) => p.id === activeProductId) ?? null;
  const warehouseOptions = (warehouses ?? []).map((w) => ({ id: w.id, name: w.name }));
  const locationOptions = (locations ?? [])
    .filter((l) => !form.warehouseId || l.warehouseId === form.warehouseId)
    .map((l) => ({ id: l.id, name: `${l.name} (${l.code})` }));

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

  const resetForm = () =>
    setForm({
      quantity: "",
      change: "",
      costPrice: "",
      warehouseId: warehouseOptions[0]?.id ?? "",
      locationId: "",
      toWarehouseId: warehouseOptions[1]?.id ?? "",
      reason: "",
      notes: "",
    });

  const openAction = (kind: "opening" | "adjust" | "transfer" | "scrap", productId: string) => {
    setAction(kind);
    setActiveProductId(productId);
    resetForm();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-valuation"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const submit = async () => {
    if (!business || !user || !activeProduct || !action) return;
    setSaving(true);
    try {
      const services = getClientServices();
      const base = {
        productId: activeProduct.id,
        warehouseId: form.warehouseId || null,
        locationId: form.locationId || null,
        notes: form.notes || null,
      };
      if (action === "opening") {
        const quantity = Number(form.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a positive opening quantity.");
        await services.inventory.recordOpeningStock(business.id, user.id, {
          ...base,
          quantity,
          costPrice: Number(form.costPrice) || 0,
        });
        toastSuccess("Opening stock recorded", "An opening stock entry was created.");
      } else if (action === "adjust") {
        const change = Number(form.change);
        if (!Number.isFinite(change) || change === 0) throw new Error("Enter a non-zero adjustment.");
        await services.inventory.adjustStock(business.id, user.id, {
          ...base,
          change,
          reason: form.reason || undefined,
        });
        toastSuccess("Stock adjusted", "The stock level was updated.");
      } else if (action === "transfer") {
        const quantity = Number(form.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a positive transfer quantity.");
        if (!form.warehouseId || !form.toWarehouseId) throw new Error("Choose source and destination.");
        await services.inventory.transferStock(business.id, user.id, {
          ...base,
          quantity,
          fromWarehouseId: form.warehouseId,
          toWarehouseId: form.toWarehouseId,
        });
        toastSuccess("Stock transferred", "Transfer movements were recorded.");
      } else if (action === "scrap") {
        const quantity = Number(form.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a positive scrap quantity.");
        await services.inventory.scrapStock(business.id, user.id, {
          ...base,
          quantity,
          reason: form.reason || undefined,
        });
        toastSuccess("Stock scrapped", "A scrap movement was recorded.");
      }
      setAction(null);
      setActiveProductId(null);
      await invalidate();
    } catch (err) {
      toastError("Could not update stock", err instanceof Error ? err.message : normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const totalStockValue = valuation?.reduce((sum, row) => sum + row.stockValue, 0) ?? 0;
  const lowCount = (products ?? []).filter(
    (p) => p.lowStockThreshold > 0 && p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold
  ).length;
  const outCount = (products ?? []).filter((p) => p.stockQuantity <= 0).length;

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Stock levels, movements and valuation."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="px-3 py-1">
              <TriangleAlert className="size-3" /> {lowCount} low
            </Badge>
            <Badge variant="destructive" className="px-3 py-1">
              <PackageX className="size-3" /> {outCount} out
            </Badge>
            <Badge variant="info" className="px-3 py-1">
              Value {formatCurrency(totalStockValue, business?.currency ?? "INR")}
            </Badge>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs
          tabs={[
            { value: "levels", label: "Stock levels", icon: <Boxes className="size-4" /> },
            { value: "ledger", label: "Ledger", icon: <History className="size-4" /> },
          ]}
          value={tab}
          onValueChange={(value) => setTab(value as StockTab)}
        />

        {tab === "levels" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search stock…"
                className="w-full max-w-xs"
                aria-label="Search stock"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={warehouseFilter}
                  onChange={(event) => setWarehouseFilter(event.target.value)}
                  aria-label="Filter by warehouse"
                  className="w-52"
                >
                  <option value="">All warehouses</option>
                  {warehouseOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
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
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Warehouse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const productBalances = (balances ?? []).filter(
                        (b) => b.productId === product.id && (!warehouseFilter || b.warehouseId === warehouseFilter)
                      );
                      const quantity = productBalances.reduce((sum, b) => sum + b.quantity, 0);
                      const out = quantity <= 0;
                      const low =
                        !out && product.lowStockThreshold > 0 && quantity <= product.lowStockThreshold;
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.sku ? `SKU ${product.sku}` : "No SKU"}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {quantity} {product.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              {productBalances.length === 0 ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                productBalances.map((balance) => {
                                  const warehouse = warehouseOptions.find(
                                    (w) => w.id === balance.warehouseId
                                  );
                                  return (
                                    <span key={`${balance.warehouseId}-${balance.locationId}`} className="text-xs text-muted-foreground">
                                      {warehouse?.name ?? "Unassigned"}: {balance.quantity}
                                    </span>
                                  );
                                })
                              )}
                            </div>
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
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openAction("opening", product.id)}>
                                Opening
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAction("adjust", product.id)}>
                                Adjust
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAction("transfer", product.id)}>
                                <Repeat className="size-3.5" />
                                Transfer
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAction("scrap", product.id)}>
                                <Trash2 className="size-3.5" />
                                Scrap
                              </Button>
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
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!movements || movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No movements yet. Record opening stock to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => {
                    const product = products?.find((p) => p.id === movement.productId);
                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(movement.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              movement.change < 0
                                ? movement.movementType === "SCRAP" || movement.movementType === "TRANSFER_OUT"
                                  ? "destructive"
                                  : "warning"
                                : "success"
                            }
                          >
                            {MOVEMENT_LABELS[movement.movementType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {product?.name ?? movement.productId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={movement.change < 0 ? "text-destructive" : "text-success"}>
                            {movement.change > 0 ? "+" : ""}
                            {movement.change}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                          {movement.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(action && activeProduct)}
        onClose={() => setAction(null)}
        title={
          activeProduct
            ? {
                opening: `Record opening stock: ${activeProduct.name}`,
                adjust: `Adjust stock: ${activeProduct.name}`,
                transfer: `Transfer stock: ${activeProduct.name}`,
                scrap: `Scrap stock: ${activeProduct.name}`,
              }[action as string]
            : "Stock"
        }
        description={
          action === "opening"
            ? "Opening stock creates an immutable OPENING ledger entry with cost."
            : action === "transfer"
              ? "A TRANSFER_OUT and TRANSFER_IN pair is written to the ledger."
              : action === "scrap"
                ? "Damaged or waste stock is written off as a SCRAP movement."
                : "Positive quantities add stock; negative quantities remove it."
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              {action === "opening" ? "Record opening" : action === "adjust" ? "Save adjustment" : action === "transfer" ? "Transfer" : "Scrap"}
            </Button>
          </>
        }
      >
        {action ? (
          <div className="space-y-4">
            <Field label="Warehouse" htmlFor="stock-warehouse">
              <Select
                id="stock-warehouse"
                value={form.warehouseId}
                onChange={(event) =>
                  setForm((f) => ({ ...f, warehouseId: event.target.value, locationId: "" }))
                }
              >
                <option value="">Unassigned</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>

            {action !== "transfer" ? (
              <Field label="Location" htmlFor="stock-location">
                <Select
                  id="stock-location"
                  value={form.locationId}
                  onChange={(event) => setForm((f) => ({ ...f, locationId: event.target.value }))}
                >
                  <option value="">No specific location</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Destination warehouse" htmlFor="stock-to-warehouse" required>
                <Select
                  id="stock-to-warehouse"
                  value={form.toWarehouseId}
                  onChange={(event) => setForm((f) => ({ ...f, toWarehouseId: event.target.value }))}
                >
                  <option value="">Select destination…</option>
                  {warehouseOptions
                    .filter((w) => w.id !== form.warehouseId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </Select>
              </Field>
            )}

            {action === "opening" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Quantity" htmlFor="stock-qty" required>
                  <Input
                    id="stock-qty"
                    type="number"
                    step="any"
                    min={0}
                    value={form.quantity}
                    onChange={(event) => setForm((f) => ({ ...f, quantity: event.target.value }))}
                    placeholder="e.g. 100"
                    autoFocus
                  />
                </Field>
                <Field label="Cost price" htmlFor="stock-cost">
                  <Input
                    id="stock-cost"
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.costPrice}
                    onChange={(event) => setForm((f) => ({ ...f, costPrice: event.target.value }))}
                    placeholder="e.g. 250.00"
                  />
                </Field>
              </div>
            ) : null}

            {action === "adjust" ? (
              <Field
                label="Quantity change"
                htmlFor="stock-change"
                hint="Use a minus sign (e.g. -5) for stock out."
                required
              >
                <Input
                  id="stock-change"
                  type="number"
                  step="any"
                  value={form.change}
                  onChange={(event) => setForm((f) => ({ ...f, change: event.target.value }))}
                  placeholder="e.g. 10 or -3"
                  autoFocus
                />
              </Field>
            ) : null}

            {action === "transfer" || action === "scrap" ? (
              <Field label="Quantity" htmlFor="stock-qty-2" required>
                <Input
                  id="stock-qty-2"
                  type="number"
                  step="any"
                  min={0}
                  value={form.quantity}
                  onChange={(event) => setForm((f) => ({ ...f, quantity: event.target.value }))}
                  placeholder="e.g. 5"
                  autoFocus
                />
              </Field>
            ) : null}

            {action === "scrap" ? (
              <Field label="Reason" htmlFor="stock-scrap-reason">
                <Input
                  id="stock-scrap-reason"
                  value={form.reason}
                  onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                  placeholder="e.g. damaged in transit"
                />
              </Field>
            ) : null}

            <Field label="Notes" htmlFor="stock-notes">
              <Textarea
                id="stock-notes"
                value={form.notes}
                onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
                placeholder="Optional note"
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
