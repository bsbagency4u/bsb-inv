import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  EinvoiceStatus,
  EwayBillStatus,
  GstComplianceAttempt,
  GstEinvoiceRecord,
  GstEwayBillRecord,
  GstIrpCredentialPublic,
  GstIrpDocumentKind,
  GstIrpEnvironment,
} from "@/types/domain";
import { maskUsername } from "@/lib/gst-mask";

export interface GstIrpCredentialSecret {
  username: string;
  password: string;
  gstin: string;
  provider: string;
  environment: GstIrpEnvironment;
}

export interface GstEinvoiceWrite {
  documentKind: GstIrpDocumentKind;
  documentId: string;
  documentNo: string;
  documentDate: string;
  status: EinvoiceStatus;
  irn?: string | null;
  ackNo?: string | null;
  ackDate?: string | null;
  signedQrCode?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
  requestHash?: string | null;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

export interface GstEwayBillWrite {
  documentKind: GstIrpDocumentKind;
  documentId: string;
  documentNo: string;
  documentDate: string;
  status: EwayBillStatus;
  ewbNo?: string | null;
  ewbDate?: string | null;
  validUpto?: string | null;
  transMode?: string | null;
  transDocNo?: string | null;
  transDocDate?: string | null;
  vehicleNo?: string | null;
  transDistance?: number | null;
  fromPlace?: string | null;
  toPlace?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
  requestHash?: string | null;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

export interface ComplianceRepository {
  getCredentialPublic(businessId: string): Promise<GstIrpCredentialPublic>;
  getCredentialSecret(businessId: string): Promise<(GstIrpCredentialSecret & { ciphertext: string; iv: string }) | null>;
  upsertCredentials(
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
  ): Promise<GstIrpCredentialPublic>;
  listEinvoices(businessId: string): Promise<GstEinvoiceRecord[]>;
  getEinvoice(businessId: string, documentKind: GstIrpDocumentKind, documentId: string): Promise<GstEinvoiceRecord | null>;
  upsertEinvoice(businessId: string, input: GstEinvoiceWrite): Promise<GstEinvoiceRecord>;
  listEwayBills(businessId: string): Promise<GstEwayBillRecord[]>;
  getEwayBill(businessId: string, documentKind: GstIrpDocumentKind, documentId: string): Promise<GstEwayBillRecord | null>;
  upsertEwayBill(businessId: string, input: GstEwayBillWrite): Promise<GstEwayBillRecord>;
  listAttempts(businessId: string, limit?: number): Promise<GstComplianceAttempt[]>;
  addAttempt(
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
  ): Promise<GstComplianceAttempt>;
}

function mapCredentialPublic(row: {
  provider: string;
  environment: string;
  gstin: string | null;
  username: string | null;
  secret_ciphertext: string | null;
  last_validated_at: string | null;
  last_error: string | null;
}): GstIrpCredentialPublic {
  return {
    configured: Boolean(row.secret_ciphertext),
    provider: row.provider,
    environment: (row.environment === "production" ? "production" : "sandbox") as GstIrpEnvironment,
    gstin: row.gstin,
    usernameMasked: maskUsername(row.username),
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
  };
}

function mapEinvoice(row: {
  id: string;
  business_id: string;
  document_kind: string;
  document_id: string;
  document_no: string;
  document_date: string;
  status: string;
  irn: string | null;
  ack_no: string | null;
  ack_date: string | null;
  signed_qr_code: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  last_error: string | null;
  request_hash: string | null;
  created_at: string;
  updated_at: string;
}): GstEinvoiceRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    documentKind: row.document_kind as GstIrpDocumentKind,
    documentId: row.document_id,
    documentNo: row.document_no,
    documentDate: row.document_date,
    status: row.status as EinvoiceStatus,
    irn: row.irn,
    ackNo: row.ack_no,
    ackDate: row.ack_date,
    signedQrCode: row.signed_qr_code,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    lastError: row.last_error,
    requestHash: row.request_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEway(row: {
  id: string;
  business_id: string;
  document_kind: string;
  document_id: string;
  document_no: string;
  document_date: string;
  status: string;
  ewb_no: string | null;
  ewb_date: string | null;
  valid_upto: string | null;
  trans_mode: string | null;
  trans_doc_no: string | null;
  trans_doc_date: string | null;
  vehicle_no: string | null;
  trans_distance: number | null;
  from_place: string | null;
  to_place: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  last_error: string | null;
  request_hash: string | null;
  created_at: string;
  updated_at: string;
}): GstEwayBillRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    documentKind: row.document_kind as GstIrpDocumentKind,
    documentId: row.document_id,
    documentNo: row.document_no,
    documentDate: row.document_date,
    status: row.status as EwayBillStatus,
    ewbNo: row.ewb_no,
    ewbDate: row.ewb_date,
    validUpto: row.valid_upto,
    transMode: row.trans_mode,
    transDocNo: row.trans_doc_no,
    transDocDate: row.trans_doc_date,
    vehicleNo: row.vehicle_no,
    transDistance: row.trans_distance,
    fromPlace: row.from_place,
    toPlace: row.to_place,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    lastError: row.last_error,
    requestHash: row.request_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttempt(row: {
  id: string;
  business_id: string;
  kind: string;
  document_kind: string;
  document_id: string;
  action: string;
  status: string;
  error: string | null;
  created_at: string;
}): GstComplianceAttempt {
  return {
    id: row.id,
    businessId: row.business_id,
    kind: row.kind as "einvoice" | "ewaybill",
    documentKind: row.document_kind as GstIrpDocumentKind,
    documentId: row.document_id,
    action: row.action,
    status: row.status as GstComplianceAttempt["status"],
    error: row.error,
    createdAt: row.created_at,
  };
}

export class SupabaseComplianceRepository implements ComplianceRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async getCredentialPublic(businessId: string): Promise<GstIrpCredentialPublic> {
    const { data, error } = await this.client
      .from("gst_irp_credentials")
      .select("provider, environment, gstin, username, secret_ciphertext, last_validated_at, last_error")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
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
    return mapCredentialPublic(data);
  }

