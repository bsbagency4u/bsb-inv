"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/session-provider";
import { getClientServices } from "@/services";
import { BusinessProfileForm } from "@/components/business/business-profile-form";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/states/loading-state";
import type { BusinessProfileValues } from "@/lib/validation/schemas";

export default function BusinessSettingsPage() {
  const { user, business, status, refresh } = useSession();

  if (status === "loading") {
    return <LoadingState label="Loading business…" />;
  }

  const handleSubmit = async (values: BusinessProfileValues) => {
    if (!user || !business) return;
    await getClientServices().businesses.updateBusiness(user.id, business.id, values);
    await refresh();
  };

  if (!business) {
    return (
      <div>
        <PageHeader title="Business" description="Business profile settings." />
        <div className="p-6">
          <Alert variant="warning" title="No business yet">
            <p>
              You have not set up a business yet.{" "}
              <Link href="/onboarding" className="font-medium underline">
                Complete setup
              </Link>
              .
            </p>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business"
        description={`Edit the profile for ${business.name}.`}
      />
      <div className="mx-auto max-w-3xl p-6">
        <BusinessProfileForm business={business} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
