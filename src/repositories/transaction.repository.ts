import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  LineItem,
  Payment,
  PurchaseInvoice,
  PurchaseOrder,
  SalesInvoice,
  SalesInvoiceStatus,
} from "@/types/domain";
import { mapPayment, mapPurchaseInvoice, mapPurchaseOrder, mapSalesInvoice } from "./mappers";

export interface LineItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
}

export interface SalesHeaderInput {
  invoiceNo: string;
  customerId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  status: SalesInvoiceStatus;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  paymentMode?: string | null;
  notes?: string | null;
}

export interface PurchaseOrderHeaderInput {
  orderNo: string;
  supplierId?: string | null;
  orderDate: string;
  expectedDate?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  notes?: string | null;
}

export interface PurchaseInvoiceHeaderInput {
  billNo: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  notes?: string | null;
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
  paymentDate: string;
  notes?: string | null;
}

export interface TransactionRepository {
  listSalesInvoices(businessId: string): Promise<SalesInvoice[]>;
  getSalesInvoice(businessId: string, invoiceId: string): Promise<SalesInvoice | null>;
  createSalesInvoice(businessId: string, userId: string, header: SalesHeaderInput, items: LineItemInput[]): Promise<SalesInvoice>;
  updateSalesInvoiceStatus(businessId: string, invoiceId: string, status: SalesInvoiceStatus): Promise<void>;
  listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]>;
  createPurchaseOrder(businessId: string, userId: string, header: PurchaseOrderHeaderInput, items: LineItemInput[]): Promise<PurchaseOrder>;
  listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]>;
  createPurchaseInvoice(businessId: string, userId: string, header: PurchaseInvoiceHeaderInput, items: LineItemInput[]): Promise<PurchaseInvoice>;
  listPayments(businessId: string): Promise<Payment[]>;
  createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment>;
  listSalesInvoicesForSearch(businessId: string, query: string): Promise<Array<{ id: string; invoiceNo: string; customerName: string | null }>>;
  listPurchaseInvoicesForSearch(businessId: string, query: string): Promise<Array<{ id: string; billNo: string; supplierName: string | null }>>;
}

const lineItemToSalesRow = (invoiceId: string, item: LineItemInput) => ({
  sales_invoice_id: invoiceId,
  product_id: item.productId,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  gst_rate: item.gstRate,
  discount: item.discount ?? 0,
  taxable_amount: item.quantity * item.unitPrice,
  tax_amount: item.quantity * item.unitPrice * (item.gstRate / 100),
  amount: item.quantity * item.unitPrice + item.quantity * item.unitPrice * (item.gstRate / 100),
});

const lineItemToPurchaseRow = (invoiceId: string, item: LineItemInput) => ({
  purchase_invoice_id: invoiceId,
  product_id: item.productId,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  gst_rate: item.gstRate,
  amount: item.quantity * item.unitPrice,
});

const lineItemToOrderRow = (orderId: string, item: LineItemInput) => ({
  purchase_order_id: orderId,
  product_id: item.productId,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  gst_rate: item.gstRate,
  amount: item.quantity * item.unitPrice,
  received_quantity: 0,
});

