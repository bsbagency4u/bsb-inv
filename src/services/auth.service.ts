import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBrowserClient } from "@/lib/supabase/client";
import { AppError } from "@/lib/errors";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ChangePasswordValues,
  type ForgotPasswordValues,
  type LoginValues,
  type ResetPasswordValues,
  type SignupValues,
} from "@/lib/validation/schemas";
import type { SessionUser } from "@/types/domain";
import {
  clearDemoSession,
  getDemoSession,
  hasDemoSession,
  setDemoSession,
} from "@/lib/session/demo-session";
import { DEMO_USER } from "@/repositories/local/local-data";
import type { ProfileRepository } from "@/repositories/profile.repository";

function mapAuthUser(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  extras: Partial<SessionUser> = {}
): SessionUser {
  return {
    id: user.id,
    email: user.email ?? extras.email ?? "",
    fullName: extras.fullName ?? (user.user_metadata?.full_name as string) ?? "",
    username: extras.username ?? (user.user_metadata?.username as string) ?? null,
    phone: extras.phone ?? null,
    avatarUrl: extras.avatarUrl ?? (user.user_metadata?.avatar_url as string) ?? null,
    role: extras.role ?? null,
    isOwner: extras.isOwner ?? false,
    isDemo: extras.isDemo ?? false,
  };
}

function friendlyAuthError(error: { message: string; status?: number }): never {
  if (error.status === 400 || /invalid login credentials/i.test(error.message)) {
    throw AppError.auth("Invalid email or password.");
  }
  if (/already registered|user already exists/i.test(error.message)) {
    throw AppError.conflict("An account with this email already exists.");
  }
  if (/password/i.test(error.message) && (error.status === 422 || error.status === 400)) {
    throw AppError.unprocessable("Choose a stronger password (at least 8 characters).");
  }
  if (/rate limit|too many/i.test(error.message)) {
    throw AppError.unprocessable("Too many attempts. Please wait a moment and try again.");
  }
  throw AppError.auth("Could not complete that request. Please try again.");
}

/**
 * Authentication service. The only place that talks to the Supabase Auth API
 * from the client. Passwords are never stored, hashed, logged or returned.
 * In demo mode (no Supabase) it manages a clearly-marked local demo session.
 */
export class AuthService {
  constructor(private profiles?: ProfileRepository) {}

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
    if (!client) throw AppError.internal("Supabase client unavailable.");

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) friendlyAuthError(error);
    if (!data.user) throw AppError.auth("Sign-in did not return a user.");
    return mapAuthUser(data.user);
  }

  async signUp(input: SignupValues): Promise<SessionUser> {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw AppError.validation(first?.message ?? "Please fix the highlighted fields.");
    }
    const { email, password, fullName, username } = parsed.data;

    if (this.profiles && !(await this.profiles.isUsernameAvailable(username))) {
      throw AppError.conflict("That username is already taken.");
    }

    if (!isSupabaseConfigured()) {
      if (this.profiles) {
        await this.profiles.upsertOwnProfile(DEMO_USER.id, {
          fullName,
          email,
          username,
        });
      }
      setDemoSession({ userId: DEMO_USER.id, email, signedInAt: new Date().toISOString() });
      return { ...DEMO_USER, email, fullName, username };
    }

    const client = getBrowserClient();
    if (!client) throw AppError.internal("Supabase client unavailable.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) friendlyAuthError(error);
    if (!data.user) throw AppError.unprocessable("Sign-up did not return a user.");

    if (!data.session) {
      throw AppError.auth(
        "Account created, but no session was returned. Confirm email is still enabled in Supabase Auth."
      );
    }

    if (this.profiles) {
      try {
        await this.profiles.upsertOwnProfile(data.user.id, {
          fullName,
          email: data.user.email ?? email,
          username,
        });
      } catch (profileError) {
        const message = profileError instanceof Error ? profileError.message : "";
        if (/duplicate|unique/i.test(message)) {
          throw AppError.conflict("That username is already taken.");
        }
        throw AppError.internal("Account created, but the profile could not be saved. Please try again.");
      }
    }

    return mapAuthUser(data.user, { fullName, username, email });
  }

  async requestPasswordReset(input: ForgotPasswordValues): Promise<void> {
    const parsed = forgotPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
    }
    if (!isSupabaseConfigured()) {
      return;
    }
    const client = getBrowserClient();
    if (!client) throw AppError.internal("Supabase client unavailable.");
    const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) friendlyAuthError(error);
  }

  async updatePassword(input: ResetPasswordValues): Promise<void> {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
    }
    if (!isSupabaseConfigured()) {
      throw AppError.unprocessable("Password reset is not available in demo mode.");
    }
    const client = getBrowserClient();
    if (!client) throw AppError.internal("Supabase client unavailable.");
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) friendlyAuthError(error);
  }

  async changePassword(input: ChangePasswordValues): Promise<void> {
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
    }
    if (!isSupabaseConfigured()) {
      throw AppError.unprocessable("Password change is not available in demo mode.");
    }
    const client = getBrowserClient();
    if (!client) throw AppError.internal("Supabase client unavailable.");
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user?.email) throw AppError.auth("You need to be signed in to change your password.");
    const { error: reauthError } = await client.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });
    if (reauthError) throw AppError.auth("Current password is incorrect.");
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) friendlyAuthError(error);
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

  async hasSession(): Promise<boolean> {
    if (!isSupabaseConfigured()) return hasDemoSession();
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
    return mapAuthUser(user);
  }
}

export const authService = new AuthService();
