import type {
  Brand,
  Business,
  BusinessInvitation,
  BusinessMember,
  Category,
  Customer,
  Notification,
  Payment,
  PaymentMode,
  Permission,
  Product,
  ProductBatch,
  ProductImage,
  ProductStockView,
  ProductVariant,
  Profile,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseReceiptItem,
  PurchaseReturn,
  PurchaseReturnItem,
  Role,
  SalesInvoice,
  SalesReturn,
  SalesReturnItem,
  StockBalanceView,
  StockLedger,
  StockLocation,
  Supplier,
  Unit,
  Warehouse,
} from "@/lib/supabase/types";
import type {
  Brand as BrandModel,
  BusinessMembership,
  BusinessProfile,
  Category as CategoryModel,
  Customer as CustomerModel,
  NotificationItem,
  Payment as PaymentModel,
  PaymentMode as PaymentModeModel,
  Permission as PermissionModel,
  Product as ProductModel,
  ProductBatch as ProductBatchModel,
  ProductImage as ProductImageModel,
  ProductStock,
  ProductVariant as ProductVariantModel,
  PurchaseInvoice as PurchaseInvoiceModel,
  PurchaseOrder as PurchaseOrderModel,
  PurchaseReceipt as PurchaseReceiptModel,
  PurchaseReturn as PurchaseReturnModel,
  Role as RoleModel,
  SalesInvoice as SalesInvoiceModel,
  SalesReturn as SalesReturnModel,
  SessionUser,
  StockBalance,
  TeamInvitation,
  StockLocation as StockLocationModel,
  StockMovement,
  Supplier as SupplierModel,
  Unit as UnitModel,
  Warehouse as WarehouseModel,
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
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUnit(row: Unit): UnitModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBrand(row: Brand): BrandModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWarehouse(row: Warehouse): WarehouseModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    code: row.code,
    address: row.address,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStockLocation(row: StockLocation): StockLocationModel {
  return {
    id: row.id,
    businessId: row.business_id,
    warehouseId: row.warehouse_id,
    parentId: row.parent_id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductVariant(row: ProductVariant): ProductVariantModel {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    sku: row.sku,
    barcode: row.barcode,
    attributes: (row.attributes ?? {}) as Record<string, string | number | boolean | null>,
    salePrice: row.sale_price === null ? null : asNumber(row.sale_price),
    purchasePrice: row.purchase_price === null ? null : asNumber(row.purchase_price),
    mrp: row.mrp === null ? null : asNumber(row.mrp),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductImage(row: ProductImage): ProductImageModel {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    variantId: row.variant_id,
    storagePath: row.storage_path,
    url: row.url,
    position: asNumber(row.position),
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

export function mapProduct(row: Product): ProductModel {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    brandId: row.brand_id,
    unitId: row.unit_id,
    unit: row.unit,
    attributes: (row.attributes ?? {}) as Record<string, string | number | boolean | null>,
    gstRate: asNumber(row.gst_rate),
    hsn: row.hsn,
    purchasePrice: asNumber(row.purchase_price),
    salePrice: asNumber(row.sale_price),
    mrp: row.mrp === null ? null : asNumber(row.mrp),
    lowStockThreshold: asNumber(row.low_stock_threshold),
    minStock: asNumber(row.min_stock),
    maxStock: row.max_stock === null ? null : asNumber(row.max_stock),
    reorderLevel: asNumber(row.reorder_level),
    trackInventory: row.track_inventory,
    taxable: row.taxable,
    productStatus: (row.product_status ?? "active") as ProductModel["productStatus"],
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

export function mapStockBalance(row: StockBalanceView): StockBalance {
  return {
    productId: row.product_id,
    variantId: row.variant_id,
    warehouseId: row.warehouse_id,
    locationId: row.location_id,
    quantity: asNumber(row.quantity),
    lastMovementAt: row.last_movement_at,
  };
}

export function mapStockMovement(row: StockLedger): StockMovement {
  return {
    id: row.id,
    businessId: row.business_id,
    productId: row.product_id,
    variantId: row.variant_id,
    batchId: row.batch_id,
    warehouseId: row.warehouse_id,
    locationId: row.location_id,
    toWarehouseId: row.to_warehouse_id,
    toLocationId: row.to_location_id,
    change: asNumber(row.change),
    movementType: (row.movement_type ?? "ADJUSTMENT") as StockMovement["movementType"],
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    notes: row.notes,
    createdAt: row.created_at,
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
    pan: row.pan,
    customerType: (row.customer_type ?? "regular") as CustomerModel["customerType"],
    creditLimit: row.credit_limit === null ? null : asNumber(row.credit_limit),
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
    notes: row.notes,
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
    pan: row.pan,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
    paymentTerms: row.payment_terms,
    notes: row.notes,
    openingBalance: asNumber(row.opening_balance),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPaymentMode(row: PaymentMode): PaymentModeModel {
  return {
    id: row.id,
    businessId: row.business_id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    sortOrder: asNumber(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPurchaseReceipt(row: PurchaseReceipt): PurchaseReceiptModel {
  return {
    id: row.id,
    businessId: row.business_id,
    purchaseOrderId: row.purchase_order_id,
    warehouseId: row.warehouse_id,
    locationId: row.location_id,
    receiptNo: row.receipt_no,
    receivedAt: row.received_at,
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
  };
}

export function mapPurchaseReceiptItem(
  row: PurchaseReceiptItem
): PurchaseReceiptModel["items"][number] {
  return {
    productId: row.product_id ?? "",
    variantId: row.variant_id,
    quantity: asNumber(row.quantity),
    unitCost: asNumber(row.unit_cost),
  };
}

export function mapPurchaseReturn(row: PurchaseReturn): PurchaseReturnModel {
  return {
    id: row.id,
    businessId: row.business_id,
    purchaseInvoiceId: row.purchase_invoice_id,
    supplierId: row.supplier_id,
    returnNo: row.return_no,
    returnDate: row.return_date,
    reason: row.reason,
    total: asNumber(row.total),
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
  };
}

export function mapPurchaseReturnItem(
  row: PurchaseReturnItem
): PurchaseReturnModel["items"][number] {
  return {
    productId: row.product_id ?? "",
    variantId: row.variant_id,
    quantity: asNumber(row.quantity),
    unitCost: asNumber(row.unit_cost),
  };
}

export function mapSalesReturn(row: SalesReturn): SalesReturnModel {
  return {
    id: row.id,
    businessId: row.business_id,
    salesInvoiceId: row.sales_invoice_id,
    customerId: row.customer_id,
    returnNo: row.return_no,
    returnDate: row.return_date,
    reason: row.reason,
    total: asNumber(row.total),
    notes: row.notes,
    items: [],
    createdAt: row.created_at,
  };
}

export function mapSalesReturnItem(
  row: SalesReturnItem
): SalesReturnModel["items"][number] {
  return {
    productId: row.product_id ?? "",
    variantId: row.variant_id,
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
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
    warehouseId: row.warehouse_id,
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
    email: row.email ?? "",
    fullName: row.full_name ?? "User",
    username: row.username ?? null,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: null,
    isOwner: false,
    isDemo: false,
  };
}

export function mapRole(row: Role): RoleModel {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isSystem: row.is_system,
  };
}

export function mapPermission(row: Permission): PermissionModel {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
  };
}

export function mapInvitation(row: BusinessInvitation): TeamInvitation {
  return {
    id: row.id,
    businessId: row.business_id,
    email: row.email,
    fullName: row.full_name,
    roleSlug: row.role_slug,
    invitedBy: row.invited_by ?? "",
    createdAt: row.created_at,
  };
}
