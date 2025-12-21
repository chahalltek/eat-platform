import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Execution history (Agent runs)",
};

export default function ExecutionsPage() {
  redirect("/agents/runs");
}