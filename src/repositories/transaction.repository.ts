import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  LineItem,
  Payment,
  PaymentAllocation,
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
  mapPaymentAllocation,
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
import { allocateReceivedQuantities, receivingStatusForItems } from "@/lib/purchase-receiving";
import { annotateDatabaseError } from "@/lib/errors";
import { isMissingColumnError, isMissingRelationError, omitColumns } from "@/lib/supabase/missing-column";

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

export interface PaymentAllocationInput {
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
  paymentDate: string;
  notes?: string | null;
  documentNo?: string | null;
  status?: "posted" | "cancelled";
  allocations?: PaymentAllocationInput[];
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
  updateSalesInvoice(businessId: string, invoiceId: string, header: SalesHeaderInput, items: LineItemInput[]): Promise<SalesInvoice>;
  updateSalesInvoiceStatus(businessId: string, invoiceId: string, status: SalesInvoiceStatus, paidAmount?: number): Promise<void>;
  deleteSalesInvoice(businessId: string, invoiceId: string): Promise<void>;
  listPurchaseOrders(businessId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(businessId: string, orderId: string): Promise<PurchaseOrder | null>;
  createPurchaseOrder(businessId: string, userId: string, header: PurchaseOrderHeaderInput, items: LineItemInput[]): Promise<PurchaseOrder>;
  applyPurchaseReceiptQuantities(
    businessId: string,
    purchaseOrderId: string,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<PurchaseOrder>;
  listPurchaseInvoices(businessId: string): Promise<PurchaseInvoice[]>;
  getPurchaseInvoice(businessId: string, invoiceId: string): Promise<PurchaseInvoice | null>;
  createPurchaseInvoice(businessId: string, userId: string, header: PurchaseInvoiceHeaderInput, items: LineItemInput[]): Promise<PurchaseInvoice>;
  updatePurchaseInvoice(businessId: string, invoiceId: string, header: PurchaseInvoiceHeaderInput, items: LineItemInput[]): Promise<PurchaseInvoice>;
  updatePurchaseInvoiceStatus(businessId: string, invoiceId: string, status: string, paidAmount?: number): Promise<void>;
  deletePurchaseInvoice(businessId: string, invoiceId: string): Promise<void>;
  listPayments(businessId: string): Promise<Payment[]>;
  getPayment(businessId: string, paymentId: string): Promise<Payment | null>;
  createPayment(businessId: string, userId: string, input: PaymentInput): Promise<Payment>;
  cancelPayment(businessId: string, userId: string, paymentId: string): Promise<Payment>;
  deletePaymentsForDocument(businessId: string, input: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null }): Promise<void>;
  cancelPaymentsForDocument(businessId: string, userId: string, input: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null }): Promise<void>;
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

  async updateSalesInvoice(
    businessId: string,
    invoiceId: string,
    header: SalesHeaderInput,
    items: LineItemInput[]
  ): Promise<SalesInvoice> {
    const { data, error } = await this.client
      .from("sales_invoices")
      .update({
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
      })
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .select()
      .single();
    if (error) throw error;

    const { error: deleteError } = await this.client
      .from("sales_invoice_items")
      .delete()
      .eq("sales_invoice_id", invoiceId);
    if (deleteError) throw deleteError;

    if (items.length > 0) {
      const { error: itemError } = await this.client
        .from("sales_invoice_items")
        .insert(items.map((item) => lineItemToSalesRow(invoiceId, item)));
      if (itemError) throw itemError;
    }

    return { ...mapSalesInvoice(data), items: await this.fetchSalesItems(invoiceId) };
  }

  async updateSalesInvoiceStatus(
    businessId: string,
    invoiceId: string,
    status: SalesInvoiceStatus,
    paidAmount?: number
  ): Promise<void> {
    const patch: { status: SalesInvoiceStatus; paid_amount?: number } = { status };
    if (paidAmount != null) patch.paid_amount = paidAmount;
    const { error } = await this.client
      .from("sales_invoices")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", invoiceId);
    if (error) throw error;
  }

  async deleteSalesInvoice(businessId: string, invoiceId: string): Promise<void> {
    const { error } = await this.client
      .from("sales_invoices")
      .delete()
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
      receivedQuantity: row.received_quantity ?? 0,
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

  async getPurchaseOrder(businessId: string, orderId: string): Promise<PurchaseOrder | null> {
    const { data, error } = await this.client
      .from("purchase_orders")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...mapPurchaseOrder(data), items: await this.fetchOrderItems(data.id) };
  }

