import type { DocumentControlDefaults, DocumentControlKind, DocumentNumberingRule } from "@/types/domain";

export const DOCUMENT_CONTROL_KINDS: DocumentControlKind[] = [
  "sales_invoice",
  "purchase_invoice",
  "sales_return",
  "purchase_return",
  "payment",
];

export const DOCUMENT_CONTROL_KIND_META: Record<
  DocumentControlKind,
  { label: string; sequenceKind: string; defaultPrefix: string }
> = {
  sales_invoice: { label: "Sales invoice", sequenceKind: "sales", defaultPrefix: "INV" },
  purchase_invoice: { label: "Purchase bill", sequenceKind: "purchase_invoice", defaultPrefix: "BILL" },
  sales_return: { label: "Sales return", sequenceKind: "sales_return", defaultPrefix: "SRT" },
  purchase_return: { label: "Purchase return", sequenceKind: "purchase_return", defaultPrefix: "PRT" },
  payment: { label: "Payment", sequenceKind: "payment", defaultPrefix: "PAY" },
};

export const DEFAULT_DOCUMENT_CONTROL: DocumentControlDefaults = {
  allowBackdate: true,
  maxBackdateDays: 30,
  allowFutureDate: false,
  maxFutureDays: 0,
  lockEnabled: true,
  lockAfterDays: 7,
  allowOverrideLock: true,
  allowEditPosted: true,
  allowDeleteDraft: true,
  allowDeletePosted: false,
  allowCancelPosted: true,
  numbering: {
    sales_invoice: { prefix: "INV" },
    purchase_invoice: { prefix: "BILL" },
    sales_return: { prefix: "SRT" },
    purchase_return: { prefix: "PRT" },
    payment: { prefix: "PAY" },
  },
};

export const DOCUMENT_CONTROL_KEY = "document.control";

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asPrefix(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const next = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return next.slice(0, 12) || fallback;
}

function mergeNumbering(value: unknown): Record<DocumentControlKind, DocumentNumberingRule> {
  const source =
    value && typeof value === "object" ? (value as Record<string, { prefix?: unknown }>) : {};
  const next = {} as Record<DocumentControlKind, DocumentNumberingRule>;
  for (const kind of DOCUMENT_CONTROL_KINDS) {
    next[kind] = {
      prefix: asPrefix(source[kind]?.prefix, DEFAULT_DOCUMENT_CONTROL.numbering[kind].prefix),
    };
  }
  return next;
}

export function parseDocumentControlDefaults(stored: unknown): DocumentControlDefaults {
  if (!stored || typeof stored !== "object") {
    return {
      ...DEFAULT_DOCUMENT_CONTROL,
      numbering: { ...DEFAULT_DOCUMENT_CONTROL.numbering },
    };
  }
  const value = stored as Partial<DocumentControlDefaults>;
  return {
    allowBackdate: asBoolean(value.allowBackdate, DEFAULT_DOCUMENT_CONTROL.allowBackdate),
    maxBackdateDays: asNumber(value.maxBackdateDays, DEFAULT_DOCUMENT_CONTROL.maxBackdateDays, 0, 3650),
    allowFutureDate: asBoolean(value.allowFutureDate, DEFAULT_DOCUMENT_CONTROL.allowFutureDate),
    maxFutureDays: asNumber(value.maxFutureDays, DEFAULT_DOCUMENT_CONTROL.maxFutureDays, 0, 365),
    lockEnabled: asBoolean(value.lockEnabled, DEFAULT_DOCUMENT_CONTROL.lockEnabled),
    lockAfterDays: asNumber(value.lockAfterDays, DEFAULT_DOCUMENT_CONTROL.lockAfterDays, 0, 3650),
    allowOverrideLock: asBoolean(value.allowOverrideLock, DEFAULT_DOCUMENT_CONTROL.allowOverrideLock),
    allowEditPosted: asBoolean(value.allowEditPosted, DEFAULT_DOCUMENT_CONTROL.allowEditPosted),
    allowDeleteDraft: asBoolean(value.allowDeleteDraft, DEFAULT_DOCUMENT_CONTROL.allowDeleteDraft),
    allowDeletePosted: asBoolean(value.allowDeletePosted, DEFAULT_DOCUMENT_CONTROL.allowDeletePosted),
    allowCancelPosted: asBoolean(value.allowCancelPosted, DEFAULT_DOCUMENT_CONTROL.allowCancelPosted),
    numbering: mergeNumbering(value.numbering),
  };
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isoDateOnly(value: string | Date | null | undefined, fallback = todayIsoDate()): string {
  if (!value) return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return value.toISOString().slice(0, 10);
  }
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? fallback;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  const to = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function prefixForKind(
  settings: DocumentControlDefaults,
  kind: DocumentControlKind
): string {
  return settings.numbering[kind]?.prefix || DOCUMENT_CONTROL_KIND_META[kind].defaultPrefix;
}

export function documentIsLocked(
  settings: DocumentControlDefaults,
  documentDate: string,
  status?: string | null,
  now = new Date()
): boolean {
  if (!settings.lockEnabled) return false;
  if (status === "draft" || status === "cancelled" || status === "returned") return false;
  const age = daysBetween(isoDateOnly(documentDate), todayIsoDate(now));
  if (settings.lockAfterDays <= 0) return true;
  return age >= settings.lockAfterDays;
}
