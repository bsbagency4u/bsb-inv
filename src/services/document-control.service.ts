import type { Repositories } from "@/repositories/types";
import type { DocumentControlDefaults, DocumentControlKind } from "@/types/domain";
import { AppError } from "@/lib/errors";
import {
  DOCUMENT_CONTROL_KEY,
  DOCUMENT_CONTROL_KIND_META,
  daysBetween,
  documentIsLocked,
  isoDateOnly,
  parseDocumentControlDefaults,
  prefixForKind,
  todayIsoDate,
} from "@/lib/document-control";
import { AuthorizationService } from "./authorization.service";

export type DocumentAction = "view" | "create" | "edit" | "delete" | "cancel";

export interface DocumentGuardInput {
  kind: DocumentControlKind;
  action: Exclude<DocumentAction, "view">;
  documentDate?: string | null;
  createdAt?: string | null;
  status?: string | null;
  overrideLock?: boolean;
  overrideReason?: string | null;
}

export interface DocumentGuardResult {
  settings: DocumentControlDefaults;
  documentDate: string;
  backdated: boolean;
  futureDated: boolean;
  locked: boolean;
  overrideUsed: boolean;
}

const SALES_KINDS: DocumentControlKind[] = ["sales_invoice", "sales_return"];

export function moduleForKind(kind: DocumentControlKind, direction?: "in" | "out"): "sales" | "purchase" {
  if (kind === "payment") return direction === "out" ? "purchase" : "sales";
  return SALES_KINDS.includes(kind) ? "sales" : "purchase";
}

export function permissionFor(kind: DocumentControlKind, action: DocumentAction, direction?: "in" | "out"): string {
  return `${moduleForKind(kind, direction)}.${action}`;
}

export function isDraftStatus(status?: string | null): boolean {
  return status === "draft";
}

export function isTerminalStatus(status?: string | null): boolean {
  return status === "cancelled" || status === "returned";
}

export function isPostedStatus(status?: string | null): boolean {
  return !isDraftStatus(status) && !isTerminalStatus(status);
}

export class DocumentControlService {
  private auth: AuthorizationService;

  constructor(
    private repos: Repositories,
    auth?: AuthorizationService
  ) {
    this.auth = auth ?? new AuthorizationService(repos);
  }

  async getSettings(businessId: string): Promise<DocumentControlDefaults> {
    return parseDocumentControlDefaults(
      await this.repos.businesses.getSetting(businessId, DOCUMENT_CONTROL_KEY)
    );
  }

  async allocateNumber(businessId: string, kind: DocumentControlKind): Promise<string> {
    const settings = await this.getSettings(businessId);
    const meta = DOCUMENT_CONTROL_KIND_META[kind];
    return this.repos.transactions.nextDocumentNumber(
      businessId,
      meta.sequenceKind,
      prefixForKind(settings, kind)
    );
  }

  async assertView(businessId: string, userId: string, kind: DocumentControlKind, direction?: "in" | "out"): Promise<void> {
    await this.requireActionPermission(businessId, userId, kind, "view", direction);
  }

  async assertAllowed(
    businessId: string,
    userId: string,
    input: DocumentGuardInput,
    direction?: "in" | "out"
  ): Promise<DocumentGuardResult> {
    const settings = await this.getSettings(businessId);
    await this.requireActionPermission(businessId, userId, input.kind, input.action, direction);

    if (isTerminalStatus(input.status) && input.action !== "create") {
      throw AppError.validation("This document is already cancelled or returned and cannot be changed.");
    }

    const documentDate = isoDateOnly(input.documentDate ?? input.createdAt ?? todayIsoDate());
    const today = todayIsoDate();
    const offset = daysBetween(today, documentDate);
    const backdated = offset < 0;
    const futureDated = offset > 0;

    if (backdated) {
      if (!settings.allowBackdate) {
        throw AppError.validation("Backdating documents is turned off in Document Control.");
      }
      if (Math.abs(offset) > settings.maxBackdateDays) {
        throw AppError.validation(
          `Document date cannot be more than ${settings.maxBackdateDays} day${settings.maxBackdateDays === 1 ? "" : "s"} in the past.`
        );
      }
      await this.auth.requireAnyPermission(businessId, userId, [
        `${moduleForKind(input.kind, direction)}.backdate`,
        `${moduleForKind(input.kind, direction)}.manage`,
      ]);
    }

    if (futureDated) {
      if (!settings.allowFutureDate) {
        throw AppError.validation("Future document dates are turned off in Document Control.");
      }
      if (offset > settings.maxFutureDays) {
        throw AppError.validation(
          `Document date cannot be more than ${settings.maxFutureDays} day${settings.maxFutureDays === 1 ? "" : "s"} in the future.`
        );
      }
    }

    if (input.action === "edit" && isPostedStatus(input.status) && !settings.allowEditPosted) {
      throw AppError.validation("Editing posted documents is turned off in Document Control.");
    }
    if (input.action === "delete" && isDraftStatus(input.status) && !settings.allowDeleteDraft) {
      throw AppError.validation("Deleting draft documents is turned off in Document Control.");
    }
    if (input.action === "delete" && isPostedStatus(input.status) && !settings.allowDeletePosted) {
      throw AppError.validation("Posted documents cannot be deleted. Cancel them instead.");
    }
    if (input.action === "cancel" && isDraftStatus(input.status)) {
      throw AppError.validation("Drafts cannot be cancelled. Delete the draft instead.");
    }
    if (input.action === "cancel" && isPostedStatus(input.status) && !settings.allowCancelPosted) {
      throw AppError.validation("Cancelling posted documents is turned off in Document Control.");
    }

    const locked = this.isLocked(settings, documentDate, input.status);
    let overrideUsed = false;
    if (locked && (input.action === "edit" || input.action === "delete" || input.action === "cancel")) {
      if (!settings.allowOverrideLock) {
        throw AppError.validation("This document is in a locked period and cannot be changed.");
      }
      if (!input.overrideLock) {
        throw AppError.validation("This document is in a locked period. An override reason is required.");
      }
      const reason = input.overrideReason?.trim() ?? "";
      if (reason.length < 3) {
        throw AppError.validation("Enter a reason to override the document lock.");
      }
      await this.auth.requireAnyPermission(businessId, userId, [
        `${moduleForKind(input.kind, direction)}.override_lock`,
        `${moduleForKind(input.kind, direction)}.manage`,
      ]);
      overrideUsed = true;
    }

    return { settings, documentDate, backdated, futureDated, locked, overrideUsed };
  }

  isLocked(settings: DocumentControlDefaults, documentDate: string, status?: string | null): boolean {
    return documentIsLocked(settings, documentDate, status);
  }

  private async requireActionPermission(
    businessId: string,
    userId: string,
    kind: DocumentControlKind,
    action: DocumentAction,
    direction?: "in" | "out"
  ): Promise<void> {
    const moduleName = moduleForKind(kind, direction);
    const slug = `${moduleName}.${action}`;
    const fallback = action === "view" ? `${moduleName}.view` : `${moduleName}.manage`;
    await this.auth.requireAnyPermission(businessId, userId, [slug, fallback]);
  }
}
