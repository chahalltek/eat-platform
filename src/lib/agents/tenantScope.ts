import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/server/db";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentTenantId, withTenantContext } from "@/lib/tenant";

export class TenantScopeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TenantScopeError";
    this.status = status;
  }
}

export async function getTenantScopedPrismaClient(req: NextRequest) {
  const tenantId = (await getCurrentTenantId(req))?.trim() || DEFAULT_TENANT_ID;

  if (!tenantId) {
    throw new TenantScopeError("Tenant is required", 400);
  }

  const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenantExists) {
    throw new TenantScopeError("Invalid tenant", 403);
  }

  return {
    prisma,
    tenantId,
    runWithTenantContext: async <T>(callback: () => Promise<T>) =>
      withTenantContext(tenantId, callback),
  } as const;
}

export function toTenantErrorResponse(error: unknown) {
  if (error instanceof TenantScopeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
