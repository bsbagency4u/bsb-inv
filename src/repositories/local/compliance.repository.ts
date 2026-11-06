import type {
  GstComplianceAttempt,
  GstEinvoiceRecord,
  GstEwayBillRecord,
  GstIrpCredentialPublic,
  GstIrpDocumentKind,
  GstIrpEnvironment,
} from "@/types/domain";
import type {
  ComplianceRepository,
  GstEinvoiceWrite,
  GstEwayBillWrite,
  GstIrpCredentialSecret,
} from "../compliance.repository";
import { maskUsername } from "@/lib/gst-mask";
import { readStorage, writeStorage } from "./local-data";

const CRED_KEY = "demo-gst-irp-credentials";
const IRN_KEY = "demo-gst-einvoices";
const EWB_KEY = "demo-gst-eway-bills";
const ATTEMPT_KEY = "demo-gst-compliance-attempts";

interface LocalCredential {
  businessId: string;
  provider: string;
  environment: GstIrpEnvironment;
  gstin: string;
  username: string;
  ciphertext: string;
  iv: string;
  lastValidatedAt: string | null;
  lastError: string | null;
}

export class LocalComplianceRepository implements ComplianceRepository {
  async getCredentialPublic(businessId: string): Promise<GstIrpCredentialPublic> {
    const row = this.credentials().find((item) => item.businessId === businessId);
    if (!row) {
      return {
        configured: false,
        provider: "nic",
        environment: "sandbox",
        gstin: null,
        usernameMasked: null,
        lastValidatedAt: null,
        lastError: null,
      };
    }
    return {
      configured: Boolean(row.ciphertext),
      provider: row.provider,
      environment: row.environment,
      gstin: row.gstin,
      usernameMasked: maskUsername(row.username),
      lastValidatedAt: row.lastValidatedAt,
      lastError: row.lastError,
    };
  }

  async getCredentialSecret(
    businessId: string
  ): Promise<(GstIrpCredentialSecret & { ciphertext: string; iv: string }) | null> {
    const row = this.credentials().find((item) => item.businessId === businessId);
    if (!row?.ciphertext || !row.iv) return null;
    return {
      username: row.username,
      password: "",
      gstin: row.gstin,
      provider: row.provider,
      environment: row.environment,
      ciphertext: row.ciphertext,
      iv: row.iv,
    };
  }

  async upsertCredentials(
    businessId: string,
    input: {
      provider: string;
      environment: GstIrpEnvironment;
      gstin: string;
      username: string;
      ciphertext: string;
      iv: string;
      lastValidatedAt?: string | null;
      lastError?: string | null;
    }
  ): Promise<GstIrpCredentialPublic> {
    const rows = this.credentials().filter((item) => item.businessId !== businessId);
    rows.push({
      businessId,
      provider: input.provider,
      environment: input.environment,
      gstin: input.gstin,
      username: input.username,
      ciphertext: input.ciphertext,
      iv: input.iv,
      lastValidatedAt: input.lastValidatedAt ?? null,
      lastError: input.lastError ?? null,
    });
    writeStorage(CRED_KEY, rows);
    return this.getCredentialPublic(businessId);
  }

