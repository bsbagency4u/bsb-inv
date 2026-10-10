"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
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
import { DEFAULT_SALES } from "@/services/business.service";

export default function SalesSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [paymentModeOverride, setPaymentModeOverride] = React.useState<string | null>(null);
  const [intraStateOverride, setIntraStateOverride] = React.useState<boolean | null>(null);
  const [discountOverride, setDiscountOverride] = React.useState<string | null>(null);
  const [allowLineDiscountOverride, setAllowLineDiscountOverride] = React.useState<boolean | null>(null);
  const [allowExpiredOverride, setAllowExpiredOverride] = React.useState<boolean | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sales-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getSalesDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: paymentModes } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  const paymentMode = paymentModeOverride ?? defaults?.defaultPaymentMode ?? DEFAULT_SALES.defaultPaymentMode;
  const intraState = intraStateOverride ?? defaults?.defaultIntraState ?? DEFAULT_SALES.defaultIntraState;
  const discount = discountOverride ?? String(defaults?.defaultDiscountPercent ?? DEFAULT_SALES.defaultDiscountPercent);
  const allowLineDiscount = allowLineDiscountOverride ?? defaults?.allowLineDiscount ?? DEFAULT_SALES.allowLineDiscount;
  const allowExpired = allowExpiredOverride ?? defaults?.allowExpired ?? DEFAULT_SALES.allowExpired;

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updateSalesDefaults(user.id, business.id, {
        defaultPaymentMode: paymentMode,
        defaultIntraState: intraState,
        defaultDiscountPercent: Number(discount) || 0,
        allowLineDiscount,
        allowExpired,
      });
      toastSuccess("Sales defaults saved", "POS and invoices will use these values.");
      await queryClient.invalidateQueries({ queryKey: ["sales-defaults"] });
    } catch (err) {
      toastError("Could not save sales defaults", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading sales defaults…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load sales defaults"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Defaults applied when you open POS or create a sales invoice."
      />
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Checkout defaults
            </CardTitle>
            <CardDescription>
              These values pre-fill POS and sales invoices. You can still change them per document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Default payment mode" htmlFor="sales-mode">
              <Select
                id="sales-mode"
                value={paymentMode}
                onChange={(event) => setPaymentModeOverride(event.target.value)}
              >
                {(paymentModes ?? []).length === 0 ? (
                  <option value={paymentMode}>{paymentMode}</option>
                ) : (
                  (paymentModes ?? []).map((mode) => (
                    <option key={mode.id} value={mode.code}>
                      {mode.name}
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <Field label="Default tax treatment" htmlFor="sales-tax">
              <Select
                id="sales-tax"
                value={intraState ? "intra" : "inter"}
                onChange={(event) => setIntraStateOverride(event.target.value === "intra")}
              >
                <option value="intra">Intra-state (CGST + SGST)</option>
                <option value="inter">Inter-state (IGST)</option>
              </Select>
            </Field>
            <Field
              label="Default discount %"
              htmlFor="sales-discount"
              hint="Applied as a document-level discount on new sales."
            >
              <Input
                id="sales-discount"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscountOverride(event.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Allow line discounts</p>
                <p className="text-xs text-muted-foreground">
                  When off, POS and invoices hide per-line discount fields.
                </p>
              </div>
              <Switch
                checked={allowLineDiscount}
                onCheckedChange={setAllowLineDiscountOverride}
                aria-label="Allow line discounts"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Allow expired lots</p>
                <p className="text-xs text-muted-foreground">
                  When off, POS hides batches whose expiry date has passed.
                </p>
              </div>
              <Switch
                checked={allowExpired}
                onCheckedChange={setAllowExpiredOverride}
                aria-label="Allow expired lots"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => void save()} loading={saving}>
              Save sales defaults
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
