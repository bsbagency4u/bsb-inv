"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { DEFAULT_INVENTORY } from "@/services/business.service";
import type { InventoryDefaults } from "@/types/domain";

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

export default function InventorySettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<InventoryDefaults | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["inventory-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInventoryDefaults(business.id);
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

  const { data: locations } = useQuery({
    queryKey: ["stock-locations", business?.id],
    queryFn: async () => {
      if (!business) return [];
      return getClientServices().inventory.listLocations(business.id);
    },
    enabled: Boolean(business),
  });

  const value = form ?? defaults ?? DEFAULT_INVENTORY;
  const locationOptions = (locations ?? []).filter(
    (location) => !value.defaultWarehouseId || location.warehouseId === value.defaultWarehouseId
  );

  const patch = (next: Partial<InventoryDefaults>) => {
    setForm({ ...value, ...next });
  };

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updateInventoryDefaults(user.id, business.id, {
        ...value,
        defaultWarehouseId: value.defaultWarehouseId ?? "",
        defaultLocationId: value.defaultLocationId ?? "",
      });
      toastSuccess("Inventory defaults saved", "Transfers, counts, labels and availability will use these values.");
      await queryClient.invalidateQueries({ queryKey: ["inventory-defaults"] });
    } catch (err) {
      toastError("Could not save inventory defaults", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading inventory defaults…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load inventory defaults"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock rules, approvals, batch/expiry and barcode label size."
      />
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="size-4" />
              Stock rules
            </CardTitle>
            <CardDescription>Available quantity is physical minus reserved and blocked locations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Allow negative stock"
              hint="When off, reservations and sales cannot go below available quantity."
              checked={value.allowNegativeStock}
              onCheckedChange={(checked) => patch({ allowNegativeStock: checked })}
            />
            <ToggleRow
              label="Reserve on confirm"
              hint="Hold stock when a sale or transfer is confirmed, before it is posted."
              checked={value.reserveOnConfirm}
              onCheckedChange={(checked) => patch({ reserveOnConfirm: checked })}
            />
            <Field label="Default warehouse" htmlFor="inv-warehouse">
              <Select
                id="inv-warehouse"
                value={value.defaultWarehouseId ?? ""}
                onChange={(event) =>
                  patch({ defaultWarehouseId: event.target.value || null, defaultLocationId: null })
                }
              >
                <option value="">None</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default location" htmlFor="inv-location">
              <Select
                id="inv-location"
                value={value.defaultLocationId ?? ""}
                onChange={(event) => patch({ defaultLocationId: event.target.value || null })}
              >
                <option value="">None</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>When on, documents stay pending until posted. Counts always stay unposted until approved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Transfer approval"
              hint="Requested transfers wait for approve before dispatch."
              checked={value.transferApproval}
              onCheckedChange={(checked) => patch({ transferApproval: checked })}
            />
            <ToggleRow
              label="Adjustment approval"
              hint="Adjustments stay pending until posted to the ledger."
              checked={value.adjustmentApproval}
              onCheckedChange={(checked) => patch({ adjustmentApproval: checked })}
            />
            <ToggleRow
              label="Count approval"
              hint="Physical counts never overwrite stock until posted."
              checked={value.countApproval}
              onCheckedChange={(checked) => patch({ countApproval: checked })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch and expiry</CardTitle>
            <CardDescription>FEFO is a recommendation for sellable lots. Expired sales still follow sales settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Batch tracking"
              hint="Keep batch numbers on stock movements and labels."
              checked={value.batchTracking}
              onCheckedChange={(checked) => patch({ batchTracking: checked })}
            />
            <ToggleRow
              label="Expiry tracking"
              hint="Show expiry dates on lots and near-expiry reports."
              checked={value.expiryTracking}
              onCheckedChange={(checked) => patch({ expiryTracking: checked })}
            />
            <ToggleRow
              label="Prefer FEFO"
              hint="Sort sellable lots by earliest expiry, then batch number. Not forced at checkout."
              checked={value.fefoPreferred}
              onCheckedChange={(checked) => patch({ fefoPreferred: checked })}
            />
            <Field label="Near-expiry days" htmlFor="inv-near-expiry">
              <Input
                id="inv-near-expiry"
                type="number"
                min={1}
                max={365}
                value={value.nearExpiryDays}
                onChange={(event) => patch({ nearExpiryDays: Number(event.target.value) || 1 })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Barcode labels</CardTitle>
            <CardDescription>Used by Inventory / Barcode print.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Barcode enabled"
              hint="Show scan and label tools."
              checked={value.barcodeEnabled}
              onCheckedChange={(checked) => patch({ barcodeEnabled: checked })}
            />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Width mm" htmlFor="inv-label-w">
                <Input
                  id="inv-label-w"
                  type="number"
                  min={20}
                  max={210}
                  value={value.labelWidthMm}
                  onChange={(event) => patch({ labelWidthMm: Number(event.target.value) || 20 })}
                />
              </Field>
              <Field label="Height mm" htmlFor="inv-label-h">
                <Input
                  id="inv-label-h"
                  type="number"
                  min={10}
                  max={297}
                  value={value.labelHeightMm}
                  onChange={(event) => patch({ labelHeightMm: Number(event.target.value) || 10 })}
                />
              </Field>
              <Field label="Per row" htmlFor="inv-label-row">
                <Input
                  id="inv-label-row"
                  type="number"
                  min={1}
                  max={8}
                  value={value.labelsPerRow}
                  onChange={(event) => patch({ labelsPerRow: Number(event.target.value) || 1 })}
                />
              </Field>
            </div>
            <ToggleRow
              label="Show MRP on label"
              hint="Print MRP when the product or batch has one."
              checked={value.showMrpOnLabel}
              onCheckedChange={(checked) => patch({ showMrpOnLabel: checked })}
            />
            <ToggleRow
              label="Show batch on label"
              hint="Print the preferred FEFO batch number when available."
              checked={value.showBatchOnLabel}
              onCheckedChange={(checked) => patch({ showBatchOnLabel: checked })}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={() => void save()} loading={saving}>
              Save inventory defaults
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
