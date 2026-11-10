"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
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
import type { StockCountItem, StockCountSession, StockCountStatus } from "@/types/domain";

const STATUS_LABEL: Record<StockCountStatus, string> = {
  draft: "Draft",
  counting: "Counting",
  review: "Review",
  pending_approval: "Pending",
  posted: "Posted",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<StockCountStatus, "secondary" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  counting: "warning",
  review: "warning",
  pending_approval: "warning",
  posted: "success",
  cancelled: "destructive",
};

export default function StockCountsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [active, setActive] = React.useState<StockCountSession | null>(null);
  const [warehouseId, setWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [counted, setCounted] = React.useState<Record<string, string>>({});

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

  const { data: balances } = useQuery({
    queryKey: ["stock-balances", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listBalances(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: counts } = useQuery({
    queryKey: ["stock-counts", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listCounts(business.id);
    },
    enabled: Boolean(business),
  });

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = counts ?? [];
    if (!q) return list;
    return list.filter((row) => {
      const warehouse = warehouses?.find((w) => w.id === row.warehouseId)?.name ?? "";
      return row.countNo.toLowerCase().includes(q) || warehouse.toLowerCase().includes(q);
    });
  }, [search, counts, warehouses]);

  const snapshotItems = React.useMemo(() => {
    const map = new Map<string, { productId: string; systemQuantity: number }>();
    for (const balance of balances ?? []) {
      if (warehouseId && balance.warehouseId && balance.warehouseId !== warehouseId) continue;
      const current = map.get(balance.productId) ?? { productId: balance.productId, systemQuantity: 0 };
      current.systemQuantity += balance.quantity;
      map.set(balance.productId, current);
    }
    if (map.size === 0) {
      return (products ?? []).map((product) => ({ productId: product.id, systemQuantity: product.stockQuantity }));
    }
    return Array.from(map.values());
  }, [balances, warehouseId, products]);

  const resetForm = () => {
    setWarehouseId(warehouses?.[0]?.id ?? "");
    setNotes("");
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const submit = async () => {
    if (!business || !user) return;
    if (!warehouseId) {
      toastError("Warehouse required", "Choose the warehouse being counted.");
      return;
    }
    if (snapshotItems.length === 0) {
      toastError("Nothing to count", "Add products before starting a count.");
      return;
    }
    setSaving(true);
    try {
      await getClientServices().inventory.createCountSession(business.id, user.id, {
        warehouseId,
        notes: notes || null,
        items: snapshotItems.map((item) => ({
          productId: item.productId,
          systemQuantity: item.systemQuantity,
          countedQuantity: null,
        })),
      });
      toastSuccess("Count started", "Enter counted quantities, then post to write COUNT ledger rows.");
      setFormOpen(false);
      await invalidate();
    } catch (err) {
      toastError("Could not start count", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const openCount = (session: StockCountSession) => {
    setActive(session);
    setCounted(
      Object.fromEntries(
        session.items.map((item) => [
          item.id,
          item.countedQuantity === null || item.countedQuantity === undefined ? "" : String(item.countedQuantity),
        ])
      )
    );
  };

  const withCounted = (session: StockCountSession): StockCountItem[] =>
    session.items.map((item) => {
      const raw = counted[item.id];
      const value = raw === undefined || raw === "" ? null : Number(raw);
      return { ...item, countedQuantity: value === null || !Number.isFinite(value) ? null : value };
    });

  if (isLoading) return <LoadingState label="Loading stock counts…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load stock counts"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Stock counts"
        description="Physical counts stay unposted until approved. Posting writes COUNT ledger rows — never a silent overwrite."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
            New count
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search counts…"
            className="w-full max-w-sm"
            aria-label="Search counts"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "count" : "counts"}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No counts yet"
            description="Start a physical count. Differences post as COUNT movements after approval."
            action={{
              label: "New count",
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
                      <TableCell className="font-mono text-xs">{row.countNo}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      </TableCell>
                      <TableCell>{warehouse?.name ?? row.warehouseId}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.items.length}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.postedAt ?? row.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openCount(row)}>
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
        title="Start stock count"
        description="System quantities are snapshotted now. Counted quantities can be entered after the session is created."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Start count
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Warehouse" htmlFor="count-warehouse" required>
            <Select id="count-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Select warehouse</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="count-notes">
            <Textarea
              id="count-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional count notes"
            />
          </Field>
          <p className="text-xs text-muted-foreground">{snapshotItems.length} product lines will be included.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Count ${active.countNo}` : "Stock count"}
        description="Enter counted quantities, save for review, then post. Posting writes COUNT ledger rows for differences only."
        size="lg"
        footer={
          active ? (
            <>
              <Button variant="outline" onClick={() => setActive(null)}>
                Close
              </Button>
              {active.status !== "posted" && active.status !== "cancelled" ? (
                <>
                  <Button
                    variant="outline"
                    loading={acting}
                    onClick={() => {
                      if (!business || !user || !active) return;
                      setActing(true);
                      void getClientServices()
                        .inventory.saveCountQuantities(business.id, user.id, active.id, withCounted(active))
                        .then(async () => {
                          toastSuccess("Count saved", "Quantities were saved for review.");
                          setActive(null);
                          await invalidate();
                        })
                        .catch((err) => {
                          toastError("Could not save count", normalizeError(err).userMessage);
                        })
                        .finally(() => setActing(false));
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    loading={acting}
                    onClick={() => {
                      if (!business || !user || !active) return;
                      setActing(true);
                      const items = withCounted(active);
                      void getClientServices()
                        .inventory.saveCountQuantities(business.id, user.id, active.id, items)
                        .then(() => getClientServices().inventory.postCount(business.id, user.id, active.id))
                        .then(async () => {
                          toastSuccess("Count posted", "COUNT ledger rows were written for differences.");
                          setActive(null);
                          await invalidate();
                        })
                        .catch((err) => {
                          toastError("Could not post count", normalizeError(err).userMessage);
                        })
                        .finally(() => setActing(false));
                    }}
                  >
                    Post count
                  </Button>
                </>
              ) : null}
            </>
          ) : null
        }
      >
        {active ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">System</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.items.map((item) => {
                const product = products?.find((p) => p.id === item.productId);
                const countedQty = counted[item.id] === "" ? null : Number(counted[item.id]);
                const diff =
                  countedQty === null || !Number.isFinite(countedQty) ? null : countedQty - item.systemQuantity;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{product?.name ?? item.productId}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.systemQuantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={counted[item.id] ?? ""}
                        onChange={(event) =>
                          setCounted((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        className="ml-auto w-24"
                        disabled={active.status === "posted" || active.status === "cancelled"}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{diff === null ? "—" : diff}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </Modal>
    </div>
  );
}
