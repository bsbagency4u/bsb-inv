"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { DEFAULT_PURCHASE } from "@/services/business.service";

export default function PurchaseSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [warehouseIdOverride, setWarehouseIdOverride] = React.useState<string | null>(null);
  const [paymentTermsOverride, setPaymentTermsOverride] = React.useState<string | null>(null);
  const [intraStateOverride, setIntraStateOverride] = React.useState<boolean | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getPurchaseDefaults(business.id);
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

  const warehouseId = warehouseIdOverride ?? defaults?.defaultWarehouseId ?? DEFAULT_PURCHASE.defaultWarehouseId ?? "";
  const paymentTerms = paymentTermsOverride ?? defaults?.defaultPaymentTerms ?? DEFAULT_PURCHASE.defaultPaymentTerms;
  const intraState = intraStateOverride ?? defaults?.defaultIntraState ?? DEFAULT_PURCHASE.defaultIntraState;

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updatePurchaseDefaults(user.id, business.id, {
        defaultWarehouseId: warehouseId,
        defaultPaymentTerms: paymentTerms,
        defaultIntraState: intraState,
      });
      toastSuccess("Purchase defaults saved", "Orders and bills will use these values.");
      await queryClient.invalidateQueries({ queryKey: ["purchase-defaults"] });
    } catch (err) {
      toastError("Could not save purchase defaults", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading purchase defaults…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load purchase defaults"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Purchase"
        description="Defaults for purchase orders, receiving and supplier bills."
      />
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="size-4" />
              Receiving defaults
            </CardTitle>
            <CardDescription>
              Applied when you create a purchase order or receive goods.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Default warehouse"
              htmlFor="purchase-warehouse"
              hint="Used for new purchase orders and goods receiving."
            >
              <Select
                id="purchase-warehouse"
                value={warehouseId}
                onChange={(event) => setWarehouseIdOverride(event.target.value)}
              >
                <option value="">Unassigned</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Default vendor payment terms"
              htmlFor="purchase-terms"
              hint="Shown as the starting notes on new purchase documents."
            >
              <Input
                id="purchase-terms"
                value={paymentTerms}
                onChange={(event) => setPaymentTermsOverride(event.target.value)}
                placeholder="e.g. Net 30"
              />
            </Field>
            <Field label="Default tax treatment" htmlFor="purchase-tax">
              <Select
                id="purchase-tax"
                value={intraState ? "intra" : "inter"}
                onChange={(event) => setIntraStateOverride(event.target.value === "intra")}
              >
                <option value="intra">Intra-state (CGST + SGST)</option>
                <option value="inter">Inter-state (IGST)</option>
              </Select>
            </Field>
          </CardContent>
          <CardFooter>
            <Button onClick={() => void save()} loading={saving}>
              Save purchase defaults
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
