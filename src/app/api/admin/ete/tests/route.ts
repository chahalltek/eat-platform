import { NextResponse, type NextRequest } from "next/server";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getEteTestCatalog } from "@/lib/ete/testCatalog";

export { POST } from "../../testing/route";

const CACHE_CONTROL_VALUE = "private, max-age=300";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = getEteTestCatalog();
  const response = NextResponse.json(catalog);

  response.headers.set("Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("CDN-Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("Vercel-CDN-Cache-Control", CACHE_CONTROL_VALUE);

  return response;
}
