type SearchParamValue = string | string[] | null | undefined;

function normalizeValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

export type DeepLinkParams = {
  jobId?: SearchParamValue;
  candidateId?: SearchParamValue;
  from?: SearchParamValue;
  returnUrl?: SearchParamValue;
};

export function resolveDeepLinkDestination({ jobId, candidateId, from, returnUrl }: DeepLinkParams) {
  const normalizedJobId = normalizeValue(jobId);
  const normalizedCandidateId = normalizeValue(candidateId);
  const normalizedFrom = normalizeValue(from);
  const normalizedReturnUrl = normalizeValue(returnUrl);

  const targetPath = normalizedJobId
    ? `/jobs/${normalizedJobId}`
    : normalizedCandidateId
      ? `/candidates/${normalizedCandidateId}`
      : "/dashboard";

  const params = new URLSearchParams();

  if (normalizedFrom) {
    params.set("from", normalizedFrom);
  }

  if (normalizedReturnUrl) {
    params.set("returnUrl", normalizedReturnUrl);
  }

  const query = params.toString();

  return query ? `${targetPath}?${query}` : targetPath;
}

export function normalizeSearchParamValue(value: SearchParamValue) {
  return normalizeValue(value);
}
