/**
 * Domain models. UI components consume these — never raw Supabase rows.
 */

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  /** Role slug within the active business. */
  role: string | null;
  /** True when the user owns the active business. */
  isOwner: boolean;
  /** True when running in demo mode (no Supabase configured). */
  isDemo: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  legalName: string | null;
  type: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  currency: string;
  financialYear: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMembership {
  businessId: string;
  userId: string;
  roleSlug: string | null;
  isOwner: boolean;
}

export interface SessionState {
  /** null while the session is still loading. */
  user: SessionUser | null;
  /** Active business, may be null before onboarding completes. */
  business: BusinessProfile | null;
  /** All businesses the user belongs to (for future switcher). */
  businesses: BusinessProfile[];
  status: "loading" | "authenticated" | "unauthenticated";
  isDemo: boolean;
  error: string | null;
}

export interface AuditEvent {
  id: string;
  businessId: string | null;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SearchEntityType = "product" | "customer" | "supplier" | "invoice" | "purchase" | "stock";

export interface SearchResult {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  href?: string;
}

export interface DashboardStats {
  /** Marked as demo/placeholder data so it is never mistaken for real. */
  isDemo: boolean;
  todaySales: number;
  todayPurchase: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  outstanding: number;
  currency: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  businessId: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockLocation {
  id: string;
  businessId: string;
  warehouseId: string;
  parentId: string | null;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  businessId: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  attributes: Record<string, string | number | boolean | null>;
  salePrice: number | null;
  purchasePrice: number | null;
  mrp: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  businessId: string;
  productId: string;
  variantId: string | null;
  storagePath: string;
  url: string;
  position: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  brandId: string | null;
  unitId: string | null;
  unit: string;
  /** Dynamic attributes resolved from the business-type attribute registry. */
  attributes: Record<string, string | number | boolean | null>;
  gstRate: number;
  hsn: string | null;
  purchasePrice: number;
  salePrice: number;
  mrp: number | null;
  lowStockThreshold: number;
  minStock: number;
  maxStock: number | null;
  reorderLevel: number;
  trackInventory: boolean;
  taxable: boolean;
  productStatus: "active" | "inactive" | "draft" | "discontinued";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductStock {
  productId: string;
  quantity: number;
  lastMovementAt: string | null;
}

export interface StockBalance {
  productId: string;
  variantId: string | null;
  warehouseId: string | null;
  locationId: string | null;
  quantity: number;
  lastMovementAt: string | null;
}

export interface ProductWithStock extends Product {
  stockQuantity: number;
  stockValue: number;
}

export interface ProductBatch {
  id: string;
  businessId: string;
  productId: string;
  batchNo: string;
  expiryDate: string | null;
  mrp: number | null;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "PURCHASE_RETURN"
  | "SALE_RETURN"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "SCRAP";

export type StockMovementReason =
  | "opening"
  | "purchase"
  | "sale"
  | "adjustment"
  | "return"
  | "transfer";

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  variantId: string | null;
  batchId: string | null;
  warehouseId: string | null;
  locationId: string | null;
  toWarehouseId: string | null;
  toLocationId: string | null;
  change: number;
  movementType: StockMovementType;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  orderNo: string;
  supplierId: string | null;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  items: LineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoice {
  id: string;
  businessId: string;
  billNo: string;
  supplierId: string | null;
  purchaseOrderId: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  notes: string | null;
  items: LineItem[];
  createdAt: string;
  updatedAt: string;
}

export type SalesInvoiceStatus =
  | "draft"
  | "finalized"
  | "paid"
  | "partial"
  | "cancelled";

export interface SalesInvoice {
  id: string;
  businessId: string;
  invoiceNo: string;
  customerId: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: SalesInvoiceStatus;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  paymentMode: string | null;
  notes: string | null;
  items: LineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  businessId: string;
  direction: "in" | "out";
  partyType: "customer" | "supplier";
  partyId: string | null;
  salesInvoiceId: string | null;
  purchaseInvoiceId: string | null;
  amount: number;
  mode: string;
  reference: string | null;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  businessId: string;
  userId: string | null;
  title: string;
  description?: string;
  type: "info" | "success" | "warning" | "error";
  href?: string;
  read: boolean;
  timestamp: string;
}

/** GST tax line on an invoice, split per rate. */
export interface GstLine {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  /** Central GST share (half of tax when intra-state). */
  cgst: number;
  /** State GST share (half of tax when intra-state). */
  sgst: number;
  /** Integrated GST (full tax when inter-state). */
  igst: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
  /** Per-rate GST breakdown. */
  gstLines: GstLine[];
  /** Intra-state if true (CGST+SGST), inter-state if false (IGST). */
  intraState: boolean;
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface SalesReportRow {
  invoiceNo: string;
  invoiceDate: string;
  customerId: string | null;
  customerName: string;
  total: number;
  taxTotal: number;
  status: SalesInvoiceStatus;
}

export interface StockReportRow {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  quantity: number;
  purchasePrice: number;
  stockValue: number;
  lowStockThreshold: number;
}

export interface GstReportRow {
  invoiceNo: string;
  invoiceDate: string;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}
