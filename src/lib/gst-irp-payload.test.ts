import { describe, expect, it } from "vitest";
import type { BusinessProfile, Customer, SalesInvoice } from "@/types/domain";
import { buildEwayBillPayload, buildIrpInvoicePayload, payloadHash } from "./gst-irp-payload";

const REGULAR_GSTIN = "29AAAAA0000A1Z4";
const BUYER_GSTIN = "27BBBBB0000B1ZX";

const business: BusinessProfile = {
  id: "b-1",
  name: "Demo Store",
  legalName: "Demo Store LLP",
  type: "retail",
  logoUrl: null,
  address: "1 Market Road",
  city: "Bengaluru",
  state: "KA",
  country: "India",
  pincode: "560001",
  phone: null,
  email: null,
  website: null,
  gstin: REGULAR_GSTIN,
  pan: null,
  gstRegistrationType: "regular",
  currency: "INR",
  financialYear: "2026-27",
  invoicePrefix: "INV",
  invoiceStartNumber: 1,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const customer: Customer = {
  id: "c-1",
  businessId: "b-1",
  name: "Buyer Co",
  phone: null,
  email: null,
  gstin: BUYER_GSTIN,
  pan: null,
  customerType: "business",
  gstRegistrationType: "registered",
  placeOfSupplyState: "Maharashtra",
  creditLimit: null,
  address: "2 Trade Street",
  city: "Pune",
  state: "MH",
  pincode: "411001",
  country: "India",
  notes: null,
  openingBalance: 0,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const invoice: SalesInvoice = {
  id: "inv-1",
  businessId: "b-1",
  invoiceNo: "INV-2026-000001",
  customerId: "c-1",
  invoiceDate: "2026-04-15",
  dueDate: null,
  status: "completed",
  subtotal: 1000,
  discount: 0,
  taxTotal: 180,
  total: 1180,
  paidAmount: 0,
  paymentMode: null,
  notes: null,
  items: [
    {
      productId: "Soap",
      quantity: 2,
      unitPrice: 500,
      gstRate: 18,
      discount: 0,
      taxableAmount: 1000,
      taxAmount: 180,
      amount: 1180,
      hsn: "3401",
      saleUnit: "PCS",
    },
  ],
  gstDocumentType: "tax_invoice",
  placeOfSupplyState: "Maharashtra",
  intraState: false,
  reverseCharge: false,
  createdAt: "2026-04-15",
  updatedAt: "2026-04-15",
};

describe("buildIrpInvoicePayload", () => {
  it("maps a posted B2B tax invoice to NIC document and value details", () => {
    const payload = buildIrpInvoicePayload({
      business,
      invoice,
      customer,
      documentType: "tax_invoice",
      partyName: customer.name,
      partyGstin: customer.gstin,
    });
    expect(payload.Version).toBe("1.1");
    expect(payload.DocDtls).toEqual({ Typ: "INV", No: "INV-2026-000001", Dt: "15/04/2026" });
    expect(payload.TranDtls.SupTyp).toBe("B2B");
    expect(payload.SellerDtls.Gstin).toBe(REGULAR_GSTIN);
    expect(payload.BuyerDtls.Gstin).toBe(BUYER_GSTIN);
    expect(payload.ItemList).toHaveLength(1);
    expect(payload.ItemList[0].HsnCd).toBe("3401");
    expect(payload.ItemList[0].IgstAmt).toBe(180);
    expect(payload.ValDtls.TotInvVal).toBe(1180);
  });

  it("rejects a bill of supply because NIC has no document type for it", () => {
    expect(() =>
      buildIrpInvoicePayload({
        business,
        invoice: { ...invoice, gstDocumentType: "bill_of_supply" },
        customer,
        documentType: "bill_of_supply",
        partyName: customer.name,
        partyGstin: customer.gstin,
      })
    ).toThrow(/cannot be reported to the IRP/i);
  });
});

describe("buildEwayBillPayload", () => {
  it("carries transport distance and vehicle without inventing an e-way bill number", () => {
    const payload = buildEwayBillPayload({
      business,
      invoice,
      customer,
      partyName: customer.name,
      partyGstin: customer.gstin,
      transport: {
        transMode: "1",
        transDistance: 120,
        vehicleNo: "KA01AB1234",
        fromPlace: "Bengaluru",
        toPlace: "Pune",
      },
    });
    expect(payload.docNo).toBe("INV-2026-000001");
    expect(payload.transMode).toBe("1");
    expect(payload.transDistance).toBe(120);
    expect(payload.vehicleNo).toBe("KA01AB1234");
    expect(payload.totInvValue).toBe(1180);
    expect(payload).not.toHaveProperty("ewbNo");
  });
});

describe("payloadHash", () => {
  it("changes when a GST-mandatory field changes", () => {
    const first = payloadHash({ No: "INV-1", TotInvVal: 1180 });
    const second = payloadHash({ No: "INV-1", TotInvVal: 1200 });
    expect(first).not.toBe(second);
  });
});
