import { describe, expect, it } from "vitest";
import { fyContaining, fyStartMonthDay, taxPeriodPresets } from "./gst-period";

describe("gst period helpers", () => {
  it("treats 01-04 as 1 April", () => {
    expect(fyStartMonthDay("01-04")).toEqual({ month: 4, day: 1 });
    expect(fyStartMonthDay("2026-27")).toEqual({ month: 4, day: 1 });
  });

  it("resolves FY 26-27 around 1 April 2026", () => {
    expect(fyContaining("2026-10-21", "01-04")).toMatchObject({
      from: "2026-04-01",
      to: "2027-03-31",
      label: "FY 26-27",
    });
    expect(fyContaining("2026-03-31", "01-04")).toMatchObject({
      from: "2025-04-01",
      to: "2026-03-31",
    });
  });

  it("builds quarterly and monthly presets inside the FY", () => {
    const presets = taxPeriodPresets({ from: "2026-04-01", to: "2027-03-31" });
    expect(presets.find((item) => item.id === "q2")).toMatchObject({
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(presets.find((item) => item.id === "m-2026-10")).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});
