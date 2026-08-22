import type { Repositories, LineItemInput } from "@/repositories/types";
import type {
  InvoiceTotals,
  Payment,
  PurchaseInvoice,
  PurchaseOrder,
  SalesInvoice,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import { escapeRegExp } from "@/lib/utils";
import { GstEngine } from "./gst.service";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";

export interface SalesInput {
  customerId?: string | null;
  invoiceDate?: string;
  dueDate?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    discount?: number;
  }>;
  intraState?: boolean;
}

export interface PurchaseInput {
  supplierId?: string | null;
  orderDate?: string;
  invoiceDate?: string;
  expectedDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    discount?: number;
  }>;
  intraState?: boolean;
}

export interface PaymentInput {
  direction: "in" | "out";
  partyType: "customer" | "supplier";
  partyId?: string | null;
  salesInvoiceId?: string | null;
  purchaseInvoiceId?: string | null;
  amount: number;
  mode: string;
  reference?: string | null;
  paymentDate?: string;
  notes?: string | null;
}

/**
 * Transaction service — creates sales invoices, purchase orders/invoices and
 * payments, computing GST via the GstEngine and writing stock movements.
 * No Supabase access here; all I/O goes through repositories.
 */
export class TransactionService {
  private gst = new GstEngine();

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService
  ) {}

  private validateItems(items: { quantity: number; unitPrice: number }[]): void {
    if (items.length === 0) {
      throw AppError.validation("Add at least one line item.");
    }
    for (const item of items) {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw AppError.validation("Line items need a positive quantity and a valid price.");
      }
    }
  }

  private toLineItemInput(item: SalesInput["items"][number]): LineItemInput {
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      discount: item.discount ?? 0,
    };
  }

  async createSalesInvoice(
    businessId: string,
    userId: string,
    invoiceNo: string,
    input: SalesInput
  ): Promise<{ invoice: SalesInvoice; totals: InvoiceTotals }> {
    this.validateItems(input.items);

    const totals = this.gst.computeTotals(input.items, {
      intraState: input.intraState ?? true,
    });

    const invoice = await this.repos.transactions.createSalesInvoice(
      businessId,
      userId,
      {
        invoiceNo,
        customerId: input.customerId ?? null,
        invoiceDate: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate ?? null,
        status: "finalized",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: 0,
        paymentMode: input.paymentMode ?? null,
        notes: input.notes ?? null,
      },
      input.items.map(this.toLineItemInput)
    );

    // Stock out per line item.
    for (const item of input.items) {
      await this.repos.products.addStockMovement({
        businessId,
        productId: item.productId,
        change: -item.quantity,
        movementType: "SALE",
        reason: "sale",
        referenceType: "sales_invoice",
        referenceId: invoice.id,
        userId,
      });
    }

    await this.audits.log({
      businessId,
      userId,
      action: "invoice.created",
      entityType: "sales_invoice",
      entityId: invoice.id,
      metadata: { invoiceNo, total: totals.total },
    });
    await this.notifications.create(businessId, {
      title: `Invoice ${invoiceNo} created`,
      description: `Total ${totals.total.toFixed(2)}.`,
      type: "success",
      href: "/sales/invoices",
    });

    return { invoice, totals };
  }

  async listSalesInvoices(businessId: string): Promise<SalesInvoice[]> {
    return this.repos.transactions.listSalesInvoices(businessId);
  }

  /** Next sequential document number for a given prefix. */
  async nextDocumentNo(
    businessId: string,
    prefix: string,
    startNumber: number,
    kind: "sales" | "purchase-order" | "purchase-invoice"
  ): Promise<string> {
    let existing: string[] = [];
    if (kind === "sales") {
      existing = (await this.repos.transactions.listSalesInvoices(businessId)).map(
        (i) => i.invoiceNo
      );
    } else if (kind === "purchase-order") {
      existing = (await this.repos.transactions.listPurchaseOrders(businessId)).map(
        (o) => o.orderNo
      );
    } else {
      existing = (await this.repos.transactions.listPurchaseInvoices(businessId)).map(
        (i) => i.billNo
      );
    }
    const prefixUpper = prefix.toUpperCase();
    let max = startNumber - 1;
    for (const number of existing) {
      const match = new RegExp(`^${escapeRegExp(prefixUpper)}-?(\\d+)$`).exec(number.toUpperCase());
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
    return `${prefixUpper}-${max + 1}`;
  }

  async getSalesInvoice(businessId: string, invoiceId: string): Promise<SalesInvoice | null> {
    return this.repos.transactions.getSalesInvoice(businessId, invoiceId);
  }

  async cancelSalesInvoice(
    businessId: string,
    userId: string,
    invoiceId: string
  ): Promise<void> {
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    if (invoice.status === "cancelled") return;

    await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoiceId, "cancelled");

    // Restore stock.
    for (const item of invoice.items) {
      await this.repos.products.addStockMovement({
        businessId,
        productId: item.productId,
        change: item.quantity,
        movementType: "SALE_RETURN",
        reason: "return",
        referenceType: "sales_invoice",
        referenceId: invoiceId,
        userId,
      });
    }

    await this.audits.log({
      businessId,
      userId,
      action: "invoice.cancelled",
      entityType: "sales_invoice",
      entityId: invoiceId,
      metadata: { invoiceNo: invoice.invoiceNo },
    });
  }

  async createPurchaseOrder(
    businessId: string,
    userId: string,
    orderNo: string,
    input: PurchaseInput
  ): Promise<PurchaseOrder> {
    this.validateItems(input.items);
    const totals = this.gst.computeTotals(input.items, {
      intraState: input.intraState ?? true,
    });

    const order = await this.repos.transactions.createPurchaseOrder(
      businessId,
      userId,
      {
        orderNo,
        supplierId: input.supplierId ?? null,
        orderDate: input.orderDate ?? new Date().toISOString().slice(0, 10),
        expectedDate: input.expectedDate ?? null,
        status: "draft",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        notes: input.notes ?? null,
      },
      input.items.map(this.toLineItemInput)
    );

    await this.audits.log({
      businessId,
      userId,
      action: "purchase_order.created",
      entityType: "purchase_order",
      entityId: order.id,
      metadata: { orderNo, total: totals.total },
    });
    return order;
  }

  async listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
    return this.repos.transactions.listPurchaseOrders(businessId);
  }

  async createPurchaseInvoice(
    businessId: string,
    userId: string,
    billNo: string,
    input: PurchaseInput
  ): Promise<PurchaseInvoice> {
    this.validateItems(input.items);
    const totals = this.gst.computeTotals(input.items, {
      intraState: input.intraState ?? true,
    });

    const invoice = await this.repos.transactions.createPurchaseInvoice(
      businessId,
      userId,
      {
        billNo,
        supplierId: input.supplierId ?? null,
        invoiceDate: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate ?? null,
        status: "pending",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: 0,
        notes: input.notes ?? null,
      },
      input.items.map(this.toLineItemInput)
    );

    // Stock in per line item.
    for (const item of input.items) {
      await this.repos.products.addStockMovement({
        businessId,
        productId: item.productId,
        change: item.quantity,
        movementType: "PURCHASE",
        reason: "purchase",
        referenceType: "purchase_invoice",
        referenceId: invoice.id,
        userId,
      });
    }

    await this.audits.log({
      businessId,
      userId,
      action: "purchase_invoice.created",
      entityType: "purchase_invoice",
      entityId: invoice.id,
      metadata: { billNo, total: totals.total },
    });
    return invoice;
  }

  async listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]> {
    return this.repos.transactions.listPurchaseInvoices(businessId);
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    return this.repos.transactions.listPayments(businessId);
  }

  async createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment> {
    if (input.amount <= 0) {
      throw AppError.validation("Payment amount must be positive.");
    }
    const payment = await this.repos.transactions.createPayment(businessId, userId, {
      direction: input.direction,
      partyType: input.partyType,
      partyId: input.partyId ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      purchaseInvoiceId: input.purchaseInvoiceId ?? null,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference ?? null,
      paymentDate: input.paymentDate ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amount: input.amount, mode: input.mode },
    });
    return payment;
  }
}