  async listEinvoices(businessId: string): Promise<GstEinvoiceRecord[]> {
    return this.einvoices()
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.documentDate.localeCompare(a.documentDate));
  }

  async getEinvoice(
    businessId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEinvoiceRecord | null> {
    return (
      this.einvoices().find(
        (item) =>
          item.businessId === businessId &&
          item.documentKind === documentKind &&
          item.documentId === documentId
      ) ?? null
    );
  }

  async upsertEinvoice(businessId: string, input: GstEinvoiceWrite): Promise<GstEinvoiceRecord> {
    const rows = this.einvoices();
    const existing = rows.findIndex(
      (item) =>
        item.businessId === businessId &&
        item.documentKind === input.documentKind &&
        item.documentId === input.documentId
    );
    const now = new Date().toISOString();
    const next: GstEinvoiceRecord = {
      id: existing >= 0 ? rows[existing].id : `einvoice-${crypto.randomUUID()}`,
      businessId,
      documentKind: input.documentKind,
      documentId: input.documentId,
      documentNo: input.documentNo,
      documentDate: input.documentDate,
      status: input.status,
      irn: input.irn ?? null,
      ackNo: input.ackNo ?? null,
      ackDate: input.ackDate ?? null,
      signedQrCode: input.signedQrCode ?? null,
      cancelReason: input.cancelReason ?? null,
      cancelledAt: input.cancelledAt ?? null,
      lastError: input.lastError ?? null,
      requestHash: input.requestHash ?? null,
      createdAt: existing >= 0 ? rows[existing].createdAt : now,
      updatedAt: now,
    };
    if (existing >= 0) rows[existing] = next;
    else rows.unshift(next);
    writeStorage(IRN_KEY, rows);
    return next;
  }

  async listEwayBills(businessId: string): Promise<GstEwayBillRecord[]> {
    return this.ewayBills()
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.documentDate.localeCompare(a.documentDate));
  }

  async getEwayBill(
    businessId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEwayBillRecord | null> {
    return (
      this.ewayBills().find(
        (item) =>
          item.businessId === businessId &&
          item.documentKind === documentKind &&
          item.documentId === documentId
      ) ?? null
    );
  }

  async upsertEwayBill(businessId: string, input: GstEwayBillWrite): Promise<GstEwayBillRecord> {
    const rows = this.ewayBills();
    const existing = rows.findIndex(
      (item) =>
        item.businessId === businessId &&
        item.documentKind === input.documentKind &&
        item.documentId === input.documentId
    );
    const now = new Date().toISOString();
    const next: GstEwayBillRecord = {
      id: existing >= 0 ? rows[existing].id : `ewb-${crypto.randomUUID()}`,
      businessId,
      documentKind: input.documentKind,
      documentId: input.documentId,
      documentNo: input.documentNo,
      documentDate: input.documentDate,
      status: input.status,
      ewbNo: input.ewbNo ?? null,
      ewbDate: input.ewbDate ?? null,
      validUpto: input.validUpto ?? null,
      transMode: input.transMode ?? null,
      transDocNo: input.transDocNo ?? null,
      transDocDate: input.transDocDate ?? null,
      vehicleNo: input.vehicleNo ?? null,
      transDistance: input.transDistance ?? null,
      fromPlace: input.fromPlace ?? null,
      toPlace: input.toPlace ?? null,
      cancelReason: input.cancelReason ?? null,
      cancelledAt: input.cancelledAt ?? null,
      lastError: input.lastError ?? null,
      requestHash: input.requestHash ?? null,
      createdAt: existing >= 0 ? rows[existing].createdAt : now,
      updatedAt: now,
    };
    if (existing >= 0) rows[existing] = next;
    else rows.unshift(next);
    writeStorage(EWB_KEY, rows);
    return next;
  }

  async listAttempts(businessId: string, limit = 50): Promise<GstComplianceAttempt[]> {
    return this.attempts()
      .filter((item) => item.businessId === businessId)
      .slice(0, limit);
  }

  async addAttempt(
    businessId: string,
    input: {
      kind: "einvoice" | "ewaybill";
      documentKind: GstIrpDocumentKind;
      documentId: string;
      action: string;
      status: "queued" | "success" | "failed";
      error?: string | null;
      requestHash?: string | null;
      response?: Record<string, unknown>;
    }
  ): Promise<GstComplianceAttempt> {
    const event: GstComplianceAttempt = {
      id: `gst-attempt-${crypto.randomUUID()}`,
      businessId,
      kind: input.kind,
      documentKind: input.documentKind,
      documentId: input.documentId,
      action: input.action,
      status: input.status,
      error: input.error ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = this.attempts();
    rows.unshift(event);
    writeStorage(ATTEMPT_KEY, rows.slice(0, 200));
    return event;
  }

  private credentials(): LocalCredential[] {
    return readStorage<LocalCredential[]>(CRED_KEY, []);
  }

  private einvoices(): GstEinvoiceRecord[] {
    return readStorage<GstEinvoiceRecord[]>(IRN_KEY, []);
  }

  private ewayBills(): GstEwayBillRecord[] {
    return readStorage<GstEwayBillRecord[]>(EWB_KEY, []);
  }

  private attempts(): GstComplianceAttempt[] {
    return readStorage<GstComplianceAttempt[]>(ATTEMPT_KEY, []);
  }
}
