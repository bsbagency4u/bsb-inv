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
import {
  convertLine,
  oversellMessage,
  packagingFromProduct,
  validateSaleQuantity,
  type RateBasis,
} from "@/lib/packaging";
import { GstEngine } from "./gst.service";
import { InventoryService } from "./inventory.service";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";
import { AuthorizationService } from "./authorization.service";

export interface CartItemInput {
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  mrp?: number | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
  discountPercent?: number;
  unitKind?: "base" | "pack";
  rateBasis?: RateBasis;
  saleUnit?: string | null;
  baseQuantity?: number | null;
  baseUnitCost?: number | null;
}

export interface PaymentAllocation {
  mode: string;
  amount: number;
  reference?: string | null;
}

export interface SalesInput {
  customerId?: string | null;
  /** Walk-in display name. Stored in notes; no customer account is created. */
  walkInName?: string | null;
  warehouseId?: string | null;
  invoiceDate?: string;
  dueDate?: string | null;
  notes?: string | null;
  items: CartItemInput[];
  intraState?: boolean;
  payments?: PaymentAllocation[];
  discount?: number;
  discountPercent?: number;
  /** Draft invoices are stored without stock movements or payments. */
  asDraft?: boolean;
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
  discount?: number;
  /** Draft bills are stored without stock movements. Complete/receive updates stock. */
  asDraft?: boolean;
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
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitCost: number;
    unitKind?: "base" | "pack";
    rateBasis?: RateBasis;
  }>;
}

