import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUOTATION,
  addDaysIso,
  defaultTemplateForFormat,
  formatBankDetails,
  parseQuotationDefaults,
} from "./quotation-settings";

describe("parseQuotationDefaults", () => {
  it("returns defaults for empty storage", () => {
    const parsed = parseQuotationDefaults(null);
    expect(parsed.defaultFormat).toBe("product_service");
    expect(parsed.validityDays).toBe(15);
    expect(parsed.bankDetails.accountNumber).toBe("");
    expect(parsed.templates).toHaveLength(2);
  });

  it("keeps business bank details without inventing values", () => {
    const parsed = parseQuotationDefaults({
      ...DEFAULT_QUOTATION,
      showBankDetails: true,
      bankDetails: {
        accountName: "Demo Store",
        accountNumber: "123456",
        ifsc: "hdfc0001234",
        bankName: "HDFC",
        branch: "Pune",
        upi: "",
      },
    });
    expect(parsed.bankDetails.ifsc).toBe("HDFC0001234");
    expect(formatBankDetails(parsed.bankDetails)).toContain("A/c no: 123456");
    expect(formatBankDetails(DEFAULT_QUOTATION.bankDetails)).toBe("");
  });

  it("clamps watermark opacity and validity", () => {
    const parsed = parseQuotationDefaults({
      validityDays: 900,
      watermarkOpacity: 0.9,
      watermarkEnabled: true,
    });
    expect(parsed.validityDays).toBe(365);
    expect(parsed.watermarkOpacity).toBe(0.35);
  });
});

describe("quotation templates", () => {
  it("picks the default template for each format", () => {
    const product = defaultTemplateForFormat(DEFAULT_QUOTATION, "product_service");
    const proposal = defaultTemplateForFormat(DEFAULT_QUOTATION, "formal_proposal");
    expect(product.format).toBe("product_service");
    expect(proposal.format).toBe("formal_proposal");
    expect(proposal.showCover).toBe(true);
  });

  it("adds days for validity", () => {
    expect(addDaysIso("2026-11-09", 15)).toBe("2026-11-24");
  });
});