  async getCredentialSecret(businessId: string): Promise<(GstIrpCredentialSecret & { ciphertext: string; iv: string }) | null> {
    const { data, error } = await this.client
      .from("gst_irp_credentials")
      .select("provider, environment, gstin, username, secret_ciphertext, secret_iv")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.secret_ciphertext || !data.secret_iv || !data.username || !data.gstin) return null;
    return {
      username: data.username,
      password: "",
      gstin: data.gstin,
      provider: data.provider,
      environment: (data.environment === "production" ? "production" : "sandbox") as GstIrpEnvironment,
      ciphertext: data.secret_ciphertext,
      iv: data.secret_iv,
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
    const { data, error } = await this.client
      .from("gst_irp_credentials")
      .upsert({
        business_id: businessId,
        provider: input.provider,
        environment: input.environment,
        gstin: input.gstin,
        username: input.username,
        secret_ciphertext: input.ciphertext,
        secret_iv: input.iv,
        last_validated_at: input.lastValidatedAt ?? null,
        last_error: input.lastError ?? null,
      })
      .select("provider, environment, gstin, username, secret_ciphertext, last_validated_at, last_error")
      .single();
    if (error) throw error;
    return mapCredentialPublic(data);
  }

  async listEinvoices(businessId: string): Promise<GstEinvoiceRecord[]> {
    const { data, error } = await this.client
      .from("gst_einvoices")
      .select("*")
      .eq("business_id", businessId)
      .order("document_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEinvoice);
  }

  async getEinvoice(businessId: string, documentKind: GstIrpDocumentKind, documentId: string): Promise<GstEinvoiceRecord | null> {
    const { data, error } = await this.client
      .from("gst_einvoices")
      .select("*")
      .eq("business_id", businessId)
      .eq("document_kind", documentKind)
      .eq("document_id", documentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEinvoice(data) : null;
  }

  async upsertEinvoice(businessId: string, input: GstEinvoiceWrite): Promise<GstEinvoiceRecord> {
    const { data, error } = await this.client
      .from("gst_einvoices")
      .upsert({
        business_id: businessId,
        document_kind: input.documentKind,
        document_id: input.documentId,
        document_no: input.documentNo,
        document_date: input.documentDate,
        status: input.status,
        irn: input.irn ?? null,
        ack_no: input.ackNo ?? null,
        ack_date: input.ackDate ?? null,
        signed_qr_code: input.signedQrCode ?? null,
        cancel_reason: input.cancelReason ?? null,
        cancelled_at: input.cancelledAt ?? null,
        last_error: input.lastError ?? null,
        request_hash: input.requestHash ?? null,
        payload: input.payload ?? {},
        response: input.response ?? {},
      }, { onConflict: "business_id,document_kind,document_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapEinvoice(data);
  }

  async listEwayBills(businessId: string): Promise<GstEwayBillRecord[]> {
    const { data, error } = await this.client
      .from("gst_eway_bills")
      .select("*")
      .eq("business_id", businessId)
      .order("document_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEway);
  }

  async getEwayBill(businessId: string, documentKind: GstIrpDocumentKind, documentId: string): Promise<GstEwayBillRecord | null> {
    const { data, error } = await this.client
      .from("gst_eway_bills")
      .select("*")
      .eq("business_id", businessId)
      .eq("document_kind", documentKind)
      .eq("document_id", documentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEway(data) : null;
  }

  async upsertEwayBill(businessId: string, input: GstEwayBillWrite): Promise<GstEwayBillRecord> {
    const { data, error } = await this.client
      .from("gst_eway_bills")
      .upsert({
        business_id: businessId,
        document_kind: input.documentKind,
        document_id: input.documentId,
        document_no: input.documentNo,
        document_date: input.documentDate,
        status: input.status,
        ewb_no: input.ewbNo ?? null,
        ewb_date: input.ewbDate ?? null,
        valid_upto: input.validUpto ?? null,
        trans_mode: input.transMode ?? null,
        trans_doc_no: input.transDocNo ?? null,
        trans_doc_date: input.transDocDate ?? null,
        vehicle_no: input.vehicleNo ?? null,
        trans_distance: input.transDistance ?? null,
        from_place: input.fromPlace ?? null,
        to_place: input.toPlace ?? null,
        cancel_reason: input.cancelReason ?? null,
        cancelled_at: input.cancelledAt ?? null,
        last_error: input.lastError ?? null,
        request_hash: input.requestHash ?? null,
        payload: input.payload ?? {},
        response: input.response ?? {},
      }, { onConflict: "business_id,document_kind,document_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapEway(data);
  }

  async listAttempts(businessId: string, limit = 50): Promise<GstComplianceAttempt[]> {
    const { data, error } = await this.client
      .from("gst_compliance_attempts")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapAttempt);
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
    const { data, error } = await this.client
      .from("gst_compliance_attempts")
      .insert({
        business_id: businessId,
        kind: input.kind,
        document_kind: input.documentKind,
        document_id: input.documentId,
        action: input.action,
        status: input.status,
        request_hash: input.requestHash ?? null,
        error: input.error ?? null,
        response: input.response ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapAttempt(data);
  }
}
