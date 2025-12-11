import { describe, expect, it } from 'vitest';

import { evaluateWatchdog, type WatchdogRunSnapshot } from '@/lib/agents/watchdog';

describe('TS-A7 Watchdog', () => {
  const baseRuns: WatchdogRunSnapshot[] = Array.from({ length: 12 }).map((_, index) => ({
    agentName: 'ETE-TS.RINA',
    status: index % 3 === 0 ? 'FAILED' : 'SUCCESS',
    durationMs: 1200 + index * 10,
    outputComplete: index % 3 !== 0,
    errorCategory: index % 4 === 0 ? 'AI' : null,
    timestamp: new Date(`2024-04-${String(10 + index).padStart(2, '0')}T12:00:00Z`),
  }));

  it('raises alerts when thresholds are breached with enriched tagging', () => {
    const report = evaluateWatchdog(baseRuns, {
      windowSize: 12,
      failureRateThreshold: 0.2,
      incompleteRateThreshold: 0.2,
      latencyP95ThresholdMs: 1250,
      rateJitterTolerance: 0.03,
      latencyJitterToleranceMs: 10,
    });

    const failureAlert = report.alerts.find((alert) => alert.type === 'FAILURE_RATE');
    const latencyAlert = report.alerts.find((alert) => alert.type === 'LATENCY');
    const incompleteAlert = report.alerts.find((alert) => alert.type === 'INCOMPLETE_OUTPUT');

    expect(failureAlert?.metric).toBeCloseTo(0.3333, 3);
    expect(failureAlert?.tags).toEqual(expect.arrayContaining(['failure-rate', 'error:AI']));
    expect(failureAlert?.context).toMatchObject({ failedRuns: 4, failureRate: expect.any(Number) });
    expect((failureAlert?.context as { recentErrors?: unknown }).recentErrors).toEqual(
      expect.arrayContaining([
        { category: 'AI', count: 1 },
        { category: 'unknown', count: 3 },
      ]),
    );

    expect(latencyAlert?.metric).toBeGreaterThan(latencyAlert?.threshold ?? 0);
    expect(latencyAlert?.tags).toEqual(expect.arrayContaining(['latency', 'p95']));

    expect(incompleteAlert?.metric).toBeGreaterThan(incompleteAlert?.threshold ?? 0);
    expect(incompleteAlert?.tags).toEqual(expect.arrayContaining(['output:incomplete', 'quality']));
  });

  it('filters out noisy signals until thresholds are sustainably breached', () => {
    const noisySmallSample: WatchdogRunSnapshot[] = [
      { agentName: 'ETE-TS.RUA', status: 'FAILED', durationMs: 900, outputComplete: true },
      { agentName: 'ETE-TS.RUA', status: 'SUCCESS', durationMs: 950, outputComplete: true },
      { agentName: 'ETE-TS.RUA', status: 'SUCCESS', durationMs: 910, outputComplete: true },
    ];

    const smallSampleReport = evaluateWatchdog(noisySmallSample, { minWindow: 5 });
    expect(smallSampleReport.alerts).toHaveLength(0);

    const barelyOverThreshold = Array.from({ length: 8 }).map<WatchdogRunSnapshot>((_, index) => ({
      agentName: 'ETE-TS.RUA',
      status: index < 2 ? 'FAILED' : 'SUCCESS',
      durationMs: 1200,
      outputComplete: true,
    }));

    const jitterReport = evaluateWatchdog(barelyOverThreshold, {
      failureRateThreshold: 0.2,
      rateJitterTolerance: 0.05,
      minWindow: 5,
    });

    expect(jitterReport.alerts.find((alert) => alert.type === 'FAILURE_RATE')).toBeUndefined();

    const clearSignalReport = evaluateWatchdog(barelyOverThreshold, {
      failureRateThreshold: 0.2,
      rateJitterTolerance: 0.02,
      minWindow: 5,
    });

    expect(clearSignalReport.alerts.find((alert) => alert.type === 'FAILURE_RATE')).toBeDefined();
  });
});
