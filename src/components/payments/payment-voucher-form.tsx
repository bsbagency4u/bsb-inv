"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { DocumentPrintActions } from "@/components/documents/document-print-actions";
import { customerContact, paymentReceiptPrintModel, supplierContact } from "@/lib/document-print-models";
import { autoOutputDocument } from "@/lib/invoice-print";
import { DEFAULT_INVOICE } from "@/lib/invoice-settings";
import { roundMoney, type OutstandingRow } from "@/lib/party-ledger";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer, Payment, Supplier } from "@/types/domain";

export function PaymentVoucherForm({
  initialDirection,
  initialPartyId,
  onSaved,
}: {
  initialDirection?: "in" | "out";
  initialPartyId?: string | null;
  onSaved?: () => void;
}) {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [direction, setDirection] = React.useState<"in" | "out">(initialDirection ?? "in");
  const [partyId, setPartyId] = React.useState<string | null>(initialPartyId ?? null);
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState("cash");
  const [reference, setReference] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const [allocations, setAllocations] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [lastPayment, setLastPayment] = React.useState<Payment | null>(null);

  const partyType = direction === "in" ? "customer" : "supplier";

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listSuppliers(business.id);
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

  const { data: invoiceDefaults } = useQuery({
    queryKey: ["invoice-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getInvoiceDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const outstandingQuery = useQuery({
    queryKey: ["outstanding", partyType, business?.id, partyId],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return partyType === "customer"
        ? getClientServices().ledger.receivables(business.id, { partyId })
        : getClientServices().ledger.payables(business.id, { partyId });
    },
    enabled: Boolean(business && partyId),
  });

  const parties = partyType === "customer" ? customers : suppliers;
  const party = parties?.find((item) => item.id === partyId) ?? null;
  const currency = business?.currency ?? "INR";
  const openRows = React.useMemo(() => outstandingQuery.data ?? [], [outstandingQuery.data]);
  const parsedAmount = Math.max(0, Number(amount) || 0);

  const allocatedTotal = React.useMemo(() => {
    return roundMoney(
      openRows.reduce((sum, row) => sum + Math.max(0, Number(allocations[row.invoiceId]) || 0), 0)
    );
  }, [openRows, allocations]);

  const unallocated = roundMoney(Math.max(0, parsedAmount - allocatedTotal));

  const setAllocation = (invoiceId: string, value: string, max: number) => {
    const next = value === "" ? "" : String(Math.min(max, Math.max(0, Number(value) || 0)));
    setAllocations((current) => ({ ...current, [invoiceId]: next }));
  };

  const toggleInvoice = (row: OutstandingRow, checked: boolean) => {
    if (!checked) {
      setAllocations((current) => ({ ...current, [row.invoiceId]: "" }));
      return;
    }
    const already = roundMoney(
      openRows
        .filter((item) => item.invoiceId !== row.invoiceId)
        .reduce((sum, item) => sum + Math.max(0, Number(allocations[item.invoiceId]) || 0), 0)
    );
    const remainingPayment = Math.max(0, parsedAmount - already);
    const apply = Math.min(row.balance, remainingPayment || row.balance);
    setAllocations((current) => ({ ...current, [row.invoiceId]: String(apply) }));
  };

  const allocateOldest = () => {
    if (parsedAmount <= 0) return;
    let remaining = parsedAmount;
    const next: Record<string, string> = {};
    for (const row of [...openRows].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))) {
      if (remaining <= 0) break;
      const apply = Math.min(row.balance, remaining);
      if (apply > 0) {
        next[row.invoiceId] = String(roundMoney(apply));
        remaining = roundMoney(remaining - apply);
      }
    }
    setAllocations(next);
  };

  const submit = async () => {
    if (!business || !user) return;
    if (!partyId) {
      toastError("Select a party", "Choose a customer or supplier first.");
      return;
    }
    if (parsedAmount <= 0) {
      toastError("Invalid amount", "Enter a positive payment amount.");
      return;
    }
    if (allocatedTotal - parsedAmount > 0.009) {
      toastError("Allocation too high", "Allocated amounts cannot exceed the voucher total.");
      return;
    }
    const rows = openRows
      .map((row) => ({
        salesInvoiceId: partyType === "customer" ? row.invoiceId : null,
        purchaseInvoiceId: partyType === "supplier" ? row.invoiceId : null,
        amount: roundMoney(Math.max(0, Number(allocations[row.invoiceId]) || 0)),
      }))
      .filter((row) => row.amount > 0);

    setSaving(true);
    try {
      const payment = await getClientServices().transactions.createPayment(business.id, user.id, {
        direction,
        partyType,
        partyId,
        amount: parsedAmount,
        mode,
        reference: reference.trim() || null,
        paymentDate,
        notes: notes.trim() || null,
        allocations: rows,
      });
      toastSuccess(direction === "in" ? "Receipt recorded" : "Payment recorded", "The voucher was saved.");
      setLastPayment(payment);
      const contact = partyType === "customer" ? customerContact(party as Customer) : supplierContact(party as Supplier);
      const model = paymentReceiptPrintModel(payment, {
        partyLabel: party?.name ?? (partyType === "customer" ? "Customer" : "Supplier"),
        ...contact,
      });
      const auto = autoOutputDocument(business, invoiceDefaults ?? DEFAULT_INVOICE, model, currency);
      if (!auto.ok && auto.reason === "blocked") {
        toastInfo("Print blocked", "Payment saved. Use Print on the voucher if the browser blocked the dialog.");
      }
      setAmount("");
      setReference("");
      setNotes("");
      setAllocations({});
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["outstanding"] });
      await queryClient.invalidateQueries({ queryKey: ["party-ledger"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await outstandingQuery.refetch();
      onSaved?.();
    } catch (err) {
      toastError("Could not record payment", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Type" htmlFor="pay-direction" required>
          <Select
            id="pay-direction"
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as "in" | "out");
              setPartyId(null);
              setAllocations({});
            }}
          >
            <option value="in">Customer receipt</option>
            <option value="out">Supplier payment</option>
          </Select>
        </Field>
        <Field label={partyType === "customer" ? "Customer" : "Supplier"} htmlFor="pay-party" required>
          <Combobox
            options={(parties ?? []).map((item) => ({ value: item.id, label: item.name }))}
            value={partyId}
            onValueChange={(value) => {
              setPartyId(value);
              setAllocations({});
            }}
            placeholder={partyType === "customer" ? "Search customer…" : "Search supplier…"}
          />
        </Field>
        <Field label="Amount" htmlFor="pay-amount" required>
          <Input
            id="pay-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Date" htmlFor="pay-date">
          <DatePicker value={paymentDate} onValueChange={setPaymentDate} />
        </Field>
        <Field label="Mode" htmlFor="pay-mode">
          <Select id="pay-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            {(paymentModes ?? []).map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="pay-ref">
          <Input id="pay-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Cheque / UTR" />
        </Field>
        <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
          <Textarea id="pay-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
      </div>

      {partyId ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Allocate to invoices</p>
            <Button variant="outline" size="sm" onClick={allocateOldest} disabled={parsedAmount <= 0 || openRows.length === 0}>
              Allocate oldest first
            </Button>
          </div>
          {openRows.length === 0 ? (
            <Alert title="No open invoices">
              The full amount will be stored as an unallocated advance.
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Allocate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openRows.map((row) => {
                    const value = allocations[row.invoiceId] ?? "";
                    const checked = Number(value) > 0;
                    return (
                      <TableRow key={row.invoiceId}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onChange={(event) => toggleInvoice(row, event.target.checked)}
                            aria-label={`Allocate ${row.invoiceNo}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{row.invoiceNo}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(row.invoiceDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.balance, currency)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={row.balance}
                            step="0.01"
                            className="ml-auto w-28 text-right"
                            value={value}
                            onChange={(event) => setAllocation(row.invoiceId, event.target.value, row.balance)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <p className="text-muted-foreground">
              Allocated: <span className="font-medium text-foreground">{formatCurrency(allocatedTotal, currency)}</span>
            </p>
            <p className="text-muted-foreground">
              Unallocated advance:{" "}
              <span className="font-medium text-foreground">{formatCurrency(unallocated, currency)}</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a party to allocate this voucher against open invoices.</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => void submit()} loading={saving}>
          Save voucher
        </Button>
      </div>

      {lastPayment && business ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Last voucher: {lastPayment.documentNo ?? lastPayment.id.slice(0, 8)}
          </p>
          <DocumentPrintActions
            business={business}
            defaults={invoiceDefaults ?? DEFAULT_INVOICE}
            model={paymentReceiptPrintModel(lastPayment, {
              partyLabel: party?.name ?? "Party",
              ...(partyType === "customer" ? customerContact(party as Customer) : supplierContact(party as Supplier)),
            })}
            currency={currency}
          />
        </div>
      ) : null}
    </div>
  );
}
