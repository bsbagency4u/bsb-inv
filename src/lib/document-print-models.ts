import type {
  Customer,
  LineItem,
  Payment,
  ProductWithStock,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
  Supplier,
} from "@/types/domain";
import type { PrintDocumentModel, PrintLine } from "@/lib/invoice-print";

function productLookup(products: ProductWithStock[] | undefined | null) {
  return new Map((products ?? []).map((product) => [product.id, product]));
}

function lineFromItem(item: LineItem, product?: ProductWithStock | null): PrintLine {
  return {
    name: product?.name ?? item.productId,
    sku: product?.sku ?? null,
    hsn: product?.hsn ?? null,
    quantity: item.quantity,
    unit: item.saleUnit,
    unitPrice: item.unitPrice,
    discount: item.discount,
    gstRate: item.gstRate,
    amount: item.amount,
  };
}

export function salesInvoicePrintModel(
  invoice: SalesInvoice,
  options: {
    partyLabel: string;
    partyGstin?: string | null;
    partyPhone?: string | null;
    products?: ProductWithStock[] | null;
  }
): PrintDocumentModel {
  const byId = productLookup(options.products);
  return {
    kind: "sales_invoice",
    docNo: invoice.invoiceNo,
    docDate: invoice.invoiceDate,
    partyLabel: options.partyLabel,
    partyGstin: options.partyGstin,
    partyPhone: options.partyPhone,
    notes: invoice.notes,
    paymentMode: invoice.paymentMode,
    paidAmount: invoice.paidAmount,
    lines: invoice.items.map((item) => lineFromItem(item, byId.get(item.productId))),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
  };
}

export function purchaseInvoicePrintModel(
  invoice: PurchaseInvoice,
  options: {
    partyLabel: string;
    partyGstin?: string | null;
    partyPhone?: string | null;
    products?: ProductWithStock[] | null;
  }
): PrintDocumentModel {
  const byId = productLookup(options.products);
  return {
    kind: "purchase_invoice",
    docNo: invoice.billNo,
    docDate: invoice.invoiceDate,
    partyLabel: options.partyLabel,
    partyGstin: options.partyGstin,
    partyPhone: options.partyPhone,
    notes: invoice.notes,
    paidAmount: invoice.paidAmount,
    lines: invoice.items.map((item) => lineFromItem(item, byId.get(item.productId))),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
  };
}

export function salesReturnPrintModel(
  item: SalesReturn,
  options: {
    partyLabel: string;
    partyGstin?: string | null;
    partyPhone?: string | null;
    products?: ProductWithStock[] | null;
  }
): PrintDocumentModel {
  const byId = productLookup(options.products);
  const lines: PrintLine[] = item.items.map((line) => {
    const product = byId.get(line.productId);
    const amount = line.quantity * line.unitPrice;
    return {
      name: product?.name ?? line.productId,
      sku: product?.sku ?? null,
      hsn: product?.hsn ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: 0,
      amount,
    };
  });
  return {
    kind: "sales_return",
    docNo: item.returnNo,
    docDate: item.returnDate,
    partyLabel: options.partyLabel,
    partyGstin: options.partyGstin,
    partyPhone: options.partyPhone,
    notes: [item.reason, item.notes].filter(Boolean).join("\n") || null,
    paidAmount: item.total,
    lines,
    subtotal: item.total,
    discount: 0,
    taxTotal: 0,
    total: item.total,
  };
}

export function purchaseReturnPrintModel(
  item: PurchaseReturn,
  options: {
    partyLabel: string;
    partyGstin?: string | null;
    partyPhone?: string | null;
    products?: ProductWithStock[] | null;
  }
): PrintDocumentModel {
  const byId = productLookup(options.products);
  const lines: PrintLine[] = item.items.map((line) => {
    const product = byId.get(line.productId);
    const amount = line.quantity * line.unitCost;
    return {
      name: product?.name ?? line.productId,
      sku: product?.sku ?? null,
      hsn: product?.hsn ?? null,
      quantity: line.quantity,
      unitPrice: line.unitCost,
      gstRate: 0,
      amount,
    };
  });
  return {
    kind: "purchase_return",
    docNo: item.returnNo,
    docDate: item.returnDate,
    partyLabel: options.partyLabel,
    partyGstin: options.partyGstin,
    partyPhone: options.partyPhone,
    notes: [item.reason, item.notes].filter(Boolean).join("\n") || null,
    paidAmount: item.total,
    lines,
    subtotal: item.total,
    discount: 0,
    taxTotal: 0,
    total: item.total,
  };
}

export function paymentReceiptPrintModel(
  payment: Payment,
  options: {
    partyLabel: string;
    partyGstin?: string | null;
    partyPhone?: string | null;
    referenceNo?: string | null;
  }
): PrintDocumentModel {
  const title = payment.direction === "in" ? "Receipt" : "Payment";
  return {
    kind: "payment_receipt",
    docNo: payment.documentNo || payment.reference || `${title}-${payment.id.slice(0, 8)}`,
    docDate: payment.paymentDate,
    partyLabel: options.partyLabel,
    partyGstin: options.partyGstin,
    partyPhone: options.partyPhone,
    notes: payment.notes,
    paymentMode: payment.mode,
    paidAmount: payment.amount,
    lines: [
      {
        name: options.referenceNo
          ? `${title} against ${options.referenceNo}`
          : `${title} recorded`,
        quantity: 1,
        unitPrice: payment.amount,
        gstRate: 0,
        amount: payment.amount,
      },
    ],
    subtotal: payment.amount,
    discount: 0,
    taxTotal: 0,
    total: payment.amount,
  };
}

export function customerContact(customer: Customer | null | undefined) {
  return {
    partyGstin: customer?.gstin ?? null,
    partyPhone: customer?.phone ?? null,
  };
}

export function supplierContact(supplier: Supplier | null | undefined) {
  return {
    partyGstin: supplier?.gstin ?? null,
    partyPhone: supplier?.phone ?? null,
  };
}
