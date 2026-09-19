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
  "/inventory/barcode": {
    title: "Barcode",
    description: "Barcode generation and scanning support arrives in Phase 4.",
    phase: 4,
  },
};

export const SETTINGS_PLACEHOLDERS: Record<string, ModulePlaceholderConfig> = {
  "/settings/inventory": {
    title: "Inventory",
    description: "Stock rules, low-stock thresholds and units in Phase 2/4.",
    phase: 4,
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
