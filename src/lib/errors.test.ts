import { describe, expect, it } from "vitest";
import { AppError, normalizeError } from "./errors";

describe("normalizeError", () => {
  it("maps 401 to AUTH with a friendly message", () => {
    const result = normalizeError({ status: 401, message: "invalid token" });
    expect(result.code).toBe("AUTH");
    expect(result.status).toBe(401);
    expect(result.userMessage).toContain("session");
  });

  it("maps 403 to AUTHORIZATION", () => {
    const result = normalizeError({ status: 403 });
    expect(result.code).toBe("AUTHORIZATION");
    expect(result.userMessage).toContain("permission");
  });

  it("maps 404 to NOT_FOUND", () => {
    const result = normalizeError({ status: 404 });
    expect(result.code).toBe("NOT_FOUND");
  });

  it("maps 409 to CONFLICT", () => {
    const result = normalizeError({ status: 409 });
    expect(result.code).toBe("CONFLICT");
  });

  it("maps 422 to UNPROCESSABLE", () => {
    const result = normalizeError({ status: 422 });
    expect(result.code).toBe("UNPROCESSABLE");
  });

  it("maps PostgREST no-row code PGRST116 to NOT_FOUND", () => {
    const result = normalizeError({ code: "PGRST116" });
    expect(result.code).toBe("NOT_FOUND");
  });

  it("maps PostgREST codes to DATABASE", () => {
    const result = normalizeError({ code: "PGRST301" });
    expect(result.code).toBe("DATABASE");
  });

  it("maps network-like messages to NETWORK", () => {
    const result = normalizeError({ message: "Failed to fetch" });
    expect(result.code).toBe("NETWORK");
  });

  it("passes AppError through with a safe message", () => {
    const error = AppError.validation("Bad field.");
    const result = normalizeError(error);
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toBe("Bad field.");
  });

  it("never leaks raw Error stack traces", () => {
    const error = new Error("SELECT * FROM secrets -- leaked");
    const result = normalizeError(error);
    expect(result.userMessage).not.toContain("SELECT");
    expect(result.userMessage).toBe("Something went wrong. Please try again.");
  });
});
