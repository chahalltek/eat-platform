<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { NextResponse, type NextRequest } from "next/server";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getTenantTestRunnerCatalog } from "@/lib/testing/testCatalog";
=======
=======
>>>>>>> theirs
import { NextRequest, NextResponse } from "next/server";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getAdminTestingCatalog } from "@/lib/admin/testing/catalog";

const CACHE_CONTROL_VALUE = "private, max-age=300";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const response = NextResponse.json(getAdminTestingCatalog());

  response.headers.set("Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("CDN-Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("Vercel-CDN-Cache-Control", CACHE_CONTROL_VALUE);

  return response;
}
=======
export { GET } from "../../ete/tests/route";
>>>>>>> theirs
