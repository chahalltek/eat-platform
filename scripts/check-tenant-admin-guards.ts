import { scanForForbiddenGuards } from "../src/lib/ci/tenantAdminGuard";

const TARGET_DIRECTORIES = ["src/app/admin/tenant", "src/app/api/admin/tenant"];
const FORBIDDEN_GUARDS = ["requireTenantAdmin"];

const findings = scanForForbiddenGuards(TARGET_DIRECTORIES, FORBIDDEN_GUARDS);

if (findings.length) {
  console.error("Use requireGlobalOrTenantAdmin for Option A behavior.\n");
  findings.forEach((finding) => {
    console.error(`- ${finding.file}:${finding.line} — ${finding.match}`);
  });
  process.exit(1);
}

console.log("No forbidden tenant admin guards found in admin tenant routes.");
