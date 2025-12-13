import { prisma } from "@/lib/prisma";
import { guardrailsPresets, type GuardrailsConfig, type GuardrailsPresetName } from "./presets";

export type GuardrailFeedbackRecord = {
  outcome: string;
  guardrailsPreset: string | null;
  guardrailsConfig: unknown;
  matchSignals: unknown;
  jobReqId: string;
  createdAt: Date;
  jobReqTitle?: string | null;
};

export type GuardrailThresholds = {
  minMatchScore?: number;
  shortlistMinScore?: number;
  shortlistMaxCandidates?: number;
};

export type PresetPerformance = {
  preset: GuardrailsPresetName | "unknown";
  totals: number;
  interviews: number;
  hires: number;
  shortlisted: number;
  falsePositives: number;
  interviewRate: number;
  hireRate: number;
  falsePositiveRate: number;
};

export type JobGuardrailAttribution = {
  jobReqId: string;
  title: string;
  guardrailsPreset: GuardrailsPresetName | "unknown";
  thresholds: GuardrailThresholds;
  updatedAt: string;
};

export type GuardrailPerformanceInsight = {
  role: string;
  bestPreset: GuardrailsPresetName | "unknown";
  comparedTo: GuardrailsPresetName | "unknown";
  delta: number;
  statement: string;
};

