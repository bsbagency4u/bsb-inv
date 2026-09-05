import type { Repositories, LineItemInput } from "@/repositories/types";
import type {
  InvoiceTotals,
  Payment,
  PaymentMode,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseReturn,
  SalesInvoice,
  SalesInvoiceStatus,
  SalesReturn,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import { GstEngine } from "./gst.service";
import { InventoryService } from "./inventory.service";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";

export interface CartItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
}

export interface PaymentAllocation {
  mode: string;
  amount: number;
  reference?: string | null;
}

export interface SalesInput {
  customerId?: string | null;
  invoiceDate?: string;
  dueDate?: string | null;
  notes?: string | null;
  items: CartItemInput[];
  intraState?: boolean;
  payments?: PaymentAllocation[];
}

export interface PurchaseInput {
  supplierId?: string | null;
  warehouseId?: string | null;
  orderDate?: string;
  invoiceDate?: string;
  expectedDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: CartItemInput[];
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

export interface ReceivingInput {
  purchaseOrderId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  receivedAt?: string;
  notes?: string | null;
  items: Array<{ productId: string; variantId?: string | null; quantity: number; unitCost: number }>;
}

export interface PurchaseReturnInput {
  purchaseInvoiceId?: string | null;
  supplierId?: string | null;
  returnDate?: string;
  reason?: string | null;
  notes?: string | null;
  items: Array<{ productId: string; variantId?: string | null; quantity: number; unitCost: number }>;
}

export interface SalesReturnInput {
  salesInvoiceId?: string | null;
  customerId?: string | null;
  returnDate?: string;
  reason?: string | null;
  notes?: string | null;
  items: Array<{ productId: string; variantId?: string | null; quantity: number; unitPrice: number }>;
}

type DocumentKind = "sales" | "purchase_order" | "purchase_invoice" | "sales_return" | "purchase_return";

/**
 * Transaction service — the business-rule layer for purchases, sales,
 * payments and returns. Every stock-affecting path delegates to the
 * InventoryService (the authoritative stock system). Document numbers come
 * from the atomic database sequence so concurrent requests never collide.
 */
export class TransactionService {
  private gst = new GstEngine();
  private inventory: InventoryService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService
  ) {
    this.inventory = new InventoryService(repos, audits, notifications);
  }

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

