import { describe, expect, it } from "vitest";
import {
  businessProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  invoiceDefaultsSchema,
  invoiceNumberingSchema,
  loginSchema,
  purchaseDefaultsSchema,
  resetPasswordSchema,
  salesDefaultsSchema,
  signupSchema,
  taxDefaultsSchema,
  userProfileSchema,
  validateGstin,
  PAN,
} from "./schemas";

describe("validateGstin", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(validateGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(validateGstin("29ABCDE1234F1Z3")).toBe(true);
  });

  it("rejects a GSTIN with a bad checksum", () => {
    expect(validateGstin("27AAPFU0939F1ZA")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(validateGstin("123")).toBe(false);
    expect(validateGstin("")).toBe(true); // optional when empty
  });
});

describe("PAN", () => {
  it("accepts a valid PAN", () => {
    const result = PAN.safeParse("ABCDE1234F");
    expect(result.success).toBe(true);
  });

  it("accepts an empty value (optional)", () => {
    expect(PAN.safeParse("").success).toBe(true);
  });

  it("rejects an invalid PAN", () => {
    expect(PAN.safeParse("ABC").success).toBe(false);
  });
});

describe("businessProfileSchema", () => {
  it("validates a minimal valid profile", () => {
    const result = businessProfileSchema.safeParse({
      name: "Sharma General Store",
      type: "retail",
      country: "India",
      currency: "INR",
      email: "store@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing business name", () => {
    const result = businessProfileSchema.safeParse({
      name: "",
      type: "retail",
      country: "India",
      currency: "INR",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.name).toBeDefined();
    }
  });

  it("rejects an invalid email", () => {
    const result = businessProfileSchema.safeParse({
      name: "Store",
      type: "retail",
      country: "India",
      currency: "INR",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid GSTIN when supplied", () => {
    const result = businessProfileSchema.safeParse({
      name: "Store",
      type: "pharmacy",
      country: "India",
      currency: "INR",
      gstin: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invoice prefix that is too long", () => {
    const result = businessProfileSchema.safeParse({
      name: "Store",
      type: "retail",
      country: "India",
      currency: "INR",
      invoicePrefix: "ABCDEFGHIJKLMNOP",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "secret" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "secret" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = {
    fullName: "Priya Sharma",
    email: "priya@example.com",
    username: "priya_s",
    password: "secret123",
    confirmPassword: "secret123",
  };

  it("accepts a valid signup", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(signupSchema.safeParse({ ...valid, fullName: "P" }).success).toBe(false);
  });

  it("rejects a short password", () => {
    expect(
      signupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success
    ).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    expect(signupSchema.safeParse({ ...valid, confirmPassword: "other123" }).success).toBe(false);
  });

  it("rejects an invalid username", () => {
    expect(signupSchema.safeParse({ ...valid, username: "1bad" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, username: "ab" }).success).toBe(false);
  });
});

describe("password schemas", () => {
  it("accepts a valid forgot-password email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects an invalid forgot-password email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("accepts matching reset passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "secret123", confirmPassword: "secret123" }).success
    ).toBe(true);
  });

  it("rejects mismatched reset passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "secret123", confirmPassword: "other123" }).success
    ).toBe(false);
  });

  it("accepts a valid change-password payload", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "oldpass12",
        password: "newpass12",
        confirmPassword: "newpass12",
      }).success
    ).toBe(true);
  });

  it("rejects a new password equal to the current password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "secret123",
        password: "secret123",
        confirmPassword: "secret123",
      }).success
    ).toBe(false);
  });
});

describe("userProfileSchema", () => {
  it("requires a username", () => {
    expect(
      userProfileSchema.safeParse({ fullName: "Priya Sharma", username: "", phone: "", avatarUrl: "" }).success
    ).toBe(false);
  });

  it("accepts a valid profile", () => {
    expect(
      userProfileSchema.safeParse({
        fullName: "Priya Sharma",
        username: "priya_s",
        phone: "",
        avatarUrl: "",
      }).success
    ).toBe(true);
  });
});

describe("salesDefaultsSchema", () => {
  it("accepts valid sales defaults", () => {
    expect(
      salesDefaultsSchema.safeParse({
        defaultPaymentMode: "cash",
        defaultIntraState: true,
        defaultDiscountPercent: 5,
        allowLineDiscount: true,
        allowExpired: false,
      }).success
    ).toBe(true);
  });

  it("rejects a discount over 100", () => {
    expect(
      salesDefaultsSchema.safeParse({
        defaultPaymentMode: "cash",
        defaultIntraState: true,
        defaultDiscountPercent: 120,
        allowLineDiscount: true,
        allowExpired: false,
      }).success
    ).toBe(false);
  });
});

describe("purchaseDefaultsSchema", () => {
  it("accepts empty warehouse and terms", () => {
    expect(
      purchaseDefaultsSchema.safeParse({
        defaultWarehouseId: "",
        defaultPaymentTerms: "",
        defaultIntraState: true,
      }).success
    ).toBe(true);
  });
});

describe("taxDefaultsSchema", () => {
  it("accepts valid tax defaults", () => {
    expect(
      taxDefaultsSchema.safeParse({
        gstEnabled: true,
        defaultGstRate: 18,
        defaultIntraState: true,
        defaultHsnCode: "1006",
        pricesIncludeTax: false,
      }).success
    ).toBe(true);
  });

  it("rejects a GST rate over 100", () => {
    expect(
      taxDefaultsSchema.safeParse({
        gstEnabled: true,
        defaultGstRate: 120,
        defaultIntraState: true,
        defaultHsnCode: "",
        pricesIncludeTax: false,
      }).success
    ).toBe(false);
  });
});

describe("invoiceDefaultsSchema", () => {
  it("accepts valid invoice layout defaults", () => {
    expect(
      invoiceDefaultsSchema.safeParse({
        showLogo: true,
        showGstin: true,
        showHsn: false,
        showBankDetails: false,
        bankDetails: "",
        termsAndConditions: "",
        footerNote: "Thanks",
        paperSize: "a4",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown paper size", () => {
    expect(
      invoiceDefaultsSchema.safeParse({
        showLogo: true,
        showGstin: true,
        showHsn: false,
        showBankDetails: false,
        bankDetails: "",
        termsAndConditions: "",
        footerNote: "",
        paperSize: "letter",
      }).success
    ).toBe(false);
  });
});

describe("invoiceNumberingSchema", () => {
  it("uppercases and accepts a valid prefix", () => {
    const result = invoiceNumberingSchema.safeParse({
      invoicePrefix: "bill",
      invoiceStartNumber: 2000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a prefix that is too long", () => {
    expect(
      invoiceNumberingSchema.safeParse({
        invoicePrefix: "ABCDEFGHIJKLMNOP",
        invoiceStartNumber: 1,
      }).success
    ).toBe(false);
  });
});
