/**
 * Registry of modules that belong to later phases. Rendered by the catch-all
 * placeholder route so unfinished modules never pretend to work. Adding a real
 * page file for a path automatically overrides its entry here.
 */
export interface ModulePlaceholderConfig {
  title: string;
  description: string;
  phase: number;
}

export const MODULE_PLACEHOLDERS: Record<string, ModulePlaceholderConfig> = {
  "/inventory/warehouses": {
    title: "Stores & Warehouses",
    description: "Multi-warehouse and location management ships with the stock engine.",
    phase: 3,
  },
  "/inventory/transfers": {
    title: "Stock Transfers",
    description: "Transfer stock between warehouses and locations in Phase 3.",
    phase: 3,
  },
  "/inventory/barcode": {
    title: "Barcode",
    description: "Barcode generation and scanning support arrives in Phase 4.",
    phase: 4,
  },
  "/sales/returns": {
    title: "Sales Returns",
    description: "Sales returns and credit notes arrive in Phase 3.",
    phase: 3,
  },
  "/purchase/returns": {
    title: "Purchase Returns",
    description: "Purchase returns and debit notes arrive in Phase 3.",
    phase: 3,
  },
};

export const SETTINGS_PLACEHOLDERS: Record<string, ModulePlaceholderConfig> = {
  "/settings/users": {
    title: "Users & Roles",
    description: "Invite team members, assign roles and manage permissions in Phase 4.",
    phase: 4,
  },
  "/settings/tax": {
    title: "Tax",
    description: "GST and tax configuration arrives with the GST engine in Phase 4.",
    phase: 4,
  },
  "/settings/invoice": {
    title: "Invoice",
    description: "Invoice templates, numbering and GST layout in Phase 4.",
    phase: 4,
  },
  "/settings/inventory": {
    title: "Inventory",
    description: "Stock rules, low-stock thresholds and units in Phase 2/4.",
    phase: 4,
  },
  "/settings/sales": {
    title: "Sales",
    description: "Sales defaults, discount and payment rules in Phase 3.",
    phase: 3,
  },
  "/settings/purchase": {
    title: "Purchase",
    description: "Purchase defaults and vendor payment terms in Phase 3.",
    phase: 3,
  },
  "/settings/payments": {
    title: "Payments",
    description: "Payment modes and collection configuration in Phase 3.",
    phase: 3,
  },
  "/settings/counters": {
    title: "Counters",
    description: "Multiple counters for POS arrive with the multi-counter engine in Phase 5.",
    phase: 5,
  },
  "/settings/warehouses": {
    title: "Warehouses",
    description: "Warehouse and location management ships with the stock engine.",
    phase: 4,
  },
  "/settings/notifications": {
    title: "Notifications",
    description: "Low-stock, expiry, payment-due and failed-transaction alerts in Phase 4.",
    phase: 4,
  },
  "/settings/backup": {
    title: "Backup",
    description: "Backup, restore and export arrive with offline sync in Phase 5.",
    phase: 5,
  },
};
