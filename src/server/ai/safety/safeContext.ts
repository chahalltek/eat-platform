export type SafeLLMPurpose =
  | "MATCH"
  | "EXPLAIN"
  | "SHORTLIST"
  | "INTAKE"
  | "PROFILE"
  | "CONFIDENCE"
  | "GOVERNANCE"
  | "OTHER";

export type SafeJobContext = {
  title?: string;
  skillsRequired?: string[];
  skillsPreferred?: string[];
  seniority?: string;
  locationRegion?: string;
  workMode?: string;
  compBand?: string;
  startDateWindow?: string;
  domainTags?: string[];
};

export type SafeCandidateContext = {
  skills?: string[];
  titles?: string[];
  seniority?: string;
  yearsExperience?: number;
  certifications?: string[];
  locationRegion?: string;
  workAuthorization?: string;
  availabilityWindow?: string;
  compBand?: string;
  domainTags?: string[];
};

export type SafeTenantContext = {
  name?: string;
  domainTags?: string[];
};

export type SafeLLMMetadata = {
  requestId?: string;
  correlationId?: string;
};

export type SafeLLMContext = {
  purpose: SafeLLMPurpose;
  job?: SafeJobContext;
  candidates?: SafeCandidateContext[];
  tenant?: SafeTenantContext;
  metadata?: SafeLLMMetadata;
};

export type SafeLLMContextInput = Partial<SafeLLMContext> & Record<string, unknown>;

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.map((entry) => (typeof entry === "string" ? entry : String(entry))).filter(Boolean);

  return filtered.length ? filtered : undefined;
}

function sanitizeJobContext(job: unknown): SafeJobContext | undefined {
  if (!job || typeof job !== "object") return undefined;

  const context: SafeJobContext = {};
  const source = job as Record<string, unknown>;

  if (typeof source.title === "string") context.title = source.title;
  context.skillsRequired = sanitizeStringArray(source.skillsRequired);
  context.skillsPreferred = sanitizeStringArray(source.skillsPreferred);
  if (typeof source.seniority === "string") context.seniority = source.seniority;
  if (typeof source.locationRegion === "string") context.locationRegion = source.locationRegion;
  if (typeof source.workMode === "string") context.workMode = source.workMode;
  if (typeof source.compBand === "string") context.compBand = source.compBand;
  if (typeof source.startDateWindow === "string") context.startDateWindow = source.startDateWindow;
  context.domainTags = sanitizeStringArray(source.domainTags);

  return Object.keys(context).length ? context : undefined;
}

function sanitizeCandidateContext(candidate: unknown): SafeCandidateContext | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;

  const source = candidate as Record<string, unknown>;
  const context: SafeCandidateContext = {};

  context.skills = sanitizeStringArray(source.skills);
  context.titles = sanitizeStringArray(source.titles);
  if (typeof source.seniority === "string") context.seniority = source.seniority;
  if (typeof source.yearsExperience === "number") context.yearsExperience = source.yearsExperience;
  context.certifications = sanitizeStringArray(source.certifications);
  if (typeof source.locationRegion === "string") context.locationRegion = source.locationRegion;
  if (typeof source.workAuthorization === "string") context.workAuthorization = source.workAuthorization;
  if (typeof source.availabilityWindow === "string") context.availabilityWindow = source.availabilityWindow;
  if (typeof source.compBand === "string") context.compBand = source.compBand;
  context.domainTags = sanitizeStringArray(source.domainTags);

  return Object.keys(context).length ? context : undefined;
}

function sanitizeTenantContext(tenant: unknown): SafeTenantContext | undefined {
  if (!tenant || typeof tenant !== "object") return undefined;

  const source = tenant as Record<string, unknown>;
  const context: SafeTenantContext = {};

  if (typeof source.name === "string") context.name = source.name;
  context.domainTags = sanitizeStringArray(source.domainTags);

  return Object.keys(context).length ? context : undefined;
}

function sanitizeMetadata(metadata: unknown): SafeLLMMetadata | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;

  const source = metadata as Record<string, unknown>;
  const safeMetadata: SafeLLMMetadata = {};

  if (typeof source.requestId === "string") safeMetadata.requestId = source.requestId;
  if (typeof source.correlationId === "string") safeMetadata.correlationId = source.correlationId;

  return Object.keys(safeMetadata).length ? safeMetadata : undefined;
}

function resolvePurpose(value: unknown): SafeLLMPurpose {
  const allowed: SafeLLMPurpose[] = [
    "MATCH",
    "EXPLAIN",
    "SHORTLIST",
    "INTAKE",
    "PROFILE",
    "CONFIDENCE",
    "GOVERNANCE",
    "OTHER",
  ];

  return allowed.includes(value as SafeLLMPurpose) ? (value as SafeLLMPurpose) : "OTHER";
}

export function buildSafeLLMContext(input: SafeLLMContextInput): SafeLLMContext {
  const purpose = resolvePurpose(input?.purpose);
  const job = sanitizeJobContext(input?.job);
  const candidatesInput = Array.isArray(input?.candidates) ? input?.candidates : undefined;
  const candidates = candidatesInput?.map(sanitizeCandidateContext).filter(Boolean) as SafeCandidateContext[] | undefined;
  const tenant = sanitizeTenantContext(input?.tenant);
  const metadata = sanitizeMetadata(input?.metadata);

  const safeContext: SafeLLMContext = { purpose };

  if (job) safeContext.job = job;
  if (candidates?.length) safeContext.candidates = candidates;
  if (tenant) safeContext.tenant = tenant;
  if (metadata) safeContext.metadata = metadata;

  return safeContext;
}