  private toLineItemInput(item: CartItemInput): LineItemInput {
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      discount: item.discount ?? 0,
    };
  }

  private computePaymentState(total: number, allocations: PaymentAllocation[]) {
    const paid = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (paid > total) {
      throw AppError.validation("Total payment cannot exceed the invoice total.");
    }
    let status: SalesInvoiceStatus = "draft";
    if (paid <= 0) status = "completed";
    else if (paid >= total) status = "paid";
    else status = "partial";
    return { paid, status };
  }

  /** Next sequential document number via the atomic database sequence. */
  async nextDocumentNo(businessId: string, prefix: string, kind: DocumentKind): Promise<string> {
    return this.repos.transactions.nextDocumentNumber(businessId, kind, prefix);
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

    const payments = input.payments ?? [];
    const paymentState = this.computePaymentState(totals.total, payments);

    const invoice = await this.repos.transactions.createSalesInvoice(
      businessId,
      userId,
      {
        invoiceNo,
        customerId: input.customerId ?? null,
        invoiceDate: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate ?? null,
        status: paymentState.status,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: paymentState.paid,
        paymentMode: payments[0]?.mode ?? null,
        notes: input.notes ?? null,
      },
      input.items.map(this.toLineItemInput)
    );

    for (const allocation of payments) {
      await this.createPayment(businessId, userId, {
        direction: "in",
        partyType: "customer",
        partyId: input.customerId ?? null,
        salesInvoiceId: invoice.id,
        amount: allocation.amount,
        mode: allocation.mode,
        reference: allocation.reference ?? null,
      });
    }

    // Stock OUT through the authoritative inventory service.
    for (const item of input.items) {
      await this.inventorySaleMovement(businessId, userId, invoice.id, item);
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

  private async inventorySaleMovement(
    businessId: string,
    userId: string,
    invoiceId: string,
    item: CartItemInput
  ) {
    await this.inventory.recordSaleMovement(
      businessId,
      userId,
      item.productId,
      item.variantId ?? null,
      item.quantity,
      invoiceId
    );
  }

  async listSalesInvoices(businessId: string): Promise<SalesInvoice[]> {
    return this.repos.transactions.listSalesInvoices(businessId);
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

    // Restore stock through the inventory service (SALE_RETURN movement).
    for (const item of invoice.items) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        null,
        item.quantity,
        invoiceId
      );
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
        warehouseId: input.warehouseId ?? null,
        orderDate: input.orderDate ?? new Date().toISOString().slice(0, 10),
        expectedDate: input.expectedDate ?? null,
        status: "confirmed",
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

  /** Receives goods: records a receipt and increases stock via the ledger. */
  async createPurchaseReceipt(
    businessId: string,
    userId: string,
    receiptNo: string,
    input: ReceivingInput
  ): Promise<PurchaseReceipt> {
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one received item.");
    }
    const receipt = await this.repos.transactions.createPurchaseReceipt(
      businessId,
      userId,
      {
        purchaseOrderId: input.purchaseOrderId ?? null,
        warehouseId: input.warehouseId ?? null,
        locationId: input.locationId ?? null,
        receiptNo,
        receivedAt: input.receivedAt ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
      },
      input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }))
    );

    for (const item of input.items) {
      await this.inventory.recordPurchaseMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.quantity,
        receipt.id,
        "purchase_receipt"
      );
    }

    await this.audits.log({
      businessId,
      userId,
      action: "purchase_received",
      entityType: "purchase_receipt",
      entityId: receipt.id,
      metadata: { receiptNo },
    });
    return receipt;
  }

  async listPurchaseReceipts(businessId: string): Promise<PurchaseReceipt[]> {
    return this.repos.transactions.listPurchaseReceipts(businessId);
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
        purchaseOrderId: null,
        invoiceDate: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate ?? null,
        status: "unpaid",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: 0,
        notes: input.notes ?? null,
      },
      input.items.map(this.toLineItemInput)
    );

    // A purchase invoice records goods received (stock IN) when the business
    // records the bill directly rather than via a receiving receipt.
    for (const item of input.items) {
      await this.inventory.recordPurchaseMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.quantity,
        invoice.id
      );
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

  async getPurchaseInvoice(businessId: string, invoiceId: string): Promise<PurchaseInvoice | null> {
    return this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
  }

  async createPurchaseReturn(
    businessId: string,
    userId: string,
    returnNo: string,
    input: PurchaseReturnInput
  ): Promise<PurchaseReturn> {
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    const total = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    const result = await this.repos.transactions.createPurchaseReturn(
      businessId,
      userId,
      {
        purchaseInvoiceId: input.purchaseInvoiceId ?? null,
        supplierId: input.supplierId ?? null,
        returnNo,
        returnDate: input.returnDate ?? new Date().toISOString().slice(0, 10),
        reason: input.reason ?? null,
        total,
        notes: input.notes ?? null,
      },
      input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitCost,
      }))
    );

    // Stock OUT (PURCHASE_RETURN movement) — send goods back to the supplier.
    for (const item of input.items) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        -item.quantity,
        result.id
      );
    }

    await this.audits.log({
      businessId,
      userId,
      action: "purchase_return.created",
      entityType: "purchase_return",
      entityId: result.id,
      metadata: { returnNo, total },
    });
    return result;
  }

  async listPurchaseReturns(businessId: string): Promise<PurchaseReturn[]> {
    return this.repos.transactions.listPurchaseReturns(businessId);
  }

  async createSalesReturn(
    businessId: string,
    userId: string,
    returnNo: string,
    input: SalesReturnInput
  ): Promise<SalesReturn> {
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    const total = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const result = await this.repos.transactions.createSalesReturn(
      businessId,
      userId,
      {
        salesInvoiceId: input.salesInvoiceId ?? null,
        customerId: input.customerId ?? null,
        returnNo,
        returnDate: input.returnDate ?? new Date().toISOString().slice(0, 10),
        reason: input.reason ?? null,
        total,
        notes: input.notes ?? null,
      },
      input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );

    // Stock IN (SALE_RETURN movement).
    for (const item of input.items) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.quantity,
        result.id
      );
    }

    // Mark the linked invoice as returned when fully returned.
    if (input.salesInvoiceId) {
      const invoice = await this.repos.transactions.getSalesInvoice(businessId, input.salesInvoiceId);
      if (invoice && invoice.status !== "cancelled") {
        await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoice.id, "returned");
      }
    }

    await this.audits.log({
      businessId,
      userId,
      action: "sales_return.created",
      entityType: "sales_return",
      entityId: result.id,
      metadata: { returnNo, total },
    });
    return result;
  }

  async listSalesReturns(businessId: string): Promise<SalesReturn[]> {
    return this.repos.transactions.listSalesReturns(businessId);
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

    // Recompute authoritative paid amount / status on the linked invoice.
    if (input.salesInvoiceId) {
      await this.reconcileSalesPayment(businessId, input.salesInvoiceId);
    }
    if (input.purchaseInvoiceId) {
      await this.reconcilePurchasePayment(businessId, input.purchaseInvoiceId);
    }

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

  private async reconcileSalesPayment(businessId: string, invoiceId: string): Promise<void> {
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) return;
    const payments = await this.repos.transactions.listPayments(businessId);
    const paid = payments
      .filter((p) => p.salesInvoiceId === invoiceId && p.direction === "in")
      .reduce((sum, p) => sum + p.amount, 0);
    const status: SalesInvoiceStatus =
      paid <= 0 ? "completed" : paid >= invoice.total ? "paid" : "partial";
    await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoiceId, status);
  }

  private async reconcilePurchasePayment(businessId: string, invoiceId: string): Promise<void> {
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) return;
    const payments = await this.repos.transactions.listPayments(businessId);
    const paid = payments
      .filter((p) => p.purchaseInvoiceId === invoiceId && p.direction === "out")
      .reduce((sum, p) => sum + p.amount, 0);
    const status = paid <= 0 ? "unpaid" : paid >= invoice.total ? "paid" : "partial";
    await this.repos.transactions.updatePurchaseInvoiceStatus(businessId, invoiceId, status);
  }

  async listPaymentModes(businessId: string): Promise<PaymentMode[]> {
    return this.repos.transactions.listPaymentModes(businessId);
  }

  async createPaymentMode(
    businessId: string,
    userId: string,
    input: { code: string; name: string }
  ): Promise<PaymentMode> {
    const mode = await this.repos.transactions.createPaymentMode(businessId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "payment_mode.created",
      entityType: "payment_mode",
      entityId: mode.id,
      metadata: { code: mode.code },
    });
    return mode;
  }

  async updatePaymentMode(
    businessId: string,
    userId: string,
    modeId: string,
    input: { name?: string; isActive?: boolean }
  ): Promise<PaymentMode> {
    const mode = await this.repos.transactions.updatePaymentMode(businessId, modeId, input);
    await this.audits.log({
      businessId,
      userId,
      action: "payment_mode.updated",
      entityType: "payment_mode",
      entityId: modeId,
      metadata: { name: mode.name, isActive: mode.isActive },
    });
    return mode;
  }
}
