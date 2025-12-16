import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";
import { Prisma, prisma } from "@/server/db";
import { getTenantMode, updateTenantMode } from "@/lib/tenantMode";

export const dynamic = "force-dynamic";

const VALID_MODES = Object.keys(SYSTEM_MODES) as SystemModeName[];

function getWriteGate() {
  const testsDisabled =
    process.env.TESTS_DISABLED_IN_THIS_ENVIRONMENT === "true" ||
    process.env.testsDisabledInThisEnvironment === "true";
  const hostingOnVercel =
    process.env.HOSTING_ON_VERCEL === "true" ||
    process.env["hosting-on-vercel"] === "true" ||
    process.env.VERCEL === "1";

  if (testsDisabled) {
    return { locked: true, reason: "Test and mutation APIs are disabled in this environment." } as const;
  }

  if (hostingOnVercel) {
    return { locked: true, reason: "Mutations are disabled while hosting on Vercel." } as const;
  }

  return { locked: false, reason: null } as const;
}

function handleSchemaMismatch(warnings: string[], fallbackMode: SystemModeName = "pilot") {
  warnings.push("schema-mismatch");
  return fallbackMode;
}

function parseMode(raw: unknown): SystemModeName | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.trim().toLowerCase();
  return VALID_MODES.includes(normalized as SystemModeName)
    ? (normalized as SystemModeName)
    : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const warnings: string[] = [];

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenantExists) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const mode = await getTenantMode(tenantId).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return handleSchemaMismatch(warnings);
    }

    throw error;
  });

  return NextResponse.json({ tenantId, mode, warnings });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const warnings: string[] = [];

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const writeGate = getWriteGate();
  if (writeGate.locked) {
    return NextResponse.json(
      { error: writeGate.reason ?? "Mutations are disabled", warnings: ["write-locked"] },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode = parseMode(body?.mode);

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updated = await updateTenantMode(tenantId, mode).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return handleSchemaMismatch(warnings, mode);
    }

    throw error;
  });

  return NextResponse.json({ tenant: updated, warnings });
}
