import type {
  LineItem,
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
import type {
  PaymentInput,
  PurchaseInvoiceHeaderInput,
  PurchaseOrderHeaderInput,
  ReceiptItemInput,
  ReturnItemInput,
  SalesHeaderInput,
  LineItemInput,
  TransactionRepository,
} from "../transaction.repository";
import { readStorage, writeStorage } from "./local-data";
import { LocalPartyRepository } from "./party.repository";

const SALES_KEY = "demo-sales-invoices";
const ORDERS_KEY = "demo-purchase-orders";
const PURCHASES_KEY = "demo-purchase-invoices";
const PAYMENTS_KEY = "demo-payments";
const PAYMENT_MODES_KEY = "demo-payment-modes";
const RECEIPTS_KEY = "demo-purchase-receipts";
const PURCHASE_RETURNS_KEY = "demo-purchase-returns";
const SALES_RETURNS_KEY = "demo-sales-returns";

const lineToModel = (item: LineItemInput): LineItem => {
  const gross = item.quantity * item.unitPrice;
  const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
  const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
  return {
    productId: item.productId,
    variantId: item.variantId ?? null,
    batchId: item.batchId ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    gstRate: item.gstRate,
    discount: item.discount ?? 0,
    taxableAmount: taxable,
    taxAmount: tax,
    amount: item.amount ?? taxable + tax,
    saleUnit: item.saleUnit ?? null,
    baseQuantity: item.baseQuantity ?? item.quantity,
  };
};

const lineToPurchaseModel = (item: LineItemInput): LineItem => ({
  productId: item.productId,
  variantId: item.variantId ?? null,
  batchId: item.batchId ?? null,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  gstRate: item.gstRate,
  discount: 0,
  taxableAmount: item.quantity * item.unitPrice,
  taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
  amount: item.quantity * item.unitPrice,
  saleUnit: item.saleUnit ?? null,
  baseQuantity: item.baseQuantity ?? item.quantity,
});

export class LocalTransactionRepository implements TransactionRepository {
  private readSales(): SalesInvoice[] {
    return readStorage<SalesInvoice[]>(SALES_KEY, []);
  }
  private saveSales(invoices: SalesInvoice[]): void {
    writeStorage(SALES_KEY, invoices);
  }
  private readOrders(): PurchaseOrder[] {
    return readStorage<PurchaseOrder[]>(ORDERS_KEY, []);
  }
  private saveOrders(orders: PurchaseOrder[]): void {
    writeStorage(ORDERS_KEY, orders);
  }
  private readPurchases(): PurchaseInvoice[] {
    return readStorage<PurchaseInvoice[]>(PURCHASES_KEY, []);
  }
  private savePurchases(invoices: PurchaseInvoice[]): void {
    writeStorage(PURCHASES_KEY, invoices);
  }
  private readPayments(): Payment[] {
    return readStorage<Payment[]>(PAYMENTS_KEY, []);
  }
  private savePayments(payments: Payment[]): void {
    writeStorage(PAYMENTS_KEY, payments);
  }
  private readPaymentModes(): PaymentMode[] {
    return readStorage<PaymentMode[]>(PAYMENT_MODES_KEY, []);
  }
  private savePaymentModes(modes: PaymentMode[]): void {
    writeStorage(PAYMENT_MODES_KEY, modes);
  }
  private readReceipts(): PurchaseReceipt[] {
    return readStorage<PurchaseReceipt[]>(RECEIPTS_KEY, []);
  }
  private saveReceipts(receipts: PurchaseReceipt[]): void {
    writeStorage(RECEIPTS_KEY, receipts);
  }
  private readPurchaseReturns(): PurchaseReturn[] {
    return readStorage<PurchaseReturn[]>(PURCHASE_RETURNS_KEY, []);
  }
  private savePurchaseReturns(returns: PurchaseReturn[]): void {
    writeStorage(PURCHASE_RETURNS_KEY, returns);
  }
  private readSalesReturns(): SalesReturn[] {
    return readStorage<SalesReturn[]>(SALES_RETURNS_KEY, []);
  }
  private saveSalesReturns(returns: SalesReturn[]): void {
    writeStorage(SALES_RETURNS_KEY, returns);
  }

  private defaultPaymentModes(businessId: string): PaymentMode[] {
    const now = new Date().toISOString();
    return [
      { id: `mode-1-${businessId}`, businessId, code: "cash", name: "Cash", isActive: true, sortOrder: 10, createdAt: now, updatedAt: now },
      { id: `mode-2-${businessId}`, businessId, code: "upi", name: "UPI", isActive: true, sortOrder: 20, createdAt: now, updatedAt: now },
      { id: `mode-3-${businessId}`, businessId, code: "card", name: "Card", isActive: true, sortOrder: 30, createdAt: now, updatedAt: now },
      { id: `mode-4-${businessId}`, businessId, code: "bank_transfer", name: "Bank Transfer", isActive: true, sortOrder: 40, createdAt: now, updatedAt: now },
      { id: `mode-5-${businessId}`, businessId, code: "credit", name: "Credit", isActive: true, sortOrder: 50, createdAt: now, updatedAt: now },
      { id: `mode-6-${businessId}`, businessId, code: "other", name: "Other", isActive: true, sortOrder: 60, createdAt: now, updatedAt: now },
    ];
  }

  async listSalesInvoices(businessId: string): Promise<SalesInvoice[]> {
    return this.readSales()
      .filter((i) => i.businessId === businessId)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }

  async getSalesInvoice(businessId: string, invoiceId: string): Promise<SalesInvoice | null> {
    return (
      this.readSales().find((i) => i.businessId === businessId && i.id === invoiceId) ?? null
    );
  }

  async createSalesInvoice(
    businessId: string,
    userId: string,
    header: SalesHeaderInput,
    items: LineItemInput[]
  ): Promise<SalesInvoice> {
    const now = new Date().toISOString();
    const invoice: SalesInvoice = {
      id: `inv-${crypto.randomUUID()}`,
      businessId,
      invoiceNo: header.invoiceNo,
      customerId: header.customerId ?? null,
      invoiceDate: header.invoiceDate,
      dueDate: header.dueDate ?? null,
      status: header.status,
      subtotal: header.subtotal,
      discount: header.discount,
      taxTotal: header.taxTotal,
      total: header.total,
      paidAmount: header.paidAmount,
      paymentMode: header.paymentMode ?? null,
      notes: header.notes ?? null,
      items: items.map(lineToModel),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readSales();
    all.push(invoice);
    this.saveSales(all);
    return invoice;
  }

  async updateSalesInvoiceStatus(
    businessId: string,
    invoiceId: string,
    status: SalesInvoiceStatus
  ): Promise<void> {
    const all = this.readSales();
    const index = all.findIndex((i) => i.businessId === businessId && i.id === invoiceId);
    if (index === -1) throw new Error("Invoice not found.");
    all[index] = { ...all[index], status, updatedAt: new Date().toISOString() };
    this.saveSales(all);
  }

  async listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
    return this.readOrders()
      .filter((o) => o.businessId === businessId)
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  }

  async createPurchaseOrder(
    businessId: string,
    userId: string,
    header: PurchaseOrderHeaderInput,
    items: LineItemInput[]
  ): Promise<PurchaseOrder> {
    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      id: `po-${crypto.randomUUID()}`,
      businessId,
      orderNo: header.orderNo,
      supplierId: header.supplierId ?? null,
      warehouseId: header.warehouseId ?? null,
      orderDate: header.orderDate,
      expectedDate: header.expectedDate ?? null,
      status: header.status,
      subtotal: header.subtotal,
      discount: header.discount,
      taxTotal: header.taxTotal,
      total: header.total,
      notes: header.notes ?? null,
      items: items.map(lineToModel),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readOrders();
    all.push(order);
    this.saveOrders(all);
    return order;
  }

  async listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]> {
    return this.readPurchases()
      .filter((i) => i.businessId === businessId)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }

  async getPurchaseInvoice(businessId: string, invoiceId: string): Promise<PurchaseInvoice | null> {
    return (
      this.readPurchases().find((i) => i.businessId === businessId && i.id === invoiceId) ?? null
    );
  }

  async createPurchaseInvoice(
    businessId: string,
    userId: string,
    header: PurchaseInvoiceHeaderInput,
    items: LineItemInput[]
  ): Promise<PurchaseInvoice> {
    const now = new Date().toISOString();
    const invoice: PurchaseInvoice = {
      id: `purch-${crypto.randomUUID()}`,
      businessId,
      billNo: header.billNo,
      supplierId: header.supplierId ?? null,
      purchaseOrderId: header.purchaseOrderId ?? null,
      invoiceDate: header.invoiceDate,
      dueDate: header.dueDate ?? null,
      status: header.status,
      subtotal: header.subtotal,
      discount: header.discount,
      taxTotal: header.taxTotal,
      total: header.total,
      paidAmount: header.paidAmount,
      notes: header.notes ?? null,
      items: items.map(lineToPurchaseModel),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readPurchases();
    all.push(invoice);
    this.savePurchases(all);
    return invoice;
  }

  async updatePurchaseInvoiceStatus(
    businessId: string,
    invoiceId: string,
    status: string
  ): Promise<void> {
    const all = this.readPurchases();
    const index = all.findIndex((i) => i.businessId === businessId && i.id === invoiceId);
    if (index === -1) throw new Error("Purchase invoice not found.");
    all[index] = { ...all[index], status, updatedAt: new Date().toISOString() };
    this.savePurchases(all);
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    return this.readPayments()
      .filter((p) => p.businessId === businessId)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }

  async createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment> {
    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      businessId,
      direction: input.direction,
      partyType: input.partyType,
      partyId: input.partyId ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      purchaseInvoiceId: input.purchaseInvoiceId ?? null,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference ?? null,
      paymentDate: input.paymentDate,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const all = this.readPayments();
    all.push(payment);
    this.savePayments(all);
    return payment;
  }

  async listPaymentModes(businessId: string): Promise<PaymentMode[]> {
    const all = this.readPaymentModes();
    if (all.length === 0) {
      const defaults = this.defaultPaymentModes(businessId);
      this.savePaymentModes(defaults);
      return defaults;
    }
    return all
      .filter((m) => m.businessId === businessId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createPaymentMode(
    businessId: string,
    input: { code: string; name: string; sortOrder?: number }
  ): Promise<PaymentMode> {
    const now = new Date().toISOString();
    const mode: PaymentMode = {
      id: `mode-${crypto.randomUUID()}`,
      businessId,
      code: input.code,
      name: input.name,
      isActive: true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readPaymentModes();
    all.push(mode);
    this.savePaymentModes(all);
    return mode;
  }

  async updatePaymentMode(
    businessId: string,
    modeId: string,
    input: { name?: string; isActive?: boolean }
  ): Promise<PaymentMode> {
    const all = this.readPaymentModes();
    const index = all.findIndex((m) => m.businessId === businessId && m.id === modeId);
    if (index === -1) throw new Error("Payment mode not found.");
    all[index] = {
      ...all[index],
      name: input.name ?? all[index].name,
      isActive: input.isActive ?? all[index].isActive,
      updatedAt: new Date().toISOString(),
    };
    this.savePaymentModes(all);
    return all[index];
  }

  async nextDocumentNumber(businessId: string, kind: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const collections: Record<string, string[]> = {
      sales: this.readSales().filter((i) => i.businessId === businessId).map((i) => i.invoiceNo),
      purchase_order: this.readOrders().filter((o) => o.businessId === businessId).map((o) => o.orderNo),
      purchase_invoice: this.readPurchases().filter((i) => i.businessId === businessId).map((i) => i.billNo),
      sales_return: this.readSalesReturns().filter((r) => r.businessId === businessId).map((r) => r.returnNo),
      purchase_return: this.readPurchaseReturns().filter((r) => r.businessId === businessId).map((r) => r.returnNo),
    };
    const existing = collections[kind] ?? [];
    const re = new RegExp(`^${prefix.toUpperCase()}-\\d{4}-(\\d+)$`);
    let max = 0;
    for (const number of existing) {
      const match = re.exec(number.toUpperCase());
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `${prefix.toUpperCase()}-${year}-${String(max + 1).padStart(6, "0")}`;
  }

  async createPurchaseReceipt(
    businessId: string,
    userId: string,
    input: {
      purchaseOrderId?: string | null;
      warehouseId?: string | null;
      locationId?: string | null;
      receiptNo: string;
      receivedAt: string;
      notes?: string | null;
    },
    items: ReceiptItemInput[]
  ): Promise<PurchaseReceipt> {
    const receipt: PurchaseReceipt = {
      id: `rcpt-${crypto.randomUUID()}`,
      businessId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      receiptNo: input.receiptNo,
      receivedAt: input.receivedAt,
      notes: input.notes ?? null,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
      createdAt: new Date().toISOString(),
    };
    const all = this.readReceipts();
    all.push(receipt);
    this.saveReceipts(all);
    return receipt;
  }

  async listPurchaseReceipts(businessId: string): Promise<PurchaseReceipt[]> {
    return this.readReceipts()
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async createPurchaseReturn(
    businessId: string,
    userId: string,
    input: {
      purchaseInvoiceId?: string | null;
      supplierId?: string | null;
      returnNo: string;
      returnDate: string;
      reason?: string | null;
      total: number;
      notes?: string | null;
    },
    items: ReturnItemInput[]
  ): Promise<PurchaseReturn> {
    const result: PurchaseReturn = {
      id: `preturn-${crypto.randomUUID()}`,
      businessId,
      purchaseInvoiceId: input.purchaseInvoiceId ?? null,
      supplierId: input.supplierId ?? null,
      returnNo: input.returnNo,
      returnDate: input.returnDate,
      reason: input.reason ?? null,
      total: input.total,
      notes: input.notes ?? null,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitCost: item.unitPrice,
      })),
      createdAt: new Date().toISOString(),
    };
    const all = this.readPurchaseReturns();
    all.push(result);
    this.savePurchaseReturns(all);
    return result;
  }

  async listPurchaseReturns(businessId: string): Promise<PurchaseReturn[]> {
    return this.readPurchaseReturns()
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => b.returnDate.localeCompare(a.returnDate));
  }

  async createSalesReturn(
    businessId: string,
    userId: string,
    input: {
      salesInvoiceId?: string | null;
      customerId?: string | null;
      returnNo: string;
      returnDate: string;
      reason?: string | null;
      total: number;
      notes?: string | null;
    },
    items: ReturnItemInput[]
  ): Promise<SalesReturn> {
    const result: SalesReturn = {
      id: `sreturn-${crypto.randomUUID()}`,
      businessId,
      salesInvoiceId: input.salesInvoiceId ?? null,
      customerId: input.customerId ?? null,
      returnNo: input.returnNo,
      returnDate: input.returnDate,
      reason: input.reason ?? null,
      total: input.total,
      notes: input.notes ?? null,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      createdAt: new Date().toISOString(),
    };
    const all = this.readSalesReturns();
    all.push(result);
    this.saveSalesReturns(all);
    return result;
  }

  async listSalesReturns(businessId: string): Promise<SalesReturn[]> {
    return this.readSalesReturns()
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => b.returnDate.localeCompare(a.returnDate));
  }

  async listSalesInvoicesForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; invoiceNo: string; customerName: string | null }>> {
    const [invoices, party] = await Promise.all([
      this.readSales(),
      new LocalPartyRepository().listCustomers(businessId),
    ]);
    const names = new Map(party.map((c) => [c.id, c.name]));
    return invoices
      .filter((i) => i.businessId === businessId && i.invoiceNo.toLowerCase().includes(query))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        customerName: i.customerId ? (names.get(i.customerId) ?? null) : null,
      }));
  }

  async listPurchaseInvoicesForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; billNo: string; supplierName: string | null }>> {
    const [invoices, party] = await Promise.all([
      this.readPurchases(),
      new LocalPartyRepository().listSuppliers(businessId),
    ]);
    const names = new Map(party.map((s) => [s.id, s.name]));
    return invoices
      .filter((i) => i.businessId === businessId && i.billNo.toLowerCase().includes(query))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        billNo: i.billNo,
        supplierName: i.supplierId ? (names.get(i.supplierId) ?? null) : null,
      }));
  }
}
