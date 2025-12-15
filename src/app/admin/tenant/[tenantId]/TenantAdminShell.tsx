import type { PropsWithChildren } from "react";

import { ETEClientLayout } from "@/components/ETEClientLayout";

import { BootstrapAccessBanner } from "./BootstrapAccessBanner";
import { TenantAdminNav } from "./TenantAdminNav";

type TenantAdminShellProps = PropsWithChildren<{
  tenantId: string;
  bootstrapTenantId?: string | null;
}>;

export function TenantAdminShell({ tenantId, bootstrapTenantId, children }: TenantAdminShellProps) {
  const isBootstrapTenant = bootstrapTenantId && bootstrapTenantId === tenantId;

  return (
    <ETEClientLayout contentClassName="pt-0">
      <div className="flex gap-8">
        <TenantAdminNav tenantId={tenantId} />
        <div className="flex-1 space-y-6 pb-12">
          {isBootstrapTenant ? <BootstrapAccessBanner tenantId={bootstrapTenantId} /> : null}
          {children}
        </div>
      </div>
    </ETEClientLayout>
  );
}
