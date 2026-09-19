"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes } from "lucide-react";
import { getClientServices } from "@/services";
import { useSession } from "@/components/providers/session-provider";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginSchema, signupSchema, type LoginValues, type SignupValues } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { normalizeError } from "@/lib/errors";
import { SITE } from "@/config/site";

export default function LoginPage() {
  const router = useRouter();
  const { status, refresh, business } = useSession();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const demoMode = React.useSyncExternalStore(
    () => () => {},
    () => !isSupabaseConfigured(),
    () => false
  );

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", username: "", password: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace(business ? "/dashboard" : "/onboarding");
    }
  }, [status, business, router]);

  const submitLogin = async (values: LoginValues) => {
    setServerError(null);
    try {
      await getClientServices().auth.signIn(values);
      await refresh();
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(normalizeError(error).userMessage);
    }
  };

  const submitSignup = async (values: SignupValues) => {
    setServerError(null);
    try {
      await getClientServices().auth.signUp(values);
      await refresh();
      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      setServerError(normalizeError(error).userMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Boxes className="size-6" />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-foreground">{SITE.name}</h1>
          <p className="text-sm text-muted-foreground">{SITE.tagline}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="mb-1 flex gap-1 rounded-lg bg-muted p-1">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setServerError(null);
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <CardTitle className="text-base">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in with your email and password."
                : "Register to start managing your business."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {demoMode ? (
              <div className="mb-4">
                <Alert variant="info" title="Demo mode">
                  <p>
                    Supabase is not configured, so any credentials (min. password length applies)
                    sign you into a local demo workspace.
                  </p>
                </Alert>
              </div>
            ) : null}

            {serverError ? (
              <div className="mb-4">
                <Alert variant="error" title={mode === "signup" ? "Could not create account" : "Could not sign in"}>
                  <p>{serverError}</p>
                </Alert>
              </div>
            ) : null}

            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(submitLogin)} className="space-y-4" noValidate>
                <Field label="Email" htmlFor="email" required error={loginForm.formState.errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...loginForm.register("email")}
                    invalid={Boolean(loginForm.formState.errors.email)}
                  />
                </Field>
                <Field label="Password" htmlFor="password" required error={loginForm.formState.errors.password?.message}>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...loginForm.register("password")}
                    invalid={Boolean(loginForm.formState.errors.password)}
                  />
                </Field>
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" className="w-full" loading={loginForm.formState.isSubmitting}>
                  Sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={signupForm.handleSubmit(submitSignup)} className="space-y-4" noValidate>
                <Field label="Full name" htmlFor="fullName" required error={signupForm.formState.errors.fullName?.message}>
                  <Input
                    id="fullName"
                    placeholder="Your name"
                    autoComplete="name"
                    {...signupForm.register("fullName")}
                    invalid={Boolean(signupForm.formState.errors.fullName)}
                  />
                </Field>
                <Field label="Email" htmlFor="signup-email" required error={signupForm.formState.errors.email?.message}>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...signupForm.register("email")}
                    invalid={Boolean(signupForm.formState.errors.email)}
                  />
                </Field>
                <Field
                  label="Username"
                  htmlFor="username"
                  required
                  error={signupForm.formState.errors.username?.message}
                  hint="3–24 characters. Letters, numbers and underscores."
                >
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder="yourname"
                    {...signupForm.register("username")}
                    invalid={Boolean(signupForm.formState.errors.username)}
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="signup-password"
                  required
                  error={signupForm.formState.errors.password?.message}
                  hint="At least 8 characters."
                >
                  <PasswordInput
                    id="signup-password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...signupForm.register("password")}
                    invalid={Boolean(signupForm.formState.errors.password)}
                  />
                </Field>
                <Field
                  label="Confirm password"
                  htmlFor="confirm-password"
                  required
                  error={signupForm.formState.errors.confirmPassword?.message}
                >
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...signupForm.register("confirmPassword")}
                    invalid={Boolean(signupForm.formState.errors.confirmPassword)}
                  />
                </Field>
                <Button type="submit" className="w-full" loading={signupForm.formState.isSubmitting}>
                  Create account
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {SITE.name} · Phase 1 foundation
          {demoMode ? <Badge variant="warning" className="ml-2">Demo mode</Badge> : null}
        </p>
      </div>
    </div>
  );
}
