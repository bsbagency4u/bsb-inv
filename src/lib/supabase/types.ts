/**
 * Supabase database type definitions, matching `supabase/migrations/`.
 * Keep in sync with the migrations when the schema changes.
 */

export type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export type Permission = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type RolePermission = {
  role_id: string;
  permission_id: string;
}

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessInvitation = {
  id: string;
  business_id: string;
  email: string;
  full_name: string;
  role_slug: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type Business = {
  id: string;
  name: string;
  legal_name: string | null;
  type: string;
  logo_url: string | null;
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
  financial_year: string;
  invoice_prefix: string;
  invoice_start_number: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessMember = {
  business_id: string;
  user_id: string;
  role_id: string | null;
  is_owner: boolean;
  created_at: string;
}

export type BusinessSetting = {
  business_id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLog = {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type Category = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Unit = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Brand = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Warehouse = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockLocation = {
  id: string;
  business_id: string;
  warehouse_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductVariant = {
  id: string;
  business_id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  attributes: Record<string, unknown>;
  sale_price: number | null;
  purchase_price: number | null;
  mrp: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductImage = {
  id: string;
  business_id: string;
  product_id: string;
  variant_id: string | null;
  storage_path: string;
  url: string;
  position: number;
  is_primary: boolean;
  created_at: string;
}

export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  unit: string;
  pack_unit?: string | null;
  pack_unit_id?: string | null;
  units_per_pack?: number;
  min_sale_qty?: number;
  max_sale_qty?: number | null;
  allow_base_sale?: boolean;
  allow_pack_sale?: boolean;
  allow_pack_purchase?: boolean;
  fixed_packing?: boolean;
  attributes: Record<string, unknown>;
  gst_rate: number;
  hsn: string | null;
  purchase_price: number;
  sale_price: number;
  mrp: number | null;
  low_stock_threshold: number;
  min_stock: number;
  max_stock: number | null;
  reorder_level: number;
  track_inventory: boolean;
  taxable: boolean;
  product_status: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductBatch = {
  id: string;
  business_id: string;
  product_id: string;
  batch_no: string;
  expiry_date: string | null;
  mrp: number | null;
  purchase_price: number | null;
  created_at: string;
  updated_at: string;
}

export type Customer = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  customer_type: string;
  credit_limit: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  notes: string | null;
  opening_balance: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type Supplier = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  payment_terms: string | null;
  notes: string | null;
  opening_balance: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMode = {
  id: string;
  business_id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type DocumentSequence = {
  business_id: string;
  kind: string;
  prefix: string;
  last_number: number;
}

export type PurchaseReceipt = {
  id: string;
  business_id: string;
  purchase_order_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  receipt_no: string;
  received_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type PurchaseReceiptItem = {
  id: string;
  receipt_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
}

export type PurchaseReturn = {
  id: string;
  business_id: string;
  purchase_invoice_id: string | null;
  supplier_id: string | null;
  return_no: string;
  return_date: string;
  reason: string | null;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type PurchaseReturnItem = {
  id: string;
  return_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
}

export type SalesReturn = {
  id: string;
  business_id: string;
  sales_invoice_id: string | null;
  customer_id: string | null;
  return_no: string;
  return_date: string;
  reason: string | null;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type SalesReturnItem = {
  id: string;
  return_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
}

export type StockLedger = {
  id: string;
  business_id: string;
  product_id: string;
  variant_id: string | null;
  batch_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  to_warehouse_id: string | null;
  to_location_id: string | null;
  change: number;
  movement_type: string;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ProductStockView = {
  business_id: string;
  product_id: string;
  quantity: number;
  last_movement_at: string | null;
}

export type StockBalanceView = {
  business_id: string;
  product_id: string;
  variant_id: string | null;
  batch_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  quantity: number;
  last_movement_at: string | null;
}

export type PurchaseOrder = {
  id: string;
  business_id: string;
  order_no: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  order_date: string;
  expected_date: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  amount: number;
  received_quantity: number;
}

export type PurchaseInvoice = {
  id: string;
  business_id: string;
  bill_no: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseInvoiceItem = {
  id: string;
  purchase_invoice_id: string;
  product_id: string | null;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  amount: number;
  sale_unit: string | null;
  base_quantity: number | null;
}

export type SalesInvoice = {
  id: string;
  business_id: string;
  invoice_no: string;
  customer_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  payment_mode: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SalesInvoiceItem = {
  id: string;
  sales_invoice_id: string;
  product_id: string | null;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  discount: number;
  taxable_amount: number;
  tax_amount: number;
  amount: number;
  sale_unit: string | null;
  base_quantity: number | null;
}

export type Payment = {
  id: string;
  business_id: string;
  direction: string;
  party_type: string;
  party_id: string | null;
  sales_invoice_id: string | null;
  purchase_invoice_id: string | null;
  amount: number;
  mode: string;
  reference: string | null;
  payment_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type Notification = {
  id: string;
  business_id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  type: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: Role;
        Insert: Partial<Role> & { name: string; slug: string };
        Update: Partial<Role>;
        Relationships: [];
      };
      permissions: {
        Row: Permission;
        Insert: Partial<Permission> & { slug: string; name: string };
        Update: Partial<Permission>;
        Relationships: [];
      };
      role_permissions: {
        Row: RolePermission;
        Insert: RolePermission;
        Update: Partial<RolePermission>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      businesses: {
        Row: Business;
        Insert: Partial<Business> & { name: string };
        Update: Partial<Business>;
        Relationships: [];
      };
      business_members: {
        Row: BusinessMember;
        Insert: Partial<BusinessMember> & { business_id: string; user_id: string };
        Update: Partial<BusinessMember>;
        Relationships: [];
      };
      business_settings: {
        Row: BusinessSetting;
        Insert: Partial<BusinessSetting> & { business_id: string; key: string };
        Update: Partial<BusinessSetting>;
        Relationships: [];
      };
      business_invitations: {
        Row: BusinessInvitation;
        Insert: Partial<BusinessInvitation> & { business_id: string; email: string; role_slug: string };
        Update: Partial<BusinessInvitation>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & { business_id: string; name: string };
        Update: Partial<Category>;
        Relationships: [];
      };
      units: {
        Row: Unit;
        Insert: Partial<Unit> & { business_id: string; name: string; code: string };
        Update: Partial<Unit>;
        Relationships: [];
      };
      brands: {
        Row: Brand;
        Insert: Partial<Brand> & { business_id: string; name: string };
        Update: Partial<Brand>;
        Relationships: [];
      };
      warehouses: {
        Row: Warehouse;
        Insert: Partial<Warehouse> & { business_id: string; name: string; code: string };
        Update: Partial<Warehouse>;
        Relationships: [];
      };
      stock_locations: {
        Row: StockLocation;
        Insert: Partial<StockLocation> & { business_id: string; warehouse_id: string; name: string; code: string };
        Update: Partial<StockLocation>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Partial<ProductVariant> & { business_id: string; product_id: string };
        Update: Partial<ProductVariant>;
        Relationships: [];
      };
      product_images: {
        Row: ProductImage;
        Insert: Partial<ProductImage> & { business_id: string; product_id: string; storage_path: string; url: string };
        Update: Partial<ProductImage>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Partial<Product> & { business_id: string; name: string };
        Update: Partial<Product>;
        Relationships: [];
      };
      product_batches: {
        Row: ProductBatch;
        Insert: Partial<ProductBatch> & { business_id: string; product_id: string; batch_no: string };
        Update: Partial<ProductBatch>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Partial<Customer> & { business_id: string; name: string };
        Update: Partial<Customer>;
        Relationships: [];
      };
      suppliers: {
        Row: Supplier;
        Insert: Partial<Supplier> & { business_id: string; name: string };
        Update: Partial<Supplier>;
        Relationships: [];
      };
      stock_ledger: {
        Row: StockLedger;
        Insert: Partial<StockLedger> & { business_id: string; product_id: string; change: number };
        Update: Partial<StockLedger>;
        Relationships: [];
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Partial<PurchaseOrder> & { business_id: string; order_no: string };
        Update: Partial<PurchaseOrder>;
        Relationships: [];
      };
      purchase_order_items: {
        Row: PurchaseOrderItem;
        Insert: Partial<PurchaseOrderItem> & { purchase_order_id: string; product_id: string };
        Update: Partial<PurchaseOrderItem>;
        Relationships: [];
      };
      purchase_invoices: {
        Row: PurchaseInvoice;
        Insert: Partial<PurchaseInvoice> & { business_id: string; bill_no: string };
        Update: Partial<PurchaseInvoice>;
        Relationships: [];
      };
      purchase_invoice_items: {
        Row: PurchaseInvoiceItem;
        Insert: Partial<PurchaseInvoiceItem> & { purchase_invoice_id: string; product_id: string };
        Update: Partial<PurchaseInvoiceItem>;
        Relationships: [];
      };
      sales_invoices: {
        Row: SalesInvoice;
        Insert: Partial<SalesInvoice> & { business_id: string; invoice_no: string };
        Update: Partial<SalesInvoice>;
        Relationships: [];
      };
      sales_invoice_items: {
        Row: SalesInvoiceItem;
        Insert: Partial<SalesInvoiceItem> & { sales_invoice_id: string; product_id: string };
        Update: Partial<SalesInvoiceItem>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & { business_id: string; direction: string };
        Update: Partial<Payment>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & { business_id: string; title: string };
        Update: Partial<Notification>;
        Relationships: [];
      };
      payment_modes: {
        Row: PaymentMode;
        Insert: Partial<PaymentMode> & { business_id: string; code: string; name: string };
        Update: Partial<PaymentMode>;
        Relationships: [];
      };
      document_sequences: {
        Row: DocumentSequence;
        Insert: DocumentSequence;
        Update: Partial<DocumentSequence>;
        Relationships: [];
      };
      purchase_receipts: {
        Row: PurchaseReceipt;
        Insert: Partial<PurchaseReceipt> & { business_id: string; receipt_no: string };
        Update: Partial<PurchaseReceipt>;
        Relationships: [];
      };
      purchase_receipt_items: {
        Row: PurchaseReceiptItem;
        Insert: Partial<PurchaseReceiptItem> & { receipt_id: string };
        Update: Partial<PurchaseReceiptItem>;
        Relationships: [];
      };
      purchase_returns: {
        Row: PurchaseReturn;
        Insert: Partial<PurchaseReturn> & { business_id: string; return_no: string };
        Update: Partial<PurchaseReturn>;
        Relationships: [];
      };
      purchase_return_items: {
        Row: PurchaseReturnItem;
        Insert: Partial<PurchaseReturnItem> & { return_id: string };
        Update: Partial<PurchaseReturnItem>;
        Relationships: [];
      };
      sales_returns: {
        Row: SalesReturn;
        Insert: Partial<SalesReturn> & { business_id: string; return_no: string };
        Update: Partial<SalesReturn>;
        Relationships: [];
      };
      sales_return_items: {
        Row: SalesReturnItem;
        Insert: Partial<SalesReturnItem> & { return_id: string };
        Update: Partial<SalesReturnItem>;
        Relationships: [];
      };
    };
    Views: {
      product_stock: {
        Row: ProductStockView;
        Relationships: [];
      };
      stock_balances: {
        Row: StockBalanceView;
        Relationships: [];
      };
    };
    Functions: {
      next_document_number: {
        Args: { p_business: string; p_kind: string; p_prefix: string };
        Returns: string;
      };
      is_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
