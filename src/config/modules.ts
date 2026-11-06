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

export const MODULE_PLACEHOLDERS: Record<string, ModulePlaceholderConfig> = {};

export const SETTINGS_PLACEHOLDERS: Record<string, ModulePlaceholderConfig> = {
  "/settings/counters": {
    title: "Counters",
    description: "Multiple counters for POS arrive with the multi-counter engine in Phase 5.",
    phase: 5,
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
