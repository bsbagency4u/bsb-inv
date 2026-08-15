import type {
  Business,
  BusinessMember,
  Category,
  Customer,
  Notification,
  Payment,
  Product,
  ProductBatch,
  ProductStockView,
  Profile,
  PurchaseInvoice,
  PurchaseOrder,
  SalesInvoice,
  Supplier,
} from "@/lib/supabase/types";
import type {
  BusinessMembership,
  BusinessProfile,
  Category as CategoryModel,
  Customer as CustomerModel,
  NotificationItem,
  Payment as PaymentModel,
  Product as ProductModel,
  ProductBatch as ProductBatchModel,
  ProductStock,
  PurchaseInvoice as PurchaseInvoiceModel,
  PurchaseOrder as PurchaseOrderModel,
  SalesInvoice as SalesInvoiceModel,
  SessionUser,
  Supplier as SupplierModel,
} from "@/types/domain";

const asNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export function mapCategory(row: Category): CategoryModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProduct(row: Product): ProductModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    unit: row.unit,
    attributes: (row.attributes ?? {}) as Record<string, string | number | boolean | null>,
    gstRate: asNumber(row.gst_rate),
    hsn: row.hsn,
    purchasePrice: asNumber(row.purchase_price),
    salePrice: asNumber(row.sale_price),
    mrp: row.mrp === null ? null : asNumber(row.mrp),
    lowStockThreshold: asNumber(row.low_stock_threshold),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductBatch(row: ProductBatch): ProductBatchModel {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    batchNo: row.batch_no,
    expiryDate: row.expiry_date,
    mrp: row.mrp === null ? null : asNumber(row.mrp),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductStock(row: ProductStockView): ProductStock {
  return {
    productId: row.product_id,
    quantity: asNumber(row.quantity),
    lastMovementAt: row.last_movement_at,
  };
}

export function mapCustomer(row: Customer): CustomerModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    gstin: row.gstin,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    openingBalance: asNumber(row.opening_balance),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSupplier(row: Supplier): SupplierModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    gstin: row.gstin,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    openingBalance: asNumber(row.opening_balance),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSalesInvoice(row: SalesInvoice): SalesInvoiceModel {
  return {
    id: row.id,
    businessId: row.business_id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status as SalesInvoiceModel["status"],
    subtotal: asNumber(row.subtotal),
    discount: asNumber(row.discount),
    taxTotal: asNumber(row.tax_total),
    total: asNumber(row.total),
    paidAmount: asNumber(row.paid_amount),
    paymentMode: row.payment_mode,
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPurchaseOrder(row: PurchaseOrder): PurchaseOrderModel {
  return {
    id: row.id,
    businessId: row.business_id,
    orderNo: row.order_no,
    supplierId: row.supplier_id,
    orderDate: row.order_date,
    expectedDate: row.expected_date,
    status: row.status,
    subtotal: asNumber(row.subtotal),
    discount: asNumber(row.discount),
    taxTotal: asNumber(row.tax_total),
    total: asNumber(row.total),
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPurchaseInvoice(row: PurchaseInvoice): PurchaseInvoiceModel {
  return {
    id: row.id,
    businessId: row.business_id,
    billNo: row.bill_no,
    supplierId: row.supplier_id,
    purchaseOrderId: row.purchase_order_id,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status,
    subtotal: asNumber(row.subtotal),
    discount: asNumber(row.discount),
    taxTotal: asNumber(row.tax_total),
    total: asNumber(row.total),
    paidAmount: asNumber(row.paid_amount),
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPayment(row: Payment): PaymentModel {
  return {
    id: row.id,
    businessId: row.business_id,
    direction: row.direction as PaymentModel["direction"],
    partyType: row.party_type as PaymentModel["partyType"],
    partyId: row.party_id,
    salesInvoiceId: row.sales_invoice_id,
    purchaseInvoiceId: row.purchase_invoice_id,
    amount: asNumber(row.amount),
    mode: row.mode,
    reference: row.reference,
    paymentDate: row.payment_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapNotification(row: Notification): NotificationItem {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    title: row.title,
    description: asNullableString(row.description) ?? undefined,
    type: row.type as NotificationItem["type"],
    href: asNullableString(row.href) ?? undefined,
    read: row.read,
    timestamp: row.created_at,
  };
}

export function mapBusiness(row: Business): BusinessProfile {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    type: row.type,
    logoUrl: row.logo_url,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    phone: row.phone,
    email: row.email,
    website: row.website,
    gstin: row.gstin,
    pan: row.pan,
    currency: row.currency,
    financialYear: row.financial_year,
    invoicePrefix: row.invoice_prefix,
    invoiceStartNumber: row.invoice_start_number,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMembership(row: BusinessMember): BusinessMembership {
  return {
    businessId: row.business_id,
    userId: row.user_id,
    roleSlug: row.role_id,
    isOwner: row.is_owner,
  };
}

export function mapProfile(row: Profile): SessionUser {
  return {
    id: row.id,
    email: "",
    fullName: row.full_name ?? "User",
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: null,
    isOwner: false,
    isDemo: false,
  };
}
