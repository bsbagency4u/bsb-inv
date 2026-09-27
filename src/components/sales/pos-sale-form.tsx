"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Plus, ScanLine, Split, Trash2, UserPlus } from "lucide-react";
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
import { EmptyState } from "@/components/states/empty-state";
import { useToast } from "@/components/ui/toast";
import { GstEngine } from "@/services/gst.service";
import { normalizeError } from "@/lib/errors";
import { cn, formatCurrency } from "@/lib/utils";
import { businessShowsMrp, businessTracksBatches } from "@/config/business-types";
import {
  defaultUnitKind,
  formatBaseAvailable,
  oversellMessage,
  packagingFromProduct,
  resolveUnitKind,
  saleUnitOptions,
  toBaseQuantity,
  type UnitKind,
  validateSaleQuantity,
} from "@/lib/packaging";
import type { ProductVariant, ProductWithStock, SellableLot } from "@/types/domain";
import type { PartyValues } from "@/lib/validation/schemas";

type CustomerMode = "existing" | "walkin";
type DiscountKind = "amount" | "percent";

interface SaleLine {
  key: string;
  productId: string;
  variantId: string | null;
  batchId: string | null;
  mrp: number | null;
  quantity: number;
  unitKind: UnitKind;
  unitPrice: number;
  gstRate: number;
  discountKind: DiscountKind;
  discountValue: number;
}

const gst = new GstEngine();

function newLineKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

function variantLabel(variant: ProductVariant): string {
  const attrs = Object.entries(variant.attributes ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([, value]) => String(value));
  if (attrs.length > 0) return attrs.join(" / ");
  return variant.sku ?? "Variant";
}

function lineDiscountAmount(line: SaleLine): number {
  const gross = Math.max(0, line.quantity * line.unitPrice);
  if (line.discountKind === "percent") {
    return Math.min(gross, (gross * Math.max(0, line.discountValue)) / 100);
  }
  return Math.min(gross, Math.max(0, line.discountValue));
}

