"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes } from "lucide-react";
import { getClientServices } from "@/services";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { normalizeError } from "@/lib/errors";
import { SITE } from "@/config/site";

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const submit = async (values: ForgotPasswordValues) => {
    setServerError(null);
    try {
      await getClientServices().auth.requestPasswordReset(values);
      setSent(true);
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
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reset your password</CardTitle>
            <CardDescription>
              Enter the email on your account. If it exists, we will send a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <Alert variant="info" title="Check your inbox">
                <p>If an account exists for that email, a password reset link has been sent.</p>
              </Alert>
            ) : (
              <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
                {serverError ? (
                  <Alert variant="error" title="Could not send reset email">
                    <p>{serverError}</p>
                  </Alert>
                ) : null}
                <Field label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...form.register("email")}
                    invalid={Boolean(form.formState.errors.email)}
                  />
                </Field>
                <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
                  Send reset link
                </Button>
              </form>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
