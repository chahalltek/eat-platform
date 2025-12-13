export type HiringOutcomeRecord = {
  jobId: string;
  candidateId: string;
  status: string;
  roleFamily?: string | null;
  createdAt?: Date;
};

export type DecisionStreamLink = {
  jobId: string;
  candidateId: string;
  decisionStreamId: string;
  action?: string;
  createdAt?: Date;
};

export type MatchAttribution = {
  jobId: string;
  candidateId: string;
  matchResultId?: string | null;
  decisionStreamId?: string | null;
  guardrailsPreset?: string | null;
  guardrailsConfigHash?: string | null;
  shortlistStrategy?: string | null;
  systemMode?: string | null;
  roleFamily?: string | null;
  createdAt?: Date;
};

export type LearningRecord = HiringOutcomeRecord & {
  decisionStreamId?: string | null;
  matchResultId?: string | null;
  guardrailsPreset?: string | null;
  guardrailsConfigHash?: string | null;
  shortlistStrategy?: string | null;
  systemMode?: string | null;
  capturedAt: Date;
};

export type GuardrailsAttribution = {
  preset: string;
  systemMode: string;
  shortlistStrategy: string;
  configHash: string;
  roleFamily: string;
  interviewRate: number;
  hireRate: number;
  falsePositiveRate: number;
  sampleSize: number;
  coverage: {
    interviewed: number;
    hired: number;
    rejected: number;
  };
  capturedAt: Date;
};

const INTERVIEW_STATUSES = new Set(["interviewed", "offered"]);
const HIRE_STATUSES = new Set(["hired"]);
const REJECTION_STATUSES = new Set(["rejected", "declined"]);

function buildIndex<T extends { jobId: string; candidateId: string; createdAt?: Date }>(entries: T[]) {
  return entries.reduce<Record<string, T>>((acc, entry) => {
    const key = `${entry.jobId}::${entry.candidateId}`;
    const current = acc[key];

    if (!current) {
      acc[key] = { ...entry };
      return acc;
    }

    const currentTimestamp = current.createdAt?.getTime() ?? -Infinity;
    const nextTimestamp = entry.createdAt?.getTime() ?? -Infinity;

    if (nextTimestamp > currentTimestamp) {
      acc[key] = { ...entry };
    }

    return acc;
  }, {});
}

export function buildLearningRecords(params: {
  outcomes: HiringOutcomeRecord[];
  matchResults?: MatchAttribution[];
  decisionItems?: DecisionStreamLink[];
  systemMode?: string | null;
  timestamp?: Date;
}): LearningRecord[] {
  const activeMode = params.systemMode?.trim();
  if (activeMode === "fire_drill") return [];

  const capturedAt = params.timestamp ?? new Date();
  const matchIndex = buildIndex(params.matchResults ?? []);
  const decisionIndex = buildIndex((params.decisionItems ?? []).filter((item) => item.action !== "removed"));

  return params.outcomes.flatMap((outcome) => {
    const key = `${outcome.jobId}::${outcome.candidateId}`;
    const match = matchIndex[key];
    const decision = decisionIndex[key];

    const systemMode = match?.systemMode ?? activeMode ?? null;
    if (systemMode === "fire_drill") return [];

    const record: LearningRecord = {
      ...outcome,
      decisionStreamId: match?.decisionStreamId ?? decision?.decisionStreamId,
      matchResultId: match?.matchResultId,
      guardrailsPreset: match?.guardrailsPreset,
      guardrailsConfigHash: match?.guardrailsConfigHash,
      shortlistStrategy: match?.shortlistStrategy,
      systemMode,
      roleFamily: match?.roleFamily ?? outcome.roleFamily,
      capturedAt,
    };

    return [record];
  });
}

function safeRate(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(2));
}

function normalize(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

export function attributeGuardrailsPerformance(params: {
  outcomes: HiringOutcomeRecord[];
  matchResults?: MatchAttribution[];
  decisionItems?: DecisionStreamLink[];
  systemMode?: string | null;
  timestamp?: Date;
}): GuardrailsAttribution[] {
  if (params.systemMode === "fire_drill") return [];

  const learningRecords = buildLearningRecords(params);
  const groups = new Map<string, LearningRecord[]>();

  for (const record of learningRecords) {
    const keyParts = [
      normalize(record.guardrailsPreset, "unknown"),
      normalize(record.systemMode, "unknown"),
      normalize(record.shortlistStrategy, "unknown"),
      normalize(record.guardrailsConfigHash, "unknown"),
      normalize(record.roleFamily, "unspecified"),
    ];

    const key = keyParts.join("::");
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }

  const summaries: GuardrailsAttribution[] = [];

  for (const [key, records] of groups.entries()) {
    const [preset, systemMode, shortlistStrategy, configHash, roleFamily] = key.split("::");
    const shortlisted = records.length;
    const interviewed = records.filter((record) => INTERVIEW_STATUSES.has(record.status)).length;
    const hired = records.filter((record) => HIRE_STATUSES.has(record.status)).length;
    const rejected = records.filter((record) => REJECTION_STATUSES.has(record.status)).length;

    summaries.push({
      preset,
      systemMode,
      shortlistStrategy,
      configHash,
      roleFamily,
      interviewRate: safeRate(interviewed, shortlisted),
      hireRate: safeRate(hired, shortlisted),
      falsePositiveRate: safeRate(rejected, shortlisted),
      sampleSize: shortlisted,
      coverage: { interviewed, hired, rejected },
      capturedAt: records[0]?.capturedAt ?? new Date(),
    });
  }

  return summaries.sort((a, b) => {
    const presetComparison = a.preset.localeCompare(b.preset);
    if (presetComparison !== 0) return presetComparison;

    const modeComparison = a.systemMode.localeCompare(b.systemMode);
    if (modeComparison !== 0) return modeComparison;

    const strategyComparison = a.shortlistStrategy.localeCompare(b.shortlistStrategy);
    if (strategyComparison !== 0) return strategyComparison;

    const roleFamilyComparison = a.roleFamily.localeCompare(b.roleFamily);
    if (roleFamilyComparison !== 0) return roleFamilyComparison;

    return a.configHash.localeCompare(b.configHash);
  });
}
