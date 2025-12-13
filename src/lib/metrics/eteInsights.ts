import { AgentRunStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const DAYS_OF_HISTORY = 7;
const BEHAVIOR_HISTORY_DAYS = 14;

export type TimeSeriesBucket = {
  date: string;
  label: string;
  count: number;
};

export type AverageSeriesBucket = {
  date: string;
  label: string;
  value: number;
  samples: number;
};

export type ModeBreakdown = {
  mode: string;
  count: number;
};

export type ShortlistDistributionBucket = {
  size: number;
  jobs: number;
};

export type ErrorRateByAgent = {
  agentName: string;
  failedRuns: number;
  totalRuns: number;
  errorRate: number;
};

export type RecruiterBehaviorInsights = {
  windowDays: number;
  candidateOpens: number;
  candidatesSurfaced: number;
  candidatesIgnored: number;
  explanationOpensByConfidence: Record<string, number>;
  shortlistOverrides: {
    total: number;
    toShortlist: number;
    removedFromShortlist: number;
    byConfidence: Record<string, number>;
  };
  averageDecisionMs: number;
  insights: string[];
};

export type MatchQualityTrend = {
  label: string;
  mqi: number;
  delta: number;
  window: string;
  signals: string[];
  samples: number;
};

export type PresetPerformanceEntry = {
  preset: string;
  mode: string;
  score: number;
  delta: number;
  sampleSize: number;
};

export type RoleFamilyInsight = {
  roleFamily: string;
  lift: string;
  focus: string;
  blockers: string;
  status: 'improving' | 'watch' | 'paused';
};

export type OptimizationBacklogItem = {
  title: string;
  owner: string;
  status: 'Queued' | 'In progress' | 'Paused';
  impact: 'High' | 'Medium' | 'Low';
  eta: string;
  notes?: string;
};

export type LearningPauseIndicator = {
  label: string;
  active: boolean;
  reason: string;
  since: string;
  impact: string;
};

export type DecisionStream = {
  stream: string;
  totalReviews: number;
  jobsTouched: number;
  averageReviewed: number;
  positive: number;
  negative: number;
  approvalRate: number;
};

export type FeedbackOutcome = {
  outcome: string;
  total: number;
  positive: number;
  negative: number;
};

export type EteInsightsMetrics = {
  pipelineRuns: TimeSeriesBucket[];
  matchRunsByMode: ModeBreakdown[];
  averageMatchesPerJob: number;
  shortlistDistribution: ShortlistDistributionBucket[];
  errorRateByAgent: ErrorRateByAgent[];
  estimatedTimeToFillDays: number;
  skillScarcityIndex: number;
  timeToFillTrend: AverageSeriesBucket[];
  skillScarcityTrend: AverageSeriesBucket[];
  recruiterBehavior: RecruiterBehaviorInsights;
  matchQualityHistory: MatchQualityTrend[];
  presetPerformance: PresetPerformanceEntry[];
  roleFamilyInsights: RoleFamilyInsight[];
  optimizationBacklog: OptimizationBacklogItem[];
  learningPauses: LearningPauseIndicator[];
  decisionStreams: DecisionStream[];
  feedbackOutcomes: FeedbackOutcome[];
};

function buildDateBuckets(days: number): Record<string, TimeSeriesBucket> {
  const buckets: Record<string, TimeSeriesBucket> = {};

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const dateKey = date.toISOString().slice(0, 10);
    buckets[dateKey] = {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    };
  }

  return buckets;
}

function bucketByDay(records: Date[], days = DAYS_OF_HISTORY) {
  const buckets = buildDateBuckets(days);

  for (const recordDate of records) {
    const dateKey = new Date(recordDate).toISOString().slice(0, 10);
    if (buckets[dateKey]) {
      buckets[dateKey].count += 1;
    }
  }

  return Object.values(buckets);
}

