import type { Repositories, LineItemInput } from "@/repositories/types";
import type { GstDocumentSnapshot } from "@/repositories/transaction.repository";
import type {
  GstDocumentType,
  GstPartyRegistrationType,
  GstRegistrationType,
  GstSupplyType,
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
  toBaseQuantity,
  unitKindFromSaleUnit,
  validateSaleQuantity,
  type RateBasis,
} from "@/lib/packaging";
import { remainingForProduct } from "@/lib/purchase-receiving";
import { allocateReturnToLots } from "@/lib/sales-return";
import { settleTender } from "@/lib/tender";
import {
  settlePurchaseInvoice,
  settleSalesInvoice,
  validateAllocations,
  type AllocationRequest,
} from "@/lib/party-ledger";
import { GstEngine } from "./gst.service";
import type { GstComputeOptions } from "./gst.service";
import {
  canClaimInputTaxCredit,
  classifyGstDocument,
  isTaxableSupplyType,
  normalizeGstPartyRegistrationType,
  normalizeGstRegistrationType,
  normalizeGstSupplyType,
  type GstDocumentDecision,
} from "@/lib/gst";
import { InventoryService } from "./inventory.service";
import type { AuditService } from "./audit.service";
import type { NotificationService } from "./notification.service";
import { AuthorizationService } from "./authorization.service";
import { parseTaxDefaults, TAX_KEY } from "./business.service";
import type { TaxDefaults } from "@/types/domain";
import {
  DocumentControlService,
  isDraftStatus,
  isPostedStatus,
  type DocumentGuardResult,
} from "./document-control.service";

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
  /** Supply classification of the product at the time of the document. */
  gstSupplyType?: GstSupplyType | null;
  hsn?: string | null;
  /** True when this purchase line attracts reverse charge. */
  reverseCharge?: boolean;
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
  /** Override Settings → Tax “Prices include tax”. Unset reads the tenant default. */
  pricesIncludeTax?: boolean;
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
  /** Override Settings → Tax “Prices include tax”. Unset reads the tenant default. */
  pricesIncludeTax?: boolean;
  /** Draft bills are stored without stock movements. Complete/receive updates stock. */
  asDraft?: boolean;
  /** Document-level reverse charge, recorded only when the user or a product flags it. */
  reverseCharge?: boolean;
}

export interface DocumentMutationOptions {
  overrideLock?: boolean;
  overrideReason?: string | null;
}

export interface InvoiceAllocationInput {
  salesInvoiceId?: string | null;
  purchaseInvoiceId?: string | null;
  amount: number;
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
  allocations?: InvoiceAllocationInput[];
  overrideLock?: boolean;
  overrideReason?: string | null;
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
  private documents: DocumentControlService;

  constructor(
    private repos: Repositories,
    private audits: AuditService,
    private notifications: NotificationService,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
    this.inventory = new InventoryService(repos, audits, notifications, this.auth);
    this.documents = new DocumentControlService(repos, this.auth);
  }

  private async taxComputeOptions(
    businessId: string,
    input: { intraState?: boolean; discount?: number; discountPercent?: number; pricesIncludeTax?: boolean }
  ): Promise<GstComputeOptions> {
    const tax = await this.loadTaxDefaults(businessId);
    return {
      intraState: input.intraState ?? tax.defaultIntraState,
      discount: input.discount,
      discountPercent: input.discountPercent,
      pricesIncludeTax: input.pricesIncludeTax ?? tax.pricesIncludeTax,
    };
  }

  private async loadTaxDefaults(businessId: string): Promise<TaxDefaults> {
    return parseTaxDefaults(await this.repos.businesses.getSetting(businessId, TAX_KEY));
  }

