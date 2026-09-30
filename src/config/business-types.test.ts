import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPES,
  businessShowsMrp,
  businessTracksBatches,
  getBusinessType,
  getProductAttributesForType,
  getProductFormAttributesForType,
} from "./business-types";

describe("business-types registry", () => {
  it("defines all expected business types", () => {
    const slugs = BUSINESS_TYPES.map((type) => type.slug);
    for (const slug of ["retail", "wholesale", "pharmacy", "garments", "hardware", "electronics", "restaurant", "distributor", "custom"]) {
      expect(slugs).toContain(slug);
    }
  });

  it("has unique slugs and labels", () => {
    const slugs = new Set(BUSINESS_TYPES.map((type) => type.slug));
    const labels = new Set(BUSINESS_TYPES.map((type) => type.label));
    expect(slugs.size).toBe(BUSINESS_TYPES.length);
    expect(labels.size).toBe(BUSINESS_TYPES.length);
  });

  it("getBusinessType falls back to custom for unknown slugs", () => {
    expect(getBusinessType("bogus").slug).toBe("custom");
    expect(getBusinessType(null).slug).toBe("retail");
  });

  it("pharmacy has batch/expiry/mrp/manufacturer attributes", () => {
    const keys = getProductAttributesForType("pharmacy").map((a) => a.key);
    for (const key of ["batch", "expiry", "mrp", "manufacturer"]) {
      expect(keys).toContain(key);
    }
  });

  it("garments has size/color/fabric/variant attributes", () => {
    const keys = getProductAttributesForType("garments").map((a) => a.key);
    for (const key of ["size", "color", "fabric", "variant"]) {
      expect(keys).toContain(key);
    }
  });

  it("electronics has model/serial/warranty attributes", () => {
    const keys = getProductAttributesForType("electronics").map((a) => a.key);
    for (const key of ["model", "serial", "warranty"]) {
      expect(keys).toContain(key);
    }
  });

  it("custom has no default product attributes", () => {
    expect(getProductAttributesForType("custom")).toHaveLength(0);
  });

  it("pharmacy tracks batches and shows MRP; retail shows MRP without batches", () => {
    expect(businessTracksBatches("pharmacy")).toBe(true);
    expect(businessShowsMrp("pharmacy")).toBe(true);
    expect(businessTracksBatches("retail")).toBe(false);
    expect(businessShowsMrp("retail")).toBe(true);
    expect(businessTracksBatches("wholesale")).toBe(false);
    expect(businessShowsMrp("wholesale")).toBe(false);
  });

  it("product form attributes omit dedicated MRP, GST, HSN, unit and barcode fields", () => {
    const keys = getProductFormAttributesForType("pharmacy").map((a) => a.key);
    expect(keys).toContain("manufacturer");
    expect(keys).not.toContain("mrp");
    expect(keys).not.toContain("gst");
    expect(keys).not.toContain("hsn");
    expect(keys).not.toContain("unit");
    expect(getProductFormAttributesForType("retail")).toHaveLength(0);
  });
});
