import type {
  LineItem,
  Payment,
  PurchaseInvoice,
  PurchaseOrder,
  SalesInvoice,
  SalesInvoiceStatus,
} from "@/types/domain";
import type {
  PaymentInput,
  PurchaseInvoiceHeaderInput,
  PurchaseOrderHeaderInput,
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

const lineToModel = (item: LineItemInput): LineItem => ({
  productId: item.productId,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  gstRate: item.gstRate,
  discount: item.discount ?? 0,
  taxableAmount: item.quantity * item.unitPrice,
  taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
  amount: item.quantity * item.unitPrice + item.quantity * item.unitPrice * (item.gstRate / 100),
});

const lineToPurchaseModel = (item: LineItemInput): LineItem => ({
  productId: item.productId,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  gstRate: item.gstRate,
  discount: 0,
  taxableAmount: item.quantity * item.unitPrice,
  taxAmount: item.quantity * item.unitPrice * (item.gstRate / 100),
  amount: item.quantity * item.unitPrice,
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
