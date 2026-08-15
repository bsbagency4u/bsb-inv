"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    address: party?.address ?? "",
    city: party?.city ?? "",
    state: party?.state ?? "",
    pincode: party?.pincode ?? "",
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

      <Field label="GSTIN" htmlFor={`${partyType}-gstin`} error={errors.gstin?.message}>
        <Input id={`${partyType}-gstin`} placeholder="22AAAAA0000A1Z5" {...register("gstin")} />
      </Field>

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
