import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { isAdminRole } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ message: "Seeding endpoint not enabled in this environment" }, { status: 501 });
}
