import { AppError } from "@/lib/errors";
import type { GstIrpDocumentKind } from "@/types/domain";

export interface GstApiErrorBody {
  error?: string;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export async function postGstApi<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw AppError.unprocessable(
      "E-invoice and e-way bill submission needs a connected IRP/GSP. Demo mode cannot generate an IRN or e-way bill."
    );
  }
  const payload = await parseJson(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "The GSTN request could not be completed.";
    if (response.status === 401) throw AppError.auth(message);
    if (response.status === 403) throw AppError.authorization(message);
    if (response.status === 404) throw AppError.notFound(message);
    throw AppError.unprocessable(message);
  }
  return payload as T;
}

export interface GstSubmitRequest {
  businessId: string;
  documentKind: GstIrpDocumentKind;
  documentId: string;
}

export interface GstCancelRequest extends GstSubmitRequest {
  reason: string;
  remark?: string;
}

export interface GstCredentialRequest {
  businessId: string;
  provider: string;
  environment: "sandbox" | "production";
  gstin: string;
  username: string;
  password: string;
}

export interface GstEwaySubmitRequest extends GstSubmitRequest {
  transMode: string;
  transDistance: number;
  transDocNo?: string | null;
  transDocDate?: string | null;
  vehicleNo?: string | null;
  fromPlace?: string | null;
  toPlace?: string | null;
}