  /**
   * Resolves the authoritative GST treatment for a document.
   *
   * The supplying business's registration status decides whether tax may be
   * charged at all; the counterparty is only used for place of supply and the
   * B2B/B2C label. Non-taxable product lines never attract GST, and the
   * resulting decision is snapshotted on the document so later master-data
   * edits never rewrite history.
   */
  private async resolveGstForDocument(
    businessId: string,
    side: "sale" | "purchase",
    party: {
      state: string | null;
      placeOfSupplyState?: string | null;
      gstRegistrationType?: GstPartyRegistrationType | null;
      gstin?: string | null;
    } | null,
    items: CartItemInput[],
    input: {
      intraState?: boolean;
      discount?: number;
      discountPercent?: number;
      pricesIncludeTax?: boolean;
      reverseCharge?: boolean;
    }
  ): Promise<{
    items: CartItemInput[];
    options: GstComputeOptions;
    decision: GstDocumentDecision;
    registrationType: GstRegistrationType;
    snapshot: GstDocumentSnapshot;
  }> {
    const [defaults, business] = await Promise.all([
      this.loadTaxDefaults(businessId),
      this.repos.businesses.getById(businessId),
    ]);

    const registrationType: GstRegistrationType = !defaults.gstEnabled
      ? "unregistered"
      : normalizeGstRegistrationType(business?.gstRegistrationType);

    const decision = classifyGstDocument({
      side,
      registrationType,
      businessState: business?.state ?? null,
      partyState: party?.state ?? null,
      partyPlaceOfSupplyState: party?.placeOfSupplyState ?? null,
      partyRegistrationType: party
        ? normalizeGstPartyRegistrationType(party.gstRegistrationType)
        : null,
      lines: items.map((item) => ({
        supplyType: normalizeGstSupplyType(item.gstSupplyType),
        rate: item.gstRate,
      })),
      defaultIntraState: input.intraState ?? defaults.defaultIntraState,
    });

    const intraState = input.intraState ?? decision.intraState;
    const normalizedItems = items.map((item) => {
      const supplyType = normalizeGstSupplyType(item.gstSupplyType);
      const chargeRate =
        decision.chargeTax && isTaxableSupplyType(supplyType) && supplyType !== "zero_rated";
      return {
        ...item,
        gstRate: chargeRate ? item.gstRate : 0,
        gstSupplyType: supplyType,
      };
    });
    const reverseCharge =
      side === "purchase" &&
      (input.reverseCharge === true ||
        items.some((item) => item.reverseCharge === true));
    const itcEligible =
      side === "purchase"
        ? decision.chargeTax && canClaimInputTaxCredit(registrationType)
        : undefined;

    return {
      items: normalizedItems,
      options: {
        intraState,
        discount: input.discount,
        discountPercent: input.discountPercent,
        pricesIncludeTax: input.pricesIncludeTax ?? defaults.pricesIncludeTax,
      },
      decision: { ...decision, intraState },
      registrationType,
      snapshot: {
        gstDocumentType: decision.documentType as GstDocumentType,
        placeOfSupplyState: decision.placeOfSupplyState,
        gstRegistrationSnapshot: registrationType,
        intraState,
        reverseCharge,
        itcEligible,
        supplierGstin: side === "purchase" ? (party?.gstin ?? null) : undefined,
      },
    };
  }