export type GuardrailPerformanceReport = {
  byPreset: PresetPerformance[];
  deltas: Array<{
    metric: "interviewRate" | "hireRate" | "falsePositiveRate";
    preset: GuardrailsPresetName | "unknown";
    comparedTo: GuardrailsPresetName;
    delta: number;
  }>;
  jobAttribution: JobGuardrailAttribution[];
  roleInsights: GuardrailPerformanceInsight[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseThresholds(config: unknown): GuardrailThresholds {
  if (!isRecord(config)) return {};
  const scoring = isRecord(config.scoring) ? config.scoring : null;
  const thresholds = scoring && isRecord(scoring.thresholds) ? scoring.thresholds : null;

  return {
    minMatchScore: parseNumber(thresholds?.minMatchScore),
    shortlistMinScore: parseNumber(thresholds?.shortlistMinScore),
    shortlistMaxCandidates: parseNumber(thresholds?.shortlistMaxCandidates),
  } satisfies GuardrailThresholds;
}

function extractGuardrailConfig(record: GuardrailFeedbackRecord): GuardrailThresholds {
  const guardrailConfig = record.guardrailsConfig ?? (isRecord(record.matchSignals) ? record.matchSignals.guardrailsConfig : null);

  const preset = (record.guardrailsPreset as GuardrailsPresetName | null) ?? null;
  const baseConfig: GuardrailsConfig | null = preset ? guardrailsPresets[preset] ?? null : null;

  const guardrailConfigRecord = isRecord(guardrailConfig) ? guardrailConfig : null;
  const guardrailScoring = guardrailConfigRecord && isRecord(guardrailConfigRecord.scoring) ? guardrailConfigRecord.scoring : null;

  const mergedConfig = baseConfig && guardrailConfigRecord
    ? ({
        ...baseConfig,
        scoring: {
          ...(baseConfig.scoring ?? {}),
          ...(guardrailScoring ?? {}),
        },
      } as GuardrailsConfig)
    : baseConfig ?? null;

  return parseThresholds(mergedConfig ?? guardrailConfigRecord);
}

function calculateRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function formatPresetName(preset: GuardrailsPresetName | "unknown") {
  return preset === "unknown" ? "Unknown" : `${preset.charAt(0).toUpperCase()}${preset.slice(1)}`;
}

export function summarizeGuardrailPerformance(records: GuardrailFeedbackRecord[]): GuardrailPerformanceReport {
  const presetStats = new Map<GuardrailsPresetName | "unknown", {
    totals: number;
    interviews: number;
    hires: number;
    shortlisted: number;
    falsePositives: number;
  }>();
  const jobMap = new Map<string, JobGuardrailAttribution>();
  const roleMap = new Map<string, Map<GuardrailsPresetName | "unknown", { hires: number; totals: number }>>();

  for (const record of records) {
    const preset = ((record.guardrailsPreset as GuardrailsPresetName | null) ?? "unknown") as GuardrailsPresetName | "unknown";
    const stats = presetStats.get(preset) ?? {
      totals: 0,
      interviews: 0,
      hires: 0,
      shortlisted: 0,
      falsePositives: 0,
    };

    stats.totals += 1;
    if (record.outcome === "INTERVIEWED") stats.interviews += 1;
    if (record.outcome === "HIRED") stats.hires += 1;

    const matchSignals = isRecord(record.matchSignals) ? record.matchSignals : null;
    const shortlisted = matchSignals?.shortlisted === true;
    if (shortlisted) {
      stats.shortlisted += 1;
      if (record.outcome === "REJECTED") {
        stats.falsePositives += 1;
      }
    }

    presetStats.set(preset, stats);

    const thresholds = extractGuardrailConfig(record);
    const existingJob = jobMap.get(record.jobReqId);
    if (!existingJob || new Date(existingJob.updatedAt) < record.createdAt) {
      jobMap.set(record.jobReqId, {
        jobReqId: record.jobReqId,
        title: record.jobReqTitle ?? "Unknown role",
        guardrailsPreset: preset,
        thresholds,
        updatedAt: record.createdAt.toISOString(),
      });
    }

    const roleKey = (record.jobReqTitle ?? "Unknown role").trim() || "Unknown role";
    const rolePresetStats = roleMap.get(roleKey) ?? new Map();
    const rolePreset = rolePresetStats.get(preset) ?? { hires: 0, totals: 0 };
    rolePreset.totals += 1;
    if (record.outcome === "HIRED") rolePreset.hires += 1;
    rolePresetStats.set(preset, rolePreset);
    roleMap.set(roleKey, rolePresetStats);
  }

  const byPreset: PresetPerformance[] = Array.from(presetStats.entries()).map(([preset, stats]) => {
    const interviewRate = calculateRate(stats.interviews, stats.totals);
    const hireRate = calculateRate(stats.hires, stats.totals);
    const falsePositiveRate = calculateRate(stats.falsePositives, stats.shortlisted || stats.totals);

    return {
      preset,
      ...stats,
      interviewRate,
      hireRate,
      falsePositiveRate,
    } satisfies PresetPerformance;
  });

  const balancedStats = presetStats.get("balanced") ?? { totals: 0, interviews: 0, hires: 0, shortlisted: 0, falsePositives: 0 };
  const baselineInterview = calculateRate(balancedStats.interviews, balancedStats.totals);
  const baselineHire = calculateRate(balancedStats.hires, balancedStats.totals);
  const baselineFalsePositives = calculateRate(balancedStats.falsePositives, balancedStats.shortlisted || balancedStats.totals);

  const deltas: GuardrailPerformanceReport["deltas"] = [];
  for (const preset of ["conservative", "aggressive"] as const) {
    const stats = presetStats.get(preset);
    if (!stats) continue;

    deltas.push(
      {
        metric: "interviewRate",
        preset,
        comparedTo: "balanced",
        delta: calculateRate(stats.interviews, stats.totals) - baselineInterview,
      },
      {
        metric: "hireRate",
        preset,
        comparedTo: "balanced",
        delta: calculateRate(stats.hires, stats.totals) - baselineHire,
      },
      {
        metric: "falsePositiveRate",
        preset,
        comparedTo: "balanced",
        delta: calculateRate(stats.falsePositives, stats.shortlisted || stats.totals) - baselineFalsePositives,
      },
    );
  }

  const roleInsights: GuardrailPerformanceInsight[] = [];
  for (const [role, presetMap] of roleMap.entries()) {
    const rankedPresets = Array.from(presetMap.entries())
      .map(([preset, stats]) => ({ preset, hireRate: calculateRate(stats.hires, stats.totals) }))
      .sort((a, b) => b.hireRate - a.hireRate);

    if (rankedPresets.length < 2 || rankedPresets[0].hireRate === 0) continue;

    const best = rankedPresets[0];
    const compared = rankedPresets[1];
    const delta = Number((best.hireRate - compared.hireRate).toFixed(1));

    roleInsights.push({
      role,
      bestPreset: best.preset,
      comparedTo: compared.preset,
      delta,
      statement: `${formatPresetName(best.preset)} preset outperformed ${formatPresetName(compared.preset)} by ${delta >= 0 ? "+" : ""}${delta}% hire rate for ${role} roles.`,
    });
  }

  return {
    byPreset: byPreset.sort((a, b) => a.preset.localeCompare(b.preset)),
    deltas,
    jobAttribution: Array.from(jobMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
    roleInsights,
  } satisfies GuardrailPerformanceReport;
}

export async function buildGuardrailPerformanceReport(tenantId: string): Promise<GuardrailPerformanceReport> {
  const feedback = await prisma.matchFeedback.findMany({
    where: { tenantId },
    select: {
      outcome: true,
      guardrailsPreset: true,
      guardrailsConfig: true,
      matchSignals: true,
      jobReqId: true,
      createdAt: true,
      matchResult: {
        select: {
          jobReq: {
            select: { title: true },
          },
        },
      },
    },
  });

  const records: GuardrailFeedbackRecord[] = feedback.map((entry) => ({
    outcome: entry.outcome,
    guardrailsPreset: entry.guardrailsPreset,
    guardrailsConfig: entry.guardrailsConfig,
    matchSignals: entry.matchSignals,
    jobReqId: entry.jobReqId,
    createdAt: entry.createdAt,
    jobReqTitle: entry.matchResult?.jobReq.title ?? null,
  }));

  return summarizeGuardrailPerformance(records);
}
