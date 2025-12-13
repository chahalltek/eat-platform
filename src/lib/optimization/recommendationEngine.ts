export type RecommendationType = "threshold" | "strategy" | "preset";

export type OptimizationRecommendation = {
  recommendationId: string;
  type: RecommendationType;
  suggestion: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
};

export type GuardrailAttribution = {
  preset?: string;
  strategy?: string;
  minMatchScore?: number;
  shortlistMinScore?: number;
  shortlistMaxCandidates?: number;
};

export type OptimizationSignals = {
  mqiTrend: number;
  guardrailAttribution: GuardrailAttribution;
  falsePositiveRate: number;
  confidenceDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  sampleSize?: number;
};

export interface RecommendationStore {
  list(scopeId: string): Promise<OptimizationRecommendation[]>;
  save(scopeId: string, recommendations: OptimizationRecommendation[]): Promise<void>;
}

class InMemoryRecommendationStore implements RecommendationStore {
  private store = new Map<string, OptimizationRecommendation[]>();

  async list(scopeId: string) {
    return this.store.get(scopeId) ?? [];
  }

  async save(scopeId: string, recommendations: OptimizationRecommendation[]) {
    this.store.set(scopeId, recommendations);
  }
}

const defaultStore = new InMemoryRecommendationStore();

export class OptimizationRecommendationEngine {
  constructor(private store: RecommendationStore = defaultStore) {}

  async generate(scopeId: string, signals: OptimizationSignals): Promise<OptimizationRecommendation[]> {
    const recommendations = this.buildRecommendations(signals);
    await this.store.save(scopeId, recommendations);
    return recommendations;
  }

  async list(scopeId: string): Promise<OptimizationRecommendation[]> {
    return this.store.list(scopeId);
  }

  private buildRecommendations(signals: OptimizationSignals): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const { guardrailAttribution, falsePositiveRate, mqiTrend, confidenceDistribution, sampleSize } = signals;

    if (guardrailAttribution.minMatchScore !== undefined && (falsePositiveRate > 0.22 || mqiTrend < -2)) {
      const from = guardrailAttribution.minMatchScore;
      const to = Math.min(0.95, Math.round((from + 0.05) * 100) / 100);
      const direction = mqiTrend < 0 ? `MQI is trending ${mqiTrend.toFixed(1)} points` : "";
      const feedback = falsePositiveRate > 0.22 ? `${(falsePositiveRate * 100).toFixed(1)}% false positive feedback` : "";
      const rationaleParts = [direction, feedback].filter(Boolean).join(" and ");

      recommendations.push({
        recommendationId: "raise-min-match-score",
        type: "threshold",
        suggestion: `Increase minMatchScore from ${from} → ${to}`,
        rationale: `${rationaleParts} suggest the current threshold is letting lower-signal matches through${
          sampleSize ? ` across ${sampleSize} recent decisions` : ""
        }`.trim(),
        confidence: falsePositiveRate > 0.3 ? "high" : "medium",
      });
    }

    if (confidenceDistribution.low > 0.35) {
      const lowShare = (confidenceDistribution.low * 100).toFixed(0);
      const strategy = guardrailAttribution.strategy ?? "current";
      recommendations.push({
        recommendationId: "rebalance-confidence-strategy",
        type: "strategy",
        suggestion: `Shift matching strategy to emphasize confidence weighting (from ${strategy})`,
        rationale: `${lowShare}% of matches fall into the low-confidence bucket, signaling reviewers are overwhelmed by weak candidates`,
        confidence: confidenceDistribution.low > 0.45 ? "high" : "medium",
      });
    }

    if (
      guardrailAttribution.preset &&
      guardrailAttribution.preset.toLowerCase() !== "balanced" &&
      (falsePositiveRate > 0.25 || confidenceDistribution.low > 0.35)
    ) {
      const preset = guardrailAttribution.preset;
      recommendations.push({
        recommendationId: "switch-to-balanced-preset",
        type: "preset",
        suggestion: "Switch Data roles to Balanced preset",
        rationale: `${(falsePositiveRate * 100).toFixed(1)}% false positives while using the ${preset} preset suggests a more conservative baseline would reduce noise`,
        confidence: falsePositiveRate > 0.3 ? "high" : "medium",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        recommendationId: "observe-and-hold",
        type: "strategy",
        suggestion: "Hold current settings; no optimization change recommended",
        rationale: `MQI is stable (${mqiTrend.toFixed(1)} trend) with ${(falsePositiveRate * 100).toFixed(1)}% false positives across ${
          sampleSize ?? "recent"
        } observations`,
        confidence: "low",
      });
    }

    return recommendations;
  }
}

export const optimizationRecommendationEngine = new OptimizationRecommendationEngine();