  private async gstParty(
    businessId: string,
    side: "sale" | "purchase",
    partyId: string | null | undefined
  ) {
    if (!partyId) return null;
    if (side === "sale") {
      const customer = await this.repos.parties.getCustomer(businessId, partyId);
      if (!customer) return null;
      return {
        state: customer.state,
        placeOfSupplyState: customer.placeOfSupplyState ?? customer.state,
        gstRegistrationType: customer.gstRegistrationType,
        gstin: customer.gstin,
      };
    }
    const supplier = await this.repos.parties.getSupplier(businessId, partyId);
    if (!supplier) return null;
    return {
      state: supplier.state,
      placeOfSupplyState: supplier.placeOfSupplyState ?? supplier.state,
      gstRegistrationType: supplier.gstRegistrationType,
      gstin: supplier.gstin,
    };
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

  private toLineItemInput(
    item: CartItemInput,
    computed?: { discount?: number; taxableAmount?: number; taxAmount?: number; amount?: number },
    itcEligible?: boolean
  ): LineItemInput {
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
      gstSupplyType: item.gstSupplyType ?? null,
      hsn: item.hsn ?? null,
      itcEligible,
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
      gstSupplyType: item.gstSupplyType ?? product.gstSupplyType,
      hsn: item.hsn ?? product.hsn,
      reverseCharge: item.reverseCharge ?? product.reverseCharge,
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
    const settled = settleTender(allocations, total);
    if (settled.error) {
      throw AppError.validation(settled.error);
    }
    const paid = settled.payments.reduce((sum, allocation) => sum + allocation.amount, 0);
    let status: SalesInvoiceStatus = "draft";
    if (paid <= 0) status = "completed";
    else if (paid >= total) status = "paid";
    else status = "partial";
    return { paid, status, payments: settled.payments, changeDue: settled.changeDue };
  }

  /** Next sequential document number via the atomic database sequence. */
  async nextDocumentNo(businessId: string, prefix: string, kind: DocumentKind): Promise<string> {
    return this.repos.transactions.nextDocumentNumber(businessId, kind, prefix);
  }

  async nextControlledDocumentNo(
    businessId: string,
    kind: "sales_invoice" | "purchase_invoice" | "sales_return" | "purchase_return" | "payment"
  ): Promise<string> {
    return this.documents.allocateNumber(businessId, kind);
  }

  private async guardDocument(
    businessId: string,
    userId: string,
    input: {
      kind: "sales_invoice" | "purchase_invoice" | "sales_return" | "purchase_return" | "payment";
      action: "create" | "edit" | "delete" | "cancel";
      documentDate?: string | null;
      createdAt?: string | null;
      status?: string | null;
      overrideLock?: boolean;
      overrideReason?: string | null;
    },
    direction?: "in" | "out"
  ): Promise<DocumentGuardResult> {
    return this.documents.assertAllowed(businessId, userId, input, direction);
  }

  private async auditDocument(
    businessId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    guard?: DocumentGuardResult
  ): Promise<void> {
    await this.audits.log({
      businessId,
      userId,
      action,
      entityType,
      entityId,
      metadata: {
        ...metadata,
        documentDate: guard?.documentDate,
        backdated: guard?.backdated ?? false,
        overrideLock: guard?.overrideUsed ?? false,
      },
    });
  }

  private async reverseDocumentStock(
    businessId: string,
    userId: string,
    referenceId: string
  ): Promise<void> {
    const movements = await this.repos.products.listMovementsByReference(businessId, referenceId);
    for (const movement of movements) {
      if (movement.change === 0) continue;
      await this.repos.products.addStockMovement({
        businessId,
        productId: movement.productId,
        variantId: movement.variantId,
        batchId: movement.batchId,
        warehouseId: movement.warehouseId,
        locationId: movement.locationId,
        toWarehouseId: movement.toWarehouseId,
        toLocationId: movement.toLocationId,
        change: -movement.change,
        movementType: "ADJUSTMENT",
        reason: "reversal",
        referenceType: movement.referenceType,
        referenceId,
        notes: "Document Control reversal",
        userId,
      });
    }
  }

  private async assertPurchaseNotConsumed(businessId: string, invoice: PurchaseInvoice): Promise<void> {
    const returns = await this.repos.transactions.listPurchaseReturns(businessId);
    if (returns.some((item) => item.purchaseInvoiceId === invoice.id)) {
      throw AppError.conflict("This bill has purchase returns. Reverse those first.");
    }
    for (const item of invoice.items) {
      const needed = item.baseQuantity ?? item.quantity;
      if (needed <= 0) continue;
      const balances = await this.repos.products.listBalances(businessId, item.productId);
      const available = balances
        .filter((balance) => {
          if (item.batchId && balance.batchId !== item.batchId) return false;
          if (item.variantId && balance.variantId && balance.variantId !== item.variantId) return false;
          return true;
        })
        .reduce((sum, balance) => sum + balance.quantity, 0);
      if (available + 1e-9 < needed) {
        throw AppError.conflict("Stock from this bill has already been used and cannot be reversed.");
      }
    }
  }

  private async assertSalesNotConsumed(businessId: string, invoice: SalesInvoice): Promise<void> {
    const returns = await this.repos.transactions.listSalesReturns(businessId);
    if (returns.some((item) => item.salesInvoiceId === invoice.id)) {
      throw AppError.conflict("This invoice has sales returns. Reverse those first.");
    }
  }

  private composePurchaseHeader(
    billNo: string,
    input: PurchaseInput,
    totals: InvoiceTotals,
    status: string,
    documentDate: string,
    gst?: GstDocumentSnapshot
  ) {
    return {
      billNo,
      supplierId: input.supplierId ?? null,
      purchaseOrderId: null,
      invoiceDate: documentDate,
      dueDate: input.dueDate ?? null,
      status,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxAmount,
      total: totals.total,
      paidAmount: 0,
      notes: input.notes ?? null,
      gst,
    };
  }

  async createSalesInvoice(
    businessId: string,
    userId: string,
    invoiceNo: string,
    input: SalesInput
  ): Promise<{ invoice: SalesInvoice; totals: InvoiceTotals }> {
    const guard = await this.guardDocument(businessId, userId, {
      kind: "sales_invoice",
      action: "create",
      documentDate: input.invoiceDate,
    });
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
    const gstResolved = await this.resolveGstForDocument(
      businessId,
      "sale",
      await this.gstParty(businessId, "sale", input.customerId),
      convertedItems,
      input
    );
    const pricedItems = gstResolved.items;
    const totals = this.gst.computeTotals(pricedItems, gstResolved.options);

    const tendered = asDraft ? [] : (input.payments ?? []).filter((p) => p.amount > 0);
    const paymentState = asDraft
      ? { paid: 0, status: "draft" as SalesInvoiceStatus, payments: [] as PaymentAllocation[], changeDue: 0 }
      : this.computePaymentState(totals.total, tendered);
    const payments = paymentState.payments;

    const lineInputs: LineItemInput[] = pricedItems.map((item, index) => {
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
        gstSupplyType: item.gstSupplyType ?? null,
        hsn: item.hsn ?? null,
      };
    });

    const invoice = await this.repos.transactions.createSalesInvoice(
      businessId,
      userId,
      {
        invoiceNo,
        customerId: input.customerId ?? null,
        invoiceDate: guard.documentDate,
        dueDate: input.dueDate ?? null,
        status: paymentState.status,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: paymentState.paid,
        paymentMode: payments[0]?.mode ?? null,
        notes: this.composeSalesNotes(input),
        gst: gstResolved.snapshot,
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

    await this.auditDocument(
      businessId,
      userId,
      asDraft ? "invoice.drafted" : "invoice.created",
      "sales_invoice",
      invoice.id,
      { invoiceNo, total: totals.total, draft: asDraft },
      guard
    );
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
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    if (invoice.status !== "draft") return invoice;
    await this.guardDocument(businessId, userId, {
      kind: "sales_invoice",
      action: "edit",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
    });

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

  async updateSalesInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    input: SalesInput,
    options: DocumentMutationOptions = {}
  ): Promise<{ invoice: SalesInvoice; totals: InvoiceTotals }> {
    const existing = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!existing) throw AppError.notFound("Invoice not found.");
    const guard = await this.guardDocument(businessId, userId, {
      kind: "sales_invoice",
      action: "edit",
      documentDate: input.invoiceDate ?? existing.invoiceDate,
      createdAt: existing.createdAt,
      status: existing.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    this.validateItems(input.items);
    const convertedItems: CartItemInput[] = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertCartItem(businessId, item, "sale"));
    }
    const asDraft = isDraftStatus(existing.status) && input.asDraft === true;
    if (isPostedStatus(existing.status)) {
      await this.assertSalesNotConsumed(businessId, existing);
      await this.reverseDocumentStock(businessId, userId, existing.id);
    }
    if (!asDraft) {
      for (const item of convertedItems) {
        await this.assertSaleStock(businessId, item);
      }
    }
    const gstResolved = await this.resolveGstForDocument(
      businessId,
      "sale",
      await this.gstParty(businessId, "sale", input.customerId ?? existing.customerId),
      convertedItems,
      input
    );
    const pricedItems = gstResolved.items;
    const totals = this.gst.computeTotals(pricedItems, gstResolved.options);
    const tendered = asDraft ? [] : (input.payments ?? []).filter((p) => p.amount > 0);
    const paymentState = asDraft
      ? { paid: existing.paidAmount, status: existing.status, payments: [] as PaymentAllocation[], changeDue: 0 }
      : this.computePaymentState(totals.total, tendered.length > 0 ? tendered : [{ mode: existing.paymentMode ?? "cash", amount: existing.paidAmount }].filter((p) => p.amount > 0));
    const lineInputs: LineItemInput[] = pricedItems.map((item, index) => {
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
        gstSupplyType: item.gstSupplyType ?? null,
        hsn: item.hsn ?? null,
      };
    });
    const invoice = await this.repos.transactions.updateSalesInvoice(
      businessId,
      invoiceId,
      {
        invoiceNo: existing.invoiceNo,
        customerId: input.customerId ?? existing.customerId,
        invoiceDate: guard.documentDate,
        dueDate: input.dueDate ?? existing.dueDate,
        status: asDraft ? "draft" : paymentState.status,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: asDraft ? 0 : paymentState.paid,
        paymentMode: paymentState.payments[0]?.mode ?? existing.paymentMode,
        notes: this.composeSalesNotes(input) ?? existing.notes,
        gst: gstResolved.snapshot,
      },
      lineInputs
    );
    if (!asDraft) {
      await this.repos.transactions.deletePaymentsForDocument(businessId, { salesInvoiceId: invoice.id });
      for (const allocation of paymentState.payments) {
        await this.createPayment(businessId, userId, {
          direction: "in",
          partyType: "customer",
          partyId: input.customerId ?? existing.customerId,
          salesInvoiceId: invoice.id,
          amount: allocation.amount,
          mode: allocation.mode,
          reference: allocation.reference ?? null,
          overrideLock: options.overrideLock,
          overrideReason: options.overrideReason,
        });
      }
      for (const item of convertedItems) {
        await this.inventorySaleMovement(businessId, userId, invoice.id, item, input.warehouseId);
      }
    }
    await this.auditDocument(
      businessId,
      userId,
      "invoice.updated",
      "sales_invoice",
      invoice.id,
      { invoiceNo: invoice.invoiceNo, total: totals.total },
      guard
    );
    return { invoice, totals };
  }

