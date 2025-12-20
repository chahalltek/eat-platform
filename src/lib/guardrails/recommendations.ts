import { isPrismaUnavailableError, isTableAvailable, prisma } from "@/server/db/prisma";
import { guardrailsPresets } from "./presets";
import { loadTenantGuardrails } from "@/lib/tenant/guardrails";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import type { SystemModeName } from "@/lib/modes/systemModes";

export type RecommendationStatus = "pending" | "applied" | "dismissed";

export type GuardrailRecommendation = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  suggestedChange: string;
  confidence: "low" | "medium" | "high";
  signals: string[];
  status: RecommendationStatus;
  systemMode: SystemModeName;
  generatedAt: Date;
};

type TelemetrySnapshot = {
  mqiTrend: number;
  averageMatchScore: number;
  falsePositiveRate: number;
  shortlistPressure: number;
  confidenceDistribution: { high: number; medium: number; low: number };
  sampleSize: number;
};

type StoredRecommendation = GuardrailRecommendation & { updatedAt: number };

export interface RecommendationStore {
  list(tenantId: string): Promise<StoredRecommendation[]>;
  save(tenantId: string, recommendations: StoredRecommendation[]): Promise<void>;
}

class InMemoryRecommendationStore implements RecommendationStore {
  private store = new Map<string, StoredRecommendation[]>();

  async list(tenantId: string) {
    return this.store.get(tenantId) ?? [];
  }

  async save(tenantId: string, recommendations: StoredRecommendation[]) {
    this.store.set(tenantId, recommendations);
  }
}

const defaultStore = new InMemoryRecommendationStore();

export class GuardrailRecommendationEngine {
  constructor(private store: RecommendationStore = defaultStore) {}

  async generate(tenantId: string): Promise<GuardrailRecommendation[]> {
    const [mode, guardrails, telemetry] = await Promise.all([
      loadTenantMode(tenantId),
      loadTenantGuardrails(tenantId),
      this.collectTelemetry(tenantId),
    ]);

    if (mode.mode === "fire_drill") {
      return [];
    }

    const generatedAt = new Date();
    const drafts = this.buildRecommendations(guardrails.scoring.thresholds, guardrails.safety, telemetry, mode.mode, generatedAt);
    const merged = await this.mergeWithStore(tenantId, drafts);

    await this.store.save(tenantId, merged);

    return merged.map(({ updatedAt: _updatedAt, ...recommendation }) => recommendation);
  }

  async updateStatus(tenantId: string, recommendationId: string, status: RecommendationStatus) {
    const current = await this.store.list(tenantId);
    const next = current.map((recommendation) =>
      recommendation.id === recommendationId ? { ...recommendation, status, updatedAt: Date.now() } : recommendation,
    );

    await this.store.save(tenantId, next);

    return next.map(({ updatedAt: _updatedAt, ...recommendation }) => recommendation);
  }

  private async mergeWithStore(tenantId: string, drafts: GuardrailRecommendation[]) {
    const existing = await this.store.list(tenantId);
    const existingById = new Map(existing.map((entry) => [entry.id, entry]));

    const merged = drafts.map((draft) => {
      const match = existingById.get(draft.id);
      const status = match?.status ?? "pending";
      const updatedAt = match?.updatedAt ?? Date.now();
      return { ...draft, status, updatedAt } satisfies StoredRecommendation;
    });

    return merged;
  }

