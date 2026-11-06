import type {
  BusinessProfile,
  Customer,
  GstDocumentType,
  LineItem,
  SalesInvoice,
  SalesReturn,
} from "@/types/domain";
import { roundMoney } from "@/lib/party-ledger";
import { validateGstin } from "@/lib/validation/schemas";
import {
  formatNicDate,
  nicDocumentType,
  nicSupplyType,
  stateCodeFromGstin,
} from "@/lib/gst-einvoice";

export interface IrpSellerBuyer {
  Gstin: string;
  LglNm: string;
  Addr1: string;
  Loc: string;
  Pin: number;
  Stcd: string;
}

export interface IrpItem {
  SlNo: string;
  PrdDesc: string;
  HsnCd: string;
  Qty: number;
  Unit: string;
  UnitPrice: number;
  TotAmt: number;
  Discount: number;
  AssAmt: number;
  GstRt: number;
  CgstAmt: number;
  SgstAmt: number;
  IgstAmt: number;
  TotItemVal: number;
}

export interface IrpInvoicePayload {
  Version: string;
  TranDtls: {
    TaxSch: string;
    SupTyp: string;
    RegRev: string;
    EcmGstin: string | null;
    IgstOnIntra: string;
  };
  DocDtls: {
    Typ: "INV" | "CRN" | "DBN";
    No: string;
    Dt: string;
  };
  SellerDtls: IrpSellerBuyer;
  BuyerDtls: IrpSellerBuyer;
  ItemList: IrpItem[];
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    Discount: number;
    TotInvVal: number;
  };
}

export interface EwayBillPayload {
  supplyType: "O";
  subSupplyType: "1";
  docType: "INV" | "CHL";
  docNo: string;
  docDate: string;
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: number;
  fromStateCode: number;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: number;
  toStateCode: number;
  transactionType: number;
  totalValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  totInvValue: number;
  transMode: string;
  transDistance: number;
  transDocNo: string | null;
  transDocDate: string | null;
  vehicleNo: string | null;
  itemList: Array<{
    productName: string;
    hsnCode: string;
    quantity: number;
    qtyUnit: string;
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
  }>;
}

export interface EwayBillTransport {
  transMode: string;
  transDistance: number;
  transDocNo?: string | null;
  transDocDate?: string | null;
  vehicleNo?: string | null;
  fromPlace?: string | null;
  toPlace?: string | null;
}

function pin(value: string | null | undefined): number {
  const digits = (value ?? "").replace(/\D/g, "");
  const n = Number(digits.slice(0, 6));
  return Number.isFinite(n) && n >= 100000 ? n : 0;
}

function stateCode(gstin: string | null | undefined, fallback: string | null | undefined): string {
  return stateCodeFromGstin(gstin) ?? stateCodeFromGstin(fallback) ?? "29";
}

function partyAddress(party: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  name: string;
}): IrpSellerBuyer {
  return {
    Gstin: (party.gstin ?? "").trim().toUpperCase(),
    LglNm: party.name,
    Addr1: (party.address ?? party.city ?? party.name).trim() || party.name,
    Loc: (party.city ?? party.state ?? "NA").trim() || "NA",
    Pin: pin(party.pincode),
    Stcd: stateCode(party.gstin, null),
  };
}

function splitLineTax(item: LineItem, intraState: boolean): { cgst: number; sgst: number; igst: number } {
  const tax = roundMoney(item.taxAmount ?? 0);
  if (intraState) {
    const half = roundMoney(tax / 2);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: tax };
}

