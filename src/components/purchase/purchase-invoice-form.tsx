"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Paperclip, Plus, ScanLine, Split, Trash2, UserPlus } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { useToast } from "@/components/ui/toast";
import { GstEngine, GST_RATE_OPTIONS } from "@/services/gst.service";
import { normalizeError } from "@/lib/errors";
import { cn, formatCurrency } from "@/lib/utils";
import {
  businessShowsMrp,
  businessTracksBatches,
  getProductAttributesForType,
} from "@/config/business-types";
import {
  defaultUnitKind,
  packagingFromProduct,
  purchaseUnitOptions,
  resolvePurchaseUnitKind,
  type UnitKind,
} from "@/lib/packaging";
import type { PartyValues } from "@/lib/validation/schemas";
import type { ProductVariant, ProductWithStock, Supplier } from "@/types/domain";

interface PurchaseLine {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitKind: UnitKind;
  unitPrice: number;
  gstRate: number;
  discount: number;
  batchNo: string;
  expiryDate: string;
  mrp: string;
}

const gst = new GstEngine();
const controlClass = "h-11";

function newLineKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

function supplierDescription(supplier: Supplier): string {
  return [supplier.gstin, supplier.city, supplier.state].filter(Boolean).join(" · ");
}

function variantLabel(variant: ProductVariant): string {
  const attrs = Object.entries(variant.attributes ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([, value]) => String(value));
  if (attrs.length > 0) return attrs.join(" / ");
  return variant.sku ?? "Variant";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PurchaseInvoiceForm() {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState<string>("");
  const [warehouseOverride, setWarehouseOverride] = React.useState<string | null>(null);
  const [intraStateOverride, setIntraStateOverride] = React.useState<boolean | null>(null);
  const [discount, setDiscount] = React.useState("0");
  const [notesOverride, setNotesOverride] = React.useState<string | null | undefined>(undefined);
  const [lines, setLines] = React.useState<PurchaseLine[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [barcodeQuery, setBarcodeQuery] = React.useState("");
  const [attachmentNames, setAttachmentNames] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState<"draft" | "complete" | null>(null);
  const [vendorInvoiceNo, setVendorInvoiceNo] = React.useState("");
  const [reverseCharge, setReverseCharge] = React.useState(false);
  const [placeOfSupplyOverride, setPlaceOfSupplyOverride] = React.useState<string | null>(null);
  const [paymentModeOverride, setPaymentModeOverride] = React.useState<string | null>(null);
  const [paidAmount, setPaidAmount] = React.useState("");
  const [splitPayment, setSplitPayment] = React.useState(false);
  const [paymentSplits, setPaymentSplits] = React.useState<Array<{ key: string; mode: string; amount: string }>>([]);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [createSupplierOpen, setCreateSupplierOpen] = React.useState(false);
  const [creatingSupplier, setCreatingSupplier] = React.useState(false);
  const [newSupplier, setNewSupplier] = React.useState({
    name: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    paymentTerms: "",
  });

  const { data: suppliers, isLoading: suppliersLoading, isError, error, refetch } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().parties.listSuppliers(business.id);
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

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listWarehouses(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: variants } = useQuery({
    queryKey: ["product-variants", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().products.listVariants(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: purchaseDefaults } = useQuery({
    queryKey: ["purchase-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getPurchaseDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: taxDefaults } = useQuery({
    queryKey: ["tax-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getTaxDefaults(business.id);
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

  const { data: paymentModes } = useQuery({
    queryKey: ["payment-modes", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPaymentModes(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: purchaseInvoices } = useQuery({
    queryKey: ["purchase-invoices", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().transactions.listPurchaseInvoices(business.id);
    },
    enabled: Boolean(business),
  });

  const warehouseId = warehouseOverride ?? purchaseDefaults?.defaultWarehouseId ?? "";
  const notes = notesOverride === undefined ? (purchaseDefaults?.defaultPaymentTerms || null) : notesOverride;
  const intraState = intraStateOverride ?? purchaseDefaults?.defaultIntraState ?? taxDefaults?.defaultIntraState ?? true;
  const currency = business?.currency ?? "INR";
  const tracksBatches = businessTracksBatches(business?.type);
  const showsMrp = businessShowsMrp(business?.type);
  const showsManufacturer = getProductAttributesForType(business?.type).some((item) => item.key === "manufacturer");
  const gstEnabled = taxDefaults?.gstEnabled ?? true;
  const supplier = suppliers?.find((item) => item.id === supplierId) ?? null;
  const paymentMode = paymentModeOverride ?? (paymentModes?.[0]?.code ?? "cash");
  const paymentTerms = supplier?.paymentTerms || purchaseDefaults?.defaultPaymentTerms || "";
  const placeOfSupply = placeOfSupplyOverride ?? supplier?.state ?? business?.state ?? "";

  const productById = React.useMemo(() => {
    const map = new Map<string, ProductWithStock>();
    for (const product of products ?? []) map.set(product.id, product);
    return map;
  }, [products]);

  const variantsByProduct = React.useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const variant of variants ?? []) {
      const list = map.get(variant.productId) ?? [];
      list.push(variant);
      map.set(variant.productId, list);
    }
    return map;
  }, [variants]);

  const taxRateOptions = React.useMemo(() => {
    const rates = new Set<number>(GST_RATE_OPTIONS);
    if (typeof taxDefaults?.defaultGstRate === "number") rates.add(taxDefaults.defaultGstRate);
    for (const product of products ?? []) rates.add(product.gstRate);
    return Array.from(rates).sort((a, b) => a - b);
  }, [products, taxDefaults]);

  const outstanding = React.useMemo(() => {
    if (!supplier) return 0;
    const openBills = (purchaseInvoices ?? []).filter((bill) => {
      if (bill.supplierId !== supplier.id) return false;
      if (bill.status === "draft" || bill.status === "cancelled") return false;
      return bill.total - bill.paidAmount > 0;
    });
    const unpaid = openBills.reduce((sum, bill) => sum + Math.max(0, bill.total - bill.paidAmount), 0);
    return Math.max(0, (supplier.openingBalance ?? 0) + unpaid);
  }, [supplier, purchaseInvoices]);

  const invoiceDiscount = Math.max(0, Number(discount) || 0);
  const totals = gst.computeTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: gstEnabled ? line.gstRate : 0,
      discount: line.discount,
    })),
    { intraState, discount: invoiceDiscount }
  );

  const amountToPay = totals.total;
  const simplePaid = paidAmount === "" ? 0 : Math.max(0, Number(paidAmount) || 0);
  const splitPaid = paymentSplits.reduce((sum, split) => sum + Math.max(0, Number(split.amount) || 0), 0);
  const amountPaid = splitPayment ? splitPaid : simplePaid;
  const balance = Math.max(0, amountToPay - amountPaid);
  const paymentStatus = amountPaid <= 0 ? "Credit / Unpaid" : amountPaid >= amountToPay && amountToPay > 0 ? "Paid" : "Partially paid";

  const buildLine = (product: ProductWithStock): PurchaseLine => {
    const productVariants = (variantsByProduct.get(product.id) ?? []).filter((variant) => variant.isActive);
    const variant = productVariants[0];
    return {
      key: newLineKey(),
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: 1,
      unitKind: defaultUnitKind(packagingFromProduct(product)),
      unitPrice: variant?.purchasePrice ?? product.purchasePrice,
      gstRate: gstEnabled && product.taxable ? product.gstRate : 0,
      discount: 0,
      batchNo: "",
      expiryDate: "",
      mrp: (variant?.mrp ?? product.mrp) != null ? String(variant?.mrp ?? product.mrp) : "",
    };
  };

  const addProductLine = () => {
    if (!selectedProductId) return;
    const product = productById.get(selectedProductId);
    if (!product) return;
    setLines((current) => [...current, buildLine(product)]);
    setSelectedProductId("");
  };

  const addByCode = () => {
    const q = barcodeQuery.trim().toLowerCase();
    if (!q) return;
    const product = (products ?? []).find(
      (item) =>
        item.barcode?.toLowerCase() === q ||
        item.sku?.toLowerCase() === q ||
        item.name.toLowerCase() === q
    );
    if (!product) {
      toastError("Product not found", "No product matches that SKU or barcode.");
      return;
    }
    setLines((current) => [...current, buildLine(product)]);
    setBarcodeQuery("");
  };

  const updateLine = (key: string, patch: Partial<PurchaseLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const onProductChange = (key: string, productId: string) => {
    const product = productById.get(productId);
    if (!product) return;
    const next = buildLine(product);
    updateLine(key, { ...next, key });
  };

  const onVariantChange = (key: string, variantId: string | null) => {
    const line = lines.find((item) => item.key === key);
    if (!line) return;
    const variant = (variantsByProduct.get(line.productId) ?? []).find((item) => item.id === variantId);
    const product = productById.get(line.productId);
    updateLine(key, {
      variantId,
      unitPrice: variant?.purchasePrice ?? product?.purchasePrice ?? line.unitPrice,
      mrp: (variant?.mrp ?? product?.mrp) != null ? String(variant?.mrp ?? product?.mrp) : "",
    });
  };

  const enableSplitPayment = () => {
    setSplitPayment(true);
    setPaymentSplits((current) => {
      if (current.length > 0) return current;
      const alt = (paymentModes ?? []).find((mode) => mode.code !== paymentMode)?.code ?? paymentMode;
      return [
        { key: newLineKey(), mode: paymentMode, amount: paidAmount },
        { key: newLineKey(), mode: alt, amount: "" },
      ];
    });
  };

  const disableSplitPayment = () => {
    const remaining = paymentSplits[0];
    setSplitPayment(false);
    if (remaining) {
      setPaymentModeOverride(remaining.mode);
      setPaidAmount(remaining.amount);
    }
    setPaymentSplits([]);
  };

  const addPaymentSplit = () => {
    const unused = (paymentModes ?? []).find((mode) => !paymentSplits.some((split) => split.mode === mode.code));
    setPaymentSplits((current) => [
      ...current,
      { key: newLineKey(), mode: unused?.code ?? paymentMode, amount: "" },
    ]);
  };

  const updatePaymentSplit = (key: string, patch: Partial<{ mode: string; amount: string }>) => {
    setPaymentSplits((current) => current.map((split) => (split.key === key ? { ...split, ...patch } : split)));
  };

  const removePaymentSplit = (key: string) => {
    const next = paymentSplits.filter((split) => split.key !== key);
    if (next.length <= 1) {
      const remaining = next[0] ?? paymentSplits[0];
      setSplitPayment(false);
      if (remaining) {
        setPaymentModeOverride(remaining.mode);
        setPaidAmount(remaining.amount);
      }
      setPaymentSplits([]);
      return;
    }
    setPaymentSplits(next);
  };

  const paymentAllocations = () => {
    if (splitPayment) {
      return paymentSplits
        .map((split) => ({ mode: split.mode, amount: Math.max(0, Number(split.amount) || 0) }))
        .filter((split) => split.amount > 0);
    }
    return amountPaid > 0 ? [{ mode: paymentMode, amount: amountPaid }] : [];
  };

  const saveInvoice = async (asDraft: boolean) => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("No items", "Add at least one line item to record a bill.");
      return;
    }
    if (!asDraft && amountPaid > amountToPay) {
      toastError("Invalid payment", "Amount paid cannot exceed the grand total.");
      return;
    }
    setSaving(asDraft ? "draft" : "complete");
    try {
      const services = getClientServices();
      const billNo = await services.transactions.nextDocumentNo(business.id, "BILL", "purchase_invoice");
      const extraNotes = [
        vendorInvoiceNo.trim() ? `Vendor invoice: ${vendorInvoiceNo.trim()}` : null,
        paymentTerms ? `Payment terms: ${paymentTerms}` : null,
        placeOfSupply ? `Place of supply: ${placeOfSupply}` : null,
        reverseCharge ? "Reverse charge: yes" : null,
        invoiceDefaults?.termsAndConditions ? `Terms: ${invoiceDefaults.termsAndConditions}` : null,
        attachmentNames.length > 0 ? `Attachments: ${attachmentNames.join(", ")}` : null,
        notes,
      ]
        .filter(Boolean)
        .join("\n");
      const invoice = await services.transactions.createPurchaseInvoice(business.id, user.id, billNo, {
        supplierId,
        warehouseId: warehouseId || purchaseDefaults?.defaultWarehouseId || null,
        invoiceDate,
        dueDate: dueDate || null,
        notes: extraNotes || null,
        asDraft,
        discount: invoiceDiscount,
        intraState,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitKind: line.unitKind,
          unitPrice: line.unitPrice,
          gstRate: gstEnabled ? line.gstRate : 0,
          discount: line.discount,
          batchNo: line.batchNo.trim() || null,
          expiryDate: line.expiryDate || null,
          mrp: line.mrp === "" ? null : Number(line.mrp),
        })),
      });
      if (!asDraft) {
        for (const allocation of paymentAllocations()) {
          await services.transactions.createPayment(business.id, user.id, {
            direction: "out",
            partyType: "supplier",
            partyId: supplierId,
            purchaseInvoiceId: invoice.id,
            amount: allocation.amount,
            mode: allocation.mode,
          });
        }
      }
      toastSuccess(
        asDraft ? "Draft saved" : "Purchase recorded",
        asDraft
          ? `Bill ${billNo} was saved as a draft. Stock was not updated.`
          : `Bill ${billNo} was saved and stock updated.`
      );
      await queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      router.push("/purchase/invoices");
    } catch (err) {
      toastError(asDraft ? "Could not save draft" : "Could not record purchase", normalizeError(err).userMessage);
    } finally {
      setSaving(null);
    }
  };

  const createSupplierFromBill = async () => {
    if (!business || !user) return;
    const name = newSupplier.name.trim();
    if (!name) {
      toastError("Name required", "Enter a supplier name.");
      return;
    }
    setCreatingSupplier(true);
    try {
      const values: PartyValues = {
        name,
        phone: newSupplier.phone,
        email: newSupplier.email,
        gstin: newSupplier.gstin,
        address: newSupplier.address,
        city: newSupplier.city,
        state: newSupplier.state,
        pincode: newSupplier.pincode,
        paymentTerms: newSupplier.paymentTerms,
      };
      const created = await getClientServices().parties.createSupplier(business.id, user.id, values);
      toastSuccess("Supplier created", `${created.name} was added and selected.`);
      setSupplierId(created.id);
      setCreateSupplierOpen(false);
      setNewSupplier({
        name: "",
        phone: "",
        email: "",
        gstin: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        paymentTerms: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err) {
      toastError("Could not create supplier", normalizeError(err).userMessage);
    } finally {
      setCreatingSupplier(false);
    }
  };

  if (!business) return <LoadingState label="Loading business…" />;
  if (suppliersLoading) return <LoadingState label="Loading purchase form…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load purchase form"
      />
    );
  }

  const supplierOptions = (suppliers ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.id,
      label: item.name,
      description: supplierDescription(item) || undefined,
    }));

  const productOptions = (products ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.id,
      label: item.name,
      description: [item.sku ? `SKU ${item.sku}` : null, item.hsn ? `HSN ${item.hsn}` : null, item.barcode ? `BC ${item.barcode}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
    }));

  return (
    <div className="pb-28">
      <PageHeader
        title="New purchase invoice"
        description="Record a supplier bill. Drafts do not update stock; Save & Receive Goods does."
        actions={
          <>
            <Button variant="outline" className={controlClass} onClick={() => router.push("/purchase/invoices")} disabled={Boolean(saving)}>
              <ArrowLeft className="size-4" />
              Cancel
            </Button>
            <Button variant="outline" className={controlClass} onClick={() => window.print()} disabled={Boolean(saving) || lines.length === 0}>
              Preview
            </Button>
            <Button variant="outline" className={controlClass} onClick={() => void saveInvoice(true)} loading={saving === "draft"} disabled={Boolean(saving)}>
              Save as draft
            </Button>
            <Button className="h-11 min-w-[180px] px-5" onClick={() => void saveInvoice(false)} loading={saving === "complete"} disabled={Boolean(saving)}>
              Save & Receive Goods
            </Button>
          </>
        }
      />

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Supplier</CardTitle>
              <CardDescription>Search an existing supplier. GSTIN, phone and terms come from the party record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="Supplier" htmlFor="purchase-supplier" required className="flex-1">
                  <Combobox
                    options={supplierOptions}
                    value={supplierId}
                    onValueChange={setSupplierId}
                    placeholder="Search supplier…"
                    emptyText="No suppliers yet."
                    triggerClassName={controlClass}
                  />
                </Field>
                <Button variant="outline" className={cn(controlClass, "shrink-0")} onClick={() => setCreateSupplierOpen(true)}>
                  <UserPlus className="size-4" />
                  New supplier
                </Button>
              </div>
              {supplier ? (
                <div className="grid gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">GSTIN</p>
                    <p className="font-medium text-foreground">{supplier.gstin || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{supplier.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-medium tabular-nums text-foreground">{formatCurrency(outstanding, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Credit terms</p>
                    <p className="font-medium text-foreground">{paymentTerms || "—"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Select a supplier to see GSTIN, outstanding and terms.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Bill details</CardTitle>
              <CardDescription>Bill number is assigned from the document sequence when you save.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bill number" htmlFor="purchase-bill-no">
                <Input id="purchase-bill-no" value="Assigned on save" disabled className={controlClass} />
              </Field>
              <Field label="Vendor invoice number" htmlFor="purchase-vendor-no" required>
                <Input
                  id="purchase-vendor-no"
                  value={vendorInvoiceNo}
                  onChange={(event) => setVendorInvoiceNo(event.target.value)}
                  placeholder="Supplier bill no."
                  className={controlClass}
                />
              </Field>
              <Field label="Bill date" htmlFor="purchase-date" required>
                <Input
                  id="purchase-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  className={controlClass}
                />
              </Field>
              <Field label="Due date" htmlFor="purchase-due">
                <Input
                  id="purchase-due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={controlClass}
                />
              </Field>
              <Field label="Payment terms" htmlFor="purchase-terms">
                <Input id="purchase-terms" value={paymentTerms || "—"} disabled className={controlClass} />
              </Field>
              <Field label="Warehouse / Branch" htmlFor="purchase-warehouse">
                <Select
                  id="purchase-warehouse"
                  value={warehouseId}
                  onChange={(event) => setWarehouseOverride(event.target.value)}
                  className={controlClass}
                >
                  <option value="">Default warehouse</option>
                  {(warehouses ?? [])
                    .filter((warehouse) => warehouse.isActive)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Tax treatment" htmlFor="purchase-tax">
                <Select
                  id="purchase-tax"
                  value={intraState ? "intra" : "inter"}
                  onChange={(event) => setIntraStateOverride(event.target.value === "intra")}
                  className={controlClass}
                >
                  <option value="intra">Intra-state (CGST + SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                </Select>
              </Field>
              <Field label="Place of supply" htmlFor="purchase-pos">
                <Input
                  id="purchase-pos"
                  value={placeOfSupply}
                  onChange={(event) => setPlaceOfSupplyOverride(event.target.value)}
                  placeholder="State"
                  className={controlClass}
                />
              </Field>
              <div className="flex h-11 items-center justify-between gap-4 rounded-md border border-border px-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Reverse charge</p>
                  <p className="text-xs text-muted-foreground">Recorded with the bill notes.</p>
                </div>
                <Switch checked={reverseCharge} onCheckedChange={setReverseCharge} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Purchase items</CardTitle>
              <CardDescription>Search by name, SKU or barcode. Totals come from the GST engine after discounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex gap-2">
                  <Combobox
                    options={productOptions}
                    value={selectedProductId || null}
                    onValueChange={(value) => setSelectedProductId(value ?? "")}
                    placeholder="Search product, SKU…"
                    emptyText="No products yet."
                    className="flex-1"
                    triggerClassName={controlClass}
                  />
                  <Button variant="outline" className={controlClass} onClick={addProductLine} disabled={!selectedProductId}>
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={barcodeQuery}
                    onChange={(event) => setBarcodeQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addByCode();
                      }
                    }}
                    placeholder="Scan or type barcode / SKU"
                    className={controlClass}
                  />
                  <Button variant="outline" className={controlClass} onClick={addByCode} disabled={!barcodeQuery.trim()}>
                    <ScanLine className="size-4" />
                    Scan
                  </Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Add products to build the bill. GST is calculated after discounts.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table className="min-w-[1480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="min-w-[220px]">Product</TableHead>
                        <TableHead className="min-w-[140px]">SKU / Details</TableHead>
                        <TableHead className="min-w-[88px]">HSN</TableHead>
                        {tracksBatches ? <TableHead className="min-w-[120px]">Batch</TableHead> : null}
                        {tracksBatches ? <TableHead className="min-w-[132px]">Expiry</TableHead> : null}
                        {showsMrp ? <TableHead className="min-w-[110px] text-right">MRP</TableHead> : null}
                        <TableHead className="min-w-[110px]">Unit / Pack</TableHead>
                        <TableHead className="min-w-[96px] text-right">Bill Qty</TableHead>
                        <TableHead className="min-w-[128px] text-right">Purchase Rate</TableHead>
                        <TableHead className="min-w-[110px] text-right">Discount</TableHead>
                        <TableHead className="min-w-[120px] text-right">Taxable</TableHead>
                        <TableHead className="min-w-[100px] text-right">GST</TableHead>
                        <TableHead className="min-w-[128px] text-right">Total</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => {
                        const product = productById.get(line.productId);
                        const productVariants = (variantsByProduct.get(line.productId) ?? []).filter(
                          (variant) => variant.isActive
                        );
                        const computed = totals.lines[index];
                        const packaging = packagingFromProduct(product ?? { unit: "pcs" });
                        const unitOptions = purchaseUnitOptions(packaging);
                        const manufacturer =
                          showsManufacturer && product?.attributes?.manufacturer
                            ? String(product.attributes.manufacturer)
                            : null;
                        return (
                          <TableRow key={line.key}>
                            <TableCell className="align-middle py-3 text-xs text-muted-foreground tabular-nums">
                              {index + 1}
                            </TableCell>
                            <TableCell className="min-w-[220px] align-middle py-3">
                              <Combobox
                                options={productOptions}
                                value={line.productId}
                                onValueChange={(value) => {
                                  if (value) onProductChange(line.key, value);
                                }}
                                placeholder="Select product…"
                                emptyText="No products yet."
                                triggerClassName={controlClass}
                              />
                              {productVariants.length > 0 ? (
                                <div className="mt-2">
                                  <Select
                                    value={line.variantId ?? ""}
                                    onChange={(event) => onVariantChange(line.key, event.target.value || null)}
                                    aria-label={`Variant for ${product?.name ?? "product"}`}
                                    className={controlClass}
                                  >
                                    {productVariants.map((variant) => (
                                      <option key={variant.id} value={variant.id}>
                                        {variantLabel(variant)}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="min-w-[140px] align-middle py-3 text-xs text-muted-foreground">
                              <p>{product?.sku ? `SKU ${product.sku}` : "—"}</p>
                              {packaging.packUnit && packaging.unitsPerPack > 1 ? (
                                <p>
                                  1 {packaging.packUnit} = {packaging.unitsPerPack} {packaging.unit}
                                </p>
                              ) : null}
                              {manufacturer ? <p>{manufacturer}</p> : null}
                            </TableCell>
                            <TableCell className="min-w-[88px] align-middle py-3 text-sm tabular-nums">
                              {product?.hsn || taxDefaults?.defaultHsnCode || "—"}
                            </TableCell>
                            {tracksBatches ? (
                              <TableCell className="min-w-[120px] align-middle py-3">
                                <Input
                                  value={line.batchNo}
                                  onChange={(event) => updateLine(line.key, { batchNo: event.target.value })}
                                  className={cn(controlClass, "min-w-[120px] px-3")}
                                  aria-label={`Batch for ${product?.name ?? "product"}`}
                                />
                              </TableCell>
                            ) : null}
                            {tracksBatches ? (
                              <TableCell className="min-w-[132px] align-middle py-3">
                                <Input
                                  type="date"
                                  value={line.expiryDate}
                                  onChange={(event) => updateLine(line.key, { expiryDate: event.target.value })}
                                  className={cn(controlClass, "min-w-[132px] px-3")}
                                  aria-label={`Expiry for ${product?.name ?? "product"}`}
                                />
                              </TableCell>
                            ) : null}
                            {showsMrp ? (
                              <TableCell className="min-w-[110px] align-middle py-3">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={line.mrp}
                                  onChange={(event) => updateLine(line.key, { mrp: event.target.value })}
                                  className={cn(controlClass, "min-w-[110px] px-3 text-right tabular-nums")}
                                  aria-label={`MRP for ${product?.name ?? "product"}`}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell className="min-w-[110px] align-middle py-3">
                              {unitOptions.length <= 1 ? (
                                <p className="text-sm">{unitOptions[0]?.code ?? product?.unit ?? "pcs"}</p>
                              ) : (
                                <Select
                                  value={resolvePurchaseUnitKind(line.unitKind, packaging)}
                                  onChange={(event) =>
                                    updateLine(line.key, { unitKind: event.target.value as UnitKind })
                                  }
                                  aria-label={`Unit for ${product?.name ?? "product"}`}
                                  className={cn(controlClass, "min-w-[100px] px-3")}
                                >
                                  {unitOptions.map((option) => (
                                    <option key={option.kind} value={option.kind}>
                                      {option.code}
                                    </option>
                                  ))}
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="min-w-[96px] align-middle py-3">
                              <Input
                                type="number"
                                step="any"
                                min={0}
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(line.key, { quantity: Math.max(0, Number(event.target.value) || 0) })
                                }
                                className={cn(controlClass, "min-w-[88px] px-3 text-right tabular-nums")}
                                aria-label={`Quantity for ${product?.name ?? "product"}`}
                              />
                            </TableCell>
                            <TableCell className="min-w-[128px] align-middle py-3">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.key, { unitPrice: Math.max(0, Number(event.target.value) || 0) })
                                }
                                className={cn(controlClass, "min-w-[128px] px-3 text-right tabular-nums")}
                                aria-label={`Purchase rate for ${product?.name ?? "product"}`}
                              />
                            </TableCell>
                            <TableCell className="min-w-[110px] align-middle py-3">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={line.discount}
                                onChange={(event) =>
                                  updateLine(line.key, { discount: Math.max(0, Number(event.target.value) || 0) })
                                }
                                className={cn(controlClass, "min-w-[96px] px-3 text-right tabular-nums")}
                                aria-label={`Discount for ${product?.name ?? "product"}`}
                              />
                            </TableCell>
                            <TableCell className="min-w-[120px] align-middle py-3 text-right text-sm tabular-nums whitespace-nowrap">
                              {formatCurrency(computed?.taxableAmount ?? 0, currency)}
                            </TableCell>
                            <TableCell className="min-w-[100px] align-middle py-3">
                              <Select
                                value={String(line.gstRate)}
                                onChange={(event) =>
                                  updateLine(line.key, { gstRate: Number(event.target.value) || 0 })
                                }
                                className={cn(controlClass, "min-w-[100px] px-3 text-right tabular-nums")}
                                aria-label={`Tax rate for ${product?.name ?? "product"}`}
                                disabled={!gstEnabled}
                              >
                                {taxRateOptions.map((rate) => (
                                  <option key={rate} value={rate}>
                                    {rate}%
                                  </option>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell className="min-w-[128px] align-middle py-3 text-right text-sm font-medium tabular-nums whitespace-nowrap">
                              {formatCurrency(computed?.amount ?? 0, currency)}
                            </TableCell>
                            <TableCell className="w-12 align-middle py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeLine(line.key)}
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
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 text-left"
              onClick={() => setNotesOpen((current) => !current)}
            >
              <div>
                <CardTitle>Notes and attachments</CardTitle>
                <CardDescription>Optional remarks, terms and file names stored with the bill.</CardDescription>
              </div>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", notesOpen && "rotate-180")} />
            </button>
            {notesOpen ? (
              <CardContent className="space-y-4">
                <Field label="Notes / Remarks" htmlFor="purchase-notes">
                  <Textarea
                    id="purchase-notes"
                    value={notes ?? ""}
                    onChange={(event) => setNotesOverride(event.target.value || null)}
                    placeholder="Payment terms, reference, or remarks"
                  />
                </Field>
                {invoiceDefaults?.termsAndConditions ? (
                  <Field label="Terms & conditions" htmlFor="purchase-tcs">
                    <Textarea id="purchase-tcs" value={invoiceDefaults.termsAndConditions} disabled />
                  </Field>
                ) : null}
                <Field label="Bill attachment" htmlFor="purchase-files" hint="Names are saved with notes. Upload storage for bills is not configured.">
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground shadow-sm">
                    <Paperclip className="size-4" />
                    <span>{attachmentNames.length > 0 ? `${attachmentNames.length} file(s) selected` : "Choose files"}</span>
                    <input
                      id="purchase-files"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        setAttachmentNames(files.map((file) => file.name));
                      }}
                    />
                  </label>
                </Field>
                {attachmentNames.length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {attachmentNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Financial summary</CardTitle>
              <CardDescription>Discounts before GST. Authoritative GstEngine totals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Invoice discount" htmlFor="purchase-discount" hint="Applied after item discounts and before GST">
                <Input
                  id="purchase-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={controlClass}
                />
              </Field>
              <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              <SummaryRow label="Item discount" value={formatCurrency(totals.itemDiscount, currency)} />
              <SummaryRow label="Invoice discount" value={formatCurrency(totals.discount, currency)} />
              <SummaryRow label="Taxable amount" value={formatCurrency(totals.taxableAmount, currency)} />
              {intraState ? (
                <>
                  {totals.cgst > 0 ? <SummaryRow label="CGST" value={formatCurrency(totals.cgst, currency)} /> : null}
                  {totals.sgst > 0 ? <SummaryRow label="SGST" value={formatCurrency(totals.sgst, currency)} /> : null}
                </>
              ) : totals.igst > 0 ? (
                <SummaryRow label="IGST" value={formatCurrency(totals.igst, currency)} />
              ) : null}
              <SummaryRow label="Total GST" value={formatCurrency(totals.taxAmount, currency)} />
              <SummaryRow label="Round off" value={formatCurrency(totals.roundOff, currency)} />
              <div className="rounded-md border border-border bg-surface-subtle px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grand total</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums leading-none text-foreground">
                  {formatCurrency(totals.total, currency)}
                </p>
              </div>
              <Badge variant="info">Preview</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Payment</CardTitle>
              <CardDescription>
                {splitPayment ? "Split across modes. Modes come from settings." : "Leave amount paid empty to record as credit."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-subtle px-3 py-2.5">
                <span className="text-muted-foreground">Amount payable</span>
                <span className="text-base font-semibold tabular-nums">{formatCurrency(amountToPay, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={amountPaid <= 0 ? "warning" : balance > 0 ? "info" : "success"}>{paymentStatus}</Badge>
              </div>
              {splitPayment ? (
                <div className="space-y-2">
                  {paymentSplits.map((split) => (
                    <div key={split.key} className="flex gap-2">
                      <Select
                        value={split.mode}
                        onChange={(event) => updatePaymentSplit(split.key, { mode: event.target.value })}
                        className="h-11 min-w-[120px] flex-1"
                        aria-label="Split payment mode"
                      >
                        {(paymentModes ?? []).map((mode) => (
                          <option key={mode.id} value={mode.code}>
                            {mode.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={split.amount}
                        onChange={(event) => updatePaymentSplit(split.key, { amount: event.target.value })}
                        className="h-11 w-[120px] px-3 text-right tabular-nums"
                        aria-label="Split amount"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removePaymentSplit(split.key)}
                        aria-label="Remove split"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" className={controlClass} onClick={addPaymentSplit}>
                      <Plus className="size-4" />
                      Add mode
                    </Button>
                    <Button variant="ghost" className={controlClass} onClick={disableSplitPayment}>
                      Simple payment
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Field label="Payment mode" htmlFor="purchase-pay-mode">
                    <Select
                      id="purchase-pay-mode"
                      value={paymentMode}
                      onChange={(event) => setPaymentModeOverride(event.target.value)}
                      className={controlClass}
                    >
                      {(paymentModes ?? []).map((mode) => (
                        <option key={mode.id} value={mode.code}>
                          {mode.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Amount paid" htmlFor="purchase-paid">
                    <Input
                      id="purchase-paid"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      placeholder="0"
                      className={controlClass}
                    />
                  </Field>
                  <Button variant="outline" className={cn(controlClass, "w-full")} onClick={enableSplitPayment}>
                    <Split className="size-4" />
                    Split payment
                  </Button>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-base font-semibold tabular-nums">{formatCurrency(amountPaid, currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={cn("text-base font-semibold tabular-nums", balance > 0 && "text-warning")}>
                    {formatCurrency(balance, currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button
              className="h-12 w-full text-base"
              onClick={() => void saveInvoice(false)}
              loading={saving === "complete"}
              disabled={Boolean(saving)}
            >
              Save & Receive Goods
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className={controlClass} onClick={() => void saveInvoice(true)} loading={saving === "draft"} disabled={Boolean(saving)}>
                Save as draft
              </Button>
              <Button variant="outline" className={controlClass} onClick={() => window.print()} disabled={Boolean(saving) || lines.length === 0}>
                Preview
              </Button>
            </div>
            <Button variant="ghost" className={cn(controlClass, "w-full")} onClick={() => router.push("/purchase/invoices")} disabled={Boolean(saving)}>
              Cancel
            </Button>
          </div>

          <Alert variant="info" title={saving === "draft" ? "Draft" : "Stock"}>
            Save as draft stores the bill without stock. Save & Receive Goods records stock IN through inventory.
          </Alert>
        </div>
      </div>

      <Modal
        open={createSupplierOpen}
        onClose={() => setCreateSupplierOpen(false)}
        title="Create supplier"
        description="The new supplier is selected on this bill."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateSupplierOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createSupplierFromBill()} loading={creatingSupplier}>
              Save supplier
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="new-sup-name" required>
            <Input
              id="new-sup-name"
              value={newSupplier.name}
              onChange={(event) => setNewSupplier((current) => ({ ...current, name: event.target.value }))}
              className={controlClass}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" htmlFor="new-sup-phone">
              <Input
                id="new-sup-phone"
                value={newSupplier.phone}
                onChange={(event) => setNewSupplier((current) => ({ ...current, phone: event.target.value }))}
                className={controlClass}
              />
            </Field>
            <Field label="Email" htmlFor="new-sup-email">
              <Input
                id="new-sup-email"
                type="email"
                value={newSupplier.email}
                onChange={(event) => setNewSupplier((current) => ({ ...current, email: event.target.value }))}
                className={controlClass}
              />
            </Field>
          </div>
          <Field label="GSTIN" htmlFor="new-sup-gstin">
            <Input
              id="new-sup-gstin"
              value={newSupplier.gstin}
              onChange={(event) => setNewSupplier((current) => ({ ...current, gstin: event.target.value }))}
              className={controlClass}
            />
          </Field>
          <Field label="Address" htmlFor="new-sup-address">
            <Input
              id="new-sup-address"
              value={newSupplier.address}
              onChange={(event) => setNewSupplier((current) => ({ ...current, address: event.target.value }))}
              className={controlClass}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" htmlFor="new-sup-city">
              <Input
                id="new-sup-city"
                value={newSupplier.city}
                onChange={(event) => setNewSupplier((current) => ({ ...current, city: event.target.value }))}
                className={controlClass}
              />
            </Field>
            <Field label="State" htmlFor="new-sup-state">
              <Input
                id="new-sup-state"
                value={newSupplier.state}
                onChange={(event) => setNewSupplier((current) => ({ ...current, state: event.target.value }))}
                className={controlClass}
              />
            </Field>
            <Field label="Pincode" htmlFor="new-sup-pincode">
              <Input
                id="new-sup-pincode"
                value={newSupplier.pincode}
                onChange={(event) => setNewSupplier((current) => ({ ...current, pincode: event.target.value }))}
                className={controlClass}
              />
            </Field>
          </div>
          <Field label="Payment terms" htmlFor="new-sup-terms">
            <Input
              id="new-sup-terms"
              value={newSupplier.paymentTerms}
              onChange={(event) => setNewSupplier((current) => ({ ...current, paymentTerms: event.target.value }))}
              className={controlClass}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
