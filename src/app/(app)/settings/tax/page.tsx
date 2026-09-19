"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
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
import { DEFAULT_TAX } from "@/services/business.service";
import { GST_RATE_OPTIONS } from "@/services/gst.service";

export default function TaxSettingsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [gstEnabledOverride, setGstEnabledOverride] = React.useState<boolean | null>(null);
  const [rateOverride, setRateOverride] = React.useState<string | null>(null);
  const [intraStateOverride, setIntraStateOverride] = React.useState<boolean | null>(null);
  const [hsnOverride, setHsnOverride] = React.useState<string | null>(null);
  const [pricesIncludeTaxOverride, setPricesIncludeTaxOverride] = React.useState<boolean | null>(null);

  const { data: defaults, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tax-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getTaxDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const gstEnabled = gstEnabledOverride ?? defaults?.gstEnabled ?? DEFAULT_TAX.gstEnabled;
  const rate = rateOverride ?? String(defaults?.defaultGstRate ?? DEFAULT_TAX.defaultGstRate);
  const intraState = intraStateOverride ?? defaults?.defaultIntraState ?? DEFAULT_TAX.defaultIntraState;
  const hsnCode = hsnOverride ?? defaults?.defaultHsnCode ?? DEFAULT_TAX.defaultHsnCode;
  const pricesIncludeTax =
    pricesIncludeTaxOverride ?? defaults?.pricesIncludeTax ?? DEFAULT_TAX.pricesIncludeTax;

  const save = async () => {
    if (!business || !user) return;
    setSaving(true);
    try {
      await getClientServices().businesses.updateTaxDefaults(user.id, business.id, {
        gstEnabled,
        defaultGstRate: Number(rate) || 0,
        defaultIntraState: intraState,
        defaultHsnCode: hsnCode,
        pricesIncludeTax,
      });
      toastSuccess("Tax settings saved", "New products and invoices will use these values.");
      await queryClient.invalidateQueries({ queryKey: ["tax-defaults"] });
    } catch (err) {
      toastError("Could not save tax settings", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading tax settings…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load tax settings"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Tax"
        description="GST configuration applied to new products, POS and invoices."
      />
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              GST defaults
            </CardTitle>
            <CardDescription>
              These values pre-fill new documents. You can still change them per product or invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Charge GST</p>
                <p className="text-xs text-muted-foreground">
                  When off, new documents default to a 0% rate with no tax split.
                </p>
              </div>
              <Switch
                checked={gstEnabled}
                onCheckedChange={setGstEnabledOverride}
                aria-label="Charge GST"
              />
            </div>
            <Field label="Default GST rate" htmlFor="tax-rate">
              <Select
                id="tax-rate"
                value={rate}
                onChange={(event) => setRateOverride(event.target.value)}
                disabled={!gstEnabled}
              >
                {GST_RATE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}%
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default tax treatment" htmlFor="tax-treatment">
              <Select
                id="tax-treatment"
                value={intraState ? "intra" : "inter"}
                onChange={(event) => setIntraStateOverride(event.target.value === "intra")}
                disabled={!gstEnabled}
              >
                <option value="intra">Intra-state (CGST + SGST)</option>
                <option value="inter">Inter-state (IGST)</option>
              </Select>
            </Field>
            <Field
              label="Default HSN / SAC code"
              htmlFor="tax-hsn"
              hint="Pre-fills new products when the business is registered for GST."
            >
              <Input
                id="tax-hsn"
                value={hsnCode}
                onChange={(event) => setHsnOverride(event.target.value)}
                placeholder="e.g. 1006"
                maxLength={20}
              />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Prices include tax</p>
                <p className="text-xs text-muted-foreground">
                  When on, entered selling prices are treated as GST-inclusive.
                </p>
              </div>
              <Switch
                checked={pricesIncludeTax}
                onCheckedChange={setPricesIncludeTaxOverride}
                aria-label="Prices include tax"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => void save()} loading={saving}>
              Save tax settings
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
