import type { PropsWithChildren } from "react";

import { ETEClientLayout } from "@/components/ETEClientLayout";

import { TenantAdminNav } from "./TenantAdminNav";

type TenantAdminShellProps = PropsWithChildren<{
  tenantId: string;
}>;

export function TenantAdminShell({ tenantId, children }: TenantAdminShellProps) {
  return (
    <ETEClientLayout contentClassName="pt-0">
      <div className="flex gap-8">
        <TenantAdminNav tenantId={tenantId} />
        <div className="flex-1 pb-12">{children}</div>
      </div>
    </ETEClientLayout>
  );
}
