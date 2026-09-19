"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes } from "lucide-react";
import { getClientServices } from "@/services";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { normalizeError } from "@/lib/errors";
import { SITE } from "@/config/site";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const submit = async (values: ResetPasswordValues) => {
    setServerError(null);
    try {
      await getClientServices().auth.updatePassword(values);
      router.replace("/login");
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
            <CardTitle className="text-base">Choose a new password</CardTitle>
            <CardDescription>Enter a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {serverError ? (
              <div className="mb-4">
                <Alert variant="error" title="Could not update password">
                  <p>{serverError}</p>
                </Alert>
              </div>
            ) : null}
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
              <Field
                label="New password"
                htmlFor="password"
                required
                error={form.formState.errors.password?.message}
                hint="At least 8 characters."
              >
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  {...form.register("password")}
                  invalid={Boolean(form.formState.errors.password)}
                />
              </Field>
              <Field
                label="Confirm password"
                htmlFor="confirm-password"
                required
                error={form.formState.errors.confirmPassword?.message}
              >
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  {...form.register("confirmPassword")}
                  invalid={Boolean(form.formState.errors.confirmPassword)}
                />
              </Field>
              <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
                Update password
              </Button>
            </form>
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
