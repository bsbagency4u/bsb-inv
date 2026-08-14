import { describe, expect, it } from "vitest";
import {
  businessProfileSchema,
  loginSchema,
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