  private buildRecommendations(
    thresholds: { minMatchScore: number; shortlistMinScore: number; shortlistMaxCandidates: number },
    safety: { confidenceBands?: { high: number; medium: number } | undefined },
    telemetry: TelemetrySnapshot,
    systemMode: SystemModeName,
    generatedAt: Date,
  ): GuardrailRecommendation[] {
    const recommendations: GuardrailRecommendation[] = [];

    const forceLowConfidence = systemMode === "pilot";

    if (telemetry.falsePositiveRate > 0.25 || telemetry.mqiTrend < -5) {
      const from = thresholds.minMatchScore;
      const to = Math.min(95, Math.round((from + 5) * 10) / 10);
      recommendations.push({
        id: "increase-min-match-score",
        title: "Tighten shortlist cutoff",
        summary: "Raise the minimum match score used for shortlist decisions.",
        rationale: `MQI dropped by ${telemetry.mqiTrend.toFixed(1)} points and ${(telemetry.falsePositiveRate * 100).toFixed(1)}% of recent feedback called out false positives.`,
        suggestedChange: `Increase minMatchScore from ${from}% to ${to}% to prioritize higher-signal candidates.`,
        confidence: forceLowConfidence ? "low" : telemetry.falsePositiveRate > 0.35 ? "high" : "medium",
        signals: ["MQI trend", "Feedback false-positive rate"],
        status: "pending",
        systemMode,
        generatedAt,
      });
    }

    if (telemetry.shortlistPressure > 0.6 || telemetry.averageMatchScore < 60) {
      const from = thresholds.shortlistMaxCandidates;
      const delta = telemetry.shortlistPressure > 0.8 ? 3 : 2;
      const to = Math.max(3, from - delta);
      recommendations.push({
        id: "reduce-shortlist-width",
        title: "Reduce shortlist width",
        summary: "Lower the maximum candidates allowed on a shortlist to cut down review noise.",
        rationale: `Shortlists are overfilled ${(telemetry.shortlistPressure * 100).toFixed(0)}% of the time and average match scores are dipping to ${telemetry.averageMatchScore.toFixed(1)}%.`,
        suggestedChange: `Reduce shortlistMaxCandidates from ${from} to ${to} to keep reviews focused on the highest quality profiles.`,
        confidence: forceLowConfidence ? "low" : "medium",
        signals: ["Shortlist overfill rate", "Average match quality"],
        status: "pending",
        systemMode,
        generatedAt,
      });
    }

    const confidenceBands = safety.confidenceBands ?? guardrailsPresets.balanced.safety.confidenceBands;
    const lowShare = telemetry.confidenceDistribution.low;
    if (lowShare > 0.35) {
      const fromMedium = confidenceBands?.medium ?? 0.55;
      const fromHigh = confidenceBands?.high ?? 0.75;
      const mediumTo = Math.min(0.9, Math.round((fromMedium + 0.05) * 100) / 100);
      const highTo = Math.min(0.95, Math.round((fromHigh + 0.03) * 100) / 100);
      recommendations.push({
        id: "raise-confidence-bands",
        title: "Raise confidence bands",
        summary: "Tighten confidence thresholds so low-signal matches are flagged sooner.",
        rationale: `${(lowShare * 100).toFixed(0)}% of recent matches are falling into the low confidence bucket, increasing reviewer load.`,
        suggestedChange: `Increase confidence bands from high=${fromHigh}, medium=${fromMedium} to high=${highTo}, medium=${mediumTo}.`,
        confidence: forceLowConfidence ? "low" : "high",
        signals: ["Confidence distribution", "Reviewer burden"],
        status: "pending",
        systemMode,
        generatedAt,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: "no-action",
        title: "Guardrails look healthy",
        summary: "Metrics are stable; no tuning required right now.",
        rationale: `MQI is steady and false positives are under control across ${telemetry.sampleSize} recent signals.`,
        suggestedChange: "No configuration change recommended.",
        confidence: forceLowConfidence ? "low" : "medium",
        signals: ["MQI trend", "Feedback stability"],
        status: "pending",
        systemMode,
        generatedAt,
      });
    }

    return recommendations;
  }

  private async collectTelemetry(tenantId: string): Promise<TelemetrySnapshot> {
    const [mqiTrend, feedbackTelemetry] = await Promise.all([
      this.resolveMqiTrend(tenantId),
      this.resolveFeedbackTelemetry(tenantId),
    ]);

    return {
      mqiTrend,
      averageMatchScore: feedbackTelemetry.averageMatchScore,
      falsePositiveRate: feedbackTelemetry.falsePositiveRate,
      shortlistPressure: feedbackTelemetry.shortlistPressure,
      confidenceDistribution: feedbackTelemetry.confidenceDistribution,
      sampleSize: feedbackTelemetry.sampleSize,
    } satisfies TelemetrySnapshot;
  }

  private async resolveMqiTrend(tenantId: string) {
    if (!(await isTableAvailable("MatchQualitySnapshot"))) {
      return 0;
    }

    const snapshots = await prisma.matchQualitySnapshot
      .findMany({
        where: { tenantId, scope: "tenant" },
        orderBy: { capturedAt: "desc" },
        take: 2,
      })
      .catch((error) => {
        if (isPrismaUnavailableError(error)) return [] as never;
        throw error;
      });

    if (snapshots.length < 2) return 0;

    const [latest, previous] = snapshots;
    return Math.round((latest.mqi - previous.mqi) * 10) / 10;
  }

  private async resolveFeedbackTelemetry(tenantId: string) {
    if (!(await isTableAvailable("MatchFeedback"))) {
      return {
        averageMatchScore: 70,
        falsePositiveRate: 0,
        shortlistPressure: 0,
        confidenceDistribution: { high: 0.4, medium: 0.4, low: 0.2 },
        sampleSize: 0,
      } as const;
    }

    const feedback = await prisma.matchFeedback
      .findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { direction: true, matchScore: true, confidenceScore: true },
      })
      .catch((error) => {
        if (isPrismaUnavailableError(error)) return [] as never;
        throw error;
      });

    if (feedback.length === 0) {
      return {
        averageMatchScore: 70,
        falsePositiveRate: 0,
        shortlistPressure: 0,
        confidenceDistribution: { high: 0.4, medium: 0.4, low: 0.2 },
        sampleSize: 0,
      } as const;
    }

    const sampleSize = feedback.length;
    const averageMatchScore = feedback.reduce((sum, entry) => sum + (entry.matchScore ?? 0), 0) / sampleSize;
    const falsePositiveRate = feedback.filter((entry) => entry.direction === "DOWN").length / Math.max(1, sampleSize);

    const confidenceBuckets = feedback.reduce(
      (acc, entry) => {
        const score = entry.confidenceScore ?? 0;
        if (score >= 80) acc.high += 1;
        else if (score >= 60) acc.medium += 1;
        else acc.low += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );

    const confidenceDistribution = {
      high: confidenceBuckets.high / sampleSize,
      medium: confidenceBuckets.medium / sampleSize,
      low: confidenceBuckets.low / sampleSize,
    };

    const shortlistPressure = Math.min(1, (confidenceBuckets.medium + confidenceBuckets.high) / Math.max(1, sampleSize));

    return { averageMatchScore, falsePositiveRate, shortlistPressure, confidenceDistribution, sampleSize } as const;
  }
}

export const guardrailRecommendationEngine = new GuardrailRecommendationEngine();

