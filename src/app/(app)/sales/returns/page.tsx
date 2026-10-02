"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Undo2 } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  packagingFromProduct,
  resolveUnitKind,
  saleUnitOptions,
  unitKindFromSaleUnit,
  type UnitKind,
} from "@/lib/packaging";
import type { SalesInvoice } from "@/types/domain";

interface ReturnLine {
  productId: string;
  quantity: string;
  unitPrice: string;
  unitKind: UnitKind;
}

export default function SalesReturnsPage() {
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [invoiceId, setInvoiceId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<ReturnLine[]>([]);
  const [saving, setSaving] = React.useState(false);

  const { data: returns, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sales-returns", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listSalesReturns(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: invoices } = useQuery({
    queryKey: ["sales-invoices", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listSalesInvoices(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listCustomers(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: products } = useQuery({
    queryKey: ["products-with-stock", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listProductsWithStock(business.id);
    },
    enabled: Boolean(business),
  });

  if (isLoading) return <LoadingState label="Loading sales returns…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load sales returns"
      />
    );
  }

  const openCreate = () => {
    setInvoiceId(null);
    setReason("");
    setNotes("");
    setLines([]);
    setCreateOpen(true);
  };

  const selectedInvoice: SalesInvoice | null =
    invoices?.find((invoice) => invoice.id === invoiceId) ?? null;

  const lineFromInvoiceItem = (item: SalesInvoice["items"][number]): ReturnLine => {
    const product = (products ?? []).find((entry) => entry.id === item.productId);
    const packaging = packagingFromProduct(product ?? { unit: "pcs" });
    return {
      productId: item.productId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      unitKind: unitKindFromSaleUnit(item.saleUnit, packaging),
    };
  };

  const addLine = () => {
    if (!selectedInvoice || selectedInvoice.items.length === 0) return;
    const used = new Set(lines.map((line) => line.productId));
    const nextItem = selectedInvoice.items.find((item) => !used.has(item.productId));
    if (!nextItem) return;
    setLines((current) => [...current, lineFromInvoiceItem(nextItem)]);
  };

  const updateLine = (index: number, patch: Partial<ReturnLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, i) => i !== index));
  };

  const returnableInvoices = (invoices ?? []).filter(
    (invoice) => invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "returned"
  );

  const submit = async () => {
    if (!business || !user) return;
    if (!selectedInvoice) {
      toastError("Invoice required", "Select the original sales invoice.");
      return;
    }
    if (lines.length === 0) {
      toastError("No items", "Add at least one returned item.");
      return;
    }
    setSaving(true);
    try {
      const services = getClientServices();
      const returnNo = await services.transactions.nextDocumentNo(
        business.id,
        "SRT",
        "sales_return"
      );
      const result = await services.transactions.createSalesReturn(business.id, user.id, returnNo, {
        salesInvoiceId: selectedInvoice?.id ?? null,
        customerId: selectedInvoice?.customerId ?? null,
        reason: reason || null,
        notes: notes || null,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          unitKind: line.unitKind,
        })),
      });
      toastSuccess("Return recorded", `${result.returnNo} saved and stock updated.`);
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
    } catch (err) {
      toastError("Could not record return", normalizeError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales Returns"
        description="Accept returned goods, refund customers and restore stock."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Record return
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {!returns || returns.length === 0 ? (
          <EmptyState
            icon={<Undo2 className="size-6" />}
            title="No sales returns yet"
            description="Record a return to accept goods back and restore stock."
            action={{ label: "Record return", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">{item.returnNo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(item.returnDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customers?.find((c) => c.id === item.customerId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.total, business?.currency ?? "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.reason ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record sales return"
        description="Returns must be against a completed sales invoice."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Record return
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Sales invoice" htmlFor="sreturn-invoice" required>
            <Combobox
              options={returnableInvoices.map((invoice) => ({
                value: invoice.id,
                label: invoice.invoiceNo,
                description:
                  customers?.find((c) => c.id === invoice.customerId)?.name ?? undefined,
              }))}
              value={invoiceId}
              onValueChange={(value) => {
                setInvoiceId(value);
                const invoice = (invoices ?? []).find((item) => item.id === value);
                if (!invoice) {
                  setLines([]);
                  return;
                }
                setLines(invoice.items.map((item) => lineFromInvoiceItem(item)));
              }}
              placeholder="Select a sales invoice…"
              emptyText="No returnable invoices."
            />
          </Field>
          <Field label="Reason" htmlFor="sreturn-reason">
            <Input
              id="sreturn-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. damaged, defective, wrong item"
            />
          </Field>

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border p-3">
              <p className="text-sm font-medium text-foreground">Returned items</p>
              <Button variant="outline" size="sm" onClick={addLine} disabled={!selectedInvoice}>
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Add items to return.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28">Unit</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Unit price</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Combobox
                          options={(selectedInvoice?.items ?? []).map((item) => {
                            const product = (products ?? []).find((entry) => entry.id === item.productId);
                            return {
                              value: item.productId,
                              label: product?.name ?? item.productId,
                              description: product?.sku ?? undefined,
                            };
                          })}
                          value={line.productId}
                          onValueChange={(value) => {
                            const item = selectedInvoice?.items.find((entry) => entry.productId === value);
                            if (!item) return;
                            updateLine(index, lineFromInvoiceItem(item));
                          }}
                          placeholder="Select product…"
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const product = (products ?? []).find((item) => item.id === line.productId);
                          const packaging = packagingFromProduct(product ?? { unit: "pcs" });
                          const options = saleUnitOptions(packaging);
                          const kind = resolveUnitKind(line.unitKind, packaging);
                          if (options.length <= 1) {
                            return <p className="text-sm">{options[0]?.code ?? product?.unit ?? "pcs"}</p>;
                          }
                          return (
                            <Select
                              value={kind}
                              onChange={(event) =>
                                updateLine(index, { unitKind: event.target.value as UnitKind })
                              }
                              className="h-8"
                              aria-label="Return unit"
                            >
                              {options.map((option) => (
                                <option key={option.kind} value={option.kind}>
                                  {option.code}
                                </option>
                              ))}
                            </Select>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={line.quantity}
                          onChange={(event) => updateLine(index, { quantity: event.target.value })}
                          className="h-8 text-right"
                          aria-label="Return quantity"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={line.unitPrice}
                          onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                          className="h-8 text-right"
                          aria-label="Unit price"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(index)}
                          className="text-destructive hover:text-destructive"
                          aria-label="Remove line"
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Field label="Notes" htmlFor="sreturn-notes">
            <Textarea
              id="sreturn-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