  async applyPurchaseReceiptQuantities(
    businessId: string,
    purchaseOrderId: string,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<PurchaseOrder> {
    const { data: rows, error: fetchError } = await this.client
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);
    if (fetchError) throw fetchError;
    const allocated = allocateReceivedQuantities(
      (rows ?? []).map((row) => ({
        id: row.id,
        productId: row.product_id ?? "",
        quantity: row.quantity,
        receivedQuantity: row.received_quantity ?? 0,
      })),
      items
    );
    for (const line of allocated) {
      const { error: updateError } = await this.client
        .from("purchase_order_items")
        .update({ received_quantity: line.receivedQuantity })
        .eq("id", line.id);
      if (updateError) throw updateError;
    }
    const order = await this.getPurchaseOrder(businessId, purchaseOrderId);
    if (!order) throw new Error("Purchase order not found.");
    const status = receivingStatusForItems(order.items);
    const { error: statusError } = await this.client
      .from("purchase_orders")
      .update({ status })
      .eq("business_id", businessId)
      .eq("id", purchaseOrderId);
    if (statusError) throw statusError;
    return { ...order, status };
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
    if (error) throw annotateDatabaseError(error, "purchase_invoices", "insert");

    if (items.length > 0) {
      const rows = items.map((item) => lineItemToPurchaseRow(data.id, item));
      const first = await this.client.from("purchase_invoice_items").insert(rows);
      if (first.error) {
        if (!isMissingColumnError(first.error)) {
          throw annotateDatabaseError(first.error, "purchase_invoice_items", "insert");
        }
        const fallback = await this.client
          .from("purchase_invoice_items")
          .insert(rows.map((row) => omitColumns(row, ["sale_unit", "base_quantity"])));
        if (fallback.error) throw annotateDatabaseError(fallback.error, "purchase_invoice_items", "insert");
      }
    }

    return { ...mapPurchaseInvoice(data), items: await this.fetchPurchaseItems(data.id) };
  }

  async updatePurchaseInvoice(
    businessId: string,
    invoiceId: string,
    header: PurchaseInvoiceHeaderInput,
    items: LineItemInput[]
  ): Promise<PurchaseInvoice> {
    const { data, error } = await this.client
      .from("purchase_invoices")
      .update({
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
      })
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .select()
      .single();
    if (error) throw annotateDatabaseError(error, "purchase_invoices", "update");

    const { error: deleteError } = await this.client
      .from("purchase_invoice_items")
      .delete()
      .eq("purchase_invoice_id", invoiceId);
    if (deleteError) throw annotateDatabaseError(deleteError, "purchase_invoice_items", "delete");

    if (items.length > 0) {
      const rows = items.map((item) => lineItemToPurchaseRow(invoiceId, item));
      const first = await this.client.from("purchase_invoice_items").insert(rows);
      if (first.error) {
        if (!isMissingColumnError(first.error)) {
          throw annotateDatabaseError(first.error, "purchase_invoice_items", "insert");
        }
        const fallback = await this.client
          .from("purchase_invoice_items")
          .insert(rows.map((row) => omitColumns(row, ["sale_unit", "base_quantity"])));
        if (fallback.error) throw annotateDatabaseError(fallback.error, "purchase_invoice_items", "insert");
      }
    }

    return { ...mapPurchaseInvoice(data), items: await this.fetchPurchaseItems(invoiceId) };
  }

  private async listAllocations(businessId: string, paymentIds: string[]): Promise<PaymentAllocation[]> {
    if (paymentIds.length === 0) return [];
    const { data, error } = await this.client
      .from("payment_allocations")
      .select("*")
      .eq("business_id", businessId)
      .in("payment_id", paymentIds);
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return (data ?? []).map(mapPaymentAllocation);
  }

  private attachAllocations(payments: Payment[], allocations: PaymentAllocation[]): Payment[] {
    const byPayment = new Map<string, PaymentAllocation[]>();
    for (const row of allocations) {
      const list = byPayment.get(row.paymentId) ?? [];
      list.push(row);
      byPayment.set(row.paymentId, list);
    }
    return payments.map((payment) => ({
      ...payment,
      allocations: byPayment.get(payment.id) ?? payment.allocations ?? [],
    }));
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    const payments = (data ?? []).map((row) => mapPayment(row));
    const allocations = await this.listAllocations(businessId, payments.map((payment) => payment.id));
    return this.attachAllocations(payments, allocations);
  }

