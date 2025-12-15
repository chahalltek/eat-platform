import { ETEClientLayout } from "@/components/ETEClientLayout";

import { CatalogPageClient } from "./CatalogPageClient";

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <main className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <CatalogPageClient />
        </div>
      </main>
    </ETEClientLayout>
  );
}
