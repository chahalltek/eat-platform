export type MQIInputs = {
  jobId: string;
  hiringOutcomes: {
    totalCandidates: number;
    interviewed: number;
    hired: number;
  };
  feedback: {
    positive: number;
    negative: number;
  };
  confidenceBands: {
    lower: number; // expected minimum success rate (0-1)
    upper: number; // expected maximum success rate (0-1)
  };
  timeToFill: {
    jobCreatedAt: Date;
    hiredAt?: Date | null;
    baselineDays?: number;
  };
};

export type MQIResult = {
  jobId: string;
  score: number; // 0–100
  components: {
    interviewRate: number;
    hireRate: number;
    confidenceAlignment: number;
  };
};

const WEIGHTS = {
  interviewRate: 0.5,
  hireRate: 0.35,
  confidenceAlignment: 0.15,
} as const;

const FEEDBACK_WEIGHT_WITHIN_HIRE = 0.3;
const DEFAULT_TIME_TO_FILL_BASELINE = 30;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return clamp(numerator / denominator);
}

function computeFeedbackScore(positive: number, negative: number) {
  const total = positive + negative;
  if (total === 0) return 0.5; // neutral when no feedback
  return clamp(positive / total);
}

function blendHireRate(hireRate: number, feedbackScore: number) {
  const weightHire = 1 - FEEDBACK_WEIGHT_WITHIN_HIRE;
  return clamp(hireRate * weightHire + feedbackScore * FEEDBACK_WEIGHT_WITHIN_HIRE);
}

function computeTimeToFillScore(timeToFill: MQIInputs["timeToFill"]) {
  const baseline = timeToFill.baselineDays ?? DEFAULT_TIME_TO_FILL_BASELINE;
  if (!timeToFill.hiredAt) return 0.3; // slight penalty when nothing is hired yet

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const actualDays = Math.max(
    0,
    (timeToFill.hiredAt.getTime() - timeToFill.jobCreatedAt.getTime()) / millisecondsPerDay,
  );

  if (baseline === 0) return 0.5;

  const delta = (baseline - actualDays) / baseline;
  return clamp(delta / 2 + 0.5);
}

function computeConfidenceAlignment(actualRate: number, bands: MQIInputs["confidenceBands"], timeToFillScore: number) {
  const { lower, upper } = bands;
  const normalizedLower = clamp(lower);
  const normalizedUpper = clamp(upper, normalizedLower, 1);
  const bandWidth = Math.max(0.05, normalizedUpper - normalizedLower);

  let bandAlignment = 1;
  if (actualRate < normalizedLower) {
    bandAlignment = clamp(1 - (normalizedLower - actualRate) / bandWidth);
  } else if (actualRate > normalizedUpper) {
    bandAlignment = clamp(1 - (actualRate - normalizedUpper) / (1 - normalizedUpper + 1e-6));
  }

  // time-to-fill acts as a stabilizer to avoid over-scoring long cycles
  return clamp(bandAlignment * 0.7 + timeToFillScore * 0.3);
}

export function calculateMatchQualityIndex(inputs: MQIInputs): MQIResult {
  const interviewRate = safeRate(inputs.hiringOutcomes.interviewed, inputs.hiringOutcomes.totalCandidates);

  const rawHireRate = safeRate(inputs.hiringOutcomes.hired, inputs.hiringOutcomes.interviewed);
  const feedbackScore = computeFeedbackScore(inputs.feedback.positive, inputs.feedback.negative);
  const hireRate = blendHireRate(rawHireRate, feedbackScore);

  const timeToFillScore = computeTimeToFillScore(inputs.timeToFill);
  const confidenceAlignment = computeConfidenceAlignment(hireRate, inputs.confidenceBands, timeToFillScore);

  const composite =
    interviewRate * WEIGHTS.interviewRate +
    hireRate * WEIGHTS.hireRate +
    confidenceAlignment * WEIGHTS.confidenceAlignment;

  return {
    jobId: inputs.jobId,
    score: Number((composite * 100).toFixed(1)),
    components: {
      interviewRate: Number((interviewRate * 100).toFixed(1)),
      hireRate: Number((hireRate * 100).toFixed(1)),
      confidenceAlignment: Number((confidenceAlignment * 100).toFixed(1)),
    },
  };
}
