import "server-only";
import { AppError } from "@/lib/errors";

export interface IrpAuthCredentials {
  gstin: string;
  username: string;
  password: string;
  environment: "sandbox" | "production";
  provider: string;
}

export interface IrpGenerateResult {
  irn: string;
  ackNo: string;
  ackDate: string;
  signedQrCode: string;
  raw: Record<string, unknown>;
}

export interface IrpCancelResult {
  irn: string;
  cancelledAt: string;
  raw: Record<string, unknown>;
}

export interface EwbGenerateResult {
  ewbNo: string;
  ewbDate: string;
  validUpto: string;
  raw: Record<string, unknown>;
}

export interface EwbCancelResult {
  ewbNo: string;
  cancelledAt: string;
  raw: Record<string, unknown>;
}

const SANDBOX_IRP = "https://einv-apisandbox.nic.in";
const PRODUCTION_IRP = "https://einvoice1.gst.gov.in";
const SANDBOX_EWB = "https://ewaybillgst.gov.in";
const PRODUCTION_EWB = "https://ewaybillgst.gov.in";

function irpBase(environment: "sandbox" | "production"): string {
  return (process.env.GST_IRP_BASE_URL || (environment === "production" ? PRODUCTION_IRP : SANDBOX_IRP)).replace(
    /\/$/,
    ""
  );
}

function ewbBase(environment: "sandbox" | "production"): string {
  return (process.env.GST_EWB_BASE_URL || (environment === "production" ? PRODUCTION_EWB : SANDBOX_EWB)).replace(
    /\/$/,
    ""
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const data = asRecord(record.Data ?? record.data ?? record.Result ?? record.result);
  if (data !== record) {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function nicError(record: Record<string, unknown>, fallback: string): string {
  return (
    pickString(record, ["ErrorDetails", "error", "Error", "message", "Message", "status_desc", "info"]) ??
    fallback
  );
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw AppError.network("Could not reach the GSTN IRP. Check the GSP/IRP endpoint and try again.");
  }
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = asRecord(JSON.parse(text));
    } catch {
      throw AppError.unprocessable("The IRP returned a response that could not be read.");
    }
  }
  if (!response.ok) {
    throw AppError.unprocessable(nicError(parsed, `IRP request failed (${response.status}).`));
  }
  const status = pickString(parsed, ["Status", "status"]);
  if (status && status !== "1" && status.toLowerCase() !== "success") {
    throw AppError.unprocessable(nicError(parsed, "The IRP rejected this request."));
  }
  return parsed;
}

export class GstIrpClient {
  async generateIrn(credentials: IrpAuthCredentials, payload: Record<string, unknown>): Promise<IrpGenerateResult> {
    const raw = await postJson(
      `${irpBase(credentials.environment)}/eicore/v1.03/Invoice`,
      payload,
      {
        gstin: credentials.gstin,
        username: credentials.username,
        password: credentials.password,
        provider: credentials.provider,
      }
    );
    const irn = pickString(raw, ["Irn", "IRN", "irn"]);
    const ackNo = pickString(raw, ["AckNo", "Ack_No", "ackNo"]);
    const ackDate = pickString(raw, ["AckDt", "AckDate", "ackDate"]);
    const signedQrCode = pickString(raw, ["SignedQRCode", "SignedQrCode", "signedQRCode", "QRCode"]);
    if (!irn || !ackNo || !ackDate || !signedQrCode) {
      throw AppError.unprocessable(
        "The IRP did not return a verified IRN, acknowledgement and signed QR. Nothing was stored."
      );
    }
    return { irn, ackNo, ackDate, signedQrCode, raw };
  }

  async cancelIrn(
    credentials: IrpAuthCredentials,
    input: { irn: string; reason: string; remark?: string }
  ): Promise<IrpCancelResult> {
    const raw = await postJson(
      `${irpBase(credentials.environment)}/eicore/v1.03/Invoice/Cancel`,
      { Irn: input.irn, CnlRsn: input.reason, CnlRem: input.remark ?? input.reason },
      {
        gstin: credentials.gstin,
        username: credentials.username,
        password: credentials.password,
        provider: credentials.provider,
      }
    );
    const irn = pickString(raw, ["Irn", "IRN", "irn"]) ?? input.irn;
    const cancelledAt = pickString(raw, ["CancelDate", "CnlDt", "cancelledAt"]) ?? new Date().toISOString();
    return { irn, cancelledAt, raw };
  }

  async generateEwayBill(
    credentials: IrpAuthCredentials,
    payload: Record<string, unknown>
  ): Promise<EwbGenerateResult> {
    const raw = await postJson(`${ewbBase(credentials.environment)}/ewayapi/genEwayBill`, payload, {
      gstin: credentials.gstin,
      username: credentials.username,
      password: credentials.password,
      provider: credentials.provider,
    });
    const ewbNo = pickString(raw, ["ewayBillNo", "EwbNo", "ewbNo", "EwbNo"]);
    const ewbDate = pickString(raw, ["ewayBillDate", "EwbDt", "ewbDate"]);
    const validUpto = pickString(raw, ["validUpto", "EwbValidTill", "validTill"]);
    if (!ewbNo || !ewbDate || !validUpto) {
      throw AppError.unprocessable(
        "The NIC e-way bill system did not return a verified bill number and validity. Nothing was stored."
      );
    }
    return { ewbNo, ewbDate, validUpto, raw };
  }

  async cancelEwayBill(
    credentials: IrpAuthCredentials,
    input: { ewbNo: string; reason: string; remark?: string }
  ): Promise<EwbCancelResult> {
    const raw = await postJson(
      `${ewbBase(credentials.environment)}/ewayapi/canEwayBill`,
      { ewbNo: input.ewbNo, cancelRsnCode: input.reason, cancelRmrk: input.remark ?? input.reason },
      {
        gstin: credentials.gstin,
        username: credentials.username,
        password: credentials.password,
        provider: credentials.provider,
      }
    );
    const ewbNo = pickString(raw, ["ewayBillNo", "EwbNo", "ewbNo"]) ?? input.ewbNo;
    const cancelledAt = pickString(raw, ["cancelDate", "cancelledAt"]) ?? new Date().toISOString();
    return { ewbNo, cancelledAt, raw };
  }
}
