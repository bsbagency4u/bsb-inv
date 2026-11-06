import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerRepositories } from "@/repositories/server";
import { AuditService } from "@/services/audit.service";
import { GstIrpServerService } from "@/services/gst-irp.server";
import { AppError, normalizeError } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function gstApiContext() {
  if (!isSupabaseConfigured()) {
    throw AppError.unprocessable(
      "E-invoice and e-way bill submission needs a connected IRP/GSP. Demo mode cannot generate an IRN or e-way bill."
    );
  }
  const client = await createServerSupabaseClient();
  if (!client) throw AppError.auth();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw AppError.auth();
  const repos = await getServerRepositories();
  const audits = new AuditService(repos);
  return {
    userId: user.id,
    irp: new GstIrpServerService(repos, audits),
  };
}

export function gstApiError(error: unknown) {
  const normalized = normalizeError(error);
  const status = normalized.status && normalized.status >= 400 ? normalized.status : 422;
  return NextResponse.json({ error: normalized.userMessage }, { status });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    throw AppError.validation("The request body could not be read.");
  }
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}