  async deleteSalesInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    options: DocumentMutationOptions = {}
  ): Promise<void> {
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    const guard = await this.guardDocument(businessId, userId, {
      kind: "sales_invoice",
      action: "delete",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    if (isPostedStatus(invoice.status)) {
      await this.assertSalesNotConsumed(businessId, invoice);
      await this.reverseDocumentStock(businessId, userId, invoice.id);
    }
    await this.repos.transactions.deletePaymentsForDocument(businessId, { salesInvoiceId: invoice.id });
    await this.repos.transactions.deleteSalesInvoice(businessId, invoice.id);
    await this.auditDocument(
      businessId,
      userId,
      "invoice.deleted",
      "sales_invoice",
      invoice.id,
      { invoiceNo: invoice.invoiceNo },
      guard
    );
  }

  async cancelSalesInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    options: DocumentMutationOptions = {}
  ): Promise<void> {
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Invoice not found.");
    if (invoice.status === "cancelled") return;
    const guard = await this.guardDocument(businessId, userId, {
      kind: "sales_invoice",
      action: "cancel",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    await this.assertSalesNotConsumed(businessId, invoice);

    const wasDraft = invoice.status === "draft";
    await this.repos.transactions.updateSalesInvoiceStatus(businessId, invoiceId, "cancelled");
    await this.repos.transactions.cancelPaymentsForDocument(businessId, userId, { salesInvoiceId: invoiceId });

    if (!wasDraft) {
      await this.reverseDocumentStock(businessId, userId, invoiceId);
    }

    await this.auditDocument(
      businessId,
      userId,
      "invoice.cancelled",
      "sales_invoice",
      invoiceId,
      { invoiceNo: invoice.invoiceNo },
      guard
    );
  }

  async createPurchaseOrder(
    businessId: string,
    userId: string,
    orderNo: string,
    input: PurchaseInput
  ): Promise<PurchaseOrder> {
    await this.auth.requirePermission(businessId, userId, "purchase.manage");
    this.validateItems(input.items);
    const totals = this.gst.computeTotals(
      input.items,
      await this.taxComputeOptions(businessId, input)
    );

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
      input.items.map((item) => this.toLineItemInput(item))
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
    const receivedItems = input.items.filter((item) => item.quantity > 0);
    if (receivedItems.length === 0) {
      throw AppError.validation("Add at least one received item.");
    }

    let purchaseOrder = null;
    if (input.purchaseOrderId) {
      purchaseOrder = await this.repos.transactions.getPurchaseOrder(businessId, input.purchaseOrderId);
      if (!purchaseOrder) throw AppError.notFound("Purchase order not found.");
      if (purchaseOrder.status === "received") {
        throw AppError.validation("This purchase order is already fully received.");
      }
      const receivedByProduct = new Map<string, number>();
      for (const item of receivedItems) {
        receivedByProduct.set(item.productId, (receivedByProduct.get(item.productId) ?? 0) + item.quantity);
      }
      for (const [productId, quantity] of receivedByProduct) {
        const remaining = remainingForProduct(purchaseOrder.items, productId);
        if (quantity > remaining + 1e-9) {
          throw AppError.validation(
            `Cannot receive more than the remaining ordered quantity (${remaining}).`
          );
        }
      }
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
      receivedItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }))
    );

    if (purchaseOrder) {
      await this.repos.transactions.applyPurchaseReceiptQuantities(
        businessId,
        purchaseOrder.id,
        receivedItems.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      );
    }

    for (const item of receivedItems) {
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
      metadata: { receiptNo, purchaseOrderId: input.purchaseOrderId ?? null },
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
    const guard = await this.guardDocument(businessId, userId, {
      kind: "purchase_invoice",
      action: "create",
      documentDate: input.invoiceDate,
    });
    this.validateItems(input.items);
    const asDraft = input.asDraft === true;
    const convertedItems: CartItemInput[] = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertCartItem(businessId, item, "purchase"));
    }
    const gstResolved = await this.resolveGstForDocument(
      businessId,
      "purchase",
      await this.gstParty(businessId, "purchase", input.supplierId),
      convertedItems,
      { ...input, discount: input.discount ?? 0 }
    );
    const pricedItems = gstResolved.items;
    const totals = this.gst.computeTotals(pricedItems, gstResolved.options);

    const persistedItems: CartItemInput[] = [];
    for (const item of pricedItems) {
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
        invoiceDate: guard.documentDate,
        dueDate: input.dueDate ?? null,
        status: asDraft ? "draft" : "unpaid",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxTotal: totals.taxAmount,
        total: totals.total,
        paidAmount: 0,
        notes: input.notes ?? null,
        gst: gstResolved.snapshot,
      },
      persistedItems.map((item, index) =>
        this.toLineItemInput(item, totals.lines[index], gstResolved.snapshot.itcEligible)
      )
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

    await this.auditDocument(
      businessId,
      userId,
      asDraft ? "purchase_invoice.drafted" : "purchase_invoice.created",
      "purchase_invoice",
      invoice.id,
      { billNo, total: totals.total, draft: asDraft },
      guard
    );
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
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Purchase invoice not found.");
    if (invoice.status !== "draft") return invoice;
    await this.guardDocument(businessId, userId, {
      kind: "purchase_invoice",
      action: "edit",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
    });

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

  async updatePurchaseInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    input: PurchaseInput,
    options: DocumentMutationOptions = {}
  ): Promise<PurchaseInvoice> {
    const existing = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!existing) throw AppError.notFound("Purchase invoice not found.");
    const guard = await this.guardDocument(businessId, userId, {
      kind: "purchase_invoice",
      action: "edit",
      documentDate: input.invoiceDate ?? existing.invoiceDate,
      createdAt: existing.createdAt,
      status: existing.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    this.validateItems(input.items);
    if (isPostedStatus(existing.status)) {
      await this.assertPurchaseNotConsumed(businessId, existing);
      await this.reverseDocumentStock(businessId, userId, existing.id);
    }

    const asDraft = isDraftStatus(existing.status) && input.asDraft === true;
    const convertedItems: CartItemInput[] = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertCartItem(businessId, item, "purchase"));
    }
    const gstResolved = await this.resolveGstForDocument(
      businessId,
      "purchase",
      await this.gstParty(businessId, "purchase", input.supplierId ?? existing.supplierId),
      convertedItems,
      { ...input, discount: input.discount ?? 0 }
    );
    const pricedItems = gstResolved.items;
    const totals = this.gst.computeTotals(pricedItems, gstResolved.options);
    const persistedItems: CartItemInput[] = [];
    for (const item of pricedItems) {
      const batchId = await this.ensurePurchaseBatch(businessId, item);
      persistedItems.push({ ...item, batchId });
    }
    const status = asDraft ? "draft" : existing.status === "draft" ? "unpaid" : existing.status;
    const invoice = await this.repos.transactions.updatePurchaseInvoice(
      businessId,
      invoiceId,
      this.composePurchaseHeader(
        existing.billNo,
        input,
        totals,
        status,
        guard.documentDate,
        gstResolved.snapshot
      ),
      persistedItems.map((item, index) =>
        this.toLineItemInput(item, totals.lines[index], gstResolved.snapshot.itcEligible)
      )
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
    await this.auditDocument(
      businessId,
      userId,
      "purchase_invoice.updated",
      "purchase_invoice",
      invoice.id,
      { billNo: invoice.billNo, total: invoice.total },
      guard
    );
    return invoice;
  }

  async deletePurchaseInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    options: DocumentMutationOptions = {}
  ): Promise<void> {
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Purchase invoice not found.");
    const guard = await this.guardDocument(businessId, userId, {
      kind: "purchase_invoice",
      action: "delete",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    if (isPostedStatus(invoice.status)) {
      await this.assertPurchaseNotConsumed(businessId, invoice);
      await this.reverseDocumentStock(businessId, userId, invoice.id);
    }
    await this.repos.transactions.deletePaymentsForDocument(businessId, { purchaseInvoiceId: invoice.id });
    await this.repos.transactions.deletePurchaseInvoice(businessId, invoice.id);
    await this.auditDocument(
      businessId,
      userId,
      "purchase_invoice.deleted",
      "purchase_invoice",
      invoice.id,
      { billNo: invoice.billNo },
      guard
    );
  }

  async cancelPurchaseInvoice(
    businessId: string,
    userId: string,
    invoiceId: string,
    options: DocumentMutationOptions = {}
  ): Promise<void> {
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) throw AppError.notFound("Purchase invoice not found.");
    if (invoice.status === "cancelled") return;
    const guard = await this.guardDocument(businessId, userId, {
      kind: "purchase_invoice",
      action: "cancel",
      documentDate: invoice.invoiceDate,
      createdAt: invoice.createdAt,
      status: invoice.status,
      overrideLock: options.overrideLock,
      overrideReason: options.overrideReason,
    });
    await this.assertPurchaseNotConsumed(businessId, invoice);
    if (isPostedStatus(invoice.status)) {
      await this.reverseDocumentStock(businessId, userId, invoice.id);
    }
    await this.repos.transactions.updatePurchaseInvoiceStatus(businessId, invoiceId, "cancelled");
    await this.repos.transactions.cancelPaymentsForDocument(businessId, userId, { purchaseInvoiceId: invoiceId });
    await this.auditDocument(
      businessId,
      userId,
      "purchase_invoice.cancelled",
      "purchase_invoice",
      invoice.id,
      { billNo: invoice.billNo },
      guard
    );
  }

  async createPurchaseReturn(
    businessId: string,
    userId: string,
    returnNo: string,
    input: PurchaseReturnInput
  ): Promise<PurchaseReturn> {
    const guard = await this.guardDocument(businessId, userId, {
      kind: "purchase_return",
      action: "create",
      documentDate: input.returnDate,
    });
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
        returnDate: guard.documentDate,
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

    if (input.purchaseInvoiceId) {
      await this.reconcilePurchasePayment(businessId, input.purchaseInvoiceId);
    }

    await this.auditDocument(
      businessId,
      userId,
      "purchase_return.created",
      "purchase_return",
      result.id,
      { returnNo, total },
      guard
    );
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
    const guard = await this.guardDocument(businessId, userId, {
      kind: "sales_return",
      action: "create",
      documentDate: input.returnDate,
    });
    if (!input.salesInvoiceId) {
      throw AppError.validation("Select the original sales invoice.");
    }
    if (input.items.length === 0) {
      throw AppError.validation("Add at least one returned item.");
    }
    const convertedItems = [];
    for (const item of input.items) {
      convertedItems.push(await this.convertReturnItem(businessId, item));
    }

    let stockMoves: Array<{
      productId: string;
      variantId: string | null;
      batchId: string | null;
      quantity: number;
    }> = convertedItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      batchId: null,
      quantity: item.baseQuantity,
    }));
    let markReturned = false;
    let customerId = input.customerId ?? null;

    if (input.salesInvoiceId) {
      const invoice = await this.repos.transactions.getSalesInvoice(businessId, input.salesInvoiceId);
      if (!invoice) throw AppError.notFound("Invoice not found.");
      if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "returned") {
        throw AppError.validation("Returns can only be recorded against a completed invoice.");
      }
      customerId = invoice.customerId ?? customerId;
      const previous = (await this.repos.transactions.listSalesReturns(businessId)).filter(
        (entry) => entry.salesInvoiceId === invoice.id
      );
      const previousByProduct = new Map<string, number>();
      for (const entry of previous) {
        for (const item of entry.items) {
          const soldLine = invoice.items.find((line) => line.productId === item.productId);
          const product = await this.repos.products.getProduct(businessId, item.productId);
          const packaging = packagingFromProduct(product ?? { unit: "pcs" });
          const unitKind = unitKindFromSaleUnit(soldLine?.saleUnit, packaging);
          const previousBase = toBaseQuantity(item.quantity, unitKind, packaging);
          previousByProduct.set(item.productId, (previousByProduct.get(item.productId) ?? 0) + previousBase);
        }
      }
      const allocated = allocateReturnToLots(
        invoice.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          batchId: item.batchId ?? null,
          soldBase: item.baseQuantity ?? item.quantity,
        })),
        Array.from(previousByProduct.entries()).map(([productId, baseQuantity]) => ({
          productId,
          baseQuantity,
        })),
        convertedItems.map((item) => ({
          productId: item.productId,
          baseQuantity: item.baseQuantity,
        }))
      );
      if (allocated.error) throw AppError.validation(allocated.error);
      stockMoves = allocated.allocations;
      markReturned = allocated.fullyReturned;
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
        customerId,
        returnNo,
        returnDate: guard.documentDate,
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

    for (const item of stockMoves) {
      await this.inventory.recordReturnMovement(
        businessId,
        userId,
        item.productId,
        item.variantId,
        item.quantity,
        result.id,
        null,
        item.batchId
      );
    }

    if (input.salesInvoiceId) {
      await this.reconcileSalesPayment(businessId, input.salesInvoiceId);
      if (markReturned) {
        const invoice = await this.repos.transactions.getSalesInvoice(businessId, input.salesInvoiceId);
        await this.repos.transactions.updateSalesInvoiceStatus(
          businessId,
          input.salesInvoiceId,
          "returned",
          invoice?.paidAmount
        );
      }
    }

    await this.auditDocument(
      businessId,
      userId,
      "sales_return.created",
      "sales_return",
      result.id,
      { returnNo, total },
      guard
    );
    return result;
  }

  async listSalesReturns(businessId: string): Promise<SalesReturn[]> {
    return this.repos.transactions.listSalesReturns(businessId);
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    return this.repos.transactions.listPayments(businessId);
  }

  async getPayment(businessId: string, paymentId: string): Promise<Payment | null> {
    return this.repos.transactions.getPayment(businessId, paymentId);
  }

  async deletePaymentsForDocument(
    businessId: string,
    input: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null }
  ): Promise<void> {
    await this.repos.transactions.cancelPaymentsForDocument(businessId, "", input);
  }

  private normalizeAllocations(input: PaymentInput): AllocationRequest[] {
    const rows = (input.allocations ?? []).filter((row) => row.amount > 0);
    if (rows.length > 0) return rows;
    if (input.salesInvoiceId) {
      return [{ salesInvoiceId: input.salesInvoiceId, purchaseInvoiceId: null, amount: input.amount }];
    }
    if (input.purchaseInvoiceId) {
      return [{ salesInvoiceId: null, purchaseInvoiceId: input.purchaseInvoiceId, amount: input.amount }];
    }
    return [];
  }

  private invoiceIdsFromAllocations(rows: AllocationRequest[]) {
    return {
      salesIds: [...new Set(rows.map((row) => row.salesInvoiceId).filter((id): id is string => Boolean(id)))],
      purchaseIds: [...new Set(rows.map((row) => row.purchaseInvoiceId).filter((id): id is string => Boolean(id)))],
    };
  }

  async createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment> {
    const guard = await this.guardDocument(
      businessId,
      userId,
      {
        kind: "payment",
        action: "create",
        documentDate: input.paymentDate,
        overrideLock: input.overrideLock,
        overrideReason: input.overrideReason,
      },
      input.direction
    );
    if (input.amount <= 0) {
      throw AppError.validation("Payment amount must be positive.");
    }
    if (input.partyType === "customer" && input.direction !== "in") {
      throw AppError.validation("Customer receipts must be incoming payments.");
    }
    if (input.partyType === "supplier" && input.direction !== "out") {
      throw AppError.validation("Supplier payments must be outgoing.");
    }

    const allocations = this.normalizeAllocations(input);
    const { salesIds, purchaseIds } = this.invoiceIdsFromAllocations(allocations);
    const remainingByInvoice = new Map<string, number>();
    const payments = await this.repos.transactions.listPayments(businessId);
    const salesReturns = salesIds.length > 0 ? await this.repos.transactions.listSalesReturns(businessId) : [];
    const purchaseReturns = purchaseIds.length > 0 ? await this.repos.transactions.listPurchaseReturns(businessId) : [];

    for (const invoiceId of salesIds) {
      const sale = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
      if (!sale) throw AppError.notFound("Sales invoice not found.");
      if (sale.status === "draft") {
        throw AppError.validation("Complete the draft invoice before recording a payment.");
      }
      if (sale.status === "cancelled") {
        throw AppError.validation("Cancelled invoices cannot be paid.");
      }
      if (input.partyId && sale.customerId && sale.customerId !== input.partyId) {
        throw AppError.validation("A receipt can only be allocated to invoices for the same customer.");
      }
      remainingByInvoice.set(invoiceId, settleSalesInvoice(sale, payments, salesReturns).balance);
    }
    for (const invoiceId of purchaseIds) {
      const bill = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
      if (!bill) throw AppError.notFound("Purchase bill not found.");
      if (bill.status === "draft") {
        throw AppError.validation("Complete the draft bill before recording a payment.");
      }
      if (bill.status === "cancelled") {
        throw AppError.validation("Cancelled bills cannot be paid.");
      }
      if (input.partyId && bill.supplierId && bill.supplierId !== input.partyId) {
        throw AppError.validation("A payment can only be allocated to bills for the same supplier.");
      }
      remainingByInvoice.set(invoiceId, settlePurchaseInvoice(bill, payments, purchaseReturns).balance);
    }

    try {
      validateAllocations({ paymentAmount: input.amount, allocations, remainingByInvoice });
    } catch (error) {
      throw AppError.validation(error instanceof Error ? error.message : "Invalid payment allocation.");
    }

    const documentNo = await this.documents.allocateNumber(businessId, "payment");
    const primarySalesId = salesIds[0] ?? input.salesInvoiceId ?? null;
    const primaryPurchaseId = purchaseIds[0] ?? input.purchaseInvoiceId ?? null;

    const payment = await this.repos.transactions.createPayment(businessId, userId, {
      direction: input.direction,
      partyType: input.partyType,
      partyId: input.partyId ?? null,
      salesInvoiceId: primarySalesId,
      purchaseInvoiceId: primaryPurchaseId,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference ?? null,
      paymentDate: guard.documentDate,
      notes: input.notes ?? null,
      documentNo,
      allocations,
    });

    for (const invoiceId of salesIds) {
      await this.reconcileSalesPayment(businessId, invoiceId);
    }
    for (const invoiceId of purchaseIds) {
      await this.reconcilePurchasePayment(businessId, invoiceId);
    }

    await this.auditDocument(
      businessId,
      userId,
      "payment.created",
      "payment",
      payment.id,
      { amount: input.amount, mode: input.mode, documentNo, allocated: allocations.length },
      guard
    );
    return payment;
  }

  async cancelPayment(
    businessId: string,
    userId: string,
    paymentId: string,
    options: DocumentMutationOptions = {}
  ): Promise<Payment> {
    const existing = await this.repos.transactions.getPayment(businessId, paymentId);
    if (!existing) throw AppError.notFound("Payment not found.");
    const guard = await this.guardDocument(
      businessId,
      userId,
      {
        kind: "payment",
        action: "cancel",
        documentDate: existing.paymentDate,
        createdAt: existing.createdAt,
        status: existing.status,
        overrideLock: options.overrideLock,
        overrideReason: options.overrideReason,
      },
      existing.direction
    );
    const cancelled = await this.repos.transactions.cancelPayment(businessId, userId, paymentId);
    const { salesIds, purchaseIds } = this.invoiceIdsFromAllocations(
      (existing.allocations ?? []).map((row) => ({
        salesInvoiceId: row.salesInvoiceId,
        purchaseInvoiceId: row.purchaseInvoiceId,
        amount: row.amount,
      }))
    );
    for (const invoiceId of salesIds.length > 0 ? salesIds : existing.salesInvoiceId ? [existing.salesInvoiceId] : []) {
      await this.reconcileSalesPayment(businessId, invoiceId);
    }
    for (const invoiceId of purchaseIds.length > 0 ? purchaseIds : existing.purchaseInvoiceId ? [existing.purchaseInvoiceId] : []) {
      await this.reconcilePurchasePayment(businessId, invoiceId);
    }
    await this.auditDocument(
      businessId,
      userId,
      "payment.cancelled",
      "payment",
      paymentId,
      { amount: existing.amount, documentNo: existing.documentNo },
      guard
    );
    return cancelled;
  }

  private async reconcileSalesPayment(businessId: string, invoiceId: string): Promise<void> {
    const invoice = await this.repos.transactions.getSalesInvoice(businessId, invoiceId);
    if (!invoice) return;
    if (invoice.status === "draft" || invoice.status === "cancelled") return;
    const [payments, returns] = await Promise.all([
      this.repos.transactions.listPayments(businessId),
      this.repos.transactions.listSalesReturns(businessId),
    ]);
    const settled = settleSalesInvoice(invoice, payments, returns);
    await this.repos.transactions.updateSalesInvoiceStatus(
      businessId,
      invoiceId,
      settled.status as SalesInvoiceStatus,
      settled.paid
    );
  }

  private async reconcilePurchasePayment(businessId: string, invoiceId: string): Promise<void> {
    const invoice = await this.repos.transactions.getPurchaseInvoice(businessId, invoiceId);
    if (!invoice) return;
    if (invoice.status === "draft" || invoice.status === "cancelled") return;
    const [payments, returns] = await Promise.all([
      this.repos.transactions.listPayments(businessId),
      this.repos.transactions.listPurchaseReturns(businessId),
    ]);
    const settled = settlePurchaseInvoice(invoice, payments, returns);
    await this.repos.transactions.updatePurchaseInvoiceStatus(businessId, invoiceId, settled.status, settled.paid);
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
