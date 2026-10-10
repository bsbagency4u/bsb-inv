import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { ProfileRepository } from "@/repositories/profile.repository";
import type { SessionUser } from "@/types/domain";
import { AuthService } from "./auth.service";

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => false,
}));

vi.mock("@/lib/session/demo-session", () => {
  let session: { userId: string; email: string; signedInAt: string } | null = null;
  return {
    setDemoSession: (value: typeof session) => {
      session = value;
    },
    clearDemoSession: () => {
      session = null;
    },
    hasDemoSession: () => Boolean(session),
    getDemoSession: () => session,
  };
});

function memoryProfiles(): ProfileRepository {
  const taken = new Map<string, string>();
  const rows = new Map<string, SessionUser>();
  return {
    async getByUserId(userId) {
      return rows.get(userId) ?? null;
    },
    async update(userId, input) {
      const current = rows.get(userId);
      if (!current) throw new Error("missing");
      const next = { ...current, ...input, id: userId };
      rows.set(userId, next);
      return next;
    },
    async isUsernameAvailable(username, excludeUserId) {
      const owner = taken.get(username.trim().toLowerCase());
      if (!owner) return true;
      return Boolean(excludeUserId && owner === excludeUserId);
    },
    async upsertOwnProfile(userId, input) {
      const username = input.username?.toLowerCase() ?? null;
      if (username) {
        const owner = taken.get(username);
        if (owner && owner !== userId) {
          throw new Error("duplicate key value violates unique constraint");
        }
        taken.set(username, userId);
      }
      const profile: SessionUser = {
        id: userId,
        email: input.email ?? "",
        fullName: input.fullName ?? "",
        username,
        phone: input.phone ?? null,
        avatarUrl: input.avatarUrl ?? null,
        role: null,
        isOwner: false,
        isDemo: true,
      };
      rows.set(userId, profile);
      return profile;
    },
  };
}

const validSignup = {
  fullName: "Priya Sharma",
  email: "priya@example.com",
  username: "priya_s",
  password: "secret123",
  confirmPassword: "secret123",
};

describe("AuthService (demo mode)", () => {
  let profiles: ProfileRepository;
  let auth: AuthService;

  beforeEach(() => {
    profiles = memoryProfiles();
    auth = new AuthService(profiles);
  });

  it("creates a session immediately after signup", async () => {
    const user = await auth.signUp(validSignup);
    expect(user.email).toBe("priya@example.com");
    expect(user.username).toBe("priya_s");
    expect(user.fullName).toBe("Priya Sharma");
    expect(await auth.hasSession()).toBe(true);
    expect(JSON.stringify(user)).not.toMatch(/secret123/);
  });

  it("rejects a taken username", async () => {
    await auth.signUp(validSignup);
    await expect(
      auth.signUp({
        ...validSignup,
        email: "other@example.com",
        username: "PRIYA_S",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<AppError>);
  });

  it("rejects mismatched passwords", async () => {
    await expect(
      auth.signUp({ ...validSignup, confirmPassword: "other1234" })
    ).rejects.toMatchObject({ code: "VALIDATION" } satisfies Partial<AppError>);
  });

  it("signs in with email and password", async () => {
    const user = await auth.signIn({ email: "priya@example.com", password: "secret123" });
    expect(user.email).toBe("priya@example.com");
    expect(await auth.hasSession()).toBe(true);
  });

  it("does not expose the password on the session user", async () => {
    const user = await auth.signIn({ email: "a@b.com", password: "secret123" });
    expect("password" in user).toBe(false);
  });
});