export interface SalesReturnInput {
  salesInvoiceId?: string | null;
  customerId?: string | null;
  returnDate?: string;
  reason?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number;
    unitKind?: "base" | "pack";
    rateBasis?: RateBasis;
  }>;
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
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
    this.inventory = new InventoryService(repos, audits, notifications, this.auth);
  }

  private validateItems(items: { quantity: number; unitPrice: number; mrp?: number | null }[]): void {
    if (items.length === 0) {
      throw AppError.validation("Add at least one line item.");
    }
    for (const item of items) {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw AppError.validation("Line items need a positive quantity and a valid price.");
      }
      if (item.mrp != null && item.unitPrice > item.mrp) {
        throw AppError.validation("Sale price cannot exceed MRP.");
      }
    }
  }

  private toLineItemInput(item: CartItemInput): LineItemInput {
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      batchId: item.batchId ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      discount: item.discount ?? 0,
      saleUnit: item.saleUnit ?? null,
      baseQuantity: item.baseQuantity ?? item.quantity,
    };
  }

  private async convertCartItem(
    businessId: string,
    item: CartItemInput,
    mode: "sale" | "purchase"
  ): Promise<CartItemInput> {
    const product = await this.repos.products.getProduct(businessId, item.productId);
    if (!product) throw AppError.notFound("Product not found.");
    const packaging = packagingFromProduct(product);
    const converted = convertLine({
      quantity: item.quantity,
      unitKind: item.unitKind,
      rateBasis: item.rateBasis,
      unitPrice: item.unitPrice,
      packaging,
      mode,
    });
    if (mode === "sale") {
      const qtyError = validateSaleQuantity(item.quantity, packaging, converted.unitKind);
      if (qtyError) throw AppError.validation(qtyError);
    }
    const baseQuantity = item.baseQuantity ?? converted.baseQuantity;
    if (baseQuantity <= 0) {
      throw AppError.validation("Line items need a positive quantity and a valid price.");
    }
    const commercialRate =
      converted.quantity > 0 ? converted.lineAmount / converted.quantity : converted.unitPrice;
    return {
      ...item,
      unitKind: converted.unitKind,
      rateBasis: converted.rateBasis,
      unitPrice: commercialRate,
      saleUnit: item.saleUnit ?? converted.saleUnit,
      baseQuantity,
      baseUnitCost: converted.baseUnitCost,
    };
  }

  private async convertReturnItem(
    businessId: string,
    item: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      unitPrice: number;
      unitKind?: "base" | "pack";
      rateBasis?: RateBasis;
    }
  ) {
    const product = await this.repos.products.getProduct(businessId, item.productId);
    if (!product) throw AppError.notFound("Product not found.");
    const packaging = packagingFromProduct(product);
    const converted = convertLine({
      quantity: item.quantity,
      unitKind: item.unitKind,
      rateBasis: item.rateBasis,
      unitPrice: item.unitPrice,
      packaging,
      mode: "return",
    });
    if (converted.baseQuantity <= 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: converted.quantity,
      unitPrice: converted.quantity > 0 ? converted.lineAmount / converted.quantity : converted.unitPrice,
      baseQuantity: converted.baseQuantity,
    };
  }

  private stockQuantity(item: CartItemInput): number {
    return item.baseQuantity ?? item.quantity;
  }

  private async assertSaleStock(businessId: string, item: CartItemInput): Promise<void> {
    const product = await this.repos.products.getProduct(businessId, item.productId);
    if (!product || !product.trackInventory) return;
    const needed = this.stockQuantity(item);
    const balances = await this.repos.products.listBalances(businessId, item.productId);
    if (balances.length === 0) return;
    const available = balances
      .filter((balance) => {
        if (item.batchId && balance.batchId !== item.batchId) return false;
        if (item.variantId && balance.variantId && balance.variantId !== item.variantId) return false;
        return true;
      })
      .reduce((sum, balance) => sum + balance.quantity, 0);
    if (needed > available) {
      throw AppError.validation(oversellMessage(available, product.unit));
    }
  }

  private async ensurePurchaseBatch(
    businessId: string,
    item: CartItemInput
  ): Promise<string | null> {
    if (item.batchId) return item.batchId;
    const batchNo = item.batchNo?.trim();
    if (!batchNo) return null;
    const existing = await this.repos.products.listBatches(businessId, item.productId);
    const match = existing.find((batch) => batch.batchNo.toLowerCase() === batchNo.toLowerCase());
    if (match) {
      const patch: { expiryDate?: string | null; mrp?: number | null; purchasePrice?: number | null } = {};
      if (item.expiryDate !== undefined) patch.expiryDate = item.expiryDate || null;
      if (item.mrp !== undefined && item.mrp !== null) patch.mrp = item.mrp;
      const cost = item.baseUnitCost ?? item.unitPrice;
      if (cost >= 0) patch.purchasePrice = cost;
      if (Object.keys(patch).length > 0) {
        await this.repos.products.updateBatch(businessId, match.id, patch);
      }
      return match.id;
    }
    const created = await this.repos.products.createBatch(businessId, {
      productId: item.productId,
      batchNo,
      expiryDate: item.expiryDate ?? null,
      mrp: item.mrp ?? null,
      purchasePrice: item.baseUnitCost ?? item.unitPrice,
    });
    return created.id;
  }

  private composeSalesNotes(input: SalesInput): string | null {
    const parts: string[] = [];
    if (input.walkInName?.trim() && !input.customerId) {
      parts.push(`Walk-in: ${input.walkInName.trim()}`);
    }
    if (input.notes?.trim()) parts.push(input.notes.trim());
    return parts.length > 0 ? parts.join("\n") : null;
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
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    this.validateItems(input.items);
    const convertedItems: CartItemInput[] = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertCartItem(businessId, item, "sale"));
    }
    if (!input.asDraft) {
      for (const item of convertedItems) {
        await this.assertSaleStock(businessId, item);
      }
    }
    const asDraft = input.asDraft === true;
    const totals = this.gst.computeTotals(convertedItems, {
      intraState: input.intraState ?? true,
      discount: input.discount,
      discountPercent: input.discountPercent,
    });

    const payments = asDraft ? [] : (input.payments ?? []).filter((p) => p.amount > 0);
    const paymentState = asDraft
      ? { paid: 0, status: "draft" as SalesInvoiceStatus }
      : this.computePaymentState(totals.total, payments);

    const lineInputs: LineItemInput[] = convertedItems.map((item, index) => {
      const computed = totals.lines[index];
      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        batchId: item.batchId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        discount: computed?.discount ?? item.discount ?? 0,
        taxableAmount: computed?.taxableAmount,
        taxAmount: computed?.taxAmount,
        amount: computed?.amount,
        saleUnit: item.saleUnit ?? null,
        baseQuantity: item.baseQuantity ?? item.quantity,
      };
    });

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
        notes: this.composeSalesNotes(input),
      },
      lineInputs
    );

    if (!asDraft) {
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

      for (const item of convertedItems) {
        await this.inventorySaleMovement(businessId, userId, invoice.id, item, input.warehouseId);
      }
    }

    await this.audits.log({
      businessId,
      userId,
      action: asDraft ? "invoice.drafted" : "invoice.created",
      entityType: "sales_invoice",
      entityId: invoice.id,
      metadata: { invoiceNo, total: totals.total, draft: asDraft },
    });
    if (!asDraft) {
      await this.notifications.create(businessId, {
        title: `Invoice ${invoiceNo} created`,
        description: `Total ${totals.total.toFixed(2)}.`,
        type: "success",
        href: "/sales/invoices",
      });
    }

    return { invoice, totals };
  }

  /**
   * Completes a draft sales invoice: records stock OUT through InventoryService
   * and marks the invoice completed (unpaid). Already-completed invoices are
   * left unchanged so stock is never applied twice.
   */
  async completeSalesInvoice(
    businessId: string,
    userId: string,
    invoiceId: string
  ): Promise<SalesInvoice> {
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    if (invoice.status !== "draft") return invoice;

    for (const item of invoice.items) {
      await this.inventory.recordSaleMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.baseQuantity ?? item.quantity,
        invoice.id,
        null,
        item.batchId ?? null
      );
    }
    await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoiceId, "completed");

    await this.audits.log({
      businessId,
      userId,
      action: "invoice.completed",
      entityType: "sales_invoice",
      entityId: invoice.id,
      metadata: { invoiceNo: invoice.invoiceNo, total: invoice.total },
    });

    return { ...invoice, status: "completed" };
  }

  private async inventorySaleMovement(
    businessId: string,
    userId: string,
    invoiceId: string,
    item: CartItemInput,
    warehouseId?: string | null
  ) {
    await this.inventory.recordSaleMovement(
      businessId,
      userId,
      item.productId,
      item.variantId ?? null,
      this.stockQuantity(item),
      invoiceId,
      warehouseId ?? null,
      item.batchId ?? null
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
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    if (invoice.status === "cancelled") return;

    const wasDraft = invoice.status === "draft";
    await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoiceId, "cancelled");

    if (!wasDraft) {
      for (const item of invoice.items) {
        await this.inventory.recordReturnMovement(
          businessId,
          userId,
          item.productId,
          item.variantId ?? null,
          item.baseQuantity ?? item.quantity,
          invoiceId,
          null,
          item.batchId ?? null
        );
      }
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
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
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
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
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
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
    this.validateItems(input.items);
    const asDraft = input.asDraft === true;
    const convertedItems: CartItemInput[] = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertCartItem(businessId, item, "purchase"));
    }
    const totals = this.gst.computeTotals(convertedItems, {
      intraState: input.intraState ?? true,
      discount: input.discount ?? 0,
    });

    const persistedItems: CartItemInput[] = [];
    for (const item of convertedItems) {
      const batchId = await this.ensurePurchaseBatch(businessId, item);
      persistedItems.push({ ...item, batchId });
    }

    const invoice = await this.repos.transactions.createPurchaseInvoice(
      businessId,
      userId,
      {
        billNo,
        supplierId: input.supplierId ?? null,
        purchaseOrderId: null,
        invoiceDate: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate ?? null,
        status: asDraft ? "draft" : "unpaid",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: 0,
        notes: input.notes ?? null,
      },
      persistedItems.map(this.toLineItemInput)
    );

    if (!asDraft) {
      for (const item of persistedItems) {
        await this.inventory.recordPurchaseMovement(
          businessId,
          userId,
          item.productId,
          item.variantId ?? null,
          this.stockQuantity(item),
          invoice.id,
          "purchase_invoice",
          input.warehouseId ?? null,
          item.batchId ?? null
        );
      }
    }

    await this.audits.log({
      businessId,
      userId,
      action: asDraft ? "purchase_invoice.drafted" : "purchase_invoice.created",
      entityType: "purchase_invoice",
      entityId: invoice.id,
      metadata: { billNo, total: totals.total, draft: asDraft },
    });
    return invoice;
  }

  /**
   * Completes a draft purchase bill: records stock IN through InventoryService
   * and marks the bill unpaid. Already-completed bills are left unchanged so
   * stock is never applied twice.
   */
  async completePurchaseInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    warehouseId?: string | null
  ): Promise<PurchaseInvoice> {
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Purchase invoice not found.");
    if (invoice.status !== "draft") return invoice;

    for (const item of invoice.items) {
      await this.inventory.recordPurchaseMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.baseQuantity ?? item.quantity,
        invoice.id,
        "purchase_invoice",
        warehouseId ?? null,
        item.batchId ?? null
      );
    }
    await this.repos.transactions.updatePurchaseInvoiceStatus(businessId, invoiceId, "unpaid");

    await this.audits.log({
      businessId,
      userId,
      action: "purchase_invoice.completed",
      entityType: "purchase_invoice",
      entityId: invoice.id,
      metadata: { billNo: invoice.billNo, total: invoice.total },
    });

    return { ...invoice, status: "unpaid" };
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
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    const convertedItems = [];
    for (const item of input.items) {
      convertedItems.push(
        await this.convertReturnItem(businessId, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitCost,
          unitKind: item.unitKind,
          rateBasis: item.rateBasis,
        })
      );
    }
    const total = convertedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
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
      convertedItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );

    for (const item of convertedItems) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        -item.baseQuantity,
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
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    const convertedItems = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertReturnItem(businessId, item));
    }
    const total = convertedItems.reduce(
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
      convertedItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );

    for (const item of convertedItems) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        item.variantId ?? null,
        item.baseQuantity,
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
    await this.auth.requirePermission(
      businessId,
      userId,
      input.direction === "in" ? "sales.manage" : "purchase.manage"
    );
    if (input.amount <= 0) {
      throw AppError.validation("Payment amount must be positive.");
    }
    if (input.purchaseInvoiceId) {
      const bill = await this.repos.transactions.getPurchaseInvoice(businessId, input.purchaseInvoiceId);
      if (bill?.status === "draft") {
        throw AppError.validation("Complete the draft bill before recording a payment.");
      }
    }
    if (input.salesInvoiceId) {
      const sale = await this.repos.transactions.getSalesInvoice(businessId, input.salesInvoiceId);
      if (sale?.status === "draft") {
        throw AppError.validation("Complete the draft invoice before recording a payment.");
      }
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
    await this.auth.requirePermission(businessId, userId, "settings.manage");
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
    await this.auth.requirePermission(businessId, userId, "settings.manage");
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
