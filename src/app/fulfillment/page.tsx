import { redirect } from "next/navigation";

import { normalizeSearchParamValue, resolveDeepLinkDestination } from "@/lib/routing/deepLink";

type FulfillmentPageProps = {
  searchParams?: {
    jobId?: string | string[];
    candidateId?: string | string[];
    from?: string | string[];
    returnUrl?: string | string[];
  };
};

export default function FulfillmentPage({ searchParams }: FulfillmentPageProps) {
  const destination = resolveDeepLinkDestination({
    jobId: normalizeSearchParamValue(searchParams?.jobId),
    candidateId: normalizeSearchParamValue(searchParams?.candidateId),
    from: normalizeSearchParamValue(searchParams?.from),
    returnUrl: normalizeSearchParamValue(searchParams?.returnUrl),
  });

  redirect(destination);
}
