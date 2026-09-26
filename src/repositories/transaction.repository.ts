import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
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
import {
  mapPayment,
  mapPaymentMode,
  mapPurchaseInvoice,
  mapPurchaseOrder,
  mapPurchaseReceipt,
  mapPurchaseReceiptItem,
  mapPurchaseReturn,
  mapPurchaseReturnItem,
  mapSalesInvoice,
  mapSalesReturn,
  mapSalesReturnItem,
} from "./mappers";

export interface LineItemInput {
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  amount?: number;
  saleUnit?: string | null;
  baseQuantity?: number | null;
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
  warehouseId?: string | null;
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

export interface ReceiptItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitCost: number;
}

export interface ReturnItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface TransactionRepository {
  listSalesInvoices(businessId: string): Promise<SalesInvoice[]>;
  getSalesInvoice(businessId: string, invoiceId: string): Promise<SalesInvoice | null>;
  createSalesInvoice(businessId: string, userId: string, header: SalesHeaderInput, items: LineItemInput[]): Promise<SalesInvoice>;
  updateSalesInvoiceStatus(businessId: string, invoiceId: string, status: SalesInvoiceStatus): Promise<void>;
  listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]>;
  createPurchaseOrder(businessId: string, userId: string, header: PurchaseOrderHeaderInput, items: LineItemInput[]): Promise<PurchaseOrder>;
  listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]>;
  getPurchaseInvoice(businessId: string, invoiceId: string): Promise<PurchaseInvoice | null>;
  createPurchaseInvoice(businessId: string, userId: string, header: PurchaseInvoiceHeaderInput, items: LineItemInput[]): Promise<PurchaseInvoice>;
  updatePurchaseInvoiceStatus(businessId: string, invoiceId: string, status: string): Promise<void>;
  listPayments(businessId: string): Promise<Payment[]>;
  createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment>;
  listPaymentModes(businessId: string): Promise<PaymentMode[]>;
  createPaymentMode(businessId: string, input: { code: string; name: string; sortOrder?: number }): Promise<PaymentMode>;
  updatePaymentMode(businessId: string, modeId: string, input: { name?: string; isActive?: boolean }): Promise<PaymentMode>;
  nextDocumentNumber(businessId: string, kind: string, prefix: string): Promise<string>;
  createPurchaseReceipt(businessId: string, userId: string, input: { purchaseOrderId?: string | null; warehouseId?: string | null; locationId?: string | null; receiptNo: string; receivedAt: string; notes?: string | null }, items: ReceiptItemInput[]): Promise<PurchaseReceipt>;
  listPurchaseReceipts(businessId: string): Promise<PurchaseReceipt[]>;
  createPurchaseReturn(businessId: string, userId: string, input: { purchaseInvoiceId?: string | null; supplierId?: string | null; returnNo: string; returnDate: string; reason?: string | null; total: number; notes?: string | null }, items: ReturnItemInput[]): Promise<PurchaseReturn>;
  listPurchaseReturns(businessId: string): Promise<PurchaseReturn[]>;
  createSalesReturn(businessId: string, userId: string, input: { salesInvoiceId?: string | null; customerId?: string | null; returnNo: string; returnDate: string; reason?: string | null; total: number; notes?: string | null }, items: ReturnItemInput[]): Promise<SalesReturn>;
  listSalesReturns(businessId: string): Promise<SalesReturn[]>;
  listSalesInvoicesForSearch(businessId: string, query: string): Promise<Array<{ id: string; invoiceNo: string; customerName: string | null }>>;
  listPurchaseInvoicesForSearch(businessId: string, query: string): Promise<Array<{ id: string; billNo: string; supplierName: string | null }>>;
}

const lineItemToSalesRow = (invoiceId: string, item: LineItemInput) => {
  const gross = item.quantity * item.unitPrice;
  const taxable = item.taxableAmount ?? Math.max(0, gross - (item.discount ?? 0));
  const tax = item.taxAmount ?? (taxable * item.gstRate) / 100;
  return {
    sales_invoice_id: invoiceId,
    product_id: item.productId,
    batch_id: item.batchId ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    gst_rate: item.gstRate,
    discount: item.discount ?? 0,
    taxable_amount: taxable,
    tax_amount: tax,
    amount: item.amount ?? taxable + tax,
    sale_unit: item.saleUnit ?? null,
    base_quantity: item.baseQuantity ?? item.quantity,
  };
};

