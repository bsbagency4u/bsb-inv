import { NextResponse } from "next/server";
import type { GstIrpDocumentKind } from "@/types/domain";
import {
  asString,
  gstApiContext,
  gstApiError,
  readJsonBody,
} from "@/lib/gst-api-route";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const { userId, irp } = await gstApiContext();
    const record = await irp.submitEinvoice(
      asString(body.businessId),
      userId,
      asString(body.documentKind) as GstIrpDocumentKind,
      asString(body.documentId)
    );
    return NextResponse.json(record);
  } catch (error) {
    return gstApiError(error);
  }
}