export function buildIrpInvoicePayload(input: {
  business: BusinessProfile;
  invoice: SalesInvoice;
  customer: Customer | null;
  documentType: GstDocumentType;
  partyName: string;
  partyGstin: string | null;
}): IrpInvoicePayload {
  const typ = nicDocumentType(input.documentType);
  if (!typ) {
    throw new Error("This document type cannot be reported to the IRP.");
  }
  const sellerGstin = (input.business.gstin ?? "").trim().toUpperCase();
  if (!validateGstin(sellerGstin) || !sellerGstin) {
    throw new Error("A valid supplier GSTIN is required.");
  }
  const intraState = input.invoice.intraState ?? true;
  const items: IrpItem[] = input.invoice.items.map((item, index) => {
    const split = splitLineTax(item, intraState);
    const taxable = roundMoney(item.taxableAmount ?? Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0)));
    return {
      SlNo: String(index + 1),
      PrdDesc: item.productId,
      HsnCd: (item.hsn ?? "").trim() || "00000000",
      Qty: item.quantity,
      Unit: item.saleUnit ?? "NOS",
      UnitPrice: roundMoney(item.unitPrice),
      TotAmt: roundMoney(item.quantity * item.unitPrice),
      Discount: roundMoney(item.discount ?? 0),
      AssAmt: taxable,
      GstRt: item.gstRate,
      CgstAmt: split.cgst,
      SgstAmt: split.sgst,
      IgstAmt: split.igst,
      TotItemVal: roundMoney(item.amount),
    };
  });
  const cgst = roundMoney(items.reduce((sum, item) => sum + item.CgstAmt, 0));
  const sgst = roundMoney(items.reduce((sum, item) => sum + item.SgstAmt, 0));
  const igst = roundMoney(items.reduce((sum, item) => sum + item.IgstAmt, 0));
  const assVal = roundMoney(items.reduce((sum, item) => sum + item.AssAmt, 0));
  const seller = partyAddress({
    name: input.business.legalName || input.business.name,
    address: input.business.address,
    city: input.business.city,
    state: input.business.state,
    pincode: input.business.pincode,
    gstin: sellerGstin,
  });
  const buyerGstin = (input.partyGstin ?? input.customer?.gstin ?? "").trim().toUpperCase();
  const buyer = partyAddress({
    name: input.partyName,
    address: input.customer?.address ?? null,
    city: input.customer?.city ?? null,
    state: input.customer?.state ?? input.invoice.placeOfSupplyState ?? null,
    pincode: input.customer?.pincode ?? null,
    gstin: buyerGstin,
  });
  return {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: nicSupplyType({
        documentType: input.documentType,
        recipientRegistrationType: input.customer?.gstRegistrationType,
        reverseCharge: input.invoice.reverseCharge,
      }),
      RegRev: input.invoice.reverseCharge ? "Y" : "N",
      EcmGstin: null,
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: typ,
      No: input.invoice.invoiceNo,
      Dt: formatNicDate(input.invoice.invoiceDate),
    },
    SellerDtls: seller,
    BuyerDtls: buyer,
    ItemList: items,
    ValDtls: {
      AssVal: assVal,
      CgstVal: cgst,
      SgstVal: sgst,
      IgstVal: igst,
      Discount: roundMoney(input.invoice.discount),
      TotInvVal: roundMoney(input.invoice.total),
    },
  };
}

export function buildIrpCreditNotePayload(input: {
  business: BusinessProfile;
  creditNote: SalesReturn;
  original: SalesInvoice | null;
  customer: Customer | null;
  partyName: string;
  partyGstin: string | null;
}): IrpInvoicePayload {
  const invoiceLike: SalesInvoice = {
    id: input.creditNote.id,
    businessId: input.creditNote.businessId,
    invoiceNo: input.creditNote.returnNo,
    customerId: input.creditNote.customerId,
    invoiceDate: input.creditNote.returnDate,
    dueDate: null,
    status: "completed",
    subtotal: input.creditNote.total,
    discount: 0,
    taxTotal: input.original?.taxTotal && input.original.total > 0
      ? roundMoney((input.creditNote.total / input.original.total) * input.original.taxTotal)
      : 0,
    total: input.creditNote.total,
    paidAmount: 0,
    paymentMode: null,
    notes: input.creditNote.notes,
    items: input.creditNote.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: 0,
      discount: 0,
      taxableAmount: roundMoney(item.quantity * item.unitPrice),
      taxAmount: 0,
      amount: roundMoney(item.quantity * item.unitPrice),
    })),
    gstDocumentType: "credit_note",
    placeOfSupplyState: input.original?.placeOfSupplyState ?? null,
    gstRegistrationSnapshot: input.original?.gstRegistrationSnapshot ?? null,
    intraState: input.original?.intraState ?? true,
    reverseCharge: input.original?.reverseCharge ?? false,
    createdAt: input.creditNote.createdAt,
    updatedAt: input.creditNote.createdAt,
  };
  return buildIrpInvoicePayload({
    business: input.business,
    invoice: invoiceLike,
    customer: input.customer,
    documentType: "credit_note",
    partyName: input.partyName,
    partyGstin: input.partyGstin,
  });
}

