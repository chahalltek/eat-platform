import { ETEClientLayout } from "@/components/ETEClientLayout";

import { CandidatesClient } from "./CandidatesClient";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-4">
      <CandidatesClient />
    </ETEClientLayout>
  );
}
