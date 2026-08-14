"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { businessProfileSchema, type BusinessProfileValues } from "@/lib/validation/schemas";
import { getBusinessType } from "@/config/business-types";
import { BUSINESS_TYPES, CURRENCIES, COUNTRIES } from "@/config/business-types";
import { normalizeError } from "@/lib/errors";
import type { BusinessProfile } from "@/types/domain";

const emptyValues: BusinessProfileValues = {
  name: "",
  legalName: "",
  type: "retail",
  logoUrl: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  gstin: "",
  pan: "",
  currency: "INR",
  financialYear: "01-04",
  invoicePrefix: "INV",
  invoiceStartNumber: 1001,
};

function toFormValues(business: BusinessProfile): BusinessProfileValues {
  return {
    name: business.name,
    legalName: business.legalName ?? "",
    type: business.type,
    logoUrl: business.logoUrl ?? "",
    email: business.email ?? "",
    phone: business.phone ?? "",
    website: business.website ?? "",
    address: business.address ?? "",
    city: business.city ?? "",
    state: business.state ?? "",
    country: business.country,
    pincode: business.pincode ?? "",
    gstin: business.gstin ?? "",
    pan: business.pan ?? "",
    currency: business.currency,
    financialYear: business.financialYear,
    invoicePrefix: business.invoicePrefix,
    invoiceStartNumber: business.invoiceStartNumber,
  };
}

export function BusinessProfileForm({
  business,
  onSubmit,
  submitLabel = "Save business",
}: {
  business?: BusinessProfile | null;
  onSubmit: (values: BusinessProfileValues) => Promise<void>;
  submitLabel?: string;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof businessProfileSchema>,
    unknown,
    z.output<typeof businessProfileSchema>
  >({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: business ? toFormValues(business) : emptyValues,
  });

  const selectedType = useWatch({ control, name: "type" });
  const typeConfig = getBusinessType(selectedType);

  const submit = async (values: BusinessProfileValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
      toastSuccess("Business saved", "Your business profile was updated.");
    } catch (error) {
      const normalized = normalizeError(error);
      setServerError(normalized.userMessage);
      toastError("Could not save business", normalized.userMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {serverError ? (
        <Alert variant="error" title="Something went wrong">
          <p>{serverError}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>General information</CardTitle>
          <CardDescription>Core details that identify your business.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Sharma General Store" {...register("name")} invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Legal name" htmlFor="legalName" error={errors.legalName?.message}>
            <Input id="legalName" placeholder="Legal entity name" {...register("legalName")} invalid={Boolean(errors.legalName)} />
          </Field>
          <Field label="Business type" htmlFor="type" required error={errors.type?.message}>
            <Select id="type" {...register("type")} invalid={Boolean(errors.type)}>
              {BUSINESS_TYPES.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Logo URL" htmlFor="logoUrl" hint="Paste an image URL (upload storage arrives later).">
            <Input id="logoUrl" placeholder="https://…" {...register("logoUrl")} invalid={Boolean(errors.logoUrl)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact & address</CardTitle>
          <CardDescription>Where your business operates.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address" htmlFor="address" error={errors.address?.message}>
            <Textarea id="address" rows={2} placeholder="Street address" {...register("address")} invalid={Boolean(errors.address)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="city" error={errors.city?.message}>
              <Input id="city" placeholder="City" {...register("city")} invalid={Boolean(errors.city)} />
            </Field>
            <Field label="State" htmlFor="state" error={errors.state?.message}>
              <Input id="state" placeholder="State / Province" {...register("state")} invalid={Boolean(errors.state)} />
            </Field>
          </div>
          <Field label="Country" htmlFor="country" required error={errors.country?.message}>
            <Select id="country" {...register("country")} invalid={Boolean(errors.country)}>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pincode / Postal code" htmlFor="pincode" error={errors.pincode?.message}>
            <Input id="pincode" placeholder="e.g. 560001" {...register("pincode")} invalid={Boolean(errors.pincode)} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="+91 98765 43210" {...register("phone")} invalid={Boolean(errors.phone)} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" placeholder="business@example.com" {...register("email")} invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Website" htmlFor="website" error={errors.website?.message}>
            <Input id="website" placeholder="https://example.com" {...register("website")} invalid={Boolean(errors.website)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax & compliance</CardTitle>
          <CardDescription>Optional tax identifiers. Validation is applied when supplied.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="GSTIN" htmlFor="gstin" error={errors.gstin?.message} hint="Validated when provided.">
            <Input id="gstin" placeholder="22AAAAA0000A1Z5" {...register("gstin")} invalid={Boolean(errors.gstin)} />
          </Field>
          <Field label="PAN" htmlFor="pan" error={errors.pan?.message} hint="Validated when provided.">
            <Input id="pan" placeholder="ABCDE1234F" {...register("pan")} invalid={Boolean(errors.pan)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounting</CardTitle>
          <CardDescription>Currency and document numbering defaults.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency" required error={errors.currency?.message}>
            <Select id="currency" {...register("currency")} invalid={Boolean(errors.currency)}>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Financial year start" htmlFor="financialYear" error={errors.financialYear?.message} hint="MM-DD, e.g. 01-04.">
            <Input id="financialYear" placeholder="01-04" {...register("financialYear")} invalid={Boolean(errors.financialYear)} />
          </Field>
          <Field label="Invoice prefix" htmlFor="invoicePrefix" error={errors.invoicePrefix?.message}>
            <Input id="invoicePrefix" placeholder="INV" {...register("invoicePrefix")} invalid={Boolean(errors.invoicePrefix)} />
          </Field>
          <Field label="Invoice starting number" htmlFor="invoiceStartNumber" error={errors.invoiceStartNumber?.message}>
            <Input
              id="invoiceStartNumber"
              type="number"
              {...register("invoiceStartNumber", { valueAsNumber: true })}
              invalid={Boolean(errors.invoiceStartNumber)}
            />
          </Field>
        </CardContent>
      </Card>

      {typeConfig.productAttributes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Product attributes for {typeConfig.label}</CardTitle>
            <CardDescription>
              These product fields will be used when the product engine ships in Phase 2.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {typeConfig.productAttributes.map((attribute) => (
                <span
                  key={attribute.key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {attribute.label}
                  {attribute.required ? <span className="text-destructive">*</span> : null}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          <Save className="size-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