export function PosSaleForm({
  title = "Point of Sale",
  description = "Record a sale. Drafts do not reduce stock; completing the sale does.",
  afterSaveHref,
}: {
  title?: string;
  description?: string;
  afterSaveHref?: string;
}) {
  const router = useRouter();
  const { user, business } = useSession();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const [customerMode, setCustomerMode] = React.useState<CustomerMode>("walkin");
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [walkInName, setWalkInName] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = React.useState("");
  const [salesPersonId, setSalesPersonId] = React.useState("");
  const [intraStateOverride, setIntraStateOverride] = React.useState<boolean | null>(null);
  const [paymentModeOverride, setPaymentModeOverride] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<SaleLine[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [barcodeQuery, setBarcodeQuery] = React.useState("");
  const [invoiceDiscountKind, setInvoiceDiscountKind] = React.useState<DiscountKind>("amount");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = React.useState("0");
  const [invoiceDiscountTouched, setInvoiceDiscountTouched] = React.useState(false);
  const [paidAmount, setPaidAmount] = React.useState("");
  const [splitPayment, setSplitPayment] = React.useState(false);
  const [paymentSplits, setPaymentSplits] = React.useState<Array<{ key: string; mode: string; amount: string }>>([]);
  const [notes, setNotes] = React.useState<string | null>(null);
  const [attachmentNames, setAttachmentNames] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState<"draft" | "complete" | null>(null);
  const [createCustomerOpen, setCreateCustomerOpen] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    state: "",
    pincode: "",
  });
  const [creatingCustomer, setCreatingCustomer] = React.useState(false);

  const { data: customers, isError, error, refetch, isLoading } = useQuery({
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

  const { data: sellableLots } = useQuery({
    queryKey: ["sellable-lots", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().inventory.listSellableLots(business.id);
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

  const { data: salesDefaults } = useQuery({
    queryKey: ["sales-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getSalesDefaults(business.id);
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

  const { data: purchaseDefaults } = useQuery({
    queryKey: ["purchase-defaults", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().businesses.getPurchaseDefaults(business.id);
    },
    enabled: Boolean(business),
  });

  const { data: team } = useQuery({
    queryKey: ["team", business?.id],
    queryFn: async () => {
      if (!business) throw new Error("No active business.");
      return getClientServices().team.getSnapshot(business.id);
    },
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? "INR";
  const tracksBatches = businessTracksBatches(business?.type);
  const showsMrp = businessShowsMrp(business?.type);
  const intraState = intraStateOverride ?? salesDefaults?.defaultIntraState ?? taxDefaults?.defaultIntraState ?? true;
  const paymentMode = paymentModeOverride ?? salesDefaults?.defaultPaymentMode ?? (paymentModes?.[0]?.code ?? "cash");
  const allowLineDiscount = salesDefaults?.allowLineDiscount ?? true;
  const gstEnabled = taxDefaults?.gstEnabled ?? true;
  const warehouseValue = warehouseId || purchaseDefaults?.defaultWarehouseId || "";
  const salesPersonValue = salesPersonId || user?.id || "";
  const customer = customers?.find((item) => item.id === customerId) ?? null;
  const taxRateOptions = React.useMemo(() => {
    const rates = new Set<number>([0]);
    if (typeof taxDefaults?.defaultGstRate === "number") rates.add(taxDefaults.defaultGstRate);
    for (const product of products ?? []) rates.add(product.gstRate);
    return Array.from(rates).sort((a, b) => a - b);
  }, [products, taxDefaults]);

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

  const lotsForLine = React.useCallback(
    (productId: string, variantId: string | null): SellableLot[] => {
      return (sellableLots ?? []).filter((lot) => {
        if (lot.productId !== productId) return false;
        if (variantId && lot.variantId && lot.variantId !== variantId) return false;
        if (warehouseValue && lot.warehouseId && lot.warehouseId !== warehouseValue) return false;
        return lot.quantity > 0;
      });
    },
    [sellableLots, warehouseValue]
  );

  const pickLot = React.useCallback(
    (productId: string, variantId: string | null, batchId?: string | null): SellableLot | null => {
      const lots = lotsForLine(productId, variantId);
      if (batchId) return lots.find((lot) => lot.batchId === batchId) ?? lots[0] ?? null;
      return lots[0] ?? null;
    },
    [lotsForLine]
  );

  const defaultInvoicePercent = salesDefaults?.defaultDiscountPercent ?? 0;
  const invoiceDiscountKindResolved =
    invoiceDiscountTouched || defaultInvoicePercent <= 0 ? invoiceDiscountKind : "percent";
  const invoiceDiscountValueResolved =
    invoiceDiscountTouched || defaultInvoicePercent <= 0
      ? invoiceDiscountValue
      : String(defaultInvoicePercent);
  const invoiceDiscountInput = Math.max(0, Number(invoiceDiscountValueResolved) || 0);
  const totals = gst.computeTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: gstEnabled ? line.gstRate : 0,
      discount: lineDiscountAmount(line),
    })),
    invoiceDiscountKindResolved === "percent"
      ? { intraState, discountPercent: invoiceDiscountInput }
      : { intraState, discount: invoiceDiscountInput }
  );

  const amountToPay = totals.total;
  const simplePaid = paidAmount === "" ? amountToPay : Math.max(0, Number(paidAmount) || 0);
  const splitPaid = paymentSplits.reduce((sum, split) => sum + Math.max(0, Number(split.amount) || 0), 0);
  const amountPaid = splitPayment ? splitPaid : simplePaid;
  const balance = Math.max(0, amountToPay - amountPaid);
  const controlClass = "h-11";

  const enableSplitPayment = () => {
    setSplitPayment(true);
    setPaymentSplits((current) => {
      if (current.length > 0) return current;
      const alt = (paymentModes ?? []).find((mode) => mode.code !== paymentMode)?.code ?? paymentMode;
      return [
        { key: newLineKey(), mode: paymentMode, amount: paidAmount === "" ? String(amountToPay) : paidAmount },
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

  const printSale = () => {
    window.print();
  };

  const addProduct = (product: ProductWithStock) => {
    const productVariants = (variantsByProduct.get(product.id) ?? []).filter((variant) => variant.isActive);
    const variantId = productVariants[0]?.id ?? null;
    const lot = pickLot(product.id, variantId);
    const variant = productVariants[0];
    setLines((current) => [
      ...current,
      {
        key: newLineKey(),
        productId: product.id,
        variantId,
        batchId: lot?.batchId ?? null,
        mrp: lot?.mrp ?? variant?.mrp ?? product.mrp,
        quantity: 1,
        unitKind: defaultUnitKind(packagingFromProduct(product)),
        unitPrice: variant?.salePrice ?? product.salePrice,
        gstRate: gstEnabled && product.taxable ? product.gstRate : 0,
        discountKind: "amount",
        discountValue: 0,
      },
    ]);
  };

  const addSelectedProduct = () => {
    const product = productById.get(selectedProductId);
    if (!product) return;
    addProduct(product);
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
    addProduct(product);
    setBarcodeQuery("");
  };

  const updateLine = (key: string, patch: Partial<SaleLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const onProductChange = (key: string, productId: string) => {
    const product = productById.get(productId);
    if (!product) return;
    const productVariants = (variantsByProduct.get(product.id) ?? []).filter((variant) => variant.isActive);
    const variantId = productVariants[0]?.id ?? null;
    const lot = pickLot(product.id, variantId);
    updateLine(key, {
      productId: product.id,
      variantId,
      batchId: lot?.batchId ?? null,
      mrp: lot?.mrp ?? productVariants[0]?.mrp ?? product.mrp,
      unitKind: defaultUnitKind(packagingFromProduct(product)),
      unitPrice: productVariants[0]?.salePrice ?? product.salePrice,
      gstRate: gstEnabled && product.taxable ? product.gstRate : 0,
    });
  };

  const onVariantChange = (key: string, variantId: string | null) => {
    const line = lines.find((item) => item.key === key);
    if (!line) return;
    const product = productById.get(line.productId);
    const variant = (variantsByProduct.get(line.productId) ?? []).find((item) => item.id === variantId);
    const lot = pickLot(line.productId, variantId);
    updateLine(key, {
      variantId,
      batchId: lot?.batchId ?? null,
      mrp: lot?.mrp ?? variant?.mrp ?? product?.mrp ?? null,
      unitPrice: variant?.salePrice ?? product?.salePrice ?? line.unitPrice,
    });
  };

  const onLotChange = (key: string, batchId: string | null) => {
    const line = lines.find((item) => item.key === key);
    if (!line) return;
    const product = productById.get(line.productId);
    const lot = pickLot(line.productId, line.variantId, batchId);
    updateLine(key, {
      batchId: lot?.batchId ?? batchId,
      mrp: lot?.mrp ?? product?.mrp ?? null,
    });
  };

  const stockError = React.useMemo(() => {
    for (const line of lines) {
      const product = productById.get(line.productId);
      if (!product || !product.trackInventory) continue;
      const packaging = packagingFromProduct(product);
      const qtyError = validateSaleQuantity(
        line.quantity,
        packaging,
        resolveUnitKind(line.unitKind, packaging)
      );
      if (qtyError) return `${product.name}: ${qtyError}`;
      const usedBase = lines
        .filter((item) => {
          if (item.productId !== line.productId) return false;
          if (line.batchId) return item.batchId === line.batchId;
          return true;
        })
        .reduce((sum, item) => {
          const itemProduct = productById.get(item.productId);
          if (!itemProduct) return sum;
          const itemPackaging = packagingFromProduct(itemProduct);
          return (
            sum +
            toBaseQuantity(
              item.quantity,
              resolveUnitKind(item.unitKind, itemPackaging),
              itemPackaging
            )
          );
        }, 0);
      if (line.batchId) {
        const lot = lotsForLine(line.productId, line.variantId).find((item) => item.batchId === line.batchId);
        if (lot && usedBase > lot.quantity) {
          return oversellMessage(lot.quantity, product.unit);
        }
      } else if (usedBase > product.stockQuantity) {
        return oversellMessage(product.stockQuantity, product.unit);
      }
    }
    return null;
  }, [lines, productById, lotsForLine]);

  const priceError = React.useMemo(() => {
    if (!showsMrp) return null;
    for (const line of lines) {
      if (line.mrp != null && line.unitPrice > line.mrp) {
        const product = productById.get(line.productId);
        return `${product?.name ?? "Item"} sale price cannot exceed MRP ${line.mrp}.`;
      }
    }
    return null;
  }, [lines, productById, showsMrp]);

  const resetCart = () => {
    setLines([]);
    setCustomerId(null);
    setWalkInName("");
    setPaidAmount("");
    setSplitPayment(false);
    setPaymentSplits([]);
    setInvoiceDiscountValue("0");
    setInvoiceDiscountKind("amount");
    setInvoiceDiscountTouched(false);
    setNotes(null);
    setAttachmentNames([]);
    setSelectedProductId("");
    setBarcodeQuery("");
  };

  const saveSale = async (asDraft: boolean) => {
    if (!business || !user) return;
    if (lines.length === 0) {
      toastError("Empty cart", "Add at least one product.");
      return;
    }
    if (customerMode === "walkin" && !walkInName.trim()) {
      toastError("Customer name required", "Enter a walk-in customer name.");
      return;
    }
    if (!asDraft && stockError) {
      toastError("Insufficient stock", stockError);
      return;
    }
    if (priceError) {
      toastError("Price exceeds MRP", priceError);
      return;
    }
    if (!asDraft && amountPaid > amountToPay) {
      toastError("Invalid payment", "Amount paid cannot exceed the grand total.");
      return;
    }
    setSaving(asDraft ? "draft" : "complete");
    try {
      const services = getClientServices();
      const invoiceNo = await services.transactions.nextDocumentNo(
        business.id,
        business.invoicePrefix || "INV",
        "sales"
      );
      const salesperson = (team?.members ?? []).find((member) => member.userId === salesPersonValue);
      const extraNotes = [
        salesperson ? `Sales person: ${salesperson.fullName || salesperson.email}` : null,
        warehouseValue ? `Warehouse: ${(warehouses ?? []).find((w) => w.id === warehouseValue)?.name ?? warehouseValue}` : null,
        attachmentNames.length > 0 ? `Attachments: ${attachmentNames.join(", ")}` : null,
        notes,
      ]
        .filter(Boolean)
        .join("\n");
      const { totals: saved } = await services.transactions.createSalesInvoice(business.id, user.id, invoiceNo, {
        customerId: customerMode === "existing" ? customerId : null,
        walkInName: customerMode === "walkin" ? walkInName.trim() : null,
        warehouseId: warehouseValue || null,
        invoiceDate,
        notes: extraNotes || null,
        asDraft,
        intraState,
        discount: invoiceDiscountKindResolved === "amount" ? invoiceDiscountInput : undefined,
        discountPercent: invoiceDiscountKindResolved === "percent" ? invoiceDiscountInput : undefined,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          batchId: line.batchId,
          mrp: line.mrp,
          quantity: line.quantity,
          unitKind: line.unitKind,
          unitPrice: line.unitPrice,
          gstRate: gstEnabled ? line.gstRate : 0,
          discount: lineDiscountAmount(line),
        })),
        payments: asDraft
          ? []
          : splitPayment
            ? paymentSplits
                .map((split) => ({ mode: split.mode, amount: Math.max(0, Number(split.amount) || 0) }))
                .filter((split) => split.amount > 0)
            : amountPaid > 0
              ? [{ mode: paymentMode, amount: amountPaid }]
              : [],
      });
      toastSuccess(
        asDraft ? "Draft saved" : "Sale completed",
        asDraft
          ? `${invoiceNo} was saved as a draft. Stock was not updated.`
          : `${invoiceNo} for ${formatCurrency(saved.total, currency)} was recorded.`
      );
      resetCart();
      await queryClient.invalidateQueries({ queryKey: ["products-with-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["sellable-lots"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (afterSaveHref) router.push(afterSaveHref);
    } catch (err) {
      toastError(asDraft ? "Could not save draft" : "Could not complete sale", normalizeError(err).userMessage);
    } finally {
      setSaving(null);
    }
  };

  const createCustomerFromSale = async () => {
    if (!business || !user) return;
    const name = newCustomer.name.trim() || walkInName.trim();
    if (!name) {
      toastError("Name required", "Enter a customer name.");
      return;
    }
    setCreatingCustomer(true);
    try {
      const values: PartyValues = {
        name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        gstin: newCustomer.gstin,
        address: newCustomer.address,
        state: newCustomer.state,
        pincode: newCustomer.pincode,
        customerType: "regular",
      };
      const created = await getClientServices().parties.createCustomer(business.id, user.id, values);
      toastSuccess("Customer created", `${created.name} was added and attached to this sale.`);
      setCustomerMode("existing");
      setCustomerId(created.id);
      setWalkInName("");
      setCreateCustomerOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "", gstin: "", state: "", pincode: "" });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      toastError("Could not create customer", normalizeError(err).userMessage);
    } finally {
      setCreatingCustomer(false);
    }
  };

  if (!business) return <LoadingState label="Loading business…" />;
  if (isLoading) return <LoadingState label="Loading point of sale…" />;
  if (isError) {
    return (
      <ErrorState
        error={normalizeError(error).userMessage}
        onRetry={() => refetch()}
        title="Could not load the POS"
      />
    );
  }

  const customerOptions = (customers ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.id,
      label: item.name,
      description: [item.phone, item.gstin].filter(Boolean).join(" · ") || undefined,
    }));

  const productOptions = (products ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.id,
      label: item.name,
      description: [item.sku ? `SKU ${item.sku}` : null, item.barcode ? `BC ${item.barcode}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
    }));

  return (
    <div className="pb-28">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {afterSaveHref ? (
              <Button variant="outline" className={controlClass} onClick={() => router.push(afterSaveHref)} disabled={Boolean(saving)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : (
              <Button variant="outline" className={controlClass} onClick={resetCart} disabled={Boolean(saving)}>
                Clear cart
              </Button>
            )}
            <Button variant="outline" className={controlClass} onClick={printSale} disabled={Boolean(saving) || lines.length === 0}>
              Print
            </Button>
            <Button variant="outline" className={controlClass} onClick={() => void saveSale(true)} loading={saving === "draft"} disabled={Boolean(saving)}>
              Save draft
            </Button>
            <Button className="h-11 min-w-[148px] px-5" onClick={() => void saveSale(false)} loading={saving === "complete"} disabled={Boolean(saving)}>
              Complete sale
            </Button>
          </>
        }
      />

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Customer</CardTitle>
              <CardDescription>Walk-in sales do not create an account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="inline-flex rounded-md border border-border bg-surface-subtle p-1 text-sm">
                <button
                  type="button"
                  className={cn(
                    "h-9 rounded px-3 font-medium transition-colors",
                    customerMode === "existing" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setCustomerMode("existing")}
                >
                  Existing
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-9 rounded px-3 font-medium transition-colors",
                    customerMode === "walkin" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setCustomerMode("walkin")}
                >
                  Walk-in
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {customerMode === "existing" ? (
                  <Field label="Customer" htmlFor="pos-customer" className="flex-1">
                    <Combobox
                      options={customerOptions}
                      value={customerId}
                      onValueChange={setCustomerId}
                      placeholder="Search customer…"
                      emptyText="No customers yet."
                      triggerClassName={controlClass}
                    />
                  </Field>
                ) : (
                  <Field label="Customer name" htmlFor="pos-walkin" required className="flex-1">
                    <Input
                      id="pos-walkin"
                      value={walkInName}
                      onChange={(event) => setWalkInName(event.target.value)}
                      placeholder="Name for this sale"
                      className={controlClass}
                    />
                  </Field>
                )}
                <Button
                  variant="outline"
                  className={cn(controlClass, "shrink-0")}
                  onClick={() => {
                    setNewCustomer((current) => ({ ...current, name: walkInName }));
                    setCreateCustomerOpen(true);
                  }}
                >
                  <UserPlus className="size-4" />
                  New customer
                </Button>
              </div>
              {customerMode === "walkin" ? (
                <p className="text-xs text-muted-foreground">No customer account will be created.</p>
              ) : null}
              {customer ? (
                <div className="grid gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2.5 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">GSTIN</p>
                    <p className="font-medium">{customer.gstin || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{customer.phone || "—"}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Sale details</CardTitle>
              <CardDescription>Invoice number is assigned from the document sequence when you save.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Invoice number" htmlFor="pos-invoice-no">
                <Input id="pos-invoice-no" value="Assigned on save" disabled className={controlClass} />
              </Field>
              <Field label="Sale date" htmlFor="pos-date" required>
                <Input
                  id="pos-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  className={controlClass}
                />
              </Field>
              <Field label="Warehouse" htmlFor="pos-warehouse">
                <Select id="pos-warehouse" value={warehouseValue} onChange={(event) => setWarehouseId(event.target.value)} className={controlClass}>
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
              <Field label="Sales person" htmlFor="pos-salesperson">
                <Select
                  id="pos-salesperson"
                  value={salesPersonValue}
                  onChange={(event) => setSalesPersonId(event.target.value)}
                  className={controlClass}
                >
                  {(team?.members ?? [])
                    .filter((member) => member.status === "active")
                    .map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.email}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Tax treatment" htmlFor="pos-tax">
                <Select
                  id="pos-tax"
                  value={intraState ? "intra" : "inter"}
                  onChange={(event) => setIntraStateOverride(event.target.value === "intra")}
                  className={controlClass}
                >
                  <option value="intra">Intra-state (CGST + SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Cart</CardTitle>
              <CardDescription>Search by name, SKU or barcode. Totals come from the GST engine after discounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!products || products.length === 0 ? (
                <EmptyState
                  title="No products to sell"
                  description="Add products to the catalogue before using the register."
                  action={{ label: "Add products", href: "/inventory/products" }}
                />
              ) : (
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
                    <Button variant="outline" className={controlClass} onClick={addSelectedProduct} disabled={!selectedProductId}>
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
              )}

              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Add products to the cart. GST is calculated after discounts.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table className="min-w-[1560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Product</TableHead>
                        {tracksBatches ? <TableHead className="min-w-[132px]">Batch</TableHead> : null}
                        {tracksBatches ? <TableHead className="min-w-[110px]">Expiry</TableHead> : null}
                        <TableHead className="min-w-[110px] text-right">Available</TableHead>
                        <TableHead className="min-w-[100px]">Unit</TableHead>
                        <TableHead className="min-w-[96px] text-right">Qty</TableHead>
                        {showsMrp ? <TableHead className="min-w-[110px] text-right">MRP</TableHead> : null}
                        <TableHead className="min-w-[128px] text-right">Sale Price</TableHead>
                        {allowLineDiscount ? <TableHead className="min-w-[160px]">Discount</TableHead> : null}
                        <TableHead className="min-w-[100px] text-right">Tax</TableHead>
                        <TableHead className="min-w-[128px] text-right">Amount</TableHead>
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
                        return (
                          <TableRow key={line.key}>
                            <TableCell className="min-w-[220px] align-middle py-3">
                              <Combobox
                                options={productOptions}
                                value={line.productId}
                                onValueChange={(value) => {
                                  if (value) onProductChange(line.key, value);
                                }}
                                placeholder="Select product…"
                                triggerClassName={controlClass}
                              />
                              {productVariants.length > 0 ? (
                                <div className="mt-2">
                                  <Select
                                    value={line.variantId ?? ""}
                                    onChange={(event) => onVariantChange(line.key, event.target.value || null)}
                                    aria-label={`Variant for ${product?.name ?? "product"}`}
                                    className="h-11"
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
                            {tracksBatches ? (
                              <TableCell className="min-w-[132px] align-middle py-3">
                                {(() => {
                                  const lots = lotsForLine(line.productId, line.variantId);
                                  if (lots.length === 0) {
                                    return <p className="text-xs text-muted-foreground">No lot stock</p>;
                                  }
                                  return (
                                    <Select
                                      value={line.batchId ?? lots[0]?.batchId ?? ""}
                                      onChange={(event) => onLotChange(line.key, event.target.value || null)}
                                      aria-label={`Batch for ${product?.name ?? "product"}`}
                                      className="h-11 min-w-[132px] px-3"
                                    >
                                      {lots.map((lot) => (
                                        <option key={lot.batchId ?? "none"} value={lot.batchId ?? ""}>
                                          {lot.batchNo || "Lot"}
                                        </option>
                                      ))}
                                    </Select>
                                  );
                                })()}
                              </TableCell>
                            ) : null}
                            {tracksBatches ? (
                              <TableCell className="min-w-[110px] align-middle py-3 text-sm tabular-nums whitespace-nowrap">
                                {(() => {
                                  const lots = lotsForLine(line.productId, line.variantId);
                                  const lot = lots.find((item) => item.batchId === (line.batchId ?? lots[0]?.batchId)) ?? lots[0];
                                  return lot?.expiryDate || "—";
                                })()}
                              </TableCell>
                            ) : null}
                            <TableCell className="min-w-[110px] align-middle py-3 text-right text-sm tabular-nums whitespace-nowrap">
                              {(() => {
                                const packaging = packagingFromProduct(product ?? { unit: "pcs" });
                                const lot = line.batchId
                                  ? lotsForLine(line.productId, line.variantId).find((item) => item.batchId === line.batchId)
                                  : null;
                                const available = lot?.quantity ?? product?.stockQuantity ?? 0;
                                return formatBaseAvailable(available, packaging);
                              })()}
                            </TableCell>
                            <TableCell className="min-w-[100px] align-middle py-3">
                              {(() => {
                                const packaging = packagingFromProduct(product ?? { unit: "pcs" });
                                const options = saleUnitOptions(packaging);
                                if (options.length <= 1) {
                                  return <p className="text-sm">{options[0]?.code ?? product?.unit ?? "pcs"}</p>;
                                }
                                return (
                                  <Select
                                    value={resolveUnitKind(line.unitKind, packaging)}
                                    onChange={(event) => {
                                      const nextKind = event.target.value as UnitKind;
                                      const currentKind = resolveUnitKind(line.unitKind, packaging);
                                      if (nextKind === currentKind) return;
                                      const scaled =
                                        nextKind === "pack" && packaging.unitsPerPack > 1
                                          ? line.unitPrice * packaging.unitsPerPack
                                          : nextKind === "base" && packaging.unitsPerPack > 1
                                            ? line.unitPrice / packaging.unitsPerPack
                                            : line.unitPrice;
                                      updateLine(line.key, { unitKind: nextKind, unitPrice: scaled });
                                    }}
                                    aria-label={`Unit for ${product?.name ?? "product"}`}
                                    className="h-11 min-w-[90px] px-3"
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
                            <TableCell className="min-w-[96px] align-middle py-3">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(line.key, { quantity: Math.max(0, Number(event.target.value) || 0) })
                                }
                                className="h-11 min-w-[88px] px-3 text-right tabular-nums"
                                aria-label={`Quantity for ${product?.name ?? "product"}`}
                              />
                            </TableCell>
                            {showsMrp ? (
                              <TableCell className="min-w-[110px] align-middle py-3 text-right text-sm tabular-nums whitespace-nowrap">
                                {line.mrp != null ? formatCurrency(line.mrp, currency) : "—"}
                              </TableCell>
                            ) : null}
                            <TableCell className="min-w-[128px] align-middle py-3">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.key, { unitPrice: Math.max(0, Number(event.target.value) || 0) })
                                }
                                className="h-11 min-w-[128px] px-3 text-right tabular-nums"
                                aria-label={`Sale price for ${product?.name ?? "product"}`}
                              />
                            </TableCell>
                            {allowLineDiscount ? (
                              <TableCell className="min-w-[160px] align-middle py-3">
                                <div className="flex min-w-[160px] gap-2">
                                  <Select
                                    value={line.discountKind}
                                    onChange={(event) =>
                                      updateLine(line.key, { discountKind: event.target.value as DiscountKind })
                                    }
                                    className="h-11 w-[72px] shrink-0 px-2"
                                    aria-label={`Discount type for ${product?.name ?? "product"}`}
                                  >
                                    <option value="amount">{currency}</option>
                                    <option value="percent">%</option>
                                  </Select>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={line.discountValue}
                                    onChange={(event) =>
                                      updateLine(line.key, {
                                        discountValue: Math.max(0, Number(event.target.value) || 0),
                                      })
                                    }
                                    className="h-11 min-w-[72px] flex-1 px-3 text-right tabular-nums"
                                    aria-label={`Discount for ${product?.name ?? "product"}`}
                                  />
                                </div>
                              </TableCell>
                            ) : null}
                            <TableCell className="min-w-[100px] align-middle py-3">
                              <Select
                                value={String(line.gstRate)}
                                onChange={(event) =>
                                  updateLine(line.key, { gstRate: Number(event.target.value) || 0 })
                                }
                                className="h-11 min-w-[100px] px-3 text-right tabular-nums"
                                aria-label={`Tax for ${product?.name ?? "product"}`}
                                disabled={!gstEnabled}
                              >
                                {taxRateOptions.map((rate) => (
                                  <option key={rate} value={rate}>
                                    {rate}%
                                  </option>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell className="min-w-[120px] align-middle py-3 text-right text-sm tabular-nums whitespace-nowrap">
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
              {stockError ? <Alert variant="warning" title="Stock">{stockError}</Alert> : null}
              {priceError ? <Alert variant="warning" title="MRP">{priceError}</Alert> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Notes and attachments</CardTitle>
              <CardDescription>File names are recorded with the sale. Binaries are not stored on the invoice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Notes" htmlFor="pos-notes">
                <Textarea
                  id="pos-notes"
                  value={notes ?? ""}
                  onChange={(event) => setNotes(event.target.value || null)}
                  placeholder="Optional remarks"
                />
              </Field>
              <Field label="Attachments" htmlFor="pos-files" hint="Names are saved with notes.">
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground shadow-sm">
                  <Paperclip className="size-4" />
                  <span>{attachmentNames.length > 0 ? `${attachmentNames.length} file(s) selected` : "Choose files"}</span>
                  <input
                    id="pos-files"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) => setAttachmentNames(Array.from(event.target.files ?? []).map((file) => file.name))}
                  />
                </label>
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Order summary</CardTitle>
              <CardDescription>Discounts before GST. Authoritative GstEngine totals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field
                label="Invoice discount"
                htmlFor="pos-inv-disc"
                hint="Applied after item discounts and before GST"
              >
                <div className="flex gap-2">
                  <Select
                    value={invoiceDiscountKindResolved}
                    onChange={(event) => {
                      setInvoiceDiscountTouched(true);
                      setInvoiceDiscountKind(event.target.value as DiscountKind);
                    }}
                    className="h-11 w-28"
                  >
                    <option value="amount">Amount</option>
                    <option value="percent">Percent</option>
                  </Select>
                  <Input
                    id="pos-inv-disc"
                    type="number"
                    min={0}
                    step="0.01"
                    value={invoiceDiscountValueResolved}
                    onChange={(event) => {
                      setInvoiceDiscountTouched(true);
                      setInvoiceDiscountValue(event.target.value);
                    }}
                    className={controlClass}
                  />
                </div>
              </Field>
              <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              <SummaryRow label="Item discount" value={formatCurrency(totals.itemDiscount, currency)} />
              <SummaryRow label="Invoice discount" value={formatCurrency(totals.discount, currency)} />
              <SummaryRow label="Net taxable amount" value={formatCurrency(totals.taxableAmount, currency)} />
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
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
                {splitPayment ? "Split across modes. Modes come from settings." : "Leave amount paid empty to collect the full total."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-subtle px-3 py-2.5">
                <span className="text-muted-foreground">Amount to pay</span>
                <span className="text-base font-semibold tabular-nums">{formatCurrency(amountToPay, currency)}</span>
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
                  <Field label="Payment mode" htmlFor="pos-pay-mode">
                    <Select
                      id="pos-pay-mode"
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
                  <Field label="Amount paid" htmlFor="pos-paid">
                    <Input
                      id="pos-paid"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      placeholder={String(amountToPay)}
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
              onClick={() => void saveSale(false)}
              loading={saving === "complete"}
              disabled={Boolean(saving)}
            >
              Complete sale
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className={controlClass} onClick={() => void saveSale(true)} loading={saving === "draft"} disabled={Boolean(saving)}>
                Save draft
              </Button>
              <Button variant="outline" className={controlClass} onClick={printSale} disabled={Boolean(saving) || lines.length === 0}>
                Print
              </Button>
            </div>
          </div>

          <Alert variant="info" title={saving === "draft" ? "Draft" : "Stock"}>
            Save draft stores the sale without stock. Complete sale records payment and stock OUT through inventory.
          </Alert>
        </div>
      </div>

      <Modal
        open={createCustomerOpen}
        onClose={() => setCreateCustomerOpen(false)}
        title="Create customer from this sale"
        description="The new customer is attached to the current cart. Walk-in sales do not create accounts unless you do this."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateCustomerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createCustomerFromSale()} loading={creatingCustomer}>
              Save customer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="new-cust-name" required>
            <Input
              id="new-cust-name"
              value={newCustomer.name}
              onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" htmlFor="new-cust-phone">
              <Input
                id="new-cust-phone"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="new-cust-email">
              <Input
                id="new-cust-email"
                type="email"
                value={newCustomer.email}
                onChange={(event) => setNewCustomer((current) => ({ ...current, email: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="new-cust-address">
            <Input
              id="new-cust-address"
              value={newCustomer.address}
              onChange={(event) => setNewCustomer((current) => ({ ...current, address: event.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="GSTIN" htmlFor="new-cust-gstin">
              <Input
                id="new-cust-gstin"
                value={newCustomer.gstin}
                onChange={(event) => setNewCustomer((current) => ({ ...current, gstin: event.target.value }))}
              />
            </Field>
            <Field label="State" htmlFor="new-cust-state">
              <Input
                id="new-cust-state"
                value={newCustomer.state}
                onChange={(event) => setNewCustomer((current) => ({ ...current, state: event.target.value }))}
              />
            </Field>
            <Field label="Pincode" htmlFor="new-cust-pincode">
              <Input
                id="new-cust-pincode"
                value={newCustomer.pincode}
                onChange={(event) => setNewCustomer((current) => ({ ...current, pincode: event.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}


