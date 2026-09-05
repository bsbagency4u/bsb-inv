"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { partySchema, type PartyValues } from "@/lib/validation/schemas";
import type { Customer, Supplier } from "@/types/domain";

function toFormValues(party?: Customer | Supplier | null): PartyValues {
  return {
    name: party?.name ?? "",
    phone: party?.phone ?? "",
    email: party?.email ?? "",
    gstin: party?.gstin ?? "",
    pan: party?.pan ?? "",
    customerType: party && "customerType" in party ? party.customerType : "regular",
    creditLimit: party && "creditLimit" in party ? (party.creditLimit ?? undefined) : undefined,
    address: party?.address ?? "",
    city: party?.city ?? "",
    state: party?.state ?? "",
    pincode: party?.pincode ?? "",
    country: party?.country ?? "",
    paymentTerms: party && "paymentTerms" in party ? (party.paymentTerms ?? "") : "",
    notes: party?.notes ?? "",
    openingBalance: party?.openingBalance ?? 0,
  };
}

export function PartyForm({
  party,
  partyType,
  onSubmit,
  submitLabel = "Save",
}: {
  party?: Customer | Supplier | null;
  partyType: "customer" | "supplier";
  onSubmit: (values: PartyValues) => Promise<void>;
  submitLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof partySchema>, unknown, z.output<typeof partySchema>>({
    resolver: zodResolver(partySchema),
    defaultValues: toFormValues(party),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Name" htmlFor={`${partyType}-name`} required error={errors.name?.message}>
        <Input
          id={`${partyType}-name`}
          placeholder="Full name or business name"
          invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor={`${partyType}-phone`} error={errors.phone?.message}>
          <Input id={`${partyType}-phone`} placeholder="+91…" {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor={`${partyType}-email`} error={errors.email?.message}>
          <Input id={`${partyType}-email`} type="email" placeholder="name@example.com" {...register("email")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="GSTIN" htmlFor={`${partyType}-gstin`} error={errors.gstin?.message}>
          <Input id={`${partyType}-gstin`} placeholder="22AAAAA0000A1Z5" {...register("gstin")} />
        </Field>
        <Field label="PAN" htmlFor={`${partyType}-pan`} error={errors.pan?.message}>
          <Input id={`${partyType}-pan`} placeholder="ABCDE1234F" {...register("pan")} />
        </Field>
      </div>

      {partyType === "customer" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer type" htmlFor="customer-type">
            <Select
              id="customer-type"
              defaultValue={party && "customerType" in party ? party.customerType : "regular"}
              onChange={(event) => setValue("customerType", event.target.value as "walkin" | "regular" | "business")}
            >
              <option value="walkin">Walk-in</option>
              <option value="regular">Regular</option>
              <option value="business">Business</option>
            </Select>
          </Field>
          <Field label="Credit limit" htmlFor="customer-credit" error={errors.creditLimit?.message}>
            <Input
              id="customer-credit"
              type="number"
              step="0.01"
              min={0}
              defaultValue={party && "creditLimit" in party ? (party.creditLimit ?? "") : ""}
              {...register("creditLimit")}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Address" htmlFor={`${partyType}-address`} error={errors.address?.message}>
        <Textarea id={`${partyType}-address`} placeholder="Street, area, landmark" {...register("address")} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor={`${partyType}-city`} error={errors.city?.message}>
          <Input id={`${partyType}-city`} {...register("city")} />
        </Field>
        <Field label="State" htmlFor={`${partyType}-state`} error={errors.state?.message}>
          <Input id={`${partyType}-state`} {...register("state")} />
        </Field>
        <Field label="Pincode" htmlFor={`${partyType}-pincode`} error={errors.pincode?.message}>
          <Input id={`${partyType}-pincode`} {...register("pincode")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Country" htmlFor={`${partyType}-country`} error={errors.country?.message}>
          <Input id={`${partyType}-country`} placeholder="India" {...register("country")} />
        </Field>
        {partyType === "supplier" ? (
          <Field label="Payment terms" htmlFor="supplier-terms" error={errors.paymentTerms?.message}>
            <Input
              id="supplier-terms"
              placeholder="e.g. Net 30"
              {...register("paymentTerms")}
            />
          </Field>
        ) : null}
      </div>

      <Field label="Notes" htmlFor={`${partyType}-notes`} error={errors.notes?.message}>
        <Input id={`${partyType}-notes`} placeholder="Optional notes" {...register("notes")} />
      </Field>

      <Field
        label="Opening balance"
        htmlFor={`${partyType}-balance`}
        hint={
          partyType === "customer"
            ? "Amount this customer owes you from before."
            : "Amount you owe this supplier from before."
        }
        error={errors.openingBalance?.message}
      >
        <Input
          id={`${partyType}-balance`}
          type="number"
          step="0.01"
          min={0}
          defaultValue={party?.openingBalance ?? 0}
          {...register("openingBalance")}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
