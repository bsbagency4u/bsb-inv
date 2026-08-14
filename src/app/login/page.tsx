"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes } from "lucide-react";
import { getClientServices } from "@/services";
import { useSession } from "@/components/providers/session-provider";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginSchema, type LoginValues } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { normalizeError } from "@/lib/errors";
import { SITE } from "@/config/site";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const demoMode = !isSupabaseConfigured();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues & { fullName?: string }>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const submit = async (values: LoginValues & { fullName?: string }) => {
    setServerError(null);
    const services = getClientServices();
    try {
      if (mode === "login") {
        await services.auth.signIn({ email: values.email, password: values.password });
      } else {
        await services.auth.signUp({
          email: values.email,
          password: values.password,
          fullName: values.fullName ?? "",
        });
      }
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      const normalized = normalizeError(error);
      setServerError(normalized.userMessage);
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
                ? "Sign in to your workspace."
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
                <Alert variant="error" title="Could not sign in">
                  <p>{serverError}</p>
                </Alert>
              </div>
            ) : null}

            <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
              {mode === "signup" ? (
                <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
                  <Input id="fullName" placeholder="Your name" {...register("fullName")} invalid={Boolean(errors.fullName)} />
                </Field>
              ) : null}
              <Field label="Email" htmlFor="email" required error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} invalid={Boolean(errors.email)} />
              </Field>
              <Field label="Password" htmlFor="password" required error={errors.password?.message}>
                <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" {...register("password")} invalid={Boolean(errors.password)} />
              </Field>
              <Button type="submit" className="w-full" loading={isSubmitting}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>
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