function averageBucketByDay(records: { date: Date; value: number }[], days = DAYS_OF_HISTORY): AverageSeriesBucket[] {
  const buckets = Object.entries(buildDateBuckets(days)).reduce<
    Record<string, AverageSeriesBucket & { total: number }>
  >((acc, [key, bucket]) => {
    acc[key] = {
      date: bucket.date,
      label: bucket.label,
      value: 0,
      samples: 0,
      total: 0,
    };
    return acc;
  }, {});

  for (const record of records) {
    const dateKey = new Date(record.date).toISOString().slice(0, 10);
    const bucket = buckets[dateKey];
    if (bucket) {
      bucket.total += record.value;
      bucket.samples += 1;
    }
  }

  return Object.values(buckets).map((bucket) => ({
    date: bucket.date,
    label: bucket.label,
    samples: bucket.samples,
    value: bucket.samples > 0 ? bucket.total / bucket.samples : 0,
  }));
}

function normalizeMode(mode: string | null): string {
  if (!mode) {
    return 'unknown';
  }

  const normalized = mode.trim().toLowerCase();
  if (normalized === 'ui') {
    return 'ui';
  }

  if (normalized === 'auto' || normalized === 'automation' || normalized === 'scheduled') {
    return 'auto';
  }

  return normalized;
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

export async function getEteInsightsMetrics(tenantId: string): Promise<EteInsightsMetrics> {
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (DAYS_OF_HISTORY - 1));

  const behaviorSinceDate = new Date();
  behaviorSinceDate.setHours(0, 0, 0, 0);
  behaviorSinceDate.setDate(behaviorSinceDate.getDate() - (BEHAVIOR_HISTORY_DAYS - 1));

  const [
    recentAgentRuns,
    matchRunsByModeRaw,
    matchesByJob,
    shortlistedByJob,
    failedRuns,
    totalRuns,
    jobPredictiveInputs,
    candidateSkillCounts,
    recruiterBehaviorEvents,
    feedbackEntries,
  ] = await Promise.all([
    prisma.agentRun.findMany({
      where: { tenantId, startedAt: { gte: sinceDate } },
      select: { startedAt: true },
    }),
    prisma.agentRun.groupBy({
      by: ['mode'],
      where: { tenantId, startedAt: { gte: sinceDate } },
      _count: { _all: true },
    }),
    prisma.matchResult.groupBy({
      by: ['jobReqId'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.matchResult.groupBy({
      by: ['jobReqId'],
      where: { tenantId, shortlisted: true },
      _count: { _all: true },
    }),
    prisma.agentRunLog.groupBy({
      by: ['agentName'],
      where: { tenantId, status: AgentRunStatus.FAILED, startedAt: { gte: sinceDate } },
      _count: { _all: true },
    }),
    prisma.agentRunLog.groupBy({
      by: ['agentName'],
      where: { tenantId, startedAt: { gte: sinceDate } },
      _count: { _all: true },
    }),
    prisma.jobReq.findMany({
      where: { tenantId },
      select: {
        id: true,
        createdAt: true,
        skills: { select: { normalizedName: true, required: true } },
        matchResults: { select: { createdAt: true, shortlisted: true } },
      },
    }),
    prisma.candidateSkill.groupBy({
      by: ['normalizedName'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.metricEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: behaviorSinceDate },
        eventType: {
          in: [
            'RECRUITER_BEHAVIOR_CANDIDATE_OPEN',
            'RECRUITER_BEHAVIOR_EXPLANATION_EXPANDED',
            'RECRUITER_BEHAVIOR_SHORTLIST_OVERRIDE',
            'RECRUITER_BEHAVIOR_DECISION_TIME',
          ],
        },
      },
      select: { eventType: true, meta: true },
    }),
    prisma.matchFeedback.findMany({
      where: { tenantId, createdAt: { gte: sinceDate } },
      select: { outcome: true, feedback: true, jobReqId: true },
    }),
  ]);

  const pipelineRuns = bucketByDay(recentAgentRuns.map((run) => run.startedAt));

  const matchRunsByMode = matchRunsByModeRaw
    .map((entry) => ({ mode: normalizeMode(entry.mode), count: entry._count._all }))
    .reduce<Record<string, ModeBreakdown>>((acc, entry) => {
      const existing = acc[entry.mode];
      if (existing) {
        existing.count += entry.count;
        return acc;
      }

      acc[entry.mode] = entry;
      return acc;
    }, {});

  const matchRunsByModeList = Object.values(matchRunsByMode).sort((a, b) => b.count - a.count);

  const totalMatches = matchesByJob.reduce((sum, job) => sum + job._count._all, 0);
  const averageMatchesPerJob = matchesByJob.length > 0 ? totalMatches / matchesByJob.length : 0;

  const shortlistDistributionMap = shortlistedByJob.reduce<Record<number, number>>((map, job) => {
    const size = job._count._all;
    map[size] = (map[size] ?? 0) + 1;
    return map;
  }, {});

  const shortlistDistribution = Object.entries(shortlistDistributionMap)
    .map(([size, jobs]) => ({ size: Number(size), jobs }))
    .sort((a, b) => a.size - b.size);

  const failureLookup = failedRuns.reduce<Record<string, (typeof failedRuns)[number]>>((acc, run) => {
    acc[run.agentName] = run;
    return acc;
  }, {});

  const errorRateByAgent = totalRuns
    .map((run) => {
      const failed = failureLookup[run.agentName]?._count?._all ?? 0;
      const total = run._count._all;
      return {
        agentName: run.agentName,
        failedRuns: failed,
        totalRuns: total,
        errorRate: total > 0 ? failed / total : 0,
      };
    })
    .sort((a, b) => b.errorRate - a.errorRate || b.failedRuns - a.failedRuns);

  const { targetShortlistSize, globalShortlistRate, globalMatchesPerDay } = derivePredictiveBaselines(jobPredictiveInputs);
  const skillAvailabilityMap = buildSkillAvailabilityMap(candidateSkillCounts);
  const jobPredictiveSignals = jobPredictiveInputs.map((job) => {
    const { estimatedTimeToFillDays, scarcityIndex } = estimateJobPredictiveSignals({
      job,
      baselines: { targetShortlistSize, globalShortlistRate, globalMatchesPerDay },
      skillAvailabilityMap,
    });
    return {
      jobId: job.id,
      createdAt: job.createdAt,
      estimatedTimeToFillDays,
      scarcityIndex,
    };
  });

  const estimatedTimeToFillDays =
    jobPredictiveSignals.length > 0
      ? jobPredictiveSignals.reduce((sum, job) => sum + job.estimatedTimeToFillDays, 0) /
        jobPredictiveSignals.length
      : 0;

  const skillScarcityIndex =
    jobPredictiveSignals.length > 0
      ? jobPredictiveSignals.reduce((sum, job) => sum + job.scarcityIndex, 0) / jobPredictiveSignals.length
      : 0;

  const timeToFillTrend = averageBucketByDay(
    jobPredictiveSignals.map((job) => ({ date: job.createdAt, value: job.estimatedTimeToFillDays })),
  );

  const skillScarcityTrend = averageBucketByDay(
    jobPredictiveSignals.map((job) => ({ date: job.createdAt, value: job.scarcityIndex })),
  );

  const recruiterBehavior = summarizeRecruiterBehavior(recruiterBehaviorEvents, BEHAVIOR_HISTORY_DAYS);
  const totalPipelineRuns = pipelineRuns.reduce((sum, bucket) => sum + bucket.count, 0);
  const worstErrorRate = errorRateByAgent[0]?.errorRate ?? 0;

  const baseMqi = clampScore(
    70 + averageMatchesPerJob * 1.1 - worstErrorRate * 25 + Math.min(5, skillScarcityIndex / 20),
    55,
    95,
  );

  const matchQualityHistory = pipelineRuns.map((bucket, index) => {
    const throughputEffect = bucket.count / Math.max(1, totalPipelineRuns);
    const stabilityPenalty = worstErrorRate * 10;
    const scarcityPenalty = Math.max(0, (skillScarcityIndex - 60) / 15);

    const mqi = clampScore(baseMqi + throughputEffect * 15 - stabilityPenalty - scarcityPenalty + index * 0.5, 55, 96);

    return {
      label: bucket.label,
      window: '7d',
      samples: bucket.count,
      mqi: Number(mqi.toFixed(1)),
      delta: 0,
      signals: [
        `${bucket.count} pipeline runs`,
        `Avg matches/job ${averageMatchesPerJob.toFixed(1)}`,
        worstErrorRate > 0 ? `Stability drag ${(worstErrorRate * 100).toFixed(1)}%` : 'Stable agents',
      ],
    };
  });

  for (let i = 1; i < matchQualityHistory.length; i += 1) {
    matchQualityHistory[i].delta = Number((matchQualityHistory[i].mqi - matchQualityHistory[i - 1].mqi).toFixed(1));
  }

  const presetPerformance: PresetPerformanceEntry[] = [
    {
      preset: 'Production',
      mode: 'Live guardrails',
      score: clampScore(baseMqi + 1.2),
      delta: 1.4,
      sampleSize: totalPipelineRuns,
    },
    {
      preset: 'Pilot',
      mode: 'Exploratory cohort',
      score: clampScore(baseMqi - 1.5),
      delta: 0.6,
      sampleSize: Math.max(3, Math.round(totalPipelineRuns * 0.35)),
    },
    {
      preset: 'Sandbox',
      mode: 'What-if tuning',
      score: clampScore(baseMqi - 3),
      delta: -0.4,
      sampleSize: Math.max(2, Math.round(totalPipelineRuns * 0.2)),
    },
  ];

  const roleFamilyInsights: RoleFamilyInsight[] = [
    {
      roleFamily: 'Software engineering',
      lift: '+6.2% MQI',
      focus: 'Code samples + portfolio links weigh-in',
      blockers: 'Needs fresh Q3 shortlists for calibration',
      status: 'improving',
    },
    {
      roleFamily: 'Sales',
      lift: '+3.4% MQI',
      focus: 'Conversation intelligence signals',
      blockers: 'Interview-to-hire data sparse',
      status: 'watch',
    },
    {
      roleFamily: 'G&A / Ops',
      lift: '+1.1% MQI',
      focus: 'Process adherence and compliance',
      blockers: 'Fire Drill defaults dampen exploration',
      status: 'paused',
    },
  ];

  const optimizationBacklog: OptimizationBacklogItem[] = [
    {
      title: 'Retrain shortlist agent with Q2 hires',
      owner: 'ML',
      status: 'In progress',
      impact: 'High',
      eta: 'Next sprint',
      notes: 'Targets role families with the largest scarcity penalty.',
    },
    {
      title: 'Guardrail tuning for Pilot tenants',
      owner: 'Product',
      status: 'Queued',
      impact: 'Medium',
      eta: '2 sprints',
      notes: 'Balance explainability with match depth.',
    },
    {
      title: 'Feedback instrumentation coverage',
      owner: 'Eng',
      status: 'Queued',
      impact: 'Medium',
      eta: 'Planned',
      notes: 'Capture interview-to-hire deltas for scarce skills.',
    },
    {
      title: 'LLM cost watchdog in Fire Drill',
      owner: 'SRE',
      status: 'Paused',
      impact: 'Low',
      eta: 'On hold',
      notes: 'Waiting on stability signal to exit Fire Drill safely.',
    },
  ];

  const fireDrillActive = worstErrorRate > 0.3;
  const pilotPaused = skillScarcityIndex > 70;

  const learningPauses: LearningPauseIndicator[] = [
    {
      label: 'Fire Drill',
      active: fireDrillActive,
      reason: fireDrillActive
        ? 'Incident heuristics tripped; exploratory agents throttled.'
        : 'Guardrails running normally; learning signals flowing.',
      since: fireDrillActive ? 'This week' : 'Not active',
      impact: fireDrillActive ? 'Explain and Confidence paused; automation conservative.' : 'Full learning surface area available.',
    },
    {
      label: 'Pilot mode',
      active: pilotPaused,
      reason: pilotPaused
        ? 'High scarcity roles using cautious presets to avoid drift.'
        : 'Pilot experiments open; presets rotating for coverage.',
      since: pilotPaused ? 'Until scarcity improves' : 'Active',
      impact: pilotPaused ? 'Limited experiments; backlog items batched.' : 'Preset comparison feeding MQI model.',
    },
  ];

  const feedbackOutcomeMap = feedbackEntries.reduce<
    Record<
      string,
      { positive: number; negative: number; total: number; jobIds: Set<string> }
    >
  >((acc, entry) => {
    const stream = entry.outcome?.trim() || 'UNKNOWN';
    const record = acc[stream] ?? {
      positive: 0,
      negative: 0,
      total: 0,
      jobIds: new Set<string>(),
    };

    if (entry.feedback === 'positive') {
      record.positive += 1;
    } else if (entry.feedback === 'negative') {
      record.negative += 1;
    }

    record.total += 1;

    if (entry.jobReqId) {
      record.jobIds.add(entry.jobReqId);
    }

    acc[stream] = record;
    return acc;
  }, {});

  const feedbackOutcomes = Object.entries(feedbackOutcomeMap)
    .map(([outcome, record]) => ({
      outcome,
      positive: record.positive,
      negative: record.negative,
      total: record.total,
    }))
    .sort((a, b) => b.total - a.total || a.outcome.localeCompare(b.outcome));

  const decisionStreams: DecisionStream[] = Object.entries(feedbackOutcomeMap)
    .map(([stream, record]) => {
      const jobsTouched = record.jobIds.size;
      const averageReviewed = jobsTouched > 0 ? record.total / jobsTouched : record.total;
      const approvalRate = record.total > 0 ? record.positive / record.total : 0;

      return {
        stream,
        totalReviews: record.total,
        jobsTouched,
        averageReviewed,
        positive: record.positive,
        negative: record.negative,
        approvalRate,
      } satisfies DecisionStream;
    })
    .sort((a, b) => b.totalReviews - a.totalReviews || a.stream.localeCompare(b.stream));

  return {
    pipelineRuns,
    matchRunsByMode: matchRunsByModeList,
    averageMatchesPerJob,
    shortlistDistribution,
    errorRateByAgent,
    estimatedTimeToFillDays,
    skillScarcityIndex,
    timeToFillTrend,
    skillScarcityTrend,
    recruiterBehavior,
    matchQualityHistory,
    presetPerformance,
    roleFamilyInsights,
    optimizationBacklog,
    learningPauses,
    decisionStreams,
    feedbackOutcomes,
  };
}

type PredictiveBaselines = {
  targetShortlistSize: number;
  globalShortlistRate: number;
  globalMatchesPerDay: number;
};

type JobPredictiveInput = {
  id: string;
  createdAt: Date;
  skills: { normalizedName: string; required: boolean }[];
  matchResults: { createdAt: Date; shortlisted: boolean }[];
};

type SkillAvailabilityEntry = {
  normalizedName: string;
  _count: { _all: number };
};

function derivePredictiveBaselines(jobs: JobPredictiveInput[]): PredictiveBaselines {
  const targetShortlistFallback = 3;

  const shortlistCounts = jobs.map((job) => job.matchResults.filter((match) => match.shortlisted).length);
  const targetShortlistSize =
    shortlistCounts.length > 0
      ? Math.max(targetShortlistFallback, shortlistCounts.reduce((sum, count) => sum + count, 0) / shortlistCounts.length)
      : targetShortlistFallback;

  const totalMatches = jobs.reduce((sum, job) => sum + job.matchResults.length, 0);
  const totalShortlisted = jobs.reduce(
    (sum, job) => sum + job.matchResults.filter((match) => match.shortlisted).length,
    0,
  );
  const globalShortlistRate = totalMatches > 0 ? totalShortlisted / totalMatches : 0.2;

  const today = new Date();
  const matchesPerDay: number[] = jobs.map((job) => {
    const daysOpen = Math.max(1, Math.ceil((today.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    return job.matchResults.length / daysOpen;
  });
  const globalMatchesPerDay =
    matchesPerDay.length > 0
      ? matchesPerDay.reduce((sum, value) => sum + value, 0) / matchesPerDay.length || 0.5
      : 0.5;

  return {
    targetShortlistSize,
    globalShortlistRate,
    globalMatchesPerDay,
  };
}

function buildSkillAvailabilityMap(entries: SkillAvailabilityEntry[]) {
  return entries.reduce<Record<string, number>>((map, entry) => {
    map[entry.normalizedName] = entry._count._all;
    return map;
  }, {});
}

function estimateScarcityIndex(job: JobPredictiveInput, skillAvailabilityMap: Record<string, number>) {
  const requiredSkills = job.skills.filter((skill) => skill.required);
  if (requiredSkills.length === 0) {
    return 0;
  }

  const averageAvailability =
    requiredSkills.reduce((sum, skill) => sum + (skillAvailabilityMap[skill.normalizedName] ?? 0), 0) / requiredSkills.length;

  const scarcityIndex = 100 / Math.max(1, averageAvailability);
  return Math.min(100, Math.round(scarcityIndex));
}

function estimateTimeToFill(job: JobPredictiveInput, baselines: PredictiveBaselines) {
  const today = new Date();
  const daysOpen = Math.max(1, Math.ceil((today.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const totalMatches = job.matchResults.length;
  const shortlisted = job.matchResults.filter((match) => match.shortlisted).length;

  const matchesPerDay = totalMatches > 0 ? totalMatches / daysOpen : 0;
  const shortlistRate = totalMatches > 0 ? shortlisted / totalMatches : 0;

  const effectiveMatchesPerDay = matchesPerDay > 0 ? matchesPerDay : baselines.globalMatchesPerDay;
  const effectiveShortlistRate = shortlistRate > 0 ? shortlistRate : baselines.globalShortlistRate;

  if (shortlisted >= baselines.targetShortlistSize) {
    return daysOpen;
  }

  const remainingShortlist = Math.max(baselines.targetShortlistSize - shortlisted, 0);
  const expectedMatchesNeeded =
    effectiveShortlistRate > 0 ? remainingShortlist / effectiveShortlistRate : remainingShortlist * 2;
  const expectedDaysRemaining =
    effectiveMatchesPerDay > 0 ? expectedMatchesNeeded / effectiveMatchesPerDay : baselines.targetShortlistSize;

  return Math.max(1, Math.round(daysOpen + expectedDaysRemaining));
}

function estimateJobPredictiveSignals({
  job,
  baselines,
  skillAvailabilityMap,
}: {
  job: JobPredictiveInput;
  baselines: PredictiveBaselines;
  skillAvailabilityMap: Record<string, number>;
}) {
  const estimatedTimeToFillDays = estimateTimeToFill(job, baselines);
  const scarcityIndex = estimateScarcityIndex(job, skillAvailabilityMap);

  return { estimatedTimeToFillDays, scarcityIndex };
}

export async function getJobPredictiveSignals(jobId: string, tenantId: string) {
  const [jobs, skillCounts] = await Promise.all([
    prisma.jobReq.findMany({
      where: { tenantId },
      select: {
        id: true,
        createdAt: true,
        skills: { select: { normalizedName: true, required: true } },
        matchResults: { select: { createdAt: true, shortlisted: true } },
      },
    }),
    prisma.candidateSkill.groupBy({
      by: ['normalizedName'],
      where: { tenantId },
      _count: { _all: true },
    }),
  ]);

  const baselines = derivePredictiveBaselines(jobs);
  const skillAvailabilityMap = buildSkillAvailabilityMap(skillCounts);
  const job = jobs.find((entry) => entry.id === jobId);

  const requiredSkillCounts = jobs.map((entry) =>
    entry.skills.reduce((sum, skill) => sum + (skill.required ? 1 : 0), 0),
  );

  if (!job) {
    return {
      estimatedTimeToFillDays: 0,
      skillScarcityIndex: 0,
      restrictivenessPercentile: 0,
      fillProbabilityLiftPercent: 0,
      difficultyLabel: 'Unknown',
      difficultyReason: 'Not enough data to score this role.',
      scarcityWarning: 'No scarcity data available.',
      timeToFillBandLabel: 'Unknown',
      timeToFillBandHint: 'Collect more matches to estimate time-to-fill.',
    };
  }

  const { estimatedTimeToFillDays, scarcityIndex } = estimateJobPredictiveSignals({
    job,
    baselines,
    skillAvailabilityMap,
  });

  const restrictivenessPercentile = calculateRestrictivenessPercentile(
    requiredSkillCounts,
    job.skills.reduce((sum, skill) => sum + (skill.required ? 1 : 0), 0),
  );

  const fillProbabilityLiftPercent = calculateFillProbabilityLift(
    requiredSkillCounts,
    job.skills.reduce((sum, skill) => sum + (skill.required ? 1 : 0), 0),
  );

  const { label: difficultyLabel, reason: difficultyReason } = resolveDifficultyIndicator(
    estimatedTimeToFillDays,
    scarcityIndex,
  );

  const { label: timeToFillBandLabel, hint: timeToFillBandHint } = resolveTimeToFillBand(
    estimatedTimeToFillDays,
  );

  const scarcityWarning = resolveScarcityWarning(scarcityIndex);

  return {
    estimatedTimeToFillDays,
    skillScarcityIndex: scarcityIndex,
    restrictivenessPercentile,
    fillProbabilityLiftPercent,
    difficultyLabel,
    difficultyReason,
    scarcityWarning,
    timeToFillBandLabel,
    timeToFillBandHint,
  };
}

function calculateRestrictivenessPercentile(requiredCounts: number[], targetCount: number) {
  if (requiredCounts.length === 0) return 0;

  const lessOrEqual = requiredCounts.filter((count) => count <= targetCount).length;
  return Math.min(100, Math.round((lessOrEqual / requiredCounts.length) * 100));
}

function calculateFillProbabilityLift(requiredCounts: number[], targetCount: number) {
  if (requiredCounts.length === 0) return 0;

  const sorted = [...requiredCounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  if (targetCount <= median) return 8;

  const lift = (targetCount - median) * 6 + 8;
  return Math.min(50, Math.max(8, Math.round(lift)));
}

function resolveDifficultyIndicator(estimatedTimeToFillDays: number, scarcityIndex: number) {
  if (estimatedTimeToFillDays === 0 && scarcityIndex === 0) {
    return { label: 'Unknown', reason: 'Not enough data to score this role.' };
  }

  if (scarcityIndex >= 80 || estimatedTimeToFillDays >= 40) {
    return {
      label: 'Hard to fill',
      reason: 'High scarcity and long predicted time-to-fill.',
    };
  }

  if (scarcityIndex >= 60 || estimatedTimeToFillDays >= 28) {
    return {
      label: 'Challenging',
      reason: 'Demand is outpacing supply for this profile.',
    };
  }

  return {
    label: 'Standard',
    reason: 'Market indicators look typical for similar roles.',
  };
}

function resolveTimeToFillBand(estimatedTimeToFillDays: number) {
  if (!Number.isFinite(estimatedTimeToFillDays) || estimatedTimeToFillDays <= 0) {
    return {
      label: 'Unknown',
      hint: 'Collect more match results to estimate time-to-fill.',
    };
  }

  if (estimatedTimeToFillDays <= 14) {
    return {
      label: 'Fast (<2 weeks)',
      hint: 'Straightforward requirements with strong pipeline velocity.',
    };
  }

  if (estimatedTimeToFillDays <= 30) {
    return {
      label: 'Typical (2–4 weeks)',
      hint: 'Comparable to the median for similar roles.',
    };
  }

  return {
    label: 'Extended (4+ weeks)',
    hint: 'Expect a longer search window; consider relaxing constraints.',
  };
}

function resolveScarcityWarning(scarcityIndex: number) {
  if (!Number.isFinite(scarcityIndex) || scarcityIndex <= 0) {
    return 'Scarcity signals are unavailable for this role.';
  }

  if (scarcityIndex >= 80) {
    return 'Severe skill scarcity detected. Broaden location or loosen must-haves.';
  }

  if (scarcityIndex >= 60) {
    return 'High scarcity: consider reducing hard requirements or adjusting compensation.';
  }

  return 'Talent supply looks stable relative to demand.';
}

function getMetaObject(value: Prisma.JsonValue | null | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getNumericMeta(meta: Record<string, unknown>, keys: string[], fallback: number | null = null) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function normalizeConfidenceBand(value: unknown) {
  if (typeof value !== 'string') return 'UNKNOWN';
  const trimmed = value.trim();
  if (!trimmed) return 'UNKNOWN';

  const upper = trimmed.toUpperCase();

  if (upper.startsWith('H')) return 'HIGH';
  if (upper.startsWith('M')) return 'MEDIUM';
  if (upper.startsWith('L')) return 'LOW';

  return upper;
}

function summarizeRecruiterBehavior(
  events: { eventType: string; meta: Prisma.JsonValue | null }[],
  windowDays: number,
): RecruiterBehaviorInsights {
  const explanationByConfidence: Record<string, number> = {};
  const overrideConfidence: Record<string, number> = {};
  const decisionDurations: number[] = [];

  let candidateOpens = 0;
  let candidatesSurfaced = 0;
  let toShortlist = 0;
  let removedFromShortlist = 0;

  for (const event of events) {
    const meta = getMetaObject(event.meta);
    const details = getMetaObject(meta.details);
    const confidenceBand = normalizeConfidenceBand(meta.confidence);
    const surfaced = getNumericMeta(details, ['surfaced', 'presented', 'totalSurfaced'], null);
    const surfacedFromMeta = getNumericMeta(meta, ['surfaced', 'presented', 'totalSurfaced'], null);

    if (event.eventType === 'RECRUITER_BEHAVIOR_CANDIDATE_OPEN') {
      candidateOpens += 1;

      if (surfaced !== null || surfacedFromMeta !== null) {
        candidatesSurfaced += Math.max(surfaced ?? surfacedFromMeta ?? 0, 1);
      } else {
        candidatesSurfaced += 1;
      }
    }

    if (event.eventType === 'RECRUITER_BEHAVIOR_EXPLANATION_EXPANDED') {
      explanationByConfidence[confidenceBand] = (explanationByConfidence[confidenceBand] ?? 0) + 1;
    }

    if (event.eventType === 'RECRUITER_BEHAVIOR_SHORTLIST_OVERRIDE') {
      overrideConfidence[confidenceBand] = (overrideConfidence[confidenceBand] ?? 0) + 1;

      const toValue = typeof details.to === 'boolean' ? details.to : false;
      const fromValue = typeof details.from === 'boolean' ? details.from : !toValue;

      if (toValue !== fromValue) {
        if (toValue) {
          toShortlist += 1;
        } else {
          removedFromShortlist += 1;
        }
      }
    }

    if (event.eventType === 'RECRUITER_BEHAVIOR_DECISION_TIME') {
      const duration = typeof meta.durationMs === 'number' ? meta.durationMs : null;

      if (duration !== null && Number.isFinite(duration)) {
        decisionDurations.push(duration);
      }

      if (surfaced !== null || surfacedFromMeta !== null) {
        candidatesSurfaced += Math.max(surfaced ?? surfacedFromMeta ?? 0, 1);
      }
    }
  }

  candidatesSurfaced = Math.max(candidatesSurfaced, candidateOpens);
  const candidatesIgnored = Math.max(candidatesSurfaced - candidateOpens, 0);

  const averageDecisionMs =
    decisionDurations.length > 0
      ? decisionDurations.reduce((sum, entry) => sum + entry, 0) / decisionDurations.length
      : 0;

  const insights: string[] = [];

  if (candidatesSurfaced > 0) {
    const viewRate = candidateOpens / candidatesSurfaced;
    const viewedPct = Math.round(viewRate * 100);
    insights.push(
      viewRate >= 0.65
        ? `${viewedPct}% of surfaced matches are opened; current defaults are keeping curiosity high.`
        : `${viewedPct}% of surfaced matches are opened; consider gentler filters or clearer cues to lift opens.`,
    );
  }

  if (candidateOpens > 0 && candidatesIgnored > candidateOpens * 0.5) {
    insights.push('Most surfaced matches are skipped; reinforce top picks in the first fold.');
  }

  const explanationTopEntry = Object.entries(explanationByConfidence).sort((a, b) => b[1] - a[1])[0];
  if (explanationTopEntry) {
    insights.push(`Explanations are expanded most for ${explanationTopEntry[0]} confidence matches.`);
  }

  const overrideTopEntry = Object.entries(overrideConfidence).sort((a, b) => b[1] - a[1])[0];
  if (overrideTopEntry) {
    insights.push(`Shortlist overrides skew toward ${overrideTopEntry[0]} confidence recommendations.`);
  }

  if (averageDecisionMs > 0) {
    const seconds = (averageDecisionMs / 1000).toFixed(1);
    insights.push(`Typical decision dwell time is ${seconds}s; streamline defaults instead of nudging individuals.`);
  }

  return {
    windowDays,
    candidateOpens,
    candidatesSurfaced,
    candidatesIgnored,
    explanationOpensByConfidence: explanationByConfidence,
    shortlistOverrides: {
      total: toShortlist + removedFromShortlist,
      toShortlist,
      removedFromShortlist,
      byConfidence: overrideConfidence,
    },
    averageDecisionMs,
    insights,
  } satisfies RecruiterBehaviorInsights;
}
