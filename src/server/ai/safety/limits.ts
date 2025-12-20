export const MAX_CONTEXT_CHARS = 40_000;
export const MAX_FIELD_CHARS = 4_000;
export const MAX_CANDIDATES = 50;

export type SafeLLMMetadata = {
  freeText?: string | null;
  [key: string]: unknown;
};

export type SafeJobContext = {
  title?: string;
  description?: string | null;
  requirements?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type SafeCandidateContext = {
  name?: string;
  summary?: string | null;
  certifications?: string[];
  skills?: string[];
  notes?: string | null;
  experience?: string | null;
  highlights?: string[];
  [key: string]: unknown;
};

export type SafeLLMContext = {
  metadata?: SafeLLMMetadata;
  domainTags?: string[];
  skillsPreferred?: string[];
  job?: SafeJobContext;
  candidates?: SafeCandidateContext[];
  [key: string]: unknown;
};

function truncateString(value: string): string {
  return value.length > MAX_FIELD_CHARS ? value.slice(0, MAX_FIELD_CHARS) : value;
}

function cloneWithTruncation<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cloneWithTruncation(entry)) as unknown as T;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, val]) => {
        acc[key] = cloneWithTruncation(val);
        return acc;
      },
      {} as Record<string, unknown>,
    );

    return entries as T;
  }

  return value;
}

function currentSize(ctx: SafeLLMContext): number {
  return JSON.stringify(ctx).length;
}

function dropMetadataFreeText(ctx: SafeLLMContext): boolean {
  if (!ctx.metadata || ctx.metadata.freeText == null) {
    return false;
  }

  const { freeText, ...rest } = ctx.metadata;
  ctx.metadata = Object.keys(rest).length ? rest : undefined;
  return true;
}

function dropDomainTags(ctx: SafeLLMContext): boolean {
  if (!ctx.domainTags?.length) {
    return false;
  }

  ctx.domainTags = undefined;
  return true;
}

function dropSkillsPreferred(ctx: SafeLLMContext): boolean {
  if (!ctx.skillsPreferred?.length) {
    return false;
  }

  ctx.skillsPreferred = undefined;
  return true;
}

function dropCandidateCertifications(ctx: SafeLLMContext): boolean {
  if (!ctx.candidates?.length) {
    return false;
  }

  let updated = false;
  ctx.candidates = ctx.candidates.map((candidate) => {
    if (!candidate.certifications?.length) {
      return candidate;
    }

    const { certifications, ...rest } = candidate;
    updated = true;
    return rest;
  });

  return updated;
}

function dropCandidateSkills(ctx: SafeLLMContext): boolean {
  if (!ctx.candidates?.length) {
    return false;
  }

  let updated = false;
  ctx.candidates = ctx.candidates.map((candidate) => {
    if (!candidate.skills?.length) {
      return candidate;
    }

    const { skills, ...rest } = candidate;
    updated = true;
    return rest;
  });

  return updated;
}

function dropCandidateSummaries(ctx: SafeLLMContext): boolean {
  if (!ctx.candidates?.length) {
    return false;
  }

  let updated = false;
  ctx.candidates = ctx.candidates.map((candidate) => {
    if (!candidate.summary) {
      return candidate;
    }

    const { summary, ...rest } = candidate;
    updated = true;
    return rest;
  });

  return updated;
}

function dropJobDescription(ctx: SafeLLMContext): boolean {
  if (!ctx.job || ctx.job.description == null) {
    return false;
  }

  const { description, ...rest } = ctx.job;
  ctx.job = Object.keys(rest).length ? rest : undefined;
  return true;
}

const DROP_STEPS: Array<(ctx: SafeLLMContext) => boolean> = [
  dropMetadataFreeText,
  dropDomainTags,
  dropSkillsPreferred,
  dropCandidateCertifications,
  dropCandidateSkills,
  dropCandidateSummaries,
  dropJobDescription,
];

export function enforceLimits(ctx: SafeLLMContext): SafeLLMContext {
  const truncatedContext = cloneWithTruncation(ctx);

  if (truncatedContext.candidates?.length && truncatedContext.candidates.length > MAX_CANDIDATES) {
    truncatedContext.candidates = truncatedContext.candidates.slice(0, MAX_CANDIDATES);
  }

  let size = currentSize(truncatedContext);

  for (const dropStep of DROP_STEPS) {
    if (size <= MAX_CONTEXT_CHARS) {
      break;
    }

    const changed = dropStep(truncatedContext);
    if (changed) {
      size = currentSize(truncatedContext);
    }
  }

  while (size > MAX_CONTEXT_CHARS && truncatedContext.candidates?.length) {
    truncatedContext.candidates = truncatedContext.candidates.slice(0, truncatedContext.candidates.length - 1);
    size = currentSize(truncatedContext);
  }

  if (size > MAX_CONTEXT_CHARS) {
    const keys = Object.keys(truncatedContext).sort();

    for (const key of keys) {
      if (size <= MAX_CONTEXT_CHARS) {
        break;
      }

      delete (truncatedContext as Record<string, unknown>)[key];
      size = currentSize(truncatedContext);
    }
  }

  return truncatedContext;
}
