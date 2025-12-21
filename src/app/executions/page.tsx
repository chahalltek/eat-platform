import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgentRunsPageContent } from "@/app/agents/runs/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Execution history",
};

export default function ExecutionsPage({
  searchParams,
}: { searchParams?: { status?: string; range?: string } } = {}) {
  redirect("/agents/runs");

  return null;
}