const lineItemToPurchaseRow = (invoiceId: string, item: LineItemInput) => ({
  purchase_invoice_id: invoiceId,
  product_id: item.productId,
  batch_id: item.batchId ?? null,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  gst_rate: item.gstRate,
  amount: item.quantity * item.unitPrice,
  sale_unit: item.saleUnit ?? null,
  base_quantity: item.baseQuantity ?? item.quantity,
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
      variantId: null,
      batchId: row.batch_id ?? null,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstRate: row.gst_rate,
      discount: row.discount,
      taxableAmount: row.taxable_amount,
      taxAmount: row.tax_amount,
      amount: row.amount,
      saleUnit: row.sale_unit ?? null,
      baseQuantity: row.base_quantity ?? row.quantity,
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
        warehouse_id: header.warehouseId ?? null,
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
      variantId: null,
      batchId: row.batch_id ?? null,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstRate: row.gst_rate,
      discount: 0,
      taxableAmount: row.quantity * row.unit_price,
      taxAmount: row.quantity * row.unit_price * (row.gst_rate / 100),
      amount: row.amount,
      saleUnit: row.sale_unit ?? null,
      baseQuantity: row.base_quantity ?? row.quantity,
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

  async listPaymentModes(businessId: string): Promise<PaymentMode[]> {
    const { data, error } = await this.client
      .from("payment_modes")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapPaymentMode);
  }

  async createPaymentMode(
    businessId: string,
    input: { code: string; name: string; sortOrder?: number }
  ): Promise<PaymentMode> {
    const { data, error } = await this.client
      .from("payment_modes")
      .insert({
        business_id: businessId,
        code: input.code,
        name: input.name,
        sort_order: input.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return mapPaymentMode(data);
  }

  async updatePaymentMode(
    businessId: string,
    modeId: string,
    input: { name?: string; isActive?: boolean }
  ): Promise<PaymentMode> {
    const { data, error } = await this.client
      .from("payment_modes")
      .update({ name: input.name, is_active: input.isActive })
      .eq("business_id", businessId)
      .eq("id", modeId)
      .select()
      .single();
    if (error) throw error;
    return mapPaymentMode(data);
  }

  async nextDocumentNumber(businessId: string, kind: string, prefix: string): Promise<string> {
    const { data, error } = await this.client.rpc("next_document_number", {
      p_business: businessId,
      p_kind: kind,
      p_prefix: prefix,
    });
    if (error) throw error;
    return data as string;
  }

  private async fetchReceiptItems(receiptId: string): Promise<PurchaseReceipt["items"]> {
    const { data, error } = await this.client
      .from("purchase_receipt_items")
      .select("*")
      .eq("receipt_id", receiptId);
    if (error) throw error;
    return (data ?? []).map(mapPurchaseReceiptItem);
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
    const { data, error } = await this.client
      .from("purchase_receipts")
      .insert({
        business_id: businessId,
        purchase_order_id: input.purchaseOrderId ?? null,
        warehouse_id: input.warehouseId ?? null,
        location_id: input.locationId ?? null,
        receipt_no: input.receiptNo,
        received_at: input.receivedAt,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client.from("purchase_receipt_items").insert(
        items.map((item) => ({
          receipt_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
          unit_cost: item.unitCost,
        }))
      );
      if (itemError) throw itemError;
    }

    return { ...mapPurchaseReceipt(data), items: await this.fetchReceiptItems(data.id) };
  }

  async listPurchaseReceipts(businessId: string): Promise<PurchaseReceipt[]> {
    const { data, error } = await this.client
      .from("purchase_receipts")
      .select("*")
      .eq("business_id", businessId)
      .order("received_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const receipts: PurchaseReceipt[] = [];
    for (const row of rows) {
      receipts.push({ ...mapPurchaseReceipt(row), items: await this.fetchReceiptItems(row.id) });
    }
    return receipts;
  }

  private async fetchPurchaseReturnItems(returnId: string): Promise<PurchaseReturn["items"]> {
    const { data, error } = await this.client
      .from("purchase_return_items")
      .select("*")
      .eq("return_id", returnId);
    if (error) throw error;
    return (data ?? []).map(mapPurchaseReturnItem);
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
    const { data, error } = await this.client
      .from("purchase_returns")
      .insert({
        business_id: businessId,
        purchase_invoice_id: input.purchaseInvoiceId ?? null,
        supplier_id: input.supplierId ?? null,
        return_no: input.returnNo,
        return_date: input.returnDate,
        reason: input.reason ?? null,
        total: input.total,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client.from("purchase_return_items").insert(
        items.map((item) => ({
          return_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
          unit_cost: item.unitPrice,
        }))
      );
      if (itemError) throw itemError;
    }

    return { ...mapPurchaseReturn(data), items: await this.fetchPurchaseReturnItems(data.id) };
  }

  async listPurchaseReturns(businessId: string): Promise<PurchaseReturn[]> {
    const { data, error } = await this.client
      .from("purchase_returns")
      .select("*")
      .eq("business_id", businessId)
      .order("return_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const returns: PurchaseReturn[] = [];
    for (const row of rows) {
      returns.push({ ...mapPurchaseReturn(row), items: await this.fetchPurchaseReturnItems(row.id) });
    }
    return returns;
  }

  private async fetchSalesReturnItems(returnId: string): Promise<SalesReturn["items"]> {
    const { data, error } = await this.client
      .from("sales_return_items")
      .select("*")
      .eq("return_id", returnId);
    if (error) throw error;
    return (data ?? []).map(mapSalesReturnItem);
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
    const { data, error } = await this.client
      .from("sales_returns")
      .insert({
        business_id: businessId,
        sales_invoice_id: input.salesInvoiceId ?? null,
        customer_id: input.customerId ?? null,
        return_no: input.returnNo,
        return_date: input.returnDate,
        reason: input.reason ?? null,
        total: input.total,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemError } = await this.client.from("sales_return_items").insert(
        items.map((item) => ({
          return_id: data.id,
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        }))
      );
      if (itemError) throw itemError;
    }

    return { ...mapSalesReturn(data), items: await this.fetchSalesReturnItems(data.id) };
  }

  async listSalesReturns(businessId: string): Promise<SalesReturn[]> {
    const { data, error } = await this.client
      .from("sales_returns")
      .select("*")
      .eq("business_id", businessId)
      .order("return_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const returns: SalesReturn[] = [];
    for (const row of rows) {
      returns.push({ ...mapSalesReturn(row), items: await this.fetchSalesReturnItems(row.id) });
    }
    return returns;
  }

  async getPurchaseInvoice(businessId: string, invoiceId: string): Promise<PurchaseInvoice | null> {
    const { data, error } = await this.client
      .from("purchase_invoices")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...mapPurchaseInvoice(data), items: await this.fetchPurchaseItems(data.id) };
  }

  async updatePurchaseInvoiceStatus(
    businessId: string,
    invoiceId: string,
    status: string
  ): Promise<void> {
    const { error } = await this.client
      .from("purchase_invoices")
      .update({ status })
      .eq("business_id", businessId)
      .eq("id", invoiceId);
    if (error) throw error;
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
