import "server-only";
import type { Repositories } from "@/repositories/types";
import type {
  GstEinvoiceRecord,
  GstEwayBillRecord,
  GstIrpCredentialPublic,
  GstIrpDocumentKind,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import { AppError } from "@/lib/errors";
import { validateGstin } from "@/lib/validation/schemas";
import {
  evaluateEinvoiceEligibility,
  evaluateEwayBillEligibility,
  supplyIncludesGoods,
} from "@/lib/gst-einvoice";
import {
  buildEwayBillPayload,
  buildIrpCreditNotePayload,
  buildIrpInvoicePayload,
  payloadHash,
  type EwayBillTransport,
} from "@/lib/gst-irp-payload";
import { GstIrpClient } from "@/lib/gst-irp-client";
import { decryptSecret, encryptSecret } from "@/lib/gst-secret";
import { GstComplianceService } from "./compliance.service";
import type { AuditService } from "./audit.service";
import { AuthorizationService } from "./authorization.service";

const CREDENTIALS_MISSING =
  "IRP/GSP credentials are not configured. Save authorised GSTN credentials before generating an IRN or e-way bill.";

export class GstIrpServerService extends GstComplianceService {
  private irp = new GstIrpClient();

  constructor(repos: Repositories, audits: AuditService, auth?: AuthorizationService) {
    super(repos, audits, auth);
  }

  async storeCredentials(
    businessId: string,
    userId: string,
    input: {
      provider: string;
      environment: "sandbox" | "production";
      gstin: string;
      username: string;
      password: string;
    }
  ): Promise<GstIrpCredentialPublic> {
    await this.auth.requirePermission(businessId, userId, "settings.manage");
    const gstin = input.gstin.trim().toUpperCase();
    const username = input.username.trim();
    const password = input.password.trim();
    const provider = (input.provider.trim() || "nic").toLowerCase();
    if (!validateGstin(gstin) || !gstin) {
      throw AppError.validation("Enter a valid GSTIN for the IRP login.");
    }
    if (!username) throw AppError.validation("Enter the IRP/GSP username.");
    if (!password) throw AppError.validation("Enter the IRP/GSP password.");
    if (input.environment !== "sandbox" && input.environment !== "production") {
      throw AppError.validation("Choose sandbox or production.");
    }
    const encrypted = encryptSecret(password);
    const record = await this.compliance().upsertCredentials(businessId, {
      provider,
      environment: input.environment,
      gstin,
      username,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      lastValidatedAt: null,
      lastError: null,
    });
    await this.audits.log({
      businessId,
      userId,
      action: "gst.irp.credentials.saved",
      entityType: "gst_irp_credentials",
      entityId: businessId,
      metadata: { provider, environment: input.environment, gstin },
    });
    return record;
  }

  async submitEinvoice(
    businessId: string,
    userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string
  ): Promise<GstEinvoiceRecord> {
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const store = this.compliance();
    const existing = await store.getEinvoice(businessId, documentKind, documentId);
    if (existing?.status === "generated" && existing.irn) return existing;

    const ctx = await this.loadDocumentContext(businessId, documentKind, documentId);
    const eligibility = evaluateEinvoiceEligibility({
      registrationType: ctx.business.gstRegistrationType,
      supplierGstin: ctx.business.gstin,
      recipientGstin: ctx.partyGstin,
      recipientRegistrationType: ctx.customer?.gstRegistrationType,
      documentType: ctx.documentType,
      documentDate: ctx.documentDate,
      documentStatus: ctx.documentStatus,
      aggregateTurnover: ctx.einvoiceSettings.aggregateTurnover,
      optedIn: ctx.einvoiceSettings.optedIn,
      turnoverThreshold: ctx.einvoiceSettings.turnoverThreshold,
      mandatoryFrom: ctx.einvoiceSettings.mandatoryFrom,
    });
    if (!eligibility.eligible) {
      throw AppError.validation(eligibility.blockers[0] ?? "This document cannot be reported to the IRP.");
    }

    const payload =
      documentKind === "sales_return"
        ? buildIrpCreditNotePayload({
            business: ctx.business,
            creditNote: ctx.creditNote as SalesReturn,
            original: ctx.invoice,
            customer: ctx.customer,
            partyName: ctx.partyName,
            partyGstin: ctx.partyGstin,
          })
        : buildIrpInvoicePayload({
            business: ctx.business,
            invoice: ctx.invoice as SalesInvoice,
            customer: ctx.customer,
            documentType: ctx.documentType,
            partyName: ctx.partyName,
            partyGstin: ctx.partyGstin,
          });
    const hash = payloadHash(payload);
    if (existing?.status === "generated" && existing.requestHash === hash && existing.irn) {
      return existing;
    }

    const credentials = await this.requireCredentials(businessId);
    try {
      const result = await this.irp.generateIrn(credentials, payload as unknown as Record<string, unknown>);
      const record = await store.upsertEinvoice(businessId, {
        documentKind,
        documentId,
        documentNo: ctx.documentNo,
        documentDate: ctx.documentDate,
        status: "generated",
        irn: result.irn,
        ackNo: result.ackNo,
        ackDate: result.ackDate,
        signedQrCode: result.signedQrCode,
        lastError: null,
        requestHash: hash,
        payload: payload as unknown as Record<string, unknown>,
        response: result.raw,
      });
      await store.addAttempt(businessId, {
        kind: "einvoice",
        documentKind,
        documentId,
        action: "generate",
        status: "success",
        requestHash: hash,
        response: { irn: result.irn, ackNo: result.ackNo },
      });
      await this.audits.log({
        businessId,
        userId,
        action: "gst.einvoice.generated",
        entityType: documentKind,
        entityId: documentId,
        metadata: { irn: result.irn, ackNo: result.ackNo, documentNo: ctx.documentNo },
      });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "IRP request failed.";
      await store.upsertEinvoice(businessId, {
        documentKind,
        documentId,
        documentNo: ctx.documentNo,
        documentDate: ctx.documentDate,
        status: "failed",
        lastError: message,
        requestHash: hash,
        payload: payload as unknown as Record<string, unknown>,
      });
      await store.addAttempt(businessId, {
        kind: "einvoice",
        documentKind,
        documentId,
        action: "generate",
        status: "failed",
        error: message,
        requestHash: hash,
      });
      throw error instanceof AppError ? error : AppError.unprocessable(message);
    }
  }

  async cancelEinvoice(
    businessId: string,
    userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    reason: string,
    remark?: string
  ): Promise<GstEinvoiceRecord> {
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const store = this.compliance();
    const existing = await store.getEinvoice(businessId, documentKind, documentId);
    if (!existing?.irn || existing.status !== "generated") {
      throw AppError.validation("There is no generated IRN to cancel.");
    }
    const trimmed = reason.trim();
    if (trimmed.length < 1) throw AppError.validation("Enter the IRP cancellation reason code.");
    const credentials = await this.requireCredentials(businessId);
    try {
      const result = await this.irp.cancelIrn(credentials, { irn: existing.irn, reason: trimmed, remark });
      const record = await store.upsertEinvoice(businessId, {
        documentKind,
        documentId,
        documentNo: existing.documentNo,
        documentDate: existing.documentDate,
        status: "cancelled",
        irn: existing.irn,
        ackNo: existing.ackNo,
        ackDate: existing.ackDate,
        signedQrCode: existing.signedQrCode,
        cancelReason: trimmed,
        cancelledAt: result.cancelledAt,
        lastError: null,
        requestHash: existing.requestHash,
        response: result.raw,
      });
      await store.addAttempt(businessId, {
        kind: "einvoice",
        documentKind,
        documentId,
        action: "cancel",
        status: "success",
        response: { irn: result.irn },
      });
      await this.audits.log({
        businessId,
        userId,
        action: "gst.einvoice.cancelled",
        entityType: documentKind,
        entityId: documentId,
        metadata: { irn: existing.irn, reason: trimmed },
      });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "IRP cancellation failed.";
      await store.addAttempt(businessId, {
        kind: "einvoice",
        documentKind,
        documentId,
        action: "cancel",
        status: "failed",
        error: message,
      });
      throw error instanceof AppError ? error : AppError.unprocessable(message);
    }
  }

  async submitEwayBill(
    businessId: string,
    userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    transport: EwayBillTransport
  ): Promise<GstEwayBillRecord> {
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const store = this.compliance();
    const existing = await store.getEwayBill(businessId, documentKind, documentId);
    if (existing?.status === "generated" && existing.ewbNo) return existing;
    if (documentKind !== "sales_invoice") {
      throw AppError.validation("E-way bills are generated from posted sales invoices.");
    }

    const ctx = await this.loadDocumentContext(businessId, documentKind, documentId);
    const eligibility = evaluateEwayBillEligibility({
      registrationType: ctx.business.gstRegistrationType,
      supplierGstin: ctx.business.gstin,
      documentStatus: ctx.documentStatus,
      documentDate: ctx.documentDate,
      invoiceValue: ctx.total,
      intraState: ctx.intraState,
      supplyIsGoods: supplyIncludesGoods(ctx.hsnCodes),
      optedIn: ctx.ewaySettings.optedIn,
      valueThreshold: ctx.ewaySettings.valueThreshold,
      intraStateThreshold: ctx.ewaySettings.intraStateThreshold,
    });
    if (!eligibility.eligible) {
      throw AppError.validation(eligibility.blockers[0] ?? "This document cannot generate an e-way bill.");
    }
    if (!eligibility.required) {
      throw AppError.validation(eligibility.reasons[0] ?? "An e-way bill is not required for this consignment.");
    }
    if (!transport.transMode?.trim()) throw AppError.validation("Enter the transport mode.");
    if (!(transport.transDistance > 0)) throw AppError.validation("Enter the distance in kilometres.");

    const payload = buildEwayBillPayload({
      business: ctx.business,
      invoice: ctx.invoice as SalesInvoice,
      customer: ctx.customer,
      partyName: ctx.partyName,
      partyGstin: ctx.partyGstin,
      transport,
    });
    const hash = payloadHash(payload);
    const credentials = await this.requireCredentials(businessId);
    try {
      const result = await this.irp.generateEwayBill(credentials, payload as unknown as Record<string, unknown>);
      const record = await store.upsertEwayBill(businessId, {
        documentKind,
        documentId,
        documentNo: ctx.documentNo,
        documentDate: ctx.documentDate,
        status: "generated",
        ewbNo: result.ewbNo,
        ewbDate: result.ewbDate,
        validUpto: result.validUpto,
        transMode: transport.transMode,
        transDocNo: transport.transDocNo ?? null,
        transDocDate: transport.transDocDate ?? null,
        vehicleNo: transport.vehicleNo ?? null,
        transDistance: transport.transDistance,
        fromPlace: transport.fromPlace ?? null,
        toPlace: transport.toPlace ?? null,
        lastError: null,
        requestHash: hash,
        payload: payload as unknown as Record<string, unknown>,
        response: result.raw,
      });
      await store.addAttempt(businessId, {
        kind: "ewaybill",
        documentKind,
        documentId,
        action: "generate",
        status: "success",
        requestHash: hash,
        response: { ewbNo: result.ewbNo },
      });
      await this.audits.log({
        businessId,
        userId,
        action: "gst.ewaybill.generated",
        entityType: documentKind,
        entityId: documentId,
        metadata: { ewbNo: result.ewbNo, documentNo: ctx.documentNo },
      });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "E-way bill request failed.";
      await store.upsertEwayBill(businessId, {
        documentKind,
        documentId,
        documentNo: ctx.documentNo,
        documentDate: ctx.documentDate,
        status: "failed",
        transMode: transport.transMode,
        transDocNo: transport.transDocNo ?? null,
        transDocDate: transport.transDocDate ?? null,
        vehicleNo: transport.vehicleNo ?? null,
        transDistance: transport.transDistance,
        fromPlace: transport.fromPlace ?? null,
        toPlace: transport.toPlace ?? null,
        lastError: message,
        requestHash: hash,
        payload: payload as unknown as Record<string, unknown>,
      });
      await store.addAttempt(businessId, {
        kind: "ewaybill",
        documentKind,
        documentId,
        action: "generate",
        status: "failed",
        error: message,
        requestHash: hash,
      });
      throw error instanceof AppError ? error : AppError.unprocessable(message);
    }
  }

  async cancelEwayBill(
    businessId: string,
    userId: string,
    documentKind: GstIrpDocumentKind,
    documentId: string,
    reason: string,
    remark?: string
  ): Promise<GstEwayBillRecord> {
    await this.auth.requirePermission(businessId, userId, "sales.manage");
    const store = this.compliance();
    const existing = await store.getEwayBill(businessId, documentKind, documentId);
    if (!existing?.ewbNo || existing.status !== "generated") {
      throw AppError.validation("There is no generated e-way bill to cancel.");
    }
    const trimmed = reason.trim();
    if (!trimmed) throw AppError.validation("Enter the e-way bill cancellation reason.");
    const credentials = await this.requireCredentials(businessId);
    try {
      const result = await this.irp.cancelEwayBill(credentials, { ewbNo: existing.ewbNo, reason: trimmed, remark });
      const record = await store.upsertEwayBill(businessId, {
        documentKind,
        documentId,
        documentNo: existing.documentNo,
        documentDate: existing.documentDate,
        status: "cancelled",
        ewbNo: existing.ewbNo,
        ewbDate: existing.ewbDate,
        validUpto: existing.validUpto,
        transMode: existing.transMode,
        transDocNo: existing.transDocNo,
        transDocDate: existing.transDocDate,
        vehicleNo: existing.vehicleNo,
        transDistance: existing.transDistance,
        fromPlace: existing.fromPlace,
        toPlace: existing.toPlace,
        cancelReason: trimmed,
        cancelledAt: result.cancelledAt,
        lastError: null,
        requestHash: existing.requestHash,
        response: result.raw,
      });
      await store.addAttempt(businessId, {
        kind: "ewaybill",
        documentKind,
        documentId,
        action: "cancel",
        status: "success",
        response: { ewbNo: result.ewbNo },
      });
      await this.audits.log({
        businessId,
        userId,
        action: "gst.ewaybill.cancelled",
        entityType: documentKind,
        entityId: documentId,
        metadata: { ewbNo: existing.ewbNo, reason: trimmed },
      });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "E-way bill cancellation failed.";
      await store.addAttempt(businessId, {
        kind: "ewaybill",
        documentKind,
        documentId,
        action: "cancel",
        status: "failed",
        error: message,
      });
      throw error instanceof AppError ? error : AppError.unprocessable(message);
    }
  }

  private async requireCredentials(businessId: string) {
    const secret = await this.compliance().getCredentialSecret(businessId);
    if (!secret?.ciphertext || !secret.iv || !secret.username || !secret.gstin) {
      throw AppError.unprocessable(CREDENTIALS_MISSING);
    }
    let password: string;
    try {
      password = decryptSecret(secret.ciphertext, secret.iv);
    } catch {
      throw AppError.unprocessable("Stored IRP credentials could not be decrypted. Save them again.");
    }
    if (!password) throw AppError.unprocessable(CREDENTIALS_MISSING);
    return {
      gstin: secret.gstin,
      username: secret.username,
      password,
      environment: secret.environment,
      provider: secret.provider,
    };
  }
}
