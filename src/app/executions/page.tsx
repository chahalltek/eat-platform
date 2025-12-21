import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ExecutionsPage() {
  redirect("/agents/runs");
}
