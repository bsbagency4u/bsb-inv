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
  phone: string | null;
  avatar_url: string | null;
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
  created_at: string;
  updated_at: string;
}

export type Product = {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  attributes: Record<string, unknown>;
  gst_rate: number;
  hsn: string | null;
  purchase_price: number;
  sale_price: number;
  mrp: number | null;
  low_stock_threshold: number;
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
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
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
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  opening_balance: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StockLedger = {
  id: string;
  business_id: string;
  product_id: string;
  batch_id: string | null;
  change: number;
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

export type PurchaseOrder = {
  id: string;
  business_id: string;
  order_no: string;
  supplier_id: string | null;
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
    };
    Views: {
      product_stock: {
        Row: ProductStockView;
        Relationships: [];
      };
    };
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