  async getPayment(businessId: string, paymentId: string): Promise<Payment | null> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const payment = mapPayment(data);
    const allocations = await this.listAllocations(businessId, [payment.id]);
    return this.attachAllocations([payment], allocations)[0] ?? payment;
  }

  private allocationRows(businessId: string, paymentId: string, input: PaymentInput) {
    const rows = (input.allocations ?? []).filter((row) => row.amount > 0);
    if (rows.length > 0) {
      return rows.map((row) => ({
        business_id: businessId,
        payment_id: paymentId,
        sales_invoice_id: row.salesInvoiceId ?? null,
        purchase_invoice_id: row.purchaseInvoiceId ?? null,
        amount: row.amount,
      }));
    }
    if (input.salesInvoiceId) {
      return [{
        business_id: businessId,
        payment_id: paymentId,
        sales_invoice_id: input.salesInvoiceId,
        purchase_invoice_id: null,
        amount: input.amount,
      }];
    }
    if (input.purchaseInvoiceId) {
      return [{
        business_id: businessId,
        payment_id: paymentId,
        sales_invoice_id: null,
        purchase_invoice_id: input.purchaseInvoiceId,
        amount: input.amount,
      }];
    }
    return [];
  }

  async createPayment(
    businessId: string,
    userId: string,
    input: PaymentInput
  ): Promise<Payment> {
    const payload = {
      business_id: businessId,
      document_no: input.documentNo ?? null,
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
      status: input.status ?? "posted",
      created_by: userId,
    };
    let data;
    let error;
    ({ data, error } = await this.client.from("payments").insert(payload).select().single());
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await this.client
        .from("payments")
        .insert(omitColumns(payload, ["document_no", "status"]))
        .select()
        .single());
    }
    if (error || !data) throw error ?? new Error("Payment was not created.");
    const allocationRows = this.allocationRows(businessId, data.id, input);
    if (allocationRows.length > 0) {
      const { error: allocError } = await this.client.from("payment_allocations").insert(allocationRows);
      if (allocError && !isMissingRelationError(allocError)) throw allocError;
    }
    const allocations = await this.listAllocations(businessId, [data.id]);
    return mapPayment(data, allocations);
  }

  async cancelPayment(businessId: string, userId: string, paymentId: string): Promise<Payment> {
    const existing = await this.getPayment(businessId, paymentId);
    if (!existing) throw new Error("Payment not found.");
    if (existing.status === "cancelled") return existing;
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("payments")
      .update({ status: "cancelled", cancelled_at: now, cancelled_by: userId })
      .eq("business_id", businessId)
      .eq("id", paymentId)
      .select()
      .single();
    if (error) {
      if (isMissingColumnError(error)) {
        return { ...existing, status: "cancelled", cancelledAt: now, cancelledBy: userId };
      }
      throw error;
    }
    return mapPayment(data, existing.allocations ?? []);
  }

  async deletePaymentsForDocument(
    businessId: string,
    input: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null }
  ): Promise<void> {
    await this.cancelPaymentsForDocument(businessId, "", input);
  }

  async cancelPaymentsForDocument(
    businessId: string,
    userId: string,
    input: { salesInvoiceId?: string | null; purchaseInvoiceId?: string | null }
  ): Promise<void> {
    const payments = await this.listPayments(businessId);
    const matches = payments.filter((payment) => {
      if (payment.status === "cancelled") return false;
      if (input.salesInvoiceId) {
        return payment.salesInvoiceId === input.salesInvoiceId
          || (payment.allocations ?? []).some((row) => row.salesInvoiceId === input.salesInvoiceId);
      }
      if (input.purchaseInvoiceId) {
        return payment.purchaseInvoiceId === input.purchaseInvoiceId
          || (payment.allocations ?? []).some((row) => row.purchaseInvoiceId === input.purchaseInvoiceId);
      }
      return false;
    });
    for (const payment of matches) {
      await this.cancelPayment(businessId, userId, payment.id);
    }
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
    status: string,
    paidAmount?: number
  ): Promise<void> {
    const patch: { status: string; paid_amount?: number } = { status };
    if (paidAmount != null) patch.paid_amount = paidAmount;
    const { error } = await this.client
      .from("purchase_invoices")
      .update(patch)
      .eq("business_id", businessId)
      .eq("id", invoiceId);
    if (error) throw error;
  }

  async deletePurchaseInvoice(businessId: string, invoiceId: string): Promise<void> {
    const { error } = await this.client
      .from("purchase_invoices")
      .delete()
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