export function buildEwayBillPayload(input: {
  business: BusinessProfile;
  invoice: SalesInvoice;
  customer: Customer | null;
  partyName: string;
  partyGstin: string | null;
  transport: EwayBillTransport;
}): EwayBillPayload {
  const sellerGstin = (input.business.gstin ?? "").trim().toUpperCase();
  const buyerGstin = (input.partyGstin ?? input.customer?.gstin ?? "URP").trim().toUpperCase() || "URP";
  const intraState = input.invoice.intraState ?? true;
  const fromState = Number(stateCode(sellerGstin, null));
  const toState = Number(stateCode(buyerGstin === "URP" ? null : buyerGstin, null));
  const items = input.invoice.items.map((item) => {
    const split = splitLineTax(item, intraState);
    const rateHalf = intraState ? item.gstRate / 2 : 0;
    return {
      productName: item.productId,
      hsnCode: (item.hsn ?? "").trim() || "00000000",
      quantity: item.quantity,
      qtyUnit: item.saleUnit ?? "NOS",
      taxableAmount: roundMoney(item.taxableAmount ?? item.quantity * item.unitPrice),
      cgstRate: intraState ? rateHalf : 0,
      sgstRate: intraState ? rateHalf : 0,
      igstRate: intraState ? 0 : item.gstRate,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
    };
  });
  return {
    supplyType: "O",
    subSupplyType: "1",
    docType: "INV",
    docNo: input.invoice.invoiceNo,
    docDate: formatNicDate(input.invoice.invoiceDate),
    fromGstin: sellerGstin,
    fromTrdName: input.business.legalName || input.business.name,
    fromAddr1: (input.business.address ?? input.business.city ?? input.business.name).trim(),
    fromPlace: input.transport.fromPlace || input.business.city || input.business.state || "NA",
    fromPincode: pin(input.business.pincode),
    fromStateCode: fromState,
    toGstin: buyerGstin,
    toTrdName: input.partyName,
    toAddr1: (input.customer?.address ?? input.customer?.city ?? input.partyName).trim(),
    toPlace: input.transport.toPlace || input.customer?.city || input.invoice.placeOfSupplyState || "NA",
    toPincode: pin(input.customer?.pincode),
    toStateCode: toState || fromState,
    transactionType: 1,
    totalValue: roundMoney(input.invoice.subtotal),
    cgstValue: roundMoney(items.reduce((sum, item) => sum + item.cgst, 0)),
    sgstValue: roundMoney(items.reduce((sum, item) => sum + item.sgst, 0)),
    igstValue: roundMoney(items.reduce((sum, item) => sum + item.igst, 0)),
    totInvValue: roundMoney(input.invoice.total),
    transMode: input.transport.transMode,
    transDistance: input.transport.transDistance,
    transDocNo: input.transport.transDocNo ?? null,
    transDocDate: input.transport.transDocDate ? formatNicDate(input.transport.transDocDate) : null,
    vehicleNo: input.transport.vehicleNo ?? null,
    itemList: items.map(({ cgst: _c, sgst: _s, igst: _i, ...item }) => item),
  };
}

export function payloadHash(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `h${(hash >>> 0).toString(16)}:${json.length}`;
}
