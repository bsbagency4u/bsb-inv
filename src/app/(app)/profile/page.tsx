"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/states/loading-state";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";
import { userProfileSchema, type UserProfileValues } from "@/lib/validation/schemas";
import { getBusinessType } from "@/config/business-types";

export default function ProfilePage() {
  const { user, business, status, refresh } = useSession();
  const { success: toastSuccess, error: toastError } = useToast();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      avatarUrl: user?.avatarUrl ?? "",
    },
  });

  if (status === "loading" || !user) {
    return <LoadingState label="Loading profile…" />;
  }

  const submit = async (values: UserProfileValues) => {
    setServerError(null);
    try {
      await getClientServices().profiles.updateProfile(user.id, values);
      await refresh();
      toastSuccess("Profile updated", "Your profile changes were saved.");
    } catch (error) {
      const normalized = normalizeError(error);
      setServerError(normalized.userMessage);
      toastError("Could not save profile", normalized.userMessage);
    }
  };

  const type = business ? getBusinessType(business.type) : null;

  return (
    <div>
      <PageHeader title="My profile" description="Manage your personal information." />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {serverError ? (
          <Alert variant="error" title="Could not save">
            <p>{serverError}</p>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Account summary</CardTitle>
            <CardDescription>Your access and current business.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={user.fullName} src={user.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-foreground">{user.fullName}</p>
                  <Badge variant={user.isOwner ? "success" : "secondary"}>
                    {user.isOwner ? "Owner" : "Member"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
                {business ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {business.name}
                    {type ? ` · ${type.label}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>Sensitive authentication data is never shown.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
              <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
                <Input id="fullName" {...register("fullName")} invalid={Boolean(errors.fullName)} />
              </Field>
              <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                <Input id="phone" placeholder="+91 …" {...register("phone")} invalid={Boolean(errors.phone)} />
              </Field>
              <Field label="Avatar URL" htmlFor="avatarUrl" error={errors.avatarUrl?.message} hint="Optional image URL for your avatar.">
                <Input id="avatarUrl" placeholder="https://…" {...register("avatarUrl")} invalid={Boolean(errors.avatarUrl)} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting}>
                  <Save className="size-4" />
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
