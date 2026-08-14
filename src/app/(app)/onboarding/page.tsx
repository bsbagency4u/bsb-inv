"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { BusinessProfileForm } from "@/components/business/business-profile-form";
import { LoadingState } from "@/components/states/loading-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { BusinessProfileValues } from "@/lib/validation/schemas";

export default function OnboardingPage() {
  const { user, business, status, refresh, isDemo } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (business) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Business already set up</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{business.name}</span> is your active
              business. You can edit its profile any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
            <Button variant="outline" onClick={() => router.push("/settings/business")}>
              Edit business
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (values: BusinessProfileValues) => {
    if (!user) return;
    await getClientServices().businesses.createBusiness(user.id, values);
    await refresh();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface px-6 py-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Set up your business</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Tell us about your business. Your business type decides which product
          attributes and modules become available.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Badge variant="success">Step 1: Business profile</Badge>
          {isDemo ? (
            <Badge variant="warning">Demo mode — data stays in this browser</Badge>
          ) : null}
        </div>
      </div>
      <div className="mx-auto max-w-3xl p-6">
        {isDemo ? (
          <div className="mb-6">
            <Alert variant="info" title="You are in demo mode">
              <p>
                No Supabase environment is configured, so your business is saved in this browser
                only. Connect Supabase in <code className="rounded bg-muted px-1">.env.local</code>{" "}
                to persist data to the cloud.
              </p>
            </Alert>
          </div>
        ) : null}
        <BusinessProfileForm
          onSubmit={handleSubmit}
          submitLabel="Create business"
        />
      </div>
    </div>
  );
}
