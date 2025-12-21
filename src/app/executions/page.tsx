import type { Metadata } from "next";

import { AgentRunsPageContent } from "@/app/agents/runs/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Execution history",
};

export default async function ExecutionsPage({ searchParams }: { searchParams?: { status?: string; range?: string } }) {
  return AgentRunsPageContent({ searchParams, currentPathOverride: "/executions" });
}
