import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBrowserClient } from "@/lib/supabase/client";
import { AppError } from "@/lib/errors";
import { loginSchema, type LoginValues } from "@/lib/validation/schemas";
import type { SessionUser } from "@/types/domain";
import {
  clearDemoSession,
  getDemoSession,
  hasDemoSession,
  setDemoSession,
} from "@/lib/session/demo-session";
import { DEMO_USER } from "@/repositories/local/local-data";

/**
 * Authentication service. The only place that talks to the Supabase Auth API
 * from the client. In demo mode (no Supabase) it manages a clearly-marked
 * local demo session.
 */
export class AuthService {
  /**
   * Validates credentials and signs the user in.
   * Returns the authenticated session user.
   */
  async signIn(input: LoginValues): Promise<SessionUser> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw AppError.validation(first?.message ?? "Invalid credentials.");
    }

    const { email, password } = parsed.data;

    if (!isSupabaseConfigured()) {
      if (password.length < 6) {
        throw AppError.validation("Password must be at least 6 characters.");
      }
      setDemoSession({ userId: DEMO_USER.id, email, signedInAt: new Date().toISOString() });
      return { ...DEMO_USER, email };
    }

    const client = getBrowserClient();
    if (!client) {
      throw AppError.internal("Supabase client unavailable.");
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.status === 400 || /invalid login credentials/i.test(error.message)) {
        throw AppError.auth("Invalid email or password.");
      }
      if (/email.*not.*confirmed|confirm/i.test(error.message)) {
        throw AppError.auth("Please confirm your email before signing in.");
      }
      throw new AppError(error.message, { code: "AUTH", status: error.status ?? 401 });
    }

    const authUser = data.user;
    if (!authUser) throw AppError.auth("Sign-in did not return a user.");

    return {
      id: authUser.id,
      email: authUser.email ?? "",
      fullName: (authUser.user_metadata?.full_name as string) ?? "",
      phone: null,
      avatarUrl: (authUser.user_metadata?.avatar_url as string) ?? null,
      role: null,
      isOwner: false,
      isDemo: false,
    };
  }

  /**
   * Registers a new account. In demo mode this behaves like sign-in.
   */
  async signUp(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<SessionUser> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw AppError.validation("Enter a valid email address.");
    }
    if (input.password.length < 8) {
      throw AppError.validation("Password must be at least 8 characters.");
    }
    if (input.fullName.trim().length < 2) {
      throw AppError.validation("Full name is required.");
    }

    if (!isSupabaseConfigured()) {
      setDemoSession({ userId: DEMO_USER.id, email, signedInAt: new Date().toISOString() });
      return { ...DEMO_USER, email, fullName: input.fullName.trim() };
    }

    const client = getBrowserClient();
    if (!client) throw AppError.internal("Supabase client unavailable.");

    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        data: { full_name: input.fullName.trim() },
      },
    });

    if (error) {
      if (/already registered/i.test(error.message)) {
        throw AppError.conflict("An account with this email already exists.");
      }
      if (error.status === 422 || /password/i.test(error.message)) {
        throw AppError.unprocessable(error.message);
      }
      throw new AppError(error.message, { code: "UNPROCESSABLE", status: error.status ?? 422 });
    }

    if (!data.user) throw AppError.unprocessable("Sign-up did not return a user.");

    return {
      id: data.user.id,
      email: data.user.email ?? "",
      fullName: input.fullName.trim(),
      phone: null,
      avatarUrl: null,
      role: null,
      isOwner: false,
      isDemo: false,
    };
  }

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) {
      clearDemoSession();
      return;
    }
    const client = getBrowserClient();
    if (!client) return;
    await client.auth.signOut();
  }

  /**
   * Detects whether a session exists (Supabase auth session or demo session).
   */
  async hasSession(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return hasDemoSession();
    }
    const client = getBrowserClient();
    if (!client) return false;
    const {
      data: { session },
    } = await client.auth.getSession();
    return Boolean(session);
  }

  async getCurrentUser(): Promise<SessionUser | null> {
    if (!isSupabaseConfigured()) {
      const session = getDemoSession();
      if (!session) return null;
      return { ...DEMO_USER, email: session.email };
    }
    const client = getBrowserClient();
    if (!client) return null;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? "",
      fullName: (user.user_metadata?.full_name as string) ?? "",
      phone: null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      role: null,
      isOwner: false,
      isDemo: false,
    };
  }
}

export const authService = new AuthService();
