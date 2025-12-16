import path from "node:path";
import { describe, it } from "vitest";
import { scanForForbiddenGuards } from "./tenantAdminGuard";

describe("admin tenant routes avoid strict tenant-admin checks", () => {
  const TARGET_FOLDERS = [
    path.join(process.cwd(), "src/app/api/admin/tenant"),
    path.join(process.cwd(), "src/app/admin/tenant"),
  ];

  const FORBIDDEN_GUARDS = ["requireTenantAdmin"];

  it("forbids requireTenantAdmin usage", () => {
    const offenders = scanForForbiddenGuards(TARGET_FOLDERS, FORBIDDEN_GUARDS);

    if (offenders.length) {
      const listing = offenders
        .map((finding) => ` - ${finding.file}:${finding.line} — ${finding.match}`)
        .join("\n");
      throw new Error(`Use requireGlobalOrTenantAdmin for Option A behavior.\nFound requireTenantAdmin in:\n${listing}`);
    }
  });
});