export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(private client: SupabaseClient<Database>) {}

  private async fetchSalesItems(invoiceId: string) {
    const { data, error } = await this.client
      .from("sales_invoice_items")
      .select("*")
      .eq("sales_invoice_id", invoiceId);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      productId: row.product_id ?? "",
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstRate: row.gst_rate,
      discount: row.discount,
      taxableAmount: row.taxable_amount,
      taxAmount: row.tax_amount,
      amount: row.amount,
    }));
  }

  async listSalesInvoices(businessId: string): Promise<SalesInvoice[]> {
    const { data, error } = await this.client
      .from("sales_invoices")
      .select("*")
      .eq("business_id", businessId)
      .order("invoice_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const invoices: SalesInvoice[] = [];
    for (const row of rows) {
      invoices.push({ ...mapSalesInvoice(row), items: await this.fetchSalesItems(row.id) });
    }
    return invoices;
  }

  async getSalesInvoice(businessId: string, invoiceId: string): Promise<SalesInvoice | null> {
    const { data, error } = await this.client
      .from("sales_invoices")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...mapSalesInvoice(data), items: await this.fetchSalesItems(data.id) };
  }

  async createSalesInvoice(
    businessId: string,
    userId: string,
    header: SalesHeaderInput,
    items: LineItemInput[]
  ): Promise<SalesInvoice> {
    const { data, error } = await this.client
      .from("sales_invoices")
      .insert({
        business_id: businessId,
        invoice_no: header.invoiceNo,
        customer_id: header.customerId ?? null,
        invoice_date: header.invoiceDate,
        due_date: header.dueDate ?? null,
        status: header.status,
        subtotal: header.subtotal,
        discount: header.discount,
        tax_total: header.taxTotal,
        total: header.total,
        paid_amount: header.paidAmount,
        payment_mode: header.paymentMode ?? null,
        notes: header.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client
        .from("sales_invoice_items")
        .insert(items.map((item) => lineItemToSalesRow(data.id, item)));
      if (itemError) throw itemError;
    }

    return { ...mapSalesInvoice(data), items: await this.fetchSalesItems(data.id) };
  }

  async updateSalesInvoiceStatus(
    businessId: string,
    invoiceId: string,
    status: SalesInvoiceStatus
  ): Promise<void> {
    const { error } = await this.client
      .from("sales_invoices")
      .update({ status })
      .eq("business_id", businessId)
      .eq("id", invoiceId);
    if (error) throw error;
  }

  private async fetchOrderItems(orderId: string): Promise<LineItem[]> {
    const { data, error } = await this.client
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      productId: row.product_id ?? "",
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstRate: row.gst_rate,
      discount: 0,
      taxableAmount: row.quantity * row.unit_price,
      taxAmount: row.quantity * row.unit_price * (row.gst_rate / 100),
      amount: row.amount,
    }));
  }

  async listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
    const { data, error } = await this.client
      .from("purchase_orders")
      .select("*")
      .eq("business_id", businessId)
      .order("order_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const orders: PurchaseOrder[] = [];
    for (const row of rows) {
      orders.push({ ...mapPurchaseOrder(row), items: await this.fetchOrderItems(row.id) });
    }
    return orders;
  }

  async createPurchaseOrder(
    businessId: string,
    userId: string,
    header: PurchaseOrderHeaderInput,
    items: LineItemInput[]
  ): Promise<PurchaseOrder> {
    const { data, error } = await this.client
      .from("purchase_orders")
      .insert({
        business_id: businessId,
        order_no: header.orderNo,
        supplier_id: header.supplierId ?? null,
        order_date: header.orderDate,
        expected_date: header.expectedDate ?? null,
        status: header.status,
        subtotal: header.subtotal,
        discount: header.discount,
        tax_total: header.taxTotal,
        total: header.total,
        notes: header.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client
        .from("purchase_order_items")
        .insert(items.map((item) => lineItemToOrderRow(data.id, item)));
      if (itemError) throw itemError;
    }

    return { ...mapPurchaseOrder(data), items: await this.fetchOrderItems(data.id) };
  }

  private async fetchPurchaseItems(invoiceId: string): Promise<LineItem[]> {
    const { data, error } = await this.client
      .from("purchase_invoice_items")
      .select("*")
      .eq("purchase_invoice_id", invoiceId);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      productId: row.product_id ?? "",
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstRate: row.gst_rate,
      discount: 0,
      taxableAmount: row.quantity * row.unit_price,
      taxAmount: row.quantity * row.unit_price * (row.gst_rate / 100),
      amount: row.amount,
    }));
  }

  async listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]> {
    const { data, error } = await this.client
      .from("purchase_invoices")
      .select("*")
      .eq("business_id", businessId)
      .order("invoice_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const invoices: PurchaseInvoice[] = [];
    for (const row of rows) {
      invoices.push({ ...mapPurchaseInvoice(row), items: await this.fetchPurchaseItems(row.id) });
    }
    return invoices;
  }

  async createPurchaseInvoice(
    businessId: string,
    userId: string,
    header: PurchaseInvoiceHeaderInput,
    items: LineItemInput[]
  ): Promise<PurchaseInvoice> {
    const { data, error } = await this.client
      .from("purchase_invoices")
      .insert({
        business_id: businessId,
        bill_no: header.billNo,
        supplier_id: header.supplierId ?? null,
        purchase_order_id: header.purchaseOrderId ?? null,
        invoice_date: header.invoiceDate,
        due_date: header.dueDate ?? null,
        status: header.status,
        subtotal: header.subtotal,
        discount: header.discount,
        tax_total: header.taxTotal,
        total: header.total,
        paid_amount: header.paidAmount,
        notes: header.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client
        .from("purchase_invoice_items")
        .insert(items.map((item) => lineItemToPurchaseRow(data.id, item)));
      if (itemError) throw itemError;
    }

    return { ...mapPurchaseInvoice(data), items: await this.fetchPurchaseItems(data.id) };
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPayment);
  }

  async createPayment(
    businessId: string,
    userId: string,
    input: PaymentInput
  ): Promise<Payment> {
    const { data, error } = await this.client
      .from("payments")
      .insert({
        business_id: businessId,
        direction: input.direction,
        party_type: input.partyType,
        party_id: input.partyId ?? null,
        sales_invoice_id: input.salesInvoiceId ?? null,
        purchase_invoice_id: input.purchaseInvoiceId ?? null,
        amount: input.amount,
        mode: input.mode,
        reference: input.reference ?? null,
        payment_date: input.paymentDate,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return mapPayment(data);
  }

  async listSalesInvoicesForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; invoiceNo: string; customerName: string | null }>> {
    const [invoices, customers] = await Promise.all([
      this.listSalesInvoices(businessId),
      this.client.from("customers").select("id, name").eq("business_id", businessId),
    ]);
    const customerNames = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
    return invoices
      .filter((i) => i.invoiceNo.toLowerCase().includes(query))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        customerName: i.customerId ? (customerNames.get(i.customerId) ?? null) : null,
      }));
  }

  async listPurchaseInvoicesForSearch(
    businessId: string,
    query: string
  ): Promise<Array<{ id: string; billNo: string; supplierName: string | null }>> {
    const [invoices, suppliers] = await Promise.all([
      this.listPurchaseInvoices(businessId),
      this.client.from("suppliers").select("id, name").eq("business_id", businessId),
    ]);
    const supplierNames = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));
    return invoices
      .filter((i) => i.billNo.toLowerCase().includes(query))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        billNo: i.billNo,
        supplierName: i.supplierId ? (supplierNames.get(i.supplierId) ?? null) : null,
      }));
  }
}
