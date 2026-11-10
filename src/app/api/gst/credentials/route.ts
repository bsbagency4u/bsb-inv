import { NextResponse } from "next/server";
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
    const environment = asString(body.environment);
    const record = await irp.storeCredentials(asString(body.businessId), userId, {
      provider: asString(body.provider) || "nic",
      environment: environment === "production" ? "production" : "sandbox",
      gstin: asString(body.gstin),
      username: asString(body.username),
      password: asString(body.password),
    });
    return NextResponse.json(record);
  } catch (error) {
    return gstApiError(error);
  }
}
