import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canManageDecisions, canViewFulfillment } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

import { FulfillmentNav } from "./FulfillmentNav";

type FulfillmentLayoutProps = {
  children: ReactNode;
};

export default async function FulfillmentLayout({ children }: FulfillmentLayoutProps) {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()]);

  const fulfillmentVisible = canViewFulfillment(user, tenantId);

  if (!fulfillmentVisible) {
    return notFound();
  }

  const decisionsVisible = canManageDecisions(user, tenantId);

  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="pt-0">
      <div className="flex gap-8">
        <FulfillmentNav canViewFulfillmentNav={fulfillmentVisible} showDecisions={decisionsVisible} />
        <div className="flex-1 space-y-6 pb-12">{children}</div>
      </div>
    </ETEClientLayout>
  );
}
