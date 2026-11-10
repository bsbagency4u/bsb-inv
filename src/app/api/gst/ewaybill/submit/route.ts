import { NextResponse } from "next/server";
import type { GstIrpDocumentKind } from "@/types/domain";
import {
  asNumber,
  asString,
  gstApiContext,
  gstApiError,
  readJsonBody,
} from "@/lib/gst-api-route";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const { userId, irp } = await gstApiContext();
    const record = await irp.submitEwayBill(
      asString(body.businessId),
      userId,
      asString(body.documentKind) as GstIrpDocumentKind,
      asString(body.documentId),
      {
        transMode: asString(body.transMode),
        transDistance: asNumber(body.transDistance),
        transDocNo: asString(body.transDocNo) || null,
        transDocDate: asString(body.transDocDate) || null,
        vehicleNo: asString(body.vehicleNo) || null,
        fromPlace: asString(body.fromPlace) || null,
        toPlace: asString(body.toPlace) || null,
      }
    );
    return NextResponse.json(record);
  } catch (error) {
    return gstApiError(error);
  }
}
