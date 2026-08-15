"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { GstEngine } from "@/services/gst.service";
import { formatCurrency } from "@/lib/utils";
import type { ProductWithStock } from "@/types/domain";

export interface CartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface TransactionBuilderProps {
  currency: string;
  products: ProductWithStock[];
  partyType: "customer" | "supplier";
  parties: Array<{ id: string; name: string; gstin: string | null }>;
  partyLabel: string;
  partyValue: string | null;
  onPartyChange: (value: string | null) => void;
  intraState: boolean;
  onIntraStateChange: (value: boolean) => void;
  lines: CartLine[];
  onLinesChange: (lines: CartLine[]) => void;
  notes: string | null;
  onNotesChange: (notes: string | null) => void;
  date: string;
  onDateChange: (date: string) => void;
  dueDate: string | null;
  onDueDateChange: (date: string | null) => void;
  showDueDate?: boolean;
}

const gst = new GstEngine();

export function TransactionBuilder({
  currency,
  products,
  partyType,
  parties,
  partyLabel,
  partyValue,
  onPartyChange,
  intraState,
  onIntraStateChange,
  lines,
  onLinesChange,
  notes,
  onNotesChange,
  date,
  onDateChange,
  dueDate,
  onDueDateChange,
  showDueDate = false,
}: TransactionBuilderProps) {
  const [selectedId, setSelectedId] = React.useState<string>("");

  const partyOptions = parties.map((p) => ({
    value: p.id,
    label: p.name,
    description: p.gstin ?? undefined,
  }));

  const addLine = () => {
    if (!selectedId) return;
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;
    const existing = lines.find((line) => line.productId === selectedId);
    if (existing) {
      onLinesChange(
        lines.map((line) =>
          line.productId === selectedId
            ? { ...line, quantity: line.quantity + 1 }
            : line
        )
      );
    } else {
      onLinesChange([
        ...lines,
        {
          productId: product.id,
          quantity: 1,
          unitPrice: partyType === "supplier" ? product.purchasePrice : product.salePrice,
          gstRate: product.gstRate,
        },
      ]);
    }
    setSelectedId("");
  };

  const updateLine = (productId: string, patch: Partial<CartLine>) => {
    onLinesChange(lines.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  };

  const removeLine = (productId: string) => {
    onLinesChange(lines.filter((line) => line.productId !== productId));
  };

  const totals = gst.computeTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: line.gstRate,
    })),
    { intraState }
  );

  const productOptions = products
    .filter((p) => p.isActive)
    .map((p) => ({
      value: p.id,
      label: p.name,
      description: p.sku ? `SKU ${p.sku}` : undefined,
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={partyLabel} htmlFor="builder-party">
          <Combobox
            options={partyOptions}
            value={partyValue}
            onValueChange={onPartyChange}
            placeholder={`Select ${partyType}…`}
            emptyText={`No ${partyType}s yet.`}
          />
        </Field>
        <Field
          label="Transaction date"
          htmlFor="builder-date"
        >
          <Input
            id="builder-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </Field>
        {showDueDate ? (
          <Field label="Due date" htmlFor="builder-due">
            <Input
              id="builder-due"
              type="date"
              value={dueDate ?? ""}
              onChange={(event) => onDueDateChange(event.target.value || null)}
            />
          </Field>
        ) : null}
        <Field label="Tax treatment" htmlFor="builder-tax">
          <Select
            id="builder-tax"
            value={intraState ? "intra" : "inter"}
            onChange={(event) => onIntraStateChange(event.target.value === "intra")}
          >
            <option value="intra">Intra-state (CGST + SGST)</option>
            <option value="inter">Inter-state (IGST)</option>
          </Select>
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Combobox
            options={productOptions}
            value={selectedId || null}
            onValueChange={(value) => setSelectedId(value ?? "")}
            placeholder="Add product…"
            emptyText="No products yet."
            className="flex-1"
          />
          <Button variant="outline" onClick={addLine} disabled={!selectedId}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Add products to build the document. Line totals update automatically.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Price</TableHead>
                <TableHead className="w-24 text-right">GST</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                const amount = line.quantity * line.unitPrice * (1 + line.gstRate / 100);
                return (
                  <TableRow key={line.productId}>
                    <TableCell className="font-medium text-foreground">
                      {product?.name ?? "Unknown product"}
                      {product ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          stock: {product.stockQuantity}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            quantity: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        className="h-8 text-right"
                        aria-label={`Quantity for ${product?.name ?? "product"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            unitPrice: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        className="h-8 text-right"
                        aria-label={`Unit price for ${product?.name ?? "product"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={String(line.gstRate)}
                        onChange={(event) =>
                          updateLine(line.productId, { gstRate: Number(event.target.value) || 0 })
                        }
                        className="h-8 text-right"
                        aria-label={`GST rate for ${product?.name ?? "product"}`}
                      >
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(amount, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLine(line.productId)}
                        aria-label={`Remove ${product?.name ?? "product"}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col items-end gap-1 border-t border-border p-4 text-sm">
          <div className="flex w-56 items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          <div className="flex w-56 items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{formatCurrency(totals.taxAmount, currency)}</span>
          </div>
          {totals.gstLines.map((line) =>
            line.taxAmount > 0 ? (
              <div key={line.rate} className="flex w-56 items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {intraState
                    ? `${line.rate}% · CGST ${formatCurrency(line.cgst, currency)} + SGST ${formatCurrency(line.sgst, currency)}`
                    : `${line.rate}% · IGST ${formatCurrency(line.igst, currency)}`}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(line.taxAmount, currency)}
                </span>
              </div>
            ) : null
          )}
          <div className="mt-1 flex w-56 items-center justify-between border-t border-border pt-2 font-semibold">
            <span className="text-foreground">Total</span>
            <span className="tabular-nums text-foreground">{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      <Field label="Notes" htmlFor="builder-notes">
        <Textarea
          id="builder-notes"
          value={notes ?? ""}
          onChange={(event) => onNotesChange(event.target.value || null)}
          placeholder="Optional notes printed on the document"
        />
      </Field>

      {lines.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          <Badge variant="info" className="mr-1">
            Preview
          </Badge>
          GST is computed automatically using the tax treatment above.
        </p>
      )}
    </div>
  );
}
